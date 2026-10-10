import { useEffect, useState } from "react";
import type { Booking, Client } from "@workspace/api-client-react";
import { isOpenBooking, tashkentClock } from "@/lib/booking-feed";

export const DEMO_STORAGE_KEY = "barber_demo_unresolved_v2";
export const DEMO_EVENT = "barber-demo-bookings";

const DEMO_PREFIX = "demo-unresolved-";

function shiftIsoDate(iso: string, days: number): string {
  const [y = 1970, m = 1, d = 1] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function fmtMins(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Keep Alixon in "Yaqin bronlar" even if the sample 15:10 slot has already passed. */
export function demoUpcomingStart(nowMins: number): string {
  const requested = 15 * 60 + 10;
  if (requested > nowMins + 20) return "15:10";
  return fmtMins(Math.min(22 * 60, Math.max(nowMins + 50, requested)));
}

export function isDemoBookingId(id: string): boolean {
  return id.startsWith(DEMO_PREFIX);
}

export function isDemoClientId(id: string): boolean {
  return id.startsWith(DEMO_PREFIX);
}

type StatusMap = Record<string, Booking["status"] | "no_show">;

function readStatuses(): StatusMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as StatusMap;
  } catch {
    return {};
  }
}

function writeStatuses(next: StatusMap) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(DEMO_EVENT));
}

export function setDemoBookingStatus(id: string, status: Booking["status"] | "no_show") {
  const next = { ...readStatuses(), [id]: status };
  writeStatuses(next);
}

function row(partial: Omit<Booking, "barberId" | "createdAt" | "serviceId"> & { status: string }): Booking {
  return {
    barberId: "demo",
    createdAt: `${partial.date}T${partial.startTime}:00.000Z`,
    serviceId: null,
    ...partial,
    status: partial.status as Booking["status"],
  };
}

export function getDemoBookings(now = new Date()): Booking[] {
  const clock = tashkentClock(now);
  const today = clock.date;
  const yesterday = shiftIsoDate(today, -1);
  const upcoming = demoUpcomingStart(clock.mins);
  const upcomingEnd = fmtMins(Math.min(23 * 60 + 50, (() => {
    const [h, m] = upcoming.split(":").map(Number);
    return (h ?? 21) * 60 + (m ?? 0) + 60;
  })()));
  const saved = readStatuses();

  const twoDaysAgo = shiftIsoDate(today, -2);
  const laterUpcoming = fmtMins(Math.min(22 * 60 + 30, Math.max((() => {
    const [h, m] = upcoming.split(":").map(Number);
    return (h ?? 21) * 60 + (m ?? 0) + 70;
  })(), clock.mins + 90)));
  const laterUpcomingEnd = fmtMins(Math.min(23 * 60 + 50, (() => {
    const [h, m] = laterUpcoming.split(":").map(Number);
    return (h ?? 22) * 60 + (m ?? 0) + 45;
  })()));

  const seeds: Array<Omit<Booking, "barberId" | "createdAt" | "serviceId" | "status"> & { id: string; defaultStatus: string }> = [
    {
      id: `${DEMO_PREFIX}namuna3`,
      clientId: `${DEMO_PREFIX}namuna3`,
      clientName: "Namuna 3",
      serviceName: "Soch oldirish",
      date: yesterday,
      startTime: "08:40",
      endTime: "09:40",
      price: 60000,
      notes: "Namuna: kechagi tasdiqlanmagan bron",
      defaultStatus: "confirmed",
    },
    {
      id: `${DEMO_PREFIX}jasur`,
      clientId: `${DEMO_PREFIX}jasur`,
      clientName: "Jasur",
      serviceName: "Fade",
      date: yesterday,
      startTime: "11:20",
      endTime: "12:00",
      price: 70000,
      notes: "Namuna: kechagi ikkinchi tasdiqlanmagan bron",
      defaultStatus: "confirmed",
    },
    {
      id: `${DEMO_PREFIX}sardor`,
      clientId: `${DEMO_PREFIX}sardor`,
      clientName: "Sardor",
      serviceName: "Soqol",
      date: twoDaysAgo,
      startTime: "16:00",
      endTime: "16:40",
      price: 40000,
      notes: "Namuna: 2 kun oldingi tasdiqlanmagan bron",
      defaultStatus: "pending",
    },
    {
      id: `${DEMO_PREFIX}vaqt`,
      clientId: `${DEMO_PREFIX}vaqt`,
      clientName: "Vaqt testi",
      serviceName: "Soch oldirish",
      date: today,
      startTime: "14:30",
      endTime: "15:30",
      price: 60000,
      notes: "Namuna: bugungi o'tgan, tasdiqlanmagan bron",
      defaultStatus: "confirmed",
    },
    {
      id: `${DEMO_PREFIX}dilshod`,
      clientId: `${DEMO_PREFIX}dilshod`,
      clientName: "Dilshod",
      serviceName: "Soch + soqol",
      date: today,
      startTime: "12:00",
      endTime: "13:00",
      price: 80000,
      notes: "Namuna: bugungi o'tgan bron",
      defaultStatus: "confirmed",
    },
    {
      id: `${DEMO_PREFIX}ali`,
      clientId: `${DEMO_PREFIX}ali`,
      clientName: "Ali",
      serviceName: "Soch oldirish",
      date: today,
      startTime: "10:00",
      endTime: "11:00",
      price: 60000,
      notes: "Namuna: bajarilgan bron",
      defaultStatus: "completed",
    },
    {
      id: `${DEMO_PREFIX}bekzod`,
      clientId: `${DEMO_PREFIX}bekzod`,
      clientName: "Bekzod",
      serviceName: "Bolalar soch",
      date: today,
      startTime: "09:00",
      endTime: "09:40",
      price: 50000,
      notes: "Namuna: bajarilgan bron",
      defaultStatus: "completed",
    },
    {
      id: `${DEMO_PREFIX}alixon`,
      clientId: `${DEMO_PREFIX}alixon`,
      clientName: "Alixon",
      serviceName: "Soch oldirish",
      date: today,
      startTime: upcoming,
      endTime: upcomingEnd,
      price: 60000,
      notes: "Namuna: yaqin bron",
      defaultStatus: "pending",
    },
    {
      id: `${DEMO_PREFIX}kamol`,
      clientId: `${DEMO_PREFIX}kamol`,
      clientName: "Kamol",
      serviceName: "Kontur",
      date: today,
      startTime: laterUpcoming,
      endTime: laterUpcomingEnd,
      price: 45000,
      notes: "Namuna: ikkinchi yaqin bron",
      defaultStatus: "confirmed",
    },
  ];

  return seeds.map((seed) =>
    row({
      ...seed,
      status: (saved[seed.id] ?? seed.defaultStatus) as Booking["status"],
    }),
  );
}

