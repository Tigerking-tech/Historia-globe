# Historia Globe

一个把「某一天的世界史」放到 3D 地球上的 Web SaaS：选一个日期，地球亮起当天全球发生的大事；点开地点看详情、看「此刻此地」的地面实景与当地时间天气，再让 AskHistoria 把散落的事件连成一段故事。

基于 Next.js 14 App Router + TypeScript + Tailwind + Prisma/SQLite + BetterAuth。

> **商业化状态（2026-11-07）**：站点功能**当前全部免费**，无需账号或绑卡，**收款未启用、本站不收取任何费用**。定价页从服务端读取真实收款状态（`/api/payments/status`）：默认 `disabled`，只有配置 `CREEM_MODE=live` + 正式 key + 商品 id 后才创建真实结账；绝不把 test 通道当成能收真钱。计划中的「史料通行证」是**一次性 $4**（不订阅、不自动续费），结账启用前 CTA 不指向付款。依赖账号体系的功能（云同步、每日邮件、成员席位）一律标「计划中」。不要在产品文案里把未实现功能写成已交付权益。

## 主要功能

- **可交互地球**：经典矢量地球与 Cesium 真实地球双模式，连续卫星影像、3D 建筑、城市中文名、UNESCO 世界遗产图层、多视图切换；手机单指拖动 / 双指缩放。
- **按日期探索**：`/explore` 输入月日（或分享链接还原），拉取当天事件并落到事发地坐标；镜头巡游、分享链接、类别筛选。
- **此刻此地 / Right Now**：任意历史事件坐标按附近真实地面街景检索（Panoramax CC BY-SA 4.0）、地标实景（Pexels）、卫星兜底（Esri），配当地真实时间与实时天气。
- **AskHistoria**：以当天事件、视角与语言为上下文的历史 AI 对话；回答附**逐条可点出处引用**，并有免费层 token 配额护栏（输入长度 / 频率 / 每日硬顶 + 服务端 `max_tokens`）。
- **回到那一刻（Slideshow）**：`/reel.html` —— **全站统一「真实照片幻灯片」**。输入任意事件（如 `911`）或点任意事件卡片，地球飞往事发地，把该事件的**自由授权真实史料照片**一张张自动轮换播放：交叉淡入淡出、上一张/下一张/暂停/重播/进度点、逐张显示来源与许可署名。服务端**不生成、不存储任何视频**，只按事件返回一份照片清单 JSON。
  - 素材只来自 Wikimedia Commons 的 PD / CC0 / CC BY / CC BY-SA（逐条解析许可）+ 本地已核验的 9·11 公有领域缓存；**项目内不含任何需要另行取得商用授权、或在美国版权状态存疑的素材**。
  - 9·11（PD-USGov / NOAA / NIST / 美国海军）有 3 张已核验真实史料照片，受限网络下也能播；1949 组 `PD-China` 因美国 URAA 版权恢复风险已整体移除，`10.1` 显示专用诚实占位；其余事件上线 Vercel 境外直连后自动检索。
  - 未检索到照片时显示诚实占位（明确「非历史影像」），绝不用矢量示意、AI 生成画面或照片配运镜冒充史料。
  - 架构见 [docs/REEL-ARCHITECTURE.md](docs/REEL-ARCHITECTURE.md)，逐张来源与法务边界见 [docs/REEL-COMMONS-CREDITS.md](docs/REEL-COMMONS-CREDITS.md)。
- **幻灯片直达**：落地页 CTA 与事件卡片链接带 `?q=` / `?e=`，进入 `/reel.html` 即自动飞往事发地并开始轮换，无需再点一次「出发」；普通事件不再被 `10.1` 兜底误飞北京。
- **中英文切换**：全站 i18n。
- **可溯源与导出**：每个事件都带可点击的原始出处（Wikipedia / Wikidata 检索或条目页）、来源类型标签；任意一天可导出含出处链接与坐标的 CSV；收藏地点生成跨日期的个人时间线（localStorage 持久化）。
- **类别筛选与数据密度透明**：类别 chips 同时过滤事件列表与地球点位；外部实时源不可达时，页面明确提示「当前仅有本地策展数据」，不把稀疏结果伪装成完整的一天；日期快速切换有请求序号保护，避免旧请求覆盖新结果。`GET /api/sources/status` 可逐个探测上游可达性（沙箱内不可达会如实上报）。
- **我脚下此刻 / GPS**：`navigator.geolocation` 一键定位到用户当前位置，显示该地此刻的地面实景、当地时间与实时天气；拒绝授权时诚实降级。
- **显示模式**：深色（默认）/ 浅色高对比（户外强光手机）/ 演示大字（教室投屏），由 `<html data-hg-mode>` 驱动，地球画布保持深色。
- **真实地球首帧提速**：切换 Cesium 后先铺一层**本地地球贴图**即时底图（毫秒级，不再黑屏），Esri 卫星瓦片逐块覆盖、首个瓦片到位即撤加载提示，兜底从 30s 缩到 12s。

