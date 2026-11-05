// ============================================================================
// 低空 3D 建筑（套餐 B · 免费商用）
// ----------------------------------------------------------------------------
// 重要设计变更（修复"拼图感"）：
//   早期把 MVT 瓦片的建筑 / 街道 / 地面色块逐一画成矩形贴在地球上，
//   中高空缩放时瓦片边界、数据截断、空白间隙会形成一块块"拼图"。
//   现在地面统一由 /api/imagery 代理的连续卫星影像铺满（满屏同一张图），
//   本模块只负责在 3km 以下低空额外浮现 3D 建筑体块，且每瓦片均匀配额，
//   不再绘制任何地面色块 / 瓦片底板 / 矢量街道线。
//
// 数据源: OpenFreeMap 公开矢量瓦片（经本站 /api/tiles 同源代理转发）
//         —— 官方明确允许商用、无需注册/API key；地图数据来自 OSM (ODbL)。
// 合规: 实时流式读取 + 渲染为 3D 图像（Produced Work），不落盘成自有衍生
//       数据库对外分发，不触发 ODbL share-alike；署名见页面 footer。
// 说明: Cesium ion 免费 Community 层禁商用，故不使用 createOsmBuildingsAsync()。
// ============================================================================

import { VectorTile } from "@mapbox/vector-tile";
import * as PbfModule from "pbf";
const PbfReader: any =
  (PbfModule as any).PbfReader || (PbfModule as any).default || PbfModule;

const TILE_ENDPOINT = "/api/tiles";
const BUILDING_ZOOM = 14;
const MAX_TILES_PER_LOAD = 9; // 3×3 邻域，均匀覆盖视野，避免"只有前几块有楼"
const MAX_BUILDINGS_PER_TILE = 300; // 每瓦片配额（而不是全局按瓦片顺序截断）
const MAX_RENDER_BUILDINGS = 2700;
const BUILDING_VISIBLE_HEIGHT = 3000; // 低于 3km 才浮现 3D 建筑，高于则只留连续影像

export type CityLayerStatus = {
  state: "off" | "imagery" | "loading" | "ready" | "empty" | "error";
  buildings: number;
  roads: number; // 保留字段兼容上层 UI，地面街道已由连续影像提供，恒为 0
  tiles: number;
  height: number;
};

type BuildingGeom = { ring: [number, number][]; height: number; minHeight: number };

function lonLatToTile(lon: number, lat: number, z: number) {
  const n = 2 ** z;
  const latR = (lat * Math.PI) / 180;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n
  );
  return { x, y, z };
}

/** 只解析 building 层，按每瓦片配额均匀取样 */
async function fetchTileBuildings(x: number, y: number, z: number): Promise<BuildingGeom[]> {
  const res = await fetch(`${TILE_ENDPOINT}?z=${z}&x=${x}&y=${y}`);
  if (!res.ok) throw new Error(`tile ${z}/${x}/${y}: ${res.status}`);
  const buf = await res.arrayBuffer();
  if (!buf.byteLength) throw new Error("empty tile");
  const tile = new VectorTile(new PbfReader(new Uint8Array(buf)));
  const bl = tile.layers.building;
  if (!bl) return [];
  const out: BuildingGeom[] = [];
  const limit = Math.min(bl.length, MAX_BUILDINGS_PER_TILE);
  for (let i = 0; i < limit; i++) {
    try {
      const f = bl.feature(i);
      const h = Number(f.properties.render_height);
      if (!isFinite(h) || h <= 0) continue;
      const g = f.toGeoJSON(x, y, z).geometry;
      if (!g) continue;
      const polys: any[] =
        g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
      for (const poly of polys) {
        const ring = poly[0];
        if (!ring || ring.length < 4) continue;
        out.push({
          ring: ring.map((p: number[]) => [p[0], p[1]] as [number, number]),
          height: Math.min(h, 500),
          minHeight: Number(f.properties.render_min_height) || 0,
        });
        if (out.length >= MAX_BUILDINGS_PER_TILE) break;
      }
    } catch {
      /* 单个要素异常跳过 */
    }
    if (out.length >= MAX_BUILDINGS_PER_TILE) break;
  }
  return out;
}

export type OsmBuildingsController = {
  update: () => void;
  setEnabled: (on: boolean) => void;
  destroy: () => void;
};

