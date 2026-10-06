import { t as translate } from "@/i18n";

type Translate = (key: string) => string;

const STATUS_KEYS: Record<string, string> = {
  backlog: "status.backlog",
  todo: "status.todo",
  in_progress: "status.inProgress",
  in_review: "status.inReview",
  done: "status.done",
  blocked: "status.blocked",
  cancelled: "status.cancelled",
  idle: "status.idle",
  active: "status.active",
  paused: "status.paused",
  running: "status.running",
  error: "status.error",
  pending_approval: "status.pendingApproval",
  terminated: "status.terminated",
  archived: "status.archived",
  draft: "status.draft",
  failed: "status.failed",
  waiting: "status.waiting",
  success: "status.success",
  warning: "status.warning",
};

export function translateStatus(status: string, translateFn: Translate = translate): string {
  const key = STATUS_KEYS[status];
  if (key) return translateFn(key);
  const words = status.replace(/[_-]/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
