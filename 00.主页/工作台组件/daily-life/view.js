// Meals and focus are stored only in the dedicated life-record directory.
const options = input ?? {};
const doc = dv.container.ownerDocument;
const win = doc.defaultView;
if (options.mount !== undefined && !(options.mount instanceof win.HTMLElement && dv.container.contains(options.mount))) return;
const mount = options.mount ?? dv.container;
const app = dv.app;
const DateTime = dv.luxon.DateTime;
const store = options.store;
const root = doc.createElement("section");
root.className = "sjdev-daily-life";
root.dataset.sjdevStatus = "loading";
root.setAttribute("aria-label", "三餐与专注记录");
mount.appendChild(root);
function el(tag, cls, text, parent = root) {
  const node = doc.createElement(tag); node.className = cls;
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node); return node;
}
if (!store?.readDay || !store?.updateDay || !store?.today || !store?.subscribe) {
  root.dataset.sjdevStatus = "error";
  el("p", "sjdev-daily-life__message", "生活记录尚未加载，请重新打开主页。");
  return;
}

// A Dataview block retains drafts across its own rerenders, while another leaf
// keeps an independent selected date and form. Sharing date state across leaves
// could otherwise save visible inputs to a different leaf's selected day.
const blocks = app[Symbol.for("sjdev.dailyLife.blocks")] ??= new WeakMap();
let models = blocks.get(dv.container);
if (!models) { models = new Map(); blocks.set(dv.container, models); }
const model = models.get(store.base) ?? {
  date: store.today(), followToday: true, drafts: new Map(), busy: false,
  message: "", error: false, callbacks: new Set(), sequence: 0
};
models.set(store.base, model);
if (model.followToday) model.date = store.today();
const mealLabels = { breakfast: "早餐", lunch: "午餐", dinner: "晚餐" };
let disposed = false, readSequence = 0, dayRecord = null, readError = false;
const pendingControls = [];
function draft() {
  if (!model.drafts.has(model.date)) model.drafts.set(model.date, {
    loaded: false, meals: {}, mealDirty: {}, mealBaseline: {},
    focusMinutes: "25", focusLabel: ""
  });
  return model.drafts.get(model.date);
}
function notify() { for (const cb of [...model.callbacks]) cb(); }
function message(text, error = false) { model.message = text; model.error = error; notify(); }
function button(text, action, parent, quiet = false) {
  const b = el("button", `sjdev-daily-life__button${quiet ? " sjdev-daily-life__button--quiet" : ""}`, text, parent);
  b.type = "button";
  b.dataset.action = action;
  pendingControls.push(b);
  return b;
}
function textValue(value) { return typeof value === "string" ? value : ""; }
function cleanText(value) { return value.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim(); }

const header = el("header", "sjdev-daily-life__header");
const headings = el("div", "sjdev-daily-life__headings", undefined, header);
el("p", "sjdev-daily-life__eyebrow", "EVERYDAY NOTES · 照顾好自己", headings);
el("h2", "sjdev-daily-life__title", "生活随手记", headings);
const dateBar = el("div", "sjdev-daily-life__date-bar", undefined, header);
const dateLabel = el("label", "sjdev-daily-life__date-label", "记录日期", dateBar);
const dateInput = el("input", "sjdev-daily-life__date", undefined, dateLabel);
dateInput.type = "date";
dateInput.setAttribute("aria-label", "生活记录日期");
pendingControls.push(dateInput);
const todayButton = button("今天", "today", dateBar, true);

