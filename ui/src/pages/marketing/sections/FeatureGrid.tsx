import { useTranslation } from "@/i18n";
import {
  GitBranch,
  Goal,
  Network,
  ShieldCheck,
  Ticket,
  Wallet,
} from "lucide-react";

const FEATURES = [
  { key: "byo", icon: Network },
  { key: "org", icon: GitBranch },
  { key: "goals", icon: Goal },
  { key: "cost", icon: Wallet },
  { key: "tickets", icon: Ticket },
  { key: "governance", icon: ShieldCheck },
] as const;

export function FeatureGrid() {
  const { t } = useTranslation();

  return (
    <section id="product" className="scroll-mt-20 border-b border-border bg-muted/40 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("landing.features.title")}
        </h2>
        <ul className="landing-reveal mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ key, icon: Icon }) => (
            <li key={key} className="rounded-2xl border border-border bg-card p-5">
              <Icon className="size-5 text-primary" aria-hidden="true" />
              <h3 className="mt-3 text-lg font-semibold text-foreground">
                {t(`landing.features.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(`landing.features.${key}.body`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
