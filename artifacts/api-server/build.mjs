import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(dir, "../..");
const outfile = path.join(dir, "server.mjs");

function pnpm(args, cwd = repoRoot) {
  const result = spawnSync("pnpm", args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, CI: "true" },
    shell: process.platform === "win32",
  });
  if (result.error) throw result.error;
  if (result.status) process.exit(result.status);
}

function pnpmDirs() {
  return [
    path.join(repoRoot, "node_modules/.pnpm"),
    path.join(dir, "node_modules/.pnpm"),
  ].filter(existsSync);
}

function collectNodePaths() {
  const paths = [
    path.join(dir, "node_modules"),
    path.join(repoRoot, "node_modules"),
  ];
  for (const pnpmDir of pnpmDirs()) {
    for (const name of readdirSync(pnpmDir)) {
      const nm = path.join(pnpmDir, name, "node_modules");
      if (existsSync(nm)) paths.push(nm);
    }
  }
  return paths.filter(existsSync);
}

function loadEsbuild() {
  const pkgs = [
    path.join(dir, "node_modules/esbuild/package.json"),
    path.join(repoRoot, "node_modules/esbuild/package.json"),
  ];
  for (const pnpmDir of pnpmDirs()) {
    for (const name of readdirSync(pnpmDir)) {
      if (!name.startsWith("esbuild@")) continue;
      pkgs.push(path.join(pnpmDir, name, "node_modules/esbuild/package.json"));
    }
  }
  for (const pkg of pkgs) {
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

function canResolve(name) {
  return collectNodePaths().some((p) => existsSync(path.join(p, name)));
}

let esbuild = loadEsbuild();
if (!esbuild || !canResolve("express") || !canResolve("drizzle-orm")) {
  console.log("installing api-server workspace dependencies for esbuild");
  pnpm(["install", "--filter", "@workspace/api-server..."]);
  esbuild = loadEsbuild();
}

if (!esbuild) {
  console.error("esbuild is still missing after install");
  process.exit(1);
}

const nodePaths = collectNodePaths();
console.log("building fully bundled server.mjs with", nodePaths.length, "node module paths");

await esbuild.build({
  entryPoints: [path.join(dir, "src/index.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile,
  minify: true,
  logLevel: "info",
  nodePaths,
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
  alias: {
    "@workspace/db": path.join(repoRoot, "lib/db/src/index.ts"),
    "@workspace/api-zod": path.join(repoRoot, "lib/api-zod/src/index.ts"),
  },
  external: ["pg-native"],
});
