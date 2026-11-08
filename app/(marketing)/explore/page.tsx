import type { Metadata } from "next";
import { Suspense } from "react";
import ExploreClient from "@/components/explore/ExploreClient";
import { getSEOTags } from "@/lib/seo";

// 用统一的 SEO 生成器，确保 canonical 跟随 metadataBase（运行时解析的部署域）。
export const metadata: Metadata = getSEOTags({
  title: "Explore any day · Historia Globe",
  description:
    "Pick any date and explore the global events that happened on that day, plotted on an interactive globe. Ask Historia to connect the world's threads.",
  canonicalUrlRelative: "/explore",
});

export default function ExplorePage() {
  return (
    <>
      {/* 核心页面需要一个语义 h1；地球是全屏视觉，故用视觉隐藏方式提供，
          不影响布局，但让搜索引擎与辅助技术能识别页面主题。 */}
      <h1 className="sr-only">
        Explore the history of any day on the Historia Globe interactive 3D globe
      </h1>
      <Suspense fallback={null}>
        <ExploreClient />
      </Suspense>
    </>
  );
}
