import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import clientsRouter from "./clients";
import bookingsRouter from "./bookings";
import servicesRouter from "./services";
import statsRouter from "./stats";
import settingsRouter from "./settings";
import telegramRouter from "./telegram";
import feedbackRouter from "./feedback";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/clients", clientsRouter);
router.use("/bookings", bookingsRouter);
router.use("/services", servicesRouter);
router.use("/stats", statsRouter);
router.use("/settings", settingsRouter);
router.use("/telegram", telegramRouter);
router.use("/feedback", feedbackRouter);

export default router;
