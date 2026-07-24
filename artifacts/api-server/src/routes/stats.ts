import { Router } from "express";
import { db, bookingsTable, clientsTable, servicesTable } from "@workspace/db";
import { eq, and, gte, lte, count, sum, sql } from "drizzle-orm";
import { authenticate, getUser } from "../lib/auth";

const router = Router();

function getTodayTashkent() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
}

function getDateRange(period: string) {
  const now = new Date();
  const tz = "Asia/Tashkent";
  const today = now.toLocaleDateString("sv-SE", { timeZone: tz });
  if (period === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - 6);
    return { start: d.toLocaleDateString("sv-SE", { timeZone: tz }), end: today };
  }
  if (period === "year") {
    const d = new Date(now);
    d.setFullYear(d.getFullYear() - 1);
    return { start: d.toLocaleDateString("sv-SE", { timeZone: tz }), end: today };
  }
  // month default
  const d = new Date(now);
  d.setDate(d.getDate() - 29);
  return { start: d.toLocaleDateString("sv-SE", { timeZone: tz }), end: today };
}

router.get("/dashboard", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const today = getTodayTashkent();

    const todayBookings = await db.select().from(bookingsTable)
      .where(and(eq(bookingsTable.barberId, user.id), eq(bookingsTable.date, today)));

    const todayRevenue = todayBookings
      .filter(b => b.status === "completed")
      .reduce((sum, b) => sum + Number(b.price), 0);

    const weekStart = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
    })();

    const weekBookings = await db.select().from(bookingsTable)
      .where(and(
        eq(bookingsTable.barberId, user.id),
        gte(bookingsTable.date, weekStart),
        lte(bookingsTable.date, today)
      ));

    const weekRevenue = weekBookings
      .filter(b => b.status === "completed")
      .reduce((sum, b) => sum + Number(b.price), 0);

    const [{ value: totalClients }] = await db.select({ value: count() })
      .from(clientsTable).where(eq(clientsTable.barberId, user.id));

    const monthStart = (() => {
      const d = new Date();
      d.setDate(1);
      return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
    })();

    const [{ value: newClientsThisMonth }] = await db.select({ value: count() })
      .from(clientsTable)
      .where(and(
        eq(clientsTable.barberId, user.id),
        gte(clientsTable.createdAt, new Date(monthStart))
      ));

    res.json({
      scans: 0,
      clicks: 0,
      todayBookings: todayBookings.filter(b => b.status !== "cancelled").length,
      todayRevenue,
      weekBookings: weekBookings.filter(b => b.status !== "cancelled").length,
      weekRevenue,
      totalClients: Number(totalClients),
      newClientsThisMonth: Number(newClientsThisMonth),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

router.get("/analytics", authenticate, async (req, res) => {
  try {
    const user = getUser(req);
    const period = (req.query.period as string) || "month";
    const { start, end } = getDateRange(period);

    const bookings = await db.select().from(bookingsTable)
      .where(and(
        eq(bookingsTable.barberId, user.id),
        gte(bookingsTable.date, start),
        lte(bookingsTable.date, end),
      ));

    const completedBookings = bookings.filter(b => b.status !== "cancelled");
    const totalRevenue = completedBookings.reduce((s, b) => s + Number(b.price), 0);
    const totalBookings = completedBookings.length;
    const averageCheck = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    const byDate: Record<string, { revenue: number; count: number }> = {};
    for (const b of completedBookings) {
      const key = b.date;
      if (!byDate[key]) byDate[key] = { revenue: 0, count: 0 };
      byDate[key].revenue += Number(b.price);
      byDate[key].count += 1;
    }

    const dates = Object.keys(byDate).sort();
    const revenueChart = dates.map(d => ({ label: d, value: byDate[d].revenue }));
    const bookingsChart = dates.map(d => ({ label: d, value: byDate[d].count }));

    const serviceCount: Record<string, { count: number; revenue: number }> = {};
    for (const b of completedBookings) {
      const name = b.serviceName || "Boshqa";
      if (!serviceCount[name]) serviceCount[name] = { count: 0, revenue: 0 };
      serviceCount[name].count += 1;
      serviceCount[name].revenue += Number(b.price);
    }
    const topServices = Object.entries(serviceCount)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    res.json({ period, revenueChart, bookingsChart, topServices, totalRevenue, totalBookings, averageCheck });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server_error" });
  }
});

export default router;
