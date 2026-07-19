import { Router } from "express";
import { db, serviceCategoriesTable, servicesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticate, getUser } from "../lib/auth";

const router = Router();

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
    // Null-out categoryId on services that belong to this category (safety guard)
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