const sections = el("div", "sjdev-daily-life__sections");
const mealSection = el("div", "sjdev-daily-life__section", undefined, sections);
const mealHeading = el("div", "sjdev-daily-life__section-heading", undefined, mealSection);
el("h3", "sjdev-daily-life__subtitle", "一日三餐", mealHeading);
const mealState = el("span", "sjdev-daily-life__summary", "未记录", mealHeading);
const mealsForm = el("form", "sjdev-daily-life__meals", undefined, mealSection);
const mealInputs = {};
for (const [key, label] of Object.entries(mealLabels)) {
  const row = el("label", "sjdev-daily-life__field", undefined, mealsForm);
  el("span", "sjdev-daily-life__field-name", label, row);
  const box = el("input", "sjdev-daily-life__input", undefined, row);
  box.type = "text"; box.maxLength = 160; box.placeholder = `记下${label}吃了什么…`;
  box.setAttribute("aria-label", `${label}记录`); box.dataset.meal = key; box.autocomplete = "off";
  box.addEventListener("input", () => {
    const d = draft(); d.meals[key] = box.value; d.mealDirty[key] = box.value !== (d.mealBaseline[key] ?? "");
    renderState();
  });
  mealInputs[key] = box; pendingControls.push(box);
}
const mealsActions = el("div", "sjdev-daily-life__inline-actions", undefined, mealsForm);
const saveMeals = button("保存三餐", "save-meals", mealsActions);
saveMeals.type = "submit";
el("span", "sjdev-daily-life__hint", "清空内容后保存，可移除该餐记录。", mealsActions);

const focusSection = el("div", "sjdev-daily-life__section sjdev-daily-life__section--focus", undefined, sections);
const focusHeading = el("div", "sjdev-daily-life__section-heading", undefined, focusSection);
el("h3", "sjdev-daily-life__subtitle", "专注时长", focusHeading);
const focusTotal = el("span", "sjdev-daily-life__focus-total", "未记录", focusHeading);
const focusForm = el("form", "sjdev-daily-life__focus-form", undefined, focusSection);
const minutesLabel = el("label", "sjdev-daily-life__minutes-label", "分钟", focusForm);
const minutesInput = el("input", "sjdev-daily-life__minutes", undefined, minutesLabel);
minutesInput.type = "number"; minutesInput.min = "1"; minutesInput.max = "1440"; minutesInput.step = "1";
minutesInput.setAttribute("aria-label", "补记专注分钟");
const focusLabel = el("label", "sjdev-daily-life__focus-label", "事项（可选）", focusForm);
const focusInput = el("input", "sjdev-daily-life__input", undefined, focusLabel);
focusInput.type = "text"; focusInput.maxLength = 120; focusInput.placeholder = "例如：读文献 / 写作"; focusInput.autocomplete = "off";
focusInput.setAttribute("aria-label", "专注事项");
pendingControls.push(minutesInput, focusInput);
const addFocus = button("+ 补记", "add-focus", focusForm); addFocus.type = "submit";
minutesInput.addEventListener("input", () => { draft().focusMinutes = minutesInput.value; });
focusInput.addEventListener("input", () => { draft().focusLabel = focusInput.value; });
const focusList = el("div", "sjdev-daily-life__focus-list", undefined, focusSection);
el("p", "sjdev-daily-life__hint", "手动补记与番茄钟已保存的记录合计；休息时间不计入。", focusSection);

const status = el("p", "sjdev-daily-life__message");
status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");
const footer = el("footer", "sjdev-daily-life__footer");
el("span", "sjdev-daily-life__hint", "三餐填写后保存，专注时长可随手补记", footer);
const sourceButton = button("打开当日记录 ↗", "open-record", footer, true);
sourceButton.addEventListener("click", async () => {
  try {
    const file = app.vault.getFileByPath(store.dayPath(model.date));
    if (!file) { message("保存第一项记录后，就会创建这一天的记录文件。"); return; }
    await store.openDay(model.date);
  } catch (_) { message("暂时无法打开记录，请稍后重试。", true); }
});

