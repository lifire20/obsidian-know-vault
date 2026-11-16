// Home recording uses the dedicated life store; legacy views retain read-only totals.
const options = input ?? {};
// An obsolete async render must not fall back into a replacement container.
if (options.mount !== undefined && !(options.mount instanceof dv.container.ownerDocument.defaultView.HTMLElement && dv.container.contains(options.mount))) return;
const root = document.createElement("section");
root.className = "sjdev-water";
root.dataset.sjdevStatus = "loading";
const mount = options.mount instanceof dv.container.ownerDocument.defaultView.HTMLElement && dv.container.contains(options.mount) ? options.mount : dv.container;
mount.appendChild(root);
const DateTime = dv.luxon.DateTime;
const folder = options.dailyFolder ?? "02.生活记录/每日记录";
const day = value => {
  const text = typeof value?.toISODate === "function" ? value.toISODate() : value;
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = DateTime.fromISO(text, { zone: "local" });
  return date.isValid && date.toISODate() === text ? date : null;
};
const count = value => Number.isSafeInteger(value) && value >= 0;
function el(tag, cls, text, parent = root) {
  const node = document.createElement(tag); node.className = cls;
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node); return node;
}

async function interactiveWater(store) {
  const doc = root.ownerDocument, win = doc.defaultView;
  let disposed = false, busy = false, sequence = 0, unsubscribe, timer, observer;
  let selectedDate = store.today(), followToday = true, lastToday = store.today();
  let settingsDirty = false, correctionDirty = false;
  let settings, current;
  root.classList.add("sjdev-water--interactive");
  root.dataset.source = store.base;
  root.setAttribute("aria-label", "饮水记录与目标设置");
  el("p", "sjdev-water__eyebrow", "DAILY WELLBEING · 喝水也算一小步");
  el("h3", "sjdev-water__title", "饮水记录");
  const dateRow = el("div", "sjdev-water__date-row");
  const dateLabel = el("label", "sjdev-water__label", "记录日期", dateRow);
  const dateInput = el("input", "sjdev-water__date", undefined, dateLabel);
  dateInput.type = "date"; dateInput.value = selectedDate; dateInput.max = store.today();
  dateInput.setAttribute("aria-label", "饮水记录日期");
  const todayButton = el("button", "sjdev-water__button sjdev-water__button--quiet", "回到今天", dateRow);
  todayButton.type = "button";
  const amount = el("strong", "sjdev-water__amount", "正在读取…");
  const progressLabel = el("p", "sjdev-water__muted");
  const progress = el("progress", "sjdev-water__progress");
  const actions = el("div", "sjdev-water__record-actions");
  const cup = el("button", "sjdev-water__button sjdev-water__button--primary", "+ 一杯", actions);
  cup.type = "button"; cup.dataset.action = "add-cup";
  const customForm = el("form", "sjdev-water__custom", undefined, actions);
  const customLabel = el("label", "sjdev-water__label", "自定义饮水量（mL）", customForm);
  const custom = el("input", "sjdev-water__input", undefined, customLabel);
  custom.type = "number"; custom.min = "1"; custom.max = "10000"; custom.step = "1";
  custom.placeholder = "例如 300"; custom.inputMode = "numeric";
  custom.setAttribute("aria-label", "新增饮水量，单位毫升");
  const add = el("button", "sjdev-water__button", "+ 记录", customForm);
  add.type = "submit"; add.dataset.action = "add-custom";

  const settingsPanel = el("details", "sjdev-water__settings");
  el("summary", "sjdev-water__summary", "目标与杯量设置", settingsPanel);
  const settingsForm = el("form", "sjdev-water__settings-form", undefined, settingsPanel);
  function numberField(parent, labelText, action, min, max) {
    const label = el("label", "sjdev-water__label", labelText, parent);
    const input = el("input", "sjdev-water__input", undefined, label);
    input.type = "number"; input.min = String(min); input.max = String(max); input.step = "1";
    input.inputMode = "numeric"; input.dataset.field = action;
    return input;
  }
  const goal = numberField(settingsForm, "每日目标（mL）", "goal", 100, 20000);
  const cupSize = numberField(settingsForm, "每杯容量（mL）", "cup", 10, 5000);
  const saveSettings = el("button", "sjdev-water__button", "保存设置", settingsForm);
  saveSettings.type = "submit";
  el("p", "sjdev-water__scope", "默认目标 2,000 mL、每杯 250 mL，可按自己的安排调整。", settingsPanel);

  const correctionPanel = el("details", "sjdev-water__settings");
  el("summary", "sjdev-water__summary", "修正当日记录", correctionPanel);
  const correctionForm = el("form", "sjdev-water__settings-form", undefined, correctionPanel);
  const total = numberField(correctionForm, "当日累计（mL）", "total", 0, 30000);
  total.placeholder = "填写正确的累计量";
  const correct = el("button", "sjdev-water__button", "更新累计", correctionForm);
  correct.type = "submit"; correct.dataset.action = "set-total";
  const clear = el("button", "sjdev-water__button sjdev-water__button--quiet", "清除当日记录", correctionForm);
  clear.type = "button"; clear.dataset.action = "clear-total";
  el("p", "sjdev-water__scope", "清除后恢复为“未记录”，0 mL 则表示已明确记录为零。", correctionPanel);
  const weekTitle = el("p", "sjdev-water__week-title", "最近七天");
  const week = el("div", "sjdev-water__week");
  const status = el("p", "sjdev-water__status");
  status.setAttribute("role", "status"); status.setAttribute("aria-live", "polite");

  function message(text, error = false) {
    status.textContent = text; status.dataset.error = String(error);
  }
  function setBusy(value) {
    busy = value; root.dataset.busy = String(value);
    for (const control of root.querySelectorAll("input, button")) control.disabled = value;
  }
  function integer(input, min, max) {
    if (!/^\d+$/.test(input.value.trim())) return null;
    const value = Number(input.value);
    return Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
  }
  function validDate(value) { return store.validDate(value) && value <= store.today(); }
  async function refresh() {
    const request = ++sequence, date = selectedDate;
    try {
      const dates = Array.from({ length: 7 }, (_, i) => DateTime.fromISO(date, { zone: "Asia/Shanghai" }).minus({ days: 6 - i }).toISODate());
      const [nextSettings, records] = await Promise.all([store.readSettings(), Promise.all(dates.map(d => store.readDay(d)))]);
      if (disposed || request !== sequence || date !== selectedDate) return;
      settings = nextSettings; current = records[6];
      root.dataset.today = date; root.dataset.waterMl = current.waterMl === null ? "" : String(current.waterMl);
      root.dataset.waterStatus = current.waterMl === null ? "missing" : "recorded";
      root.dataset.sjdevStatus = "ready";
      amount.textContent = current.waterMl === null ? "尚未记录" : `${current.waterMl.toLocaleString()} mL`;
      progressLabel.textContent = `目标 ${settings.waterGoalMl.toLocaleString()} mL${current.waterMl === null ? " · 从第一杯开始" : ` · 已完成 ${Math.round(current.waterMl / settings.waterGoalMl * 100)}%`}`;
      progress.hidden = current.waterMl === null;
      progress.max = settings.waterGoalMl; progress.value = Math.min(current.waterMl ?? 0, settings.waterGoalMl);
      progress.setAttribute("aria-label", current.waterMl === null ? "尚无饮水记录" : `已记录 ${current.waterMl} 毫升，目标 ${settings.waterGoalMl} 毫升`);
      cup.textContent = `+ 一杯 · ${settings.cupMl} mL`;
      if (!settingsDirty) { goal.value = String(settings.waterGoalMl); cupSize.value = String(settings.cupMl); }
      if (!correctionDirty) total.value = current.waterMl === null ? "" : String(current.waterMl);
      dateInput.max = store.today(); dateInput.value = selectedDate;
      weekTitle.textContent = date === store.today() ? "最近七天" : `截至 ${date.slice(5)} 的七天`;
      week.replaceChildren();
      records.forEach((record, i) => {
        const cell = el("button", "sjdev-water__day", undefined, week);
        cell.type = "button"; cell.dataset.date = dates[i]; cell.dataset.status = record.waterMl === null ? "missing" : "recorded";
        const time = el("time", "sjdev-water__day-date", dates[i].slice(5).replace("-", "/"), cell); time.dateTime = dates[i];
        el("span", "sjdev-water__day-value", record.waterMl === null ? "未记" : String(record.waterMl), cell);
        cell.title = `${dates[i]} · ${record.waterMl === null ? "未记录" : `${record.waterMl} mL`}，点击补记`;
        cell.setAttribute("aria-label", cell.title);
        cell.addEventListener("click", () => { if (!busy) selectDate(dates[i]); });
        cell.disabled = busy;
      });
    } catch (_) {
      if (disposed || request !== sequence) return;
      root.dataset.sjdevStatus = "error";
      message("暂时无法读取饮水记录，请检查记录文件后重试。", true);
    }
  }
  function selectDate(date) {
    if (!validDate(date)) { message("请选择今天或更早的有效日期。", true); dateInput.value = selectedDate; return; }
    selectedDate = date; followToday = date === store.today(); correctionDirty = false;
    dateInput.value = date; message(""); void refresh();
  }
  async function act(task, success, after) {
    if (busy || disposed) return;
    setBusy(true); message("正在保存…");
    try {
      await task();
      if (disposed) return;
      after?.(); message(success);
      await refresh();
    } catch (_) {
      if (!disposed) message("保存失败，输入仍保留，请重试。", true);
    } finally { if (!disposed) setBusy(false); }
  }
  function increment(ml) {
    const date = selectedDate;
    if (!validDate(date)) throw new Error("water-record-date");
    return store.updateDay(date, draft => {
      const next = (draft.waterMl ?? 0) + ml;
      if (!Number.isSafeInteger(next) || next > 30000) throw new Error("water-total-limit");
      draft.waterMl = next;
    });
  }
  cup.addEventListener("click", () => {
    if (!settings) return;
    const ml = settings.cupMl;
    void act(() => increment(ml), `已记录 ${ml} mL。`, () => { correctionDirty = false; });
  });
  customForm.addEventListener("submit", event => {
    event.preventDefault();
    const ml = integer(custom, 1, 10000);
    if (ml === null) { message("请填写 1–10,000 之间的整数毫升数。", true); return; }
    void act(() => increment(ml), `已记录 ${ml} mL。`, () => { custom.value = ""; correctionDirty = false; });
  });
  goal.addEventListener("input", () => { settingsDirty = true; });
  cupSize.addEventListener("input", () => { settingsDirty = true; });
  total.addEventListener("input", () => { correctionDirty = true; });
  settingsForm.addEventListener("submit", event => {
    event.preventDefault();
    const goalMl = integer(goal, 100, 20000), cupMl = integer(cupSize, 10, 5000);
    if (goalMl === null || cupMl === null) { message("每日目标须为 100–20,000 mL，每杯须为 10–5,000 mL 的整数。", true); return; }
    void act(() => store.updateSettings(draft => { draft.waterGoalMl = goalMl; draft.cupMl = cupMl; }), "目标和杯量已保存。", () => { settingsDirty = false; });
  });
  correctionForm.addEventListener("submit", event => {
    event.preventDefault(); const date = selectedDate, ml = integer(total, 0, 30000);
    if (ml === null || !validDate(date)) { message("请填写 0–30,000 mL 的整数累计量，并选择有效日期。", true); return; }
    void act(() => store.updateDay(date, draft => { draft.waterMl = ml; }), "当日累计已更新。", () => { correctionDirty = false; });
  });
  clear.addEventListener("click", () => {
    if (!current || current.waterMl === null) { message("这一天尚无饮水记录。"); return; }
    const date = selectedDate;
    void act(() => store.updateDay(date, draft => { draft.waterMl = null; }), "已恢复为未记录。", () => { correctionDirty = false; });
  });
  dateInput.addEventListener("change", () => { if (!busy) selectDate(dateInput.value); });
  todayButton.addEventListener("click", () => { if (!busy) selectDate(store.today()); });
  function cleanup() {
    if (disposed) return;
    disposed = true; ++sequence; unsubscribe?.(); observer?.disconnect(); win.clearInterval(timer);
  }
  unsubscribe = store.subscribe(() => { if (!disposed) void refresh(); });
  observer = new win.MutationObserver(() => { if (!dv.container.contains(root)) cleanup(); });
  observer.observe(dv.container, { childList: true, subtree: true });
  timer = win.setInterval(() => {
    if (!dv.container.contains(root)) { cleanup(); return; }
    const today = store.today();
    if (today !== lastToday || (followToday && !busy && selectedDate !== today)) {
      lastToday = today; dateInput.max = today;
      if (followToday && !busy) { selectedDate = today; correctionDirty = false; dateInput.value = today; }
      void refresh();
    }
  }, 30000);
  if (dv.component?.register) dv.component.register(cleanup);
  await refresh();
}

