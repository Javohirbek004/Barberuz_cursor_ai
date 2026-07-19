import { Router } from "express";
import { db, bookingsTable, clientsTable, servicesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { authenticate, getUser } from "../lib/auth";

const router = Router();

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
    const { clientId, clientName, serviceId, date, startTime, endTime, price, notes } = req.body;
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

    const [booking] = await db.insert(bookingsTable).values({
      barberId: user.id,
      clientId: clientId || null,
      clientName,
      serviceId: serviceId || null,
      serviceName: resolvedServiceName,
      date,
      startTime,
      endTime,
      price: price?.toString() || "0",
      notes: notes || null,
      status: "confirmed",
    }).returning();

    if (clientId) {
      await db.update(clientsTable)
        .set({
          visitCount: sql`${clientsTable.visitCount} + 1`,
          totalSpent: sql`${clientsTable.totalSpent} + ${price || 0}`,
          lastVisit: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(clientsTable.id, clientId));
    }

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
