// sjdev month-calendar v1 · Dataview 0.5.68 / Obsidian 1.14.5
// Read-only metadata queries and navigation. No file creation, modification or network.
const options = input ?? {};
// An obsolete async render must not fall back into a replacement container.
if (options.mount !== undefined && !(options.mount instanceof dv.container.ownerDocument.defaultView.HTMLElement && dv.container.contains(options.mount))) return;
const root = document.createElement("section");
root.className = "sjdev-month-calendar";
root.setAttribute("aria-label", "月历：日记与任务日期");
const mount = options?.mount instanceof dv.container.ownerDocument.defaultView.HTMLElement &&
  dv.container.contains(options.mount) ? options.mount : dv.container;
mount.appendChild(root);

function el(tag, cls, text, parent = root) {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node);
  return node;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizePath(value) {
  if (typeof value !== "string") return "";
  const path = value.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (!path || path.startsWith("/") || /["\x00-\x1f\x7f:]/.test(path) ||
      path.split("/").some(part => !part || part === "." || part === "..")) return "";
  return path;
}

function under(path, folder) {
  return path.startsWith(`${folder}/`);
}

// Construct local calendar dates; never parse midnight ISO strings as UTC.
function parseDay(value) {
  let text = value;
  if (value?.isValid === true && typeof value.toISODate === "function") text = value.toISODate();
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const [year, month, day] = text.split("-").map(Number);
  if (year < 100 || year > 9999) return null;
  const date = new Date(year, month - 1, day, 12);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date : null;
}

function key(date) {
  return `${String(date.getFullYear()).padStart(4, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fileAt(path) {
  const file = dv.app.vault.getAbstractFileByPath(path);
  return file?.extension === "md" ? file : null;
}

function hasFolder(path) {
  return dv.app.vault.getAllFolders().some(folder => folder.path === path);
}

function arrayOf(value) {
  return Array.isArray(value) ? value : typeof value?.array === "function" ? value.array() : [];
}

function alertMessage(text, status) {
  root.dataset.sjdevStatus = status;
  el("p", "sjdev-month-calendar__message", text).setAttribute("role", "status");
}

async function renderCalendar() {
  if (!isRecord(options)) {
    alertMessage("月历参数必须是对象。", "invalid");
    return;
  }
  const dailyFolder = normalizePath(options.dailyFolder ?? "02.生活记录/每日记录");
  const requestedTaskFolders = options.taskFolders ?? [dailyFolder];
  if (!dailyFolder || !Array.isArray(requestedTaskFolders) ||
      requestedTaskFolders.some(folder => !normalizePath(folder))) {
    alertMessage("请指定有效的日记目录和 taskFolders 数组；不接受空路径或上级路径。", "invalid");
    return;
  }
  const taskFolders = [...new Set(requestedTaskFolders.map(normalizePath))];
  let todayDate = options.today === undefined ? new Date() : parseDay(options.today);
  if (!todayDate) {
    alertMessage("today 必须是有效的 YYYY-MM-DD 日期。", "invalid");
    return;
  }
  let today = key(todayDate);
  const firstMonth = options.initialMonth === undefined ? today.slice(0, 7) : options.initialMonth;
  if (typeof firstMonth !== "string" || !/^\d{4}-\d{2}$/.test(firstMonth) || !parseDay(`${firstMonth}-01`)) {
    alertMessage("initialMonth 必须是有效的 YYYY-MM。", "invalid");
    return;
  }
  if (options.selectedDate !== undefined && (!parseDay(options.selectedDate) || options.selectedDate.slice(0, 7) !== firstMonth)) {
    alertMessage("selectedDate 必须是当前显示月份中的有效日期。", "invalid");
    return;
  }
  if (!hasFolder(dailyFolder)) {
    alertMessage(`日记目录不存在：${dailyFolder}。未回退到其他目录。`, "missing");
    return;
  }
  if (options.model !== undefined && !isRecord(options.model)) {
    alertMessage("model 必须是包含 dailyIndex / taskDates 的对象。", "invalid");
    return;
  }

  const dailyIndex = Object.create(null);
  const conflictIndex = Object.create(null);
  const taskDates = Object.create(null);
  const issues = [];
  const weekdayNames = ["日", "一", "二", "三", "四", "五", "六"];
  const sourceModel = options.model;
  const diarySeen = new Set();
  const conflictSeen = new Set();
  const taskSeen = new Set();

  function diaryConflict(path, message) {
    issues.push({ path, message });
    const file = fileAt(path);
    const prefix = file && /^(\d{4}-\d{2}-\d{2})(?:\s|$)/.exec(file.basename);
    if (!prefix || !parseDay(prefix[1]) || conflictSeen.has(path)) return;
    conflictSeen.add(path);
    (conflictIndex[prefix[1]] ??= []).push({ path, name: file.basename, message });
  }

  function addDiary(iso, entry, indexedPage) {
    const path = normalizePath(entry?.path);
    const file = path ? fileAt(path) : null;
    if (!path || !under(path, dailyFolder) || !file) {
      issues.push({ message: "一个日记索引条目无效或文件已不存在。" });
      return;
    }
    // Validate the actual file even when an upstream model supplied its date.
    const match = /^(\d{4}-\d{2}-\d{2}) 星期([一二三四五六日天])$/.exec(file.basename);
    const namedDate = match ? parseDay(match[1]) : null;
    if (!namedDate || (match[2] === "天" ? "日" : match[2]) !== weekdayNames[namedDate.getDay()]) {
      diaryConflict(path, "日期冲突：文件名日期或中文星期不符合规则，未纳入有效日记。");
      return;
    }
    if (!parseDay(iso) || iso !== match[1]) {
      diaryConflict(path, "日期冲突：索引日期与真实文件名日期不一致，未纳入有效日记。");
      return;
    }
    const frontmatter = dv.app.metadataCache.getFileCache(file)?.frontmatter;
    const hasDate = frontmatter && Object.prototype.hasOwnProperty.call(frontmatter, "date");
    const page = indexedPage ?? dv.page(path);
    const metadataDate = hasDate ? parseDay(page?.date ?? frontmatter.date) : null;
    if (hasDate && (!metadataDate || key(metadataDate) !== match[1])) {
      diaryConflict(path, "日期冲突：date 属性无效或与文件名日期不一致，未纳入有效日记。");
      return;
    }
    if (diarySeen.has(path)) return;
    diarySeen.add(path);
    (dailyIndex[iso] ??= []).push({ path, name: file.basename });
  }

  function addTask(iso, entry) {
    const path = normalizePath(entry?.path);
    if (!parseDay(iso) || !path || !taskFolders.some(folder => under(path, folder)) || !fileAt(path) ||
        !["due", "scheduled"].includes(entry?.kind)) {
      issues.push({ message: "一个任务日期条目无效、超出范围或文件已不存在。" });
      return;
    }
    const line = Number.isInteger(entry.line) && entry.line >= 0 ? entry.line : null;
    const text = typeof entry.text === "string" ? entry.text.trim() : "";
    if (!text || !text.replace(/#[\p{L}\p{N}_/-]+/gu, "").trim()) return;
    const signature = `${iso}\u0000${path}\u0000${line}\u0000${entry.kind}\u0000${text}`;
    if (taskSeen.has(signature)) return;
    taskSeen.add(signature);
    (taskDates[iso] ??= []).push({ path, line, text, kind: entry.kind,
      status: typeof entry.status === "string" ? entry.status : " " });
  }

  if (sourceModel?.dailyIndex !== undefined) {
    if (!isRecord(sourceModel.dailyIndex)) {
      alertMessage("model.dailyIndex 必须是日期到日记数组的对象。", "invalid");
      return;
    }
    for (const [iso, entries] of Object.entries(sourceModel.dailyIndex)) {
      if (!Array.isArray(entries)) {
        issues.push({ message: "一个日期的日记索引不是数组。" });
        continue;
      }
      for (const entry of entries) addDiary(iso, entry);
    }
  } else {
    for (const page of dv.pages(`"${dailyFolder}"`).array()) {
      const path = normalizePath(page?.file?.path);
      const file = path ? fileAt(path) : null;
      if (!file || !under(path, dailyFolder)) continue;
      const prefix = /^(\d{4}-\d{2}-\d{2})/.exec(file.basename);
      addDiary(prefix?.[1], { path }, page);
    }
  }

  if (sourceModel?.taskDates !== undefined) {
    if (!isRecord(sourceModel.taskDates)) {
      alertMessage("model.taskDates 必须是日期到任务标记数组的对象。", "invalid");
      return;
    }
    for (const [iso, entries] of Object.entries(sourceModel.taskDates)) {
      if (!Array.isArray(entries)) {
        issues.push({ message: "一个日期的任务标记不是数组。" });
        continue;
      }
      for (const entry of entries) addTask(iso, entry);
    }
  } else {
    const visited = new Set();
    for (const folder of taskFolders) {
      if (!hasFolder(folder)) {
        issues.push({ message: `任务目录不存在：${folder}。` });
        continue;
      }
      for (const page of dv.pages(`"${folder}"`).array()) {
        if (visited.has(page.file.path)) continue;
        visited.add(page.file.path);
        for (const task of arrayOf(page.file.tasks)) {
          if (task.completed === true) continue;
          for (const kind of ["due", "scheduled"]) {
            const date = parseDay(task[kind]);
            if (date) addTask(key(date), { path: task.path ?? page.file.path,
              line: task.line, text: task.text, kind, status: task.status });
          }
        }
      }
    }
  }

  for (const [iso, entries] of Object.entries(dailyIndex)) {
    entries.sort((a, b) => a.path.localeCompare(b.path, "zh-CN"));
    if (entries.length > 1) issues.push({ message: `${iso} 对应 ${entries.length} 篇日记；请选择来源，不自动决定。` });
  }
  const header = el("header", "sjdev-month-calendar__header");
  el("p", "sjdev-month-calendar__eyebrow", "日程与记录", header);
  el("h2", "sjdev-month-calendar__title", "月历", header);
  const controls = el("div", "sjdev-month-calendar__controls");
  const previous = el("button", "sjdev-month-calendar__nav", "‹", controls);
  previous.type = "button";
  previous.dataset.action = "previous";
  previous.setAttribute("aria-label", "上一月");
  const monthLabel = el("span", "sjdev-month-calendar__month", undefined, controls);
  monthLabel.setAttribute("aria-live", "polite");
  const next = el("button", "sjdev-month-calendar__nav", "›", controls);
  next.type = "button";
  next.dataset.action = "next";
  next.setAttribute("aria-label", "下一月");
  const current = el("button", "sjdev-month-calendar__today", "本月", controls);
  current.type = "button";
  current.dataset.action = "today";
  current.setAttribute("aria-label", options.openOnSelect === false ? "回到今天" : "回到本月");
  if (options.openOnSelect === false) current.textContent = "今天";

  const weekdayRow = el("div", "sjdev-month-calendar__weekdays");
  weekdayRow.setAttribute("aria-hidden", "true");
  for (const day of ["一", "二", "三", "四", "五", "六", "日"]) el("span", "", day, weekdayRow);
  const grid = el("div", "sjdev-month-calendar__grid");
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", options.openOnSelect === false ? "日期；方向键移动，回车选择入睡记录日期" : "日期；方向键移动，回车打开已有日记");
  const legend = el("div", "sjdev-month-calendar__legend");
  for (const [kind, label] of [["diary", "记 日记"], ["due", "截 截止"], ["scheduled", "计 计划"], ["conflict", "冲 日期冲突"]]) {
    el("span", `sjdev-month-calendar__legend-item sjdev-month-calendar__legend-item--${kind}`, label, legend);
  }
  const details = el("div", "sjdev-month-calendar__details");
  details.setAttribute("aria-live", "polite");
  const notice = el("p", "sjdev-month-calendar__notice", undefined);
  notice.setAttribute("role", "status");
  const summary = el("p", "sjdev-month-calendar__summary",
    `${diarySeen.size} 篇有效日记 · ${taskSeen.size} 个未完成或自定义状态任务日期标记`);
  summary.title = "一个任务的截止与计划日期分开标记；不把日期标记数当作独立任务数。";

  if (issues.length) {
    const diagnostics = el("details", "sjdev-month-calendar__diagnostics");
    el("summary", "", `数据提示 ${issues.length} 项`, diagnostics);
    const list = el("ul", "sjdev-month-calendar__issue-list", undefined, diagnostics);
    for (const issue of issues) {
      const item = el("li", "", issue.message, list);
      if (issue.path && fileAt(issue.path)) sourceLink(item, issue.path, "查看来源");
    }
  }

  const initialDate = parseDay(`${firstMonth}-01`);
  const state = { year: initialDate.getFullYear(), month: initialDate.getMonth(),
    selected: options.selectedDate ?? (firstMonth === today.slice(0, 7) ? today : `${firstMonth}-01`) };

  async function openExisting(path) {
    const file = fileAt(path);
    if (!file) {
      notice.textContent = "来源文件已移动或不存在；未创建新笔记，请刷新索引。";
      return;
    }
    try {
      await dv.app.workspace.getLeaf(false).openFile(file);
    } catch {
      notice.textContent = "未能打开来源文件；没有写入或创建文件。";
    }
  }

  function sourceLink(parent, path, label) {
    if (!fileAt(path)) return;
    const link = el("a", "internal-link sjdev-month-calendar__source", label, parent);
    link.href = path;
    link.dataset.href = path;
    link.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      void openExisting(path);
    });
  }

  function renderDetails() {
    details.replaceChildren();
    root.dataset.selectedDate = state.selected;
    el("h3", "sjdev-month-calendar__detail-title", state.selected, details);
    const diaries = dailyIndex[state.selected] ?? [];
    const conflicts = conflictIndex[state.selected] ?? [];
    if (conflicts.length) {
      el("p", "sjdev-month-calendar__empty", `日期冲突：有 ${conflicts.length} 篇候选未计入有效日记。请核对来源，不会自动打开或修改。`, details);
      const conflictList = el("div", "sjdev-month-calendar__diary-links", undefined, details);
      for (const conflict of conflicts) sourceLink(conflictList, conflict.path, `${conflict.name}（日期冲突）`);
    }
    if (!diaries.length && !conflicts.length) el("p", "sjdev-month-calendar__empty", "这天尚无日记，点击日期不会创建笔记。", details);
    if (diaries.length) {
      if (diaries.length > 1) el("p", "sjdev-month-calendar__empty", `此日有 ${diaries.length} 篇日记，请选择：`, details);
      const diaryList = el("div", "sjdev-month-calendar__diary-links", undefined, details);
      for (const diary of diaries) sourceLink(diaryList, diary.path, diary.name);
    }
    const tasks = taskDates[state.selected] ?? [];
    if (!tasks.length) el("p", "sjdev-month-calendar__empty", "没有已索引的截止或计划任务日期。", details);
    else {
      const list = el("ul", "sjdev-month-calendar__task-list", undefined, details);
      for (const task of tasks.slice(0, 6)) {
        const item = el("li", "sjdev-month-calendar__task", undefined, list);
        el("span", `sjdev-month-calendar__task-kind sjdev-month-calendar__task-kind--${task.kind}`,
          task.kind === "due" ? "截止" : "计划", item);
        el("span", "sjdev-month-calendar__task-text", task.text, item);
        if (task.status.trim()) el("span", "sjdev-month-calendar__task-status", `状态 [${task.status}]`, item);
        sourceLink(item, task.path, "来源");
      }
      if (tasks.length > 6) el("p", "sjdev-month-calendar__empty", `另有 ${tasks.length - 6} 个日期标记，请查看来源笔记。`, details);
    }
  }

  function selectDate(iso) {
    state.selected = iso;
    for (const button of grid.querySelectorAll("button[data-date]")) {
      const selected = button.dataset.date === iso;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    notice.textContent = "";
    renderDetails();
    if (typeof options.onSelectDate === "function") options.onSelectDate(iso);
  }

  function renderMonth() {
    grid.replaceChildren();
    const monthKey = `${String(state.year).padStart(4, "0")}-${String(state.month + 1).padStart(2, "0")}`;
    root.dataset.month = monthKey;
    monthLabel.textContent = `${state.year}年${state.month + 1}月`;
    const first = new Date(state.year, state.month, 1, 12);
    const blanks = (first.getDay() + 6) % 7;
    const count = new Date(state.year, state.month + 1, 0, 12).getDate();
    for (let blank = 0; blank < blanks; blank++) {
      el("span", "sjdev-month-calendar__padding", undefined, grid).setAttribute("aria-hidden", "true");
    }
    for (let day = 1; day <= count; day++) {
      const date = new Date(state.year, state.month, day, 12);
      const iso = key(date);
      const diaries = dailyIndex[iso] ?? [];
      const conflicts = conflictIndex[iso] ?? [];
      const tasks = taskDates[iso] ?? [];
      const due = tasks.filter(task => task.kind === "due").length;
      const scheduled = tasks.filter(task => task.kind === "scheduled").length;
      const button = el("button", "sjdev-month-calendar__day", undefined, grid);
      button.type = "button";
      button.dataset.date = iso;
      button.dataset.diaryCount = String(diaries.length);
      button.dataset.conflictCount = String(conflicts.length);
      button.dataset.dueCount = String(due);
      button.dataset.scheduledCount = String(scheduled);
      button.classList.toggle("is-today", iso === today);
      button.classList.toggle("has-diary", diaries.length > 0);
      button.classList.toggle("has-date-conflict", conflicts.length > 0);
      if (iso === today) button.setAttribute("aria-current", "date");
      const number = el("span", "sjdev-month-calendar__day-number", String(day), button);
      if (iso === today) el("small", "sjdev-month-calendar__today-label", "今", number);
      const marks = el("span", "sjdev-month-calendar__marks", undefined, button);
      marks.setAttribute("aria-hidden", "true");
      for (const [kind, present, label] of [["diary", diaries.length, "记"], ["due", due, "截"], ["scheduled", scheduled, "计"], ["conflict", conflicts.length, "冲"]]) {
        if (present) el("span", `sjdev-month-calendar__mark sjdev-month-calendar__mark--${kind}`, label, marks);
      }
      const description = `${iso} 星期${weekdayNames[date.getDay()]}${iso === today ? " 今天" : ""}；${diaries.length}篇有效日记${conflicts.length ? `；日期冲突 ${conflicts.length} 篇` : ""}；${due}个截止、${scheduled}个计划日期标记`;
      button.title = description;
      button.setAttribute("aria-label", description);
      button.addEventListener("click", () => {
        selectDate(iso);
        if (options.openOnSelect !== false && diaries.length === 1 && conflicts.length === 0) void openExisting(diaries[0].path);
      });
    }
    previous.disabled = state.year === 100 && state.month === 0;
    next.disabled = state.year === 9999 && state.month === 11;
    selectDate(state.selected);
  }

  function shiftMonth(delta) {
    const shifted = new Date(state.year, state.month + delta, 1, 12);
    if (shifted.getFullYear() < 100 || shifted.getFullYear() > 9999) return;
    state.year = shifted.getFullYear();
    state.month = shifted.getMonth();
    state.selected = key(shifted);
    renderMonth();
  }
  previous.addEventListener("click", () => shiftMonth(-1));
  next.addEventListener("click", () => shiftMonth(1));
  current.addEventListener("click", () => {
    state.year = todayDate.getFullYear();
    state.month = todayDate.getMonth();
    state.selected = today;
    renderMonth();
  });
  grid.addEventListener("keydown", event => {
    const target = event.target.closest("button[data-date]");
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!target || !delta) return;
    event.preventDefault();
    const date = parseDay(target.dataset.date);
    date.setDate(date.getDate() + delta);
    if (date.getFullYear() < 100 || date.getFullYear() > 9999) return;
    state.year = date.getFullYear();
    state.month = date.getMonth();
    state.selected = key(date);
    renderMonth();
    grid.querySelector(`button[data-date="${state.selected}"]`)?.focus();
  });
  root.dataset.diaryCount = String(diarySeen.size);
  root.dataset.conflictCount = String(conflictSeen.size);
  root.dataset.taskMarkerCount = String(taskSeen.size);
  root.dataset.issueCount = String(issues.length);
  root.dataset.sjdevStatus = "ready";
  renderMonth();
  // Follow midnight only when the user was on today; historical selections stay put.
  if (options.followSystemDate === true) {
    const win = root.ownerDocument.defaultView;
    let disposed = false;
    const timer = win.setInterval(() => {
      if (!dv.container.contains(root)) { cleanup(); return; }
      const newToday = dv.luxon.DateTime.now().setZone("Asia/Shanghai").toISODate();
      if (newToday === today) return;
      const follow = state.selected === today;
      today = newToday;
      todayDate = parseDay(today);
      if (follow) {
        state.year = todayDate.getFullYear(); state.month = todayDate.getMonth(); state.selected = today;
      }
      renderMonth();
    }, 30000);
    const observer = new win.MutationObserver(() => { if (!dv.container.contains(root)) cleanup(); });
    observer.observe(dv.container, { childList: true, subtree: true });
    function cleanup() {
      if (disposed) return;
      disposed = true; win.clearInterval(timer); observer.disconnect();
    }
    dv.component?.register?.(cleanup);
  }
}

try {
  await renderCalendar();
} catch {
  root.replaceChildren();
  alertMessage("月历加载失败，请检查索引和参数；没有创建或修改文件。", "error");
}