export function mergeDemoBookings(
  existing: Booking[],
  opts: { date?: string; mode?: "day" | "upcoming" | "overdue" | "all" } = {},
  now = new Date(),
): Booking[] {
  const clock = tashkentClock(now);
  let extra = getDemoBookings(now);
  if (opts.mode === "upcoming") {
    extra = extra.filter((b) => b.date >= clock.date && isOpenBooking(b.status));
  } else if (opts.mode === "overdue") {
    extra = extra.filter((b) => b.date < clock.date && isOpenBooking(b.status));
  } else if (opts.date) {
    extra = extra.filter((b) => b.date === opts.date);
  }
  const seen = new Set(existing.map((b) => b.id));
  return [...existing, ...extra.filter((b) => !seen.has(b.id))];
}

export function demoCompletedRevenue(date: string, now = new Date()): number {
  return getDemoBookings(now)
    .filter((b) => b.date === date && b.status === "completed")
    .reduce((sum, b) => sum + Number(b.price || 0), 0);
}

export function demoUnresolvedDates(now = new Date()): string[] {
  const clock = tashkentClock(now);
  return getDemoBookings(now)
    .filter((b) => b.date < clock.date && isOpenBooking(b.status))
    .map((b) => b.date);
}

export function getDemoClients(now = new Date()): Client[] {
  const bookings = getDemoBookings(now);
  const byClient = new Map<string, Booking[]>();
  for (const b of bookings) {
    const id = b.clientId ?? b.id;
    const list = byClient.get(id) ?? [];
    list.push(b);
    byClient.set(id, list);
  }
  return [...byClient.entries()].map(([id, rows]) => {
    const latest = [...rows].sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`))[0];
    const completed = rows.filter((r) => r.status === "completed");
    return {
      id,
      barberId: "demo",
      name: latest?.clientName ?? "Namuna",
      phone: null,
      telegramId: null,
      notes: "Namuna mijoz — tasdiqlash sinovi",
      status: "new" as Client["status"],
      visitCount: Math.max(1, completed.length),
      totalSpent: completed.reduce((sum, r) => sum + Number(r.price || 0), 0),
      lastVisit: latest?.date ?? null,
      createdAt: latest?.createdAt ?? new Date().toISOString(),
    };
  });
}

export function getDemoClient(id: string, now = new Date()): Client | null {
  return getDemoClients(now).find((c) => c.id === id) ?? null;
}

export function getDemoClientBookings(clientId: string, now = new Date()) {
  return getDemoBookings(now).filter((b) => (b.clientId ?? b.id) === clientId);
}

export function useDemoUnresolved() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    window.addEventListener(DEMO_EVENT, bump);
    window.addEventListener("storage", bump);
    return () => {
      window.removeEventListener(DEMO_EVENT, bump);
      window.removeEventListener("storage", bump);
    };
  }, []);
}
