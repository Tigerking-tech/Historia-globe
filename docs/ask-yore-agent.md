# AskYore 对话层设计（v1）

> 目标：把「与历史对话」从现在的一次性问答 `/api/ask`，升级成可计费、可控、可追溯、可被外部 Agent 调用的对话层。
> 参照对象：`bilawalsidhu/gods-eye-view`（MIT，62.7K★ @ 2026-11-04）的 `docs/TOOLS.md`、`docs/SCENE-DOCUMENT.md`、`src/agent/worldPacket.js`。
> 只借鉴工程模式，**不使用其代码与数据**：本项目是 Next.js 14 / React SaaS，对方是 Vue 3 + Vite 的本地应用。

---

## 一、为什么这样设计

GEV 的 AI 不在渲染层，而在**交互与语义层**：地球仍是经典 GIS，模型只负责把用户意图路由到一组确定性工具上。这个分层对本项目尤其合适——历史事件最怕模型编造，因此必须让"事实"来自数据库、"动作"来自代码、"模型"只做选择与叙述。

三条硬约束：

1. **模型不碰 UI**：`action` 工具只返回 `AppAction[]` 指令，前端执行成功后回传确认，模型才能说"已切换"。
2. **事实可追溯**：每个 query 结果带事件 `id`，system prompt 强制引用；上下文不足就明说，不用常识补齐。
3. **账单可控**：$2 警告 / $5 会话硬顶 / $20 每 IP 每日顶 / 每分钟 24 次调用上限，超顶直接 `402` 拒绝而不是静默打穿。

---

## 二、分层与文件

```
浏览器  ── 文字 / 语音 / 分享链接 ──▶  /api/ask-yore  (唯一入口)
                                          │
        ┌─────────────────────────────────┼──────────────────────────────┐
        │  context.ts   场景上下文 + 防幻觉规则（World Packet 的历史版）      │
        │  spend.ts     花费闸（会话/日/频率三层）                            │
        │  tools.ts     defineTool / composeCatalog / interceptor / surfaces │
        │  types.ts     契约（SceneContext / AppAction / ToolResult …）       │
        └─────────────────────────────────┬──────────────────────────────┘
                                          │ 只读
                          lib/history.ts（Wikidata / UNESCO / UCDP / EM-DAT / curated）
```

| 文件 | 职责 |
|---|---|
| `lib/ask-yore/types.ts` | 公共类型；`ToolError` 错误分类 |
| `lib/ask-yore/context.ts` | `buildSceneContext()`、`groundingRules()` |
| `lib/ask-yore/spend.ts` | `SpendGuard`、`estimateUsd()` |
| `lib/ask-yore/tools.ts` | 工具白名单、参数校验、目录组装、MCP/function 适配器 |
| `app/api/ask-yore/route.ts` | `capabilities` / `context` / `tool` / `session` 四个 action |
| `app/api/ask/route.ts` | 渐进接入：接收可选 `scene`，注入 prompt + 防幻觉规则 |

---

## 三、工具白名单（12 个）

| 名称 | 类型 | 作用 | chat | voice | mcp |
|---|---|---|:--:|:--:|:--:|
| `get_day_events` | query | 列出某天事件，可按分类过滤 | ✓ | ✓ | ✓ |
| `get_event_detail` | query | 读单条完整记录 | ✓ | ✓ | ✓ |
| `search_events` | query | 当天事件关键词检索 | ✓ | ✓ | ✓ |
| `count_by_category` | query | 按分类聚合（"这一天有几场战争"） | ✓ | ✓ | ✓ |
| `get_nearby_heritage` | query | 同国家/地区的 UNESCO 遗产 | ✓ | ✓ | ✓ |
| `get_scene_state` | query | 当前场景快照 | ✓ | ✓ | ✓ |
| `fly_to_event` | action | 排队相机飞行（不直接改相机） | ✓ | ✓ | ✓ |
| `set_date` | action | 排队切换日期 | ✓ | ✓ | ✓ |
| `set_view` | action | 排队切换卫星/国界/夜景 | ✓ | ✓ | ✓ |
| `set_language` | action | 排队切换中英 | ✓ | ✓ | ✓ |
| `start_day_tour` | action | 排队播放当天镜头巡游 | ✓ | ✓ | — |
| `share_view` | action | 排队生成分享链接 | ✓ | ✓ | — |

`surfaces` 借鉴 GEV 的做法：MCP 客户端没有地球画面，因此不暴露纯 UI 动作工具。
`validateArgs` 拒绝任何未声明字段与越界值，杜绝模型塞入越权参数。

