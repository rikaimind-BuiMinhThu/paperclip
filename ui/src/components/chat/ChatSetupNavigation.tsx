import { useMemo } from "react";
import { useTranslation } from "@/i18n";
import { SetupWizardNavigation, SetupWizardSidebar } from "../SetupWizard";
export { SetupWizardSidebar as ChatSetupSidebar };

export function useDefaultChatSetupStepLabels() {
  const { t } = useTranslation();
  return useMemo(
    () => [
      t("apps.chatSetup.defaultSteps.pickApp"),
      t("apps.chatSetup.defaultSteps.connect"),
      t("apps.chatSetup.defaultSteps.test"),
    ],
    [t],
  );
}

export function useSlackChatSetupStepLabels() {
  const { t } = useTranslation();
  return useMemo(
    () => [
      t("agents.chooseAgent"),
      t("apps.chatSetup.steps.install"),
      t("apps.chatSetup.steps.configure"),
      t("apps.chatSetup.steps.test"),
      t("apps.chatSetup.steps.avatar"),
      t("apps.connect.connectSlackAccount"),
      t("apps.chatSetup.steps.finish"),
    ],
    [t],
  );
}

export function ChatSetupNavigation(props: {
  labels?: string[]; step: number; availableStep: number; disabled?: boolean; onSelect: (step: number) => void;
}) {
  const defaultLabels = useDefaultChatSetupStepLabels();
  return (
    <SetupWizardNavigation
      {...props}
      labels={props.labels ?? defaultLabels}
      ariaLabel="Connection setup progress"
    />
  );
}
