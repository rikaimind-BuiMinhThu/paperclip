import { Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { useLocale } from "../context/LocaleContext";

type LocaleToggleVariant = "icon" | "menu-action" | "compact-menu-action";

interface LocaleToggleProps {
  className?: string;
  variant?: LocaleToggleVariant;
  onAfterToggle?: () => void;
}

/**
 * Switch between Japanese (default for the RIKAI fork) and English.
 */
export function LocaleToggle({ className, variant = "icon", onAfterToggle }: LocaleToggleProps) {
  const { locale, toggleLocale } = useLocale();
  const { t } = useTranslation();
  const isJapanese = locale === "ja";
  const label = isJapanese ? t("locale.switchToEnglish") : t("locale.switchToJapanese");
  const description = t("locale.description");

  function handleClick() {
    toggleLocale();
    onAfterToggle?.();
  }

  if (variant === "compact-menu-action") {
    return (
      <button
        type="button"
        className={cn(
          "flex h-(--profile-popover-row-height) w-full items-center gap-(--profile-popover-row-gap) rounded-lg px-2.5 text-left text-(length:--text-compact) font-medium leading-(--profile-popover-label-line-height) text-foreground transition-colors hover:bg-accent",
          className,
        )}
        onClick={handleClick}
        aria-label={label}
      >
        <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
          <Languages className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
    );
  }

  if (variant === "menu-action") {
    return (
      <button
        type="button"
        className={cn(
          "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent/60",
          className,
        )}
        onClick={handleClick}
        aria-label={label}
      >
        <span className="mt-0.5 rounded-lg border border-border bg-background/70 p-2 text-muted-foreground">
          <Languages className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{label}</span>
          <span className="block text-xs text-muted-foreground">{description}</span>
        </span>
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={handleClick}
      aria-label={label}
      title={label}
      className={cn("text-muted-foreground", className)}
    >
      <Languages />
    </Button>
  );
}
