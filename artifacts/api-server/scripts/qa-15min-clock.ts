import { buildBarber15MinText, pickClockForRemainingMinutes, remainingMinutesFromDiff } from "../src/lib/reminders";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const samples = [
  "2026-10-10T14:23:00+05:00",
  "2026-10-10T14:23:05+05:00",
  "2026-10-10T14:23:20+05:00",
  "2026-10-10T14:23:40+05:00",
  "2026-10-10T14:23:59+05:00",
  "2026-10-10T23:55:10+05:00",
  "2026-10-10T00:01:30+05:00",
];

for (const stamp of samples) {
  const nowMs = Date.parse(stamp);
  const clock = pickClockForRemainingMinutes(8, nowMs);
  const appointment = new Date(`${clock.date}T${clock.time}:00+05:00`);
  const remaining = remainingMinutesFromDiff((appointment.getTime() - nowMs) / 60000);
  assert(clock.remainingMinutes === 8, `${stamp}: picker said ${clock.remainingMinutes}`);
  assert(remaining === 8, `${stamp}: real remaining ${remaining} for ${clock.date} ${clock.time}`);
}

const text = buildBarber15MinText(
  "Sinov",
  null,
  {
    barberName: "Test",
    barberAddress: "",
    mapLink: "",
    barberPageLink: "",
    isTeam: false,
    teamBarberName: null,
    date: "2026-10-10",
    time: "14:31",
    totalPrice: 0,
    services: [{ name: "Sinov", price: 0, duration: 30 }],
  },
  8,
);

assert(text.includes("8 daqiqa qoldi"), `text missing dynamic minutes: ${text}`);
assert(!text.includes("15 daqiqa qoldi"), `text still has static 15: ${text}`);

console.log("qa-15min-clock: ok");
