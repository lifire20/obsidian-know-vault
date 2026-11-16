// Native CalDAV calendar when available; isolated ICS fixture/fallback below.
const options = input ?? {};
const doc = dv.container.ownerDocument;
const win = doc.defaultView;
if (options.mount !== undefined && !(options.mount instanceof win.HTMLElement && dv.container.contains(options.mount))) return;
const root = doc.createElement("section");
root.className = "sjdev-week-calendar";
root.dataset.sjdevStatus = "loading";
root.setAttribute("aria-label", "iOS 七天小时日历");
(options.mount ?? dv.container).appendChild(root);
const app = dv.app;
const DateTime = dv.luxon.DateTime;
const zone = "Asia/Shanghai";
const hourHeight = 46;
const cacheSymbol = Symbol.for("sjdev.weekCalendar.cache");
const cache = app[cacheSymbol] ?? (app[cacheSymbol] = new Map());
let disposed = false;
let generation = 0;
let nowTimer;
let refreshTimer;
let observer;
let lastEvents = [];
let anchor = options.today ? DateTime.fromISO(options.today, { zone }) : DateTime.now().setZone(zone);
if (!anchor.isValid) anchor = DateTime.now().setZone(zone);
let week = anchor.startOf("week");

function el(tag, cls, text, parent = root) {
  const node = doc.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node);
  return node;
}
function button(cls, label, parent, action) {
  const b = el("button", cls, label, parent);
  b.type = "button";
  b.addEventListener("click", action);
  return b;
}

const nativePlugin = app.plugins.plugins["full-calendar-remastered"];
if (nativePlugin && options.mode !== "fixture") {
  root.classList.add("sjdev-week-calendar--caldav");
  root.dataset.calendarMode = "caldav";
  root.dataset.sourceStatus = "caldav-ready";
  const header = el("header", "sjdev-week-calendar__header");
  const heading = el("div", "sjdev-week-calendar__heading", undefined, header);
  el("p", "sjdev-week-calendar__eyebrow", "iCLOUD · 一周节奏", heading);
  el("h2", "sjdev-week-calendar__title", "iOS 日历", heading);
  const manageNative = button("sjdev-week-calendar__nav", "连接 / 管理 iCloud", header, () => {
    app.setting.open();
    app.setting.openTabById("full-calendar-remastered");
  });
  const nativeStatus = el("p", "sjdev-week-calendar__status", "CalDAV 双向日历 · 连接 iCloud 后可编辑日程");
  nativeStatus.setAttribute("role", "status");
  const viewport = el("div", "sjdev-week-calendar__native-viewport");
  viewport.tabIndex = 0;
  viewport.setAttribute("aria-label", "七天小时日历，窄窗口可横向滚动");
  const nativeHost = el("div", "sjdev-week-calendar__native", undefined, viewport);
  el("p", "sjdev-week-calendar__footnote", "连接 iCloud 后，可在日历中新增、编辑和删除日程，并同步到 iPhone。");
  const owner = dv.component;
  // Reuse Dataview's real Component base by its public addChild method.
  // This avoids a fixed inheritance depth and Electron's module require.
  let componentBase = Object.getPrototypeOf(owner);
  while (componentBase && !Object.prototype.hasOwnProperty.call(componentBase, "addChild")) componentBase = Object.getPrototypeOf(componentBase);
  if (!componentBase) throw new Error("Calendar lifecycle unavailable");
  const child = new componentBase.constructor();
  if (owner?.addChild) owner.addChild(child);
  else child.load();
  let nativeObserver;
  let settingsRef;
  let removed = false;
  function updateNativeStatus(settings) {
    if (removed || !dv.container.contains(root)) return;
    const sources = Array.isArray(settings?.calendarSources) ? settings.calendarSources : [];
    const caldav = sources.filter(source => String(source?.type ?? "").toLowerCase() === "caldav");
    root.dataset.sourceCount = String(sources.length);
    root.dataset.caldavCount = String(caldav.length);
    root.dataset.sourceStatus = caldav.length ? "caldav-configured" : sources.length ? "calendar-configured" : "caldav-setup";
    nativeStatus.textContent = caldav.length ? `双向日历 · 已配置 ${caldav.length} 个 CalDAV 来源` : sources.length ? "已配置日历 · 可继续连接 iCloud" : "双向日历 · 待连接 iCloud";
    manageNative.textContent = caldav.length ? "管理 iCloud ↗" : "连接 iCloud ↗";
  }
  function cleanupNative() {
    if (removed) return;
    removed = true;
    nativeObserver?.disconnect();
    if (settingsRef) app.workspace.offref(settingsRef);
    if (owner?.removeChild) owner.removeChild(child);
    else child.unload();
  }
  nativeObserver = new win.MutationObserver(() => { if (!dv.container.contains(root)) cleanupNative(); });
  nativeObserver.observe(dv.container, { childList: true, subtree: true });
  owner?.register?.(cleanupNative);
  settingsRef = app.workspace.on("full-calendar:settings-updated", settings => updateNativeStatus(settings));
  const markdown = ["```fc-calendar", "view: timeGridWeek", "height: 640px", "defaultDate: today", "slotDuration: 00:30:00", "slotLabelInterval: 01:00:00", "weather: false", "```"].join("\n");
  try {
    await dv.api.renderValue(markdown, nativeHost, child, dv.current()?.file?.path ?? "");
    if (!removed && dv.container.contains(root)) root.dataset.sjdevStatus = "ready";
  } catch {
    if (!removed && dv.container.contains(root)) {
      root.dataset.sjdevStatus = "error";
      nativeStatus.textContent = "日历暂未加载，请刷新后重试。";
    }
  }
  return;
}

