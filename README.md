# Historia Globe

一个把「某一天的世界史」放到 3D 地球上的 Web SaaS：选一个日期，地球亮起当天全球发生的大事；点开地点看详情、看「此刻此地」的地面实景与当地时间天气，再让 AskHistoria 把散落的事件连成一段故事。

基于 Next.js 14 App Router + TypeScript + Tailwind + Prisma/SQLite + BetterAuth；Creem 结账模板已接入，但**订阅尚未开放**（详见下文「商业化状态」）。

> **商业化状态（2026-11-07）**：定价页只列出**今天真实可用**的功能；无限提问、每日邮件、成员席位等仍标为「计划中」，Voyager / Historian 两档价格标为「待定」，三档 CTA 均指向免费探索器。本站当前不收取任何费用。不要在产品文案里把未实现功能写成已交付权益。

## 主要功能

- **可交互地球**：经典矢量地球与 Cesium 真实地球双模式，连续卫星影像、3D 建筑、城市中文名、UNESCO 世界遗产图层、多视图切换；手机单指拖动 / 双指缩放。
- **按日期探索**：`/explore` 输入月日（或分享链接还原），拉取当天事件并落到事发地坐标；镜头巡游、分享链接、类别筛选。
- **此刻此地 / Right Now**：任意历史事件坐标按附近真实地面街景检索（Panoramax CC BY-SA 4.0）、地标实景（Pexels）、卫星兜底（Esri），配当地真实时间与实时天气。
- **AskHistoria**：以当天事件、视角与语言为上下文的历史 AI 对话。
- **回到那一刻（Slideshow）**：`/reel.html` —— **全站统一「真实照片幻灯片」**。输入任意事件（如 `911`）或点任意事件卡片，地球飞往事发地，把该事件的**自由授权真实史料照片**一张张自动轮换播放：交叉淡入淡出、上一张/下一张/暂停/重播/进度点、逐张显示来源与许可署名。服务端**不生成、不存储任何视频**，只按事件返回一份照片清单 JSON。
  - 素材只来自 Wikimedia Commons 的 PD / CC0 / CC BY / CC BY-SA（逐条解析许可）+ 本地已核验的 9·11 公有领域缓存；**项目内不含任何需要另行取得商用授权、或在美国版权状态存疑的素材**。
  - 9·11（PD-USGov / NOAA / NIST / 美国海军）有 3 张已核验真实史料照片，受限网络下也能播；1949 组 `PD-China` 因美国 URAA 版权恢复风险已整体移除，`10.1` 显示专用诚实占位；其余事件上线 Vercel 境外直连后自动检索。
  - 未检索到照片时显示诚实占位（明确「非历史影像」），绝不用矢量示意、AI 生成画面或照片配运镜冒充史料。
  - 架构见 [docs/REEL-ARCHITECTURE.md](docs/REEL-ARCHITECTURE.md)，逐张来源与法务边界见 [docs/REEL-COMMONS-CREDITS.md](docs/REEL-COMMONS-CREDITS.md)。
- **幻灯片直达**：落地页 CTA 与事件卡片链接带 `?q=` / `?e=`，进入 `/reel.html` 即自动飞往事发地并开始轮换，无需再点一次「出发」；普通事件不再被 `10.1` 兜底误飞北京。
- **中英文切换**：全站 i18n。
- **可溯源与导出**：每个事件都带可点击的原始出处（Wikipedia / Wikidata 检索或条目页）、来源类型标签；任意一天可导出含出处链接与坐标的 CSV；收藏地点生成跨日期的个人时间线（localStorage 持久化）。
- **类别筛选与数据密度透明**：类别 chips 同时过滤事件列表与地球点位；外部实时源不可达时，页面明确提示「当前仅有本地策展数据」，不把稀疏结果伪装成完整的一天；日期快速切换有请求序号保护，避免旧请求覆盖新结果。
- **我脚下此刻 / GPS**：`navigator.geolocation` 一键定位到用户当前位置，显示该地此刻的地面实景、当地时间与实时天气；拒绝授权时诚实降级。
- **显示模式**：深色（默认）/ 浅色高对比（户外强光手机）/ 演示大字（教室投屏），由 `<html data-hg-mode>` 驱动，地球画布保持深色。
- **真实地球加载态**：切换 Cesium 后首帧卫星影像到位前显示明确进度提示，避免长时间黑屏被误判为故障。

## 本地运行

```bash
npm install
cp .env.example .env        # 填入必要环境变量
npx prisma migrate dev      # 建本地 SQLite
npm run dev
```

`npm run build` 会先执行 `scripts/copy-cesium.mjs` 把 Cesium 静态资源拷到 `public/cesium`，再执行 `next build`。部署到 Vercel 时不需要 `HTTP_PROXY`（那是沙箱本地抓取数据的代理），但需配置生产数据库与 Creem / 认证相关的环境变量。

`/api/reel` 在沙箱内无法直连 Wikimedia 时，除 9·11 一组本地缓存外会返回 `mode:"empty"` 的诚实占位；部署到 Vercel（境外直连）后自动命中真实自由授权照片，**无需改代码**。`GET /api/reel?debug=1` 可探测图源可达性。

## 数据与许可

所有地理 / 影像 / 天气 / 事件数据源与「回到那一刻」照片的许可、条款与署名义务见 [LICENSE-THIRD-PARTY.md](LICENSE-THIRD-PARTY.md)（§一–§八，均已核实为免费商用并落实署名）。

> **法务复核已完成（2026-11-06）**：`PD-China` 1949 组在美国 URAA（17 U.S.C. §104A）下已恢复版权，约保护至 2044 年，**风险高，已从项目整体移除**；在线检索也加了 URAA 黑名单防止复发。9·11 组为美国联邦政府作品（PD-USGov，17 U.S.C. §105），无此争议。含可识别人物的照片另涉肖像权。完整依据与引用见 [docs/REEL-COMMONS-CREDITS.md](docs/REEL-COMMONS-CREDITS.md)。

## 技术栈

Next.js 14 · React 18 · TypeScript · Tailwind CSS · Prisma / SQLite · BetterAuth · Creem · three.js / CesiumJS · Playwright（验证）
