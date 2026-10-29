import { cn } from "../lib/utils";
import { KujiraLockup } from "./KujiraLockup";
import { t as i18nT } from "@/i18n";

/**
 * Full-page loading state: animated Kujira AI Workforce lockup.
 * Export name kept for call-site stability across App / auth gates.
 */
export function PaperclipLoading({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn("flex min-h-dvh w-full items-center justify-center bg-background", className)}
    >
      <KujiraLockup className="kujira-loading-mark h-32 w-auto" decorative />
      <span className="sr-only">{i18nT("common.loading")}</span>
    </div>
  );
}
