// Interactive habits write only through the dedicated, shared life-record store.
const options = input ?? {};
const doc = dv.container.ownerDocument;
const win = doc.defaultView;
if (options.mount !== undefined && !(options.mount instanceof win.HTMLElement && dv.container.contains(options.mount))) return;
const mount = options.mount ?? dv.container;
const root = doc.createElement("section");
root.className = "sjdev-habits";
root.dataset.sjdevStatus = "loading";
root.setAttribute("aria-label", "习惯小角落，每个习惯一行的每月打卡表");
mount.append(root);
const store = options.store;
const DateTime = dv.luxon.DateTime;
const app = dv.app;

function el(tag, cls, text, parent = root) {
  const node = doc.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
}

if (!store?.readSettings || !store?.readMonth || !store?.updateDay || !store?.updateSettings) {
  root.dataset.sjdevStatus = "error";
  el("h2", "sjdev-anya-habits__title", "习惯小角落");
  el("p", "sjdev-habits__message", "记录服务暂未加载，请重新打开主页。");
  return;
}

// Keep drafts through rerenders of this Dataview block, while separate panes
// retain independent visible months.
const memories = app[Symbol.for("sjdev.habits.ui.v2")] ??= new WeakMap();
let blockMemory = memories.get(dv.container);
if (!blockMemory) { blockMemory = new Map(); memories.set(dv.container, blockMemory); }
const ui = blockMemory.get(store.base) ?? { draft: "", month: store.today().slice(0, 7) };
blockMemory.set(store.base, ui);
let today = store.today();
let settings = { habits: [] };
let monthRecords = {};
let busy = false;
let disposed = false;
let sequence = 0;
let readError = false;
let messageText = "";
let messageError = false;
let calendarFocus = null;
let observer, unsubscribe, clock;

const header = el("header", "sjdev-habits__header");
const heading = el("div", "sjdev-habits__heading", undefined, header);
el("p", "sjdev-habits__eyebrow", "SMALL STEPS / 习惯养成", heading);
el("h2", "sjdev-anya-habits__title", "习惯小角落", heading);
const badge = el("span", "sjdev-habits__badge", "从一个开始", header);
const form = el("form", "sjdev-habits__add-form");
const inputBox = el("input", "sjdev-habits__input", undefined, form);
inputBox.type = "text";
inputBox.maxLength = 40;
inputBox.placeholder = "添加习惯，例如：散步、读文献";
inputBox.setAttribute("aria-label", "新习惯名称，最多40字");
inputBox.autocomplete = "off";
inputBox.value = ui.draft;
const addButton = el("button", "sjdev-habits__primary", "+ 添加", form);
addButton.type = "submit";
addButton.dataset.action = "add-habit";
const empty = el("p", "sjdev-habits__empty", "添加想坚持的小习惯，每个习惯都会有自己的一行打卡格。");
const calendarWrap = el("div", "sjdev-habits__calendar-wrap");
const monthNav = el("div", "sjdev-habits__month-nav", undefined, calendarWrap);
const previous = el("button", "sjdev-habits__nav-button", "‹", monthNav);
previous.type = "button";
previous.setAttribute("aria-label", "习惯月历上个月");
const monthLabel = el("span", "sjdev-habits__month-label", "", monthNav);
monthLabel.setAttribute("aria-live", "polite");
const current = el("button", "sjdev-habits__current", "本月", monthNav);
current.type = "button";
const next = el("button", "sjdev-habits__nav-button", "›", monthNav);
next.type = "button";
next.setAttribute("aria-label", "习惯月历下个月");
const viewport = el("div", "sjdev-habits__viewport", undefined, calendarWrap);
viewport.tabIndex = 0;
viewport.setAttribute("role", "region");
viewport.setAttribute("aria-label", "习惯打卡表，窄窗口可横向滚动");
const calendar = el("div", "sjdev-habits__matrix", undefined, viewport);
calendar.setAttribute("role", "group");
calendar.setAttribute("aria-label", "每个习惯一行，点击小方块打卡或取消");
const summary = el("p", "sjdev-habits__summary", "", calendarWrap);
const management = el("details", "sjdev-habits__management");
el("summary", "sjdev-habits__management-title", "管理习惯", management);
const managementList = el("div", "sjdev-habits__management-list", undefined, management);
const message = el("p", "sjdev-habits__message");
message.setAttribute("role", "status");
message.setAttribute("aria-live", "polite");
el("p", "sjdev-habits__hint", "每行一个习惯，每格一天。点亮打卡，再点取消；窄窗口可左右滑动。", root);

