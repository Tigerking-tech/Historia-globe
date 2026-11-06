# 全站统一「真实照片幻灯片」— 架构方案

> 结论先行：**项目里已经没有任何需要另行取得商用授权的素材**。所有「回到那一刻」内容统一为同一种形态——一组自由授权的真实史料照片自动轮换。服务端不生成、不存储任何视频文件，只在被请求时按事件返回一份很小的照片清单 JSON。N 个事件的成本是 N 份小 JSON + 按需图片，不是 N 个视频。

---

## 一、为什么放弃视频、全站统一幻灯片

用户提出两点硬性要求：① 删除所有需要商用的素材；② 若没有真实视频、只有真实照片，就采用幻灯片，且**整个项目都采用幻灯片，保持风格统一**。

原方案的三级混搭由此全部作废：

| 旧形态 | 问题 |
|---|---|
| `footage` —— `<video>` 播 1949 央视原始活动胶片 | 唯一「商用授权待取」的资产；已删除 MP4、文档、代码通道与 workspace 里的 AI 视频成品 |
| `stills` —— 照片 + Ken Burns 平移推近 + 转场 | 「照片配运镜」被明确否定；用户要的是照片轮换，不是把照片伪装成视频 |
| `schematic` —— 自绘矢量示意 | 被明确否定；矢量示意图不能冒充史料 |

更关键的是**物理限制**：绝大多数历史事件不存在「当年拍摄的连续活动影像」，能自由商用的更少。Wikimedia Commons 约 1.4 亿文件中视频仅约 0.25%，且只收 WebM / Ogg Theora / MPEG，不支持 MP4 / H.264。任何「所有事件都有当年视频」都是造假。

因此统一为：**所有事件（9/11、10.1、任意事件）都走同一个照片幻灯片渲染器**，只有「有没有可安全商用的自由授权照片」的差别，没有形态差别。

---

## 二、核心方案：清单即幻灯片（Slides-as-Manifest）

```
用户点某事件 / 输入 911
   │
   ▼
GET /api/reel?q=911  或  ?title=…&year=…&place=…&lat=…&lon=…
   │   只传事件元数据，不传任何素材地址
   ├─ ① 命中本地已核验策展集（仅 9·11 / PD-USGov）→ 直接返回该组公有领域照片
   ├─ ② 否则并发检索 Wikimedia Commons 自由授权图片
   │     w/api.php?action=query&generator=search&gsrnamespace=6
   │       &prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1280
   │     Wikipedia 解析规范英文标题 → 补充检索词
   ├─ ③ 逐条解析 extmetadata 许可，只放行 PD / CC0 / CC BY / CC BY-SA
   │     剔除 NC / ND / All rights reserved / fair use / 许可缺失
   ├─ ④ 生成 ReelManifest：slides[] + 每张署名 + 轮换节奏 + 素材性质标注
   └─ ⑤ CDN 缓存这份 JSON（s-maxage=1d, SWR=7d）
   │
   ▼
播放器拿到清单（几 KB）
   └─ 唯一渲染器：真实照片自动轮换（交叉淡入淡出）
        上一张 / 下一张 / 暂停 / 重播 / 进度点 / 逐张署名
        mode:"empty" 时显示诚实占位（仍是同一套容器）
   │
   ▼
素材字节流：同源缓存 public/reel/slides/* 或浏览器直连 upload.wikimedia.org
（不经本站转码、不落盘、不预抓取、不生成视频）
```

**服务端只返回描述，不返回字节，更不生成视频**。`ReelManifest.slides[]` 里是照片 URL、短标题、说明、完整署名行、许可与尺寸。

---

## 三、统一形态与诚实标注

| mode | 触发条件 | 画面 | 角标 |
|---|---|---|---|
| `slides` | 有自由授权真实照片（策展集或在线检索命中） | 真实照片逐一全屏展示，交叉淡入淡出自动轮换 | 「真实史料照片 · 幻灯片」/「自由授权史料照片 · 幻灯片」 |
| `empty` | 当前网络未检索到该事件的自由授权照片 | 同一套幻灯片容器内的**诚实占位卡**：说明未检索到、上线后自动重试 | 「暂无可用照片 · 非历史影像」 |

**红线（本版严格执行）：**