export function createOsmBuildings(
  Cesium: any,
  viewer: any,
  onStatus?: (s: CityLayerStatus) => void
): OsmBuildingsController {
  let enabled = true;
  let destroyed = false;
  let primitive: any = null;
  let generation = 0;
  const cache = new Map<string, BuildingGeom[]>();
  let busy = false;
  let pending = false;
  let lastLoadAt = 0;

  const report = (s: CityLayerStatus) => {
    try { onStatus?.(s); } catch {}
  };

  const removePrimitive = () => {
    if (primitive && !viewer.isDestroyed?.()) {
      try { viewer.scene.primitives.remove(primitive); } catch {}
    }
    primitive = null;
  };

  const buildPrimitive = (geoms: BuildingGeom[]) => {
    removePrimitive();
    if (!geoms.length || destroyed) return;
    const instances: any[] = [];
    for (const g of geoms) {
      try {
        const coords: number[] = [];
        for (const [lon, lat] of g.ring) coords.push(lon, lat);
        const geometry = new Cesium.PolygonGeometry({
          polygonHierarchy: new Cesium.PolygonHierarchy(
            Cesium.Cartesian3.fromDegreesArray(coords)
          ),
          height: g.minHeight,
          extrudedHeight: g.height,
          vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
        });
        const t = Math.min(1, g.height / 180);
        const color = Cesium.Color.multiplyByScalar(
          Cesium.Color.fromCssColorString("#b9d2ec"),
          0.6 + 0.4 * t,
          new Cesium.Color()
        );
        instances.push(
          new Cesium.GeometryInstance({
            geometry,
            attributes: {
              color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
            },
          })
        );
      } catch {}
    }
    if (!instances.length) return;
    try {
      primitive = new Cesium.Primitive({
        geometryInstances: instances,
        appearance: new Cesium.PerInstanceColorAppearance({
          translucent: false,
          flat: false,
        }),
        asynchronous: false,
        allowPicking: false,
      });
      viewer.scene.primitives.add(primitive);
    } catch {
      removePrimitive();
    }
  };

  const load = async () => {
    if (busy) { pending = true; return; }
    busy = true;
    const myGen = ++generation;
    try {
      const carto = viewer.camera.positionCartographic;
      const height = carto?.height ?? 1e9;
      if (!enabled) {
        removePrimitive();
        report({ state: "off", buildings: 0, roads: 0, tiles: 0, height });
        return;
      }
      // 中高空：只显示连续卫星影像，不叠任何自绘瓦片 → 满屏统一、无拼图
      if (height > BUILDING_VISIBLE_HEIGHT) {
        removePrimitive();
        report({ state: "imagery", buildings: 0, roads: 0, tiles: 0, height });
        return;
      }
      report({ state: "loading", buildings: 0, roads: 0, tiles: 0, height });

      let lon = (carto.longitude * 180) / Math.PI;
      let lat = (carto.latitude * 180) / Math.PI;
      // 斜视时相机位置与视野中心差数公里，用屏幕中心拾取椭球交点算瓦片更准
      try {
        const canvas = viewer.scene.canvas;
        const mid = new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2);
        const hit = viewer.camera.pickEllipsoid(mid, viewer.scene.globe.ellipsoid);
        if (hit) {
          const c = Cesium.Cartographic.fromCartesian(hit);
          lon = (c.longitude * 180) / Math.PI;
          lat = (c.latitude * 180) / Math.PI;
        }
      } catch {}
      const center = lonLatToTile(lon, lat, BUILDING_ZOOM);
      const offsets = [
        [0, 0], [-1, -1], [0, -1], [1, -1],
        [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
      ];
      const targets = offsets
        .slice(0, MAX_TILES_PER_LOAD)
        .map(([dx, dy]) => ({ x: center.x + dx, y: center.y + dy, z: center.z }));

      let okTiles = 0;
      const results = await Promise.all(
        targets.map(async (t) => {
          const key = `${t.z}/${t.x}/${t.y}`;
          if (cache.has(key)) { okTiles++; return cache.get(key)!; }
          try {
            const g = await fetchTileBuildings(t.x, t.y, t.z);
            cache.set(key, g);
            if (cache.size > 48) {
              const first = cache.keys().next().value;
              if (first) cache.delete(first);
            }
            okTiles++;
            return g;
          } catch {
            return [] as BuildingGeom[];
          }
        })
      );
      if (destroyed || myGen !== generation || !enabled) return;
      // 均匀配额：每瓦片取相同上限，避免全局 slice 只让前几个瓦片有楼
      const perTile = Math.max(1, Math.floor(MAX_RENDER_BUILDINGS / targets.length));
      const geoms = results.flatMap((r) => r.slice(0, perTile));
      buildPrimitive(geoms);
      report({
        state: geoms.length ? "ready" : okTiles === 0 ? "error" : "empty",
        buildings: geoms.length,
        roads: 0,
        tiles: okTiles,
        height,
      });
    } catch {
      report({ state: "error", buildings: 0, roads: 0, tiles: 0, height: 0 });
    } finally {
      busy = false;
      lastLoadAt = Date.now();
      if (pending) { pending = false; load(); }
    }
  };

  const throttledLoad = () => {
    if (destroyed || Date.now() - lastLoadAt < 500) return;
    load();
  };
  const onMoveEnd = () => throttledLoad();
  viewer.camera.moveEnd.addEventListener(onMoveEnd);
  try { viewer.camera.percentageChanged = 0.08; } catch {}
  const onChanged = () => throttledLoad();
  viewer.camera.changed.addEventListener(onChanged);
  load();

  return {
    update: () => throttledLoad(),
    setEnabled: (on: boolean) => {
      enabled = on;
      if (!on) {
        generation++;
        removePrimitive();
        report({ state: "off", buildings: 0, roads: 0, tiles: 0, height: 0 });
      } else load();
    },
    destroy: () => {
      destroyed = true;
      generation++;
      try { viewer.camera.moveEnd.removeEventListener(onMoveEnd); } catch {}
      try { viewer.camera.changed.removeEventListener(onChanged); } catch {}
      removePrimitive();
      cache.clear();
    },
  };
}
