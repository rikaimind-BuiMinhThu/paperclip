import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Agent } from "@paperclipai/shared";
import { useTranslation } from "@/i18n";
import { AgentIcon } from "@/components/AgentIconPicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { t as i18nT } from "@/i18n";

export interface AgentChatPickerProps {
  agents: Agent[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (agent: Agent, signal?: AbortSignal) => void | Promise<void>;
  loading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  existingChatAgentIds?: readonly string[];
  renderAgentIcon?: (agent: Agent) => ReactNode;
}

export function AgentChatPicker({ open, onOpenChange, ...props }: AgentChatPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="px-4 pt-4 pb-3">
          <DialogTitle>{i18nT("scan.s0189")}</DialogTitle>
          {props.existingChatAgentIds && <p className="mt-2 text-sm text-muted-foreground">{i18nT("scan.s0869")}</p>}
        </div>
        {/* The dialog unmounts its content on close, so each search starts empty. */}
        <AgentChatPickerResults key={String(open)} {...props} onComplete={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AgentChatPickerResults({ agents, onSelect, onComplete, loading, error, onRetry, existingChatAgentIds, renderAgentIcon }: Omit<AgentChatPickerProps, "open" | "onOpenChange"> & { onComplete: () => void }) {
  const { t } = useTranslation();
  const mounted = useRef(false);
  const selection = useRef<AbortController | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; selection.current?.abort(); };
  }, []);
  const [search, setSearch] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  async function selectAgent(agent: Agent) {
    if (openingId) return;
    setOpeningId(agent.id);
    setSelectionError(null);
    const request = new AbortController();
    selection.current = request;
    try {
      await onSelect(agent, request.signal);
      if (mounted.current) onComplete();
    } catch (error) {
      setSelectionError(error instanceof Error ? error.message : "Couldn’t open chat. Try again.");
    } finally {
      setOpeningId(null);
    }
  }
  return (
    <Command>
      <CommandInput
        aria-label="Search agents by name or role"
        placeholder={i18nT("scan.s1187")}
        value={search}
        onValueChange={setSearch}
      />
      {selectionError && <p role="alert" className="px-4 py-3 text-sm text-destructive">{selectionError}</p>}
      {openingId && <p role="status" className="sr-only">{i18nT("scan.s0900")}</p>}
      {error ? (
        <div role="alert" className="flex flex-col items-start gap-2 p-4 text-sm">
          <p>{i18nT("scan.s0350")}</p>
          {onRetry && <Button variant="outline" size="sm" onClick={onRetry}>{i18nT("common.retry")}</Button>}
        </div>
      ) : loading ? (
        <p role="status" className="p-4 text-sm text-muted-foreground">{i18nT("pages.chats.loadingAgents")}</p>
      ) : (
        <CommandList>
          <CommandEmpty>
            <div className="flex flex-col items-center gap-2 px-4">
              <span>{agents.length ? `No agents match “${search}”` : t("empty.noAgents")}</span>
              {agents.length ? <>
                <span className="text-xs text-muted-foreground">{i18nT("pages.chats.sidebar.tryAnotherName")}</span>
                <Button variant="ghost" size="sm" onClick={() => setSearch("")}>{i18nT("search.clear")}</Button>
              </> : <span className="text-xs text-muted-foreground">{i18nT("scan.s0360")}</span>}
            </div>
          </CommandEmpty>
          <CommandGroup>
            {agents.map((agent) => (
              <CommandItem
                key={agent.id}
                value={agent.id}
                keywords={[agent.name, agent.title ?? "", agent.role]}
                onSelect={() => { void selectAgent(agent); }}
                disabled={openingId !== null}
                className="gap-3 px-3 py-3"
              >
                {renderAgentIcon ? renderAgentIcon(agent) : <AgentIcon icon={agent.icon} className="size-4 shrink-0" />}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium">{agent.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{agent.title ?? agent.role}</span>
                </span>
                {existingChatAgentIds && <span className="shrink-0 text-xs text-muted-foreground">{existingChatAgentIds.includes(agent.id) ? "Open chat" : "New chat"}</span>}
                {agent.status === "paused" && <span className="text-xs text-(--status-agent-paused)">{i18nT("status.paused")}</span>}
                {agent.status === "terminated" && <span className="text-xs text-muted-foreground">{i18nT("status.terminated")}</span>}
                {agent.status === "pending_approval" && <span className="text-xs text-muted-foreground">{i18nT("scan.s0119")}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      )}
    </Command>
  );
}
