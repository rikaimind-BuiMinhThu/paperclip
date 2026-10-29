import { InlineBanner } from "@/components/InlineBanner";
import { webhookUrlWarningReason } from "@/lib/webhook-url-warning";
import { useTranslation } from "@/i18n";

export function WebhookUrlWarning({ url }: { url: string }) {
  const { t } = useTranslation();
  const reason = webhookUrlWarningReason(url);
  if (!reason) return null;
  const warning = {
    loopback: { title: t("pages.routineDetail.webhookWarning.loopbackTitle"), message: t("pages.routineDetail.webhookWarning.loopbackMessage") },
    private: { title: t("pages.routineDetail.webhookWarning.privateTitle"), message: t("pages.routineDetail.webhookWarning.privateMessage") },
    tailscale: { title: t("pages.routineDetail.webhookWarning.tailscaleTitle"), message: t("pages.routineDetail.webhookWarning.tailscaleMessage") },
    https: { title: t("pages.routineDetail.webhookWarning.httpsTitle"), message: t("pages.routineDetail.webhookWarning.httpsMessage") },
    invalid: { title: t("pages.routineDetail.webhookWarning.invalidTitle"), message: t("pages.routineDetail.webhookWarning.invalidMessage") },
  }[reason];
  return <InlineBanner tone="warning" title={warning.title}>
    <div className="space-y-2">
      <p>{warning.message}</p>
      <p>{t("pages.routineDetail.webhookWarning.continue")}</p>
      <a className="underline underline-offset-4" href="https://docs.paperclip.ing/reference/deploy/https/" target="_blank" rel="noopener noreferrer">{t("pages.routineDetail.webhookWarning.learn")}</a>
    </div>
  </InlineBanner>;
}
