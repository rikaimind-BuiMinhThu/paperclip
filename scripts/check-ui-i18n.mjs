#!/usr/bin/env node
/**
 * Fail when high-traffic shell files regress to hardcoded English labels
 * that should go through i18n (t / useTranslation).
 *
 * Allowlist: tests, storybook, generated production twins are excluded by path.
 * Extend ALLOWLIST_SUBSTRINGS for intentional English (code samples, provider names).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiSrc = path.join(root, "ui", "src");

const REQUIRED_I18N_FILES = [
  "components/Sidebar.tsx",
  "components/SidebarAccountMenu.tsx",
  "components/MobileBottomNav.tsx",
  "components/ThemeToggle.tsx",
  "components/LocaleToggle.tsx",
  "components/OnboardingWizard.tsx",
  "components/AdapterLoginChrome.tsx",
  "components/onboarding/FooterNav.tsx",
  "components/AgentActionButtons.tsx",
  "components/SidebarAgents.tsx",
  "components/task-chat/TaskChatComposer.tsx",
  "pages/Inbox.tsx",
  "pages/Auth.tsx",
  "pages/Search.tsx",
  "pages/Agents.tsx",
  "pages/CompanySettings.tsx",
  "pages/Dashboard.tsx",
  "pages/apps/Connections.tsx",
  "pages/apps/chat/ChatEndpointSetup.tsx",
  "pages/Issues.tsx",
  "pages/Approvals.tsx",
  "pages/Goals.tsx",
  "pages/Routines.tsx",
  "pages/Secrets.tsx",
  "pages/ProfileSettings.tsx",
  "pages/apps/Browse.tsx",
  "pages/NotFound.tsx",
  "pages/apps/AppDetail.tsx",
  "pages/apps/gateways/GatewaysList.tsx",
  "pages/CompanyEnvironments.tsx",
  "pages/PluginManager.tsx",
  "pages/AdapterManager.tsx",
];

const FORBIDDEN_LITERALS = [
  '"Dashboard"',
  '"New Task"',
  '"Switch to light mode"',
  '"Switch to dark mode"',
  ">Settings<",
  '"Sign out"',
  '"Documentation"',
  '? "Get started"',
  'label: "Waiting for code"',
  '>Save & exit<',
];

const errors = [];

for (const relative of REQUIRED_I18N_FILES) {
  const absolute = path.join(uiSrc, relative);
  if (!fs.existsSync(absolute)) {
    errors.push(`missing required i18n surface: ${relative}`);
    continue;
  }
  const source = fs.readFileSync(absolute, "utf8");
  if (!source.includes("useTranslation") && !source.includes('from "@/i18n"') && !source.includes("from '../i18n'") && !source.includes('from "../../i18n"')) {
    // LocaleToggle/ThemeToggle may import useTranslation from @/i18n
    if (!source.includes("@/i18n") && !source.includes("../i18n") && !source.includes("../../i18n")) {
      errors.push(`${relative} must import useTranslation / @/i18n`);
    }
  }
  for (const literal of FORBIDDEN_LITERALS) {
    if (source.includes(literal)) {
      errors.push(`${relative} contains hardcoded label ${literal}; use t(...)`);
    }
  }
}

const en = JSON.parse(fs.readFileSync(path.join(uiSrc, "i18n/locales/en.json"), "utf8"));
const ja = JSON.parse(fs.readFileSync(path.join(uiSrc, "i18n/locales/ja.json"), "utf8"));

function keyPaths(node, prefix = "") {
  const keys = [];
  if (node && typeof node === "object" && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node)) {
      const next = prefix ? `${prefix}.${key}` : key;
      if (typeof value === "string") keys.push(next);
      else keys.push(...keyPaths(value, next));
    }
  }
  return keys;
}

const enKeys = new Set(keyPaths(en));
const jaKeys = new Set(keyPaths(ja));
for (const key of enKeys) {
  if (!jaKeys.has(key)) errors.push(`ja.json missing key ${key}`);
}
for (const key of jaKeys) {
  if (!enKeys.has(key)) errors.push(`ja.json has extra key ${key}`);
}

if (enKeys.size < 400) {
  errors.push(`en.json looks too small (${enKeys.size} keys); expected a full-app catalog`);
}

if (errors.length > 0) {
  console.error("check-ui-i18n failed:\n" + errors.map((e) => ` - ${e}`).join("\n"));
  process.exit(1);
}

console.log(`check-ui-i18n ok (${enKeys.size} keys, ${REQUIRED_I18N_FILES.length} surfaces)`);
