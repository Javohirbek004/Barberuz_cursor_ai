import { Router } from "express";
import { db, bookingsTable, usersTable, expensesTable } from "@workspace/db";
import { eq, and, gte, lte, isNull, inArray } from "drizzle-orm";
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

    const [bookings, prevBookings, expenses] = await Promise.all([
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
      db.select().from(expensesTable).where(
        and(
          eq(expensesTable.barberId, user.id),
          gte(expensesTable.date, start),
          lte(expensesTable.date, end),
        ),
      ),
    ]);

    const completed = bookings.filter(b => b.status === "completed" || b.status === "confirmed");
    const cancelled = bookings.filter(b => b.status === "cancelled");
    const prevCompleted = prevBookings.filter(b => b.status === "completed" || b.status === "confirmed");

    const revenue = completed.reduce((s, b) => s + Number(b.price), 0);
    const prevRevenue = prevCompleted.reduce((s, b) => s + Number(b.price), 0);
    const revChange = calcRevChange(revenue, prevRevenue);

    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const netProfit = revenue - totalExpenses;

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
      totalExpenses,
      netProfit,
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

    const [bookings, prevBookings, expenses] = await Promise.all([
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
      db.select().from(expensesTable).where(
        and(
          eq(expensesTable.barberId, user.id),
          gte(expensesTable.date, start),
          lte(expensesTable.date, end),
        ),
      ),
    ]);

    const completed = bookings.filter(b => b.status === "completed" || b.status === "confirmed");
    const cancelled = bookings.filter(b => b.status === "cancelled");
    const prevCompleted = prevBookings.filter(b => b.status === "completed" || b.status === "confirmed");

    const revenue = completed.reduce((s, b) => s + Number(b.price), 0);
    const prevRevenue = prevCompleted.reduce((s, b) => s + Number(b.price), 0);
    const revChange = calcRevChange(revenue, prevRevenue);
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const netProfit = revenue - totalExpenses;
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
      totalExpenses,
      netProfit,
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

// ── Completed-bookings detail endpoint (for Analytics modals) ────────────────

