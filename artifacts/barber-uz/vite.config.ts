import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { fileURLToPath } from "url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, appDir, "");
  const rawPort = env.PORT || process.env.PORT || "5173";
  const parsedPort = Number(rawPort);
  const port = Number.isNaN(parsedPort) || parsedPort <= 0 ? 5173 : parsedPort;

  const basePath = env.BASE_PATH || process.env.BASE_PATH || "/";
  const apiTarget = env.VITE_API_BASE_URL || process.env.VITE_API_BASE_URL || "http://localhost:4000";

  return {
    base: basePath,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(appDir, "src"),
        "@assets": path.resolve(appDir, "..", "..", "attached_assets"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: appDir,
    build: {
      outDir: path.resolve(appDir, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
      fs: {
        strict: true,
        deny: ["**/.*"],
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