function renderState() {
  if (disposed) return;
  const d = draft();
  root.dataset.date = model.date;
  root.dataset.busy = String(model.busy);
  root.dataset.sjdevStatus = readError ? "error" : d.loaded ? "ready" : "loading";
  dateInput.max = store.today();
  if (dateInput.value !== model.date) dateInput.value = model.date;
  todayButton.setAttribute("aria-pressed", String(model.date === store.today()));
  for (const control of pendingControls) control.disabled = model.busy || (!d.loaded && control !== dateInput && control !== todayButton);
  saveMeals.disabled = model.busy || !d.loaded || !Object.values(d.mealDirty).some(Boolean);
  status.textContent = model.message || (readError ? "暂时无法读取记录，输入内容已保留，请稍后重试。" : "");
  status.dataset.error = String(model.error || readError);
  const meals = dayRecord?.date === model.date ? dayRecord.meals ?? {} : {};
  const mealCount = Object.keys(mealLabels).filter(key => textValue(meals[key])).length;
  mealState.textContent = mealCount ? `已记录 ${mealCount} / 3 餐` : "未记录";
  const focus = dayRecord?.date === model.date ? dayRecord.focus ?? [] : [];
  const total = focus.reduce((sum, item) => sum + item.minutes, 0);
  focusTotal.textContent = focus.length ? `${total} 分钟 · ${focus.length} 条` : "未记录";
}
function renderFields() {
  const d = draft();
  for (const key of Object.keys(mealLabels)) if (mealInputs[key].value !== (d.meals[key] ?? "")) mealInputs[key].value = d.meals[key] ?? "";
  if (minutesInput.value !== d.focusMinutes) minutesInput.value = d.focusMinutes;
  if (focusInput.value !== d.focusLabel) focusInput.value = d.focusLabel;
}
function renderFocus() {
  focusList.replaceChildren();
  const focus = dayRecord?.date === model.date ? dayRecord.focus ?? [] : [];
  root.dataset.focusMinutes = String(focus.reduce((sum, item) => sum + item.minutes, 0));
  if (!focus.length) { el("p", "sjdev-daily-life__empty", "还没有专注记录，可以补记刚完成的一段时间。", focusList); return; }
  for (const entry of [...focus].reverse()) {
    const row = el("div", "sjdev-daily-life__focus-item", undefined, focusList);
    row.dataset.focusId = entry.id;
    const details = el("div", "sjdev-daily-life__focus-details", undefined, row);
    el("span", "sjdev-daily-life__focus-text", textValue(entry.label) || (entry.source === "pomodoro" ? "番茄钟专注" : "专注记录"), details);
    el("span", "sjdev-daily-life__focus-meta", `${entry.minutes} 分钟 · ${entry.source === "pomodoro" ? "番茄钟" : "手动补记"}`, details);
    const remove = el("button", "sjdev-daily-life__remove", "移除", row);
    remove.type = "button"; remove.disabled = model.busy;
    remove.setAttribute("aria-label", `移除专注记录：${textValue(entry.label) || "专注记录"}，${entry.minutes} 分钟`);
    remove.addEventListener("click", () => {
      const date = model.date;
      void act(date, record => { record.focus = record.focus.filter(item => item.id !== entry.id); }, "已移除这条专注记录。");
    });
  }
}
async function reload() {
  const sequence = ++readSequence, date = model.date;
  try {
    const record = await store.readDay(date);
    if (disposed || sequence !== readSequence || date !== model.date) return;
    dayRecord = record; readError = false;
    const d = draft(); d.loaded = true;
    for (const key of Object.keys(mealLabels)) {
      const value = textValue(record.meals?.[key]);
      if (!d.mealDirty[key]) { d.meals[key] = value; d.mealBaseline[key] = value; }
    }
    renderFields(); renderState(); renderFocus();
  } catch (_) {
    if (disposed || sequence !== readSequence || date !== model.date) return;
    readError = true; renderState();
  }
}
async function act(date, transform, success, after) {
  if (model.busy) return;
  model.busy = true; model.error = false; model.message = "正在保存…"; model.sequence++;
  notify();
  try {
    await store.updateDay(date, transform);
    after?.(); model.message = success; model.error = false;
  } catch (_) {
    model.message = "保存失败，输入内容已保留，请检查记录文件后重试。"; model.error = true;
  } finally {
    model.busy = false; notify();
    if (!disposed) await reload();
  }
}
mealsForm.addEventListener("submit", event => {
  event.preventDefault(); if (model.busy || !draft().loaded) return;
  const date = model.date, d = draft();
  const fields = Object.keys(mealLabels).filter(key => d.mealDirty[key]);
  if (!fields.length) return;
  const captured = Object.fromEntries(fields.map(key => [key, d.meals[key] ?? ""]));
  if (fields.some(key => captured[key].length > 160)) { message("每餐记录请控制在 160 字以内。", true); return; }
  const values = Object.fromEntries(fields.map(key => [key, cleanText(captured[key])]));
  void act(date, record => {
    record.meals ??= {};
    for (const key of fields) if (values[key]) record.meals[key] = values[key]; else delete record.meals[key];
  }, "三餐记录已保存，好好吃饭。", () => {
    for (const key of fields) if (d.meals[key] === captured[key]) { d.meals[key] = values[key]; d.mealBaseline[key] = values[key]; d.mealDirty[key] = false; }
  });
});
focusForm.addEventListener("submit", event => {
  event.preventDefault(); if (model.busy || !draft().loaded) return;
  const date = model.date, d = draft(), rawMinutes = d.focusMinutes, rawLabel = d.focusLabel;
  const minutes = Number(rawMinutes);
  if (!/^\d+$/.test(rawMinutes) || !Number.isSafeInteger(minutes) || minutes < 1 || minutes > 1440) { message("请输入 1–1440 的整数分钟。", true); return; }
  if (rawLabel.length > 120) { message("专注事项请控制在 120 字以内。", true); return; }
  const now = DateTime.now().setZone("Asia/Shanghai");
  // For manual historical entries this is the actual recording time, not an
  // invented finish time. The selected daily file assigns the recorded minutes.
  const endedAt = now.toISO({ suppressMilliseconds: true });
  const entry = { id: win.crypto.randomUUID(), minutes, label: cleanText(rawLabel), source: "manual", endedAt };
  void act(date, record => {
    record.focus ??= [];
    if (!record.focus.some(item => item.id === entry.id)) record.focus.push(entry);
  }, `已补记 ${minutes} 分钟专注。`, () => {
    if (d.focusLabel === rawLabel) d.focusLabel = "";
  });
});

