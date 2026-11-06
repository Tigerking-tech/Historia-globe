# Historia Globe

一个把「某一天的世界史」放到 3D 地球上的 Web SaaS：选一个日期，地球亮起当天全球发生的大事；点开地点看详情、看「此刻此地」的地面实景与当地时间天气，再让 AskHistoria 把散落的事件连成一段故事。

基于 Next.js 14 App Router + TypeScript + Tailwind + Prisma/SQLite + BetterAuth，订阅支付用 Creem。

## 主要功能

- **可交互地球**：经典矢量地球与 Cesium 真实地球双模式，连续卫星影像、3D 建筑、城市中文名、UNESCO 世界遗产图层、多视图切换；手机单指拖动 / 双指缩放。
- **按日期探索**：`/explore` 输入月日（或分享链接还原），拉取当天事件并落到事发地坐标；镜头巡游、分享链接、类别筛选。
- **此刻此地 / Right Now**：任意历史事件坐标按附近真实地面街景检索（Panoramax CC BY-SA 4.0）、地标实景（Pexels）、卫星兜底（Esri），配当地真实时间与实时天气。
- **AskHistoria**：以当天事件、视角与语言为上下文的历史 AI 对话。
- **回到那一刻（Slideshow）**：`/reel.html` —— **全站统一「真实照片幻灯片」**。输入任意事件（如 `10.1`、`911`）或点任意事件卡片，地球飞往事发地，把该事件的**自由授权真实史料照片**一张张自动轮换播放：交叉淡入淡出、上一张/下一张/暂停/重播/进度点、逐张显示来源与许可署名。服务端**不生成、不存储任何视频**，只按事件返回一份照片清单 JSON。
  - 素材只来自 Wikimedia Commons 的 PD / CC0 / CC BY / CC BY-SA（逐条解析许可）+ 本地已核验的公有领域缓存；**项目内不含任何需要另行取得商用授权的素材**。
  - 1949 开国大典（PD-China）与 9·11（PD-USGov / NOAA / NIST / 美国海军）各有 3 张已核验真实史料照片，受限网络下也能播；其余事件上线 Vercel 境外直连后自动检索。
  - 未检索到照片时显示诚实占位（明确「非历史影像」），绝不用矢量示意、AI 生成画面或照片配运镜冒充史料。
  - 架构见 [docs/REEL-ARCHITECTURE.md](docs/REEL-ARCHITECTURE.md)，逐张来源与法务边界见 [docs/REEL-COMMONS-CREDITS.md](docs/REEL-COMMONS-CREDITS.md)。
- **中英文切换**：全站 i18n。

## 本地运行

```bash
npm install
cp .env.example .env        # 填入必要环境变量
npx prisma migrate dev      # 建本地 SQLite
npm run dev
```

`npm run build` 会先执行 `scripts/copy-cesium.mjs` 把 Cesium 静态资源拷到 `public/cesium`，再执行 `next build`。部署到 Vercel 时不需要 `HTTP_PROXY`（那是沙箱本地抓取数据的代理），但需配置生产数据库与 Creem / 认证相关的环境变量。

`/api/reel` 在沙箱内无法直连 Wikimedia 时，除 1949 / 9·11 两组本地缓存外会返回 `mode:"empty"` 的诚实占位；部署到 Vercel（境外直连）后自动命中真实自由授权照片，**无需改代码**。`GET /api/reel?debug=1` 可探测图源可达性。

## 数据与许可

所有地理 / 影像 / 天气 / 事件数据源与「回到那一刻」照片的许可、条款与署名义务见 [LICENSE-THIRD-PARTY.md](LICENSE-THIRD-PARTY.md)（§一–§八，均已核实为免费商用并落实署名）。

> **法务提示（非购买授权）**：1949 组照片为 `PD-China` 公有领域，Commons 文件页提示美国 URAA 可能恢复版权、不适用较短期限规则的法域（美/瑞士 70 年等）未必认可。**正式面向欧美收费运营前须逐张复核，或替换为明确 `CC0` / `PD-US` / `PD-1996` 的同类史料**；9·11 组为美国联邦政府作品（PD-USGov），无此争议。含可识别人物的照片另涉肖像权。详见 [docs/REEL-COMMONS-CREDITS.md](docs/REEL-COMMONS-CREDITS.md)。

## 技术栈

Next.js 14 · React 18 · TypeScript · Tailwind CSS · Prisma / SQLite · BetterAuth · Creem · three.js / CesiumJS · Playwright（验证）