function nameKey(value) { return value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim(); }
function cleanName(value) { return value.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim(); }
function monthDate() { return DateTime.fromISO(ui.month + "-01", { zone: "Asia/Shanghai" }); }
function say(text, error = false) {
  messageText = text;
  messageError = error;
  if (!disposed) { message.textContent = text; message.dataset.error = String(error); }
}
function restoreCalendarFocus() {
  if (busy || readError || !calendarFocus || !root.isConnected || (doc.activeElement !== doc.body && doc.activeElement !== root)) return;
  const button = [...calendar.querySelectorAll("button")].find(b => b.dataset.date === calendarFocus.date && b.dataset.habitId === calendarFocus.id);
  if (button && !button.disabled) { button.focus({ preventScroll: true }); calendarFocus = null; }
}

function render() {
  if (disposed) return;
  root.dataset.sjdevStatus = readError ? "error" : "ready";
  root.dataset.busy = String(busy);
  root.dataset.month = ui.month;
  const habits = settings.habits;
  const active = habits.filter(h => !h.archived);
  badge.textContent = active.length ? `${active.length} 个小习惯` : "从一个开始";
  const usable = !busy && !readError;
  inputBox.disabled = busy;
  addButton.disabled = busy;
  empty.hidden = !!habits.length;
  calendarWrap.hidden = !habits.length;
  management.hidden = !habits.length;
  previous.disabled = !usable;
  next.disabled = !usable || ui.month >= today.slice(0, 7);
  current.disabled = !usable || ui.month === today.slice(0, 7);
  const month = monthDate();
  monthLabel.textContent = month.toFormat("yyyy 年 M 月");
  const scrollLeft = viewport.scrollLeft;
  calendar.replaceChildren();
  calendar.style.setProperty("--sjdev-habit-days", String(month.daysInMonth));
  root.dataset.dayCount = String(month.daysInMonth);
  root.dataset.habitCount = String(habits.length);
  const dates = Array.from({ length: month.daysInMonth }, (_, index) => month.set({ day: index + 1 }).toISODate());
  const matrixHeader = el("div", "sjdev-habits__matrix-row sjdev-habits__matrix-heading", undefined, calendar);
  matrixHeader.setAttribute("aria-hidden", "true");
  el("span", "sjdev-habits__name-title", "习惯 / 日期", matrixHeader);
  for (const date of dates) {
    const label = el("span", "sjdev-habits__date-head", String(Number(date.slice(-2))), matrixHeader);
    label.dataset.today = String(date === today);
  }
  el("span", "sjdev-habits__total-title", "累计", matrixHeader);
  let total = 0;
  let todayDone = 0;
  for (const habit of habits) {
    const row = el("div", "sjdev-habits__matrix-row", undefined, calendar);
    row.dataset.habitId = habit.id;
    row.dataset.archived = String(habit.archived);
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", habit.name + (habit.archived ? "，已停用" : "，本月打卡"));
    const name = el("span", "sjdev-habits__row-name", habit.name + (habit.archived ? "（已停用）" : ""), row);
    name.title = habit.name + (habit.archived ? " · 已停用，历史保留" : "");
    let count = 0;
    for (const date of dates) {
      const done = monthRecords[date]?.habits?.[habit.id] === true;
      if (done) { count++; total++; }
      if (done && date === today && !habit.archived) todayDone++;
      const button = el("button", "sjdev-habits__day", done ? "✓" : "", row);
      button.type = "button";
      button.dataset.date = date;
      button.dataset.habitId = habit.id;
      button.dataset.done = String(done);
      button.dataset.today = String(date === today);
      button.disabled = !usable || habit.archived || date > today;
      button.setAttribute("aria-pressed", String(done));
      const state = habit.archived ? "已停用，历史保留" : date > today ? "未来日期不可打卡" : done ? "已打卡，点击取消" : "未打卡，点击标记";
      button.setAttribute("aria-label", `${date}，${habit.name}，${state}`);
      if (date === today) button.setAttribute("aria-current", "date");
      button.title = `${habit.name} · ${date} · ${state}`;
      button.addEventListener("click", () => { calendarFocus = { id: habit.id, date }; void toggle(habit.id, date); });
    }
    el("span", "sjdev-habits__row-total", `${count} 天`, row);
  }
  viewport.scrollLeft = scrollLeft;
  summary.textContent = ui.month === today.slice(0, 7) ? `今天已完成 ${todayDone} / ${active.length} 项 · 本月共 ${total} 次打卡` : `本月共 ${total} 次打卡 · 每个习惯独立累计`;
  root.dataset.completedCheckins = String(total);
  managementList.replaceChildren();
  for (const habit of habits) {
    const row = el("div", "sjdev-habits__manage-row", undefined, managementList);
    const label = el("span", "sjdev-habits__manage-name", habit.name, row);
    label.title = habit.name;
    const archive = el("button", "sjdev-habits__quiet", habit.archived ? "恢复" : "停用", row);
    archive.type = "button";
    archive.disabled = !usable;
    archive.setAttribute("aria-label", `${habit.archived ? "恢复" : "停用"}${habit.name}，保留历史打卡`);
    archive.addEventListener("click", () => void act(async () => {
      await store.updateSettings(draft => {
        const current = draft.habits.find(h => h.id === habit.id);
        if (!current) throw new Error("habit-missing");
        current.archived = !habit.archived;
      });
    }, habit.archived ? "已恢复，可以继续积累。" : "已停用，历史打卡会保留。"));
  }
  message.textContent = messageText;
  message.dataset.error = String(messageError);
  restoreCalendarFocus();
}

