const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

function resolveLocale(locale?: string): string {
  return (
    locale
    ?? (typeof document !== "undefined" ? document.documentElement.lang : undefined)
    ?? "en"
  );
}

function compactEnglish(seconds: number): string {
  if (seconds < MINUTE) return "just now";
  if (seconds < HOUR) {
    const m = Math.floor(seconds / MINUTE);
    return `${m}m ago`;
  }
  if (seconds < DAY) {
    const h = Math.floor(seconds / HOUR);
    return `${h}h ago`;
  }
  if (seconds < WEEK) {
    const d = Math.floor(seconds / DAY);
    return `${d}d ago`;
  }
  if (seconds < MONTH) {
    const w = Math.floor(seconds / WEEK);
    return `${w}w ago`;
  }
  const mo = Math.floor(seconds / MONTH);
  return `${mo}mo ago`;
}

/** Compact relative time. Non-English locales use Intl; English keeps compact `2m ago` form. */
export function timeAgo(date: Date | string, locale?: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const seconds = Math.round((now - then) / 1000);
  const resolvedLocale = resolveLocale(locale);
  const isEnglish = resolvedLocale.toLowerCase().startsWith("en");

  if (!isEnglish) {
    const diffSec = Math.round((then - now) / 1000);
    const absSec = Math.abs(diffSec);
    try {
      const rtf = new Intl.RelativeTimeFormat(resolvedLocale, { numeric: "auto" });
      if (absSec < MINUTE) return rtf.format(Math.round(diffSec), "second");
      if (absSec < HOUR) return rtf.format(Math.round(diffSec / MINUTE), "minute");
      if (absSec < DAY) return rtf.format(Math.round(diffSec / HOUR), "hour");
      if (absSec < WEEK) return rtf.format(Math.round(diffSec / DAY), "day");
      if (absSec < MONTH) return rtf.format(Math.round(diffSec / WEEK), "week");
      return rtf.format(Math.round(diffSec / MONTH), "month");
    } catch {
      // Fall through to compact English.
    }
  }

  return compactEnglish(seconds);
}
