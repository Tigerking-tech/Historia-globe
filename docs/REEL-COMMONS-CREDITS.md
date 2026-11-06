# 真实史料照片 — 来源、许可与署名（统一幻灯片）

> 本文件对应 `public/reel/slides/` 下 6 张本地缓存照片，以及 `/api/reel` 在线检索的
> Wikimedia Commons 自由授权照片。全站统一「照片幻灯片」后，这些就是全部素材。
>
> **结论先行：项目内已无任何需要另行取得商用授权的素材**。所有照片均为
> 公有领域或自由许可（PD / CC0 / CC BY / CC BY-SA），可免费商用；已删除的
> 1949 央视原始纪录片胶片属于另一类（需书面授权），已从仓库彻底移除。

---

## 一、为什么仓库里有本地缓存

沙箱 / 受限网络下 `commons.wikimedia.org`、`en.wikipedia.org`、
`upload.wikimedia.org` 直连全部超时（实测 HTTP 000，2026-11-06），
`WebFetch` 亦 `fetch failed`；但图片字节可通过 `wsrv.nl` 图片代理取得
（项目 `/api/now` 早已使用该通道，实测 HTTP 200 返回真实 JPEG）。

因此在线检索接口在沙箱内拿不到素材，只能显示诚实占位。为让产品在任何网络下
都能真实演示「照片轮换」这一形态，缓存了两组**逐张目视确认、逐张核对许可**的
真实史料照片（合计约 1.3 MB）。它们属于「已核验的固定策展素材 + 受限网络兜底」，
不是为每个事件预生成内容；上线 Vercel 境外直连后，其余事件由在线检索自动补全。

**风格统一**：1949、9·11、任意事件都走同一个幻灯片渲染器，只有照片张数与来源不同。

---

## 二、1949 开国大典组（Wikimedia Commons · PD-China 公有领域）

