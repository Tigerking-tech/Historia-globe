// Historia Globe — i18n dictionaries.
// Two languages for now: English (en, default) and Simplified Chinese (zh).
// Keep both trees structurally identical. `t(key, params)` resolves dot-paths
// and interpolates {placeholders}. Unknown keys return the key itself (safe fallback).

export type Lang = "en" | "zh";

type Dict = Record<string, any>;

const en: Dict = {
  nav: {
    explore: "Explore",
    features: "Features",
    askHistoria: "Ask Historia",
    pricing: "Pricing",
    signin: "Sign in",
    getStarted: "Get started",
  },
  hero: {
    badge: "Historia Globe",
    title1: "One date.",
    title2: "The whole world's history.",
    subtitle:
      "Pick any day and watch the globe light up with what was happening across the planet — wars, discoveries, revolutions, all on the same twenty-four hours. Then ask Historia to connect the threads.",
    ctaExplore: "Explore the globe",
    ctaPricing: "See pricing",
    ctaReel: "View the slideshow",
    openData: "Built on open data from Wikipedia & UNESCO World Heritage.",
  },
  features: {
    eyebrow: "What you get",
    title: "A new way to see the past.",
    intro:
      "Historia Globe turns scattered national timelines into one connected view of the world. Pick a day, and the planet tells you what it was doing — everywhere, at once.",
    interactiveTitle: "The interactive globe",
    interactiveDesc:
      "Pick any date and watch the planet light up with what was happening across every continent — wars, discoveries, revolutions, all on the same twenty-four hours.",
    askTitle: "Ask Historia",
    askDesc:
      "Our AI reads everything that happened on your chosen day and weaves the far-flung events into one connected story — the world, seen at a single instant.",
    inboxTitle: "Back to that moment, in real photos",
    inboxDesc:
      "Pick any event and the globe flies to where it happened, then plays a slideshow of freely licensed archival photographs — each one credited with its source and licence. No generated imagery, no video.",
    heritageTitle: "UNESCO World Heritage layer",
    heritageDesc:
      "Toggle a golden constellation of humanity's shared sites — over a thousand places inscribed by UNESCO, plotted where they actually stand.",
    authorityTitle: "Built on open authority",
    authorityDesc:
      "Every event is geolocated and cross-checked against Wikipedia and the UNESCO World Heritage list, then curated so the map stays trustworthy.",
    discoveryTitle: "Made for discovery",
    discoveryDesc:
      "Filter by category, follow a single place across centuries, or let the globe surprise you. History stops being a list and becomes a place you can wander.",
  },
  explorer: {
    eyebrow: "The experience",
    title: "Choose a date. The world answers.",
    body: "Every marker is a real event, pinned where it happened. Drag to spin the planet, zoom into a region, and click any point to read the story behind it. The same day, seen from Cairo, Kyoto, and Lima — not three separate histories, but one.",
    bullet1: "Filter by category — war, science, exploration, civil rights",
    bullet2: "Compare what distant civilizations were doing at the same moment",
    bullet3: "Save places and follow them across the centuries",
    cta: "Open the explorer",
    legendHeritage: "UNESCO World Heritage",
    legendEvents: "Events on this day",
  },
  ai: {
    badge: "Ask Historia",
    title: "History, finally told as one story.",
    body: "For too long we studied Chinese history, European history, and American history in separate boxes. Ask Historia takes the events of a single day and connects them — so you see the world at one instant, not a shelf of disconnected timelines.",
    youAsk: "You ask",
    sampleQuestion: "What was the whole world doing on April 12?",
    readsEvents: "Historia reads the events recorded for this date",
    historiaAnswers: "Historia answers",
    sampleAnswer: `On April 12, the planet kept reaching for the sky.

In 1861, Confederate guns opened on Fort Sumter and the American Civil War began — a conflict that would reshape a continent. Exactly a century later, in 1961, Yuri Gagarin became the first human in space, launched from the steppes of Kazakhstan and circling the Earth in 108 minutes. Twenty years after that, in 1981, the first Space Shuttle lifted off from Florida, turning Gagarin's leap into routine.

Meanwhile, on April 12, 1204, crusaders of the Fourth Crusade broke through the walls of Constantinople — the hinge of the medieval world turning on a single day.

The thread: April 12 keeps returning to moments when humanity tests its limits — by splitting a nation, by leaving the planet, or by storming a city that had stood for eight centuries. Three continents, nine hundred years apart, all pulled taut on the same date.`,
    footnote:
      "Example generated from real April 12 events. Your questions are answered live, drawn from the day you're exploring.",
  },
  pricing: {
    eyebrow: "Pricing",
    title: "Explore free. Subscribe when it opens.",
    intro:
      "Everything listed below as available works today, with no account and no card. Subscriptions are not live yet — the features marked Planned are on the roadmap, not promises already shipped.",
    mostPopular: "Most popular",
    free: "Free",
    startFree: "Start exploring",
    subscribe: "Coming soon",
    perMonth: "/ month",
    planned: "Planned",
    tba: "TBA",
    notLive: "Subscriptions not live yet",
    checkout: "Secure checkout via Creem is not enabled yet. No payment is collected today.",
    wandererDesc: "For the perpetually curious. Everything that exists today, free.",
    voyagerDesc: "Planned tier. For the devoted, once subscriptions go live.",
    historianDesc: "Planned tier. For classrooms, families, and serious researchers.",
    honestNote:
      "Honest status: the globe, archival slideshow, Right Now, AI conversation, source links, saved places and CSV export are all live and free. Account-based features below are still being built.",
    wandererFeatures: [
      "Explore any date on the interactive globe, no account needed",
      "Category filters, day tour and shareable view links",
      "Clickable source links for every event",
      "UNESCO World Heritage layer (free for everyone)",
      "Archival photo slideshow with per-image credits",
      "Right Now: street-level photo, local time and live weather",
      "Save places to a personal timeline, export any day to CSV",
      "Ask Historia with no question limit",
    ],
    voyagerFeatures: [
      "Everything in Wanderer, already available free",
      "Light / high-contrast and presentation display modes",
      "Locate me: Right Now at your own GPS position",
    ],
    voyagerPlanned: [
      "Unlimited AI conversation in a saved account",
      "Daily On This Day email",
      "Cloud sync of saved places across devices",
    ],
    historianFeatures: [
      "Everything in Wanderer, already available free",
      "CSV export including source URLs",
    ],
    historianPlanned: [
      "Up to 5 member accounts for a classroom",
      "Priority AI responses",
      "Early access to new regions and sources",
    ],
  },
  cta: {
    eyebrow: "Start exploring",
    title: "The past is one world. Go see it.",
    body: "Pick a date tonight. Watch the globe light up. Ask Historia to tie it together. It's free to begin — no card, no account needed to look around.",
    explore: "Explore the globe",
    createAccount: "Create an account",
  },
  footer: {
    product: "Product",
    company: "Company",
    data: "Data",
    about: "About",
    wikipedia: "Wikipedia",
    unesco: "UNESCO World Heritage",
    desc: "One date, the whole world's history. An interactive globe for seeing the past as a single connected story.",
    copyright: "© {year} Historia Globe. All rights reserved.",
    notAffiliated: "Built on open data from Wikipedia & the UNESCO World Heritage list. Not affiliated with UNESCO.",
  },
  explore: {
    legendHeritage: "UNESCO World Heritage",
    legendEvents: "Events on this day",
    legendHint: "Drag to rotate · zoom in to reveal heritage & city dots",
    viewSatellite: "Satellite",
    viewCountries: "Countries",
    viewNight: "Night",
    worldHeritage: "World Heritage",
    exploring: "Exploring",
    eventsRecorded: "{n} events recorded · {m} located on the globe",
    loading: "Loading this day in history…",
    empty: "No events curated for this date yet. In production this day is filled from Wikipedia's “on this day” feed. Try a famous date like July 20 or November 9.",
    locationNotPinned: "Location not pinned",
    wikipediaTag: "Wikipedia",
    askHistoria: "Ask Historia",
    askIntro: "Historia reads every event on {date} and connects the global threads for you.",
    askPlaceholder: "e.g. What was the world doing on this single day?",
    weaving: "Weaving the story…",
    askButton: "Ask Historia",
    january: "January",
    february: "February",
    march: "March",
    april: "April",
    may: "May",
    june: "June",
    july: "July",
    august: "August",
    september: "September",
    october: "October",
    november: "November",
    december: "December",
    sourceLink: "View original source ↗",
    sourceCurated: "Curated entry",
    sourceWikipedia: "Wikipedia",
    sourceWikidata: "Wikidata",
    sourceDomain: "Domain dataset",
    sourcesOffline:
      "Live Wikipedia / Wikidata feeds are unreachable on this network — showing {n} locally curated events only. Direct egress on deployment fills the day automatically.",
    exportCsv: "Export CSV",
    exportDone: "Exported {n} events",
    savePlace: "☆ Save place",
    savedPlace: "✓ Saved",
    timeline: "My timeline",
    timelineEmpty: "No saved places yet. Open an event and save it to build your own timeline across dates.",
    timelineRemove: "Remove",
    locateMe: "Locate me",
    locating: "Locating…",
    locateFail: "Location unavailable (permission may be denied). Keeping the current place.",
    locateOk: "Located — showing where you are right now",
    earthLoading: "Loading real satellite imagery… first load can take about 20 seconds",
    earthReady: "Real Earth ready",
    categoryAll: "All",
    categoryFilter: "Filter by category",
  },
  display: {
    label: "Display",
    dark: "Dark",
    light: "High contrast",
    present: "Presentation",
  },
  category: {
    politics: "Politics",
    war: "War & Conflict",
    space: "Space",
    science: "Science",
    disaster: "Disaster",
    tech: "Technology",
    exploration: "Exploration",
    "civil-rights": "Civil Rights",
    terrorism: "Terrorism",
    environment: "Environment",
    archaeology: "Archaeology",
    history: "History",
    crime: "Crime",
    mystery: "Mystery",
  },
};

