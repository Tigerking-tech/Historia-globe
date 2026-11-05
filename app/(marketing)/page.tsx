import Hero from "@/components/creem/landing/hero";
import { PrimaryFeatures } from "@/components/creem/landing/primaryFeatures";
import { ExplorerPreview } from "@/components/creem/landing/explorer-preview";
import { AIFeature } from "@/components/creem/landing/ai-feature";
import { Pricing } from "@/components/creem/landing/pricing";
import { CTA } from "@/components/creem/landing/cta";
import { Footer } from "@/components/creem/landing/footer";

export default function Home() {
  return (
    <main>
      <Hero />
      <PrimaryFeatures />
      <ExplorerPreview />
      <AIFeature />
      <Pricing />
      <CTA />
      <Footer />
    </main>
  );
}