| # | 本地文件 | Commons 文件页 | 内容 | 作者 | 许可 | 核验 |
|---|---|---|---|---|---|---|
| 1 | `1949-proclamation.jpg` (900×472) | [File:Founding Ceremony of People's Republic of China.jpg](https://commons.wikimedia.org/wiki/File:Founding_Ceremony_of_People%27s_Republic_of_China.jpg) | 1949-10-01 开国大典，右起董必武、赛福鼎·艾则孜、毛泽东、林伯渠在天安门城楼 | Unknown author | **PD-China**（公有领域） | 直接核验 Commons 文件页 |
| 2 | `1949-tiananmen-feb.jpg` (900×663) | [File:Tiananmen 1949.jpg](https://commons.wikimedia.org/wiki/File:Tiananmen_1949.jpg) | 1949-02-12 庆祝北平和平解放大会时的天安门城楼 | Unknown author | **Public Domain**（据 Commons 镜像标注） | ⚠️ 二手镜像，上线前须复核 |
| 3 | `1949-ji1-stamp.jpg` (900×1075) | [File:Ji1, 4-1, Beijing Tiananmen, 1949.jpg](https://commons.wikimedia.org/wiki/File:Ji1,_4-1,_Beijing_Tiananmen,_1949.jpg) | 纪1(4-1) 政协纪念邮票，1949-10-08 发行 | 张仃、钟灵（设计）／孙传哲（版图绘制） | **PD-China**（公有领域） | 直接核验 Commons 文件页 |

**对第 1 张做的唯一处理**：Commons 原图右下角带有第三方网站水印
（紫色花朵 +「你好香港 / www.miniao.hk」，来自上传者所引的转载页，非 Commons 自身标记）。
本项目把原图 900×606 **构图裁切为 900×472**，仅去掉底部含水印的一条，
人物面部与上半身完整保留；未做涂抹、修补、AI 重绘或任何内容篡改。
PD 素材允许改编，此处如实登记以便复核。

三张均为**静态照片**，播放时明确标注「真实史料照片 · 幻灯片 · 非活动影像」，
不冒充 1949 年原始纪录片胶片。

---

## 三、9·11 组（Wikimedia Commons · PD-USGov 美国联邦政府公有领域）

| # | 本地文件 | Commons 文件页 | 内容 | 作者 | 许可 | 核验 |
|---|---|---|---|---|---|---|
| 1 | `911-ground-zero.jpg` (1000×1000) | [File:Wtc-photo.jpg](https://commons.wikimedia.org/wiki/File:Wtc-photo.jpg) | 2001-09-23 NOAA 航拍世贸中心遗址（Ground Zero） | NOAA | **PD-USGov-NOAA**（公有领域） | 直接核验；Wikimedia Commons 2025-09-11 每日一图 |
| 2 | `911-site-overlay.jpg` (1000×749) | [File:World Trade Center Site After 9-11 Attacks With Original Building Locations.jpg](https://commons.wikimedia.org/wiki/File:World_Trade_Center_Site_After_9-11_Attacks_With_Original_Building_Locations.jpg) | 2001-09-23 航拍 + NIST 标注原 1–7 号楼位置（图内自带 "Credit: NOAA, September 23, 2001"） | NOAA / NIST | **PD-USGov**（公有领域） | 直接核验 Commons 文件页 |
| 3 | `911-firefighter.jpg` (900×1372) | [File:Firefigher Smoke World Trade Center New York City 9 2001.jpg](https://commons.wikimedia.org/wiki/File:Firefigher_Smoke_World_Trade_Center_New_York_City_9_2001.jpg) | 2001-09-14 消防员从世贸中心烟尘废墟中走出 | Jim Watson / U.S. Navy | **PD-USGov-Military**（公有领域） | 直接核验 Commons 文件页 |

三张依据 17 U.S.C. §105（美国联邦政府雇员职务作品）属美国公有领域，
是全球争议最小的可自由商用史料；均逐张目视确认为真实历史照片、无第三方水印。

---

## 四、许可依据与商用边界（重要）

Commons 只收自由许可 / 公有领域文件，**禁止 NC、ND、fair use**，
绝大多数允许商用。但面向**欧美市场**时，两组照片的风险等级不同：

| 组 | 许可 | 欧美商用风险 |
|---|---|---|
| 9·11 组 | PD-USGov / PD-USGov-NOAA / PD-USGov-Military | **低**。美国联邦政府作品，依 17 U.S.C. §105 在美国及绝大多数法域为公有领域 |
| 1949 组 | PD-China | **须逐张复核**。见下 |

**PD-China 的三点风险：**

1. **PD-China 不等于全球公版**。依据中国大陆著作权法（2020 修订）：
   视听作品 / 法人作品自首次发表后 50 年届满；自然人摄影作品保护期
   在 2021-06-01 前届满的属公有领域。Commons 文件页同时明确要求
   「必须另附美国公有领域标签」，并提示：
   > Works of Chinese origin ... may have had their U.S. copyright restored
   > under the Uruguay Round Agreements Act (URAA) ... For the PRC,
   > the URAA took effect on January 1, 1996.
2. **不采用较短期限规则的国家可能不认 PD-China**：Commons 文件页点名
   墨西哥 100 年、瑞士与美国 70 年等保护期更长的法域，
   "this work might not be in the public domain" in those countries。
3. **逐文件判断**：Commons 明确声明 WMF 不对版权状态作担保（no warranty），
   需自行核实；CC BY / BY-SA 文件须保留原作者署名（不是上传者）、
   许可名与链接；有人物的照片还涉及肖像权 / 商标权，商用需额外同意。

**结论**：这 6 张作为原型 / 内部演示与免费商用素材可用；正式面向欧美收费运营前，
建议由法务复核 1949 组的 URAA 状态与法域差异，或把该组替换为明确标注
`CC0` / `PD-US` / `PD-1996` 的同类史料。1949 第 2 张许可依据为二手镜像，
优先级最高、必须先复核。**这些属于「公有领域地域差异的法务复核」，不是「需要向权利人购买商用授权」**——后者涉及的 1949 央视纪录片胶片已从项目彻底删除。

**在线检索的照片**：`lib/reel/licenses.ts` 逐条解析 `extmetadata`，
只放行 PD / CC0 / CC BY / CC BY-SA，剔除 NC / ND / 版权不明，
并把作者 + 许可 + 来源页写入清单逐张署名。CC BY-SA 的 share-alike 只约束衍生作品，
本项目仅展示原图、不修改后分发，不触发开源义务，但署名必须保留。

---

## 五、为什么是照片而不是视频

| 素材类型 | Wikimedia Commons 是否有 | 本项目处理 |
|---|---|---|
| 历史**照片** | **有**。1949 开国大典分类至少 24 个文件；9·11 有大量 NOAA / NIST / 军方公版照片 | 全站统一用照片幻灯片轮换 |
| 当年拍摄的**连续活动影像** | **基本没有**。Commons 视频仅约 36 万（占 1.4 亿文件约 0.25%），且强制 WebM / Ogg Theora / MPEG-1/2，不支持 MP4 / H.264 | 不使用。1949 央视原始纪录片胶片（需商用授权）**已从项目删除**；不再有任何视频通道 |

CCTV / 中央新影保存的 1949 原始纪录片胶片受邻接权与平台播放版本权利约束，
不属于 Commons 的自由许可素材。用户据此决定：既然只有真实照片，
就把整个项目统一成幻灯片，不再混用视频 / 照片配运镜 / 矢量示意。

---

## 六、上线后的行为

- Vercel 境外节点直连 Commons API 可达 → `buildManifest` 在线检索
  自由授权照片，逐条过滤许可、逐张署名，返回幻灯片清单。
- 两组本地缓存照片**只在对应事件命中**（`matchCuratedSet`），
  不会给不相干事件配错史料，也不会被当作「所有事件都有当年视频」的证据。
- `GET /api/reel?debug=1` 可自检图源连通性；网络不可达时返回
  `mode:"empty"` 的诚实占位，绝不用矢量示意或生成画面顶替。
- 播放器逐张显示 `caption`（作者 · 许可 · 来源 · Commons 文件页），
  控制条常驻显示素材性质与许可说明。
