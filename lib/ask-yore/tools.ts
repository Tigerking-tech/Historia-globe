// 工具白名单与目录组装（server-only：仅由 app/api/ask-yore/route.ts 引入）。
// 核心原则（对齐 GEV docs/TOOLS.md）：
//   1. 工具定义一次，通过 adapters 暴露给 chat / voice / MCP 三个 surface；
//   2. 模型只做意图路由，飞到事件/切日期/切视图等 UI 动作返回确定性指令，
//      由前端执行成功后才回传确认 —— 模型不得自己声称"已经完成"；
//   3. 拦截器（interceptor）统一承载花费闸、审计与参数收敛；
//   4. 所有 query 工具只读，且只返回可追溯的事件 id。

import type {
  ArgSchema,
  Interceptor,
  SceneContext,
  Surface,
  ToolCall,
  ToolContext,
  ToolDefinition,
  ToolResult,
  ToolServices,
} from "./types";
import { ToolError } from "./types";
import { buildSceneContext } from "./context";

const monthDay = (scene: SceneContext, args: Record<string, any>) => ({
  m: clampInt(args.month ?? scene.month, 1, 12),
  d: clampInt(args.day ?? scene.day, 1, 31),
});

function clampInt(v: any, min: number, max: number) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) throw new ToolError("invalid_arguments", "expected a number");
  return Math.min(max, Math.max(min, n));
}

function brief(e: any) {
  return {
    id: e.id,
    year: e.year,
    title: e.title,
    place: e.place || "",
    category: e.category,
    lat: e.lat ?? null,
    lon: e.lon ?? null,
  };
}

function countryOf(place: string) {
  if (!place) return "";
  const parts = place.split(",").map((s) => s.trim());
  return parts[parts.length - 1] || "";
}

/** 校验参数：未知字段一律拒绝，避免模型塞入越权参数 */
export function validateArgs(schema: ArgSchema, args: Record<string, any>) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new ToolError("invalid_arguments", "arguments must be an object");
  }
  const keys = Object.keys(schema.properties);
  for (const k of Object.keys(args)) {
    if (!keys.includes(k)) {
      throw new ToolError("invalid_arguments", `unknown argument: ${k}`);
    }
  }
  for (const k of schema.required || []) {
    if (args[k] === undefined || args[k] === null || args[k] === "") {
      throw new ToolError("invalid_arguments", `missing required argument: ${k}`);
    }
  }
  for (const [k, v] of Object.entries(args)) {
    const spec = schema.properties[k];
    if (!spec) continue;
    const actual = Array.isArray(v) ? "array" : typeof v;
    if (actual !== spec.type) {
      throw new ToolError("invalid_arguments", `${k} must be ${spec.type}`);
    }
    if (spec.enum && !spec.enum.includes(String(v))) {
      throw new ToolError("invalid_arguments", `${k} must be one of ${spec.enum.join(",")}`);
    }
    if (spec.type === "number") {
      if (spec.minimum != null && v < spec.minimum) throw new ToolError("invalid_arguments", `${k} below minimum`);
      if (spec.maximum != null && v > spec.maximum) throw new ToolError("invalid_arguments", `${k} above maximum`);
    }
    if (spec.type === "string" && String(v).length > 200) {
      throw new ToolError("invalid_arguments", `${k} too long`);
    }
  }
}

function defineTool(def: ToolDefinition): ToolDefinition {
  if (!def.name || !/^[a-z_][a-z0-9_]*$/.test(def.name)) {
    throw new Error(`invalid tool name: ${def.name}`);
  }
  return Object.freeze(def);
}

const ALL: Surface[] = ["chat", "voice", "mcp"];

