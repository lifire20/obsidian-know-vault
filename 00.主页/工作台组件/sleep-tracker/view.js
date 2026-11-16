// Live check-ins use click time; the calendar selects historical corrections.
const options = input ?? {};
const doc = dv.container.ownerDocument, win = doc.defaultView;
if (options.mount !== undefined && !(options.mount instanceof win.HTMLElement && dv.container.contains(options.mount))) return;
const mount = options.mount ?? dv.container, app = dv.app, DateTime = dv.luxon.DateTime;
const store = options.store, dateSource = options.dateSource;
const root = doc.createElement("section");
root.className = "sjdev-sleep"; root.dataset.sjdevStatus = "loading";
root.setAttribute("aria-label", "一键记录入睡、起床与每月睡眠时长");
mount.appendChild(root);
function el(tag, cls, text, parent = root) {
  const node = doc.createElement(tag); node.className = cls;
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node); return node;
}
if (!store?.readDay || !store?.readMonth || !store?.updateDay || !store?.readSettings || !store?.updateSettings || !store?.today || !store?.validDate || !store?.subscribe) {
  root.dataset.sjdevStatus = "error";
  el("p", "sjdev-sleep__message", "睡眠记录尚未加载，请重新打开主页。"); return;
}
let math, makeChart, checkin;
const base = options.viewBase ?? "00.主页/工作台组件/sleep-tracker";
try {
  if (!["90_ObsidianDev/views/sleep-tracker", "00.主页/工作台组件/sleep-tracker"].includes(base)) throw Error("sleep-view-path");
  const sources = await Promise.all([app.vault.adapter.read(`${base}/math.js`), app.vault.adapter.read(`${base}/chart.js`), app.vault.adapter.read(`${base}/checkin.js`)]);
  math = new Function("DateTime", sources[0])(DateTime); makeChart = new Function("doc", sources[1])(doc);
  checkin = new Function("store", "DateTime", sources[2])(store, DateTime);
} catch (_) {
  root.dataset.sjdevStatus = "error";
  el("p", "sjdev-sleep__message", "睡眠模块暂时无法加载，请刷新主页。"); return;
}
if (!dv.container.contains(root)) return;
// Reuse this block's write lock and migrate previous time-only drafts in memory.
const blocks = app[Symbol.for("sjdev.sleepTracker.blocks.v1")] ??= new WeakMap();
let models = blocks.get(dv.container);
if (!models) { models = new Map(); blocks.set(dv.container, models); }
const model = models.get(store.base) ?? { drafts: new Map(), busy: false, message: "", error: false, callbacks: new Set() };
models.set(store.base, model);
let disposed = false, readSequence = 0, readError = false, record = null;
let checkinSession = null, checkinLoaded = false, checkinError = false, todayRecord = null, loadedToday = "";
let monthRecords = {}, monthLoading = true, monthError = false;
let clock, observer, unsubscribeDate, unsubscribeStore;
function sourceDate() {
  try { return dateSource?.getDate ? dateSource.getDate() : store.today(); } catch (_) { return ""; }
}
let selectedDate = sourceDate();
function draft(date = selectedDate) {
  if (!model.drafts.has(date)) model.drafts.set(date, { loaded: false, bed: "", wake: "", bedBaseline: "", wakeBaseline: "", bedDirty: false, wakeDirty: false });
  const d = model.drafts.get(date);
  if (d.bed === undefined) Object.assign(d, { bed: d.value ?? "", bedBaseline: d.baseline ?? "", bedDirty: !!d.dirty, wake: "", wakeBaseline: "", wakeDirty: false });
  return d;
}
const dirty = d => d.bedDirty || d.wakeDirty;
function localTime(iso) {
  const parsed = iso && DateTime.fromISO(iso, { zone: "Asia/Shanghai" });
  return parsed?.isValid ? parsed.toFormat("HH:mm") : "";
}
function localDay(iso) {
  const parsed = iso && DateTime.fromISO(iso, { zone: "Asia/Shanghai" });
  return parsed?.isValid ? parsed.toISODate() : "";
}
function durationText(minutes) {
  const n = Math.round(minutes), h = Math.floor(n / 60), m = n % 60;
  return `${h ? `${h} 小时` : ""}${h && m ? " " : ""}${m ? `${m} 分钟` : ""}` || "0 分钟";
}
function notify() { for (const cb of [...model.callbacks]) cb(); }
function say(text, error = false) { model.message = text; model.error = error; notify(); }
const header = el("header", "sjdev-sleep__header");
const heading = el("div", "sjdev-sleep__heading", undefined, header);
el("p", "sjdev-sleep__eyebrow", "REST & RESET / 好好休息", heading);
el("h2", "sjdev-sleep__title", "睡眠记录", heading);
const dateLabel = el("time", "sjdev-sleep__date", "", header);
const checkinHint = el("p", "sjdev-sleep__checkin-hint", "困了就点一下，醒来再点一下。", root);
const checkinActions = el("div", "sjdev-sleep__checkins");
function checkinButton(kind, title, subtitle, badge) {
  const button = el("button", `sjdev-sleep__checkin sjdev-sleep__checkin--${kind}`, undefined, checkinActions);
  button.type = "button"; button.dataset.action = kind === "sleep" ? "sleep-now" : "wake-now";
  button.setAttribute("aria-label", `${title}，立即记录当前北京时间`);
  const portrait = el("span", "sjdev-sleep__portrait", undefined, button);
  const imageFile = app.vault.getFileByPath(`${base}/assets/anya-${kind}.webp`);
  if (imageFile) {
    const image = el("img", "sjdev-sleep__avatar", undefined, portrait);
    image.src = app.vault.getResourcePath(imageFile); image.alt = "";
    image.width = 88; image.height = 88; image.draggable = false;
    image.setAttribute("aria-hidden", "true");
  }
  el("span", "sjdev-sleep__portrait-badge", badge, portrait).setAttribute("aria-hidden", "true");
  el("strong", "sjdev-sleep__checkin-title", title, button);
  const caption = el("span", "sjdev-sleep__checkin-caption", subtitle, button);
  return { button, caption };
}
const sleepNow = checkinButton("sleep", "我睡了", "晚安，做个好梦呀", "☾");
const wakeNow = checkinButton("wake", "我醒了", "早安，今天也要开心", "☀");
const liveSaved = el("p", "sjdev-sleep__live-saved");
const status = el("p", "sjdev-sleep__message");
status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
const correction = el("details", "sjdev-sleep__correction");
const correctionTitle = el("summary", "sjdev-sleep__correction-title", "修正时间 / 补记", correction);
el("p", "sjdev-sleep__hint", "补记跟随主页月历日期；上面的头像按钮始终记录现在。", correction);
const form = el("form", "sjdev-sleep__form", undefined, correction);
const bedLabel = el("label", "sjdev-sleep__field", undefined, form);
const bedCaption = el("span", "sjdev-sleep__field-name", "前晚入睡", bedLabel);
const bedDateLabel = el("span", "sjdev-sleep__field-date", "", bedLabel);
const bedInput = el("input", "sjdev-sleep__time sjdev-sleep__time--bed", undefined, bedLabel);
bedInput.type = "time"; bedInput.step = "60"; bedInput.setAttribute("aria-label", "入睡时间，小时与分钟");
const wakeLabel = el("label", "sjdev-sleep__field", undefined, form);
el("span", "sjdev-sleep__field-name", "当天起床", wakeLabel);
const wakeDateLabel = el("span", "sjdev-sleep__field-date", "", wakeLabel);
const wakeInput = el("input", "sjdev-sleep__time sjdev-sleep__time--wake", undefined, wakeLabel);
wakeInput.type = "time"; wakeInput.step = "60"; wakeInput.setAttribute("aria-label", "起床时间，小时与分钟");
const actions = el("div", "sjdev-sleep__actions", undefined, form);
const save = el("button", "sjdev-sleep__button sjdev-sleep__button--primary", "保存睡眠", actions);
save.type = "submit"; save.dataset.action = "save-sleep";
const clear = el("button", "sjdev-sleep__button sjdev-sleep__button--quiet", "清空", actions);
clear.type = "button"; clear.dataset.action = "clear-sleep";
const saved = el("p", "sjdev-sleep__saved", "尚未记录", correction);
const resetCheckin = el("button", "sjdev-sleep__button sjdev-sleep__button--quiet", "撤销本次打卡", correction);
resetCheckin.type = "button"; resetCheckin.dataset.action = "reset-checkin";
const chart = makeChart(el("div", "sjdev-sleep__chart-host"));
function renderFields() {
  const d = draft();
  if (bedInput.value !== d.bed) bedInput.value = d.bed;
  if (wakeInput.value !== d.wake) wakeInput.value = d.wake;
}
function renderState() {
  if (disposed) return;
  const d = draft(), valid = store.validDate(selectedDate), future = valid && selectedDate > store.today();
  const current = record?.date === selectedDate ? record : null;
  const minutes = current ? math.duration(current) : null;
  root.dataset.date = selectedDate; root.dataset.busy = String(model.busy);
  root.dataset.sjdevStatus = !valid || readError || checkinError ? "error" : d.loaded && checkinLoaded ? "ready" : "loading";
  root.dataset.savedTime = localTime(current?.sleepAt); root.dataset.savedWakeTime = localTime(current?.wakeAt);
  root.dataset.savedDurationMinutes = minutes === null ? "" : String(minutes);
  const today = store.today();
  dateLabel.textContent = `${today.replaceAll("-", "/")} · 北京时间`;
  dateLabel.dateTime = today;
  correctionTitle.textContent = `修正时间 / 补记${valid ? ` · ${selectedDate.slice(5).replace("-", "/")} 起床` : ""}`;
  const liveReady = checkinLoaded && !checkinError && loadedToday === today;
  sleepNow.button.disabled = model.busy || !liveReady || !!checkinSession;
  wakeNow.button.disabled = model.busy || !liveReady || !checkinSession;
  sleepNow.caption.textContent = checkinSession ? `已记下 ${localTime(checkinSession.sleepAt)}` : "晚安，做个好梦呀";
  wakeNow.caption.textContent = checkinSession?.wakeAt ? `${localTime(checkinSession.wakeAt)} · 点击继续保存` : "早安，今天也要开心";
  sleepNow.button.dataset.active = String(!!checkinSession);
  wakeNow.button.dataset.active = String(!!checkinSession?.wakeAt);
  checkinHint.textContent = checkinSession ? "晚安已经记下，醒来点一下右边就好。" : "困了就点一下，醒来再点一下。";
  const liveMinutes = todayRecord ? math.duration(todayRecord) : null;
  if (checkinError) liveSaved.textContent = "暂时读不到打卡记录，请稍后重试。";
  else if (!liveReady) liveSaved.textContent = "正在读取睡眠记录…";
  else if (checkinSession?.wakeAt) liveSaved.textContent = `已记下起床 ${localDay(checkinSession.wakeAt).slice(5)} ${localTime(checkinSession.wakeAt)}，点“我醒了”完成保存。`;
  else if (checkinSession) liveSaved.textContent = `入睡 ${localDay(checkinSession.sleepAt).slice(5)} ${localTime(checkinSession.sleepAt)} · 等你醒来 ☾`;
  else if (todayRecord?.wakeAt && liveMinutes !== null) liveSaved.textContent = `早安！${localTime(todayRecord.wakeAt)} 起床 · 睡了 ${durationText(liveMinutes)}`;
  else liveSaved.textContent = "点击头像，自动记下这一刻。";
  root.dataset.checkinState = !liveReady ? "loading" : checkinSession?.wakeAt ? "saving-wake" : checkinSession ? "sleeping" : "awake";
  resetCheckin.hidden = !checkinSession;
  resetCheckin.disabled = model.busy || !liveReady;
  let expectedBedDate = "";
  try { expectedBedDate = math.bedDate(selectedDate, d.bed, d.wake); } catch (_) { /* Keep invalid drafts visible. */ }
  const displayedBedDate = !dirty(d) && current?.sleepAt ? localDay(current.sleepAt) : expectedBedDate;
  bedCaption.textContent = displayedBedDate === selectedDate ? "当天入睡" : "前晚入睡";
  bedDateLabel.textContent = displayedBedDate ? displayedBedDate.slice(5).replace("-", "/") : "—";
  wakeDateLabel.textContent = valid ? selectedDate.slice(5).replace("-", "/") : "—";
  if (dirty(d)) {
    try { const candidate = math.build(selectedDate, d.bed, d.wake); saved.textContent = candidate.minutes === null ? "待保存 · 填全两项后计算时长" : `待保存 · ${durationText(candidate.minutes)}`; }
    catch (_) { saved.textContent = "待保存 · 请核对入睡与起床时间"; }
  } else if (minutes !== null) saved.textContent = `已记录 · ${durationText(minutes)}`;
  else if (current?.sleepAt && current?.wakeAt) saved.textContent = "时间已记录，请核对入睡与起床的先后顺序。";
  else if (current?.sleepAt) saved.textContent = "已记录入睡时间，补上起床时间就能计算时长。";
  else if (current?.wakeAt) saved.textContent = "已记录起床时间，补上入睡时间就能计算时长。";
  else saved.textContent = "记下昨晚的休息，照顾好今天的自己。";
  for (const box of [bedInput, wakeInput]) box.disabled = model.busy || !d.loaded || !valid || readError;
  save.disabled = model.busy || !d.loaded || !dirty(d) || !valid || readError || future;
  clear.disabled = model.busy || !d.loaded || (!d.bed && !d.wake) || !valid || readError;
  const notice = !valid ? "请选择有效的主页月历日期。" : future ? "所选起床日尚未到来，请选择今天或以前的日期。" : "";
  status.textContent = model.message || (checkinError ? "暂时无法读取打卡记录，请稍后重试。" : "") ||
    (correction.open ? notice || (readError ? "暂时无法读取睡眠记录，输入已保留，请稍后重试。" : "") : "");
  status.dataset.error = String(model.error || checkinError || (correction.open && (!!notice || readError)));
}
function renderChart() {
  if (disposed) return;
  const month = selectedDate.slice(0, 7), first = DateTime.fromISO(`${month}-01`, { zone: "Asia/Shanghai" });
  const days = first.isValid ? Array.from({length:first.daysInMonth}, (_, i) => {
    const date = first.plus({days:i}).toISODate(), day = monthRecords[date];
    return {date, minutes:date > store.today() || !day ? null : math.duration(day)};
  }) : [];
  chart.render({month, days, selectedDate, loading:monthLoading, error:monthError});
}
async function reload() {
  const serial = ++readSequence, date = selectedDate;
  if (!store.validDate(date)) { record = null; readError = false; renderFields(); renderState(); return; }
  const today = store.today();
  const [dayResult, monthResult, sessionResult, todayResult] = await Promise.allSettled([
    store.readDay(date), store.readMonth(date.slice(0,7)), checkin.read(), store.readDay(today)
  ]);
  if (disposed || serial !== readSequence || date !== selectedDate) return;
  if (dayResult.status === "fulfilled") {
    record = dayResult.value; readError = false;
    const d = draft(date); d.loaded = true;
    for (const [field, key] of [["bed", "sleepAt"], ["wake", "wakeAt"]]) if (!d[`${field}Dirty`]) { d[field] = localTime(record[key]); d[`${field}Baseline`] = d[field]; }
  } else readError = true;
  checkinLoaded = true; checkinError = sessionResult.status !== "fulfilled" || todayResult.status !== "fulfilled";
  checkinSession = sessionResult.status === "fulfilled" ? sessionResult.value : null;
  todayRecord = todayResult.status === "fulfilled" ? todayResult.value : null; loadedToday = today;
  monthLoading = false; monthError = monthResult.status !== "fulfilled";
  monthRecords = monthError ? {} : {...monthResult.value};
  if (!monthError && !readError) monthRecords[date] = record;
  renderFields(); renderState(); renderChart();
}
function selectFromCalendar() {
  if (disposed) return;
  const nextDate = sourceDate(); if (nextDate === selectedDate) return;
  selectedDate = nextDate; readSequence++; record = null; readError = false;
  monthRecords = {}; monthLoading = true; monthError = false; model.message = ""; model.error = false;
  renderFields(); renderState(); renderChart(); void reload();
}
function checkinErrorText(error) {
  switch (error?.message) {
    case "sleep-checkin-active": return "已经记下入睡啦，醒来点“我醒了”就好。";
    case "sleep-checkin-missing": return "请先点“我睡了”，或展开下方补记时间。";
    case "sleep-checkin-duration": return "请核对本次时间，睡眠须大于 0 且小于 24 小时。可撤销打卡后手动补记。";
    case "sleep-checkin-conflict": return "这次起床日已有睡眠记录，已保留原记录。请在下方修正，或撤销本次打卡。";
    case "sleep-checkin-changed": return "打卡状态已更新，请查看最新记录后再操作。";
    default: return "这次没能保存，请再点一次；已记下的时间会保留。";
  }
}
async function performCheckin(action) {
  if (model.busy || !checkinLoaded || checkinError) return;
  // Capture before any read/write. The calendar never determines live timestamps.
  const timestamp = DateTime.now().setZone("Asia/Shanghai").toISO();
  const expected = checkinSession && { ...checkinSession };
  model.busy = true; model.error = false; model.message = "正在记下这一刻…"; notify();
  try {
    if (action === "start") {
      const result = await checkin.start(timestamp);
      model.message = `晚安呀，${localTime(result.sleepAt)} 已记下，安心休息吧 ☾`;
    } else if (action === "wake") {
      const result = await checkin.wake(timestamp);
      model.message = `早安！${localTime(result.wakeAt)} 起床，睡了 ${durationText(result.minutes)} ☀`;
    } else {
      await checkin.reset(expected);
      model.message = "已撤销本次打卡；已保存的每日睡眠记录仍然保留。";
    }
  } catch (error) {
    model.message = checkinErrorText(error); model.error = true;
    if (["sleep-checkin-conflict", "sleep-checkin-duration"].includes(error?.message)) correction.open = true;
  } finally {
    model.busy = false; notify(); if (!disposed) await reload();
  }
}
sleepNow.button.addEventListener("click", () => void performCheckin("start"));
wakeNow.button.addEventListener("click", () => void performCheckin("wake"));
resetCheckin.addEventListener("click", () => void performCheckin("reset"));
correction.addEventListener("toggle", () => renderState());
for (const [field, box] of [["bed", bedInput], ["wake", wakeInput]]) box.addEventListener("input", () => {
  const d = draft(); d[field] = box.value; d[`${field}Dirty`] = d[field] !== d[`${field}Baseline`]; renderState();
});
clear.addEventListener("click", () => {
  if (model.busy || !draft().loaded) return;
  const d = draft(); for (const field of ["bed", "wake"]) { d[field] = ""; d[`${field}Dirty`] = d[field] !== d[`${field}Baseline`]; }
  renderFields(); say(dirty(d) ? "已清空输入，点击“保存睡眠”后生效。" : "这一天尚无睡眠记录。");
});
form.addEventListener("submit", event => {
  event.preventDefault();
  const date = selectedDate, d = draft(date);
  if (model.busy || !d.loaded || !dirty(d) || readError) return;
  if (!store.validDate(date) || date > store.today()) { say("请选择今天或以前的起床日期后保存。", true); return; }
  const fields = ["bed", "wake"].filter(field => d[`${field}Dirty`]);
  const captured = Object.fromEntries(fields.map(field => [field, d[field]]));
  // Only preflight edited values: the other field may have just changed in
  // another pane. Validate the complete latest pair inside the transaction.
  try { math.build(date, fields.includes("bed") ? captured.bed : "", fields.includes("wake") ? captured.wake : ""); }
  catch (_) { say("请核对先后顺序；睡眠时长须大于 0 且小于 24 小时。", true); return; }
  model.busy = true; model.error = false; model.message = "正在保存…"; notify();
  // Apply dirty fields to the latest pair inside the serial transaction.
  void (async () => {
    let result;
    try {
      await store.updateDay(date, day => {
        result = math.build(date, fields.includes("bed") ? captured.bed : localTime(day.sleepAt), fields.includes("wake") ? captured.wake : localTime(day.wakeAt));
        day.sleepAt = result.sleepAt; day.wakeAt = result.wakeAt;
      });
      for (const field of fields) if (d[field] === captured[field]) { d[`${field}Baseline`] = captured[field]; d[`${field}Dirty`] = false; }
      model.message = result.minutes === null ? `${date.slice(5)} 的时间已保存，填全两项即可生成曲线。` : `${date.slice(5)} 已保存 · ${durationText(result.minutes)}`;
      model.error = false;
    } catch (_) { model.message = "保存失败，输入已保留；请核对时间和记录文件后重试。"; model.error = true; }
    finally { model.busy = false; notify(); if (!disposed) await reload(); }
  })();
});
const update = () => { if (!disposed) { selectFromCalendar(); renderState(); void reload(); } };
model.callbacks.add(update);
unsubscribeStore = store.subscribe(() => { if (!disposed) void reload(); });
unsubscribeDate = dateSource?.subscribe?.(() => selectFromCalendar());
observer = new win.MutationObserver(() => { if (!dv.container.contains(root)) cleanup(); });
observer.observe(dv.container, { childList: true, subtree: true });
function cleanup() {
  if (disposed) return;
  disposed = true; readSequence++; model.callbacks.delete(update);
  unsubscribeStore?.(); unsubscribeDate?.(); observer.disconnect(); win.clearInterval(clock);
}
clock = win.setInterval(() => {
  if (!dv.container.contains(root)) cleanup();
  else { selectFromCalendar(); renderState(); if (loadedToday !== store.today() || checkinError || readError || monthError) void reload(); }
}, 30000);
dv.component?.register?.(cleanup);
renderFields(); renderState(); renderChart();
await reload();
