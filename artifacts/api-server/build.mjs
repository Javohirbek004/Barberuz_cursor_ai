import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(dir, "dist");
const outfile = path.join(distDir, "index.mjs");

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

const usePnpm = Boolean(process.env.npm_execpath?.includes("pnpm") || process.env.PNPM_HOME);
const command = usePnpm ? "pnpm" : "npx";
const prefix = usePnpm ? ["dlx", "esbuild@0.27.3"] : ["--yes", "esbuild@0.27.3"];

console.log("building server with", command, prefix.join(" "));

const result = spawnSync(
  command,
  [
    ...prefix,
    path.join(dir, "src/index.ts"),
    "--bundle",
    "--platform=node",
    "--format=esm",
    `--outfile=${outfile}`,
    "--minify",
    '--define:process.env.NODE_ENV="production"',
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