async function refresh() {
  const serial = ++sequence;
  const nextToday = store.today();
  if (nextToday !== today && ui.month === today.slice(0, 7)) ui.month = nextToday.slice(0, 7);
  today = nextToday;
  const requestedMonth = ui.month;
  try {
    const [nextSettings, nextRecords] = await Promise.all([store.readSettings(), store.readMonth(requestedMonth)]);
    if (disposed || serial !== sequence || requestedMonth !== ui.month) return;
    settings = nextSettings;
    monthRecords = nextRecords;
    if (readError) say("记录已重新加载。", false);
    readError = false;
    render();
  } catch (_) {
    if (disposed || serial !== sequence) return;
    readError = true;
    say("暂时无法读取习惯记录，请检查记录文件后重新打开主页。", true);
    render();
  }
}

async function act(write, success, after) {
  if (busy || disposed) return;
  busy = true;
  say("正在保存…");
  render();
  try {
    await write();
    if (disposed) return;
    after?.();
    say(success);
    await refresh();
  } catch (error) {
    if (disposed) return;
    const messages = {
      "habit-duplicate": "已有同名习惯，可以在“管理习惯”中查看或恢复。",
      "habit-missing": "这个习惯已被移除，请重新选择。",
      "habit-archived": "这个习惯已停用，请先恢复再打卡。",
      "future-date": "未来的日期先留白，到了那天再记录。"
    };
    say(messages[error?.message] ?? "保存失败，输入已保留。请检查记录文件后重试。", true);
  } finally {
    busy = false;
    render();
  }
}

async function toggle(id, date) {
  const habit = settings.habits.find(h => h.id === id);
  if (!habit || busy || readError) return;
  const latestToday = store.today();
  if (!store.validDate(date) || date > latestToday) { say("未来的日期先留白，到了那天再记录。", true); return; }
  if (habit.archived) { say("请先在“管理习惯”中恢复这个习惯。", true); return; }
  await act(async () => {
    const latest = await store.readSettings();
    const target = latest.habits.find(h => h.id === id);
    if (!target) throw new Error("habit-missing");
    if (target.archived) throw new Error("habit-archived");
    await store.updateDay(date, draft => {
      if (date > store.today()) throw new Error("future-date");
      draft.habits[id] = draft.habits[id] !== true;
    });
  }, `${habit.name} · ${date.slice(5).replace("-", "/")} 的打卡已更新。`);
}

inputBox.addEventListener("input", () => { ui.draft = inputBox.value; });
form.addEventListener("submit", event => {
  event.preventDefault();
  if (busy) return;
  const name = cleanName(inputBox.value);
  if (!name) { say("先给这个小习惯起个名字吧。"); inputBox.focus(); return; }
  if (name.length > 40) { say("习惯名称请控制在 40 字以内。", true); return; }
  const id = win.crypto.randomUUID();
  void act(async () => {
    await store.updateSettings(draft => {
      if (draft.habits.some(h => nameKey(h.name) === nameKey(name))) throw new Error("habit-duplicate");
      draft.habits.push({ id, name, archived: false });
    });
  }, "已添加，新习惯会显示为独立的一行。", () => { ui.draft = ""; inputBox.value = ""; });
});
previous.addEventListener("click", () => { ui.month = monthDate().minus({ months: 1 }).toFormat("yyyy-MM"); void refresh(); });
next.addEventListener("click", () => {
  const nextMonth = monthDate().plus({ months: 1 }).toFormat("yyyy-MM");
  if (nextMonth <= store.today().slice(0, 7)) { ui.month = nextMonth; void refresh(); }
});
current.addEventListener("click", () => { ui.month = store.today().slice(0, 7); void refresh(); });

function cleanup() {
  if (disposed) return;
  disposed = true;
  sequence++;
  unsubscribe?.();
  win.clearInterval(clock);
  observer?.disconnect();
}
unsubscribe = store.subscribe(() => { if (!disposed) void refresh(); });
observer = new win.MutationObserver(() => { if (!dv.container.contains(root)) cleanup(); });
observer.observe(dv.container, { childList: true, subtree: true });
clock = win.setInterval(() => {
  if (!dv.container.contains(root)) cleanup();
  else if (store.today() !== today) void refresh();
}, 30000);
if (dv.component?.register) dv.component.register(cleanup);
await refresh();
