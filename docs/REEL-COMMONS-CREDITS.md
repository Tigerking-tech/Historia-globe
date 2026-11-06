# 真实史料照片 — 来源、许可与署名（统一幻灯片）

> 本文件对应 `public/reel/slides/` 下 **3 张**本地缓存照片，以及 `/api/reel` 在线检索的
> Wikimedia Commons 自由授权照片。全站统一「照片幻灯片」后，这些就是全部素材。
>
> **结论先行：项目内已无任何需要另行取得商用授权、或在美国版权状态存疑的素材。**
> 1949 央视原始纪录片胶片（需书面授权）与 1949 开国大典组 `PD-China` 照片
> （美国 URAA 版权恢复风险）均已从仓库彻底移除。

---

## 一、URAA 地域风险复核（2026-11-06，结论：风险高，已移除）

用户要求复核 `PD-China` 的美国 URAA 地域风险，并明确「风险高就不用 PD-China 的数据」。
复核结论是**风险高且明确**，不是理论上的边角争议，因此 1949 组三张照片整体移除。

### 1. 美国法：URAA 恢复了哪些外国作品的版权

[美国版权局 Circular 38B](https://copyright.gov/circs/circ38b.pdf) 列出 `17 U.S.C. §104A`
的四项恢复条件，其中两项与本案直接相关：

- 作品**在来源国未因保护期届满进入公有领域**（"The work is not in the public domain
  in the eligible source country through expiration of the term of protection"）；
- 作品在美国进入公有领域是因为**未履行美国手续**或**缺乏版权关系**
  （"lacked national eligibility in the United States"）。1949 年中美之间尚无版权条约关系，
  正好属于后者。

恢复日期对大多数国家为 **1996-01-01**；[Commons:URAA-restored copyrights](https://commons.wikimedia.org/wiki/Commons:URAA-restored_copyrights)
明确列出中国大陆的 URAA 日期为 1996-01-01。恢复后期限：

> 对于 1930–1977 年间发表的作品，恢复为「自首次发表起 **95 年**」的美国版权期限。

2012 年最高法院 [Golan v. Holder](https://en.wikipedia.org/wiki/Golan_v._Holder) 判决确认
URAA 合宪；此后 Commons 的政策是：若对文件在美国或当地法律下的自由性存在
**重大疑问（significant doubt）**，按预防原则删除。

### 2. 中国法：1996 年时这些照片在中国仍受保护

[1990 年《著作权法》第 21 条](https://www.gov.cn/gongbao/shuju/1990/gwyb199020.pdf)
（国务院公报 1990 年第 20 号）原文：

> 电影、电视、录像和**摄影作品**的发表权、使用权和获得报酬权的保护期为**五十年**，
> 截止于作品首次发表后第五十年的 12 月 31 日。

1949 年发表的照片 → 保护至 **1999-12-31**。也就是说，在中国 URAA 生效日
**1996-01-01 当天，这些照片在中国仍在版权期内**，第 1 项恢复条件成立。
（[现行《著作权法》](http://www.npc.gov.cn/npc///c2/c12435/c12488/201905/t20190522_66009.html)
第 65 条规定摄影作品保护期不溯及既往，以 2021-06-01 为节点，不改变上述判断。）

由此推算：1949 年发表的开国大典照片，其在美国的恢复版权约持续到
**2044-12-31**（1949 + 95），即距今仍有近 20 年。

### 3. Commons 官方规则与正在发生的提删

[Commons:Copyright rules by territory/China](https://commons.wikimedia.org/wiki/Commons:Copyright_rules_by_territory/China)
的摄影作品表格把分界线画得非常清楚：

| 情形 | 标签 | 美国版权状态 |
|---|---|---|
| 1930 年前发表，1980 年前在中国进公版 | `PD-China-expired` + `PD-US-expired` | 美国确定无版权（1931 年前发表绝对公版，URAA 不改变） |
| 1945 年底前在中国进公版 | `PD-China-1996` + `PD-1996` | 美国版权**未**被 URAA 恢复 |
| **1946–1953 年作品** | **`Not-PD-US-URAA`** | **美国版权已被恢复** |
| 其余 | — | "The work is still protected under China law and/or URAA" |

[`Template:PD-PRC`](https://commons.wikimedia.org/wiki/Template:PD-PRC) 与 `PD-China` 模板
自己也要求上传者「**必须另附一个美国公有领域标签**」，并提示中国作品可能因 URAA 恢复版权。
我们此前登记的三张 1949 照片**只有 `PD-China`，没有美国 PD 依据**。

更直接的证据是 Commons 当前正在执行这一判断：2026 年 4 月，
[1953 年毛泽东谒中山陵照片](https://commons.wikimedia.org/wiki/File:Mao_Zedong_visiting_Sun_Yat-Sen%27s_Mausoleum_in_1953.jpg)
与 [1953 年徐州站照片](https://commons.wikimedia.org/wiki/File:Mao_Zedong_at_Xuzhou_Station_1953.jpg)
被提删，理由原文均为：

> Not PD in the US; only works that were PD in China at the URAA date are PD in the US
> (so 1945 or before).

同一时期的 [1949-10-01《人民日报》图](https://zh.wikisource.org/wiki/File:People%27s_daily_1_Oct_1949.jpg)
也明确标注「此作品在美国不属于公有领域，因为根据 URAA……其美国境内的版权得以回溯」。

### 4. 结论与处置

| 判断 | 结论 |
|---|---|
| 这些照片在中国是否公有领域 | **是**（1999 年底届满），`PD-China` 标签本身没错 |
| 在美国是否可自由商用 | **否**。URAA 恢复版权约至 2044 年，面向美国市场的商业 SaaS 属高风险 |
| Commons 是否认可其在美国的自由性 | **否**，1946–1953 区间要求 `Not-PD-US-URAA`，且正在提删 |
| 本项目能否靠「合理使用」抗辩 | 不作此假设：产品是面向公众的收费订阅服务，不是评论/教学 |
| 有无美国无争议的替代素材 | **未找到**。检索到的 1949 开国大典照片均为新华社等中国来源 + `PD-China` |

**处置（已执行）**：

1. 删除 `public/reel/slides/1949-proclamation.jpg`、`1949-tiananmen-feb.jpg`、
   `1949-ji1-stamp.jpg` 三张照片；
2. `lib/reel/curated-slides.ts` 移除 1949 策展组，只保留 9·11 组；
3. `lib/reel/licenses.ts` 新增 **URAA 风险标签黑名单**，在线检索也不会把同类照片捡回；
4. `10.1` / 开国大典 / 天安门 等事件由 `isUraaExcludedEvent` 生成**专用诚实占位**
   （`emptyReason: "uraa-excluded"`），明确说明是版权风险排除，不是网络故障；
5. 相关文档与合规清单同步更新。

注意：这不是「需要向权利人购买商用授权」的问题（那是已删除的央视胶片），
而是**公有领域在不同法域不自动通用**的问题。移除是主动合规，不代表原标签造假。

---

## 二、为什么仓库里有本地缓存

沙箱 / 受限网络下 `commons.wikimedia.org`、`en.wikipedia.org`、
`upload.wikimedia.org` 直连全部超时（实测 HTTP 000，2026-11-06），
`WebFetch` 亦 `fetch failed`；但图片字节可通过 `wsrv.nl` 图片代理取得。

因此在线检索接口在沙箱内拿不到素材，只能显示诚实占位。为让产品在任何网络下
都能真实演示「照片轮换」这一形态，缓存了 **9·11 组 3 张**逐张目视确认、逐张核对许可的
真实史料照片（合计约 0.8 MB）。它们属于「已核验的固定策展素材 + 受限网络兜底」，
不是为每个事件预生成内容；上线 Vercel 境外直连后，其余事件由在线检索自动补全。

**风格统一**：9·11、10.1、任意事件都走同一个幻灯片渲染器，只有照片张数与来源不同。

---

## 三、9·11 组（Wikimedia Commons · PD-USGov 美国联邦政府公有领域）

| # | 本地文件 | Commons 文件页 | 内容 | 作者 | 许可 | 核验 |
|---|---|---|---|---|---|---|
| 1 | `911-ground-zero.jpg` (1000×1000) | [File:Wtc-photo.jpg](https://commons.wikimedia.org/wiki/File:Wtc-photo.jpg) | 2001-09-23 NOAA 航拍世贸中心遗址（Ground Zero） | NOAA | **PD-USGov-NOAA** | 直接核验；Wikimedia Commons 2025-09-11 每日一图 |
| 2 | `911-site-overlay.jpg` (1000×749) | [File:World Trade Center Site After 9-11 Attacks With Original Building Locations.jpg](https://commons.wikimedia.org/wiki/File:World_Trade_Center_Site_After_9-11_Attacks_With_Original_Building_Locations.jpg) | 2001-09-23 航拍 + NIST 标注原 1–7 号楼位置（图内自带 "Credit: NOAA, September 23, 2001"） | NOAA / NIST | **PD-USGov** | 直接核验 Commons 文件页 |
| 3 | `911-firefighter.jpg` (900×1372) | [File:Firefigher Smoke World Trade Center New York City 9 2001.jpg](https://commons.wikimedia.org/wiki/File:Firefigher_Smoke_World_Trade_Center_New_York_City_9_2001.jpg) | 2001-09-14 消防员从世贸中心烟尘废墟中走出 | Jim Watson / U.S. Navy | **PD-USGov-Military** | 直接核验 Commons 文件页 |

三张依据 17 U.S.C. §105（美国联邦政府雇员职务作品）属美国公有领域，
是全球争议最小的可自由商用史料；均逐张目视确认为真实历史照片、无第三方水印。
三张均为**静态照片**，播放时明确标注「真实史料照片 · 幻灯片 · 非活动影像」。

---

## 四、许可过滤与在线检索的防复发

`lib/reel/licenses.ts` 逐条解析 Commons `extmetadata`，只放行
PD / CC0 / CC BY / CC BY-SA / GFDL，剔除 NC / ND / All rights reserved / fair use / 许可不明，
并把作者 + 许可 + 来源页写入清单逐张署名。

**URAA 复核后新增一层黑名单**：凡出现 `Not-PD-US-URAA`、任何 URAA 恢复提示、
或中国来源国「过期型 PD」标签（`PD-China` / `PD-PRC` / `PD-ROC` 等）的文件一律拒绝，
即使 `LicenseShortName` 只写着 "Public domain"。识别时同时检查
`LicenseShortName` + `UsageTerms` + **`LicenseUrl`**（后者常指向 `Template:PD-China`，
是唯一可靠线索）。被拦下的数量会写进 `sources[].detail` 的 `uraa-filtered=N`，便于观测。

采取保守策略：`PD-China-1996` / `PD-China-expired`（1945 年前进公版，在美国其实安全）
也同样不放行——`extmetadata` 不足以可靠区分发表年份，对面向欧美的商业 SaaS
宁可少命中，也不把有争议的照片放进产品。

CC BY-SA 的 share-alike 只约束衍生作品，本项目仅展示原图、不修改后分发，
不触发开源义务，但署名必须保留。

---

## 五、为什么是照片而不是视频

| 素材类型 | Wikimedia Commons 是否有 | 本项目处理 |
|---|---|---|
| 历史**照片** | **有**。9·11 有大量 NOAA / NIST / 军方公版照片 | 全站统一用照片幻灯片轮换 |
| 当年拍摄的**连续活动影像** | **基本没有**。Commons 视频仅约 36 万（占 1.4 亿文件约 0.25%），且强制 WebM / Ogg Theora / MPEG-1/2，不支持 MP4 / H.264 | 不使用。1949 央视原始纪录片胶片（需商用授权）**已从项目删除**；不再有任何视频通道 |

CCTV / 中央新影保存的 1949 原始纪录片胶片受邻接权与平台播放版本权利约束，
不属于 Commons 的自由许可素材。用户据此决定：既然只有真实照片，
就把整个项目统一成幻灯片，不再混用视频 / 照片配运镜 / 矢量示意。

---

## 六、上线后的行为

- Vercel 境外节点直连 Commons API 可达 → `buildManifest` 在线检索自由授权照片，
  经许可过滤 + URAA 黑名单后返回幻灯片清单。
- 本地缓存照片**只在对应事件命中**（`matchCuratedSet`），不会给不相干事件配错史料。
- `10.1` / 开国大典等事件：不配本地照片；在线检索若仍只命中 URAA 风险素材，
  返回 `emptyReason: "uraa-excluded"` 的专用诚实占位，明确说明版权风险原因。
- `GET /api/reel?debug=1` 可自检图源连通性；网络不可达时同样返回诚实占位，
  绝不用矢量示意或生成画面顶替。
- 播放器逐张显示 `caption`（作者 · 许可 · 来源 · Commons 文件页），
  控制条常驻显示素材性质与许可说明。

---

## 七、已移除素材清单

| 移除对象 | 原因 |
|---|---|
| `public/reel/history-1949-real.mp4`、`docs/REEL-1949-LICENSE.md` | 1949 央视纪录片胶片，需向权利人取得商用授权 |
| `public/reel/slides/1949-*.jpg`（3 张） | `PD-China`，美国 URAA 版权恢复风险（本文件第一节） |
| `public/reel/fixtures/*.svg` | 自绘矢量示意，不能冒充史料 |
| `lib/reel/commons-curated.ts` | 旧的 1949 单组策展 |
| workspace 顶层旧 MP4 / AI 视频成品 | 含需授权胶片或 AI 写实视频 |

`REEL-1949-LICENSE.md` 中提及的授权渠道（中央新影集团等）**本项目已不再使用**。

---

## 八、剩余已知边界

- **肖像权 / 商标权**：含可识别人物的史料照片，商用可能需额外同意，与著作权分开判断。
- **欧盟法域**：PD-USGov 在美国确定自由，个别不适用较短期限规则的法域仍可能有差异；
  若面向特定国家单独投放，建议按当地法再核一次。
- **WMF 不作担保**：Commons 明确声明不对版权状态提供保证，需自行核实。
