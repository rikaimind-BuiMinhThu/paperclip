import { cn } from "../lib/utils";

interface KujiraLockupProps {
  className?: string;
  decorative?: boolean;
  title?: string;
}

/**
 * Kujira AI Harness lockup — theme-paired raster marks (light / dark).
 * Size with a height class (`h-16 w-auto`); width follows the aspect.
 */
export function KujiraLockup({
  className,
  decorative = false,
  title = "Kujira AI Harness",
}: KujiraLockupProps) {
  return (
    <span
      className={cn("inline-flex", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : title}
      aria-hidden={decorative ? true : undefined}
    >
      <img
        src="/brands/kujira-lockup-light.jpg"
        alt=""
        className="h-full w-auto dark:hidden"
        draggable={false}
      />
      <img
        src="/brands/kujira-lockup-dark.jpg"
        alt=""
        className="hidden h-full w-auto dark:block"
        draggable={false}
      />
    </span>
  );
}
