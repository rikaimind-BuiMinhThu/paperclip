import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { t as i18nT } from "@/i18n";

interface ShortcutEntry {
  keys: string[];
  label: string;
  /** Render keys as a simultaneous chord (joined with "+") rather than a
   *  "then" sequence. */
  combo?: boolean;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutEntry[];
}

const sections: ShortcutSection[] = [
  {
    title: i18nT("nav.inbox"),
    shortcuts: [
      { keys: ["j"], label: i18nT("scan.s0763") },
      { keys: ["↓"], label: i18nT("scan.s0763") },
      { keys: ["k"], label: i18nT("scan.s0767") },
      { keys: ["↑"], label: i18nT("scan.s0767") },
      { keys: ["←"], label: i18nT("scan.s0239") },
      { keys: ["→"], label: i18nT("scan.s0482") },
      { keys: ["Enter"], label: i18nT("scan.s0891") },
      { keys: ["a"], label: i18nT("scan.s0087") },
      { keys: ["y"], label: i18nT("scan.s0087") },
      { keys: ["r"], label: i18nT("inbox.markRead") },
      { keys: ["U"], label: i18nT("inbox.markUnread") },
    ],
  },
  {
    title: i18nT("scan.s1332"),
    shortcuts: [
      { keys: ["y"], label: i18nT("scan.s1025") },
      { keys: ["g", "i"], label: i18nT("scan.s0572") },
      { keys: ["g", "c"], label: i18nT("scan.s0536") },
    ],
  },
  {
    title: i18nT("nav.decisions"),
    shortcuts: [
      { keys: ["j"], label: i18nT("scan.s0763") },
      { keys: ["↓"], label: i18nT("scan.s0763") },
      { keys: ["k"], label: i18nT("scan.s0767") },
      { keys: ["↑"], label: i18nT("scan.s0767") },
      { keys: ["Enter"], label: i18nT("scan.s0890") },
      { keys: ["x"], label: i18nT("scan.s0420") },
    ],
  },
  {
    title: i18nT("scan.s0571"),
    shortcuts: [
      { keys: ["/"], label: i18nT("scan.s1188") },
      { keys: ["c"], label: i18nT("issues.dialog.newTask") },
      { keys: ["["], label: i18nT("scan.s1383") },
      { keys: ["]"], label: i18nT("scan.s1382") },
      { keys: ["?"], label: i18nT("scan.s1250") },
    ],
  },
];

function KeyCap({ children }: { children: string }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-xs font-medium text-foreground shadow-(--shadow-extract-10)">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsCheatsheetContent() {
  return (
    <>
      <div className="divide-y divide-border border-t border-border">
        {sections.map((section) => (
          <div key={section.title} className="px-5 py-3">
            <h3 className="mb-2 text-(length:--text-micro) font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </h3>
            <div className="space-y-1.5">
              {section.shortcuts.map((shortcut) => (
                <div
                  key={shortcut.label + shortcut.keys.join()}
                  className="flex items-center justify-between gap-4"
                >
                  <span className="text-sm text-foreground/90">{shortcut.label}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, i) => (
                      <span key={key} className="flex items-center gap-1">
                        {i > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {shortcut.combo ? "+" : "then"}
                          </span>
                        )}
                        <KeyCap>{key}</KeyCap>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-5 py-3">
        <p className="text-xs text-muted-foreground">
          Press <KeyCap>{i18nT("scan.s0468")}</KeyCap> to close &middot; Shortcuts are disabled in text fields
        </p>
      </div>
    </>
  );
}

export function KeyboardShortcutsCheatsheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden" showCloseButton={false}>
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base">{i18nT("scan.s0665")}</DialogTitle>
        </DialogHeader>
        <KeyboardShortcutsCheatsheetContent />
      </DialogContent>
    </Dialog>
  );
}