function sources() {
  const plugin = app.plugins.plugins.ics;
  const entries = Object.entries(plugin?.data?.calendars ?? {}).filter(([, value]) => value?.icsUrl);
  return { plugin, entries };
}
function fingerprint(entries) {
  // Hash is only a cache discriminator; source URLs never enter the DOM.
  const text = JSON.stringify(entries.map(([id, c]) => [id, c.icsUrl, c.calendarType, c.format]));
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return (value >>> 0).toString(16);
}
async function loadEvents(days, force) {
  if (options.mode === "fixture" && Array.isArray(options.events)) return { events: options.events, state: "fixture", at: Date.now() };
  const { plugin, entries } = sources();
  if (!plugin?.getEvents || !entries.length) return { events: [], state: plugin ? "unconfigured" : "plugin-missing" };
  const key = `${days[0]}:${fingerprint(entries)}`;
  const previous = cache.get(key);
  if (previous?.pending) return previous.pending;
  if (!force && previous && Date.now() - previous.at < 300000) return previous.result;
  // A facade enables cross-midnight events without mutating saved plugin settings.
  const reader = Object.create(plugin);
  reader.data = { ...plugin.data, calendars: Object.fromEntries(entries.map(([id, c]) => [id, { ...c, format: { ...c.format, showOngoing: true } }])) };
  let timeout;
  const request = Promise.resolve().then(() => reader.getEvents(...days));
  const pending = Promise.race([request, new Promise((_, reject) => { timeout = win.setTimeout(() => reject(new Error("calendar timeout")), 30000); })]).then(events => {
    if (!Array.isArray(events)) throw new Error("invalid event response");
    const result = { events, state: "returned", at: Date.now() };
    cache.set(key, { at: Date.now(), result });
    // Bound memory when browsing many weeks.
    if (cache.size > 16) cache.delete(cache.keys().next().value);
    return result;
  }).catch(() => {
    cache.delete(key);
    return { events: [], state: "error" };
  }).finally(() => win.clearTimeout(timeout));
  cache.set(key, { pending });
  return pending;
}

