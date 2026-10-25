import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import type { MasterSkillOption, MasterSkillRecord } from "@paperclipai/shared";
import { accessApi } from "@/api/access";
import { masterSkillsApi } from "@/api/masterSkills";
import { PageTabBar } from "@/components/PageTabBar";
import { SkillCardIcon } from "@/components/SkillCardIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useTranslation } from "@/i18n";
import { INSTANCE_SETTINGS_PATH_PREFIX } from "@/lib/instance-settings";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { Link } from "@/lib/router";

type MasterSkillsTab = "catalog" | "custom";
type MasterSkillsSort = "alphabetical" | "recommended";

type SkillDraft = {
  name: string;
  slug: string;
  description: string;
  instructions: string;
  category: string;
  enabled: boolean;
  recommended: boolean;
};

type MasterSkillCardModel = {
  key: string;
  name: string;
  description: string;
  category: string | null;
  kind: "catalog" | "custom";
  enabled: boolean;
  recommended: boolean;
  customId?: string;
  slug?: string;
};

function emptyDraft(): SkillDraft {
  return {
    name: "",
    slug: "",
    description: "",
    instructions: "",
    category: "general",
    enabled: true,
    recommended: false,
  };
}

function draftFrom(skill: MasterSkillRecord): SkillDraft {
  return {
    name: skill.name,
    slug: skill.slug,
    description: skill.description,
    instructions: skill.instructions,
    category: skill.category,
    enabled: skill.enabled,
    recommended: skill.recommended,
  };
}

function matchesSearch(card: MasterSkillCardModel, query: string): boolean {
  if (!query) return true;
  const haystack = `${card.name} ${card.key} ${card.category ?? ""} ${card.description}`.toLowerCase();
  return haystack.includes(query);
}

