import { Router, type Request, type Response } from "express";
import { db, bookingsTable, bookingSessionsTable, servicesTable } from "@workspace/db";
import { eq, and, gte, lt, lte, inArray, isNull } from "drizzle-orm";
import { authenticate, getUser } from "../lib/auth";
import { sendDirectBookingNotification } from "../lib/telegram-bot";
import { deliverBookingReceipt, notifyClientOfBarberChange } from "../lib/client-notifications";
import { syncClientMetrics } from "../lib/client-metrics";
import { findOrCreateClientByPhone } from "../lib/client-lookup";
import { normalizePhone } from "../lib/phone";
import {
  findBookingConflict,
  isCalendarDate,
  isInactiveStatus,
  minsToTime,
  parseClockTime,
  timeToMins,
} from "../lib/booking-conflicts";

const router = Router();

/** How far back the review list looks for bookings nobody marked. */
const OVERDUE_DAYS = 60;

const BOOKING_STATUSES = new Set([
  "pending", "confirmed", "completed", "cancelled", "auto_cancelled", "no_show",
]);

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
    if (date === "today") {
      const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
      conditions.push(eq(bookingsTable.date, today));
    } else if (date === "upcoming") {
      // Return confirmed/pending bookings from today onward (next 30 days)
      const todayDate = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 30);
      const maxDateStr = maxDate.toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
      conditions.push(gte(bookingsTable.date, todayDate));
      conditions.push(lte(bookingsTable.date, maxDateStr));
      conditions.push(inArray(bookingsTable.status, ["confirmed", "pending"]));
    } else if (date === "overdue") {
      // Earlier days that still wait for Keldi / Kelmadi. They stay on the review list
      // until the barber marks them, so no visit or payment is silently lost.
      const todayDate = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
      const oldest = new Date();
      oldest.setDate(oldest.getDate() - OVERDUE_DAYS);
      const oldestDate = oldest.toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
      conditions.push(lt(bookingsTable.date, todayDate));
      conditions.push(gte(bookingsTable.date, oldestDate));
      conditions.push(inArray(bookingsTable.status, ["confirmed", "pending"]));
      conditions.push(isNull(bookingsTable.deletedAt));
    } else if (date) {
      conditions.push(eq(bookingsTable.date, date));
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

    // "Oraliq tanaffus": keep the barber's preparation gap between two services.
    const bufferMins = typeof user.bufferTime === "number" ? user.bufferTime : 10;
    const clash = await findBookingConflict({
      barberId: user.id,
      date,
      startTime,
      endTime,
      bufferMins,
    });
    if (clash) {
      res.status(409).json({ error: "conflict", message: "Tanlangan vaqt allaqachon band" });
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
    // Link the client, but do not count a visit until the booking is completed.
    let resolvedClientId: string | null = clientId || null;
    const numericPrice = Number(price) || 0;

    const typedPhone = (typeof clientPhone === "string" ? clientPhone : "").trim();
    // Saved in one standard form (+998XXXXXXXXX) so the same person is never split in two.
    const rawPhone = normalizePhone(typedPhone) ?? typedPhone;
    if (rawPhone) {
      try {
        resolvedClientId = (await findOrCreateClientByPhone(user.id, clientName, rawPhone)) ?? resolvedClientId;
      } catch (err) {
        console.warn("[Bookings] findOrCreateClient failed:", (err as Error).message);
      }
    }

    let [booking] = await db.insert(bookingsTable).values({
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

    if (booking && rawPhone) {
      const sent = await deliverBookingReceipt(booking.id, { phone: rawPhone }).catch(() => false);
      if (sent) {
        const [fresh] = await db.select().from(bookingsTable).where(eq(bookingsTable.id, booking.id)).limit(1);
        if (fresh) booking = fresh;
      }
    }

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

type ScheduleResult =
  | { ok: true; date: string; startTime: string; endTime: string }
  | { ok: false; message: string };

/**
 * The day and times a booking will have after an edit. A new start time on its own
 * keeps the booking's length. Wrong dates, wrong times and an end before the start are refused.
 */
function resolveSchedule(
  before: typeof bookingsTable.$inferSelect,
  sent: { date?: unknown; startTime?: unknown; endTime?: unknown },
): ScheduleResult {
  let date = before.date;
  if (sent.date !== undefined) {
    if (!isCalendarDate(sent.date)) return { ok: false, message: "Sana noto'g'ri" };
    date = sent.date;
  }

  const oldStart = parseClockTime(before.startTime) ?? "00:00";
  const oldEnd = parseClockTime(before.endTime) ?? oldStart;
  let startTime = oldStart;
  if (sent.startTime !== undefined) {
    const parsed = parseClockTime(sent.startTime);
    if (!parsed) return { ok: false, message: "Boshlanish vaqti noto'g'ri" };
    startTime = parsed;
  }

  let endTime = oldEnd;
  if (sent.endTime !== undefined) {
    const parsed = parseClockTime(sent.endTime);
    if (!parsed) return { ok: false, message: "Tugash vaqti noto'g'ri" };
    endTime = parsed;
  } else if (sent.startTime !== undefined) {
    const length = Math.max(timeToMins(oldEnd) - timeToMins(oldStart), 1);
    const shifted = timeToMins(startTime) + length;
    if (shifted > 23 * 60 + 59) return { ok: false, message: "Tugash vaqti kechadan oshib ketadi" };
    endTime = minsToTime(shifted);
  }

  if (timeToMins(endTime) <= timeToMins(startTime)) {
    return { ok: false, message: "Tugash vaqti boshlanishdan keyin bo'lishi kerak" };
  }
  return { ok: true, date, startTime, endTime };
}

function isOpenStatus(status: string): boolean {
  return status === "confirmed" || status === "pending";
}

async function updateBooking(req: Request, res: Response) {
  try {
    const user = getUser(req);
    const bookingId = String(req.params.bookingId);
    const { clientName, serviceId, date, startTime, endTime, price, status, notes } = req.body;
    if (status !== undefined && !BOOKING_STATUSES.has(status)) {
      res.status(400).json({ error: "validation", message: "Unknown status" });
      return;
    }

    const [before] = await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.barberId, user.id)))
      .limit(1);
    if (!before) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const scheduleSent = date !== undefined || startTime !== undefined || endTime !== undefined;
    let nextDate = before.date;
    let nextStart = before.startTime.slice(0, 5);
    let nextEnd = before.endTime.slice(0, 5);
    if (scheduleSent) {
      const checked = resolveSchedule(before, { date, startTime, endTime });
      if (!checked.ok) {
        res.status(400).json({ error: "validation", message: checked.message });
        return;
      }
      ({ date: nextDate, startTime: nextStart, endTime: nextEnd } = checked);
    }
    const timeMoved = nextDate !== before.date
      || nextStart !== before.startTime.slice(0, 5)
      || nextEnd !== before.endTime.slice(0, 5);

    // A moved or re-opened booking must not land on a time that is already taken.
    const nextStatus = status !== undefined ? status : before.status;
    const reopened = isInactiveStatus(before.status) && !isInactiveStatus(nextStatus);
    if (!isInactiveStatus(nextStatus) && (timeMoved || reopened)) {
      const clash = await findBookingConflict({
        barberId: user.id,
        date: nextDate,
        startTime: nextStart,
        endTime: nextEnd,
        bufferMins: typeof user.bufferTime === "number" ? user.bufferTime : 10,
        exceptBookingId: before.id,
      });
      if (clash) {
        res.status(409).json({ error: "conflict", message: "Tanlangan vaqt allaqachon band" });
        return;
      }
    }

    const [booking] = await db.update(bookingsTable)
      .set({
        ...(clientName !== undefined && { clientName }),
        ...(serviceId !== undefined && { serviceId }),
        ...(scheduleSent && { date: nextDate, startTime: nextStart, endTime: nextEnd }),
        ...(timeMoved && { reminded24h: false, reminded1h: false, remindedFollowup: false }),
        ...(price !== undefined && { price: price.toString() }),
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
        updatedAt: new Date(),
      })
      .where(and(eq(bookingsTable.id, bookingId), eq(bookingsTable.barberId, user.id)))
      .returning();
    if (!booking) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (status !== undefined || price !== undefined) {
      await syncClientMetrics(booking.clientId, user.id);
    }

    const wasOpen = isOpenStatus(before.status);
    if (wasOpen && booking.status === "cancelled") {
      // The online booking no longer needs its "15 minutes left" reminder either.
      await db.update(bookingSessionsTable)
        .set({ status: "cancelled" })
        .where(eq(bookingSessionsTable.bookingId, booking.id))
        .catch(() => {});
      notifyClientOfBarberChange(booking.id, { kind: "cancelled" }).catch((err) =>
        console.warn("[Bookings] cancel notice failed:", (err as Error).message));
    } else if (wasOpen && isOpenStatus(booking.status) && timeMoved) {
      notifyClientOfBarberChange(booking.id, {
        kind: "rescheduled",
        from: { date: before.date, time: before.startTime.slice(0, 5) },
      }).catch((err) => console.warn("[Bookings] reschedule notice failed:", (err as Error).message));
    }

    res.json(formatBooking(booking));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
}

router.put("/:bookingId", authenticate, updateBooking);
router.patch("/:bookingId", authenticate, updateBooking);

router.delete("/:bookingId", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const [removed] = await db.delete(bookingsTable)
      .where(and(eq(bookingsTable.id, req.params.bookingId), eq(bookingsTable.barberId, user.id)))
      .returning({ clientId: bookingsTable.clientId });
    await syncClientMetrics(removed?.clientId, user.id);
    res.json({ success: true, message: "Booking deleted" });
  } catch (err) {
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
