# 维基共享资源（Wikimedia Commons）真实史料照片 — 来源、许可与署名

> 本文件对应 `/api/reel?commons=1` 与 `public/reel/commons/` 下三张本地缓存图。
> 结论先行：**维基百科体系里确实有免费可商用的 1949 开国大典真实史料照片**，
> 但没有「当年拍摄的连续活动影像视频」——那属于另一类素材，见文末区分。

---

## 一、为什么要把真图放进仓库

沙箱网络下 `commons.wikimedia.org`、`en.wikipedia.org`、`upload.wikimedia.org`、
`archive.org` 直连全部超时（实测 HTTP 000，2026-11-06），
`WebFetch` 亦 `fetch failed`；但图片字节可通过 `wsrv.nl` 图片代理取得
（项目 `/api/now` 早已使用该通道，实测 HTTP 200 返回真实 JPEG）。

因此在线检索接口在沙箱内只能返回 `schematic`（自绘矢量示意）。
本文件登记的三张图是**通过图片代理取得、逐张目视确认、逐张核对许可**的真实史料，
合计约 436 KB，作为受限网络下的兜底素材，让产品在任何网络下都能播真实照片而非示意图。

它们属于「已核验的固定策展素材」，与「为每个事件预生成 N 个 MP4」是两回事，
不违背按需 manifest 架构；上线 Vercel 后在线检索仍优先。

## 二、逐张来源与许可

| # | 本地文件 | Commons 文件页 | 内容 | 作者 | 许可 | 核验 |
|---|---|---|---|---|---|---|
| 1 | `1949-rostrum-proclamation.jpg` (900×472) | [File:Founding Ceremony of People's Republic of China.jpg](https://commons.wikimedia.org/wiki/File:Founding_Ceremony_of_People%27s_Republic_of_China.jpg) | 1949-10-01 开国大典，右起董必武、赛福鼎·艾则孜、毛泽东、林伯渠在天安门城楼 | Unknown author | **PD-China**（公有领域） | 直接核验 Commons 文件页 |
| 2 | `1949-tiananmen-feb.jpg` (900×663) | [File:Tiananmen 1949.jpg](https://commons.wikimedia.org/wiki/File:Tiananmen_1949.jpg) | 1949-02-12 庆祝北平和平解放大会时的天安门城楼 | Unknown author | **Public Domain**（据 Wikimedia Commons 镜像标注） | ⚠️ 二手镜像，上线前须复核 Commons 文件页 |
| 3 | `1949-ji1-stamp.jpg` (900×1075) | [File:Ji1, 4-1, Beijing Tiananmen, 1949.jpg](https://commons.wikimedia.org/wiki/File:Ji1,_4-1,_Beijing_Tiananmen,_1949.jpg) | 纪1(4-1)「庆祝中国人民政治协商会议第一届全体会议」纪念邮票，1949-10-08 发行 | 张仃、钟灵（设计）／孙传哲（版图绘制） | **PD-China**（公有领域） | 直接核验 Commons 文件页 |

三张均为**静态照片**，编排时明确标注「史料照片 · 静帧编排 · 非活动影像」，
不冒充 1949 年原始纪录片胶片。

**对第 1 张做的唯一处理**：Commons 原图右下角带有第三方网站水印
（紫色花朵 +「你好香港 / www.miniao.hk」，来自上传者所引的转载页，非 Commons 自身标记）。
本项目将原图 900×606 **裁切为 900×472**，仅去掉底部含水印的一条，
人物面部与上半身完整保留；未做涂抹、修补、AI 重绘或任何内容篡改。
PD 素材允许改编，此处如实登记以便复核。

## 三、许可依据与商用边界（重要）

Commons 只收自由许可 / 公有领域文件，**禁止 NC、ND、fair use**，
绝大多数允许商用。但面向**欧美市场**时，以下风险必须逐项确认：

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

**结论**：这三张作为原型 / 内部演示资产可用；正式面向欧美收费运营前，
须由法务逐张复核 URAA 状态与法域差异，或改用明确标注
`CC0` / `PD-US` / `PD-1996` 的同类史料替代。第 2 张许可依据为二手镜像，
优先级最高、必须先复核。

## 四、为什么维基百科「有照片，没有那段视频」

这是两个不同的问题，不能混为一谈：

| 素材类型 | Wikimedia Commons 是否有 | 本项目来源 |
|---|---|---|
| 1949 开国大典**历史照片** | **有**。[Category:Founding Ceremony of PRC](https://commons.wikimedia.org/wiki/Category:Founding_Ceremony_of_People%27s_Republic_of_China) 至少 24 个文件，多为 PD-China / PD | 本文件登记的三张 |
| **当年拍摄的连续活动影像**（纪录片胶片） | **基本没有**。Commons 仅有约 36 万视频文件（占 1.4 亿文件的约 0.25%），且**强制自由格式 WebM / Ogg Theora / MPEG-1/2，明确不支持 MP4 / H.264 / H.265**；历史新闻片极少 | `public/reel/history-1949-real.mp4`，来自央视公开页，见 `docs/REEL-1949-LICENSE.md`，**商用授权待取** |

CCTV / 中央新影保存的 1949 原始纪录片胶片受邻接权与平台播放版本权利约束，
不属于 Commons 的自由许可素材，因此无法用「维基百科免费图」替代。
这也是项目里 `footage`（真实活动影像）与 `stills`（史料照片编排）分两级、
且都做诚实标注的原因。

## 五、上线后的行为

- Vercel 境外节点直连 Commons API 可达 → `buildManifest` 在线检索
  `commons-image` / `commons-video` / `archive`，命中即返回真实素材并逐条过滤许可。
- 本文件三张本地图**只在 `?commons=1` 或受限网络兜底时命中**，
  不会替代实时检索，也不会被当作「所有事件都有当年视频」的证据。
- `?debug=1` 可自检各源连通性；`?fixture=1` 为自绘 SVG 链路验证（非史料）。
