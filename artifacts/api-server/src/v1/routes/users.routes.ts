import { Router } from "express";
import { validateUuidParam } from "../middleware/validate";
import { getUsers, getUser, postUser, patchUser } from "../controllers/users.controller";

const router = Router();

router.get("/",     getUsers);
router.get("/:id",  validateUuidParam, getUser);
router.post("/",    postUser);
router.patch("/:id", validateUuidParam, patchUser);

export default router;
