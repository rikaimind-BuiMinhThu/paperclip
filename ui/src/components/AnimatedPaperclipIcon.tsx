import { cn } from "../lib/utils";

/**
 * Full-page loading state: animated Kujira loading mark.
 * Export name kept for call-site stability across App / auth gates.
 */
export function PaperclipLoading({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn("flex min-h-dvh w-full items-center justify-center bg-background", className)}
    >
      <img
        src="/brands/kujira-loading.png"
        alt=""
        aria-hidden="true"
        className="kujira-loading-mark h-24 w-auto"
        draggable={false}
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
