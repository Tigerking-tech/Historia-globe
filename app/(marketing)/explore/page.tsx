import type { Metadata } from "next";
import { Suspense } from "react";
import ExploreClient from "@/components/explore/ExploreClient";

export const metadata: Metadata = {
  title: "Explore any day · Historia Globe",
  description:
    "Pick any date and explore the global events that happened on that day, plotted on an interactive globe. Ask Historia to connect the world's threads.",
};

export default function ExplorePage() {
  return (
    <Suspense fallback={null}>
      <ExploreClient />
    </Suspense>
  );
}
