import { Router } from "express";
import { db, serviceCategoriesTable, servicesTable } from "@workspace/db";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { authenticate, getUser } from "../lib/auth";

const router = Router();

const NAMERU_TO_LABEL: Record<string, string> = {
  soch: "Soch",
  soqol: "Soqol",
  pakora: "Pakora",
  bola: "Bolalar",
  boshqa: "Boshqa",
  kosmetik: "Kosmetik",
};

function fmt(c: typeof serviceCategoriesTable.$inferSelect) {
  return {
    id: c.id,
    barberId: c.barberId,
    name: c.name,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

router.get("/", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const cats = await db
      .select()
      .from(serviceCategoriesTable)
      .where(eq(serviceCategoriesTable.barberId, user.id))
      .orderBy(serviceCategoriesTable.createdAt);
    res.json({ categories: cats.map(fmt) });
  } catch {
    res.status(500).json({ error: "server_error" });
  }
});

/**
 * POST /api/categories/seed
 * Idempotent: no-op if categories already exist.
 * Seeds from existing services' nameRu values, falling back to "Soch" / "Soqol".
 * Also back-fills services.categoryId where nameRu matches a newly created category.
 */
router.post("/seed", authenticate, async (req, res) => {
  try {
    const user = getUser(req);

    // No-op if categories already exist
    const existing = await db
      .select()
      .from(serviceCategoriesTable)
      .where(eq(serviceCategoriesTable.barberId, user.id));
    if (existing.length > 0) {
      res.json({ seeded: false, categories: existing.map(fmt) });
      return;
    }

    // Gather distinct nameRu values from this barber's services
    const svcs = await db
      .select({ id: servicesTable.id, nameRu: servicesTable.nameRu })
      .from(servicesTable)
      .where(eq(servicesTable.barberId, user.id));

    const distinctNameRus = [
      ...new Set(svcs.map((s) => s.nameRu).filter(Boolean) as string[]),
    ];

    // Map to human names, deduplicated
    const namesToCreate: string[] = [];
    const nameRuToLabel: Record<string, string> = {};
    for (const nr of distinctNameRus) {
      const label = NAMERU_TO_LABEL[nr] ?? nr;
      if (!namesToCreate.includes(label)) {
        namesToCreate.push(label);
        nameRuToLabel[nr] = label;
      }
    }

    // Default to Soch + Soqol when nothing to derive
    if (namesToCreate.length === 0) {
      namesToCreate.push("Soch", "Soqol");
    }

    const created = await db
      .insert(serviceCategoriesTable)
      .values(namesToCreate.map((name) => ({ barberId: user.id, name })))
      .returning();

    // Build label → categoryId lookup
    const labelToId: Record<string, string> = {};
    for (const cat of created) labelToId[cat.name] = cat.id;

    // Back-fill services.categoryId
    for (const svc of svcs) {
      if (!svc.nameRu) continue;
      const label = nameRuToLabel[svc.nameRu];
      const catId = label ? labelToId[label] : undefined;
      if (catId) {
        await db
          .update(servicesTable)
          .set({ categoryId: catId, updatedAt: new Date() })
          .where(and(eq(servicesTable.id, svc.id), isNull(servicesTable.categoryId)));
      }
    }

    res.json({ seeded: true, categories: created.map(fmt) });
  } catch {
    res.status(500).json({ error: "server_error" });
  }
});

router.post("/", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { name } = req.body as { name?: string };
    if (!name?.trim()) {
      res.status(400).json({ error: "validation", message: "Name is required" });
      return;
    }
    const [cat] = await db
      .insert(serviceCategoriesTable)
      .values({ barberId: user.id, name: name.trim() })
      .returning();
    res.status(201).json(fmt(cat));
  } catch {
    res.status(500).json({ error: "server_error" });
  }
});

router.put("/:catId", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { name } = req.body as { name?: string };
    const [cat] = await db
      .update(serviceCategoriesTable)
      .set({
        ...(name !== undefined && { name: name.trim() }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(serviceCategoriesTable.id, req.params.catId),
          eq(serviceCategoriesTable.barberId, user.id),
        ),
      )
      .returning();
    if (!cat) { res.status(404).json({ error: "not_found" }); return; }
    res.json(fmt(cat));
  } catch {
    res.status(500).json({ error: "server_error" });
  }
});

router.delete("/:catId", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    await db
      .update(servicesTable)
      .set({ categoryId: null, updatedAt: new Date() })
      .where(
        and(
          eq(servicesTable.categoryId, req.params.catId),
          eq(servicesTable.barberId, user.id),
        ),
      );
    await db
      .delete(serviceCategoriesTable)
      .where(
        and(
          eq(serviceCategoriesTable.id, req.params.catId),
          eq(serviceCategoriesTable.barberId, user.id),
        ),
      );
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
