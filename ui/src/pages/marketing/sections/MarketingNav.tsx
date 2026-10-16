import { Link } from "@/lib/router";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { KujiraLockup } from "@/components/KujiraLockup";
import { LocaleToggle } from "@/components/LocaleToggle";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_LINKS = [
  { href: "#product", key: "landing.nav.product" },
  { href: "#how", key: "landing.nav.how" },
  { href: "#faq", key: "landing.nav.faq" },
] as const;

export function MarketingNav() {
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label={t("landing.brand")}>
          <KujiraLockup className="h-8 w-auto" title={t("landing.brand")} />
        </Link>
        <nav className="hidden items-center gap-6 md:flex" aria-label={t("landing.nav.main")}>
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(link.key)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LocaleToggle />
          <ThemeToggle />
          <Button asChild size="sm" className="rounded-full px-4">
            <Link to="/auth">{t("landing.nav.signIn")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
