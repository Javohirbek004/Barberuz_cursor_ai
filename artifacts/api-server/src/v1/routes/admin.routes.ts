import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth";
import { getExportData, postImportData } from "../controllers/admin.controller";

const router = Router();

// All admin routes require X-Admin-Secret header
router.use(adminAuth);

router.get("/export-data",  getExportData);
router.post("/import-data", postImportData);

export default router;
