// sjdev activity-heatmap v1 — local metadata only; no file writes or network.
const options = input ?? {};
// An obsolete async render must not fall back into a replacement container.
if (options.mount !== undefined && !(options.mount instanceof dv.container.ownerDocument.defaultView.HTMLElement && dv.container.contains(options.mount))) return;
const root = document.createElement("section");
root.className = "sjdev-activity-heatmap";
const mount = options.mount instanceof dv.container.ownerDocument.defaultView.HTMLElement && dv.container.contains(options.mount)
  ? options.mount : dv.container;
mount.appendChild(root);

function el(tag, cls, text, parent = root) {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node);
  return node;
}

function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || year > 2200) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day ? date : null;
}

function iso(date) { return date.toISOString().slice(0, 10); }
function dateProperty(value) {
  if (typeof value === "string") return parseDate(value) ? value : null;
  if (value?.isValid && typeof value.toISODate === "function") {
    const result = value.toISODate();
    return parseDate(result) ? result : null;
  }
  return null;
}

function fileFor(path) {
  const file = dv.app.vault.getAbstractFileByPath(path);
  return file?.extension === "md" ? file : null;
}

async function openExisting(path) {
  const file = fileFor(path);
  if (!file) {
    detail.textContent = "来源笔记已不存在；未创建任何文件。";
    return;
  }
  try { await dv.app.workspace.getLeaf(false).openFile(file); }
  catch { detail.textContent = "暂时无法打开来源笔记；未修改文件。"; }
}

const metrics = {
  diary_entries: {label: "已存在日记", unit: "篇", note: "按日记日期检查现有文件；不是创建次数、阅读完成量或学习时长。"},
  research_minutes: {label: "研究分钟", unit: "分钟", note: "仅采用日记中明确的 research_minutes 非负整数；缺失不当作0。"},
  writing_minutes: {label: "写作分钟", unit: "分钟", note: "仅采用日记中明确的 writing_minutes 非负整数；不与研究分钟自动相加。"}
};
let detail;

