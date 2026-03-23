import { Router } from "express";
import { validateUuidParam } from "../middleware/validate";
import { getBookings, getBooking, postBooking, patchBooking } from "../controllers/bookings.controller";

const router = Router();

router.get("/",      getBookings);
router.get("/:id",   validateUuidParam, getBooking);
router.post("/",     postBooking);
router.patch("/:id", validateUuidParam, patchBooking);

export default router;