/** 只读查询工具 */
export const coreQueryTools: ToolDefinition[] = [
  defineTool({
    name: "get_day_events",
    kind: "query",
    title: "List events on a date",
    description: "Return the geolocated historical events recorded for a given month/day. Read-only.",
    surfaces: ALL,
    inputSchema: {
      type: "object",
      properties: {
        month: { type: "number", minimum: 1, maximum: 12 },
        day: { type: "number", minimum: 1, maximum: 31 },
        category: { type: "string" },
        limit: { type: "number", minimum: 1, maximum: 60 },
      },
      additionalProperties: false,
    },
    run: async (args, ctx) => {
      const { m, d } = monthDay(ctx.scene, args);
      const all = await ctx.services.getEvents(m, d);
      const filtered = args.category
        ? all.filter((e: any) => e.category === args.category)
        : all;
      const rows = filtered.slice(0, clampInt(args.limit ?? 20, 1, 60)).map(brief);
      return {
        summary: `${rows.length} event(s) on ${m}/${d}${args.category ? ` in category ${args.category}` : ""}.`,
        data: { month: m, day: d, total: filtered.length, events: rows },
        refs: rows.map((r: any) => r.id),
      };
    },
  }),
  defineTool({
    name: "get_event_detail",
    kind: "query",
    title: "Read one event",
    description: "Return the full record (year, description, place, source) for one event id.",
    surfaces: ALL,
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
    run: async (args, ctx) => {
      const { m, d } = monthDay(ctx.scene, {});
      const all = await ctx.services.getEvents(m, d);
      const e = all.find((x: any) => x.id === args.id);
      if (!e) throw new ToolError("unavailable", `event ${args.id} is not in the current day's record`);
      return {
        summary: `${e.year} — ${e.title} (${e.place || "unlocated"}).`,
        data: brief(e),
        refs: [e.id],
      };
    },
  }),
  defineTool({
    name: "search_events",
    kind: "query",
    title: "Search the day's events",
    description: "Case-insensitive keyword search over the current day's event titles, places and descriptions.",
    surfaces: ALL,
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 30 } },
      required: ["query"],
      additionalProperties: false,
    },
    run: async (args, ctx) => {
      const { m, d } = monthDay(ctx.scene, {});
      const q = String(args.query).toLowerCase();
      const all = await ctx.services.getEvents(m, d);
      const hits = all
        .filter((e: any) =>
          `${e.title} ${e.place || ""} ${e.description || ""} ${e.category}`.toLowerCase().includes(q)
        )
        .slice(0, clampInt(args.limit ?? 10, 1, 30));
      return {
        summary: `${hits.length} event(s) matched "${args.query}" on ${m}/${d}.`,
        data: { events: hits.map(brief) },
        refs: hits.map((h: any) => h.id),
      };
    },
  }),
  defineTool({
    name: "count_by_category",
    kind: "query",
    title: "Count events by category",
    description: "Aggregate the day's events by category. Useful for 'how many wars happened on this day'.",
    surfaces: ALL,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async (_args, ctx) => {
      const { m, d } = monthDay(ctx.scene, {});
      const all = await ctx.services.getEvents(m, d);
      const counts: Record<string, number> = {};
      for (const e of all) counts[e.category] = (counts[e.category] || 0) + 1;
      return {
        summary: `${all.length} event(s) across ${Object.keys(counts).length} categories on ${m}/${d}.`,
        data: { month: m, day: d, counts },
      };
    },
  }),
  defineTool({
    name: "get_nearby_heritage",
    kind: "query",
    title: "UNESCO heritage near an event",
    description: "List UNESCO World Heritage sites in the same country/region as an event or country name.",
    surfaces: ALL,
    inputSchema: {
      type: "object",
      properties: { eventId: { type: "string" }, country: { type: "string" }, limit: { type: "number", minimum: 1, maximum: 20 } },
      additionalProperties: false,
    },
    run: async (args, ctx) => {
      if (!args.eventId && !args.country) {
        throw new ToolError("invalid_arguments", "provide eventId or country");
      }
      let country = args.country ? String(args.country) : "";
      if (args.eventId) {
        const { m, d } = monthDay(ctx.scene, {});
        const all = await ctx.services.getEvents(m, d);
        const e = all.find((x: any) => x.id === args.eventId);
        if (!e) throw new ToolError("unavailable", "event not found");
        country = countryOf(e.place || "");
      }
      const sites = await ctx.services.getHeritage();
      const hits = sites
        .filter((h: any) => !country || h.country === country)
        .slice(0, clampInt(args.limit ?? 8, 1, 20))
        .map((h: any) => ({ id: h.id, name: h.name, country: h.country, year: h.year }));
      return {
        summary: `${hits.length} UNESCO site(s) found${country ? ` for ${country}` : ""}.`,
        data: { country, sites: hits },
      };
    },
  }),
  defineTool({
    name: "get_scene_state",
    kind: "query",
    title: "Read the current scene",
    description: "Return what the user is currently looking at: date, language, view, camera, selected event, tour state.",
    surfaces: ALL,
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: (_args, ctx) => ({
      summary: "Current scene snapshot returned.",
      data: { scene: ctx.scene, contextText: buildSceneContext(ctx.scene) },
    }),
  }),
];

