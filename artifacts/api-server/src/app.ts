import express, { type Express } from "express";
import cors from "cors";
import router from "./routes";
import v1Router from "./v1/router";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));       // large enough for import payloads
app.use(express.urlencoded({ extended: true }));

// Legacy API — used by the frontend
app.use("/api", router);

// v1 REST API — production-ready, versioned, portable
app.use("/api/v1", v1Router);

export default app;
