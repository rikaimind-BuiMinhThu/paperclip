import { useTranslation } from "@/i18n";

const DIVES = ["byo", "goals", "heartbeats", "budgets", "tickets", "extensible", "governance"] as const;

export function FeatureDeepDives() {
  const { t } = useTranslation();

  return (
    <section className="border-b border-border bg-background py-16">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 sm:px-6">
        {DIVES.map((key, index) => (
          <article
            key={key}
            className={`grid gap-6 lg:grid-cols-2 lg:items-center ${
              index % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
            }`}
          >
            <div>
              <p className="text-sm font-medium text-primary">
                {t(`landing.dives.${key}.eyebrow`)}
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                {t(`landing.dives.${key}.title`)}
              </h2>
              <p className="mt-3 text-base text-muted-foreground">
                {t(`landing.dives.${key}.body`)}
              </p>
              {key === "heartbeats" ? (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  <li>{t("landing.dives.heartbeats.b1")}</li>
                  <li>{t("landing.dives.heartbeats.b2")}</li>
                  <li>{t("landing.dives.heartbeats.b3")}</li>
                  <li>{t("landing.dives.heartbeats.b4")}</li>
                </ul>
              ) : null}
              {key === "tickets" ? (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  <li>{t("landing.dives.tickets.b1")}</li>
                  <li>{t("landing.dives.tickets.b2")}</li>
                  <li>{t("landing.dives.tickets.b3")}</li>
                </ul>
              ) : null}
              {key === "extensible" ? (
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  <li>{t("landing.dives.extensible.b1")}</li>
                  <li>{t("landing.dives.extensible.b2")}</li>
                  <li>{t("landing.dives.extensible.b3")}</li>
                </ul>
              ) : null}
            </div>
            <div className="rounded-2xl border border-border bg-secondary/60 p-6">
              <p className="text-sm font-medium text-foreground">
                {t(`landing.dives.${key}.panel`)}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
