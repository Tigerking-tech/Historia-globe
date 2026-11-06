# 「所有事件都有 10 秒影像」— 架构方案

> 结论先行：**不预生成、不预存任何 MP4**。把「10 秒视频」从「一个文件」改成「一份约 2KB 的时间轴描述（manifest）」，服务端只在被请求时按事件检索免费授权素材并返回这份描述，播放器实时渲染。N 个事件的成本是 N 份小 JSON + 按需 CDN 图片，不是 N 个视频。

---

## 一、为什么不能"提前生成预存"

| 做法 | 为什么不行 |
|---|---|
| 为每个事件预先生成 10s MP4 存服务器 | 事件是开放集合（Wikidata / Wikipedia / 专题库持续新增），数量上万且每天变；存储、转码算力、审核成本都随 N 线性增长，且绝大多数永远不会被访问 |
| 用户请求时服务端 ffmpeg 实时合成 MP4 再返回 | 每次请求都要拉素材 + 转码，冷启动数秒到数十秒；Vercel Serverless 有执行时长与临时盘限制；生成的 MP4 还得找地方缓存，等于又回到"存视频" |
| 浏览器 Canvas 录屏（MediaRecorder）导出视频 | 手机端编码不稳定、iOS 支持差异大、首屏等待长；导出的还是一个视频文件，只是把成本转嫁给用户设备 |

**共同问题**：都在试图"造出一个视频文件"。而用户真正要的是**一段 10 秒、画面在动、可拖进度条、带字幕和署名的观看体验**——这个体验不一定需要一个文件。

还有一个必须说清的**物理限制**：绝大多数历史事件（尤其 1900 年以前，以及大量古代 / 中世纪事件）**根本不存在当年拍摄的连续活动影像**，只有绘画、版画、照片或文字记载。任何产品声称"所有事件都有当年拍的视频"都是在造假。能做到、也应该做到的是：**所有事件都有 10 秒动态叙事体验，并按素材性质诚实分级标注**。

---

## 二、核心方案：参数化时间轴（Timeline-as-Manifest）

```
用户点某事件
   │
   ▼
GET /api/reel?title=…&year=…&place=…&lat=…&lon=…     ← 只传事件元数据，不传视频地址
   │
   ├─ ① curated 特例（1949 开国大典，已逐帧核验的原始活动胶片）
   ├─ ② 并发检索免费授权源
   │     Wikimedia Commons   图片 / 视频（generator=search + imageinfo/extmetadata）
   │     Internet Archive    公版历史影片（advancedsearch + metadata → mp4）
   │     Wikipedia           规范标题与摘要（用于跨语言检索与字幕）
   ├─ ③ 逐条解析许可元数据，只放行 PD / CC0 / CC BY / CC BY-SA，剔除 NC/ND/版权不明
   ├─ ④ 生成 manifest：三镜时间轴 + 素材 URL + 运镜参数 + 字幕 + 署名 + 素材性质
   └─ ⑤ CDN 缓存这份 JSON（s-maxage=1d, SWR=7d）
   │
   ▼
播放器拿到 manifest（~2KB）
   ├─ footage   → <video> 播真实活动影片（1949 效果 1:1 保留）
   ├─ stills    → Canvas 按 t 实时绘制：授权图片 + Ken Burns 平移推近 + 转场 + 颗粒暗角
   └─ schematic → Canvas 自绘矢量示意，明确标注「非历史影像」
   │
   ▼
素材字节流由浏览器直连 upload.wikimedia.org / archive.org CDN
（不经本站代理、不落盘、不预抓取）
```

### 关键点

- **服务端只返回描述，不返回字节**：`ReelManifest` 里是素材 URL、每镜起止时间、运镜参数、字幕、署名，没有任何视频数据。
- **时间 `t` 是唯一状态**：stills / schematic 模式下，`t ∈ [0,10]` 决定画什么。暂停、重播、拖进度条都是 O(1) 地设置 `t` 并重绘一帧，不依赖 HTTP Range、不依赖解码器。
- **确定性**：运镜参数由事件 key 哈希生成，同一事件每次 manifest 完全一致，CDN 缓存不会抖动。
- **素材不经过我们**：图片/视频由浏览器直连上游 CDN，服务端只做元数据检索。只有同源的 1949 特例走 Blob 全量加载（为了在不支持 Range 的平台上也能 seek）。

### 成本模型

| 项 | 预生成方案 | 本方案 |
|---|---|---|
| 存储 | N 个 MP4（数 GB～TB） | 0 个视频文件；3 个 SVG 演示素材 + 1 个 1949 特例 |
| 转码算力 | 每个事件一次 | 0 |
| 首次访问 | 命中/回源 | 1 次 Commons 搜索 + 1 次 IA 搜索（并发，约 5 个上游请求），之后 CDN 缓存 |
| 素材流量 | 服务器承担 | 上游 CDN 承担 |
| 新增事件 | 需要重新生成 | 无需任何操作，检索即用 |

---

## 三、三级素材模式与诚实标注

| 模式 | 触发条件 | 画面 | 角标 |
|---|---|---|---|
| `footage` | 命中免费授权（或 curated）活动影片 | 真实视频播放 | 「授权活动影像 · 非 AI 生成」/「原始活动胶片 · 非 AI 生成」 |
| `stills` | 只有免费授权史料图片 | Canvas 时间轴：图片 + 平移推近 + 转场 | **「史料图片编排 · 非活动影像」** |
| `schematic` | 未检索到可用授权素材（含沙箱网络不可达） | 自绘矢量（地球/地平线/刻线） | **「示意画面 · 非历史影像」** |

