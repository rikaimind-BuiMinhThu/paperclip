import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

const FAQ_KEYS = [
  "different",
  "existing",
  "budget",
  "control",
  "continuous",
  "vsTickets",
  "setup",
  "multiCompany",
  "opensource",
] as const;

export function Faq() {
  const { t } = useTranslation();
  const [openKey, setOpenKey] = useState<(typeof FAQ_KEYS)[number] | null>("different");

  return (
    <section id="faq" className="scroll-mt-20 border-b border-border bg-muted/40 py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground">
          {t("landing.faq.title")}
        </h2>
        <div className="mt-8 divide-y divide-border rounded-2xl border border-border bg-card">
          {FAQ_KEYS.map((key) => {
            const open = openKey === key;
            return (
              <div key={key}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  aria-expanded={open}
                  onClick={() => setOpenKey(open ? null : key)}
                >
                  <span className="text-sm font-medium text-foreground">
                    {t(`landing.faq.${key}.q`)}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform duration-(--motion-duration-base)",
                      open && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                </button>
                {open ? (
                  <p className="px-5 pb-4 text-sm text-muted-foreground">
                    {t(`landing.faq.${key}.a`)}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
