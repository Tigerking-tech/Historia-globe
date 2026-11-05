"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

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

type Props = {
  events?: GlobeEvent[];
  heritage?: GlobeHeritage[];
  onSelect?: (e: GlobeEvent) => void;
  className?: string;
  height?: number;
  enableDrag?: boolean;
  /** Surface style of the globe. */
  view?: GlobeView;
  /** When set, the globe smoothly rotates so this lat/lon faces the camera. */
  focus?: { lat: number; lon: number } | null;
  /** UI language — drives country-name label text (en / zh). */
  lang?: "en" | "zh";
};

const R = 100;
type GlobeView = "satellite" | "countries" | "night";
const VIEW_TEX: Record<GlobeView, string> = {
  satellite: "/earth-blue-marble.jpg",
  countries: "/earth-day.jpg",
  night: "/earth-night.jpg",
};
const BUMP_URL = "/earth-topology.png";

function latLngToVec3(lat: number, lon: number, radius: number) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Build a crisp text sprite (canvas texture) for a country name.
function makeLabelSprite(text: string, isZh: boolean): THREE.Sprite {
  const fontSize = isZh ? 46 : 52;
  const font = `${isZh ? "bold " : "600 "}${fontSize}px "PingFang SC","Microsoft YaHei",system-ui,Arial,sans-serif`;
  // measure first on a throwaway context
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const metrics = measure.measureText(text);
  const padX = 14;
  const padY = 12;
  const w = Math.ceil(metrics.width) + padX * 2;
  const h = fontSize + padY * 2;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  // dark outline for contrast over any terrain / night lights
  ctx.lineWidth = 7;
  ctx.strokeStyle = "rgba(3,9,20,0.92)";
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  const scaleY = 6.5;
  const scaleX = scaleY * (w / h);
  sprite.scale.set(scaleX, scaleY, 1);
  return sprite;
}

