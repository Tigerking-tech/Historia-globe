"use client";

import { useEffect, useRef, useState } from "react";
import {
  createOsmBuildings,
  type OsmBuildingsController,
  type CityLayerStatus,
} from "@/lib/osm-buildings";
import type { CameraState } from "@/lib/ask-yore/types";

// ===== 套餐 B 免费数据源（可商用、无需付费 token） =====
// 地面(唯一) : Esri World Imagery — 经本站 /api/imagery 同源代理按需转发，z0-z19 连续铺满
//              （需署名 © Esri；不批量抓取、不落盘成自有数据集）
// 低空 3D 建筑: OpenFreeMap / OSM — 经本站 /api/tiles 同源代理，仅 <3km 低空浮现
//              （ODbL，Produced Work 不传染；署名 © OpenMapTiles / © OSM contributors）
// 国界/城市  : Natural Earth — 公共领域
// 真实地形    : Cesium World Terrain — 仅当用户填入自有 ion token 时启用（默认平滑椭球）
// 渲染引擎    : CesiumJS — Apache-2.0
// 重要修正: 早期把 MVT 瓦片逐块画成地面色块/街道线，中高空缩放会形成"拼图"观感；
//          现改为单一连续影像层铺满全屏，任何缩放级别都是同一张图。
//          另：AWS Terrain Tiles 并非 Cesium 兼容地形源(404)，已彻底移除，绝不崩溃。

declare global {
  interface Window {
    Cesium?: any;
    CESIUM_BASE_URL?: string;
  }
}

// ===== 地表点分级显示（LOD）=====
// 全球视角相机高度约 2000 万米，700 个世界遗产点 + 1500 个城市点会挤成一片密集
// 噪点，既盖住连续卫星影像、又完全看不清。按「相机到该点的距离」分级：
// 全球 / 洲际只保留当天事件点（数量本就很少），放大到区域级才逐层浮现。
// DistanceDisplayCondition(near, far)：相机距点超过 far（米）即不渲染。
const HERITAGE_FAR = 8_000_000;    // 8000km 内才显示世界遗产
const CITY_MAJOR_FAR = 6_000_000;  // 前 300 大城市
const CITY_MINOR_FAR = 2_000_000;  // 其余城市，近地才出现

export type GlobeEvent = {
  id: string;
  year: number;
  title: string;
  lat: number;
  lon: number;
  category: string;
  place?: string;
};

export type GlobeHeritage = {
  id: string;
  name: string;
  lat: number;
  lon: number;
};

/** 相机飞行目标：altitude(米) 与 pitch(度) 可指定，用于低空斜视看 3D 街区 */
export type GlobeFocus = {
  lat: number;
  lon: number;
  altitude?: number;
  pitch?: number;
  heading?: number;
};

type Props = {
  events?: GlobeEvent[];
  heritage?: GlobeHeritage[];
  onSelect?: (e: GlobeEvent) => void;
  view?: "satellite" | "countries" | "night";
  focus?: GlobeFocus | null;
  /** UI 语言，驱动城市名（zh 用中文译名）与建筑开关等 */
  lang?: "en" | "zh";
  /** 是否显示真实 3D 街区（OpenFreeMap/OSM 免费商用流式瓦片） */
  buildings?: boolean;
  /** 3D 街区加载状态，用于 UI 反馈（避免"放大后一片空白却不知道原因"） */
  onCityStatus?: (s: CityLayerStatus) => void;
  /** 首帧卫星影像瓦片加载完成时回调，用于消除切换后长时间黑屏却无反馈的问题 */
  onImageryReady?: () => void;
  /** 影像加载进度（remaining = 待加载瓦片数），用于 UI 显示真实进度 */
  onImageryProgress?: (p: { remaining: number; phase: "start" | "progress" | "ready" }) => void;
  /** 当 Cesium 渲染失败（如设备软件 WebGL 不兼容）时回调，便于上层优雅降级回经典地球 */
  onFatalError?: () => void;
  /** 相机移动结束后上报当前视角，供分享链接记录 */
  onCameraChange?: (c: CameraState) => void;
  /** 视线中心的地表经纬度（「此刻此地」用）；低空斜视时与相机自身位置不同 */
  onViewCenter?: (c: { lat: number; lon: number; alt: number }) => void;
  /** 历史边界时间滑块：指向某个年份的 GeoJSON；不传则用现代 Natural Earth 基线。 */
  boundaryUrl?: string;
};