1. 页面里没有 `<video>` 元素、没有 Blob/MP4/HLS、没有音轨；
2. 不做 Ken Burns 平移推近、不做任何「照片配运镜」；
3. 不用自绘矢量示意、不用 AI 生成画面、不用无关照片凑数；
4. 每张照片显示逐张署名与许可，控制条常驻显示素材性质；
5. 绝不把静态照片称为「当年拍的活动影像」。

---

## 四、免费授权源与许可过滤

| 源 | 接口 | 用途 |
|---|---|---|
| Wikimedia Commons | `w/api.php`（`generator=search` + `imageinfo/extmetadata`） | 自由授权史料**照片**（PD / CC0 / CC BY / CC BY-SA） |
| Wikipedia | `w/api.php`（`list=search`） | 规范英文标题与摘要，仅用于跨语言检索词，不取图片 |

- **放行**：Public Domain（含各国政府公有领域标记）、CC0、CC BY、CC BY-SA、GFDL。
- **拒绝**：NC、ND、All rights reserved、fair use、许可缺失或无法识别。
- **署名**：作者 + 许可名/链接 + 来源页 + 源名称，写入 `attributions[]` 与每张 `caption`，播放器逐张显示。
- **安全**：上游 URL 由服务端常量 + `encodeURIComponent` 拼装，不接受用户传入的 URL；返回给播放器的素材 URL 经 `isAllowedMediaUrl` 白名单校验（`upload.wikimedia.org` 等），杜绝 SSRF 与内容注入。
- **URAA 过滤**：`Not-PD-US-URAA`、URAA 恢复提示、中国来源国过期型 PD 标签一律拒绝（见 credits 文档第一节）。
- **请求礼仪**：`Api-User-Agent`（Wikimedia 强制）、4s 超时、超时不重试（快速失败，避免受限网络首屏等待翻倍）、进程内 1 小时短缓存、清单走 CDN 边缘缓存。

Internet Archive 影片检索与 Commons 视频检索**已移除**：全站只用照片，不再引入视频类素材。

---

## 五、本地已核验策展集（受限网络兜底）

沙箱及部分网络下 `commons.wikimedia.org` / `upload.wikimedia.org` / `en.wikipedia.org` 直连超时，在线检索拿不到素材。为让产品在任何网络下都能真实演示「照片轮换」，仓库缓存了**一组**逐张目视确认并核对许可的公有领域真实史料照片（`public/reel/slides/`，3 张，约 0.8 MB）：

| 组 | 事件 | 张数 | 许可 | 命中条件 |
|---|---|---|---|---|
| 911 | 9·11 事件 | 3 | PD-USGov（NOAA / NIST / 美国海军，17 U.S.C. §105） | `911` / `9.11` / 世贸 / World Trade Center |

**1949 开国大典组（PD-China）已于 2026-11-06 URAA 复核后整体移除**：中国 URAA 生效日
1996-01-01，而 1990 年《著作权法》第 21 条给摄影作品「发表后 50 年」保护期，
1949 年照片在 1996 年仍受保护 → 满足 17 U.S.C. §104A(h)(6) 恢复条件，
美国版权约保护至 2044 年。Commons 官方规则表对 1946–1953 年中国作品要求
`Not-PD-US-URAA`，且 2026 年正在按此提删同类照片。完整复核与引用见
[`REEL-COMMONS-CREDITS.md`](REEL-COMMONS-CREDITS.md) 第一节。

- 只把对应照片配给对应事件（`matchCuratedSet`），避免给不相干事件配错史料。
- `isUraaExcludedEvent` 识别 10.1 / 开国大典 / 天安门 等高风险事件，返回
  `emptyReason:"uraa-excluded"` 的专用诚实占位，明确说明版权风险原因。
- 在线检索已加 URAA 黑名单，防止上线后把同类照片重新捡回产品。
- 这是「已核验的固定策展素材 + 受限网络兜底」，不是为每个事件预生成内容；上线 Vercel 后其余事件由在线检索自动补全。

---

## 六、Vercel 上线行为（为什么"现在不能访问不要紧"）

沙箱网络不可达时，除 9·11 策展集外的事件会返回 `mode:"empty"` 的诚实占位，页面不会白屏、不会报错、不会用假画面顶替。

部署到 Vercel 后：

1. 境外网络可直连 Commons API，**同一份代码无需改动**，任意事件自动检索真实自由授权照片并轮换；
2. `s-maxage=86400` + `stale-while-revalidate=604800` 让清单在 CDN 边缘缓存，同一事件不重复打上游；
3. `GET /api/reel?debug=1` 随时探测图源可达性，上线后自检用；
4. 基址可用 `REEL_COMMONS_API` / `REEL_WIKIPEDIA_API` 覆盖，仅用于本地模拟源端到端验证；生产留空直连官方域名。