function sortCards(cards: MasterSkillCardModel[], sort: MasterSkillsSort): MasterSkillCardModel[] {
  return [...cards].sort((a, b) => {
    if (sort === "recommended" && a.recommended !== b.recommended) {
      return a.recommended ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function MasterSkillCard({
  card,
  canManage,
  onOpen,
  onToggleEnabled,
  onToggleRecommended,
}: {
  card: MasterSkillCardModel;
  canManage: boolean;
  onOpen?: () => void;
  onToggleEnabled?: (enabled: boolean) => void;
  onToggleRecommended?: (recommended: boolean) => void;
}): ReactNode {
  const { t } = useTranslation();
  const interactive = Boolean(onOpen);

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (!onOpen) return;
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "group flex h-full min-h-(--sz-11_5rem) flex-col rounded-lg border border-border bg-card p-4 text-left transition-colors",
        interactive && "cursor-pointer hover:border-foreground/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !card.enabled && "bg-muted/30",
      )}
    >
      <div className="flex items-start gap-3">
        <SkillCardIcon
          card={{ key: card.key, name: card.name, slug: card.slug ?? card.name, iconUrl: null, color: null }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-sm font-medium text-foreground">{card.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {card.category ?? (card.kind === "custom" ? t("settings.masterSkillsPage.customBadge") : card.key)}
          </div>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 min-h-8 text-xs text-muted-foreground">
        {card.description}
      </p>

      <div className="mt-auto space-y-2 pt-3">
        <div className="flex flex-wrap items-center gap-1">
          {card.kind === "custom" ? (
            <Badge variant="secondary" className="text-(length:--text-nano)">
              {t("settings.masterSkillsPage.customBadge")}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-(length:--text-nano) text-muted-foreground">
              {t("settings.masterSkillsPage.catalogBadge")}
            </Badge>
          )}
          {card.recommended ? (
            <Badge variant="secondary" className="text-(length:--text-nano)">
              {t("settings.masterSkillsPage.recommended")}
            </Badge>
          ) : null}
          {!card.enabled ? (
            <Badge variant="outline" className="text-(length:--text-nano) text-muted-foreground">
              {t("settings.masterSkillsPage.disabled")}
            </Badge>
          ) : null}
        </div>

        {canManage && card.kind === "catalog" && onToggleEnabled && onToggleRecommended ? (
          <div
            className="flex flex-wrap items-center gap-4 border-t border-border pt-2"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <ToggleSwitch
                checked={card.enabled}
                aria-label={t("settings.masterSkillsPage.enabled")}
                onCheckedChange={onToggleEnabled}
              />
              {t("settings.masterSkillsPage.enabled")}
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <ToggleSwitch
                checked={card.recommended}
                aria-label={t("settings.masterSkillsPage.recommended")}
                onCheckedChange={onToggleRecommended}
              />
              {t("settings.masterSkillsPage.recommended")}
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function MasterSkills() {
  const { t } = useTranslation();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<MasterSkillsTab>("catalog");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<MasterSkillsSort>("alphabetical");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<SkillDraft>(emptyDraft());
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: t("settings.masterSkills") }]);
  }, [setBreadcrumbs, t]);

  const boardAccess = useQuery({
    queryKey: queryKeys.access.currentBoardAccess,
    queryFn: () => accessApi.getCurrentBoardAccess(),
    retry: false,
  });
  const canManage =
    Boolean(boardAccess.data?.isInstanceAdmin) ||
    boardAccess.data?.source === "local_implicit";
  const includeDisabled = canManage;
  const accessReady = boardAccess.isSuccess;

  const customQuery = useQuery({
    queryKey: queryKeys.masterSkills.custom(includeDisabled),
    queryFn: () => masterSkillsApi.list(includeDisabled),
    enabled: accessReady,
  });
  const optionsQuery = useQuery({
    queryKey: queryKeys.masterSkills.options(includeDisabled),
    queryFn: () => masterSkillsApi.listOptions(includeDisabled),
    enabled: accessReady,
  });

  const catalogCards = useMemo((): MasterSkillCardModel[] => {
    const options = (optionsQuery.data ?? []).filter((row: MasterSkillOption) => row.kind === "catalog");
    const mapped = options.map((row) => ({
      key: row.key,
      name: row.name,
      description: row.description,
      category: row.category,
      kind: "catalog" as const,
      enabled: row.enabled,
      recommended: row.recommended,
    }));
    const query = search.trim().toLowerCase();
    return sortCards(mapped.filter((card) => matchesSearch(card, query)), sort);
  }, [optionsQuery.data, search, sort]);

  const customCards = useMemo((): MasterSkillCardModel[] => {
    const mapped = (customQuery.data ?? []).map((skill) => ({
      key: skill.key,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      kind: "custom" as const,
      enabled: skill.enabled,
      recommended: skill.recommended,
      customId: skill.id,
      slug: skill.slug,
    }));
    const query = search.trim().toLowerCase();
    return sortCards(mapped.filter((card) => matchesSearch(card, query)), sort);
  }, [customQuery.data, search, sort]);

  const visibleCards = tab === "catalog" ? catalogCards : customCards;

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["master-skills"] }),
      queryClient.invalidateQueries({ queryKey: ["master-skill-catalog-prefs"] }),
      queryClient.invalidateQueries({ queryKey: ["master-skill-options"] }),
    ]);
  };

  const closeDialog = () => {
    setEditingId(null);
    setFormError(null);
  };

  const openCreate = () => {
    setDraft(emptyDraft());
    setEditingId("new");
    setFormError(null);
  };

  const openEdit = (skillId: string) => {
    const skill = (customQuery.data ?? []).find((row) => row.id === skillId);
    if (!skill) return;
    setDraft(draftFrom(skill));
    setEditingId(skill.id);
    setFormError(null);
  };

  const saveCustom = useMutation({
    mutationFn: async () => {
      const body = {
        name: draft.name,
        description: draft.description,
        instructions: draft.instructions,
        category: draft.category || "general",
        enabled: draft.enabled,
        recommended: draft.recommended,
        ...(editingId === "new" && draft.slug.trim() ? { slug: draft.slug.trim() } : {}),
      };
      if (editingId && editingId !== "new") {
        return masterSkillsApi.update(editingId, body);
      }
      return masterSkillsApi.create(body);
    },
    onSuccess: async () => {
      closeDialog();
      await refresh();
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const deleteCustom = useMutation({
    mutationFn: async (id: string) => masterSkillsApi.remove(id),
    onSuccess: async () => {
      closeDialog();
      await refresh();
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const upsertPref = useMutation({
    mutationFn: (body: { catalogKey: string; enabled?: boolean; recommended?: boolean }) =>
      masterSkillsApi.upsertPref(body),
    onSuccess: async () => {
      await refresh();
    },
  });

  const loadError =
    (customQuery.error instanceof Error ? customQuery.error.message : null)
    ?? (optionsQuery.error instanceof Error ? optionsQuery.error.message : null);
  const dialogOpen = editingId !== null;
  const isEditing = Boolean(editingId && editingId !== "new");
  const loading = (tab === "catalog" ? optionsQuery.isLoading : customQuery.isLoading) && visibleCards.length === 0;

  const tabItems = [
    { value: "catalog", label: t("settings.masterSkillsPage.catalog") },
    { value: "custom", label: t("settings.masterSkillsPage.customSkills") },
  ] as const;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 p-6">
      <div className="space-y-1">
        <h1 className="text-lg font-medium">{t("settings.masterSkills")}</h1>
        <p className="text-sm text-muted-foreground">{t("settings.masterSkillsPage.subtitle")}</p>
      </div>
      {!canManage ? (
        <p className="text-sm text-muted-foreground">
          {t("settings.masterSkillsPage.readOnlyNotice")}{" "}
          <Link to={`${INSTANCE_SETTINGS_PATH_PREFIX}/access`} className="text-foreground underline">
            {t("settings.masterSkillsPage.openInstanceAccess")}
          </Link>
        </p>
      ) : null}

      <Tabs value={tab} onValueChange={(value) => setTab(value as MasterSkillsTab)}>
        <PageTabBar
          items={[...tabItems]}
          value={tab}
          onValueChange={(value) => setTab(value as MasterSkillsTab)}
          align="start"
        />
      </Tabs>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={
            tab === "catalog"
              ? t("settings.masterSkillsPage.filterCatalog")
              : t("settings.masterSkillsPage.filterCustom")
          }
          className="max-w-md"
          aria-label={t("settings.masterSkillsPage.searchAria")}
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as MasterSkillsSort)}
              className="h-9 appearance-none rounded-md border border-border bg-background py-1 pl-3 pr-9 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={t("settings.masterSkillsPage.sortAria")}
            >
              <option value="alphabetical">{t("settings.masterSkillsPage.sortAlphabetical")}</option>
              <option value="recommended">{t("settings.masterSkillsPage.sortRecommended")}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          {canManage && tab === "custom" ? (
            <Button type="button" size="sm" onClick={openCreate}>
              {t("settings.masterSkillsPage.addSkill")}
            </Button>
          ) : null}
        </div>
      </div>

      {loadError ? (
        <p className="text-xs text-destructive">
          {t("settings.masterSkillsPage.loadError")}: {loadError}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : visibleCards.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {tab === "catalog"
              ? t("settings.masterSkillsPage.noCatalogMatches")
              : t("settings.masterSkillsPage.noCustomSkills")}
          </p>
          {canManage && tab === "custom" ? (
            <Button type="button" size="sm" className="mt-3" onClick={openCreate}>
              {t("settings.masterSkillsPage.addSkill")}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCards.map((card) => (
            <MasterSkillCard
              key={card.key}
              card={card}
              canManage={canManage}
              onOpen={
                card.kind === "custom" && canManage && card.customId
                  ? () => openEdit(card.customId!)
                  : undefined
              }
              onToggleEnabled={
                card.kind === "catalog"
                  ? (enabled) => upsertPref.mutate({ catalogKey: card.key, enabled })
                  : undefined
              }
              onToggleRecommended={
                card.kind === "catalog"
                  ? (recommended) => upsertPref.mutate({ catalogKey: card.key, recommended })
                  : undefined
              }
            />
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-h-(--sz-88vh) overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? t("settings.masterSkillsPage.editSkill")
                : t("settings.masterSkillsPage.addSkill")}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {isEditing
                ? t("settings.masterSkillsPage.editSkill")
                : t("settings.masterSkillsPage.addSkill")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Label htmlFor="skill-name">{t("settings.masterSkillsPage.name")}</Label>
            <Input
              id="skill-name"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
            {editingId === "new" ? (
              <>
                <Label htmlFor="skill-slug">{t("settings.masterSkillsPage.slug")}</Label>
                <Input
                  id="skill-slug"
                  value={draft.slug}
                  placeholder="brief-writer"
                  onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
                />
              </>
            ) : null}
            <Label htmlFor="skill-description">{t("settings.masterSkillsPage.description")}</Label>
            <Input
              id="skill-description"
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            />
            <Label htmlFor="skill-category">{t("settings.masterSkillsPage.category")}</Label>
            <Input
              id="skill-category"
              value={draft.category}
              onChange={(event) => setDraft({ ...draft, category: event.target.value })}
            />
            <Label htmlFor="skill-instructions">{t("settings.masterSkillsPage.instructions")}</Label>
            <Textarea
              id="skill-instructions"
              className="min-h-40"
              value={draft.instructions}
              onChange={(event) => setDraft({ ...draft, instructions: event.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
              />
              {t("settings.masterSkillsPage.enabled")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.recommended}
                onChange={(event) => setDraft({ ...draft, recommended: event.target.checked })}
              />
              {t("settings.masterSkillsPage.recommended")}
            </label>
            {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
            <DialogFooter className="gap-2 sm:justify-between">
              {isEditing ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteCustom.isPending}
                  onClick={() => {
                    if (editingId && editingId !== "new") deleteCustom.mutate(editingId);
                  }}
                >
                  {t("common.delete")}
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  {t("common.cancel")}
                </Button>
                <Button
                  type="button"
                  disabled={saveCustom.isPending}
                  onClick={() => saveCustom.mutate()}
                >
                  {t("common.save")}
                </Button>
              </div>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
