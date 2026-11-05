// 某一天的镜头巡游：把当天有坐标的历史事件按年份排成一组镜头，
// 供 ExploreClient 依次飞行。镜头格式参照 GEV 的 SCENE-DOCUMENT（shot：
// durationSec / holdSec / camera / visual），但去掉样式与图层，保持轻量。

import type { GlobeFocus } from "@/components/globe/CesiumGlobe";

export type TourShot = {
  id: string;
  eventId: string | null;
  title: string;
  year: number | null;
  place: string;
  /** 飞行时长（秒） */
  durationSec: number;
  /** 停留时长（秒） */
  holdSec: number;
  camera: GlobeFocus;
};

type PlacedEvent = {
  id: string;
  year: number;
  title: string;
  place?: string;
  lat: number;
  lon: number;
};

const MAX_SHOTS = 8;

export function buildDayTour(events: PlacedEvent[]): TourShot[] {
  const placed = events
    .filter((e) => Number.isFinite(e.lat) && Number.isFinite(e.lon))
    .slice()
    .sort((a, b) => a.year - b.year)
    .slice(0, MAX_SHOTS);
  if (!placed.length) return [];

  // 开场：先拉到全球，给观众一个"这一天的世界"的整体感
  const shots: TourShot[] = [
    {
      id: "intro",
      eventId: null,
      title: "",
      year: null,
      place: "",
      durationSec: 2.6,
      holdSec: 1.6,
      camera: { lat: 15, lon: 0, altitude: 28_000_000, pitch: -90 },
    },
  ];

  for (const e of placed) {
    shots.push({
      id: `shot-${e.id}`,
      eventId: e.id,
      title: e.title,
      year: e.year,
      place: e.place || "",
      durationSec: 2.4,
      holdSec: 2.4,
      // 区域斜视：能看清地形与事件点，又不至于低到只剩一块地面
      camera: { lat: e.lat, lon: e.lon, altitude: 1_200_000, pitch: -55, heading: 0 },
    });
  }
  return shots;
}