**红线**：stills 绝不被称为"当年拍的视频"，schematic 绝不被当作史料；每镜字幕、控制条元信息、页面角标三处同步标注。用户此前否定的"照片配运镜伪装成真实影像"，在这里被明确禁止——现在是**如实标注的史料图片编排**，与"冒充"是两回事。

1949 开国大典因存在原始纪录片胶片，走 `footage` 通道，效果与此前确认版本完全一致。其授权状态另见 [`REEL-1949-LICENSE.md`](REEL-1949-LICENSE.md)（**商用授权待取**，与本次新增的免费授权源性质不同）。

---

## 四、免费授权源与许可过滤

| 源 | 接口 | 许可判定 |
|---|---|---|
| Wikimedia Commons | `w/api.php?action=query&generator=search&gsrnamespace=6&prop=imageinfo&iiprop=url\|size\|mime\|extmetadata&iiurlwidth=1280` | 解析 `extmetadata.LicenseShortName / LicenseUrl / UsageTerms / Copyrighted / Artist / AttributionRequired` |
| Internet Archive | `advancedsearch.php?q=…&fl[]=…&output=json` → `/metadata/{id}` → `/download/{id}/{file}.mp4` | 只接受 `licenseurl` / `rights` 明确含 Public Domain / CC BY / CC0 的条目 |
| Wikipedia | `w/api.php?action=query&list=search` | 仅取规范标题与摘要做检索词与字幕，**不取图片** |

- 放行：`CC0`、Public Domain（含各国政府公有领域标记）、`CC BY`、`CC BY-SA`、`GFDL`。
- 拒绝：`NC`、`ND`、All rights reserved、fair use、许可缺失或无法识别。
- CC BY / BY-SA **逐条保留署名**：作者、许可名与链接、来源页、源名称，写入 manifest 的 `attributions` 并显示。
- 安全：所有上游 URL 由服务端常量 + `encodeURIComponent` 拼装，**不接受用户传入的 URL**；返回给播放器的素材 URL 再经 `upload.wikimedia.org` / `archive.org` 白名单校验，杜绝 SSRF 与内容注入。
- 请求头带 `Api-User-Agent`（Wikimedia 强制要求）、8s 超时、失败重试、进程内 1 小时短缓存。

---

## 五、Vercel 上线行为（为什么"现在不能访问不要紧"）

沙箱网络当前无法直连 Wikimedia / archive.org，接口会把这些源标记为 `unreachable`，**照常返回 200 + `schematic` manifest**，页面仍能完整播满 10 秒、拖动、暂停、返回，不会白屏或报错。

部署到 Vercel 后：

1. 境外网络可直连上述 API，**同一份代码无需改动、无需重新构建逻辑**，自动命中真实素材；
2. `s-maxage=86400` + `stale-while-revalidate=604800` 让 manifest 在 CDN 边缘缓存，同一事件不会重复打上游；
3. `GET /api/reel?debug=1` 可随时探测三个源的可达性，上线后自检用；
4. `?fixture=1` 是本地离线演示（自绘 SVG、明确标注「演示素材 · 非史料」），生产不会命中。

环境变量方面不需要 `HTTP_PROXY`（那是沙箱抓取数据的代理）；Vercel 用 `fetch` 直接出网即可。

---

## 六、接口

```
GET /api/reel?q=10.1
GET /api/reel?title=Apollo%2011%20Moon%20Landing&y=1969&place=Houston&lat=29.55&lon=-95.1&lang=zh
GET /api/reel?debug=1
GET /api/reel?fixture=1&title=Demo
```

返回 `ReelManifest`（字段见 `lib/reel/types.ts`）：`mode` / `shots[3]` / `assets[]` / `videoUrl?` / `disclosure` / `attributions[]` / `sources[]`。
`sources[]` 逐源报告 `ok | empty | filtered | unreachable`，便于排查"为什么这个事件是示意图"。

前端入口：

- 首页 CTA → `/reel.html`
- `/explore` 面板按钮（任意日期）→ 当前选中 / 当天首个事件
- `/explore` **每个事件卡片右侧 ▶** → 该事件独立生成
- `/reel.html?q=10.1` 自动飞往北京播放（向后兼容）
- `/reel.html?e=<title>&y=<year>&lat=…&lon=…` 从产品带参自动播放

---

## 七、已知限制与后续

1. **老事件没有活动影像**：只能 stills / schematic，靠诚实标注解决，不靠生成假视频。
2. **Commons 视频多为 WebM/OGV**：Safari 对 VP9 支持有版本差异。当前版本遇到解码失败会如实提示「影像加载失败」，不会静默用假画面顶替；后续补 `canPlayType` 检测，在不支持时回退到海报图并改标为 `stills`。
3. **检索相关性**：目前用「标题 + 年份 + 地点」多组查询 + Wikipedia 解析英文标题；对中文事件名可再加 Wikidata 标签翻译。
4. **IA 许可判定偏严格**：只接受明确标注 PD/CC 的条目，命中率会低，但法务安全；可后续接入更多明确公版馆藏（如 LOC、NASA、Europeana）。
5. **1949 特例授权待取**：正式商用前须按 `REEL-1949-LICENSE.md` 取得书面授权，或替换为已授权素材。
6. **无原始音轨**：stills / schematic 模式不配音，声音按钮会如实提示，不用合成音冒充历史现场音。
