import { Router } from "express";
import { db, clientsTable, bookingsTable } from "@workspace/db";
import { eq, and, ilike, count, or, sql, isNull, desc } from "drizzle-orm";
import { authenticate, getUser } from "../lib/auth";

const router = Router();

function computeStatus(c: typeof clientsTable.$inferSelect): "regular" | "new" | "lost" {
  const now = new Date();
  if (c.lastVisit) {
    const daysSince = (now.getTime() - new Date(c.lastVisit).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 30) return "lost";
  }
  if (c.visitCount >= 5) return "regular";
  return "new";
}

function formatClient(c: typeof clientsTable.$inferSelect) {
  return {
    id: c.id,
    barberId: c.barberId,
    name: c.name,
    phone: c.phone,
    telegramId: c.telegramId,
    notes: c.notes,
    status: computeStatus(c),
    visitCount: c.visitCount,
    totalSpent: Number(c.totalSpent),
    lastVisit: c.lastVisit ? c.lastVisit.toISOString() : null,
    createdAt: c.createdAt,
  };
}

router.get("/", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { filter, search, page = "1", limit = "20" } = req.query as Record<string, string>;
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const offset = (pageNum - 1) * limitNum;

    const conditions: any[] = [eq(clientsTable.barberId, user.id)];

    if (filter && filter !== "all") {
      if (filter === "lost") {
        conditions.push(sql`${clientsTable.lastVisit} < NOW() - INTERVAL '30 days'`);
      } else if (filter === "regular") {
        conditions.push(sql`${clientsTable.visitCount} >= 5`);
        conditions.push(sql`(${clientsTable.lastVisit} IS NULL OR ${clientsTable.lastVisit} >= NOW() - INTERVAL '30 days')`);
      } else if (filter === "new") {
        conditions.push(sql`${clientsTable.visitCount} < 5`);
        conditions.push(sql`(${clientsTable.lastVisit} IS NULL OR ${clientsTable.lastVisit} >= NOW() - INTERVAL '30 days')`);
      }
    }

    if (search) {
      conditions.push(
        or(
          ilike(clientsTable.name, `%${search}%`),
          ilike(clientsTable.phone, `%${search}%`)
        )
      );
    }

    const where = and(...conditions);
    const clients = await db.select().from(clientsTable)
      .where(where)
      .orderBy(desc(clientsTable.lastVisit), desc(clientsTable.createdAt))
      .limit(limitNum)
      .offset(offset);

    const [{ value: total }] = await db.select({ value: count() }).from(clientsTable).where(where);

    res.json({ clients: clients.map(formatClient), total: Number(total), page: pageNum, limit: limitNum });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

router.post("/", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { name, phone, telegramId, notes, status } = req.body;
    if (!name) {
      res.status(400).json({ error: "validation", message: "Name is required" });
      return;
    }
    const [client] = await db.insert(clientsTable).values({
      barberId: user.id,
      name,
      phone: phone || null,
      telegramId: telegramId || null,
      notes: notes || null,
      status: status || "new",
    }).returning();
    res.status(201).json(formatClient(client));
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

router.get("/:clientId/bookings", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const [client] = await db.select({ id: clientsTable.id }).from(clientsTable)
      .where(and(eq(clientsTable.id, req.params.clientId), eq(clientsTable.barberId, user.id)))
      .limit(1);
    if (!client) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const bookings = await db.select({
      id: bookingsTable.id,
      date: bookingsTable.date,
      serviceName: bookingsTable.serviceName,
      price: bookingsTable.price,
      status: bookingsTable.status,
    }).from(bookingsTable)
      .where(and(
        eq(bookingsTable.clientId, req.params.clientId),
        eq(bookingsTable.barberId, user.id),
        isNull(bookingsTable.deletedAt),
      ))
      .orderBy(desc(bookingsTable.date))
      .limit(50);
    res.json({
      bookings: bookings.map((b) => ({
        id: b.id,
        date: b.date,
        serviceName: b.serviceName ?? "—",
        price: Number(b.price),
        status: b.status,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

router.get("/:clientId", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const [client] = await db.select().from(clientsTable)
      .where(and(eq(clientsTable.id, req.params.clientId), eq(clientsTable.barberId, user.id)))
      .limit(1);
    if (!client) {
      res.status(404).json({ error: "not_found", message: "Client not found" });
      return;
    }
    res.json(formatClient(client));
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

router.put("/:clientId", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { name, phone, telegramId, notes, status } = req.body;
    const [client] = await db.update(clientsTable)
      .set({
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(telegramId !== undefined && { telegramId }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && { status }),
        updatedAt: new Date(),
      })
      .where(and(eq(clientsTable.id, req.params.clientId), eq(clientsTable.barberId, user.id)))
      .returning();
    if (!client) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(formatClient(client));
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

router.patch("/:clientId", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { name, phone, notes } = req.body;
    const [client] = await db.update(clientsTable)
      .set({
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(notes !== undefined && { notes }),
        updatedAt: new Date(),
      })
      .where(and(eq(clientsTable.id, req.params.clientId), eq(clientsTable.barberId, user.id)))
      .returning();
    if (!client) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(formatClient(client));
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

router.delete("/:clientId", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    await db.delete(clientsTable)
      .where(and(eq(clientsTable.id, req.params.clientId), eq(clientsTable.barberId, user.id)));
    res.json({ success: true, message: "Client deleted" });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