/** 动作工具：只产出确定性指令，绝不直接改 UI */
export const coreActionTools: ToolDefinition[] = [
  defineTool({
    name: "fly_to_event",
    kind: "action",
    title: "Fly the globe to an event",
    description: "Queue a camera flight to an event's coordinates. The front-end confirms after it executes.",
    surfaces: ALL,
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" }, altitude: { type: "number", minimum: 250, maximum: 60000000 } },
      required: ["id"],
      additionalProperties: false,
    },
    run: async (args, ctx) => {
      const { m, d } = monthDay(ctx.scene, {});
      const all = await ctx.services.getEvents(m, d);
      const e = all.find((x: any) => x.id === args.id);
      if (!e || e.lat == null || e.lon == null) {
        throw new ToolError("unavailable", "event has no coordinates");
      }
      const altitude = clampInt(args.altitude ?? 1_600_000, 250, 60_000_000);
      return {
        summary: `Camera flight queued for [${e.id}] ${e.title}. Awaiting front-end confirmation.`,
        data: { id: e.id, lat: e.lat, lon: e.lon, altitude },
        actions: [
          { type: "select_event", id: e.id },
          { type: "fly_to", lat: e.lat, lon: e.lon, altitude, pitch: altitude < 100000 ? -45 : -90 },
        ],
        refs: [e.id],
      };
    },
  }),
  defineTool({
    name: "set_date",
    kind: "action",
    title: "Change the date",
    description: "Queue a change of the calendar day in focus.",
    surfaces: ALL,
    inputSchema: {
      type: "object",
      properties: { month: { type: "number", minimum: 1, maximum: 12 }, day: { type: "number", minimum: 1, maximum: 31 } },
      required: ["month", "day"],
      additionalProperties: false,
    },
    run: (args) => ({
      summary: `Date change queued to ${args.month}/${args.day}. Awaiting front-end confirmation.`,
      data: { month: args.month, day: args.day },
      actions: [{ type: "set_date", month: args.month, day: args.day }],
    }),
  }),
  defineTool({
    name: "set_view",
    kind: "action",
    title: "Switch globe view",
    description: "Queue a switch between satellite, countries and night views.",
    surfaces: ALL,
    inputSchema: {
      type: "object",
      properties: { view: { type: "string", enum: ["satellite", "countries", "night"] } },
      required: ["view"],
      additionalProperties: false,
    },
    run: (args) => ({
      summary: `View change queued to ${args.view}. Awaiting front-end confirmation.`,
      data: { view: args.view },
      actions: [{ type: "set_view", view: args.view }],
    }),
  }),
  defineTool({
    name: "set_language",
    kind: "action",
    title: "Switch UI language",
    description: "Queue a switch between English and Simplified Chinese.",
    surfaces: ALL,
    inputSchema: {
      type: "object",
      properties: { lang: { type: "string", enum: ["en", "zh"] } },
      required: ["lang"],
      additionalProperties: false,
    },
    run: (args) => ({
      summary: `Language change queued to ${args.lang}. Awaiting front-end confirmation.`,
      data: { lang: args.lang },
      actions: [{ type: "set_lang", lang: args.lang }],
    }),
  }),
  defineTool({
    name: "start_day_tour",
    kind: "action",
    title: "Play the day's camera tour",
    description: "Queue a cinematic tour that flies through the day's geolocated events in order.",
    surfaces: ["chat", "voice"], // MCP 客户端没有地球画面，不提供
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: () => ({
      summary: "Day tour queued. Awaiting front-end confirmation.",
      data: {},
      actions: [{ type: "start_tour" }],
    }),
  }),
  defineTool({
    name: "share_view",
    kind: "action",
    title: "Copy a shareable link",
    description: "Queue creation of a URL that restores this date, view, camera and selected event.",
    surfaces: ["chat", "voice"],
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: () => ({
      summary: "Share link queued. Awaiting front-end confirmation.",
      data: {},
      actions: [{ type: "share_view" }],
    }),
  }),
];

