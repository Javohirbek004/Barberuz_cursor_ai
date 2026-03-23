import { Router } from "express";
import { validateUuidParam } from "../middleware/validate";
import { getServices, getService, postService, patchService } from "../controllers/services.controller";

const router = Router();

router.get("/",      getServices);
router.get("/:id",   validateUuidParam, getService);
router.post("/",     postService);
router.patch("/:id", validateUuidParam, patchService);

export default router;
