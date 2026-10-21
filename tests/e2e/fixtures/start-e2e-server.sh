#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$ROOT"

# Repo root `.env` may set DATABASE_URL (e.g. :5432). That would bypass the
# throwaway embedded-postgres cluster. Disable cwd dotenv and clear DB URLs.
export PAPERCLIP_DISABLE_CWD_ENV_FILE=true
unset DATABASE_URL DATABASE_MIGRATION_URL || true

pnpm --filter @paperclipai/ui build --outDir ../server/ui-dist --emptyOutDir

# Pre-seed config with a free DB port. Onboard/`run` then start against that
# cluster instead of the developer's default embedded port (54329).
node --input-type=module <<'EOF'
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const configPath = process.env.PAPERCLIP_CONFIG;
const home = process.env.PAPERCLIP_HOME;
const instanceId = process.env.PAPERCLIP_INSTANCE_ID ?? "playwright-e2e";
const serverPort = Number(process.env.PORT ?? 3199);
const dbPort = Number(process.env.PAPERCLIP_E2E_DB_PORT ?? 54339);
if (!configPath || !home) throw new Error("PAPERCLIP_CONFIG and PAPERCLIP_HOME are required");

const instanceRoot = path.dirname(configPath);
const secretsDir = path.join(instanceRoot, "secrets");
const keyFilePath = path.join(secretsDir, "master.key");
fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
if (!fs.existsSync(keyFilePath)) {
  fs.writeFileSync(keyFilePath, crypto.randomBytes(32).toString("base64url") + "\n", { mode: 0o600 });
}

const config = {
  $meta: { version: 1, updatedAt: new Date().toISOString(), source: "onboard" },
  database: {
    mode: "embedded-postgres",
    embeddedPostgresDataDir: path.join(instanceRoot, "db"),
    embeddedPostgresPort: dbPort,
    backup: { enabled: false, dir: path.join(home, "backups") },
  },
  logging: { mode: "file", logDir: path.join(instanceRoot, "logs") },
  server: {
    deploymentMode: "local_trusted",
    exposure: "private",
    bind: "loopback",
    host: "127.0.0.1",
    port: serverPort,
    allowedHostnames: [],
    serveUi: true,
  },
  auth: { baseUrlMode: "auto" },
  storage: {
    provider: "local_disk",
    localDisk: { baseDir: path.join(instanceRoot, "data", "storage") },
  },
  secrets: {
    provider: "local_encrypted",
    strictMode: false,
    localEncrypted: { keyFilePath },
  },
  telemetry: { enabled: false },
};

fs.mkdirSync(instanceRoot, { recursive: true, mode: 0o700 });
fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
console.log(`Seeded e2e config dbPort=${dbPort} serverPort=${serverPort} at ${configPath}`);
EOF

CHAT_FIXTURE_URL="$(node --input-type=module -e "import { pathToFileURL } from 'node:url'; import path from 'node:path'; console.log(pathToFileURL(path.resolve(process.argv[1])).href)" "$ROOT/tests/e2e/fixtures/agent-chat-github.mjs")"
export NODE_OPTIONS="--import=${CHAT_FIXTURE_URL}"
exec node cli/node_modules/tsx/dist/cli.mjs cli/src/index.ts run
