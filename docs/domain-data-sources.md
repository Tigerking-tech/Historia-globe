# 权威专题事件数据源 · 注册与接入清单

Historia Globe 的权威事件来自两类：**战争 / 灾难**用注册型权威数据集（UCDP、EM-DAT），**恐袭**直接来自 **Wikidata（CC0，商用自由，无需注册）**。前两者**不是即调即用的公开 API**，而是**免费注册 + 同意使用许可 +（多数）邮箱验证**后下载/申请的权威数据集。本清单告诉你每一步怎么做、商用要注意什么。

> 解析与按日过滤、坐标映射的代码已就绪（`lib/domain-sources.ts`），你只需把原始数据交进来，地球仪自动点亮对应大头针。

---

## 一、商用合规速览（上线收费前必看）

| 数据源 | 许可 | 商用 | 关键约束 |
|--------|------|------|---------|
| **UCDP** (乌普萨拉) | 研究用途免费 | ✅ 较宽松 | 须**署名引用** UCDP |
| **EM-DAT** (CRED) | 注册免费 | ✅ 一般 OK | 须署名引用；商用建议确认条款 |
| **Wikidata** | **CC0 公共领域** | ✅ 完全自由 | 连署名都不强制（已接入；**恐袭事件即来源于此**） |
| **Wikipedia** | CC BY-SA 4.0 | ✅ 允许 | 须署名 + 衍生共享；我们仅用结构化事实（标题/日期/坐标），风险低 |

**建议**：上线前由你/法务过一眼 EM-DAT 的最新条款；页面 footer 统一加 *"Event data via Wikipedia / Wikidata (CC BY-SA / CC0) and UCDP / EM-DAT"*。

> ### ℹ️ 恐袭事件改由 Wikidata 提供（已落地）
> GTD 的 EULA 限定**仅限非商业研究**，商业用途须与马里兰大学另行签书面协议（对方保留拒绝权）。为避免商用风险，项目已**移除 GTD**，恐袭类事件改为取自 **Wikidata（CC0，商用完全自由，且已含大量著名恐袭事件带坐标）**——见 `lib/history.ts` 的 `fetchWikidataEvents`（自动识别 terrorist attack 并归类为 `terrorism`）。无需注册、无需 CSV。

---

## 二、逐个注册步骤

### 1. UCDP — Georeferenced Event Dataset (GED)（战争/武装冲突）
- **注册**：https://ucdp.uu.se/ → 右上角注册账号（免费，邮箱验证）
- **下载**：登录后进入 Downloads → 选 **GED** 最新版本（如 `ucdp-ged-241`）
- **落盘**：把 CSV 改名为 `ucdp-ged.csv` 放到项目 `data/`
- **校验**：`node scripts/ingest-domain.mjs ucdp`

### 2. EM-DAT — International Disaster Database（自然灾害）
- **注册 + 申请 API**：https://www.emdat.be/ → 注册并在 Dashboard 生成 **API key**（免费）
- **实时拉取**（推荐，无需手动下载）：
  ```bash
  EMDAT_API_KEY=你的key node scripts/ingest-domain.mjs emdat --from 2000 --to 2024
  ```
  脚本自动分页拉全量并落盘为 `data/emdat.csv`。
- **或手动导出**：在 EM-DAT 网页导出 CSV，改名为 `emdat.csv` 放 `data/`。

### 3. （备选）ACLED — 政治暴力/抗议
- 对商用**相对友好**（正式 API + 署名即可），可补充战争/抗议类事件。
- 注册：https://acleddata.com/register/ → 获取 API key → 走其 API。
- 注意：当前沙箱网络挡住了 ACLED，部署到 Vercel 后可用。

> 说明：恐袭类事件**不在此处注册**——已由 Wikidata (CC0) 在代码中直接提供，无需任何下载或密钥。

---

## 三、文件落位与生效

```
historia-saas/
└── data/
    ├── ucdp-ged.csv   # UCDP GED（手动下载）
    └── emdat.csv      # EM-DAT（脚本拉取 或 手动导出）
```

- 文件**缺失不影响运行**：对应源只是贡献 0 条事件，其余源照常。
- 放好后**重启服务**（`npm start` 或 Vercel 重新部署），`/api/events` 自动合并这些权威事件。
- 解析器对列名大小写不敏感、对版本轻微漂移容错（见 `lib/domain-sources.ts` 的候选列名表）。

---

## 四、Vercel 部署提醒
- `data/*.csv` 必须 **commit 进 git**，Vercel 构建时才能读到（运行时无法再下载）。
- 解析走 Node runtime（`loadCsv` 读 `process.cwd()/data`），Serverless 函数可用。
- NASA APOD 已实测云端可达，无需 CSV。
- 维基 / Wikidata 在 Vercel（美/欧节点）自动点亮，**无需 HTTP_PROXY**。