// 连续栅格影像（同源代理 /api/imagery，z0-z19 全覆盖）：
// 任何缩放级别都是"满屏同一张图"，不再出现自绘瓦片一块块拼接的观感。
// 服务端转发 Esri World Imagery，移动网络无需直连上游；本地 Blue Marble 仅作兜底。
const SAT_IMAGERY = "/api/imagery?z={z}&x={x}&y={y}&style=sat";
// 可选：用户自有 Cesium ion token（免费注册）→ 启用真实 3D 地形起伏。留空则用平滑椭球。
const ION_TOKEN = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN || "";

const CAT_COLOR: Record<string, string> = {
  politics: "#60a5fa",
  war: "#f87171",
  space: "#818cf8",
  science: "#34d399",
  disaster: "#fb923c",
  tech: "#a78bfa",
  exploration: "#22d3ee",
  "civil-rights": "#facc15",
  terrorism: "#ef4444",
  environment: "#4ade80",
  archaeology: "#c084fc",
  history: "#94a3b8",
  crime: "#f472b6",
  mystery: "#64748b",
};

function loadCesiumScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Cesium) return resolve(true);
    // 让 Cesium 能从本地 /cesium/ 加载 Assets/Workers（本地 Natural Earth II 等）
    (window as any).CESIUM_BASE_URL = "/cesium/";
    const s = document.createElement("script");
    s.src = "/cesium/Cesium.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "/cesium/Widgets/widgets.css";
    document.head.appendChild(l);
  });
}

