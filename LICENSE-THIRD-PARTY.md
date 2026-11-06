# 第三方数据与开源组件许可说明（套餐 B · 免费商用）

Historia Globe 的"真实地球（β）"视图使用以下数据源与开源组件。本项目为个人 SaaS，全部采用**可免费商用、无需付费 API、无需 token**的来源。地面影像与 3D 建筑瓦片均经本站 `/api/imagery`、`/api/tiles` **同源代理**按需转发，移动端无需直连上游域名；代理仅转发字节流并做内存缓存，不批量抓取、不落盘成自有数据集。

> ⚠️ 本文是基于各许可证原文条款的审慎合规说明（AI 生成，非执业律师意见）。个人 SaaS 量级可直接据此执行；若产品做到大体量或涉及融资/并购，建议换取执业律师的正式意见。

## 一、渲染引擎与依赖

| 组件 | 许可证 | 商用 | 备注 |
|---|---|---|---|
| **CesiumJS** | Apache License 2.0 | ✅ 免费商用 | 3D 地球渲染引擎；保留 LICENSE / NOTICE，无 copyleft、含专利授权。自托管于 `public/cesium/`。 |
| **@mapbox/vector-tile** | MIT | ✅ | 解析 MVT 矢量瓦片。 |
| **pbf** | BSD-3-Clause | ✅ | MVT 底层解码。 |

## 二、地理数据 / 影像（全部免费商用）

| 数据 | 许可证 | 署名要求 | 获取方式 | 备注 |
|---|---|---|---|---|
| **Esri World Imagery**（唯一地面影像，z0–z19 连续铺满） | Esri / ArcGIS Online 服务条款 | **必须**：`© Esri` | 经本站 `/api/imagery` 同源代理按需转发单张瓦片 | 从全球到街道级无缝，替代早期自绘瓦片拼贴 |
| **Natural Earth**（国界 / 城市点） | 公共领域 | 无 | `countries.geojson` / `cities.json` 随仓库 | 无墙、可商用 |
| **NASA Blue Marble**（经典地球贴图 / 备用素材） | NASA 影像政策（NASA 不主张版权） | 建议署名 "NASA" | 随仓库静态贴图 | 仅经典地球视图使用；Cesium 视图已不再叠该贴图 |
| **OpenFreeMap**（OSM 矢量瓦片；低空 3D 建筑源） | 服务代码 MIT；地图数据 **ODbL 1.0** | **必须**：`© OpenMapTiles` + `© OpenStreetMap contributors` | 经本站 `/api/tiles` 同源代理流式转发，免 key/免注册/无请求上限 | 官方明确 "Is commercial usage allowed? **Yes**." |
| **OpenStreetMap**（建筑轮廓与 `render_height`） | **ODbL 1.0** | `© OpenStreetMap contributors` | 经 OpenFreeMap 瓦片流式读取 | 见下文合规说明 |

> **为何要同源代理**：① OpenFreeMap 的 TileJSON 瓦片模板带数据版本戳（`.../planet/<stamp>/{z}/{x}/{y}.pbf`），不带戳的旧路径会返回 0 字节；② Esri / Carto 等上游域名在移动网络常不可达，直连还有 CORS 问题。`app/api/tiles/route.ts` 与 `app/api/imagery/route.ts` 在服务端解析模板 / 按需转发单张瓦片并长期缓存，浏览器只请求本站域名。这属于对同一公开数据源的**接入通道优化**，不改变数据来源与许可义务。
>
> ⚠️ Esri 服务条款对瓦片缓存 / 再分发可能有约束：本项目仅**按需转发单张瓦片**、不批量抓取、不落盘成自有影像数据集，并保留 `© Esri` 署名。若未来产品做到大体量或需离线分发，请复核 Esri 最新条款，或改用自有 / 付费影像源（如 MapTiler、Cesium ion 商用层）。

## 三、低空 3D 建筑（OSM / ODbL）合规说明 —— 已启用

地面由连续 Esri 卫星影像铺满（满屏同一张图）；`lib/osm-buildings.ts` **仅在相机低于 3km** 时，从 OpenFreeMap **实时流式读取** `building` 层，按 `render_height` 挤出 3D 建筑体块作为叠加层。