function normalize(raw) {
  const seen = new Set();
  const normalized = [];
  for (const event of raw) {
    if (!event || typeof event !== "object") continue;
    const epoch = value => value !== null && value !== undefined && /^-?\d+(\.\d+)?$/.test(String(value)) ? DateTime.fromSeconds(Number(value), { zone }) : null;
    let start = epoch(event.utime) ?? DateTime.fromISO(String(event.startDateTime ?? ""), { zone, setZone: true }).setZone(zone);
    let end = epoch(event.endUtime) ?? DateTime.fromISO(String(event.endDateTime ?? ""), { zone, setZone: true }).setZone(zone);
    if (event.allDay) {
      // Calendar dates are floating: do not shift an all-day date by display zone.
      start = DateTime.fromISO(String(event.startDateTime ?? "").slice(0, 10), { zone });
      end = DateTime.fromISO(String(event.endDateTime ?? "").slice(0, 10), { zone });
    }
    if (!start?.isValid || !end?.isValid || end < start) continue;
    if (+end === +start) end = start.plus(event.allDay ? { days: 1 } : { minutes: 15 });
    const key = `${event.icsName ?? ""}|${event.uid ?? event.summary ?? ""}|${+start}|${+end}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ start, end, allDay: Boolean(event.allDay), summary: String(event.summary || "未命名日程"), calendar: String(event.icsName || "iOS 日历"), location: String(event.location || "") });
  }
  return normalized;
}
function segmentsForDay(events, day) {
  const endOfDay = day.plus({ days: 1 });
  return events.filter(e => !e.allDay && e.start < endOfDay && e.end > day).map(event => {
    const start = +event.start < +day ? day : event.start;
    const end = +event.end > +endOfDay ? endOfDay : event.end;
    return { event, startMinute: start.diff(day, "minutes").minutes, endMinute: end.diff(day, "minutes").minutes, lane: 0, columns: 1 };
  });
}
function arrange(segments) {
  segments.sort((a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute);
  let group = [], groupEnd = -1;
  function finish() {
    const ends = [];
    for (const item of group) {
      let lane = ends.findIndex(end => end <= item.startMinute);
      if (lane < 0) lane = ends.length;
      ends[lane] = item.endMinute;
      item.lane = lane;
    }
    for (const item of group) item.columns = ends.length;
  }
  for (const item of segments) {
    if (group.length && item.startMinute >= groupEnd) { finish(); group = []; groupEnd = -1; }
    group.push(item);
    groupEnd = Math.max(groupEnd, item.endMinute);
  }
  finish();
  return segments;
}

const header = el("header", "sjdev-week-calendar__header");
const heading = el("div", "sjdev-week-calendar__heading", undefined, header);
el("p", "sjdev-week-calendar__eyebrow", "SEVEN DAYS · 一周节奏", heading);
el("h2", "sjdev-week-calendar__title", "iOS 日历", heading);
const controls = el("div", "sjdev-week-calendar__controls", undefined, header);
button("sjdev-week-calendar__nav", "‹", controls, () => { week = week.minus({ weeks: 1 }); void render(); }).setAttribute("aria-label", "上一周");
button("sjdev-week-calendar__nav", "本周", controls, () => { week = DateTime.now().setZone(zone).startOf("week"); void render(); });
button("sjdev-week-calendar__nav", "›", controls, () => { week = week.plus({ weeks: 1 }); void render(); }).setAttribute("aria-label", "下一周");
const refresh = button("sjdev-week-calendar__nav", "刷新", controls, () => void render(true));
const metadata = el("div", "sjdev-week-calendar__meta");
const range = el("span", "sjdev-week-calendar__range", "", metadata);
el("span", "sjdev-week-calendar__zone", "上海时间 · UTC+8 · 只读订阅", metadata);
if (options.mode === "fixture") el("span", "sjdev-week-calendar__fixture", "测试日程 · 不连接真实日历", metadata);
const status = el("p", "sjdev-week-calendar__status");
status.setAttribute("role", "status");
const setup = el("details", "sjdev-week-calendar__setup");
el("summary", "sjdev-week-calendar__setup-summary", "连接 iCloud 日历", setup);
el("p", "sjdev-week-calendar__setup-hint", "在 iCloud 日历中开启所需日历的公开共享，复制订阅链接并粘贴到这里。主页只读取日程，iPhone 上的修改会在下次刷新后出现。", setup);
const form = el("form", "sjdev-week-calendar__form", undefined, setup);
const urlInput = el("input", "sjdev-week-calendar__url", undefined, form);
urlInput.type = "text";
urlInput.placeholder = "webcal://… 或 https://…";
urlInput.autocomplete = "off";
urlInput.spellcheck = false;
urlInput.setAttribute("aria-label", "iCloud 日历订阅链接");
const connect = el("button", "sjdev-week-calendar__connect", "连接日历", form);
connect.type = "submit";
const setupMessage = el("p", "sjdev-week-calendar__setup-message", "", setup);
setupMessage.setAttribute("role", "status");
const manage = button("sjdev-week-calendar__manage", "管理订阅 ↗", root, () => {
  app.setting.open();
  app.setting.openTabById("ics");
});
const viewport = el("div", "sjdev-week-calendar__viewport");
viewport.tabIndex = 0;
viewport.setAttribute("aria-label", "七天小时日历，可上下及左右滚动");
const canvas = el("div", "sjdev-week-calendar__canvas", undefined, viewport);
const dayHeader = el("div", "sjdev-week-calendar__day-header", undefined, canvas);
const allDay = el("div", "sjdev-week-calendar__all-day", undefined, canvas);
const hours = el("div", "sjdev-week-calendar__hours", undefined, canvas);
const foot = el("p", "sjdev-week-calendar__footnote", "24 小时 × 7 天 · 点击日程查看详情 · 窄窗口可横向滚动");
const dialog = el("dialog", "sjdev-week-calendar__dialog");
const dialogTitle = el("h3", "sjdev-week-calendar__dialog-title", "日程详情", dialog);
const dialogTime = el("p", "sjdev-week-calendar__dialog-time", "", dialog);
const dialogInfo = el("p", "sjdev-week-calendar__dialog-info", "", dialog);
button("sjdev-week-calendar__nav", "关闭", dialog, () => dialog.close());
dialog.setAttribute("aria-label", "日程详情");
function showEvent(event) {
  dialogTitle.textContent = event.summary;
  dialogTime.textContent = event.allDay ? `${event.start.toFormat("yyyy.MM.dd")} — ${event.end.minus({ days: 1 }).toFormat("yyyy.MM.dd")} · 全天` : `${event.start.toFormat("MM.dd HH:mm")} — ${event.end.toFormat("MM.dd HH:mm")} · 上海时间`;
  dialogInfo.textContent = [event.calendar, event.location].filter(Boolean).join(" · ");
  dialog.showModal();
}
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (connect.disabled) return;
  let url;
  try {
    url = new URL(urlInput.value.trim().replace(/^webcal:/i, "https:"));
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) throw new Error("url");
  } catch { setupMessage.textContent = "请粘贴有效的 webcal:// 或 https:// 日历订阅链接。"; return; }
  const { plugin } = sources();
  if (!plugin?.addCalendar) { setupMessage.textContent = "请先启用 ICS Calendar 插件。"; return; }
  connect.disabled = true;
  setupMessage.textContent = "正在连接…";
  try {
    let name = "iOS 日历", suffix = 2;
    while (Object.hasOwn(plugin.data.calendars, name)) name = `iOS 日历 ${suffix++}`;
    await plugin.addCalendar({ icsName: name, icsUrl: url.href, ownerEmail: "", calendarType: "remote", format: { checkbox: true, includeEventEndTime: true, icsName: true, summary: true, location: true, description: false, calendarType: "remote", showAttendees: false, showOngoing: true, showTransparentEvents: true } });
    urlInput.value = "";
    setupMessage.textContent = "已保存订阅来源，正在读取日程。";
    setup.open = false;
    await render(true);
  } catch { setupMessage.textContent = "暂时无法保存订阅，请在管理订阅中重试。"; }
  finally { connect.disabled = false; }
});

function updateNow() {
  const now = DateTime.now().setZone(zone);
  for (const line of hours.querySelectorAll(".sjdev-week-calendar__now")) line.remove();
  const col = hours.querySelector(`[data-date="${now.toISODate()}"]`);
  if (!col) return;
  const line = el("div", "sjdev-week-calendar__now", undefined, col);
  line.style.top = `${(now.hour + now.minute / 60) * hourHeight}px`;
  line.setAttribute("aria-label", `现在 ${now.toFormat("HH:mm")}`);
}
function paint(events) {
  dayHeader.replaceChildren(); allDay.replaceChildren(); hours.replaceChildren();
  el("span", "sjdev-week-calendar__corner", "周 / 时", dayHeader);
  el("span", "sjdev-week-calendar__all-label", "全天", allDay);
  const gutter = el("div", "sjdev-week-calendar__gutter", undefined, hours);
  for (let hour = 0; hour < 24; hour++) {
    const label = el("span", "sjdev-week-calendar__hour-label", `${String(hour).padStart(2, "0")}:00`, gutter);
    label.style.top = `${hour * hourHeight}px`;
  }
  const nowDate = DateTime.now().setZone(zone).toISODate();
  let visibleEvents = 0;
  for (let index = 0; index < 7; index++) {
    const day = week.plus({ days: index });
    const date = day.toISODate();
    const head = el("div", "sjdev-week-calendar__day", undefined, dayHeader);
    head.dataset.today = String(date === nowDate);
    el("span", "sjdev-week-calendar__weekday", `周${"一二三四五六日"[index]}`, head);
    el("time", "sjdev-week-calendar__day-date", day.toFormat("MM.dd"), head).dateTime = date;
    const allCell = el("div", "sjdev-week-calendar__all-cell", undefined, allDay);
    for (const event of events.filter(e => e.allDay && e.start < day.plus({ days: 1 }) && e.end > day)) {
      const b = button("sjdev-week-calendar__all-event", event.summary, allCell, () => showEvent(event));
      b.title = `${event.summary} · 全天`;
      visibleEvents++;
    }
    const col = el("div", "sjdev-week-calendar__column", undefined, hours);
    col.dataset.date = date;
    col.dataset.today = String(date === nowDate);
    for (const item of arrange(segmentsForDay(events, day))) {
      const event = item.event;
      const b = button("sjdev-week-calendar__event", undefined, col, () => showEvent(event));
      b.style.top = `${item.startMinute / 60 * hourHeight}px`;
      b.style.height = `${Math.max(18, (item.endMinute - item.startMinute) / 60 * hourHeight - 2)}px`;
      b.style.left = `calc(${100 * item.lane / item.columns}% + 2px)`;
      b.style.width = `calc(${100 / item.columns}% - 4px)`;
      b.dataset.startMinute = String(item.startMinute);
      b.dataset.endMinute = String(item.endMinute);
      b.dataset.lane = String(item.lane);
      b.dataset.columns = String(item.columns);
      b.title = `${event.start.toFormat("HH:mm")}–${event.end.toFormat("HH:mm")} · ${event.summary}`;
      el("span", "sjdev-week-calendar__event-time", event.start.toFormat("HH:mm"), b);
      el("span", "sjdev-week-calendar__event-title", event.summary, b);
      visibleEvents++;
    }
  }
  root.dataset.visibleSegments = String(visibleEvents);
  updateNow();
}
async function render(force = false) {
  const ticket = ++generation;
  const dates = Array.from({ length: 7 }, (_, i) => week.plus({ days: i }).toISODate());
  const scroll = viewport.scrollTop;
  const preserveScroll = root.dataset.renderedWeek === dates[0];
  range.textContent = `${week.toFormat("yyyy.MM.dd")} — ${week.plus({ days: 6 }).toFormat("MM.dd")}`;
  root.dataset.weekStart = dates[0];
  root.dataset.sourceStatus = "loading";
  status.textContent = "正在读取本周订阅…";
  refresh.disabled = true;
  paint([]);
  root.dataset.sjdevStatus = "ready";
  const result = await loadEvents(dates, force);
  if (disposed || !dv.container.contains(root) || ticket !== generation) return;
  root.dataset.sourceStatus = result.state;
  refresh.disabled = false;
  const connected = result.state !== "unconfigured" && result.state !== "plugin-missing";
  setup.hidden = connected;
  manage.hidden = !connected || result.state === "fixture";
  lastEvents = normalize(result.events);
  paint(lastEvents);
  if (result.state === "unconfigured") status.textContent = "尚未连接 iOS 日历。连接后，日程会显示在下方七天时间表中。";
  else if (result.state === "plugin-missing") { status.textContent = "请启用 ICS Calendar 插件后连接 iOS 日历。"; setup.hidden = true; }
  else if (result.state === "error") status.textContent = "本次订阅读取未完成，请检查连接后重试。";
  else if (result.state === "fixture") status.textContent = `测试日程：${lastEvents.length} 项虚构日程，仅用于边界验证。`;
  else status.textContent = lastEvents.length ? `本周订阅返回 ${lastEvents.length} 项日程 · ${DateTime.fromMillis(result.at, { zone }).toFormat("HH:mm")} 读取` : "本周暂未返回日程；如应有安排，请在管理订阅中检查来源与插件提示。";
  foot.textContent = connected ? "24 小时 × 7 天 · 点击日程查看详情 · 五分钟缓存，刷新可重新读取" : "24 小时 × 7 天 · 日历连接后可在这里查看日程 · 窄窗口可横向滚动";
  viewport.scrollTop = preserveScroll ? scroll : 7 * hourHeight;
  root.dataset.renderedWeek = dates[0];
}
function cleanup() {
  if (disposed) return;
  disposed = true;
  generation++;
  win.clearInterval(nowTimer);
  win.clearInterval(refreshTimer);
  observer?.disconnect();
  if (dialog.open) dialog.close();
}
observer = new win.MutationObserver(() => { if (!dv.container.contains(root)) cleanup(); });
observer.observe(dv.container, { childList: true, subtree: true });
if (dv.component?.register) dv.component.register(cleanup);
nowTimer = win.setInterval(() => { if (!dv.container.contains(root)) cleanup(); else updateNow(); }, 60000);
refreshTimer = win.setInterval(() => {
  if (!dv.container.contains(root)) cleanup();
  else if (!doc.hidden && root.clientWidth) void render().catch(() => { status.textContent = "本次订阅读取未完成，请稍后刷新。"; });
}, 300000);
void render().catch(() => {
  if (disposed) return;
  root.dataset.sjdevStatus = "error";
  status.textContent = "日历暂未加载，请刷新后重试。";
});
