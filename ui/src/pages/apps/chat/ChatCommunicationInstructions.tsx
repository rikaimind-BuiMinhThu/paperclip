import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { t as i18nT } from "@/i18n";

export function ChatCommunicationInstructions({ value, onSave }: {
  value: string;
  onSave: (instructions: string) => Promise<void>;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const text = draft ?? value;
  const dirty = text.trim() !== value;
  return (
    <form className="space-y-3" aria-labelledby={`${id}-label`} onSubmit={async (event) => {
      event.preventDefault();
      if (pending || !dirty) return;
      setPending(true);
      setError(null);
      setSaved(false);
      try {
        await onSave(text.trim());
        setDraft(null);
        setSaved(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Couldn’t save instructions. Try again.");
      } finally {
        setPending(false);
      }
    }}>
      <div className="space-y-1">
        <label id={`${id}-label`} htmlFor={id} className="text-sm font-semibold">{i18nT("scan.s0038")}</label>
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          Guide how this agent communicates in Slack. Optional; applies when new tasks start.
        </p>
      </div>
      <Textarea
        id={id}
        aria-describedby={`${id}-help`}
        value={text}
        disabled={pending}
        maxLength={4000}
        rows={4}
        placeholder={i18nT("scan.s0539")}
        onChange={(event) => { setDraft(event.target.value); setSaved(false); setError(null); }}
      />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <div>
          {dirty ? <Button type="button" variant="ghost" disabled={pending} onClick={() => { setDraft(null); setError(null); setSaved(false); }}>{i18nT("common.cancel")}</Button>
            : saved ? <span role="status" className="text-sm text-muted-foreground">{i18nT("scan.s1183")}</span> : null}
        </div>
        <Button type="submit" disabled={!dirty || pending}>{pending ? "Saving…" : "Save instructions"}</Button>
      </div>
    </form>
  );
}