try {
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("invalid-options");
  const folder = typeof options.dailyFolder === "string" ? options.dailyFolder.trim().replace(/\\/g, "/").replace(/\/+$/, "") : "";
  if (!folder || folder.startsWith("/") || /["\x00-\x1f\x7f:]/.test(folder) ||
      folder.split("/").some(part => !part || part === "." || part === "..")) {
    root.dataset.sjdevStatus = "invalid";
    el("p", "sjdev-activity-heatmap__message", "请提供有效的 dailyFolder；热力图不会回退查询全库。");
  } else if (!Array.isArray(dv.app.vault.getAbstractFileByPath(folder)?.children)) {
    root.dataset.sjdevStatus = "missing";
    el("p", "sjdev-activity-heatmap__message", `日记目录不存在：${folder}`);
  } else {
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const today = options.today ?? localToday;
    if (!parseDate(today)) throw new Error("invalid-today");
    let year = options.year ?? Number(today.slice(0, 4));
    if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error("invalid-year");
    let metric = options.metric ?? "diary_entries";
    if (!Object.hasOwn(metrics, metric)) throw new Error("invalid-metric");

    const index = new Map();
    // Keep a date-addressable conflict separate from an actually absent diary.
    const dateConflicts = new Map();
    const issues = [];
    const seen = new Set();
    function addDateConflict(date, file, reason) {
      issues.push(reason);
      const rows = dateConflicts.get(date) ?? [];
      rows.push({path: file.path, name: file.basename, reason});
      dateConflicts.set(date, rows);
    }
    let candidates;
    if (options.model?.dailyIndex && typeof options.model.dailyIndex === "object" && !Array.isArray(options.model.dailyIndex)) {
      candidates = Object.values(options.model.dailyIndex).flatMap(rows => Array.isArray(rows) ? rows : []);
    } else {
      candidates = dv.pages(`"${folder}"`).array().map(page => ({path: page.file.path}));
    }
    for (const row of candidates) {
      const path = row?.path;
      if (typeof path !== "string" || !path.startsWith(`${folder}/`) || seen.has(path)) continue;
      seen.add(path);
      const file = fileFor(path);
      if (!file) { issues.push("来源文件不存在"); continue; }
      const match = /^(\d{4}-\d{2}-\d{2}) 星期([一二三四五六日天])$/.exec(file.basename);
      const namedPrefix = /^(\d{4}-\d{2}-\d{2})(?:\s|$)/.exec(file.basename);
      if (!match || !parseDate(match[1])) {
        if (namedPrefix && parseDate(namedPrefix[1])) {
          addDateConflict(namedPrefix[1], file, "日记文件名日期可定位，但星期后缀不符合约定");
        } else issues.push("日记文件名日期不符合约定");
        continue;
      }
      const day = parseDate(match[1]);
      const actualWeekday = "日一二三四五六"[day.getUTCDay()];
      if (match[2].replace("天", "日") !== actualWeekday) {
        addDateConflict(match[1], file, "文件名星期与日期冲突"); continue;
      }
      const page = dv.page(path);
      if (page?.date !== undefined && dateProperty(page.date) !== match[1]) {
        addDateConflict(match[1], file, "date属性无效或与文件名冲突"); continue;
      }
      const rows = index.get(match[1]) ?? [];
      rows.push({path, name: file.basename, page});
      index.set(match[1], rows);
    }
    if (Array.isArray(options.model?.issues)) issues.push(...options.model.issues.map(() => "共享日期索引报告异常"));

    const header = el("header", "sjdev-activity-heatmap__header");
    const heading = el("div", "sjdev-activity-heatmap__heading", undefined, header);
    el("p", "sjdev-activity-heatmap__eyebrow", "记录与积累", heading);
    el("h2", "sjdev-activity-heatmap__title", "年度足迹", heading);
    const controls = el("div", "sjdev-activity-heatmap__controls", undefined, header);
    const yearLabel = el("label", "sjdev-activity-heatmap__label", "年份", controls);
    const yearSelect = el("select", "sjdev-activity-heatmap__select", undefined, yearLabel);
    const years = new Set([year, Number(today.slice(0, 4)) - 1, Number(today.slice(0, 4)), Number(today.slice(0, 4)) + 1]);
    for (const day of index.keys()) years.add(Number(day.slice(0, 4)));
    for (const day of dateConflicts.keys()) years.add(Number(day.slice(0, 4)));
    for (const item of [...years].sort((a,b) => a - b)) {
      const option = el("option", "", String(item), yearSelect); option.value = String(item);
    }
    yearSelect.value = String(year);
    const metricLabel = el("label", "sjdev-activity-heatmap__label", "指标", controls);
    const metricSelect = el("select", "sjdev-activity-heatmap__select", undefined, metricLabel);
    for (const [key, config] of Object.entries(metrics)) {
      const option = el("option", "", config.label, metricSelect); option.value = key;
    }
    metricSelect.value = metric;
    const description = el("p", "sjdev-activity-heatmap__description");
    const summary = el("p", "sjdev-activity-heatmap__summary");
    const scroller = el("div", "sjdev-activity-heatmap__scroller");
    scroller.setAttribute("aria-label", "年度网格，可在窄窗口内横向滚动");
    detail = el("div", "sjdev-activity-heatmap__detail");
    detail.setAttribute("aria-live", "polite");
    const legend = el("div", "sjdev-activity-heatmap__legend");
    for (const [state, text] of [["absent","无日记"],["missing","未记录"],["zero","明确0"],["value","有记录"],["future","未来"],["conflict","异常/冲突"]]) {
      const item = el("span", "sjdev-activity-heatmap__legend-item", undefined, legend);
      const swatch = el("span", "sjdev-activity-heatmap__swatch", undefined, item);
      swatch.dataset.state = state;
      el("span", "", text, item);
    }
    const source = el("p", "sjdev-activity-heatmap__source", `来源：${folder} · 本地日历日期 · 周一为周首。`);
    if (issues.length) el("p", "sjdev-activity-heatmap__warning", `${issues.length} 条日期/来源异常已排除；未重命名或补写任何笔记。`);

    function entry(date) {
      const validRows = index.get(date) ?? [];
      const conflicts = dateConflicts.get(date) ?? [];
      const rows = [...validRows, ...conflicts];
      if (date > today) return {state:"future", label:"未来日期，不参与统计", rows};
      if (conflicts.length) return {state:"conflict", label:`日期/星期属性冲突，${rows.length}篇候选需人工确认`, rows};
      if (!rows.length) return {state:"absent", label:"无日记（不代表活动为零）", rows};
      if (rows.length > 1) return {state:"conflict", label:`同日${rows.length}篇日记，需人工确认`, rows};
      if (metric === "diary_entries") return {state:"value", value:1, label:"存在1篇日记（非活动量）", rows};
      const value = rows[0].page?.[metric];
      if (value === undefined || value === null || value === "") return {state:"missing", label:"未记录该指标", rows};
      if (!Number.isSafeInteger(value) || value < 0) return {state:"invalid", label:"指标类型/数值无效，未计入", rows};
      return {state:value === 0 ? "zero" : "value", value, label:`已记录${value}${metrics[metric].unit}`, rows};
    }

    function describe(date, item) {
      detail.replaceChildren();
      el("strong", "sjdev-activity-heatmap__detail-date", date, detail);
      el("span", "sjdev-activity-heatmap__detail-state", item.label, detail);
      for (const row of item.rows) {
        const link = el("a", "sjdev-activity-heatmap__link internal-link", row.name, detail);
        link.href = row.path; link.dataset.href = row.path; link.dataset.path = row.path;
        link.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); void openExisting(row.path); });
      }
    }

    function render() {
      root.dataset.year = String(year); root.dataset.metric = metric;
      description.textContent = metrics[metric].note;
      scroller.replaceChildren();
      const start = new Date(Date.UTC(year, 0, 1));
      const end = new Date(Date.UTC(year + 1, 0, 1));
      const days = Math.round((end - start) / 86400000);
      const offset = (start.getUTCDay() + 6) % 7;
      const weeks = Math.ceil((offset + days) / 7);
      const chart = el("div", "sjdev-activity-heatmap__chart", undefined, scroller);
      chart.style.setProperty("--sjdev-heatmap-weeks", String(weeks));
      const months = el("div", "sjdev-activity-heatmap__months", undefined, chart);
      for (let month = 0; month < 12; month++) {
        const delta = Math.round((Date.UTC(year,month,1) - start.getTime()) / 86400000);
        const label = el("span", "sjdev-activity-heatmap__month", `${month+1}月`, months);
        label.style.gridColumn = String(Math.floor((offset+delta)/7)+1);
      }
      const weekdays = el("div", "sjdev-activity-heatmap__weekdays", undefined, chart);
      for (const name of ["一","二","三","四","五","六","日"]) el("span", "", name, weekdays);
      const grid = el("div", "sjdev-activity-heatmap__grid", undefined, chart);
      grid.setAttribute("role", "grid"); grid.setAttribute("aria-label", `${year}年${metrics[metric].label}，方向键按天/周移动，Enter打开已有日记`);
      const buttons = [];
      const counts = {value:0,zero:0,missing:0,absent:0,future:0,conflict:0,invalid:0};
      let total = 0;
      let active = year === Number(today.slice(0,4)) ? today : `${year}-01-01`;
      for (let slot = 0; slot < weeks*7; slot++) {
        const dayIndex = slot-offset;
        if (dayIndex < 0 || dayIndex >= days) {
          const blank = el("span", "sjdev-activity-heatmap__padding", undefined, grid);
          blank.setAttribute("aria-hidden", "true"); continue;
        }
        const date = iso(new Date(start.getTime()+dayIndex*86400000));
        const item = entry(date); counts[item.state]++;
        if (Number.isFinite(item.value)) total += item.value;
        const button = el("button", "sjdev-activity-heatmap__day", undefined, grid);
        button.type="button"; button.setAttribute("role", "gridcell");
        button.dataset.date=date; button.dataset.state=item.state;
        if (item.value !== undefined) button.dataset.value=String(item.value);
        button.dataset.level = item.state === "value" ? String(metric === "diary_entries" ? 2 : item.value >= 120 ? 4 : item.value >= 60 ? 3 : item.value >= 30 ? 2 : 1) : "0";
        button.title = `${date} · ${item.label}${item.rows.length ? ` · ${item.rows.map(row=>row.name).join("、")}` : ""}`;
        button.setAttribute("aria-label", button.title); button.tabIndex = date===active ? 0 : -1;
        if (date===today) { button.dataset.today="true"; button.setAttribute("aria-current", "date"); }
        button.addEventListener("focus", () => {
          for (const node of buttons) node.tabIndex = node===button ? 0 : -1;
          active=date; describe(date,item);
        });
        button.addEventListener("click", () => {
          describe(date,item);
          if(item.rows.length===1 && item.state!=="conflict") void openExisting(item.rows[0].path);
        });
        button.addEventListener("keydown", event => {
          const shifts = {ArrowLeft:-7, ArrowRight:7, ArrowUp:-1, ArrowDown:1};
          if (Object.hasOwn(shifts,event.key)) {
            event.preventDefault(); buttons[Math.max(0,Math.min(days-1,dayIndex+shifts[event.key]))]?.focus();
          }
        });
        buttons.push(button);
      }
      const valid = counts.value+counts.zero;
      summary.textContent = metric === "diary_entries"
        ? `${year}年 · ${counts.value}个日期存在日记 · ${counts.absent}天无日记 · ${counts.future}天未来`
        : `${year}年 · ${valid}天有有效记录（其中${counts.zero}天明确为0） · ${counts.missing}天未记录 · ${counts.absent}天无日记${valid ? ` · 已记录合计${total}分钟` : " · 尚无有效分钟记录"}`;
      if(counts.conflict || counts.invalid) summary.textContent += ` · ${counts.conflict+counts.invalid}天数据冲突/异常`;
      root.dataset.total = metric === "diary_entries" || valid ? String(total) : "";
      root.dataset.recordedDays=String(valid);
      root.dataset.zeroDays=String(counts.zero); root.dataset.unknownDays=String(counts.absent+counts.missing+counts.conflict+counts.invalid);
      root.dataset.calendarDays=String(days); root.dataset.anomalies=String(issues.length+counts.conflict+counts.invalid);
      describe(active,entry(active));
    }
    yearSelect.addEventListener("change",()=>{year=Number(yearSelect.value);render();});
    metricSelect.addEventListener("change",()=>{metric=metricSelect.value;render();});
    render();
    root.dataset.sjdevStatus="ready";
  }
} catch {
  root.replaceChildren(); root.dataset.sjdevStatus="error";
  el("p", "sjdev-activity-heatmap__message", "年度热力图加载失败，请核对参数、目录与Dataview索引；未修改任何笔记。");
}
