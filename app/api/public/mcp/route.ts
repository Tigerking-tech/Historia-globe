// 无状态 MCP 风格 JSON-RPC 端点（模型上下文协议）。
//
// 让 Claude / ChatGPT / Cursor 等 agent 直接「调用」本站点，而不只是引用页面。
// 实现 MCP 的 initialize / tools/list / tools/call / ping 四个方法，使用
// 标准 JSON-RPC 2.0 over HTTP（stateless，无 SSE、无 session 状态）。
//
// 诚实边界：这是最小可用实现，不是官方 SDK 的完整 transport；不支持
// resources / prompts / sampling，也不做鉴权（公开只读）。工具结果全部
// 来自与 REST API 相同的查询函数，口径一致。

import { NextRequest } from "next/server";
import {
  listMcpTools,
  callMcpTool,
  publicJson,
  publicOptions,
  API_VERSION,
} from "@/lib/public-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROTOCOL_VERSION = "2024-11-05";

type Rpc = {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
};

function result(id: Rpc["id"], value: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result: value };
}
function error(id: Rpc["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function handle(rpc: Rpc) {
  const id = rpc.id ?? null;
  switch (rpc.method) {
    case "initialize":
      return result(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "historia-globe", version: API_VERSION },
        instructions:
          "Use tools to query what happened around the world on a calendar date. Every result includes a sourceUrl. The dataset is a build-time snapshot, not a complete historical record; supplemental entries have no coordinates.",
      });
    case "tools/list":
      return result(id, { tools: listMcpTools() });
    case "tools/call": {
      const p = (rpc.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      if (!p.name) return error(id, -32602, "tools/call requires params.name");
      const data = callMcpTool(p.name, p.arguments ?? {});
      const isError = (data as { ok?: boolean }).ok === false;
      return result(id, {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        isError,
      });
    }
    case "ping":
      return result(id, {});
    case "notifications/initialized":
      return null; // 通知类消息不回包
    default:
      return error(id, -32601, `Method not found: ${rpc.method ?? "(missing)"}`);
  }
}

export async function OPTIONS() {
  return publicOptions();
}

export async function GET() {
  return publicJson({
    name: "historia-globe MCP endpoint",
    transport: "JSON-RPC 2.0 over HTTP (stateless, POST only for calls)",
    protocolVersion: PROTOCOL_VERSION,
    methods: ["initialize", "tools/list", "tools/call", "ping"],
    tools: listMcpTools().map((t) => t.name),
    manifest: "/mcp.json",
    note: "Public and read-only. No authentication, no write operations, no resources/prompts transport.",
  });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return publicJson(error(null, -32700, "Parse error: invalid JSON body"), 400);
  }

  // 支持单条与批量（JSON-RPC batch），批量里通知类消息不产生返回项。
  if (Array.isArray(body)) {
    const out = body
      .map((r) => handle((r ?? {}) as Rpc))
      .filter((r) => r !== null);
    return out.length ? publicJson(out) : new Response(null, { status: 204 });
  }
  const out = handle((body ?? {}) as Rpc);
  if (out === null) return new Response(null, { status: 204 });
  return publicJson(out);
}
