import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from "react";
import { ChevronRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface SkillMultiSelectOption {
  key: string;
  name: string;
  description?: string | null;
  category?: string | null;
}

/** Short label for a catalog skill key (last path segment). */
export function skillOptionLabel(skill: SkillMultiSelectOption): string {
  const name = skill.name?.trim();
  if (name) return name;
  const trimmed = skill.key.trim();
  if (!trimmed) return trimmed;
  const parts = trimmed.split("/");
  return parts[parts.length - 1] || trimmed;
}

/**
 * Searchable checkbox picker for catalog skill keys.
 * Matches `AgentMultiSelect` / `MemberMultiSelect`: live `onChange`, or staged `onSave`.
 */
export function SkillMultiSelect({
  skills,
  selectedSkillKeys,
  onChange,
  onSave,
  loading = false,
  disabled = false,
  pending = false,
  maxSelected,
  triggerLabel,
  triggerVariant = "outline",
  triggerSize = "default",
  triggerFullWidth = true,
  triggerClassName,
  contentAlign = "start",
  emptyMessage = "No skills available.",
  filterPlaceholder = "Filter skills",
  showSelectionPreview = true,
  id,
  onOpenChange,
}: {
  skills: SkillMultiSelectOption[];
  selectedSkillKeys: Set<string>;
  onChange?: (next: Set<string>) => void;
  onSave?: (next: Set<string>) => void;
  loading?: boolean;
  disabled?: boolean;
  pending?: boolean;
  maxSelected?: number;
  triggerLabel?: string;
  triggerVariant?: ComponentProps<typeof Button>["variant"];
  triggerSize?: ComponentProps<typeof Button>["size"];
  triggerFullWidth?: boolean;
  triggerClassName?: string;
  contentAlign?: ComponentProps<typeof PopoverContent>["align"];
  emptyMessage?: string;
  filterPlaceholder?: string;
  showSelectionPreview?: boolean;
  id?: string;
  onOpenChange?: (open: boolean) => void;
}): ReactNode {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [draftSkillKeys, setDraftSkillKeys] = useState<Set<string>>(new Set(selectedSkillKeys));
  const staged = Boolean(onSave);
  const workingSkillKeys = staged ? draftSkillKeys : selectedSkillKeys;

  useEffect(() => {
    if (open && staged) setDraftSkillKeys(new Set(selectedSkillKeys));
  }, [open, selectedSkillKeys, staged]);

  const normalizedFilter = filter.trim().toLowerCase();
  const filteredSkills = useMemo(
    () =>
      skills
        .filter((skill) => {
          const haystack = `${skillOptionLabel(skill)} ${skill.key} ${skill.description ?? ""} ${skill.category ?? ""}`;
          return haystack.toLowerCase().includes(normalizedFilter);
        })
        .sort((a, b) => {
          const aSelected = workingSkillKeys.has(a.key);
          const bSelected = workingSkillKeys.has(b.key);
          if (aSelected !== bSelected) return aSelected ? -1 : 1;
          return skillOptionLabel(a).localeCompare(skillOptionLabel(b));
        }),
    [skills, normalizedFilter, workingSkillKeys],
  );
  const selectedCount = selectedSkillKeys.size;
  const selectedSkills = skills.filter((skill) => selectedSkillKeys.has(skill.key));
  const atLimit = typeof maxSelected === "number" && workingSkillKeys.size >= maxSelected;

  function setSelection(next: Set<string>) {
    if (staged) setDraftSkillKeys(next);
    else onChange?.(next);
  }

  function removeSkill(key: string) {
    const next = new Set(selectedSkillKeys);
    next.delete(key);
    onChange?.(next);
  }

  return (
    <div className="space-y-2">
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          onOpenChange?.(nextOpen);
          if (!nextOpen) setFilter("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant={triggerVariant}
            size={triggerSize}
            className={cn("justify-between", triggerFullWidth && "w-full", triggerClassName)}
            disabled={disabled || pending}
          >
            <span className="flex min-w-0 items-center">
              <span className="truncate">
                {triggerLabel ?? (selectedCount === 0
                  ? "Select skills"
                  : `${selectedCount} ${selectedCount === 1 ? "skill" : "skills"} selected`)}
              </span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align={contentAlign}>
          <div className="border-b border-border p-3">
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={filterPlaceholder}
              className="h-8"
              autoFocus
            />
          </div>
          {loading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : skills.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">{emptyMessage}</div>
          ) : (
            <div className="max-h-60 overflow-y-auto py-1">
              {filteredSkills.map((skill) => {
                const label = skillOptionLabel(skill);
                const checked = workingSkillKeys.has(skill.key);
                const optionDisabled = !checked && atLimit;
                return (
                  <label
                    key={skill.key}
                    className={cn(
                      "flex items-start gap-2 px-3 py-2 hover:bg-accent/30",
                      optionDisabled ? "opacity-60" : "cursor-pointer",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={optionDisabled}
                      aria-label={`Select ${label}`}
                      onCheckedChange={(nextChecked) => {
                        const next = new Set(workingSkillKeys);
                        if (nextChecked) {
                          if (typeof maxSelected === "number" && next.size >= maxSelected) return;
                          next.add(skill.key);
                        } else {
                          next.delete(skill.key);
                        }
                        setSelection(next);
                      }}
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">{label}</span>
                      {skill.category ? (
                        <span className="truncate text-xs text-muted-foreground">{skill.category}</span>
                      ) : skill.description ? (
                        <span className="truncate text-xs text-muted-foreground">{skill.description}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
              {filteredSkills.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground">No matches.</div>
              ) : null}
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <span className="text-xs text-muted-foreground" aria-live="polite">
              {workingSkillKeys.size === 0
                ? "No skills selected"
                : typeof maxSelected === "number"
                  ? `${workingSkillKeys.size} / ${maxSelected} selected`
                  : `${workingSkillKeys.size} selected`}
            </span>
            <div className="flex items-center gap-2">
              {staged ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (staged) onSave?.(draftSkillKeys);
                  setOpen(false);
                }}
                disabled={pending}
              >
                {staged ? (pending ? "Saving…" : "Save") : "Done"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {showSelectionPreview && selectedSkills.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" aria-label="Selected skills">
          {selectedSkills.map((skill) => (
            <Badge key={skill.key} variant="secondary" className="gap-1 pr-1 font-normal" title={skill.key}>
              <span className="max-w-40 truncate">{skillOptionLabel(skill)}</span>
              {onChange && !disabled ? (
                <button
                  type="button"
                  className="rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label={`Remove ${skillOptionLabel(skill)}`}
                  onClick={() => removeSkill(skill.key)}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