> 早期版本逐瓦片自绘街道线 / 水面 / 绿地 / 瓦片底板矩形，中高空缩放时瓦片边界、数据截断与空白间隙形成"拼图"观感，已全部移除；街道、水面、绿地现在直接由连续影像呈现。

**为什么这样合规（法务结论）：**

ODbL 的 share-alike（相同方式共享）只约束"数据库的分发"，不约束软件代码或渲染出的图像：

1. **Produced Work 不传染**：把 OSM 建筑实时渲染成 3D 图像展示给用户，属 ODbL 项下的 **Produced Work（产出物）**，不受 share-alike 约束，不会要求开源本 SaaS 源码。
2. **不落盘打包、不形成衍生数据库再分发**：我们不把 OSM 建筑预处理成自有 3D Tiles 静态资产对外分发/提供下载，避免触发 ODbL 第 4.2 条"衍生数据库再分发"义务。
3. **署名已落实**：页面署名条含 `© OpenMapTiles` 与 `© OpenStreetMap contributors`（OpenFreeMap 官方要求的替代客户端署名）。
4. **服务可商用**：OpenFreeMap 官方 FAQ 明确商业使用允许；其公开实例无注册、无 API key、无请求上限、无 cookie。

> 若未来把 OSM 建筑打包成自有 3D Tiles 资产托管分发，则须按 ODbL 以相同许可单独提供该数据集（仅该数据集，不涉及 SaaS 源码）。当前未这样做。

## 四、关于 Cesium ion 免费层的重要澄清（为何不用它做建筑）

Cesium 官方的 `createOsmBuildingsAsync()`（OSM Buildings 3D Tiles，3.5 亿栋建筑）走 **Cesium ion**。查询 Cesium 官方定价页确认：

- **Community（免费）层条款为 "Personal and non-commercial use"（仅限个人 / 非商用 / 评估）**；
- 商业使用需 **Commercial 层（$149/月起，individual）**。

因此，**"免费注册 ion token 拿 OSM Buildings"并不能免费商用**——这正是本项目核心诉求的红线，故不采用。数据（OSM/ODbL）本身可商用，但 ion 这条**通道**的免费层禁止商用，二者须区分。本项目改用上文 OpenFreeMap 免鉴权通道，规避该限制。

本项目**不依赖任何 Cesium ion 付费层或付费 API**（Google Maps Platform 等同样未用）。真实 3D 地形目前为可选：`NEXT_PUBLIC_CESIUM_ION_TOKEN` 留空时用平滑椭球；填入自有付费/商用 ion token 才启用世界地形。

## 五、已落实的署名（页面 + 代码）

- 探索页底部署名条（真实地球激活时）：`© Esri World Imagery · © OpenMapTiles · © OpenStreetMap contributors (ODbL) · OpenFreeMap · Natural Earth · CesiumJS`；完整署名（含 Esri 代理说明、ODbL 流式渲染说明）放在该元素的 `title` 中，桌面端可悬停查看。
- **Cesium 自带 credit 容器已主动隐藏**：Cesium Viewer 默认显示的 "Cesium ion" 水印会误导用户以为项目依赖 ion 服务（本项目不依赖任何 ion 资源，且 ion 免费层禁商用）。隐藏后由上条自定义署名条**统一承担全部署名义务**，来源覆盖完整，无遗漏。
- 城市中文译名（`scripts/gen-city-zh.mjs`）：地名译名属事实性数据，不受版权保护，可自由商用。
- 本文件作为第三方许可集中声明，随仓库分发。

## 六、维护者义务清单

- [x] 页面署名条（含 Esri / OSM / OpenMapTiles）
- [x] LICENSE-THIRD-PARTY.md（本文件）
- [x] 3D 建筑采用免 token、免鉴权、可商用源（OpenFreeMap）
- [x] OSM 仅流式渲染、不落盘打包（代理仅转发字节流并做内存缓存，不持久化）
- [x] 澄清 Cesium ion 免费层禁商用，项目不依赖其付费层；隐藏误导性的 ion 水印
- [x] 3D 建筑瓦片经本站 `/api/tiles` 同源代理，移动端无需直连上游域名
- [x] 地面影像经本站 `/api/imagery` 同源代理，连续铺满、按需转发、不批量抓取/不落盘
- [x] 移除逐瓦片自绘色块，消除中高空"拼图"观感
- [x] 「此刻此地」地面图源（Pexels / Panoramax）许可与署名已登记（见 §七）
- [x] 当地时钟改用服务端真实时刻 + IANA 时区，避免 15 分钟观测时次导致分钟偏差

