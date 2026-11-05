// AskYore 对话层公共契约（纯类型 + 纯函数，客户端/服务端均可引入）。
// 设计参照 God's Eye View 的 defineTool / composeCatalog / surfaces / world packet，
// 但把「实时态势」换成「历史上的一天」：模型只做意图路由，GIS/UI 动作由确定性代码执行。

export type Lang = "en" | "zh";
export type ViewMode = "satellite" | "countries" | "night";

/** 三种接入面：文字聊天、语音、MCP（供 Claude / Codex 等外部 Agent 调用） */
export type Surface = "chat" | "voice" | "mcp";

export type CameraState = {
  lat: number;
  lon: number;
  /** 相机高度，米（WGS84 椭球面上） */
  alt: number;
  heading?: number;
  pitch?: number;
};

export type SceneEvent = {
  id: string;
  year: number;
  title: string;
  place: string;
  category: string;
  lat: number | null;
  lon: number | null;
};

/** 注入模型前的场景快照（对应 GEV 的 World Packet，但字段面向历史叙事） */
export type SceneContext = {
  month: number;
  day: number;
  lang: Lang;
  view: ViewMode;
  realEarth: boolean;
  selectedEventId?: string | null;
  camera?: CameraState | null;
  events?: SceneEvent[];
  tour?: { active: boolean; index: number; total: number } | null;
};

export type ToolKind = "query" | "action";

/** action 工具只返回指令，不直接操作 DOM/相机；前端执行成功后再回传确认 */
export type AppAction =
  | { type: "fly_to"; lat: number; lon: number; altitude: number; pitch: number }
  | { type: "select_event"; id: string }
  | { type: "set_date"; month: number; day: number }
  | { type: "set_view"; view: ViewMode }
  | { type: "set_lang"; lang: Lang }
  | { type: "set_real_earth"; on: boolean }
  | { type: "start_tour" }
  | { type: "share_view" };

export type ToolResult = {
  /** 只陈述已确认的事实，供模型复述；不得包含推测 */
  summary: string;
  data: unknown;
  actions?: AppAction[];
  /** 答案引用到的事件 id，用于可追溯与防幻觉自检 */
  refs?: string[];
};

export type ArgSchema = {
  type: "object";
  properties: Record<
    string,
    { type: "string" | "number" | "boolean" | "array"; enum?: string[]; minimum?: number; maximum?: number }
  >;
  required?: string[];
  additionalProperties: false;
};

export type ToolDefinition = {
  name: string;
  kind: ToolKind;
  title: string;
  description: string;
  inputSchema: ArgSchema;
  /** 该工具在哪些接入面提供 */
  surfaces: Surface[];
  run: (args: Record<string, any>, ctx: ToolContext) => Promise<ToolResult> | ToolResult;
};

export type ToolServices = {
  getEvents: (m: number, d: number) => Promise<any[]>;
  getHeritage: () => Promise<any[]>;
  now: () => number;
};

export type ToolContext = {
  scene: SceneContext;
  services: ToolServices;
  surface: Surface;
  /** 复合工具可通过它调用 catalog 内其他工具（共享拦截器） */
  call?: (name: string, args: Record<string, any>) => Promise<ToolResult>;
  signal?: AbortSignal;
};

export type ToolCall = { name: string; args: Record<string, any> };

export type Interceptor = (
  call: ToolCall,
  next: (call: ToolCall) => Promise<ToolResult>
) => Promise<ToolResult>;

export class ToolError extends Error {
  constructor(
    public code:
      | "invalid_arguments"
      | "unknown_tool"
      | "unavailable"
      | "unsupported"
      | "malformed"
      | "retry_later"
      | "budget_exceeded",
    message: string
  ) {
    super(message);
    this.name = "ToolError";
  }
}
