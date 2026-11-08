// 日期页的多语言问答段：服务端直出，不依赖客户端 i18n。
//
// 为什么单独做一层：lib/i18n 是 React Context + localStorage 切换，SSR 首屏
// 恒为 en，爬虫与禁用 JS 的读者看不到任何中文。这里把结论句与 FAQ 问句作为
// 静态文本直接渲染进 366 个日期页，每个数字都来自构建期真实统计。
//
// 诚实边界：这是「页内多语言段」，不是独立语言 URL / hreflang / 全站翻译。
// 每个段落用 lang 属性标注语言；不声称站点已有完整的多语言路由。

export type DateI18nParams = {
  label: string;
  total: number;
  curated: number;
  supplemental: number;
};

export type LangBlock = {
  code: string;
  name: string;
  summary: string;
  questions: { q: string; a: string }[];
};

const BCE = (y: number) => (y < 0 ? `${-y} BCE` : String(y));

/** 四种语言共用同一组事实，避免出现互相矛盾的译文。 */
export function dateI18nBlocks(p: DateI18nParams): LangBlock[] {
  const { label, total, curated, supplemental } = p;
  const has = total > 0;

  return [
    {
      code: "zh-CN",
      name: "中文 / Chinese",
      summary: has
        ? `${label}：本页收录 ${total} 条历史事件——${curated} 条带坐标的策展条目，以及 ${supplemental} 条来自 Wikipedia「历史上的今天」的补充条目，每条都附有可点击的出处链接。全站免费、无需注册。`
        : `${label}：我们的策展库暂未收录这一天的带坐标事件。这是如实的空缺，不代表那天什么都没发生；可查看邻近日期或使用实时地球。`,
      questions: [
        {
          q: `${label} 这一天，世界各地发生了什么？`,
          a: has
            ? `本页把共享同一个日历日的 ${total} 条事件并列呈现，跨越不同地区。它是「同一天的全球横向视角」，不是按国家排列的编年史，也不声称记录完整或区域分布均衡。补充层没有经纬度或大洲字段，因此不提供地域占比数字。`
            : `当前策展库在这一天没有带坐标的事件。页面会列出邻近日期与实时地球入口，而不是把空数据包装成「无事发生」。`,
        },
        {
          q: "这是国别时间轴，还是同一天的全球视角？",
          a: "是同一天的全球视角。它不顺着一个国家按年代往下讲，而是把同一日期发生在别处的事件并排放，让人看到「同一时刻，世界另一边在做什么」。",
        },
        {
          q: "这个页面免费吗？事件有出处吗？",
          a: "免费、无需账号或信用卡。日期页、3D 地球、出处链接、CSV 导出与史料幻灯片都开放；每条策展事件链接到维基百科检索页（我们如实标注它不是单一原始史料），每条补充条目链接到真实的 en.wikipedia.org 页面。本站尚未启用收款。",
        },
      ],
    },
    {
      code: "es",
      name: "Español / Spanish",
      summary: has
        ? `${label}: esta página recoge ${total} eventos históricos — ${curated} entradas curadas con coordenadas y ${supplemental} entradas complementarias del feed «On this day» de Wikipedia, cada una con un enlace a su fuente. Gratis y sin registro.`
        : `${label}: nuestro archivo curado todavía no tiene eventos geolocalizados para esta fecha. Es una laguna real, no una afirmación de que no ocurrió nada; consulta las fechas cercanas o el globo en vivo.`,
      questions: [
        {
          q: `¿Qué pasó el ${label} en distintas partes del mundo?`,
          a: has
            ? `Esta página presenta ${total} eventos que comparten una misma fecha calendaria, uno al lado del otro. Es una vista global del mismo día, no una cronología nacional; no pretende ser completa ni equilibrada por regiones. La capa complementaria no tiene campos geográficos, por lo que no publicamos porcentajes por continente.`
            : `El archivo curado no tiene eventos geolocalizados en esta fecha. La página enlaza fechas cercanas y el globo en vivo en lugar de presentar un día vacío como si no hubiera pasado nada.`,
        },
        {
          q: "¿Es una línea de tiempo nacional o una vista global del mismo día?",
          a: "Es una vista global del mismo día. En lugar de seguir un solo país en orden cronológico, coloca los eventos de una misma fecha en paralelo para mostrar qué ocurría al mismo tiempo en otros lugares.",
        },
        {
          q: "¿Es gratis y tienen fuentes los eventos?",
          a: "Sí, gratis, sin cuenta ni tarjeta. Cada evento curado enlaza a una página de búsqueda de Wikipedia (indicada como tal, no como fuente primaria única) y cada entrada complementaria enlaza a su URL real de en.wikipedia.org. El sitio no tiene pagos activados.",
        },
      ],
    },
    {
      code: "fr",
      name: "Français / French",
      summary: has
        ? `${label} : cette page recense ${total} événements historiques — ${curated} entrées curatées géolocalisées et ${supplemental} entrées complémentaires du flux « On this day » de Wikipédia, chacune avec un lien vers sa source. Gratuit et sans compte.`
        : `${label} : notre archive curatée ne contient pas encore d'événement géolocalisé pour cette date. C'est une lacune réelle, pas une affirmation qu'il ne s'est rien passé ; consultez les dates voisines ou le globe en direct.`,
      questions: [
        {
          q: `Que s'est-il passé le ${label} dans le monde ?`,
          a: has
            ? `Cette page présente ${total} événements partageant une même date calendaire, placés côte à côte. C'est une vue globale d'un même jour, pas une chronologie nationale ; elle ne prétend pas être exhaustive ni équilibrée par régions. La couche complémentaire n'a aucun champ géographique, donc aucun pourcentage par continent n'est publié.`
            : `L'archive curatée n'a pas d'événement géolocalisé à cette date. La page propose les dates voisines et le globe en direct plutôt que de présenter une journée vide comme « rien ne s'est passé ».`,
        },
        {
          q: "S'agit-il d'une chronologie nationale ou d'une vue globale d'un même jour ?",
          a: "D'une vue globale d'un même jour. Au lieu de suivre un seul pays dans l'ordre chronologique, elle met en parallèle les événements d'une même date pour montrer ce qui se passait ailleurs au même moment.",
        },
        {
          q: "Cette page est-elle gratuite et les événements ont-ils des sources ?",
          a: "Oui, gratuite, sans compte ni carte. Chaque événement curaté renvoie à une page de recherche Wikipédia (signalée comme telle, et non comme une source primaire unique) et chaque entrée complémentaire à sa véritable URL en.wikipedia.org. Les paiements ne sont pas activés sur ce site.",
        },
      ],
    },
  ];
}

/** 供事实页 / llms.txt 引用的固定说明，避免多处口径不一致。 */
export const DATE_I18N_NOTE =
  "Each of the 366 date pages carries a server-rendered multilingual summary and FAQ in Chinese, Spanish and French, in addition to the English page. These are page-level translations of the same date's facts, marked with lang attributes — not separate language URLs or hreflang alternates.";

/** 年份格式辅助，供需要展示年份范围的组件复用。 */
export function formatYear(y: number): string {
  return BCE(y);
}