> 注意：署名条一行显示为缩短版，若后续接入更多第三方图层，须同步更新短版、`title` 完整版及本文件。

## 七、「此刻此地 / Right Now」数据源 —— 已启用

产品理念：Historia Globe 不只是「对话历史」，也要「活在当下」。用户点开按钮，看到该地点**现在从地面看是什么样**（真实地面实景照片），以及**这一刻**的当地时间、昼夜、天气，与卡片里的历史事件古今同框。
典型场景：**1949-10-01 开国大典 → 今天的天安门城楼**，而不是卫星俯视图。

图片采用**三级图源、逐级回退**，全部经本站 `/api/now` 同源代理（浏览器不直连任何上游域名）：

| 级别 | 数据 | 许可证 | 署名要求 | 获取方式 | 备注 |
|---|---|---|---|---|---|
| **L1 地标实景** | Pexels 照片（天安门广场 / 自由女神像 / 东京） | **Pexels License** | 不强制（本项目仍保留 credit） | `lib/landmarks.ts` 只存数字 ID，服务端构造 CDN 直链 → `/api/now?part=groundimg` 同源转发 | 按事件地点名 / 坐标匹配地标；「该地点今天的地面照片」，**非实时摄像头、非历史影像** |
| **L2 地面街景（通用层）** | Panoramax 开源街景，按任意坐标检索附近真实地面照片 | **CC BY-SA 4.0** | **必须**：作者 + Panoramax + 许可链接 + 拍摄日期 | `/api/now?part=ground` 四级 bbox 并发（约 450m / 1.3km / 3.3km / 8km），近处候选不足再补 16km / 33km；按距离 + `view:azimuth` 拍摄朝向全局评分，**只保留 3km 内**的候选，跨实例取最多 6 个 | **所有历史事件共用这一层**，不再依赖手工地标表。3km 质量闸避免用十几公里外无关照片凑数；海上 / 无众包覆盖地区仍可能为空 → 转 L3 |
| **L3 卫星俯视** | Esri World Imagery（MapServer/export 静态导出） | Esri / ArcGIS Online 服务条款 | **必须**：`© Esri` | `/api/now?part=photo` 按需导出单张 900×620 连续影像 | 永远可用的兜底，用户可手动切换 |
| **实时信息** | Open-Meteo（当地时间 / 昼夜 / 天气） | **CC BY 4.0** | **必须**：`Open-Meteo (CC BY 4.0)` | `/api/now?part=meta` 同源代理 | 官方明确免费商用、无需 key |
| **地名** | Natural Earth cities.json | 公共领域 | 无 | 本地文件 | 最近城市中英名 |

**关于「所有历史事件」的通用化（重要）**：早期只有 3 个硬编码地标能吃上地面实景，其余事件点开「此刻此地」几乎都落到卫星俯视。现改为**按坐标检索附近真实地面街景**，任意历史事件坐标走同一条链路；`lib/landmarks.ts` 只作为「最著名地点的高质量正面照」优先命中，不再是覆盖前提。用 18 个真实事件坐标实测：14 个拿到贴近的地面实景（12 街景 + 2 地标）；4 个没有（大洋中的沉船点、草原上的航天城、发射场、海港）→ 回退 L3 并说明原因。
**质量优先于凑数**：远半径确实能再「救回」2 个地点，但实测拿到的分别是 12.3km / 19.3km 外的一根电线杆与树冠、普通街道，与事件地点毫无关系，观感反而比卫星俯视更差。因此设 **3km 距离闸**，超出即不采用，绝不用无关照片冒充「这个地点现在的样子」。宁可诚实显示卫星 + 说明「暂无贴近的地面街景」，也不牺牲真实感。

