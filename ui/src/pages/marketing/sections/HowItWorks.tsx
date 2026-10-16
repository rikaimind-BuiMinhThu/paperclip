import { useTranslation } from "@/i18n";

const STEPS = ["define", "hire", "run"] as const;

export function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section id="how" className="scroll-mt-20 border-b border-border bg-background py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("landing.how.title")}
        </h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step} className="rounded-2xl border border-border bg-card p-6">
              <p className="font-mono text-sm text-primary">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 text-xl font-semibold text-foreground">
                {t(`landing.how.${step}.title`)}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(`landing.how.${step}.body`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