export default function CesiumGlobe({
  events = [],
  heritage = [],
  onSelect,
  view = "satellite",
  focus = null,
  lang = "en",
  buildings = true,
  onCityStatus,
  onImageryReady,
  onImageryProgress,
  onFatalError,
  onCameraChange,
  onViewCenter,
  boundaryUrl,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const eventsRef = useRef<GlobeEvent[]>(events);
  const heritageRef = useRef<GlobeHeritage[]>(heritage);
  const viewRef = useRef<Props["view"]>(view);
  const focusRef = useRef(focus);
  const onSelectRef = useRef(onSelect);
  const fatalRef = useRef(onFatalError);
  const cityStatusRef = useRef(onCityStatus);
  const imageryReadyRef = useRef(onImageryReady);
  const imageryProgressRef = useRef(onImageryProgress);
  const langRef = useRef(lang);
  const buildingsRef = useRef(buildings);
  // 城市 label 实体引用（含中英名），语言切换时实时更新文本
  const cityLabelEntsRef = useRef<{ ent: any; n: string; nz?: string }[]>([]);
  // 真实 3D 建筑控制器
  const buildingsCtlRef = useRef<OsmBuildingsController | null>(null);
  const countryDsRef = useRef<any>(null);
  // 历史边界时间滑块：viewer 就绪标志 + 请求序号（快速滑动年份时只保留最后一次结果）
  const [viewerReady, setViewerReady] = useState(false);
  const boundaryReqRef = useRef(0);
  const imageryRef = useRef<{ base: any; sat: any }>({ base: null, sat: null });
  const onCameraChangeRef = useRef(onCameraChange);
  const onViewCenterRef = useRef(onViewCenter);

  eventsRef.current = events;
  heritageRef.current = heritage;
  viewRef.current = view;
  focusRef.current = focus;
  onSelectRef.current = onSelect;
  fatalRef.current = onFatalError;
  cityStatusRef.current = onCityStatus;
  imageryReadyRef.current = onImageryReady;
  imageryProgressRef.current = onImageryProgress;
  langRef.current = lang;
  buildingsRef.current = buildings;
  onCameraChangeRef.current = onCameraChange;
  onViewCenterRef.current = onViewCenter;

  const rebuildMarkers = () => {
    const viewer = viewerRef.current;
    const Cesium = window.Cesium;
    if (!viewer || !Cesium) return;
    viewer.entities.values
      .filter((e: any) => e._hgEventId || e._hgHeritage)
      .forEach((e: any) => viewer.entities.remove(e));
    eventsRef.current.forEach((ev) => {
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(ev.lon, ev.lat, 0),
        point: {
          pixelSize: 9,
          color: Cesium.Color.fromCssColorString(CAT_COLOR[ev.category] || "#60a5fa"),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 1,
          disableDepthTestDistance: 20000,
        },
        _hgEventId: ev.id,
      });
    });
    heritageRef.current.forEach((h) => {
      viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(h.lon, h.lat, 0),
        point: {
          // 更小、更淡，且全球视角隐藏：放大后才逐层出现，避免糊成金色噪点
          pixelSize: 4,
          color: Cesium.Color.fromCssColorString("#fbbf24").withAlpha(0.72),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, HERITAGE_FAR),
          disableDepthTestDistance: 20000,
        },
        _hgHeritage: true,
      });
    });
  };

  const applyView = (v: Props["view"]) => {
    const viewer = viewerRef.current;
    const Cesium = window.Cesium;
    if (!viewer || !Cesium) return;
    const { base, sat } = imageryRef.current;
    if (base) base.show = true;
    if (sat) {
      // 三个视图共用同一张连续影像，切换不会露出空白底图。
      // "夜景" 用暗化 + 去饱和实现（NASA Black Marble 在国内移动网络常不可达），
      // 保证任何视图都是"满屏同一张图"。
      sat.show = true;
      sat.brightness = v === "night" ? 0.32 : 1.0;
      sat.saturation = v === "night" ? 0.65 : 1.0;
      sat.contrast = v === "night" ? 1.15 : 1.0;
    }
    if (v === "countries") {
      if (countryDsRef.current && !viewer.dataSources.contains(countryDsRef.current)) {
        viewer.dataSources.add(countryDsRef.current);
      }
    } else {
      if (countryDsRef.current && viewer.dataSources.contains(countryDsRef.current)) {
        viewer.dataSources.remove(countryDsRef.current, false);
      }
    }
  };

  /** 应用相机目标；viewer 就绪前传入的 focus（分享链接恢复）会在初始化末尾补应用一次 */
  const flyToFocus = (f: GlobeFocus) => {
    const viewer = viewerRef.current;
    const Cesium = window.Cesium;
    if (!viewer || !Cesium || !f) return;
    const altitude = f.altitude ?? 1.4e6;
    // 低空自动改为斜视（Google 地球视角），高空保持正俯视
    const pitch = f.pitch ?? (altitude < 100000 ? -40 : -90);
    const orientation = {
      heading: Cesium.Math.toRadians(f.heading ?? 0),
      pitch: Cesium.Math.toRadians(pitch),
      roll: 0,
    };
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(f.lon, f.lat, altitude),
      orientation,
      duration: 1.8,
      // flyTo 在极近目的地时可能回落到默认正俯视，结束后再锁定一次斜视，
      // 否则只能看到建筑顶面，没有 Google 地球那种立体街区感。
      complete:
        altitude < 100000
          ? () => {
              try {
                viewer.camera.setView({
                  destination: viewer.camera.position.clone(),
                  orientation,
                });
              } catch {}
            }
          : undefined,
    });
  };

  // ---- one-time viewer setup ----
  useEffect(() => {
    let disposed = false;
    let viewer: any = null;
    let handler: any = null;
    let moveEndHandler: any = null;
    loadCesiumScript().then(async (ok) => {
      if (!ok || disposed || !mountRef.current) {
        if (mountRef.current && !ok) {
          const msg = document.createElement("div");
          msg.style.cssText =
            "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#8da2c4;font-size:13px;text-align:center;padding:20px;";
          msg.textContent = "Failed to load the 3D engine (Cesium). Check your network.";
          mountRef.current.appendChild(msg);
        }
        return;
      }
      const Cesium = window.Cesium;
      try {
        // 若有用户自有 ion token 才设置；否则保留默认（不请求任何 ion 资源）
        if (ION_TOKEN) Cesium.Ion.defaultAccessToken = ION_TOKEN;

        // 加固：确认容器已有有效尺寸再建 Viewer，避免首帧以 0 尺寸初始化
        // （SwiftShader 下 0 尺寸首帧偶发 NaN 数组长度崩溃）
        const mount = mountRef.current!;
        const ready = () =>
          mount.clientWidth > 0 && mount.clientHeight > 0;
        if (!ready()) {
          await new Promise<void>((res) => {
            let tries = 0;
            const iv = setInterval(() => {
              tries++;
              if (ready() || tries > 30) {
                clearInterval(iv);
                res();
              }
            }, 16);
          });
        }

        viewer = new Cesium.Viewer(mount, {
          baseLayer: false, // 我们自建图层（本地 Natural Earth II 兜底）
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          selectionIndicator: false,
          infoBox: false,
        });
        viewerRef.current = viewer;
        // 仅自检模式暴露 viewer 引用，便于浏览器自动化逐页核验几何与相机（生产不受影响）
        if (typeof window !== "undefined" && /hgdebug=1/.test(window.location.search)) {
          (window as any).__hgViewer = viewer;
        }
        // Cesium Viewer 默认会在画面角落显示 "Cesium ion" 水印。本方案不依赖任何
        // ion 资源（免费层禁商用），显示该水印会误导用户；所有必要署名已由页面
        // 自定义署名条统一给出，因此隐藏 Cesium 自带 credit 容器。
        try {
          const cc = viewer.cesiumWidget?.creditContainer;
          if (cc) cc.style.display = "none";
        } catch {}
        const scene = viewer.scene;
        // 加固：先给一个明确的初始相机位，再让渲染循环接管，规避默认相机边界 NaN。
        // 高度取 2100 万米：地球圆盘完整醒目；更高（2800 万米）在软件 WebGL 下
        // 会出现 globe 瓦片被剔除、首屏只剩黑色星空的情况。
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(0, 15, 21000000),
        });
        scene.globe.baseColor = Cesium.Color.fromCssColorString("#0b1f3a");
        scene.skyAtmosphere.show = true; // 蓝色大气边缘，Google-Earth-like
        scene.screenSpaceCameraController.enableTilt = true; // 允许斜视俯仰，像 Google 地球
        // 保留在街区级（约 250m 以上），避免贴地到几十米时视野过小、只剩一片空面
        scene.screenSpaceCameraController.minimumZoomDistance = 250;
        scene.screenSpaceCameraController.maximumZoomDistance = 60000000;
        scene.globe.depthTestAgainstTerrain = false;
        // 缓解软件 WebGL（SwiftShader 等）下偶发的地形瓦片 NaN 崩溃：减少瓦片数量
        scene.globe.maximumScreenSpaceError = 4;
        scene.globe.preloadAncestors = false;
        scene.globe.preloadSiblings = false;
        // 优雅降级：Cesium 渲染抛错（如设备软件 WebGL 不兼容）时通知上层切回经典地球
        const onRenderError = (s: any, err: any) => {
          console.warn("[CesiumGlobe] render error, falling back:", err && err.message);
          fatalRef.current?.();
        };
        if (scene.renderError) scene.renderError.addEventListener(onRenderError);

        // 真实 3D 地形（可选）：仅当用户填入自有 Cesium ion token 时启用。
        // 否则使用默认平滑椭球地形 —— 绝不依赖任何外部/404 地形源，避免崩溃。
        if (ION_TOKEN) {
          try {
            const terrain = await Cesium.createWorldTerrainAsync();
            viewer.terrainProvider = terrain;
          } catch {
            /* 失败则退回平滑椭球 */
          }
        }

        // P2 首帧提速：先铺一层**本地**低清地球贴图作为即时底图（毫秒级，无需外网）。
        // 这样切换「真实地球」后立刻能看到地球，而不是盯着黑色星空等 Esri 瓦片 20s+。
        // 当 Esri 卫星瓦片（上层）逐块到位后会自然覆盖这张占位图；占位图只在
        // 全球尺度短暂可见，放大后完全被连续影像取代，不产生近景拉伸色块/拼图感。
        let base: any = null;
        try {
          const Single = Cesium.SingleTileImageryProvider;
          const provider = Single.fromUrl
            ? await Single.fromUrl("/earth-day.jpg")
            : new Single({ url: "/earth-day.jpg" });
          base = viewer.imageryLayers.addImageryProvider(provider);
          base.alpha = 1;
        } catch {
          // 该版本 Cesium 不支持单图 provider 时静默跳过，主影像链路不受影响
        }

        // 上层：同源代理的连续卫星影像（z0-z19 全覆盖）。
        // 代理偶发失败时 Cesium 自动保留低级别瓦片放大显示，不会露出空白或色块。
        let sat: any = null;
        try {
          sat = viewer.imageryLayers.addImageryProvider(
            new Cesium.UrlTemplateImageryProvider({
              url: SAT_IMAGERY,
              maximumLevel: 19,
              credit: new Cesium.Credit("Imagery © Esri", false),
            })
          );
          // 不手动调 alpha：Cesium 上层瓦片未加载时本就会透出下层本地底图，
          // 瓦片逐块到位自然覆盖，实现「立即有地球 → 渐进变清晰」，无突兀跳变。
        } catch {}
        imageryRef.current = { base, sat };

        // 首个可见瓦片到位就撤销 loading（不再等 remaining === 0 的全部瓦片），
        // 并把真实进度传给上层；本地底图已保证这期间不是黑屏。
        try {
          let fired = false;
          let firstSeen = false;
          const fire = () => {
            if (fired || disposed) return;
            fired = true;
            imageryProgressRef.current?.({ remaining: 0, phase: "ready" });
            imageryReadyRef.current?.();
          };
          imageryProgressRef.current?.({ remaining: -1, phase: "start" });
          const handler = (remaining: number) => {
            if (!firstSeen && remaining >= 0) {
              firstSeen = true;
              imageryProgressRef.current?.({ remaining, phase: "progress" });
              // 首块瓦片一旦开始加载，本地底图已在显示；给瓦片一个短暂绘制窗口即可撤罩
              setTimeout(fire, 1200);
            }
            if (remaining === 0) fire();
          };
          scene.globe.tileLoadProgressEvent.addEventListener(handler);
          // 兜底从 30s 缩短到 12s：上游极慢时也不能永远转圈
          setTimeout(fire, 12000);
        } catch {}

        // 国界线加载移到下方「历史边界时间轴」独立 effect：viewer 就绪后按
        // boundaryUrl 加载（默认仍是 /countries.geojson 现代基线），切换年份时
        // 只替换 dataSource，不重建 viewer、不重载影像瓦片。
        if (!disposed) setViewerReady(true);

        // 城市标注：Natural Earth Populated Places（公共领域）
        // 仅人口前 300 的大城市加文字 label —— 避免大量 label 实体在软件 WebGL
        // （SwiftShader 等）下触发渲染崩溃。所有城市点按缩放分级：全球视角隐藏，
        // 大城市先于小城浮现，避免 1500 个白点铺满整个球面。
        const cityText = (c: any) =>
          (langRef.current === "zh" ? c.nz || c.n : c.n) as string;
        fetch("/cities.json")
          .then((r) => (r.ok ? r.json() : null))
          .then((arr: any[]) => {
            if (!arr || disposed) return;
            const labelEnts: { ent: any; n: string; nz?: string }[] = [];
            arr.slice(0, 1500).forEach((c: any, i: number) => {
              const major = i < 300;
              const ent: any = {
                position: Cesium.Cartesian3.fromDegrees(c.lo, c.la, 0),
                point: {
                  pixelSize: major ? 3 : 2.5,
                  color: Cesium.Color.WHITE.withAlpha(major ? 0.65 : 0.45),
                  distanceDisplayCondition: new Cesium.DistanceDisplayCondition(
                    0,
                    major ? CITY_MAJOR_FAR : CITY_MINOR_FAR
                  ),
                  disableDepthTestDistance: 20000,
                },
              };
              if (major) {
                ent.label = {
                  text: cityText(c),
                  font: "11px sans-serif",
                  fillColor: Cesium.Color.WHITE,
                  style: Cesium.LabelStyle.FILL,
                  pixelOffset: new Cesium.Cartesian2(0, -8),
                  scaleByDistance: new Cesium.NearFarScalar(1.5e6, 1.0, 9.0e6, 0.0),
                  disableDepthTestDistance: 20000,
                  showBackground: true,
                  backgroundColor: new Cesium.Color(0, 0, 0, 0.4),
                };
              }
              const added = viewer.entities.add(ent);
              if (major) labelEnts.push({ ent: added, n: c.n, nz: c.nz });
            });
            cityLabelEntsRef.current = labelEnts;
          })
          .catch(() => {});

        rebuildMarkers();

        // 点选事件
        handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
        handler.setInputAction((m: any) => {
          const picked = scene.pick(m.position);
          if (picked && picked.id && picked.id._hgEventId) {
            const ev = eventsRef.current.find((x) => x.id === picked.id._hgEventId);
            if (ev) onSelectRef.current?.(ev);
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        applyView(viewRef.current);
        // viewer 就绪后补应用一次 focus：分享链接带相机参数时，focus 往往在
        // Viewer 构造完成之前就已传入，原 focus effect 会因 viewerRef 为空而跳过。
        if (focusRef.current) flyToFocus(focusRef.current);
        // 相机移动结束后上报两件事（moveEnd 天然节流）：
        //  ① 相机自身位姿 → 分享链接；② 视线与椭球的交点 → 「此刻此地」的拍摄地点。
        // 低空斜视时相机在目标上前方，用相机自身经纬度会拍到别处，故必须单独算视线中心。
        try {
          const reportView = () => {
            const C = window.Cesium;
            if (!C || !viewer || viewer.isDestroyed?.()) return;
            try {
              const carto = C.Cartographic.fromCartesian(viewer.camera.positionWC);
              if (!carto) return;
              onCameraChangeRef.current?.({
                lat: C.Math.toDegrees(carto.latitude),
                lon: C.Math.toDegrees(carto.longitude),
                alt: carto.height,
                heading: C.Math.toDegrees(viewer.camera.heading || 0),
                pitch: C.Math.toDegrees(viewer.camera.pitch || 0),
              });
              const canvas = viewer.scene.canvas;
              const cw = Math.max(1, canvas?.clientWidth || 1);
              const ch = Math.max(1, canvas?.clientHeight || 1);
              const hit = viewer.camera.pickEllipsoid(new C.Cartesian2(cw / 2, ch / 2));
              if (hit) {
                const g = C.Cartographic.fromCartesian(hit);
                if (g) {
                  onViewCenterRef.current?.({
                    lat: C.Math.toDegrees(g.latitude),
                    lon: C.Math.toDegrees(g.longitude),
                    alt: carto.height,
                  });
                }
              }
            } catch {}
          };
          moveEndHandler = reportView;
          viewer.camera.moveEnd.addEventListener(moveEndHandler);
          // 初始位置也上报一次：用户尚未操作相机时「此刻此地」也能拿到中心
          requestAnimationFrame(reportView);
        } catch {}
        // 真实 3D 城市街区（OpenFreeMap/OSM，免费商用流式瓦片，近景自动浮现）
        try {
          buildingsCtlRef.current = createOsmBuildings(Cesium, viewer, (s) =>
            cityStatusRef.current?.(s)
          );
          if (!buildingsRef.current) buildingsCtlRef.current.setEnabled(false);
        } catch {
          /* 街区为增强层，失败静默降级 */
        }
        // 加固：首帧后强制同步一次尺寸
        requestAnimationFrame(() => viewer && viewer.resize());
      } catch {
        const msg = document.createElement("div");
        msg.style.cssText =
          "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#8da2c4;font-size:13px;text-align:center;padding:20px;";
        msg.textContent = "3D globe requires WebGL. The event list on the side still works.";
        mountRef.current.appendChild(msg);
      }
    });
    return () => {
      disposed = true;
      try {
        buildingsCtlRef.current?.destroy();
        buildingsCtlRef.current = null;
        if (handler) handler.destroy();
        if (moveEndHandler && viewer?.camera?.moveEnd?.removeEventListener) {
          try { viewer.camera.moveEnd.removeEventListener(moveEndHandler); } catch {}
        }
        if (viewer) viewer.destroy();
      } catch {}
      viewerRef.current = null;
      cityLabelEntsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 历史边界时间轴：viewer 就绪后按 boundaryUrl 加载国界；切换年份时只替换
  // dataSource。用自增序号丢弃过时结果，避免快速滑动年份时旧图层后到覆盖新图层。
  useEffect(() => {
    if (!viewerReady) return;
    const viewer = viewerRef.current;
    const Cesium = window.Cesium;
    if (!viewer || !Cesium || viewer.isDestroyed?.()) return;
    const url = boundaryUrl ?? "/countries.geojson";
    const req = ++boundaryReqRef.current;
    Cesium.GeoJsonDataSource.load(url)
      .then((ds: any) => {
        if (req !== boundaryReqRef.current || viewer.isDestroyed?.()) return;
        ds.entities.values.forEach((e: any) => {
          if (e.polygon) {
            e.polygon.fill = false;
            e.polygon.outline = true;
            e.polygon.outlineColor = Cesium.Color.fromCssColorString("#7fd4ff").withAlpha(0.55);
          }
          // 历史政体多为面要素，线要素也要能显示边界
          if (e.polyline) {
            e.polyline.material = Cesium.Color.fromCssColorString("#7fd4ff").withAlpha(0.55);
          }
        });
        const prev = countryDsRef.current;
        if (prev && viewer.dataSources.contains(prev)) {
          viewer.dataSources.remove(prev, true);
        }
        countryDsRef.current = ds;
        if (viewRef.current === "countries" && !viewer.dataSources.contains(ds)) {
          viewer.dataSources.add(ds);
        }
      })
      .catch(() => {
        /* 边界是增强层；单个年份加载失败时保留上一个图层，不抛错 */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundaryUrl, viewerReady]);

  // view switching
  useEffect(() => {
    applyView(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // rebuild event / heritage markers
  useEffect(() => {
    rebuildMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, heritage]);

  // 语言切换：实时更新已建城市 label 文本（中英）
  useEffect(() => {
    const Cesium = window.Cesium;
    if (!Cesium) return;
    for (const { ent, n, nz } of cityLabelEntsRef.current) {
      try {
        const text = lang === "zh" ? nz || n : n;
        if (ent?.label) ent.label.text = text;
      } catch {}
    }
  }, [lang]);

  // 3D 建筑开关
  useEffect(() => {
    buildingsCtlRef.current?.setEnabled(buildings);
  }, [buildings]);

  // fly-to on focus（低空斜视逻辑集中在 flyToFocus，初始化与后续切换共用）
  useEffect(() => {
    if (focus) flyToFocus(focus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  return (
    <div
      ref={mountRef}
      style={{ width: "100%", height: "100%", minHeight: 300, position: "relative" }}
    />
  );
}
