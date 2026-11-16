// Pure sleep-date math. The record date is the wake day in Asia/Shanghai.
const zone = "Asia/Shanghai";
function fail(code) { throw new Error(code); }
function dateValue(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail("sleep-date-invalid");
  const parsed = DateTime.fromISO(value, { zone });
  if (!parsed.isValid || parsed.toISODate() !== value) fail("sleep-date-invalid");
  return parsed;
}
function timeValue(value) {
  if (value === "" || value === undefined || value === null) return "";
  if (typeof value !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) fail("sleep-time-invalid");
  return value;
}
function bedDate(date, bed, wake) {
  const day = dateValue(date), bedtime = timeValue(bed), wakeTime = timeValue(wake);
  if (bedtime && wakeTime && bedtime === wakeTime) fail("sleep-duration-invalid");
  // An after-midnight bedtime earlier than the wake time belongs to the same
  // morning. With only bedtime supplied, default to the preceding night.
  return bedtime && wakeTime && bedtime < wakeTime ? date : day.minus({ days: 1 }).toISODate();
}
function at(date, time) {
  const parsed = DateTime.fromISO(`${date}T${time}`, { zone });
  if (!parsed.isValid || parsed.toFormat("yyyy-MM-dd'T'HH:mm") !== `${date}T${time}`) fail("sleep-time-invalid");
  return parsed.toISO({ suppressMilliseconds: true });
}
function duration(record) {
  if (!record || typeof record !== "object" || !record.sleepAt || !record.wakeAt) return null;
  try {
    const day = dateValue(record.date);
    const timestamp = value => typeof value === "string" && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value);
    if (!timestamp(record.sleepAt) || !timestamp(record.wakeAt)) return null;
    const sleep = DateTime.fromISO(record.sleepAt, { setZone: true }).setZone(zone);
    const wake = DateTime.fromISO(record.wakeAt, { setZone: true }).setZone(zone);
    if (!sleep.isValid || !wake.isValid || wake.toISODate() !== record.date ||
        ![record.date, day.minus({ days: 1 }).toISODate()].includes(sleep.toISODate())) return null;
    const minutes = wake.diff(sleep, "minutes").minutes;
    return Number.isFinite(minutes) && minutes > 0 && minutes < 1440 ? minutes : null;
  } catch (_) { return null; }
}
function build(date, bed, wake) {
  dateValue(date);
  const bedtime = timeValue(bed), wakeTime = timeValue(wake);
  const sleepAt = bedtime ? at(bedDate(date, bedtime, wakeTime), bedtime) : "";
  const wakeAt = wakeTime ? at(date, wakeTime) : "";
  const minutes = duration({ date, sleepAt, wakeAt });
  if (sleepAt && wakeAt && minutes === null) fail("sleep-duration-invalid");
  return { sleepAt, wakeAt, minutes };
}
return { bedDate, build, duration };
