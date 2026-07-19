import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import clientsRouter from "./clients";
import bookingsRouter from "./bookings";
import servicesRouter from "./services";
import categoriesRouter from "./categories";
import statsRouter from "./stats";
import analyticsRouter from "./analytics";
import settingsRouter from "./settings";
import telegramRouter from "./telegram";
import feedbackRouter from "./feedback";
import publicRouter from "./public";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/clients", clientsRouter);
router.use("/bookings", bookingsRouter);
router.use("/services", servicesRouter);
router.use("/categories", categoriesRouter);
router.use("/stats", statsRouter);
router.use("/analytics", analyticsRouter);
router.use("/settings", settingsRouter);
router.use("/telegram", telegramRouter);
router.use("/feedback", feedbackRouter);
router.use("/public", publicRouter);

export default router;
