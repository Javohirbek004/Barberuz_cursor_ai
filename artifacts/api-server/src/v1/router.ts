import { Router } from "express";
import usersRouter    from "./routes/users.routes";
import servicesRouter from "./routes/services.routes";
import bookingsRouter from "./routes/bookings.routes";
import adminRouter    from "./routes/admin.routes";

const v1Router = Router();

/** Health-check for v1 */
v1Router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    version: "v1",
    timestamp: new Date().toISOString(),
    endpoints: [
      "GET  /api/v1/users",
      "POST /api/v1/users",
      "GET  /api/v1/users/:id",
      "PATCH /api/v1/users/:id",
      "GET  /api/v1/services",
      "POST /api/v1/services",
      "GET  /api/v1/services/:id",
      "PATCH /api/v1/services/:id",
      "GET  /api/v1/bookings",
      "POST /api/v1/bookings",
      "GET  /api/v1/bookings/:id",
      "PATCH /api/v1/bookings/:id",
      "GET  /api/v1/admin/export-data  [X-Admin-Secret required]",
      "POST /api/v1/admin/import-data  [X-Admin-Secret required]",
    ],
  });
});

v1Router.use("/users",    usersRouter);
v1Router.use("/services", servicesRouter);
v1Router.use("/bookings", bookingsRouter);
v1Router.use("/admin",    adminRouter);

export default v1Router;