if (options.store) {
  try { await interactiveWater(options.store); }
  catch (_) { root.dataset.sjdevStatus = "error"; el("p", "sjdev-water__message", "饮水记录暂未加载，请刷新后重试。"); }
  return;
}
try {
  if (options.today !== undefined && !day(options.today)) throw new Error("today");
  const today = day(options.today) ?? DateTime.local().startOf("day");
  root.dataset.today = today.toISODate();
  el("p", "sjdev-water__eyebrow", "DAILY WELLBEING · 只读");
  el("h3", "sjdev-water__title", "饮水记录");
  if (typeof folder !== "string" || /["\\:\x00-\x1f]/.test(folder) || folder.split("/").some(x => !x || x === "." || x === "..") || !dv.app.vault.getFolderByPath(folder)) throw new Error("folder");
  if (options.defaultGoalMl !== undefined && (!count(options.defaultGoalMl) || options.defaultGoalMl === 0)) throw new Error("goal");
  const days = new Map();
  for (const page of dv.pages(`"${folder}"`).array()) {
    const match = /^(\d{4}-\d{2}-\d{2}) 星期([一二三四五六日天])$/.exec(page.file.name);
    if (!match) continue;
    const date = day(match[1]);
    if (!date) continue;
    const key = date.toISODate();
    const valid = "一二三四五六日"[date.weekday - 1] === match[2].replace("天", "日") && (page.date === undefined || day(page.date)?.toISODate() === key);
    const list = days.get(key) ?? []; list.push({ page, valid }); days.set(key, list);
  }
  function record(key) {
    const list = days.get(key) ?? [];
    if (!list.length) return { status: "missing" };
    if (list.length !== 1 || !list[0].valid) return { status: "conflict" };
    const page = list[0].page;
    if (page.water_ml === undefined) return { status: "missing", page };
    if (!count(page.water_ml)) return { status: "invalid", page };
    return { status: "recorded", ml: page.water_ml, page };
  }
  const current = record(today.toISODate());
  root.dataset.waterStatus = current.status;
  root.dataset.waterMl = current.status === "recorded" ? String(current.ml) : "";
  const messages = { missing: "今日未记录", conflict: "今日日记日期冲突", invalid: "今日饮水字段无效" };
  el("strong", "sjdev-water__amount", current.status === "recorded" ? `${current.ml.toLocaleString()} mL` : messages[current.status]);
  el("p", "sjdev-water__muted", current.status === "recorded" ? "今日已记录累计" : "缺失记录不视为零，也不补写日记。");
  const rawGoal = current.page?.water_goal_ml;
  const goal = rawGoal === undefined ? options.defaultGoalMl : count(rawGoal) && rawGoal > 0 ? rawGoal : undefined;
  if (rawGoal !== undefined && (!count(rawGoal) || rawGoal === 0)) el("p", "sjdev-water__muted", "目标字段无效；未计算进度。");
  else if (goal !== undefined) {
    el("p", "sjdev-water__muted", `自设目标 ${goal.toLocaleString()} mL · 非健康建议`);
    if (current.status === "recorded") {
      const progress = el("progress", "sjdev-water__progress"); progress.max = goal; progress.value = Math.min(current.ml, goal);
      progress.setAttribute("aria-label", `已记录 ${current.ml} mL，目标 ${goal} mL`);
      el("span", "sjdev-water__muted", `${Math.round(current.ml / goal * 100)}%`);
    }
  } else el("p", "sjdev-water__muted", "目标未设置");
  const week = el("div", "sjdev-water__week");
  for (let ago = 6; ago >= 0; ago--) {
    const date = today.minus({ days: ago }); const key = date.toISODate(); const item = record(key);
    const cell = el("div", "sjdev-water__day", undefined, week); cell.dataset.date = key; cell.dataset.status = item.status;
    el("time", "sjdev-water__day-date", date.toFormat("MM/dd"), cell).dateTime = key;
    el("span", "sjdev-water__day-value", item.status === "recorded" ? `${item.ml}` : item.status === "missing" ? "未记录" : item.status === "conflict" ? "冲突" : "无效", cell);
    cell.title = `${key} · ${item.status === "recorded" ? item.ml + " mL" : cell.lastChild.textContent}`;
  }
  el("p", "sjdev-water__scope", "最近七个连续本地日期 · 单位 mL · 正式日记只读");
  if (options.mode === "fixture") await dv.view("90_ObsidianDev/views/water-tracker/controller", { mount: root, path: options.fixturePath, date: options.fixtureDate, parseYaml: options.parseYaml, onReady: options.onReady });
  root.dataset.sjdevStatus = root.querySelector('[data-sjdev-status="error"]') ? "partial" : "ready";
} catch (error) {
  root.dataset.sjdevStatus = "error";
  el("p", "sjdev-water__message", "饮水组件参数或目录无效。未进行文件写入。");
}
