import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../..");
const distDir = path.join(dir, "dist");
const outfile = path.join(dir, "server.mjs");
const slash = (p) => p.split(path.sep).join("/");

if (existsSync(outfile)) rmSync(outfile, { force: true });
rmSync(distDir, { recursive: true, force: true });

const usePnpm = Boolean(process.env.npm_execpath?.includes("pnpm") || process.env.PNPM_HOME);
const command = usePnpm ? "pnpm" : "npx";
const prefix = usePnpm ? ["dlx", "esbuild@0.27.3"] : ["--yes", "esbuild@0.27.3"];

console.log("building server with", command, prefix.join(" "));

const result = spawnSync(
  command,
  [
    ...prefix,
    slash(path.join(dir, "src/index.ts")),
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--outfile=${slash(outfile)}`,
    "--minify",
    "--packages=external",
    `--alias:@workspace/db=${slash(path.join(repoRoot, "lib/db/src/index.ts"))}`,
    `--alias:@workspace/api-zod=${slash(path.join(repoRoot, "lib/api-zod/src/index.ts"))}`,
  ],
  {
    stdio: "inherit",
    cwd: dir,
    env: process.env,
    shell: process.platform === "win32",
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
