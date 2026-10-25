import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MasterDepartmentRecord } from "@paperclipai/shared";
import { accessApi } from "@/api/access";
import { masterDepartmentsApi } from "@/api/masterDepartments";
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
import { Textarea } from "@/components/ui/textarea";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useTranslation } from "@/i18n";
import { INSTANCE_SETTINGS_PATH_PREFIX } from "@/lib/instance-settings";
import { queryKeys } from "@/lib/queryKeys";
import { Link } from "@/lib/router";

type DeptDraft = {
  name: string;
  slug: string;
  description: string;
  enabled: boolean;
  sortOrder: number;
};

function emptyDraft(nextSort = 0): DeptDraft {
  return {
    name: "",
    slug: "",
    description: "",
    enabled: true,
    sortOrder: nextSort,
  };
}

function draftFrom(row: MasterDepartmentRecord): DeptDraft {
  return {
    name: row.name,
    slug: row.slug,
    description: row.description,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

export function MasterDepartments() {
  const { t } = useTranslation();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DeptDraft>(emptyDraft());
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: t("settings.masterDepartments") }]);
  }, [setBreadcrumbs, t]);

  const accessQuery = useQuery({
    queryKey: queryKeys.access.me,
    queryFn: () => accessApi.getBoardAccess(),
  });
  const canManage = accessQuery.data?.isInstanceAdmin === true;

  const listQuery = useQuery({
    queryKey: queryKeys.masterDepartments.list(canManage),
    queryFn: () => masterDepartmentsApi.list(canManage),
  });

  const rows = useMemo(
    () => [...(listQuery.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [listQuery.data],
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["master-departments"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        enabled: draft.enabled,
        sortOrder: draft.sortOrder,
      };
      if (editingId) return masterDepartmentsApi.update(editingId, body);
      return masterDepartmentsApi.create({
        ...body,
        slug: draft.slug.trim() || undefined,
      });
    },
    onSuccess: async () => {
      await invalidate();
      setDialogOpen(false);
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => masterDepartmentsApi.remove(id),
    onSuccess: async () => {
      await invalidate();
      setDeleteId(null);
    },
  });

  const toggleEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) =>
      masterDepartmentsApi.update(id, { enabled }),
    onSuccess: () => invalidate(),
  });

  const openCreate = () => {
    const nextSort = rows.reduce((max, row) => Math.max(max, row.sortOrder), -1) + 1;
    setEditingId(null);
    setDraft(emptyDraft(nextSort));
    setDialogOpen(true);
  };

  const openEdit = (row: MasterDepartmentRecord) => {
    setEditingId(row.id);
    setDraft(draftFrom(row));
    setDialogOpen(true);
  };

  const loadError = listQuery.error instanceof Error ? listQuery.error.message : null;
  const saveError = saveMutation.error instanceof Error ? saveMutation.error.message : null;
  const deleteError = deleteMutation.error instanceof Error ? deleteMutation.error.message : null;
  const deleting = rows.find((row) => row.id === deleteId);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-medium">{t("settings.masterDepartments")}</h1>
          <p className="text-sm text-muted-foreground">{t("settings.masterDepartmentsPage.subtitle")}</p>
        </div>
        {canManage && (
          <Button type="button" onClick={openCreate}>
            {t("settings.masterDepartmentsPage.addDepartment")}
          </Button>
        )}
      </div>

      {!canManage && (
        <p className="text-sm text-muted-foreground">
          {t("settings.masterDepartmentsPage.readOnlyNotice")}{" "}
          <Link to={`${INSTANCE_SETTINGS_PATH_PREFIX}/access`} className="underline">
            {t("settings.masterDepartmentsPage.openInstanceAccess")}
          </Link>
        </p>
      )}

      {loadError && (
        <p className="text-sm text-destructive">
          {t("settings.masterDepartmentsPage.loadError")}: {loadError}
        </p>
      )}

      {rows.length === 0 && !listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("settings.masterDepartmentsPage.empty")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-3 rounded-lg border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{row.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{row.slug}</div>
                </div>
                {!row.enabled && (
                  <Badge variant="secondary">{t("settings.masterDepartmentsPage.disabled")}</Badge>
                )}
              </div>
              {row.description ? (
                <p className="line-clamp-2 text-sm text-muted-foreground">{row.description}</p>
              ) : null}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {t("settings.masterDepartmentsPage.sortOrder")}: {row.sortOrder}
                </span>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <ToggleSwitch
                      checked={row.enabled}
                      onCheckedChange={(enabled) => toggleEnabled.mutate({ id: row.id, enabled })}
                      aria-label={t("settings.masterDepartmentsPage.enabled")}
                    />
                    <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                      {t("settings.masterDepartmentsPage.edit")}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteId(row.id)}>
                      {t("settings.masterDepartmentsPage.delete")}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-(--sz-88vh) overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId
                ? t("settings.masterDepartmentsPage.editDepartment")
                : t("settings.masterDepartmentsPage.addDepartment")}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? t("settings.masterDepartmentsPage.editDepartment")
                : t("settings.masterDepartmentsPage.addDepartment")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dept-name">{t("settings.masterDepartmentsPage.name")}</Label>
              <Input
                id="dept-name"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </div>
            {!editingId && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dept-slug">{t("settings.masterDepartmentsPage.slug")}</Label>
                <Input
                  id="dept-slug"
                  value={draft.slug}
                  onChange={(event) => setDraft({ ...draft, slug: event.target.value })}
                  placeholder={t("settings.masterDepartmentsPage.slugPlaceholder")}
                />
              </div>
            )}
            {editingId && (
              <div className="flex flex-col gap-1.5">
                <Label>{t("settings.masterDepartmentsPage.slug")}</Label>
                <Input value={draft.slug} disabled />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dept-description">{t("settings.masterDepartmentsPage.description")}</Label>
              <Textarea
                id="dept-description"
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                rows={3}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dept-sort">{t("settings.masterDepartmentsPage.sortOrder")}</Label>
              <Input
                id="dept-sort"
                type="number"
                min={0}
                value={draft.sortOrder}
                onChange={(event) =>
                  setDraft({ ...draft, sortOrder: Number.parseInt(event.target.value, 10) || 0 })
                }
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <ToggleSwitch
                checked={draft.enabled}
                onCheckedChange={(enabled) => setDraft({ ...draft, enabled })}
                aria-label={t("settings.masterDepartmentsPage.enabled")}
              />
              {t("settings.masterDepartmentsPage.enabled")}
            </label>
            {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={!draft.name.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteId)} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("settings.masterDepartmentsPage.deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.masterDepartmentsPage.deleteBody", { name: deleting?.name ?? "" })}
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteId(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!deleteId || deleteMutation.isPending}
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {t("settings.masterDepartmentsPage.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