export default function Globe({
  events = [],
  heritage = [],
  onSelect,
  className,
  height = 460,
  enableDrag = true,
  view = "satellite",
  focus = null,
  lang = "en",
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const langRef = useRef(lang);
  langRef.current = lang;

  // persistent scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const globeRef = useRef<THREE.Group | null>(null);
  const baseMatRef = useRef<THREE.MeshPhongMaterial | null>(null);
  const bordersGroupRef = useRef<THREE.Group | null>(null);
  const currentViewRef = useRef<GlobeView>("satellite");
  const markerGroupRef = useRef<THREE.Group | null>(null);
  const heritageGroupRef = useRef<THREE.Group | null>(null);
  const labelsGroupRef = useRef<THREE.Group | null>(null);
  const labelsRef = useRef<THREE.Sprite[]>([]);
  const featuresRef = useRef<any[] | null>(null);
  // city labels are rendered as a lightweight HTML overlay (no GPU textures)
  const cityOverlayRef = useRef<HTMLDivElement | null>(null);
  const cityPoolRef = useRef<HTMLDivElement[]>([]);
  const cityDataRef = useRef<{ n: string; nz?: string; la: number; lo: number; p: number; lx: number; ly: number; lz: number }[] | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const markersRef = useRef<THREE.Object3D[]>([]);
  const rotRef = useRef({
    y: 0,
    x: 0,
    tilt: 0.46,
    targetTilt: 0.46,
    targetZ: 280,
    z: 280,
    auto: true,
    dragging: false,
    px: 0,
    py: 0,
    moved: 0,
    vx: 0,
    vy: 0,
    lastMoveT: 0,
    pointers: new Map<number, { x: number; y: number }>(),
    pinching: false,
    pinchStartDist: 0,
    pinchStartZ: 0,
    focusTarget: null as null | { x: number; y: number },
    focusing: false,
  });
  const eventsRef = useRef<GlobeEvent[]>([]);

  // ---- per-frame city-label overlay update (HTML, not textures) ----
  const updateCityLabels = () => {
    const cam = cameraRef.current;
    const overlay = cityOverlayRef.current;
    const pool = cityPoolRef.current;
    const data = cityDataRef.current;
    const globe = globeRef.current;
    if (!cam || !overlay || !pool.length || !data || !globe) return;
    if (currentViewRef.current === "night") {
      for (const d of pool) d.style.display = "none";
      return;
    }
    // level-of-detail: only surface cities once the user zooms in
    const z = cam.position.z;
    let popMin = Infinity;
    if (z >= 240) popMin = Infinity;
    else if (z >= 190) popMin = 1e6;
    else if (z >= 150) popMin = 3e5;
    else if (z >= 120) popMin = 1e5;
    else popMin = 5e4;
    if (popMin === Infinity) {
      for (const d of pool) d.style.display = "none";
      return;
    }
    const w = rendererRef.current?.domElement.clientWidth || 1;
    const h = rendererRef.current?.domElement.clientHeight || 1;
    const v = new THREE.Vector3();
    const m = globe.matrixWorld;
    const camPos = cam.position;
    const camR2 = R * R;
    const cands: { x: number; y: number; pop: number; name: string }[] = [];
    for (const c of data) {
      if (c.p < popMin) continue;
      v.set(c.lx, c.ly, c.lz).applyMatrix4(m);
      // hide points on the hemisphere facing away from the (tilted) camera
      if (v.x * camPos.x + v.y * camPos.y + v.z * camPos.z <= camR2) continue;
      v.project(cam);
      if (v.z > 1 || v.z < -1) continue; // clipped / behind camera
      cands.push({
        x: (v.x * 0.5 + 0.5) * w,
        y: (-v.y * 0.5 + 0.5) * h,
        pop: c.p,
        // 中文模式优先显示中文译名，未收录的小城 fallback 英文原名
        name: langRef.current === "zh" ? c.nz || c.n : c.n,
      });
    }
    // bigger cities win; de-overlap so labels never stack on top of each other
    cands.sort((a, b) => b.pop - a.pop);
    const accepted: { x: number; y: number; name: string }[] = [];
    const gap = 24;
    for (const cnd of cands) {
      let ok = true;
      for (const a of accepted) {
        if (Math.abs(a.x - cnd.x) < gap && Math.abs(a.y - cnd.y) < gap) {
          ok = false;
          break;
        }
      }
      if (ok) {
        accepted.push(cnd);
        if (accepted.length >= pool.length) break;
      }
    }
    for (let i = 0; i < pool.length; i++) {
      const d = pool[i];
      if (i < accepted.length) {
        const a = accepted[i];
        d.textContent = a.name;
        d.style.left = a.x + "px";
        d.style.top = a.y + "px";
        d.style.display = "block";
      } else {
        d.style.display = "none";
      }
    }
  };

  // ---- one-time scene setup ----
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let raf = 0;
    let disposed = false;

    try {
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, 1, 2000);
      // oblique default view (like Google Earth) — camera sits above the equator plane
      camera.position.set(0, 280 * Math.sin(0.46), 280 * Math.cos(0.46));
      camera.lookAt(0, 0, 0);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      mount.appendChild(renderer.domElement);
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      // Critical for mobile: stop the browser from hijacking touch drags
      // as page scroll / pinch-zoom, which otherwise swallows pointermove.
      renderer.domElement.style.touchAction = "none";
      renderer.domElement.style.cursor = "grab";

      // ---- city-label HTML overlay: a small pool of divs reused every frame ----
      // (avoids creating thousands of GPU textures for city names)
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
      mount.appendChild(overlay);
      cityOverlayRef.current = overlay;
      const pool: HTMLDivElement[] = [];
      for (let i = 0; i < 200; i++) {
        const d = document.createElement("div");
        d.style.cssText =
          "position:absolute;transform:translate(-50%,-50%);white-space:nowrap;font-size:11px;font-weight:600;letter-spacing:0.2px;color:rgba(255,255,255,0.94);text-shadow:0 1px 3px rgba(0,0,0,0.95);will-change:left,top;display:none;";
        overlay.appendChild(d);
        pool.push(d);
      }
      cityPoolRef.current = pool;

      const globe = new THREE.Group();
      scene.add(globe);

      // ---- Real Earth base (texture with graceful fallback) ----
      const baseMat = new THREE.MeshPhongMaterial({
        color: 0x0b1f3a,
        emissive: 0x0a1830,
        emissiveIntensity: 0.35,
        shininess: 8,
      });
      baseMatRef.current = baseMat;
      const base = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 64), baseMat);
      globe.add(base);

      // terrain bump (all views) — adds relief to the real-earth feel
      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin("anonymous");
      loader.load(
        BUMP_URL,
        (bump) => {
          baseMat.bumpMap = bump;
          baseMat.bumpScale = 1.4;
          baseMat.needsUpdate = true;
        },
        undefined,
        () => {
          /* bump is optional eye-candy */
        }
      );

      // ---- subtle graticule (lat/long) for the data aesthetic ----
      const gridMat = new THREE.LineBasicMaterial({
        color: 0x6fa8dc,
        transparent: true,
        opacity: 0.12,
      });
      for (let lat = -60; lat <= 60; lat += 30) {
        const pts: THREE.Vector3[] = [];
        for (let lon = 0; lon <= 360; lon += 6) pts.push(latLngToVec3(lat, lon, R * 1.002));
        globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
      }
      for (let lon = 0; lon < 360; lon += 30) {
        const pts: THREE.Vector3[] = [];
        for (let lat = -90; lat <= 90; lat += 6) pts.push(latLngToVec3(lat, lon, R * 1.002));
        globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
      }

      // atmosphere glow — Fresnel rim (Google-Earth-style blue limb)
      const atmoMat = new THREE.ShaderMaterial({
        uniforms: {
          glowColor: { value: new THREE.Color(0x4ea3ff) },
          coeff: { value: 0.38 },
          power: { value: 3.4 },
        },
        vertexShader: `
          varying vec3 vN; varying vec3 vP;
          void main() {
            vN = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vP = mv.xyz;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          varying vec3 vN; varying vec3 vP;
          uniform vec3 glowColor; uniform float coeff; uniform float power;
          void main() {
            vec3 viewDir = normalize(-vP);
            float intensity = pow(max(coeff - dot(vN, viewDir), 0.0), power);
            intensity = clamp(intensity, 0.0, 1.0);
            gl_FragColor = vec4(glowColor, intensity * 0.95);
          }`,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
      const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.18, 64, 64), atmoMat);
      globe.add(atmo);

      scene.add(new THREE.AmbientLight(0xffffff, 0.85));
      const dir = new THREE.DirectionalLight(0xffffff, 0.9);
      dir.position.set(1, 0.5, 1.2);
      scene.add(dir);
      const rim = new THREE.DirectionalLight(0x88bbff, 0.35);
      rim.position.set(-1, -0.3, -0.8);
      scene.add(rim);

      const markerGroup = new THREE.Group();
      globe.add(markerGroup);
      const heritageGroup = new THREE.Group();
      globe.add(heritageGroup);

      // group for country-name labels (text sprites), shown in satellite/countries views
      const labelsGroup = new THREE.Group();
      labelsGroup.visible = false;
      globe.add(labelsGroup);
      labelsGroupRef.current = labelsGroup;

      sceneRef.current = scene;
      cameraRef.current = camera;
      rendererRef.current = renderer;
      globeRef.current = globe;
      markerGroupRef.current = markerGroup;
      heritageGroupRef.current = heritageGroup;

      const resize = () => {
        const w = mount.clientWidth || 400;
        const h = mount.clientHeight || height;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(mount);

      const animate = () => {
        if (disposed) return;
        raf = requestAnimationFrame(animate);
        const r = rotRef.current;
        // smooth focus-to-location animation (heading only; pitch handled by camera tilt)
        if (r.focusing && r.focusTarget) {
          let dy = r.focusTarget.y - r.y;
          dy -= 2 * Math.PI * Math.round(dy / (2 * Math.PI)); // shortest path
          r.y += dy * 0.09;
          r.x += (0 - r.x) * 0.09;
          if (Math.abs(dy) < 0.002 && Math.abs(r.x) < 0.002) {
            r.y = r.focusTarget.y;
            r.x = 0;
            r.focusing = false;
          }
        } else if (r.dragging) {
          // rotation/tilt applied 1:1 in pointermove for direct tracking
        } else {
          // inertial spin after release -> silky flick on mobile
          if (Math.abs(r.vx) > 1e-4) {
            r.y += r.vx;
            r.vx *= 0.94;
            if (Math.abs(r.vx) < 1e-4) r.vx = 0;
          } else if (r.auto) {
            r.y += 0.0016;
          }
          r.x += (0 - r.x) * 0.08; // settle to equator-facing
        }
        globe.rotation.y = r.y;
        globe.rotation.x = r.x;

        // --- camera: smooth zoom + oblique tilt for a Google-Earth-like feel ---
        r.z += (r.targetZ - r.z) * 0.15;
        r.tilt += (r.targetTilt - r.tilt) * 0.12;
        camera.position.set(0, r.z * Math.sin(r.tilt), r.z * Math.cos(r.tilt));
        camera.lookAt(0, 0, 0);
        // hide country-name labels that are on the far side of the globe
        if (labelsRef.current.length) {
          globe.updateMatrixWorld();
          const lv = new THREE.Vector3();
          const cp = camera.position;
          labelsRef.current.forEach((s) => {
            s.getWorldPosition(lv);
            s.visible = lv.x * cp.x + lv.y * cp.y + lv.z * cp.z > R * R;
          });
        }
        // pulse event markers
        const t = performance.now() * 0.003;
        markersRef.current.forEach((m, i) => {
          const halo = (m as any).userData?.halo as THREE.Mesh | undefined;
          if (halo) {
            const s = 1 + 0.25 * Math.sin(t + i);
            halo.scale.set(s, s, s);
          }
        });
        globe.updateMatrixWorld();
        // 世界遗产点云按缩放分级：相机拉远到全球视角时，几百个金点会糊成一片
        // 噪点盖住底图。与城市标签共用同一套阈值（z>=240 隐藏），放大后才浮现。
        const hgGroup = heritageGroupRef.current;
        if (hgGroup) {
          hgGroup.visible = currentViewRef.current !== "night" && camera.position.z < 200;
        }
        updateCityLabels();
        renderer.render(scene, camera);
      };
      animate();

      // cleanup
      return () => {
        disposed = true;
        cancelAnimationFrame(raf);
        ro.disconnect();
        renderer.dispose();
        if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
        if (overlay.parentNode === mount) mount.removeChild(overlay);
      };
    } catch (e) {
      const msg = document.createElement("div");
      msg.style.cssText =
        "position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#8da2c4;font-size:13px;text-align:center;padding:20px;";
      msg.textContent = "3D globe requires WebGL. The event list on the side still works.";
      mount.appendChild(msg);
      return;
    }
  }, [height]);

  // ---- country borders layer (visible only in the "countries" view) ----
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const grp = new THREE.Group();
    grp.visible = false;
    globe.add(grp);
    bordersGroupRef.current = grp;
    let cancelled = false;
    fetch("/countries.geojson")
      .then((r) => (r.ok ? r.json() : null))
      .then((gj: any) => {
        if (!gj || cancelled) return;
        const mat = new THREE.LineBasicMaterial({ color: 0x9bd1ff, transparent: true, opacity: 0.55 });
        (gj.features || []).forEach((f: any) => {
          const geom = f.geometry;
          if (!geom) return;
          const polygons: number[][][][] =
            geom.type === "Polygon"
              ? [geom.coordinates]
              : geom.type === "MultiPolygon"
                ? geom.coordinates
                : [];
          polygons.forEach((rings) => {
            rings.forEach((ring) => {
              if (!ring || ring.length < 2) return;
              const pts = ring.map((p: number[]) => latLngToVec3(p[1], p[0], R * 1.004));
              grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
            });
          });
        });
        grp.visible = currentViewRef.current === "countries";
        // stash features so the label layer can reuse them without a 2nd fetch
        featuresRef.current = gj.features || [];
        buildLabels();
      })
      .catch(() => {
        /* borders are an enhancement; ignore on failure */
      });
    return () => {
      cancelled = true;
      globe.remove(grp);
    };
  }, []);

  // build (or rebuild) the country-name labels from cached Natural Earth features
  const buildLabels = () => {
    const grp = labelsGroupRef.current;
    if (!grp) return;
    // clear previous sprites + free GPU textures
    while (grp.children.length) {
      const c = grp.children[0] as THREE.Sprite;
      const m = c.material as THREE.SpriteMaterial;
      m.map?.dispose();
      m.dispose();
      grp.remove(c);
    }
    labelsRef.current = [];
    const feats = featuresRef.current;
    if (!feats) return;
    const useZh = langRef.current === "zh";
    const seen = new Set<string>();
    feats.forEach((f: any) => {
      const p = f.properties || {};
      const rank = p.LABELRANK;
      if (rank == null || rank > 2) return; // only the most prominent nations — keep the globe uncluttered
      const x = p.LABEL_X;
      const y = p.LABEL_Y;
      if (x == null || y == null) return;
      const text = (useZh ? p.NAME_ZH || p.NAME_EN : p.NAME_EN || p.NAME_ZH) || "";
      if (!text || seen.has(text)) return;
      seen.add(text);
      const sprite = makeLabelSprite(text, useZh);
      sprite.position.copy(latLngToVec3(y, x, R * 1.02));
      grp.add(sprite);
      labelsRef.current.push(sprite);
    });
    grp.visible = currentViewRef.current !== "night";
  };

  // rebuild labels when the UI language flips
  useEffect(() => {
    if (featuresRef.current) buildLabels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  // ---- load city data once and precompute each city's local 3D position ----
  useEffect(() => {
    let cancelled = false;
    fetch("/cities.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((arr: any[]) => {
        if (!arr || cancelled) return;
        cityDataRef.current = arr.map((c) => {
          const v = latLngToVec3(c.la, c.lo, R * 1.02);
          return { n: c.n, nz: c.nz, la: c.la, lo: c.lo, p: c.p, lx: v.x, ly: v.y, lz: v.z };
        });
      })
      .catch(() => {
        /* city labels are an enhancement; ignore on failure */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- switch globe surface view (satellite / countries / night) ----
  useEffect(() => {
    currentViewRef.current = view;
    const mat = baseMatRef.current;
    const grp = bordersGroupRef.current;
    if (grp) grp.visible = view === "countries";
    const lg = labelsGroupRef.current;
    if (lg) lg.visible = view !== "night";
    if (!mat) return;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
    loader.load(
      VIEW_TEX[view],
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = rendererRef.current?.capabilities.getMaxAnisotropy() || 1;
        mat.map = tex;
        mat.emissiveMap = tex;
        mat.color = new THREE.Color(0xffffff);
        mat.emissive = new THREE.Color(0xffffff);
        mat.emissiveIntensity = view === "night" ? 0.9 : view === "countries" ? 0.14 : 0.22;
        mat.needsUpdate = true;
      },
      undefined,
      () => {
        /* keep current/fallback surface if a view texture fails */
      }
    );
  }, [view]);

  // ---- focus to a lat/lon (e.g. when an event is selected) ----
  useEffect(() => {
    const r = rotRef.current;
    if (!focus) {
      // new date / no selection -> gently resume auto-spin and pull back out
      r.focusing = false;
      r.auto = true;
      r.targetZ = 280;
      r.targetTilt = 0.46;
      return;
    }
    const phi = (90 - focus.lat) * (Math.PI / 180);
    const theta = (focus.lon + 180) * (Math.PI / 180);
    const dx = -Math.sin(phi) * Math.cos(theta);
    const dz = Math.sin(phi) * Math.sin(theta);
    r.focusTarget = { x: 0, y: Math.atan2(-dx, dz) };
    r.focusing = true;
    r.auto = false;
    // Google-Earth-like "fly to": swing the globe to face us AND zoom in to reveal cities
    r.targetZ = 150;
    r.targetTilt = 0.34;
  }, [focus]);

  // ---- rebuild event + heritage markers when data changes ----
  useEffect(() => {
    const mg = markerGroupRef.current;
    const hg = heritageGroupRef.current;
    if (!mg || !hg) return;
    // clear
    while (mg.children.length) mg.remove(mg.children[0]);
    while (hg.children.length) hg.remove(hg.children[0]);
    markersRef.current = [];

    const colorOf = (cat: string) => new THREE.Color(CAT_COLOR[cat] || "#60a5fa");

    eventsRef.current = events;
    events.forEach((ev) => {
      const g = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(2.7, 16, 16),
        new THREE.MeshBasicMaterial({ color: colorOf(ev.category) })
      );
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(5.4, 16, 16),
        new THREE.MeshBasicMaterial({ color: colorOf(ev.category), transparent: true, opacity: 0.28 })
      );
      g.add(core);
      g.add(halo);
      g.position.copy(latLngToVec3(ev.lat, ev.lon, R * 1.02));
      (g as any).userData = { ev, halo };
      mg.add(g);
      markersRef.current.push(g);
    });

    // heritage as a single efficient points cloud (gold)
    if (heritage.length) {
      const pos: number[] = [];
      heritage.forEach((h) => {
        const v = latLngToVec3(h.lat, h.lon, R * 1.014);
        pos.push(v.x, v.y, v.z);
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      hg.add(
        new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xfbbf24, size: 1.3, transparent: true, opacity: 0.62 }))
      );
    }
  }, [events, heritage]);

  // ---- interaction ----
  useEffect(() => {
    const mount = mountRef.current;
    const renderer = rendererRef.current;
    if (!mount || !renderer) return;

    const camera = cameraRef.current!;
    const globe = globeRef.current!;
    const ray = raycasterRef.current;

    const pick = (clientX: number, clientY: number): THREE.Object3D | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(pointerRef.current, camera);
      const hits = ray.intersectObjects(markersRef.current, true);
      if (!hits.length) return null;
      let o: THREE.Object3D | null = hits[0].object;
      while (o && !(o as any).userData?.ev) o = o.parent;
      return o;
    };

    const DRAG_SENS = 0.0065; // radians per CSS pixel — snappy on both mouse & touch

    const onDown = (e: PointerEvent) => {
      const r = rotRef.current;
      r.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        /* not all browsers support capture on canvas */
      }
      if (r.pointers.size === 2) {
        // second finger -> pinch-zoom mode, suspend rotation
        const vals = Array.from(r.pointers.values());
        const p1 = vals[0];
        const p2 = vals[1];
        r.pinchStartDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        r.pinchStartZ = r.z; // current camera distance (not position.z, which is now tilted)
        r.pinching = true;
        r.dragging = false;
      } else {
        // single finger -> rotate the globe
        r.dragging = true;
        r.auto = false;
        r.focusing = false;
        r.px = e.clientX;
        r.py = e.clientY;
        r.moved = 0;
        r.vx = 0;
        r.vy = 0;
        r.lastMoveT = performance.now();
        renderer.domElement.style.cursor = "grabbing";
      }
    };
    const onUp = (e: PointerEvent) => {
      const r = rotRef.current;
      r.pointers.delete(e.pointerId);
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (r.pinching) {
        if (r.pointers.size < 2) {
          r.pinching = false;
          if (r.pointers.size === 1) {
            // one finger remains -> hand control back to rotation smoothly
            const p = Array.from(r.pointers.values())[0];
            r.dragging = true;
            r.px = p.x;
            r.py = p.y;
            r.moved = 0;
            r.vx = 0;
            r.vy = 0;
            r.lastMoveT = performance.now();
            r.auto = false;
          } else {
            r.dragging = false;
          }
        }
        if (r.pinching) return; // still pinching, skip tap / drag-stop
      }
      // if the finger lingered before lifting, don't fling the globe
      if (performance.now() - r.lastMoveT > 60) {
        r.vx = 0;
        r.vy = 0;
      }
      if (r.dragging && r.moved < 8) {
        const hit = pick(e.clientX, e.clientY);
        if (hit) {
          const ev = (hit as any).userData.ev as GlobeEvent;
          onSelectRef.current?.(ev);
        }
      }
      if (!r.pinching) {
        r.dragging = false;
        renderer.domElement.style.cursor = "grab";
      }
    };
    const onCancel = (e: PointerEvent) => {
      // system gesture (edge swipe, notification) interrupted the gesture
      const r = rotRef.current;
      r.pointers.delete(e.pointerId);
      r.pinching = false;
      r.dragging = false;
      r.vx = 0;
      r.vy = 0;
      renderer.domElement.style.cursor = "grab";
    };
    const onMove = (e: PointerEvent) => {
      const r = rotRef.current;
      if (r.pointers.has(e.pointerId)) {
        r.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      if (r.pinching && r.pointers.size >= 2) {
        const vals = Array.from(r.pointers.values());
        const p1 = vals[0];
        const p2 = vals[1];
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (r.pinchStartDist > 0) {
          // spread fingers apart (dist grows) -> camera closer -> zoom in
          const z = r.pinchStartZ * (r.pinchStartDist / dist);
          r.targetZ = Math.max(120, Math.min(480, z));
        }
        return; // don't rotate while pinching
      }
      if (r.dragging) {
        const dx = e.clientX - r.px;
        const dy = e.clientY - r.py;
        r.moved += Math.abs(dx) + Math.abs(dy);
        r.y += dx * DRAG_SENS;
        // vertical drag tilts the camera (Google-Earth pitch) instead of flipping the globe
        r.targetTilt = Math.max(0.04, Math.min(1.15, r.targetTilt + dy * 0.0035));
        // remember velocity for post-release horizontal inertia
        r.vx = dx * DRAG_SENS;
        r.lastMoveT = performance.now();
        r.px = e.clientX;
        r.py = e.clientY;
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = rotRef.current;
      r.targetZ = Math.max(120, Math.min(480, r.targetZ + e.deltaY * 0.18));
    };

    if (enableDrag) {
      renderer.domElement.addEventListener("pointerdown", onDown);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("pointermove", onMove);
      renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    }
    return () => {
      renderer.domElement.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("wheel", onWheel);
    };
  }, [enableDrag]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ width: "100%", height: "100%", minHeight: height, position: "relative" }}
    />
  );
}

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