**执行语义**：`ToolResult.summary` 对 action 一律写 "queued / awaiting confirmation"，
只有前端回传执行成功后，对话层才追加一条确认。这正是 `docs/VOICE-OWNERSHIP.md` 里
"只确认已成功执行的动作" 的落地方式。

---

## 四、场景上下文（Scene Context）

对应 GEV 的 `getWorldPacket()`，但字段面向历史叙事，且有 1600 字符预算：

```ts
SceneContext = {
  month, day, lang, view, realEarth,
  selectedEventId?, camera?{lat,lon,alt,heading,pitch},
  events?: [{id,year,title,place,category,lat,lon}],
  tour?: {active,index,total}
}
```

注入内容包含：日期、语言、当前视图、相机、选中事件、当天事件清单（最多 12 条，超出提示调用工具取全量）、巡游进度。
GEV 用 viewport 截图做 Visual Grounding；本项目不依赖多模态识图，**事件 id 即 grounding**，更便宜也更可靠。

`groundingRules(lang)` 输出五条硬规则，追加进 `/api/ask` 的 system prompt 与 Realtime 会话配置。

---

## 五、花费闸

`SpendGuard` 三层：`session.usedUsd`（$2 警告 / $5 硬顶）、`daily[ip]`（$20/日）、`minuteCalls`（24/min）。
`spendInterceptor` 作为目录最外层拦截器，调用前 `check()`、成功后 `record()`；拒绝时抛 `ToolError("budget_exceeded")` → HTTP 402。

> **诚实说明**：`estimateUsd()` 的单价只是保守护栏，不是计费依据；进程内 Map 在 Serverless 多实例下不共享。
> 生产上线前必须做两件事：改成按 provider 返回的真实 `usage` 记账，账本迁到 Redis/数据库，并与订阅套餐额度打通。

---

## 六、密钥与网络安全

- 浏览器**永不**拿到主密钥。`action=session` 由服务端用 `ASKYORE_REALTIME_KEY` 换短时 `clientSecret`，只回传该凭证与过期时间。
- 未配置密钥时 `mode:"local"`，服务端**不发起任何外呼**，前端继续用 `/api/ask` 的本地事件串联降级。
- 防 SSRF：`safeUpstream()` 强制 https + host 白名单（`api.openai.com` 或用户自配 `LLM_BASE_URL` 的 host），拒绝回环/私网。
- 另有：请求体 24KB 上限、上游响应 32KB 上限、8s 超时、per-IP 60 次/分钟限流。
- `capabilities` 返回 `mcpTools()`，可直接演进成 `/api/mcp` 的 `tools/list`，让 Claude / Codex 在对话里调用 AskYore（GEV `server/mcp/` 的等价物）。

---

## 七、渐进迁移路线（不推倒重来）

| 阶段 | 状态 | 内容 |
|---|---|---|
| 0 | ✅ 已有 | `/api/ask` 一次性问答 + 无 key 时本地串联降级 |
| 1 | ✅ 本次 | 场景上下文注入 system prompt；工具目录、花费闸、会话代理落地 |
| 2 | 下一步 | 前端 Ask 面板改为多轮：先调 `context`，模型返回 tool_call → `/api/ask-yore` 执行 → 结果回填 |
| 3 | 下一步 | 接入 Realtime 语音（需密钥 + 按分钟计费），加语音花费条与订阅分层 |
| 4 | 下一步 | 起 `/api/mcp` stdio/HTTP 端点，做外部 Agent 分发；账本迁 Redis |

阶段 1 **不改变现有用户体验**：`/api/ask` 仍可直接调用，`scene` 是可选字段。

---

## 八、合规与命名

- 工具数据全部来自本项目已有的可商用源：Wikidata(CC0)、UNESCO、Natural Earth(公共领域)、UCDP/EM-DAT(registration-gated，已核实)、NASA；**不引入 GTD**（EULA 禁商用）。
- 未使用 GEV 的任何代码、模型、宣传 GIF 或第三方数据集；其 MIT 只覆盖源码，数据各自带条款。
- 品牌命名沿用域名检索结论 `AskYore`（`askyore.com/.io/.ai` 可注册），站内暂保留 "Historia Globe" 与 "Ask Historia" 文案，品牌切换为独立任务。
- 新文案走 `lib/i18n`，对话层上下文与规则按 `lang` 输出中英两版。

---

## 九、自检清单

- [x] `npm run build` 通过（含新路由与类型）
- [x] `/api/ask-yore` 四个 action 均可调用，`capabilities` 返回 12 个工具
- [x] 未知工具 / 越界参数 / 超预算分别返回 404 / 400 / 402
- [x] 无密钥时 `session` 返回 `mode:"local"`，不产生外呼
- [x] 浏览器实测：Ask 面板仍可用、场景上下文注入生效