const zh: Dict = {
  nav: {
    explore: "探索",
    features: "功能",
    askHistoria: "问问 Historia",
    pricing: "价格",
    signin: "登录",
    getStarted: "立即开始",
  },
  hero: {
    badge: "Historia Globe",
    title1: "同一个日期，",
    title2: "整部世界史在指尖亮起。",
    subtitle:
      "任选一天，看着地球被当日全球发生的大事点亮——战争、发现、革命，全部浓缩在相同的二十四小时里。然后，让 Historia 把散落的线索连成一体。",
    ctaExplore: "探索地球",
    ctaPricing: "查看价格",
    ctaReel: "看史料幻灯片",
    openData: "数据基于维基百科与联合国教科文组织世界遗产名录。",
  },
  features: {
    eyebrow: "你将获得",
    title: "一种看待过去的全新方式。",
    intro:
      "Historia Globe 把零散的各国时间线，编织成一张彼此相连的世界图景。选定一天，这颗星球便会告诉你——那一刻，它在世界各地都做了什么。",
    interactiveTitle: "可交互地球",
    interactiveDesc:
      "任选日期，看地球被各大洲当日发生的大事点亮——战争、发现、革命，全部浓缩在相同的二十四小时里。",
    askTitle: "问问 Historia",
    askDesc:
      "我们的 AI 会读取你选定之日发生的每一件事，把天南地北的事件编织成同一个相连的故事——世界，定格于瞬间。",
    inboxTitle: "回到那一刻，看真实照片",
    inboxDesc:
      "点选任意事件，地球飞往事发地，播放一组自由授权的真实史料照片幻灯片——逐张标注来源与许可。没有生成画面，也没有视频。",
    heritageTitle: "联合国教科文世界遗产图层",
    heritageDesc:
      "一键点亮人类共同遗产的金色星座——一千余处经 UNESCO 收录的地点，如实标注在它们真正所在之处。",
    authorityTitle: "立足开放权威数据",
    authorityDesc:
      "每个事件都经过地理定位，并与维基百科、联合国教科文世界遗产名录交叉核验，再经人工策展，确保地图始终可信。",
    discoveryTitle: "为探索而生",
    discoveryDesc:
      "按类别筛选、顺着一座城市纵览数百年，或干脆让地球给你惊喜。历史不再是一份清单，而是一个可以漫步其中的地方。",
  },
  explorer: {
    eyebrow: "体验",
    title: "选定一天，世界回应你。",
    body: "每一个标记都是真实发生的事件，钉在它发生的地方。拖动旋转地球、放大某个区域、点击任意点位，阅读背后的故事。同一天，从开罗、京都到利马——不是三段割裂的历史，而是同一段。",
    bullet1: "按类别筛选——战争、科学、探索、民权",
    bullet2: "对比遥远文明在同一时刻各自在做的事",
    bullet3: "收藏地点，跨越数百年追随它的变迁",
    cta: "打开探索器",
    legendHeritage: "联合国教科文世界遗产",
    legendEvents: "这一天的事件",
  },
  ai: {
    badge: "问问 Historia",
    title: "历史，终于被讲成同一个故事。",
    body: "长久以来，我们总是把中国史、欧洲史、美国史装进彼此分隔的盒子里分别研读。Historia 把某一天发生的所有事件串联起来——让你看见世界在同一瞬间的模样，而不是一整架彼此无关的时间线。",
    youAsk: "你问",
    sampleQuestion: "4 月 12 日这一天，全世界都在做什么？",
    readsEvents: "Historia 读取这一天已收录的事件",
    historiaAnswers: "Historia 回答",
    sampleAnswer: `4 月 12 日，这颗星球一次次向天空伸出手去。

1861 年，南军炮火轰向萨姆特堡，美国内战爆发——一场将重塑整片大陆的冲突。整整一个世纪后，1961 年，尤里·加加林成为首位进入太空的人类，从哈萨克斯坦的草原升空，用 108 分钟绕地球一周。再过二十年，1981 年，第一架航天飞机从佛罗里达升空，把加加林的壮举变成了例行公事。

与此同时，1204 年的 4 月 12 日，第四次十字军的骑士攻破了君士坦丁堡的城墙——中世纪的天下枢纽，在一天之内转向。

线索是：4 月 12 日不断回到人类挑战自身极限的时刻——分裂一个国家、离开这颗星球，或是攻下一座矗立了八个世纪的城池。三大洲，相隔九百年，却在同一天被紧紧拉成一线。`,
    footnote: "示例由真实的 4 月 12 日事件生成。你的问题会实时作答，取材自你所探索的那一天。",
  },
  pricing: {
    eyebrow: "价格",
    title: "现在免费探索，订阅开放后再付费。",
    intro:
      "下面标为「已上线」的功能今天就能用，无需账号、无需绑卡。订阅尚未开放；标注「计划中」的功能属于路线图，不是已经交付的承诺。",
    mostPopular: "最受欢迎",
    free: "免费",
    startFree: "开始探索",
    subscribe: "即将开放",
    perMonth: "/ 月",
    planned: "计划中",
    tba: "待定",
    notLive: "订阅尚未开放",
    checkout: "Creem 安全结账尚未启用，本站目前不收取任何费用。",
    wandererDesc: "献给永远好奇的人。今天已经做出来的一切，全部免费。",
    voyagerDesc: "计划档位。订阅上线后，献给笃信者。",
    historianDesc: "计划档位。面向课堂、家庭与严谨的研究者。",
    honestNote:
      "如实说明：地球、史料幻灯片、此刻此地、AI 对话、出处链接、收藏地点与 CSV 导出均已上线且免费。以下依赖账号体系的功能仍在开发中。",
    wandererFeatures: [
      "无需账号，在交互地球上探索任意日期",
      "类别筛选、镜头巡游、可还原的分享链接",
      "每个事件都有可点击的原始出处",
      "联合国教科文世界遗产图层（对所有人免费）",
      "真实史料照片幻灯片，逐张标注来源与许可",
      "此刻此地：地面实景 + 当地时间 + 实时天气",
      "收藏地点建立个人时间线，任意一天导出 CSV",
      "「问问 Historia」不设提问次数限制",
    ],
    voyagerFeatures: [
      "包含「漫游者」全部功能，现已免费可用",
      "浅色高对比 / 演示大字显示模式",
      "定位到我：用 GPS 查看我脚下此刻的样子",
    ],
    voyagerPlanned: [
      "账号内无限次 AI 对话记录",
      "每日「历史上的今天」邮件",
      "收藏地点跨设备云同步",
    ],
    historianFeatures: [
      "包含「漫游者」全部功能，现已免费可用",
      "CSV 导出含原始出处链接",
    ],
    historianPlanned: [
      "课堂用最多 5 个成员账号",
      "AI 优先响应",
      "抢先体验新地区与新数据源",
    ],
  },
  cta: {
    eyebrow: "开始探索",
    title: "过去是一个完整的世界。去看看吧。",
    body: "今晚就选一个日期。看着地球亮起。让 Historia 把它串起来。免费开始——无需绑卡，无需账号，就能四处看看。",
    explore: "探索地球",
    createAccount: "创建账号",
  },
  footer: {
    product: "产品",
    company: "公司",
    data: "数据",
    about: "关于",
    wikipedia: "维基百科",
    unesco: "联合国教科文世界遗产",
    desc: "同一个日期，整部世界史。用一颗可交互地球，把过去看作一个彼此相连的故事。",
    copyright: "© {year} Historia Globe 版权所有。",
    notAffiliated: "数据基于维基百科与联合国教科文组织世界遗产名录。与联合国教科文组织无隶属关系。",
  },
  explore: {
    legendHeritage: "联合国教科文世界遗产",
    legendEvents: "这一天的事件",
    legendHint: "拖动旋转 · 缩放地球 · 放大后显示遗产与城市点位",
    viewSatellite: "卫星",
    viewCountries: "国界",
    viewNight: "夜景",
    worldHeritage: "世界遗产",
    exploring: "正在探索",
    eventsRecorded: "共 {n} 个事件 · {m} 个已定位",
    loading: "正在载入这一天的历史……",
    empty: "这个日期暂时还没有策展事件。正式版会从维基百科「历史上的今天」自动补全，试试 7 月 20 日或 11 月 9 日这样的著名日期。",
    locationNotPinned: "未标注地点",
    wikipediaTag: "维基百科",
    askHistoria: "问问 Historia",
    askIntro: "{date} 当天发生的每一件事，Historia 都会读取，并为你把全球线索连成一体。",
    askPlaceholder: "例如：这一天全世界都在做什么？",
    weaving: "正在编织故事……",
    askButton: "问问 Historia",
    january: "一月",
    february: "二月",
    march: "三月",
    april: "四月",
    may: "五月",
    june: "六月",
    july: "七月",
    august: "八月",
    september: "九月",
    october: "十月",
    november: "十一月",
    december: "十二月",
    sourceLink: "查看原始资料 ↗",
    sourceCurated: "策展条目",
    sourceWikipedia: "维基百科",
    sourceWikidata: "Wikidata",
    sourceDomain: "领域数据库",
    sourcesOffline:
      "当前网络未连上维基百科 / Wikidata，仅显示本地策展的 {n} 条事件；部署到境外网络后会自动补齐当天全球事件。",
    exportCsv: "导出 CSV",
    exportDone: "已导出 {n} 条事件",
    savePlace: "☆ 收藏地点",
    savedPlace: "✓ 已收藏",
    timeline: "我的时间线",
    timelineEmpty: "还没有收藏地点。点开一个事件并收藏，就能跨日期建立自己的时间线。",
    timelineRemove: "移除",
    locateMe: "定位到我",
    locating: "正在定位…",
    locateFail: "无法获取定位（可能未授权），已保留当前地点。",
    locateOk: "已定位，正在显示你脚下此刻的样子",
    earthLoading: "正在载入真实卫星影像…首次加载约需 20 秒",
    earthReady: "真实地球已就绪",
    categoryAll: "全部",
    categoryFilter: "按类别筛选",
  },
  display: {
    label: "显示",
    dark: "深色",
    light: "浅色高对比",
    present: "演示大字",
  },
  category: {
    politics: "政治",
    war: "战争与冲突",
    space: "太空",
    science: "科学",
    disaster: "灾难",
    tech: "科技",
    exploration: "探索",
    "civil-rights": "民权",
    terrorism: "恐怖主义",
    environment: "环境",
    archaeology: "考古",
    history: "历史",
    crime: "犯罪",
    mystery: "未解之谜",
  },
};

export const DICTS: Record<Lang, Dict> = { en, zh };

// Resolve a dot-path inside a nested dict. Returns undefined if not found.
export function resolvePath(dict: Dict, path: string): string | undefined {
  const parts = path.split(".");
  let cur: any = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return typeof cur === "string" ? cur : undefined;
}
