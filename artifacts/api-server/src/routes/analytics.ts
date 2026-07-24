import { Router } from "express";
import { db, bookingsTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, isNull } from "drizzle-orm";
import { authenticate, getUser } from "../lib/auth";

const router = Router();

function getTz() {
  return "Asia/Tashkent";
}

function todayStr() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: getTz() });
}

function getDateRange(period: string): { start: string; end: string } {
  const tz = getTz();
  const today = todayStr();
  if (period === "today") {
    return { start: today, end: today };
  }
  if (period === "week") {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return { start: d.toLocaleDateString("sv-SE", { timeZone: tz }), end: today };
  }
  // month (30 days)
  const d = new Date();
  d.setDate(d.getDate() - 29);
  return { start: d.toLocaleDateString("sv-SE", { timeZone: tz }), end: today };
}

function getPrevDateRange(period: string): { start: string; end: string } {
  const tz = getTz();
  if (period === "today") {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const s = d.toLocaleDateString("sv-SE", { timeZone: tz });
    return { start: s, end: s };
  }
  if (period === "week") {
    const end = new Date();
    end.setDate(end.getDate() - 7);
    const start = new Date();
    start.setDate(start.getDate() - 13);
    return {
      start: start.toLocaleDateString("sv-SE", { timeZone: tz }),
      end: end.toLocaleDateString("sv-SE", { timeZone: tz }),
    };
  }
  // month
  const end = new Date();
  end.setDate(end.getDate() - 30);
  const start = new Date();
  start.setDate(start.getDate() - 59);
  return {
    start: start.toLocaleDateString("sv-SE", { timeZone: tz }),
    end: end.toLocaleDateString("sv-SE", { timeZone: tz }),
  };
}

function peakHour(bookings: { startTime: string }[]): string {
  const hourCount: Record<number, number> = {};
  for (const b of bookings) {
    const h = parseInt(b.startTime.split(":")[0]);
    if (!isNaN(h)) {
      hourCount[h] = (hourCount[h] || 0) + 1;
    }
  }
  const entries = Object.entries(hourCount);
  if (!entries.length) return "—";
  entries.sort((a, b) => Number(b[1]) - Number(a[1]));
  const top = parseInt(entries[0][0]);
  return `${String(top).padStart(2, "0")}:00 – ${String(top + 2).padStart(2, "0")}:00`;
}

function generateSoloTips(
  revenue: number,
  revChange: number,
  cancelled: number,
  totalBookings: number,
  topServiceName: string | null,
  period: string,
): string[] {
  const tips: string[] = [];
  if (revChange > 0) tips.push(`Daromad +${revChange}% o'sdi`);
  else if (revChange < 0) tips.push(`Daromad ${revChange}% kamaydi`);
  if (topServiceName) tips.push(`${topServiceName} eng daromadli xizmat`);
  if (totalBookings > 0) {
    const cancelRate = Math.round((cancelled / (totalBookings + cancelled)) * 100);
    if (cancelRate > 20) tips.push("Bekor qilishlar yuqori — mijozlarga eslatma yuboring");
    else if (cancelRate === 0) tips.push("Hech qanday bekor qilish yo'q — ajoyib natija!");
  }
  if (revenue === 0) tips.push("Hali bronlar yo'q — profil to'ldiring va reklama qiling");
  if (tips.length === 0) tips.push("Statistika to'planmoqda");
  return tips.slice(0, 3);
}

function generateTeamTips(
  bestName: string | null,
  mostCancelledName: string | null,
  revChange: number,
): string[] {
  const tips: string[] = [];
  if (revChange > 0) tips.push(`Jamoa daromadi +${revChange}% o'sdi`);
  if (bestName) tips.push(`${bestName} bugun eng ko'p daromad qildi`);
  if (mostCancelledName) tips.push(`${mostCancelledName}da bekor qilishlar ko'p — nazorat qiling`);
  if (tips.length === 0) tips.push("Statistika to'planmoqda");
  return tips.slice(0, 3);
}

function calcRevChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// ── Solo analytics endpoint ────────────────────────────────────────────────────

router.get("/solo", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const period = (req.query.period as string) || "month";
    const { start, end } = getDateRange(period);
    const { start: prevStart, end: prevEnd } = getPrevDateRange(period);

    const [bookings, prevBookings] = await Promise.all([
      db.select().from(bookingsTable).where(
        and(
          eq(bookingsTable.barberId, user.id),
          gte(bookingsTable.date, start),
          lte(bookingsTable.date, end),
          isNull(bookingsTable.deletedAt),
        ),
      ),
      db.select().from(bookingsTable).where(
        and(
          eq(bookingsTable.barberId, user.id),
          gte(bookingsTable.date, prevStart),
          lte(bookingsTable.date, prevEnd),
          isNull(bookingsTable.deletedAt),
        ),
      ),
    ]);

    const completed = bookings.filter(b => b.status === "completed");
    const cancelled = bookings.filter(b => b.status === "cancelled");
    const prevCompleted = prevBookings.filter(b => b.status === "completed");

    const revenue = completed.reduce((s, b) => s + Number(b.price), 0);
    const prevRevenue = prevCompleted.reduce((s, b) => s + Number(b.price), 0);
    const revChange = calcRevChange(revenue, prevRevenue);

    const uniqueClients = new Set(completed.filter(b => b.clientId).map(b => b.clientId)).size;

    const serviceCount: Record<string, { count: number; revenue: number }> = {};
    for (const b of completed) {
      const name = b.serviceName || "Boshqa";
      if (!serviceCount[name]) serviceCount[name] = { count: 0, revenue: 0 };
      serviceCount[name].count++;
      serviceCount[name].revenue += Number(b.price);
    }
    const topServices = Object.entries(serviceCount)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
    const topService = topServices[0] ?? null;

    const busiestTime = peakHour(completed);

    const tips = generateSoloTips(
      revenue,
      revChange,
      cancelled.length,
      completed.length,
      topService?.name ?? null,
      period,
    );

    res.json({
      period,
      revenue,
      revChange,
      clients: uniqueClients || completed.length,
      activeBookings: completed.length,
      totalBookings: bookings.length,
      cancelled: cancelled.length,
      noshow: 0,
      topService: topService
        ? { name: topService.name, count: topService.count, revenue: topService.revenue }
        : null,
      busiestTime,
      tips,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

// ── Team analytics endpoint ────────────────────────────────────────────────────
// NOTE: Currently restricted to the authenticated user's own data only.
// A proper invite-based team membership model is required before multi-barber
// aggregation can be safely unlocked (see follow-up task for Barbers page).

router.get("/team", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const period = (req.query.period as string) || "month";
    const { start, end } = getDateRange(period);
    const { start: prevStart, end: prevEnd } = getPrevDateRange(period);

    const [bookings, prevBookings] = await Promise.all([
      db.select().from(bookingsTable).where(
        and(
          eq(bookingsTable.barberId, user.id),
          gte(bookingsTable.date, start),
          lte(bookingsTable.date, end),
          isNull(bookingsTable.deletedAt),
        ),
      ),
      db.select().from(bookingsTable).where(
        and(
          eq(bookingsTable.barberId, user.id),
          gte(bookingsTable.date, prevStart),
          lte(bookingsTable.date, prevEnd),
          isNull(bookingsTable.deletedAt),
        ),
      ),
    ]);

    const completed = bookings.filter(b => b.status === "completed");
    const cancelled = bookings.filter(b => b.status === "cancelled");
    const prevCompleted = prevBookings.filter(b => b.status === "completed");

    const revenue = completed.reduce((s, b) => s + Number(b.price), 0);
    const prevRevenue = prevCompleted.reduce((s, b) => s + Number(b.price), 0);
    const revChange = calcRevChange(revenue, prevRevenue);
    const uniqueClients = new Set(completed.filter(b => b.clientId).map(b => b.clientId)).size;

    const ownStats = {
      id: user.id,
      name: user.name,
      medal: "🥇",
      revenue,
      clients: uniqueClients || completed.length,
      cancelled: cancelled.length,
    };

    const tips = generateTeamTips(user.name, null, revChange);

    res.json({
      period,
      revenue,
      revChange,
      clients: uniqueClients || completed.length,
      activeBookings: completed.length,
      totalBookings: bookings.length,
      cancelled: cancelled.length,
      noshow: 0,
      barbers: [ownStats],
      bestBarber: user.name,
      mostNoshow: null,
      tips,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

// ── Barber detail endpoint ────────────────────────────────────────────────────

// NOTE: Currently restricted to self-only access. Multi-barber access requires
// a proper invite-based team membership model (see follow-up task for Barbers page).
router.get("/barber/:barberId", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const period = (req.query.period as string) || "month";
    const { barberId } = req.params;
    const { start, end } = getDateRange(period);

    // Strict self-only: only the barber can view their own detail analytics.
    if (user.id !== barberId) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const [barberRows, bookings] = await Promise.all([
      db.select({ id: usersTable.id, name: usersTable.name })
        .from(usersTable)
        .where(eq(usersTable.id, barberId))
        .limit(1),
      db.select().from(bookingsTable).where(
        and(
          eq(bookingsTable.barberId, barberId),
          gte(bookingsTable.date, start),
          lte(bookingsTable.date, end),
          isNull(bookingsTable.deletedAt),
        ),
      ),
    ]);

    if (!barberRows.length) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const active = bookings.filter(b => b.status !== "cancelled");
    const cancelled = bookings.filter(b => b.status === "cancelled");

    const revenue = active.reduce((s, b) => s + Number(b.price), 0);
    const uniqueClients = new Set(active.filter(b => b.clientId).map(b => b.clientId)).size;

    const serviceCount: Record<string, { count: number; revenue: number }> = {};
    for (const b of active) {
      const name = b.serviceName || "Boshqa";
      if (!serviceCount[name]) serviceCount[name] = { count: 0, revenue: 0 };
      serviceCount[name].count++;
      serviceCount[name].revenue += Number(b.price);
    }
    const topServices = Object.entries(serviceCount)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
    const topService = topServices[0] ?? null;

    const busiestTime = peakHour(active);

    // Daily breakdown — last 7 days within the period
    const dailyMap: Record<string, { clients: number; revenue: number }> = {};
    for (const b of active) {
      if (!dailyMap[b.date]) dailyMap[b.date] = { clients: 0, revenue: 0 };
      dailyMap[b.date].clients++;
      dailyMap[b.date].revenue += Number(b.price);
    }
    const sortedDates = Object.keys(dailyMap).sort().slice(-7);
    const UZ_DAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
    const daily = sortedDates.map(d => {
      const dow = new Date(d).getDay();
      return {
        day: UZ_DAYS[dow],
        clients: dailyMap[d].clients,
        revenue: dailyMap[d].revenue,
      };
    });

    const cancelRate = active.length > 0
      ? Math.round((cancelled.length / (active.length + cancelled.length)) * 100) : 0;
    const tips: string[] = [];
    if (topService) tips.push(`${topService.name} eng daromadli xizmat`);
    if (cancelRate > 20) tips.push("Bekor qilishlar yuqori — eslatma yuboring");
    else if (cancelRate === 0 && active.length > 0) tips.push("Hech qanday bekor qilish yo'q");
    if (revenue === 0) tips.push("Hali bronlar yo'q");
    if (tips.length === 0) tips.push("Statistika to'planmoqda");

    res.json({
      barberId,
      name: barberRows[0].name,
      period,
      revenue,
      clients: uniqueClients || active.length,
      activeBookings: active.length,
      totalBookings: bookings.length,
      cancelled: cancelled.length,
      noshow: 0,
      topService: topService ? { name: topService.name, count: topService.count } : null,
      busiestTime,
      daily,
      tips,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
