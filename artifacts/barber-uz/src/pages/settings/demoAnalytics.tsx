import { useState } from "react";
import { addDaysISO } from "@/lib/schedule";

/**
 * Sample analytics used only while the app is running on this computer.
 * The production build never includes the switch, and nothing is written to the database.
 */
const STORAGE_KEY = "barber_demo_analytics";

export function useDemoAnalytics() {
  const available = import.meta.env.DEV;
  const [on, setOn] = useState(() => {
    if (!available) return false;
    return localStorage.getItem(STORAGE_KEY) !== "0";
  });

  function toggle() {
    setOn((current) => {
      const next = !current;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return { available, on, toggle };
}

export function DemoDataToggle({ on, toggle }: { on: boolean; toggle: () => void }) {
  return (
    <button
      type="button"
      data-testid="demo-data-toggle"
      aria-pressed={on}
      onClick={toggle}
      className={`mb-3 w-full rounded-xl border px-3 py-2 text-xs font-medium ${
        on
          ? "border-[#F59E0B]/40 bg-[#F59E0B]/15 text-[#F59E0B]"
          : "border-white/10 bg-white/5 text-muted-foreground"
      }`}
    >
      Namuna ma'lumot: {on ? "yoniq" : "o'chiq"}
    </button>
  );
}

interface Sample {
  client: string;
  service: string;
  price: number;
  date: string;
  time: string;
}

function mondayOf(iso: string): string {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDaysISO(iso, -((dow + 6) % 7));
}

function daysBetween(from: string, to: string): number {
  const [fy = 1970, fm = 1, fd = 1] = from.split("-").map(Number);
  const [ty = 1970, tm = 1, td = 1] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** Dates move with today, so "Bugun" and "Kecha" stay correct. */
export function demoSamples(today: string): Sample[] {
  const monday = mondayOf(today);
  const earlier: string[] = [];
  for (let cursor = monday; cursor < today; cursor = addDaysISO(cursor, 1)) earlier.push(cursor);
  const place = (index: number) => (earlier.length > 0 ? earlier[index % earlier.length] : today);

  const weekExtras: Sample[] = [
    { client: "Dilshod Umarov", service: "Styling", price: 70000, date: place(0), time: "11:00" },
    { client: "Otabek Rahimov", service: "Fade", price: 80000, date: place(1), time: "15:20" },
    { client: "Bobur Ali", service: "Soqol", price: 50000, date: place(2), time: "12:10" },
    { client: "Aziz Karimov", service: "Styling", price: 60000, date: place(3), time: "17:40" },
    { client: "Jasur Aliyev", service: "Fade", price: 90000, date: place(4), time: "09:30" },
  ];

  const rows: Sample[] = [
    { client: "Jasur Aliyev", service: "Fade", price: 80000, date: today, time: "10:00" },
    { client: "Bekzod Karimov", service: "Soqol", price: 50000, date: today, time: "14:30" },
    { client: "Sardor Toshpulatov", service: "VIP", price: 120000, date: today, time: "16:15" },
  ];
  if (earlier.length > 0) rows.push(...weekExtras);

  const monthStart = `${today.slice(0, 7)}-01`;
  if (monthStart < monday) {
    rows.push(
      { client: "Shahzod", service: "Soqol", price: 50000, date: monthStart, time: "13:00" },
      { client: "Ulug'bek", service: "Styling", price: 65000, date: addDaysISO(monthStart, 1), time: "18:00" },
    );
  }

  rows.push({
    client: "Kamol",
    service: "Fade",
    price: 80000,
    date: addDaysISO(today, -40),
    time: "12:00",
  });

  return rows;
}

export interface DemoIncome {
  revenue: number;
  completedCount: number;
  averageCheck: number;
  revChange: number;
  services: { name: string; revenue: number; percent: number }[];
  bookings: { id: string; clientName: string; serviceName: string; price: number; date: string; time: string }[];
}

export function mockIncome(range: { start: string; end: string }, today: string): DemoIncome {
  const all = demoSamples(today);
  const span = daysBetween(range.start, range.end) + 1;
  const prevEnd = addDaysISO(range.start, -1);
  const prevStart = addDaysISO(prevEnd, -(span - 1));
  const inRange = all.filter((row) => row.date >= range.start && row.date <= range.end);
  const prev = all.filter((row) => row.date >= prevStart && row.date <= prevEnd);
  const revenue = inRange.reduce((sum, row) => sum + row.price, 0);
  const prevRevenue = prev.reduce((sum, row) => sum + row.price, 0);
  const completedCount = inRange.length;
  const byService = new Map<string, number>();
  for (const row of inRange) byService.set(row.service, (byService.get(row.service) ?? 0) + row.price);
  const services = [...byService.entries()]
    .map(([name, amount]) => ({
      name,
      revenue: amount,
      percent: revenue > 0 ? Math.round((amount / revenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
  const revChange = prevRevenue === 0 ? (revenue > 0 ? 100 : 0) : Math.round(((revenue - prevRevenue) / prevRevenue) * 100);
  return {
    revenue,
    completedCount,
    averageCheck: completedCount > 0 ? Math.round(revenue / completedCount) : 0,
    revChange,
    services,
    bookings: inRange
      .map((row, index) => ({
        id: `demo-${row.date}-${index}`,
        clientName: row.client,
        serviceName: row.service,
        price: row.price,
        date: row.date,
        time: row.time,
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time)),
  };
}

export interface DemoClients {
  period: string;
  today: string;
  segments: { all: number; regular: number; new: number; lost: number };
  topClients: {
    name: string;
    visitsInPeriod: number;
    segment: "regular" | "new" | "lost" | null;
    lastVisit: { date: string; time: string };
    daysAgo: number;
  }[];
}

export function mockClients(range: { start: string; end: string }, today: string): DemoClients {
  const all = demoSamples(today);
  const last30 = addDaysISO(today, -29);
  const byName = new Map<string, Sample[]>();
  for (const row of all) {
    const list = byName.get(row.client) ?? [];
    list.push(row);
    byName.set(row.client, list);
  }

  const segments = { all: 0, regular: 0, new: 0, lost: 0 };
  const top: DemoClients["topClients"] = [];
  const rangeIncludesToday = range.start <= today && today <= range.end;

  for (const [name, visits] of byName) {
    visits.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
    const first = visits[0];
    const last = visits[visits.length - 1];
    const inPeriod = visits.filter((row) => row.date >= range.start && row.date <= range.end);
    const inLast30 = visits.filter((row) => row.date >= last30).length;
    const isRegular = inLast30 >= 2;
    const isNew = first.date >= range.start && first.date <= range.end;
    const isLost = daysBetween(last.date, today) >= 30;
    if (isLost && (rangeIncludesToday || (last.date >= range.start && last.date <= range.end))) segments.lost++;
    if (inPeriod.length === 0) continue;
    segments.all++;
    if (isRegular) segments.regular++;
    if (isNew) segments.new++;
    const segment = isRegular ? "regular" : isNew ? "new" : isLost ? "lost" : null;
    top.push({
      name,
      visitsInPeriod: inPeriod.length,
      segment,
      lastVisit: { date: last.date, time: last.time },
      daysAgo: Math.max(daysBetween(last.date, today), 0),
    });
  }

  top.sort((a, b) => b.visitsInPeriod - a.visitsInPeriod || b.lastVisit.date.localeCompare(a.lastVisit.date));
  return { period: "demo", today, segments, topClients: top.slice(0, 5) };
}