不需要 `HTTP_PROXY`（那是沙箱抓取数据的代理），Vercel 用 `fetch` 直接出网即可。

---

## 七、接口

```
GET /api/reel?q=911
GET /api/reel?q=10.1     → URAA 风险已排除，返回 emptyReason:"uraa-excluded" 专用占位
GET /api/reel?title=Apollo%2011%20Moon%20Landing&year=1969&place=Houston&lat=29.55&lon=-95.1&lang=zh
GET /api/reel?debug=1
```

返回 `ReelManifest`（字段见 `lib/reel/types.ts`，`version: 2`）：
`mode` / `event` / `slides[]` / `slideMs` / `disclosure` / `badge` / `attributions[]` / `sources[]` / `offline`。
`sources[]` 逐源报告 `ok | empty | filtered | unreachable`，便于排查「为什么这个事件暂无照片」。

前端入口（**全站统一一个**）：

- 首页 CTA「看史料幻灯片 / View the slideshow」→ `/reel.html`
- `/explore` 面板按钮（任意日期）→ 当前选中 / 当天首个事件
- `/explore` 每个事件卡片右侧 ▤ → 该事件独立检索自由授权照片并轮换
- `/reel.html?q=10.1`、`?q=911`、`?e=<title>&y=<year>&lat=…&lon=…` 自动飞往事发地并开始轮换

---

## 八、成本模型

| 项 | 预生成视频方案 | 本方案 |
|---|---|---|
| 存储 | N 个 MP4（数 GB～TB） | 0 个视频文件；3 张公有领域缓存照片（约 0.8 MB） |
| 转码算力 | 每个事件一次 | 0 |
| 首次访问 | 命中/回源 | 1～3 次 Commons 检索（并发），之后 CDN 缓存 |
| 素材流量 | 服务器承担 | 同源小图 / 上游 CDN 承担 |
| 新增事件 | 需要重新生成 | 无需任何操作，检索即用 |

---

## 九、已知限制与法务

1. **URAA 复核已完成（2026-11-06）**：1949 组 PD-China 判定为高风险并整体移除；在线检索加黑名单；对应事件显示专用诚实占位。**项目内已无在美国版权状态存疑的素材**。9·11 组为美国联邦政府作品（PD-USGov），无此争议。详见 credits 文档第一节。
2. **URAA 过滤是保守策略**：`PD-China-1996` / `PD-China-expired`（1945 年前进公版）在美国其实安全，但 `extmetadata` 不足以可靠区分，一律不放行，代价是老中国照片命中率降低。
3. **老事件可能没有自由授权照片**：如实 `empty` 占位，靠上线后的在线检索解决，不靠生成假画面。
4. **检索相关性**：目前用「标题 + 年份 + 地点」多组查询 + Wikipedia 解析英文标题；对中文事件名可再加 Wikidata 标签翻译。
5. **肖像权 / 商标权**：含可识别人物的史料照片，商用可能需额外同意，与著作权分开判断。
6. **无任何原始音轨**：幻灯片不配音，不用合成音冒充历史现场音。

---

## 十、本次变更记录（删除清单）

| 已删除 | 说明 |
|---|---|
| `public/reel/history-1949-real.mp4` | 1949 央视原始纪录片胶片，唯一需商用授权的资产 |
| `docs/REEL-1949-LICENSE.md` | 该胶片的授权状态文档 |
| `public/reel/fixtures/*.svg` | 自绘矢量示意（离线演示素材） |
| `lib/reel/commons-curated.ts` | 旧的 1949 单组策展 |
| `public/reel/slides/1949-*.jpg`（3 张） | PD-China，美国 URAA 版权恢复风险，2026-11-06 复核后整体移除 |
| workspace 顶层 `*.mp4` / `reel-ai.html` / `history-reel.html` 等 | 含该胶片或 AI 写实视频的独立成品 |
| 代码中的 `<video>` / Blob / HLS / footage / 三镜 10 秒 / Ken Burns / schematic / `?fixture=1` / `?commons=1` | 全部移除，统一为照片幻灯片 |

`REEL-1949-LICENSE.md` 中提及的授权渠道（中央新影集团等）**本项目已不再使用**，因为相关素材已彻底移除。
