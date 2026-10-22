/**
 * The live address serves the website from the server's own `public` folder.
 * After ANY change to the website, run `pnpm --filter @workspace/api-server run sync-site`
 * and commit the changed `artifacts/api-server/public` files, otherwise the live site stays old.
 */
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../..");
const built = path.join(repoRoot, "artifacts/barber-uz/dist/public");
const target = path.join(dir, "public");

const result = spawnSync("pnpm", ["--filter", "@workspace/barber-uz", "run", "build"], {
  cwd: repoRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (result.error) throw result.error;
if (result.status) process.exit(result.status);

if (!existsSync(path.join(built, "index.html"))) {
  console.error("The website build did not produce index.html");
  process.exit(1);
}

rmSync(target, { recursive: true, force: true });
cpSync(built, target, { recursive: true });
console.log("Website copied into artifacts/api-server/public. Commit that folder to publish it.");
