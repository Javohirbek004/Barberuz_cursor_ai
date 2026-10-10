import { Router } from "express";
import { db, clientsTable, bookingsTable } from "@workspace/db";
import { eq, and, ilike, count, or, sql, isNull, desc } from "drizzle-orm";
import { authenticate, getUser } from "../lib/auth";
import { findClientByPhone } from "../lib/client-lookup";
import { normalizePhone, phoneDigits, sqlPhoneDigits } from "../lib/phone";

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

type PhoneChange =
  | { ok: true; value: string | null }
  | { ok: false; status: number; body: Record<string, unknown> };

/** Standard form for a phone typed by the barber, or the reason it cannot be saved. */
async function resolvePhoneChange(barberId: string, clientId: string, phone: unknown): Promise<PhoneChange> {
  const typed = typeof phone === "string" ? phone.trim() : "";
  if (!typed) return { ok: true, value: null };
  const standard = normalizePhone(typed);
  if (!standard) {
    return { ok: false, status: 400, body: { error: "validation", message: "Telefon raqami noto'g'ri" } };
  }
  const other = await findClientByPhone(barberId, standard, clientId);
  if (other) {
    return {
      ok: false,
      status: 409,
      body: { error: "duplicate", message: "Bu telefon raqami boshqa mijozda saqlangan", clientId: other.id },
    };
  }
  return { ok: true, value: standard };
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

    const term = (search || "").trim();
    if (term) {
      // A number can be typed with spaces, brackets or dashes. Compare digits only.
      const typedDigits = phoneDigits(term);
      const matches = [
        ilike(clientsTable.name, `%${term}%`),
        ilike(clientsTable.phone, `%${term}%`),
      ];
      if (typedDigits.length >= 2) {
        matches.push(sql`${sqlPhoneDigits(clientsTable.phone)} like ${`%${typedDigits}%`}`);
      }
      conditions.push(or(...matches));
    }

    const where = and(...conditions);
    const clients = await db.select().from(clientsTable)
      .where(where)
      // People who really came are listed first, the most recent visitor on top.
      // Clients who only booked and never came follow, newest first.
      .orderBy(
        sql`(${clientsTable.visitCount} > 0) DESC`,
        sql`${clientsTable.lastVisit} DESC NULLS LAST`,
        desc(clientsTable.visitCount),
        desc(clientsTable.createdAt),
      )
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
    const typedPhone = typeof phone === "string" ? phone.trim() : "";
    const standardPhone = typedPhone ? normalizePhone(typedPhone) : null;
    if (typedPhone && !standardPhone) {
      res.status(400).json({ error: "validation", message: "Telefon raqami noto'g'ri" });
      return;
    }
    if (standardPhone) {
      const sameNumber = await findClientByPhone(user.id, standardPhone);
      if (sameNumber) {
        res.status(200).json(formatClient(sameNumber));
        return;
      }
    }
    const [client] = await db.insert(clientsTable).values({
      barberId: user.id,
      name,
      phone: standardPhone,
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
    let phoneValue: string | null | undefined;
    if (phone !== undefined) {
      const change = await resolvePhoneChange(user.id, String(req.params.clientId), phone);
      if (!change.ok) {
        res.status(change.status).json(change.body);
        return;
      }
      phoneValue = change.value;
    }
    const [client] = await db.update(clientsTable)
      .set({
        ...(name !== undefined && { name }),
        ...(phoneValue !== undefined && { phone: phoneValue }),
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
    let phoneValue: string | null | undefined;
    if (phone !== undefined) {
      const change = await resolvePhoneChange(user.id, String(req.params.clientId), phone);
      if (!change.ok) {
        res.status(change.status).json(change.body);
        return;
      }
      phoneValue = change.value;
    }
    const [client] = await db.update(clientsTable)
      .set({
        ...(name !== undefined && { name }),
        ...(phoneValue !== undefined && { phone: phoneValue }),
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