function selectDate(date, follow) {
  if (!store.validDate(date) || date > store.today()) { message("请选择今天或以前的有效日期。", true); dateInput.value = model.date; return; }
  model.date = date; model.followToday = follow; model.message = ""; model.error = false;
  dayRecord = null; readError = false; renderFields(); renderState(); renderFocus();
  void reload();
}
dateInput.addEventListener("change", () => { if (!model.busy) selectDate(dateInput.value, false); });
todayButton.addEventListener("click", () => { if (!model.busy) selectDate(store.today(), true); });
const update = () => { if (!disposed) { renderState(); renderFocus(); void reload(); } };
model.callbacks.add(update);
const unsubscribe = store.subscribe(() => { if (!disposed) void reload(); });
let clock;
const observer = new win.MutationObserver(() => { if (!dv.container.contains(root)) cleanup(); });
observer.observe(dv.container, { childList: true, subtree: true });
function cleanup() {
  if (disposed) return;
  disposed = true; readSequence++;
  model.callbacks.delete(update); unsubscribe?.(); observer.disconnect(); win.clearInterval(clock);
}
clock = win.setInterval(() => {
  if (!dv.container.contains(root)) { cleanup(); return; }
  if (model.followToday && model.date !== store.today() && !model.busy) selectDate(store.today(), true);
}, 30000);
if (dv.component?.register) dv.component.register(cleanup);
renderFields(); renderState();
await reload();
