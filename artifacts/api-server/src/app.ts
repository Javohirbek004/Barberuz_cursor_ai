import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import router from "./routes";
import v1Router from "./v1/router";

const app: Express = express();
const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const indexHtml = path.join(publicDir, "index.html");

app.use(cors());
app.use(express.json({ limit: "50mb" }));       // large enough for import payloads
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  if (existsSync(indexHtml)) {
    res.sendFile(indexHtml);
    return;
  }
  res.json({ status: "ok", message: "Barber.uz API is running" });
});

// Legacy API — used by the frontend
app.use("/api", router);

// v1 REST API — production-ready, versioned, portable
app.use("/api/v1", v1Router);

if (existsSync(indexHtml)) {
  app.use(express.static(publicDir, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    res.sendFile(indexHtml);
  });
}

export default app;