**图片传输修正（重要）**：Panoramax 图片 CDN 在部分网络 10s+ 超时，多个候选串行等待曾累计到 **26.9s**，前端等不到图就自动回退卫星——这正是「其它事件看起来还是卫星图」的根因。现改为**多候选并发竞速**：每个候选同时发 `wsrv.nl` 代理与直连，谁先返回有效图片用谁（实测平均 **1.2s**、14/14 成功）；服务端对代理只访问固定域名，直连 URL 经 host 白名单（`images.pexels.com` / `panoramax.*` / `*.openstreetmap.fr`），首个成功后中止其余在途请求；图片按 `k:i` 做 1 小时服务端短缓存（上限 80 张）。**代理仅作传输层，不改变图片版权、许可与署名义务**，卡片仍逐图显示作者、拍摄日期与许可。

**关于时间的修正（重要）**：Open-Meteo 的 `current.time` 是 **15 分钟对齐的观测时次**（如 12:45），并非墙钟时间，早期版本直接显示它，导致与手机时间相差最多 15 分钟。现改为：服务端用**真实当前时刻**按 `wx.timezone`（IANA，如 `Asia/Shanghai`）通过 `Intl.DateTimeFormat` 计算当地日期与时分，返回 `serverNow`；前端以 `serverNow` 为基准**每秒走字**显示 `HH:mm:ss`，既与手机一致、也不受设备时钟不准影响。Open-Meteo 只用于天气、昼夜与时区名。

**合规要点：**

1. **Pexels License**：允许免费商用、可用于网站与产品、可裁剪；不要求署名（本项目仍标注 `Pexels · Pexels License`）。禁止把照片本身转售、或另建竞品图库；本项目仅在对应历史地点展示这些照片，不构成竞品图库，也不是「打包分发照片数据集」。
2. **Panoramax CC BY-SA 4.0**：卡片显示作者、来源、拍摄日期与许可；share-alike 只约束**衍生作品**，本项目仅展示原图、不修改后再分发，不触发源码开源义务。图片由服务端按需转发、不落盘成自有数据集。
3. **诚实标注实时性**：所有地面照片都是「该地点近期真实实景」，**不是实时街景摄像头，也不是历史影像**；真正的「此刻」由当地时间、昼夜与实时天气承担。卡片正文、图片角标、底部说明三处均已如实标注。
4. **Esri** 仍为按需转发单张图 + 短期缓存、不批量抓取、不落盘；`© Esri` 署名在图片角标、卡片底部与页面署名条体现。§二 的条款提醒继续适用（大体量 / 离线分发前复核或换自有 / 付费影像源）。
5. **Open-Meteo CC BY 4.0** 署名已落在卡片底部与页面署名条。
6. **SSRF 与滥用防护**：图片 `k` 只接受白名单枚举 key（`lm:` 地标 / `pm:` 内存缓存 uuid），图片 URL 全部由服务端常量或内存缓存生成，**不接受用户输入的域名**；经纬度为数值化并夹取范围、12s 超时、3MB 响应上限、图片 `content-type` 校验；Panoramax 候选缓存上限 300 条并定期清理。
7. **图源筛选过程（可追溯）**：Wikimedia Commons / Wikipedia / Wikimedia REST / Openverse / Flickr 在目标网络**全部超时不可达**；`api.allorigins.win`、`api.codetabs.com`、`cors.isomorphic-git.org`、`thingproxy`、`api.cors.lol` 等公共 API 代理实测均失败或限流（500 / 522 / 403 / 429），**不能作为运行时依赖**；`wsrv.nl` 可稳定代理 Wikimedia / Panoramax 图片（仅图片、不能代理 JSON API）；Pexels 主站有 Cloudflare 挑战（CDN 按 ID 可达）；Unsplash 主站有反爬；Mapillary 需 token；Google Street View 付费且大陆不可用 —— 以上检索型源**均未采用**。最终选用 Pexels（地标，CDN 可达）+ Panoramax（通用街景，API 可达）两个可免费商用源，加 Esri 兜底。若日后部署到境外网络（如 Vercel），Wikimedia Commons 直连可达，可再加一层「按坐标检索地标正面照」，但须逐图解析许可、过滤 NC/ND 并署名。
8. **距离透明与不凑数**：远半径救回的街景可能离事件点十几公里，卡片在图片说明中标出「照片取自约 X km」，副标题同时显示真实距离，不会把「附近街景」伪装成「就拍在事件坐标上」。物理上没有街景的地点如实回退 L3 卫星并说明原因，**不用无关示意图凑数**（避免把示意照片误导为该地点实景）。

