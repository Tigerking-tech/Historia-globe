import config from "@/config";
import type { Metadata } from "next";

/**
 * SEO Tag Generator
 * 
 * Generates comprehensive SEO metadata for Next.js pages including:
 * - Title and description optimized for search engines
 * - OpenGraph tags for social media sharing
 * - Canonical URLs for proper indexing
 * - Keywords and application metadata
 * 
 * Already configured in root layout.tsx - no need to add to every page
 * For individual pages, set canonical URL:
 * export const metadata = getSEOTags({canonicalUrlRelative: "/your-path"});
 * 
 * @see https://nextjs.org/docs/app/api-reference/functions/generate-metadata
 */
export const getSEOTags = ({
  title,
  description,
  keywords,
  openGraph,
  canonicalUrlRelative,
  extraTags,
}: Metadata & {
  canonicalUrlRelative?: string;
  extraTags?: Record<string, any>;
} = {}): Metadata => {
  return {
    // up to 50 characters (what does your app do for the user?) > your main should be here
    title: title || config.appName,
    // up to 160 characters (how does your app help the user?)
    description: description || config.appDescription,
    // 统一全站词面：L1 品牌词 + L2 差异化主词。
    // meta keywords 权重已近零，这里只用于保持各页词面一致，不指望它带排名。
    keywords: keywords || [
      config.appName,
      "what happened on this day around the world",
      "interactive history globe by date",
      "same day global history across continents",
      "AI history with citations",
    ],
    applicationName: config.appName,
    // set a base URL prefix for other fields that require a fully qualified URL (.e.g og:image: og:image: 'https://yourdomain.com/share.png' => '/share.png')
    metadataBase: new URL(
      process.env.NODE_ENV === "development"
        ? "http://localhost:3000/"
        : `https://${config.domainName}/`
    ),

    openGraph: {
      title: openGraph?.title || config.appName,
      description: openGraph?.description || config.appDescription,
      url: openGraph?.url || `https://${config.domainName}/`,
      siteName: config.appName,
      // If you add an opengraph-image.(jpg|jpeg|png|gif) image to the /app folder, you don't need the code below
      // images: [
      //   {
      //     url: `https://${config.domainName}/share.png`,
      //     width: 1200,
      //     height: 660,
      //   },
      // ],
      locale: "en_US",
      type: "website",
    },

    twitter: {
      title: openGraph?.title || config.appName,
      description: openGraph?.description || config.appDescription,
      // If you add an twitter-image.(jpg|jpeg|png|gif) image to the /app folder, you don't need the code below
      // images: [openGraph?.image || defaults.og.image],
      card: "summary_large_image",
      creator: "@historiaglobe",
    },

    // If a canonical URL is given, we add it. The metadataBase will turn the relative URL into a fully qualified URL
    ...(canonicalUrlRelative && {
      alternates: { canonical: canonicalUrlRelative },
    }),

    // If you want to add extra tags, you can pass them here
    ...extraTags,
  };
};

/**
 * Schema.org Structured Data Generator
 * 
 * Generates JSON-LD structured data for rich results in Google Search.
 * Current implementation is configured for SoftwareApplication type.
 * 
 * Key features:
 * - Improves search result appearance with rich snippets
 * - Provides detailed application information to search engines
 * - Includes ratings, pricing, and application details
 * 
 * @see https://developers.google.com/search/docs/appearance/structured-data
 * @see https://schema.org/SoftwareApplication
 */
export const renderSchemaTags = () => {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "http://schema.org",
          "@type": "SoftwareApplication",
          name: config.appName,
          description: config.appDescription,
          image: `https://${config.domainName}/icon.png`,
          url: `https://${config.domainName}/`,
          author: {
            "@type": "Organization",
            name: "Historia Globe",
          },
          datePublished: "2023-08-01",
          applicationCategory: "EducationalApplication",
          // 不写虚构评分（aggregateRating）与不实价格：结构化数据里的假 rating
          // 属于可被搜索引擎处罚的虚假信息，也与「权益对齐」原则冲突。
          isAccessibleForFree: true,
          offers: [
            {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
              description: "Free tier — full globe, source links, slideshow, Right Now and CSV export. No account or card needed.",
            },
          ],
        }),
      }}
    ></script>
  );
};
