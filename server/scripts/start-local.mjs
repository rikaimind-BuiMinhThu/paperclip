import { pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

console.log("[start-local] boot", process.pid, process.version);
const here = dirname(fileURLToPath(import.meta.url));
const entry = resolve(here, "../src/index.ts");
console.log("[start-local] launching", entry);
const mod = await import(pathToFileURL(entry).href);
if (typeof mod.startServer !== "function") {
  console.error("[start-local] startServer export missing");
  process.exit(1);
}
const started = await mod.startServer();
console.log("[start-local] listening", started?.apiUrl ?? "ok");
// Keep process alive even if the returned handle is GC'd.
await new Promise(() => {});
