import { Link } from "@/lib/router";
import { useTranslation } from "@/i18n";
import { KujiraLockup } from "@/components/KujiraLockup";

export function MarketingFooter() {
  const { t } = useTranslation();

  return (
    <footer className="bg-muted/50 py-12">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex flex-col gap-3">
          <KujiraLockup className="h-8 w-auto" title={t("landing.brand")} />
          <p className="max-w-sm text-sm text-muted-foreground">{t("landing.footer.tagline")}</p>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <a href="#product" className="text-muted-foreground hover:text-foreground">
            {t("landing.nav.product")}
          </a>
          <a href="#how" className="text-muted-foreground hover:text-foreground">
            {t("landing.nav.how")}
          </a>
          <a href="#faq" className="text-muted-foreground hover:text-foreground">
            {t("landing.nav.faq")}
          </a>
          <Link to="/auth" className="text-muted-foreground hover:text-foreground">
            {t("landing.nav.signIn")}
          </Link>
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-6xl px-4 text-xs text-muted-foreground sm:px-6">
        {t("landing.footer.copyright")}
      </div>
    </footer>
  );
}
