import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../..");
const outfile = path.join(dir, "server.mjs");
const slash = (p) => p.split(path.sep).join("/");

const nodePaths = [
  path.join(dir, "node_modules"),
  path.join(repoRoot, "node_modules"),
].filter(existsSync);

function loadEsbuild() {
  const pkgCandidates = [
    path.join(dir, "node_modules/esbuild/package.json"),
    path.join(repoRoot, "node_modules/esbuild/package.json"),
  ];
  const pnpmDir = path.join(repoRoot, "node_modules/.pnpm");
  if (existsSync(pnpmDir)) {
    for (const name of readdirSync(pnpmDir)) {
      if (!name.startsWith("esbuild@")) continue;
      pkgCandidates.push(
        path.join(pnpmDir, name, "node_modules/esbuild/package.json"),
      );
    }
  }
  for (const pkg of pkgCandidates) {
    if (!existsSync(pkg)) continue;
    try {
      return createRequire(pathToFileURL(pkg).href)("esbuild");
    } catch {
      /* try next */
    }
  }
  return null;
}

if (existsSync(outfile)) rmSync(outfile, { force: true });

const buildOptions = {
  entryPoints: [path.join(dir, "src/index.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
  minify: true,
  logLevel: "info",
  nodePaths,
  alias: {
    "@workspace/db": path.join(repoRoot, "lib/db/src/index.ts"),
    "@workspace/api-zod": path.join(repoRoot, "lib/api-zod/src/index.ts"),
  },
  external: ["pg-native"],
};

const esbuild = loadEsbuild();

if (esbuild) {
  console.log("building server with local esbuild");
  await esbuild.build(buildOptions);
  process.exit(0);
}

console.log("local esbuild missing; using pnpm dlx / npx with NODE_PATH");
const usePnpm = Boolean(process.env.npm_execpath?.includes("pnpm") || process.env.PNPM_HOME);
const command = usePnpm ? "pnpm" : "npx";
const prefix = usePnpm ? ["dlx", "esbuild@0.27.3"] : ["--yes", "esbuild@0.27.3"];

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
    `--alias:@workspace/db=${slash(path.join(repoRoot, "lib/db/src/index.ts"))}`,
    `--alias:@workspace/api-zod=${slash(path.join(repoRoot, "lib/api-zod/src/index.ts"))}`,
    "--external:pg-native",
  ],
  {
    stdio: "inherit",
    cwd: dir,
    env: {
      ...process.env,
      NODE_PATH: nodePaths.join(path.delimiter),
    },
    shell: process.platform === "win32",
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
