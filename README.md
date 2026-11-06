# Historia Globe

一个把「某一天的世界史」放到 3D 地球上的 Web SaaS：选一个日期，地球亮起当天全球发生的大事；点开地点看详情、看「此刻此地」的地面实景与当地时间天气，再让 AskHistoria 把散落的事件连成一段故事。

基于 Next.js 14 App Router + TypeScript + Tailwind + Prisma/SQLite + BetterAuth，订阅支付用 Creem。

## 主要功能

- **可交互地球**：经典矢量地球与 Cesium 真实地球双模式，连续卫星影像、3D 建筑、城市中文名、UNESCO 世界遗产图层、多视图切换；手机单指拖动 / 双指缩放。
- **按日期探索**：`/explore` 输入月日（或分享链接还原），拉取当天事件并落到事发地坐标；镜头巡游、分享链接、类别筛选。
- **此刻此地 / Right Now**：任意历史事件坐标按附近真实地面街景检索（Panoramax CC BY-SA 4.0）、地标实景（Pexels）、卫星兜底（Esri），配当地真实时间与实时天气。
- **AskHistoria**：以当天事件、视角与语言为上下文的历史 AI 对话。
- **回到那一刻（Reel）**：`/reel.html` —— 输入 `10.1`，地球飞往北京，播放 10 秒 **1949 开国大典真实史料活动胶片**（城楼宣告 / 广场升旗 / 万众欢腾），非 AI 生成、非照片配运镜。首页有通用入口，`/explore` 在 10 月 1 日当天出现「看当年真实影像」按钮，带 `?q=10.1` 自动飞往北京播放。
- **中英文切换**：全站 i18n。

## 本地运行

```bash
npm install
cp .env.example .env        # 填入必要环境变量
npx prisma migrate dev      # 建本地 SQLite
npm run dev
```

`npm run build` 会先执行 `scripts/copy-cesium.mjs` 把 Cesium 静态资源拷到 `public/cesium`，再执行 `next build`。部署到 Vercel 时不需要 `HTTP_PROXY`（那是沙箱本地抓取数据的代理），但需配置生产数据库与 Creem / 认证相关的环境变量。

## 数据与许可

所有地理 / 影像 / 天气 / 事件数据源的许可、条款与署名义务见 [LICENSE-THIRD-PARTY.md](LICENSE-THIRD-PARTY.md)（§一–§七，均已核实为免费商用并落实署名）。

> **⚠️ 重要：`/reel.html` 使用的 1949 开国大典真实纪录片胶片尚未取得商业使用授权。**
> 该素材目前仅作为原型 / 内部演示资产纳入仓库。财产权可能已届满，但署名权、修改权、保护作品完整权永久受保护，且本项目对原片做了裁切、烧字幕与配音；平台播放版本另有邻接权与条款约束。正式对外收费、公开运营或投放前，必须先取得权利人书面许可（中央新影集团影视资料部等），或按 [docs/REEL-1949-LICENSE.md](docs/REEL-1949-LICENSE.md) 的降级方案撤下素材与入口。**不要把它当成已获授权的免费素材。**

## 技术栈

Next.js 14 · React 18 · TypeScript · Tailwind CSS · Prisma / SQLite · BetterAuth · Creem · three.js / CesiumJS · Playwright（验证）