**维护者义务清单（本节）：**

- [x] 卡片与页面署名含 `Pexels`、`Panoramax (CC BY-SA 4.0)`、`© Esri`、`Open-Meteo (CC BY 4.0)`
- [x] Panoramax 作者 / 拍摄日期 / 许可链接可见
- [x] 如实标注「近期真实地面照片，非实时摄像头、非历史影像」
- [x] 当地时钟基于服务端真实时刻与 IANA 时区，不再使用 15 分钟观测时次
- [x] `/api/now` 同源代理、参数校验、URL 白名单枚举、超时 / 体积 / content-type 校验
- [x] 任意事件坐标统一走按坐标街景检索；3km 质量闸过滤无关远照，无覆盖地点如实回退卫星
- [x] 开阔海域 / 均一荒漠上游返回近乎纯色图时改回**自绘矢量示意图**，明确标注「示意，非照片」，不把示意图伪装成实景；`© Esri` 仍标注为底图来源
- [x] 图片代理 / 直连并发竞速与 host 白名单；代理仅作传输层，不改变 CC BY-SA 4.0 署名义务
- [x] 全部图标自绘矢量 SVG，未使用任何第三方素材图标

## 八、「回到那一刻」统一照片幻灯片 —— 免费授权源（已启用，无需商用授权）

> **本节素材全部为公有领域 / 自由许可，可免费商用，无需向任何权利人取得书面授权。**
> 早期版本中「1949 央视原始纪录片胶片（商用授权待取）」及其授权文档、AI 视频成品、
> 矢量示意素材**已从仓库彻底删除**，见文末变更记录。

产品形态由用户决策统一为：**所有事件的「回到那一刻」都是同一套真实照片幻灯片**，
不再有视频通道、照片配运镜、矢量示意三种混搭。原因：绝大多数历史事件不存在
当年拍摄的连续活动影像，能自由商用的更少；Commons 视频仅约 0.25% 且不支持 MP4/H.264。
架构见 [`docs/REEL-ARCHITECTURE.md`](docs/REEL-ARCHITECTURE.md)。

| 项 | 内容 |
|---|---|
| 页面 | `public/reel.html`（唯一渲染器：照片交叉淡入淡出轮换 + 上一张/下一张/暂停/重播/进度点/逐张署名） |
| 接口 | `app/api/reel/route.ts` — 只返回照片清单 JSON，**不生成、不存储任何视频** |
| 数据层 | `lib/reel/{types,sources,licenses,manifest,curated-slides}.ts` |
| 素材 | `public/reel/slides/*.jpg` 3 张本地缓存（受限网络兜底，仅 9·11 组）+ 在线检索的 Commons 自由授权照片 |

### 数据源与许可

| 源 | 接口 | 许可 | 署名义务 |
|---|---|---|---|
| **Wikimedia Commons** | `w/api.php`（`generator=search` + `imageinfo/extmetadata`） | 逐文件解析：PD / CC0 / CC BY / CC BY-SA / GFDL | **必须**：作者 + 许可名/链接 + 来源页；写入清单 `attributions` 并逐张显示 |
| **Wikipedia** | `w/api.php`（`list=search`） | 文本 CC BY-SA 4.0 | 仅用于解析规范英文标题与检索词，**不取图片** |
| **本地已核验缓存** | `public/reel/slides/*.jpg` | 仅 9·11 组 PD-USGov（NOAA / NIST / 美国海军，17 U.S.C. §105），公有领域；1949 组 PD-China 已按 URAA 复核结论移除 | 逐张署名；见 [`docs/REEL-COMMONS-CREDITS.md`](docs/REEL-COMMONS-CREDITS.md) |

**许可过滤（`lib/reel/licenses.ts`）**：放行 PD / CC0 / CC BY / CC BY-SA / GFDL 及政府公有领域标记；拒绝 NC、ND、All rights reserved、fair use、许可缺失或无法识别。CC BY-SA 的 share-alike 只约束衍生作品，本项目仅展示原图、不修改后分发，不触发开源义务，但署名必须保留。**Internet Archive 影片检索与 Commons 视频检索已移除**——全站只用照片。

