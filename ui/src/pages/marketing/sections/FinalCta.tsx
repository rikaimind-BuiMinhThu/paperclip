import { Link } from "@/lib/router";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";

export function FinalCta() {
  const { t } = useTranslation();

  return (
    <section className="border-b border-border bg-background py-20">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 text-center sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("landing.cta.title")}
        </h2>
        <p className="text-base text-muted-foreground">{t("landing.cta.body")}</p>
        <Button asChild size="lg" className="rounded-full px-8 landing-cta-pulse">
          <Link to="/auth">{t("landing.cta.button")}</Link>
        </Button>
      </div>
    </section>
  );
}
