import { Link } from "@/lib/router";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { OrgChartVisual } from "./OrgChartVisual";

export function Hero() {
  const { t } = useTranslation();

  return (
    <section className="landing-hero-enter border-b border-border bg-background">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
        <div className="flex flex-col gap-6">
          <p className="text-sm font-medium text-primary">{t("landing.brand")}</p>
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {t("landing.hero.title")}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">{t("landing.hero.lede")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="rounded-full px-6">
              <Link to="/auth">{t("landing.hero.ctaPrimary")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-full px-6">
              <a href="#product">{t("landing.hero.ctaSecondary")}</a>
            </Button>
          </div>
        </div>
        <OrgChartVisual />
      </div>
    </section>
  );
}
