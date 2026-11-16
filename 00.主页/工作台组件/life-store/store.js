// Trusted local factory, loaded by the workbench. No credentials or network.
// Only dedicated life-record roots can be written; existing diary notes stay intact.
const allowed = ["02.生活记录/主页记录", "90_ObsidianDev/tests/fixtures/life-records"];
if (!allowed.includes(base)) throw new Error("life-record-root");
const key = Symbol.for("sjdev.lifeStore.v1");
const stores = app[key] ??= new Map();
const validatorKey = Symbol.for("sjdev.lifeStore.validator.v1");
const zone = "Asia/Shanghai";
const clone = value => JSON.parse(JSON.stringify(value));
const ownObject = value => value && typeof value === "object" && !Array.isArray(value);
const integer = (value, min, max) => Number.isSafeInteger(value) && value >= min && value <= max;
const text = (value, max) => typeof value === "string" && value.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
const id = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const validDate = value => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = DateTime.fromISO(value, { zone });
  return d.isValid && d.toISODate() === value;
};
const timestamp = value => typeof value === "string" && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && DateTime.fromISO(value, { setZone: true }).isValid;
const settingsPath = `${base}/设置.md`;
const dayPath = date => {
  if (!validDate(date)) throw new Error("life-record-date");
  return `${base}/${date}.md`;
};
const defaultSettings = () => ({ schema: 1, habits: [], waterGoalMl: 2000, cupMl: 250 });
const defaultDay = date => ({ schema: 1, date, habits: {}, waterMl: null, meals: {}, sleepAt: "", wakeAt: "", focus: [] });
function validate(data, date) {
  if (!ownObject(data) || data.schema !== 1) throw new Error("life-record-schema");
  if (date === undefined) {
    if (!Array.isArray(data.habits) || data.habits.length > 200 || !integer(data.waterGoalMl, 100, 20000) || !integer(data.cupMl, 10, 5000)) throw new Error("life-settings-invalid");
    // Optional pending check-in; old settings stay valid without migration.
    if (data.sleepSession !== undefined && (!ownObject(data.sleepSession) || !timestamp(data.sleepSession.sleepAt) ||
        !(data.sleepSession.wakeAt === "" || timestamp(data.sleepSession.wakeAt)))) throw new Error("life-sleep-session-invalid");
    const ids = new Set();
    for (const habit of data.habits) {
      if (!ownObject(habit) || !id(habit.id) || ids.has(habit.id) || !text(habit.name, 80) || !habit.name.trim() || typeof habit.archived !== "boolean") throw new Error("life-habit-invalid");
      ids.add(habit.id);
    }
  } else {
    if (data.date !== date || !ownObject(data.habits) || !(data.waterMl === null || integer(data.waterMl, 0, 100000)) || !ownObject(data.meals) || !Array.isArray(data.focus) || data.focus.length > 1000) throw new Error("life-day-invalid");
    for (const [habit, done] of Object.entries(data.habits)) if (!id(habit) || typeof done !== "boolean") throw new Error("life-checkin-invalid");
    for (const [meal, value] of Object.entries(data.meals)) if (!["breakfast", "lunch", "dinner"].includes(meal) || !text(value, 500)) throw new Error("life-meal-invalid");
    if (!(data.sleepAt === "" || timestamp(data.sleepAt))) throw new Error("life-sleep-invalid");
    // Existing schema-1 records may omit wakeAt. Reading must not migrate them.
    if (!(data.wakeAt === undefined || data.wakeAt === "" || timestamp(data.wakeAt))) throw new Error("life-wake-invalid");
    const ids = new Set();
    for (const item of data.focus) {
      if (!ownObject(item) || !id(item.id) || ids.has(item.id) || !integer(item.minutes, 1, 1440) || !text(item.label, 240) || !["manual", "pomodoro"].includes(item.source) || !timestamp(item.endedAt)) throw new Error("life-focus-invalid");
      ids.add(item.id);
    }
  }
  return data;
}
// A rerender refreshes validation without replacing the cached store, its write
// queue or its subscriptions. Pre-hook stores receive wrappers on that same
// object; their original closures remain responsible for serialized writes.
if (stores.has(base)) {
  const cached = stores.get(base);
  let hook = cached[validatorKey];
  if (hook) hook.validate = validate;
  else {
    hook = { validate };
    Object.defineProperty(cached, validatorKey, { value: hook });
    const readDay = cached.readDay, readMonth = cached.readMonth, readSettings = cached.readSettings;
    const updateDay = cached.updateDay, updateSettings = cached.updateSettings;
    cached.readDay = async date => hook.validate(await readDay.call(cached, date), date);
    cached.readSettings = async () => hook.validate(await readSettings.call(cached), undefined);
    cached.readMonth = async month => {
      const records = await readMonth.call(cached, month);
      for (const [date, record] of Object.entries(records)) hook.validate(record, date);
      return records;
    };
    const guarded = (transform, date) => previous => {
      hook.validate(previous, date);
      const next = transform(previous) ?? previous;
      if (typeof next?.then === "function") throw new Error("life-transform-must-be-synchronous");
      return hook.validate(next, date);
    };
    cached.updateDay = (date, transform) => updateDay.call(cached, date, guarded(transform, date));
    cached.updateSettings = transform => updateSettings.call(cached, guarded(transform, undefined));
  }
  return cached;
}
const validator = { validate };
const validateCurrent = (data, date) => validator.validate(data, date);
const start = "<!-- sjdev-life:data:start -->";
const end = "<!-- sjdev-life:data:end -->";
function parse(content, date) {
  const a = content.indexOf(start), b = content.indexOf(end);
  if (a < 0 || b < a || content.indexOf(start, a + start.length) >= 0 || content.indexOf(end, b + end.length) >= 0) throw new Error("life-data-block-missing");
  const block = content.slice(a + start.length, b).trim();
  const m = /^```json\s*\n([\s\S]*?)\n```$/.exec(block);
  if (!m) throw new Error("life-data-block-invalid");
  return validateCurrent(JSON.parse(m[1]), date);
}
function block(data) {
  // User text must not introduce a second management marker inside the JSON.
  const json = JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
  return `${start}\n\x60\x60\x60json\n${json}\n\x60\x60\x60\n${end}`;
}
function replace(content, data) {
  const a = content.indexOf(start), b = content.indexOf(end);
  return content.slice(0, a) + block(data) + content.slice(b + end.length);
}
async function ensureFolder() {
  let path = "";
  for (const part of base.split("/")) {
    path += (path ? "/" : "") + part;
    if (app.vault.getFolderByPath(path)) continue;
    try { await app.vault.createFolder(path); }
    catch (error) { if (!app.vault.getFolderByPath(path)) throw error; }
  }
}
async function read(path, date) {
  const file = app.vault.getFileByPath(path);
  if (!file) {
    if (app.vault.getAbstractFileByPath(path)) throw new Error("life-file-conflict");
    return date === undefined ? defaultSettings() : defaultDay(date);
  }
  return parse(await app.vault.read(file), date);
}
let queue = Promise.resolve();
function update(path, date, transform) {
  const work = async () => {
    const apply = previous => {
      const draft = clone(previous);
      const next = transform(draft) ?? draft;
      if (typeof next?.then === "function") throw new Error("life-transform-must-be-synchronous");
      return validateCurrent(next, date);
    };
    let file = app.vault.getFileByPath(path);
    let result;
    if (!file) {
      if (app.vault.getAbstractFileByPath(path)) throw new Error("life-file-conflict");
      result = apply(date === undefined ? defaultSettings() : defaultDay(date));
      await ensureFolder();
      const title = date === undefined ? "主页生活设置" : `${date} 生活记录`;
      const initial = `# ${title}\n\n由主页保存的生活记录；可在下方追加个人备注。\n\n${block(result)}\n`;
      try { await app.vault.create(path, initial); return clone(result); }
      catch (error) { file = app.vault.getFileByPath(path); if (!file) throw error; }
    }
    await app.vault.process(file, content => {
      const previous = parse(content, date);
      result = apply(previous);
      return replace(content, result);
    });
    return clone(result);
  };
  const next = queue.then(work, work);
  queue = next.catch(() => {});
  return next;
}
const callbacks = new Set();
let refs = [], scheduled = false;
function relevant(path) { return typeof path === "string" && (path === base || path.startsWith(base + "/")); }
function notify(path) {
  if (scheduled) return;
  scheduled = true;
  Promise.resolve().then(() => {
    scheduled = false;
    for (const callback of [...callbacks]) {
      try { callback(path); } catch (_) { /* One view must not break another subscriber. */ }
    }
  });
}
const store = {
  base, settingsPath, dayPath, validDate,
  today: () => DateTime.now().setZone(zone).toISODate(),
  readSettings: () => read(settingsPath),
  updateSettings: transform => update(settingsPath, undefined, transform),
  readDay: date => read(dayPath(date), date),
  updateDay: (date, transform) => update(dayPath(date), date, transform),
  readMonth: async month => {
    if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month) || !validDate(month + "-01")) throw new Error("life-record-month");
    const files = (app.vault.getFolderByPath(base)?.children ?? []).filter(f => f.extension === "md" && f.name.startsWith(month + "-") && validDate(f.basename));
    const pairs = await Promise.all(files.map(async file => [file.basename, await read(file.path, file.basename)]));
    return Object.fromEntries(pairs);
  },
  subscribe: callback => {
    if (!callbacks.size) {
      for (const event of ["create", "modify", "delete"]) refs.push(app.vault.on(event, file => { if (relevant(file.path)) notify(file.path); }));
      refs.push(app.vault.on("rename", (file, oldPath) => { if (relevant(file.path) || relevant(oldPath)) notify(file.path); }));
    }
    callbacks.add(callback);
    return () => {
      callbacks.delete(callback);
      if (!callbacks.size) { for (const ref of refs) app.vault.offref(ref); refs = []; }
    };
  },
  openDay: async date => {
    const file = app.vault.getFileByPath(dayPath(date));
    if (!file) return false;
    await app.workspace.getLeaf(false).openFile(file);
    return true;
  }
};
Object.defineProperty(store, validatorKey, { value: validator });
stores.set(base, store);
return store;
