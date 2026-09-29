import path from "path";
import { createRequire } from "module";
import { fileURLToPath, pathToFileURL } from "url";
import { existsSync } from "fs";
import { rm, readFile } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEsbuild() {
  const dirs = [
    __dirname,
    path.resolve(__dirname, "../.."),
    process.cwd(),
  ];
  const errors = [];
  for (const dir of dirs) {
    const pkgJson = path.join(dir, "package.json");
    if (!existsSync(pkgJson)) continue;
    try {
      const require = createRequire(pathToFileURL(pkgJson).href);
      return require("esbuild");
    } catch (err) {
      errors.push(`${dir}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(
    "Cannot load esbuild. Tried:\n" + errors.join("\n"),
  );
}

const { build: esbuild } = loadEsbuild();

const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  const distDir = path.resolve(__dirname, "dist");
  await rm(distDir, { recursive: true, force: true });

  console.log("building server...");
  const pkgPath = path.resolve(__dirname, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter(
    (dep) =>
      !allowlist.includes(dep) &&
      !(pkg.dependencies?.[dep]?.startsWith("workspace:")),
  );

  await esbuild({
    entryPoints: [path.resolve(__dirname, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: path.resolve(distDir, "index.mjs"),
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
