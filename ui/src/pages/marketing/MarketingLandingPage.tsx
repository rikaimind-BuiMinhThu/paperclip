import { FeatureDeepDives } from "./sections/FeatureDeepDives";
import { FeatureGrid } from "./sections/FeatureGrid";
import { Faq } from "./sections/Faq";
import { FinalCta } from "./sections/FinalCta";
import { Hero } from "./sections/Hero";
import { HowItWorks } from "./sections/HowItWorks";
import { MarketingFooter } from "./sections/MarketingFooter";
import { MarketingNav } from "./sections/MarketingNav";
import { SocialProof } from "./sections/SocialProof";

export function MarketingLandingPage() {
  return (
    <div className="h-dvh overflow-y-auto bg-background text-foreground">
      <MarketingNav />
      <main>
        <Hero />
        <SocialProof />
        <HowItWorks />
        <FeatureGrid />
        <FeatureDeepDives />
        <Faq />
        <FinalCta />
      </main>
      <MarketingFooter />
    </div>
  );
}