**URAA 风险黑名单（2026-11-06 新增）**：另拒绝 `Not-PD-US-URAA`、任何 URAA 版权恢复提示、以及中国来源国「过期型 PD」标签（`PD-China` / `PD-PRC` / `PD-ROC` 等），即使许可名只写 "Public domain"。识别同时检查 `LicenseShortName` + `UsageTerms` + `LicenseUrl`（后者常指向 `Template:PD-China`）。理由：中国 URAA 生效日 1996-01-01，而 1990 年《著作权法》第 21 条给摄影作品「发表后 50 年」保护期，1949 年照片在 1996 年仍受保护 → 满足 17 U.S.C. §104A(h)(6) 恢复条件，恢复后美国版权约至 2044 年。完整复核与引用见 [`docs/REEL-COMMONS-CREDITS.md`](docs/REEL-COMMONS-CREDITS.md) 第一节。

### 合规要点

1. **零视频、零授权负担**：无 `<video>`、无 MP4/HLS/Blob、无音轨、无转码；项目内不再含任何「商用授权待取」的资产。
2. **统一形态与诚实标注**：`slides` 显示自由授权真实照片并逐张署名；`empty`（当前网络未检索到照片）显示诚实占位卡，明确「非历史影像」，**绝不用矢量示意、AI 生成画面或无关照片冒充史料**。不做 Ken Burns 运镜。
3. **不下载、不转码、不落盘**：在线素材由浏览器直连 `upload.wikimedia.org`，本站只取元数据与 URL；本地缓存仅为已核验的固定策展图，不是按事件批量抓取的数据集。
4. **SSRF 防护**：上游 URL 由服务端常量 + `encodeURIComponent` 拼装，不接受用户传入 URL；返回的素材 URL 经 host 白名单校验。
5. **请求礼仪**：带 `Api-User-Agent`（Wikimedia 强制）、4s 超时、超时不重试（快速失败，避免受限网络首屏等待翻倍）、进程内 1 小时短缓存、清单走 CDN `s-maxage`。
6. **URAA 复核已完成并落实**：1949 组 PD-China 在美国依 17 U.S.C. §104A 已恢复版权（约至 2044 年），判定为高风险，三张照片与策展组已整体移除；在线检索加黑名单防止复发；`10.1` 等事件返回 `emptyReason:"uraa-excluded"` 的专用诚实占位。9·11 组为美国联邦政府作品（17 U.S.C. §105），全球争议最小。含人物的照片另涉肖像权 / 商标权，商用需单独判断。依据与引用见 [credits 文档](docs/REEL-COMMONS-CREDITS.md) 第一节。
7. **Vercel 行为**：沙箱 / 受限网络不可达时返回 `mode:"empty"` 占位，不白屏、不报错；上线境外直连后任意事件自动检索真实自由授权照片，无需改代码。`GET /api/reel?debug=1` 可探测图源可达性。

## 九、维护者义务补充清单（本节）

- [x] 删除所有需商用授权资产：`public/reel/history-1949-real.mp4`、`docs/REEL-1949-LICENSE.md`、`public/reel/fixtures/*.svg`、workspace 顶层旧 MP4 / AI 视频成品
- [x] 移除 `<video>` / footage / 三镜 10 秒 / Ken Burns / schematic / `?fixture=1` / `?commons=1` 全部代码与文案
- [x] 全站统一「照片幻灯片」：首页 CTA、`/explore` 面板按钮、每个事件卡片入口指向同一渲染器
- [x] 在线检索逐条解析许可、过滤 NC/ND/版权不明、逐张署名
- [x] 本地缓存 3 张照片逐张目视确认、逐张登记来源与许可
- [x] **URAA 地域风险复核完成**：判定 PD-China 在美国版权已恢复（约至 2044 年）为高风险 → 移除 1949 组 3 张照片与策展代码，并在 `lib/reel/licenses.ts` 增加在线检索黑名单防止复发
- [x] `10.1` 等被排除事件显示专用诚实占位，明确说明版权风险原因，不伪装成网络故障
- [ ] 含可识别人物的史料照片，商用前评估肖像权 / 商标权

> 变更记录：早期第八节登记的「1949 开国大典真实史料影像（原型资产，尚未取得商用授权）」
> 及其授权渠道（中央新影集团影视资料部等）已随素材删除而作废；本项目不再使用该素材，
> 也不再需要向其取得授权。
