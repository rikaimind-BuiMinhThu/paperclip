import { useTranslation } from "@/i18n";

const QUOTE_KEYS = ["q1", "q2", "q3", "q4"] as const;

export function SocialProof() {
  const { t } = useTranslation();

  return (
    <section className="border-b border-border bg-muted/60 py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-sm font-medium text-primary">{t("landing.proof.eyebrow")}</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          {t("landing.proof.title")}
        </h2>
        <ul className="landing-reveal mt-10 grid gap-4 sm:grid-cols-2">
          {QUOTE_KEYS.map((key) => (
            <li
              key={key}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <p className="text-sm leading-relaxed text-foreground">
                “{t(`landing.proof.${key}.quote`)}”
              </p>
              <p className="mt-4 text-xs font-medium text-muted-foreground">
                {t(`landing.proof.${key}.role`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