router.get("/detail", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const period = (req.query.period as string) || "month";
    const { start, end } = getDateRange(period);

    const bookings = await db.select().from(bookingsTable).where(
      and(
        eq(bookingsTable.barberId, user.id),
        gte(bookingsTable.date, start),
        lte(bookingsTable.date, end),
        isNull(bookingsTable.deletedAt),
      ),
    );

    const completedBookings = bookings
      .filter(b => b.status === "completed" || b.status === "confirmed")
      .map(b => ({
        id: b.id,
        clientName: b.clientName,
        serviceName: b.serviceName ?? null,
        startTime: b.startTime,
        date: b.date,
        price: Number(b.price),
      }));

    res.json({ completedBookings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

// ── Clients analytics ("Mijozlar tahlili") ─────────────────────────────────────

function addDaysISO(iso: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function daysBetweenISO(from: string, to: string): number {
  const [fy = 1970, fm = 1, fd = 1] = from.split("-").map(Number);
  const [ty = 1970, tm = 1, td = 1] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y = 0, m = 0, d = 0] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Current periods in Tashkent time, capped at today.
 *  today = current day, week = Monday → today, month = 1st → today.
 * Past weeks and months are requested with explicit from/to dates.
 */
function clientPeriodRange(period: string, today: string): { start: string; end: string } {
  if (period === "week") {
    const [y = 1970, m = 1, d = 1] = today.split("-").map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
    const start = addDaysISO(today, -((dow + 6) % 7));
    return { start, end: today };
  }
  if (period === "month") {
    return { start: `${today.slice(0, 7)}-01`, end: today };
  }
  return { start: today, end: today };
}

type ClientSegment = "regular" | "new" | "lost" | null;

/**
 * GET /api/analytics/clients?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Also accepts ?period=today|week|month when from/to are omitted.
 *
 * A "visit" is a confirmed or completed booking that is not in the future.
 *  - all     : clients with at least one visit in the selected range
 *  - regular : of those, clients with 2+ visits in the last 30 days
 *  - new     : clients whose very first visit falls in the selected range
 *  - lost    : visited before, last visit 30+ days ago, nothing booked ahead.
 *              Ranges that include today show every such client. A past range
 *              counts only clients whose last visit sits inside that range.
 */
router.get("/clients", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const today = todayStr();
    const fromQ = typeof req.query.from === "string" ? req.query.from : "";
    const toQ = typeof req.query.to === "string" ? req.query.to : "";
    let period = "range";
    let start: string;
    let end: string;
    if (isISODate(fromQ) && isISODate(toQ)) {
      start = fromQ <= toQ ? fromQ : toQ;
      end = fromQ <= toQ ? toQ : fromQ;
    } else {
      const requested = String(req.query.period ?? "today");
      period = ["today", "week", "month"].includes(requested) ? requested : "today";
      ({ start, end } = clientPeriodRange(period, today));
    }
    const last30Start = addDaysISO(today, -29);
    const lostBefore = addDaysISO(today, -30);

    const rows = await db
      .select({
        clientId: bookingsTable.clientId,
        clientName: bookingsTable.clientName,
        date: bookingsTable.date,
        startTime: bookingsTable.startTime,
        status: bookingsTable.status,
      })
      .from(bookingsTable)
      .where(
        and(
          eq(bookingsTable.barberId, user.id),
          isNull(bookingsTable.deletedAt),
          inArray(bookingsTable.status, ["completed", "confirmed", "pending"]),
        ),
      );

    interface Visit { date: string; time: string }
    interface Agg { name: string; visits: Visit[]; hasUpcoming: boolean }
    const clients = new Map<string, Agg>();

    for (const r of rows) {
      const nameKey = (r.clientName || "").trim().toLowerCase();
      const key = r.clientId ? `id:${r.clientId}` : `name:${nameKey}`;
      if (!r.clientId && !nameKey) continue;
      let agg = clients.get(key);
      if (!agg) {
        agg = { name: r.clientName || "Mijoz", visits: [], hasUpcoming: false };
        clients.set(key, agg);
      }
      if (r.date > today) {
        agg.hasUpcoming = true;
      } else if (r.status === "completed" || r.status === "confirmed") {
        agg.visits.push({ date: r.date, time: r.startTime });
      }
    }

    const segmentCounts = { all: 0, regular: 0, new: 0, lost: 0 };
    const active: Array<{
      name: string;
      visitsInPeriod: number;
      segment: ClientSegment;
      lastVisit: Visit;
      daysAgo: number;
    }> = [];

    for (const agg of clients.values()) {
      if (agg.visits.length === 0) continue;
      agg.visits.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
      const first = agg.visits[0]!;
      const last = agg.visits[agg.visits.length - 1]!;
      const inPeriod = agg.visits.filter((v) => v.date >= start && v.date <= end);
      const inLast30 = agg.visits.filter((v) => v.date >= last30Start).length;

      const isRegular = inLast30 >= 2;
      const isNew = first.date >= start && first.date <= end;
      const isLost = last.date <= lostBefore && !agg.hasUpcoming;
      const rangeIncludesToday = start <= today && today <= end;
      const lostInThisRange = rangeIncludesToday || (last.date >= start && last.date <= end);

      if (isLost && lostInThisRange) segmentCounts.lost++;
      if (inPeriod.length === 0) continue;

      segmentCounts.all++;
      if (isRegular) segmentCounts.regular++;
      if (isNew) segmentCounts.new++;

      active.push({
        name: agg.name,
        visitsInPeriod: inPeriod.length,
        segment: isRegular ? "regular" : isNew ? "new" : isLost ? "lost" : null,
        lastVisit: last,
        daysAgo: Math.max(daysBetweenISO(last.date, today), 0),
      });
    }

    active.sort(
      (a, b) =>
        b.visitsInPeriod - a.visitsInPeriod ||
        b.lastVisit.date.localeCompare(a.lastVisit.date) ||
        b.lastVisit.time.localeCompare(a.lastVisit.time),
    );

    res.json({
      period,
      range: { start, end },
      today,
      segments: segmentCounts,
      topClients: active.slice(0, 5),
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
