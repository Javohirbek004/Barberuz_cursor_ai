import { Router } from "express";
import { db, servicesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticate, getUser } from "../lib/auth";

const router = Router();

function formatService(s: typeof servicesTable.$inferSelect) {
  return {
    id: s.id,
    barberId: s.barberId,
    name: s.name,
    nameRu: s.nameRu,
    categoryId: s.categoryId ?? null,
    duration: s.duration,
    price: Number(s.price),
    isActive: s.isActive,
    createdAt: s.createdAt,
  };
}

router.get("/", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const services = await db.select().from(servicesTable)
      .where(eq(servicesTable.barberId, user.id))
      .orderBy(servicesTable.createdAt);
    res.json({ services: services.map(formatService) });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

router.post("/", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { name, nameRu, categoryId, duration, price } = req.body;
    if (!name || !duration || price === undefined) {
      res.status(400).json({ error: "validation", message: "Missing required fields" });
      return;
    }
    const [service] = await db.insert(servicesTable).values({
      barberId: user.id,
      name,
      nameRu: nameRu || null,
      categoryId: categoryId || null,
      duration,
      price: price.toString(),
    }).returning();
    res.status(201).json(formatService(service));
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

router.put("/:serviceId", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { name, nameRu, categoryId, duration, price, isActive } = req.body;
    const [service] = await db.update(servicesTable)
      .set({
        ...(name !== undefined && { name }),
        ...(nameRu !== undefined && { nameRu }),
        ...(categoryId !== undefined && { categoryId: categoryId || null }),
        ...(duration !== undefined && { duration }),
        ...(price !== undefined && { price: price.toString() }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      })
      .where(and(eq(servicesTable.id, req.params.serviceId), eq(servicesTable.barberId, user.id)))
      .returning();
    if (!service) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(formatService(service));
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

router.delete("/:serviceId", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    await db.delete(servicesTable)
      .where(and(eq(servicesTable.id, req.params.serviceId), eq(servicesTable.barberId, user.id)));
    res.json({ success: true, message: "Service deleted" });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
