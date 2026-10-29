import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { copyTextToClipboard } from "@/lib/clipboard";
import { AgentSetupPrompt } from "@/components/AgentSetupPrompt";
import { useTranslation } from "@/i18n";

export function CopyField({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help?: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
        <code title={value} className="min-w-0 flex-1 truncate text-xs">
          {value}
        </code>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("pages.routineDetail.webhookFields.copyLabel", { label })}
          onClick={async () => {
            try {
              await copyTextToClipboard(value);
              setCopied(true);
              setError(false);
            } catch {
              setError(true);
            }
          }}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? t("common.copied") : t("common.copy")}
        </Button>
      </div>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-xs text-destructive">
            {t("pages.routineDetail.webhookFields.copyFailed")}
          </p>
          <textarea
            readOnly
            aria-label={t("pages.routineDetail.webhookFields.text", { label })}
            value={value}
            rows={5}
            className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
          />
        </div>
      )}
    </div>
  );
}

export function AgentInstructions({ value }: { value: string }) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t("pages.routineDetail.webhookFields.agentInstructions")}
      className="space-y-3 rounded-md bg-muted/40 p-4"
    >
      <div className="space-y-1">
        <h2 className="text-sm font-medium">{t("pages.routineDetail.webhookFields.agentInstructions")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("pages.routineDetail.webhookFields.agentInstructionsHint")}
        </p>
      </div>
      <AgentSetupPrompt
        prompt={value}
        label={t("pages.routineDetail.webhookFields.copyForAgent")}
        title={t("pages.routineDetail.webhookFields.webhookSetup")}
        description={t("pages.routineDetail.webhookFields.pasteHint")}
      />
    </section>
  );
}
