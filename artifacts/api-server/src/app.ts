import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import v1Router from "./v1/router";

const app: Express = express();

function siteDir(): string | null {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "public"),
    path.resolve(process.cwd(), "public"),
    path.resolve(process.cwd(), "artifacts/api-server/public"),
    path.resolve(process.cwd(), "artifacts/barber-uz/dist/public"),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}

app.use(cors());
app.use(express.json({ limit: "50mb" }));       // large enough for import payloads
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  const dir = siteDir();
  if (dir) {
    res.sendFile(path.join(dir, "index.html"));
    return;
  }
  res.json({ status: "ok", message: "Barber.uz API is running" });
});

// Legacy API — used by the frontend
app.use("/api", router);

// v1 REST API — production-ready, versioned, portable
app.use("/api/v1", v1Router);

app.use((req, res, next) => {
  const dir = siteDir();
  if (!dir) return next();
  express.static(dir, { index: false })(req, res, next);
});

app.get("/{*splat}", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  const dir = siteDir();
  if (!dir) return next();
  res.sendFile(path.join(dir, "index.html"));
});

export default app;
