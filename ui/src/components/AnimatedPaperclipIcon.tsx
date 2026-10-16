import { cn } from "../lib/utils";
import { KujiraLockup } from "./KujiraLockup";

/**
 * Full-page loading state: animated Kujira AI Harness lockup.
 * Export name kept for call-site stability across App / auth gates.
 */
export function PaperclipLoading({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn("flex min-h-dvh w-full items-center justify-center bg-background", className)}
    >
      <KujiraLockup className="kujira-loading-mark h-32 w-auto" decorative />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