## 可索引内容页（SEO / GEO）

面向搜索引擎与 AI 助手，新增**纯服务端渲染、无需 JS 即可读到全文**的静态内容页：

- `/on-this-day/[MM-DD]` — 366 个日期页，第一屏直接给「这一天有几条事件、分别是什么」，并说明免费 / 收费。
- `/event/[slug]` — 每个策展事件一个页面，含结论、坐标、可点维基百科出处、逐张署名照片与 JSON-LD。
- `/place/[slug]` — 地点聚合页。
- `/for-teachers` — 面向教师 / homeschool 的种子人群落地页（演示模式、含出处 CSV、20 分钟课堂用例）。
- `/legal/{privacy,terms,refund,contact}` — 隐私政策、服务条款、退款政策、联系我们，中英双语全文都在静态 HTML 里。联系方式用可配置邮箱 + 始终可达的 GitHub Issues 兜底。
- `app/robots.ts` 显式放行 GPTBot / OAI-SearchBot / ChatGPT-User / ClaudeBot / PerplexityBot / Googlebot / Bingbot 等 AI 与搜索爬虫；`app/sitemap.ts` 输出全量 URL（核心页 + 366 日期 + 全部事件 + 地点 + 法务页）。

内容来自 `lib/content.ts`（只读本地策展数据，构建期无需外网），有事件的日期预生成，其余按需 SSR；页面明确标注「本地策展 + 上线后外部源自动补齐」，不把稀疏数据伪装成完整。

## 可观测性（漏斗 + AI 爬虫）

哥飞分享里强调「GA 抓不到 AI 爬虫，要自己记录」。实现：

- `middleware.ts` 识别 AI / 搜索爬虫 UA，转发到 `/api/ingest` 落盘 + 内存，并回 `x-hg-bot` 响应头。
- `components/funnel.tsx` + `reel.html` 上报最小转化漏斗：`page_view → reel_start → reel_slide → checkout_click`，外加 `export_csv`、`teacher_entry`。
- `GET /api/ingest?window=60` 返回漏斗汇总、按 bot 分类的爬虫命中，以及「爬虫访问后 30 分钟内同路径是否出现真人」的粗略关联。
- 诚实边界：进程内环形缓冲 + 尽力 JSONL 落盘，Serverless 多实例不共享、只读文件系统自动降级为内存。生产应接外部日志服务；此处保证本地 / 单实例真实可查，不声称跨实例精确统计。

## 本地运行

```bash
npm install
cp .env.example .env        # 填入必要环境变量（收款默认关闭）
npx prisma db push          # 建本地 SQLite
npm run dev
```

`npm run build` 会先执行 `scripts/copy-cesium.mjs` 把 Cesium 静态资源拷到 `public/cesium`，再执行 `next build`。部署到 Vercel 时不需要 `HTTP_PROXY`（那是沙箱本地抓取数据的代理），但需配置生产数据库与认证相关环境变量；收款按上文「商业化状态」显式启用。

`/api/reel` 在沙箱内无法直连 Wikimedia 时，除 9·11 一组本地缓存外会返回 `mode:"empty"` 的诚实占位；部署到 Vercel（境外直连）后自动命中真实自由授权照片，**无需改代码**。`GET /api/sources/status` 可核查上游可达性。

## 数据与许可

所有地理 / 影像 / 天气 / 事件数据源与「回到那一刻」照片的许可、条款与署名义务见 [LICENSE-THIRD-PARTY.md](LICENSE-THIRD-PARTY.md)（§一–§八，均已核实为免费商用并落实署名）。

> **法务复核已完成（2026-11-06）**：`PD-China` 1949 组在美国 URAA（17 U.S.C. §104A）下已恢复版权，约保护至 2044 年，**风险高，已从项目整体移除**；在线检索也加了 URAA 黑名单防止复发。9·11 组为美国联邦政府作品（PD-USGov，17 U.S.C. §105），无此争议。含可识别人物的照片另涉肖像权。完整依据与引用见 [docs/REEL-COMMONS-CREDITS.md](docs/REEL-COMMONS-CREDITS.md)。

## 技术栈

Next.js 14 · React 18 · TypeScript · Tailwind CSS · Prisma / SQLite · BetterAuth · three.js / CesiumJS · Playwright（验证）