export const coreTools: ToolDefinition[] = [...coreQueryTools, ...coreActionTools];

export type Catalog = {
  list: () => ToolDefinition[];
  run: (name: string, args: Record<string, any>, scene: SceneContext) => Promise<ToolResult>;
  functionTools: () => Array<{ type: "function"; name: string; description: string; parameters: ArgSchema }>;
  mcpTools: () => Array<{ name: string; description: string; inputSchema: ArgSchema }>;
};

/** 组装目录：按 surface 过滤 + 名称唯一 + 拦截器链（数组第一个为最外层） */
export function composeCatalog(opts: {
  tools?: ToolDefinition[];
  services: ToolServices;
  surface?: Surface;
  interceptors?: Interceptor[];
}): Catalog {
  const surface = opts.surface || "chat";
  const byName = new Map<string, ToolDefinition>();
  for (const t of opts.tools || coreTools) {
    if (byName.has(t.name)) throw new Error(`duplicate tool: ${t.name}`);
    if (t.surfaces.includes(surface)) byName.set(t.name, t);
  }
  const interceptors = opts.interceptors || [];

  const base = async (call: ToolCall, scene: SceneContext): Promise<ToolResult> => {
    const def = byName.get(call.name);
    if (!def) throw new ToolError("unknown_tool", `tool not on ${surface} surface: ${call.name}`);
    validateArgs(def.inputSchema, call.args || {});
    const ctx: ToolContext = {
      scene,
      services: opts.services,
      surface,
      call: (name, args) => chain({ name, args }, scene),
    };
    return await def.run(call.args || {}, ctx);
  };

  const chain = async (call: ToolCall, scene: SceneContext): Promise<ToolResult> => {
    let handler: (c: ToolCall) => Promise<ToolResult> = (c) => base(c, scene);
    for (let i = interceptors.length - 1; i >= 0; i--) {
      const next = handler;
      const icept = interceptors[i];
      handler = (c) => icept(c, next);
    }
    return handler(call);
  };

  const visible = () => Array.from(byName.values());
  return {
    list: visible,
    run: (name, args, scene) => chain({ name, args }, scene),
    functionTools: () =>
      visible().map((t) => ({
        type: "function" as const,
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      })),
    mcpTools: () =>
      visible().map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
  };
}

/** 花费闸拦截器：调用前检查硬顶/频率，调用后按保守估算记账 */
export function spendInterceptor(
  check: (est: number) => { allowed: boolean; warning: boolean; reason: string | null },
  record: (usd: number) => void,
  estimatedUsd = 0.002
): Interceptor {
  return async (call, next) => {
    const verdict = check(estimatedUsd);
    if (!verdict.allowed) {
      throw new ToolError("budget_exceeded", `call rejected: ${verdict.reason}`);
    }
    const result = await next(call);
    record(estimatedUsd);
    return result;
  };
}
