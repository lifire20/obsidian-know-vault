// Persistent sleep check-ins. Keep click timestamps across retries and restarts.
const zone = "Asia/Shanghai";
const lane = store[Symbol.for("sjdev.sleepCheckin.queue.v1")] ??= { queue: Promise.resolve() };
function serial(work) {
  const next = lane.queue.then(work, work);
  lane.queue = next.catch(() => {});
  return next;
}
function fail(code) { throw new Error(code); }
function instant(value) {
  if (typeof value !== "string" || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) fail("sleep-checkin-time");
  const parsed = DateTime.fromISO(value, { setZone: true }).setZone(zone);
  if (!parsed.isValid) fail("sleep-checkin-time");
  return parsed;
}
function session(settings) {
  const value = settings.sleepSession;
  if (value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("sleep-checkin-data");
  instant(value.sleepAt);
  if (value.wakeAt !== "") instant(value.wakeAt);
  return { sleepAt: value.sleepAt, wakeAt: value.wakeAt };
}
const same = (a, b) => a?.sleepAt === b?.sleepAt && a?.wakeAt === b?.wakeAt;
function duration(pair) {
  const sleep = instant(pair.sleepAt), wake = instant(pair.wakeAt);
  const minutes = wake.diff(sleep, "minutes").minutes;
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes >= 1440) fail("sleep-checkin-duration");
  return minutes;
}
return {
  read: async () => session(await store.readSettings()),
  start: timestamp => serial(async () => {
    const sleepAt = lane.startAt || instant(timestamp).toISO();
    lane.startAt = sleepAt;
    const result = await store.updateSettings(settings => {
      if (session(settings)) { delete lane.startAt; fail("sleep-checkin-active"); }
      settings.sleepSession = { sleepAt, wakeAt: "" };
    });
    delete lane.startAt; delete lane.wakeAt;
    return session(result);
  }),
  wake: timestamp => serial(async () => {
    const clicked = lane.wakeAt || instant(timestamp).toISO();
    lane.wakeAt = clicked;
    // Freeze wake time first. If the day write fails, retry this same pair.
    const settings = await store.updateSettings(current => {
      const pending = session(current);
      if (!pending) { delete lane.wakeAt; fail("sleep-checkin-missing"); }
      const pair = { ...pending, wakeAt: pending.wakeAt || clicked };
      try { duration(pair); } catch (error) { delete lane.wakeAt; throw error; }
      current.sleepSession = pair;
    });
    const pair = session(settings), date = instant(pair.wakeAt).toISODate();
    await store.updateDay(date, day => {
      if (same(day, pair)) return;
      if (day.sleepAt || day.wakeAt) fail("sleep-checkin-conflict");
      day.sleepAt = pair.sleepAt;
      day.wakeAt = pair.wakeAt;
    });
    // A retry or another view must never clear a newer sleep session.
    await store.updateSettings(current => {
      if (same(session(current), pair)) delete current.sleepSession;
    });
    delete lane.wakeAt;
    return { ...pair, date, minutes: duration(pair) };
  }),
  reset: expected => serial(async () => {
    await store.updateSettings(settings => {
      if (!same(session(settings), expected)) fail("sleep-checkin-changed");
      delete settings.sleepSession;
    });
    delete lane.startAt; delete lane.wakeAt;
  })
};
