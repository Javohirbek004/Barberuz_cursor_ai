import { Router } from "express";
import { db, bookingsTable, clientsTable, servicesTable } from "@workspace/db";
import { eq, and, sql, or } from "drizzle-orm";
import { authenticate, getUser } from "../lib/auth";
import { sendDirectBookingNotification } from "../lib/telegram-bot";

const router = Router();

/**
 * Find an existing client by phone number for this barber, or create a new one.
 * Returns the clientId and whether stats were already updated (true if existing).
 */
async function findOrCreateClient(
  barberId: string,
  clientName: string,
  clientPhone: string,
  price: number,
): Promise<string> {
  const normalizedPhone = clientPhone.replace(/\s+/g, "");
  const bookingDate = new Date();

  const [existing] = await db
    .select()
    .from(clientsTable)
    .where(and(eq(clientsTable.barberId, barberId), eq(clientsTable.phone, normalizedPhone)))
    .limit(1);

  if (existing) {
    await db.update(clientsTable)
      .set({
        visitCount: sql`${clientsTable.visitCount} + 1`,
        totalSpent: sql`${clientsTable.totalSpent} + ${price}`,
        lastVisit: bookingDate,
        updatedAt: bookingDate,
      })
      .where(eq(clientsTable.id, existing.id));
    return existing.id;
  }

  const [newClient] = await db.insert(clientsTable).values({
    barberId,
    name: clientName,
    phone: normalizedPhone,
    status: "new",
    visitCount: 1,
    totalSpent: String(price),
    lastVisit: bookingDate,
  }).returning();
  return newClient.id;
}

function formatBooking(b: typeof bookingsTable.$inferSelect) {
  return {
    id: b.id,
    barberId: b.barberId,
    clientId: b.clientId,
    clientName: b.clientName,
    serviceId: b.serviceId,
    serviceName: b.serviceName,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    price: Number(b.price),
    status: b.status,
    notes: b.notes,
    createdAt: b.createdAt,
  };
}

router.get("/", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { date, status, clientId } = req.query as Record<string, string>;
    const conditions = [eq(bookingsTable.barberId, user.id)];
    if (date && date !== "today") conditions.push(eq(bookingsTable.date, date));
    if (date === "today") {
      const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
      conditions.push(eq(bookingsTable.date, today));
    }
    if (status) conditions.push(eq(bookingsTable.status, status as any));
    if (clientId) conditions.push(eq(bookingsTable.clientId, clientId));

    const bookings = await db.select().from(bookingsTable)
      .where(and(...conditions))
      .orderBy(bookingsTable.date, bookingsTable.startTime);

    res.json({ bookings: bookings.map(formatBooking), total: bookings.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

router.post("/", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { clientId, clientPhone, clientName, serviceId, date, startTime, endTime, price, notes } = req.body;
    if (!clientName || !date || !startTime || !endTime) {
      res.status(400).json({ error: "validation", message: "Missing required fields" });
      return;
    }

    // Auto-resolve service name from serviceId
    let resolvedServiceName: string | null = null;
    if (serviceId) {
      const [svc] = await db
        .select({ name: servicesTable.name })
        .from(servicesTable)
        .where(eq(servicesTable.id, serviceId))
        .limit(1);
      resolvedServiceName = svc?.name ?? null;
    }

    // Smart client resolution:
    // 1. If phone provided → find-or-create by phone (deduplicates, updates stats)
    // 2. Else if explicit clientId → update that client's stats
    // 3. Otherwise → booking with no client link
    let resolvedClientId: string | null = clientId || null;
    const numericPrice = Number(price) || 0;

    const rawPhone = (typeof clientPhone === "string" ? clientPhone : "").trim();
    if (rawPhone) {
      try {
        resolvedClientId = await findOrCreateClient(user.id, clientName, rawPhone, numericPrice);
      } catch (err) {
        console.warn("[Bookings] findOrCreateClient failed:", (err as Error).message);
      }
    } else if (resolvedClientId) {
      // Phone not provided but clientId was given — update stats directly
      await db.update(clientsTable)
        .set({
          visitCount: sql`${clientsTable.visitCount} + 1`,
          totalSpent: sql`${clientsTable.totalSpent} + ${numericPrice}`,
          lastVisit: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(clientsTable.id, resolvedClientId), eq(clientsTable.barberId, user.id)));
    }

    const [booking] = await db.insert(bookingsTable).values({
      barberId: user.id,
      clientId: resolvedClientId,
      clientName,
      serviceId: serviceId || null,
      serviceName: resolvedServiceName,
      date,
      startTime,
      endTime,
      price: numericPrice.toString(),
      notes: notes || null,
      status: "confirmed",
    }).returning();

    // Send Telegram notification to barber (non-blocking — never crashes booking flow)
    sendDirectBookingNotification({
      barberId: user.id,
      clientName,
      clientPhone: rawPhone || null,
      serviceName: resolvedServiceName,
      date,
      time: startTime,
      price: numericPrice,
    }).catch(() => {});

    res.status(201).json(formatBooking(booking));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

router.get("/:bookingId", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const [booking] = await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.id, req.params.bookingId), eq(bookingsTable.barberId, user.id)))
      .limit(1);
    if (!booking) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(formatBooking(booking));
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

router.put("/:bookingId", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { clientName, serviceId, date, startTime, endTime, price, status, notes } = req.body;
    const [booking] = await db.update(bookingsTable)
      .set({
        ...(clientName !== undefined && { clientName }),
        ...(serviceId !== undefined && { serviceId }),
        ...(date !== undefined && { date }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(price !== undefined && { price: price.toString() }),
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
        updatedAt: new Date(),
      })
      .where(and(eq(bookingsTable.id, req.params.bookingId), eq(bookingsTable.barberId, user.id)))
      .returning();
    if (!booking) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(formatBooking(booking));
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

router.patch("/:bookingId", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const { clientName, serviceId, date, startTime, endTime, price, status, notes } = req.body;
    const [booking] = await db.update(bookingsTable)
      .set({
        ...(clientName !== undefined && { clientName }),
        ...(serviceId !== undefined && { serviceId }),
        ...(date !== undefined && { date }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(price !== undefined && { price: price.toString() }),
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
        updatedAt: new Date(),
      })
      .where(and(eq(bookingsTable.id, req.params.bookingId), eq(bookingsTable.barberId, user.id)))
      .returning();
    if (!booking) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(formatBooking(booking));
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

router.delete("/:bookingId", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    await db.delete(bookingsTable)
      .where(and(eq(bookingsTable.id, req.params.bookingId), eq(bookingsTable.barberId, user.id)));
    res.json({ success: true, message: "Booking deleted" });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
