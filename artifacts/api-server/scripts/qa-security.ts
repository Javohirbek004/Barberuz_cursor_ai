import { consumeRateLimit } from "../src/lib/rate-limit";
import { slotOutsideWorkingHours } from "../src/lib/schedule-guard";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const key = `qa:${Date.now()}`;
assert(consumeRateLimit(key, 2, 60_000) === true, "first allowed");
assert(consumeRateLimit(key, 2, 60_000) === true, "second allowed");
assert(consumeRateLimit(key, 2, 60_000) === false, "third blocked");

const lunchBlock = slotOutsideWorkingHours({
  isoDate: "2099-10-12",
  startTime: "13:30",
  durationMins: 30,
  workingHoursStart: "09:00",
  workingHoursEnd: "20:00",
  scheduleJson: null,
  lunchBreakEnabled: true,
  lunchBreakStart: "13:00",
  lunchBreakEnd: "14:00",
});
assert(lunchBlock && lunchBlock.includes("tushlik"), `lunch: ${lunchBlock}`);

const closed = slotOutsideWorkingHours({
  isoDate: "2099-10-12",
  startTime: "21:00",
  durationMins: 30,
  workingHoursStart: "09:00",
  workingHoursEnd: "20:00",
  scheduleJson: null,
  lunchBreakEnabled: false,
  lunchBreakStart: null,
  lunchBreakEnd: null,
});
assert(closed && closed.includes("ish vaqtidan"), `close: ${closed}`);

console.log("qa-security: ok");
