// Small DOM-only factory: no network, filesystem, timers, or Obsidian APIs.
const ns = "http://www.w3.org/2000/svg";
const instanceKey = doc.defaultView?.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let serial = 0;
function element(tag, cls, text, parent) {
  const node = doc.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  parent?.append(node);
  return node;
}
function svgNode(tag, attributes, parent) {
  const node = doc.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attributes ?? {})) node.setAttribute(key, String(value));
  parent?.append(node);
  return node;
}
function duration(minutes) {
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return `${h}小时${m ? `${m}分` : ""}`;
}
function monthInfo(month) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(month));
  if (!match) return null;
  const year = Number(match[1]), number = Number(match[2]);
  if (year < 1 || year > 9999 || number < 1 || number > 12) return null;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const length = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][number - 1];
  return { year, number, length, iso: match[0] };
}

return function createSleepChart(host) {
  const section = element("section", "sjdev-sleep__chart", undefined, host);
  section.setAttribute("aria-label", "所选月份的每日睡眠时长折线图");
  const header = element("header", "sjdev-sleep__chart-header", undefined, section);
  const text = element("div", "sjdev-sleep__chart-headings", undefined, header);
  element("h3", "sjdev-sleep__chart-title", "本月睡眠时长", text);
  const monthLabel = element("p", "sjdev-sleep__chart-month", "", text);
  const stats = element("p", "sjdev-sleep__chart-stats", "", header);
  const message = element("p", "sjdev-sleep__chart-message", "", section);
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  const graphic = element("div", "sjdev-sleep__chart-graphic", undefined, section);
  const details = element("details", "sjdev-sleep__chart-details", undefined, section);
  element("summary", "sjdev-sleep__chart-details-title", "查看每日数值", details);
  const values = element("ol", "sjdev-sleep__chart-values", undefined, details);
  let renderId = 0;
  function render({ month, days = [], selectedDate = "", loading = false, error = false } = {}) {
    const info = monthInfo(month);
    renderId++;
    section.dataset.month = info?.iso ?? "";
    section.dataset.state = loading ? "loading" : error || !info ? "error" : "ready";
    monthLabel.textContent = info ? `${info.year} 年 ${info.number} 月` : "月份待选择";
    graphic.replaceChildren();
    values.replaceChildren();
    if (loading || error || !info) {
      section.dataset.validDays = "";
      section.dataset.averageMinutes = "";
      section.dataset.lineSegments = "";
      stats.textContent = "";
      message.textContent = loading ? "正在整理这个月的睡眠记录…" : "这个月的睡眠记录暂时无法加载，请稍后重试。";
      message.dataset.error = String(!loading);
      graphic.hidden = true;
      details.hidden = true;
      return;
    }
    const source = new Map();
    for (const item of Array.isArray(days) ? days : []) {
      if (!item || typeof item.date !== "string" || !item.date.startsWith(info.iso + "-")) continue;
      const n = Number(item.date.slice(8));
      if (!Number.isInteger(n) || n < 1 || n > info.length || item.date !== `${info.iso}-${String(n).padStart(2, "0")}`) continue;
      const minutes = item.minutes;
      source.set(item.date, typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0 && minutes < 1440 ? minutes : null);
    }
    const rows = Array.from({ length: info.length }, (_, index) => {
      const date = `${info.iso}-${String(index + 1).padStart(2, "0")}`;
      return { date, day: index + 1, minutes: source.get(date) ?? null };
    });
    const recorded = rows.filter(row => row.minutes !== null);
    const mean = recorded.length ? Math.round(recorded.reduce((sum, row) => sum + row.minutes, 0) / recorded.length) : null;
    section.dataset.validDays = String(recorded.length);
    section.dataset.averageMinutes = mean === null ? "" : String(mean);
    stats.textContent = recorded.length ? `已记录 ${recorded.length} 天 · 平均 ${duration(mean)}` : "还没有完整睡眠记录";
    message.textContent = recorded.length ? "" : "记下入睡和起床时间，看看休息如何慢慢变规律。";
    message.dataset.error = "false";
    graphic.hidden = false;
    details.hidden = !recorded.length;
    const width = 520, height = 180;
    const plot = { x: 38, y: 16, width: 468, height: 132 };
    const maximum = recorded.length ? Math.max(...recorded.map(row => row.minutes / 60)) : 0;
    const ceiling = Math.min(24, Math.max(12, Math.ceil(maximum / 4) * 4));
    const x = day => plot.x + (day - 1) / (info.length - 1) * plot.width;
    const y = minutes => plot.y + plot.height * (1 - minutes / 60 / ceiling);
    const graphicId = `sjdev-sleep-chart-${instanceKey}-${++serial}-${renderId}`;
    const svg = svgNode("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-labelledby": `${graphicId}-title ${graphicId}-desc`, preserveAspectRatio: "xMidYMid meet", class: "sjdev-sleep__chart-svg" }, graphic);
    const title = svgNode("title", { id: `${graphicId}-title` }, svg);
    title.textContent = `${info.year}年${info.number}月每日睡眠时长`;
    const description = svgNode("desc", { id: `${graphicId}-desc` }, svg);
    description.textContent = recorded.length ? `横轴为1日至${info.length}日，纵轴为睡眠小时数。已记录${recorded.length}天，平均${duration(mean)}。缺失日期留空，折线不会跨过缺失日期。下方可展开每日数值。` : "尚未记录完整的入睡与起床时间。坐标内留白不代表零小时。";
    const selected = rows.find(row => row.date === selectedDate);
    if (selected) svgNode("rect", { x: x(selected.day) - 5, y: plot.y, width: 10, height: plot.height, rx: 5, class: "sjdev-sleep__chart-selected-band" }, svg);
    const axis = svgNode("g", { class: "sjdev-sleep__chart-axis", "aria-hidden": "true" }, svg);
    for (let hours = 0; hours <= ceiling; hours += 4) {
      const at = y(hours * 60);
      svgNode("line", { x1: plot.x, y1: at, x2: plot.x + plot.width, y2: at, class: "sjdev-sleep__chart-gridline" }, axis);
      const label = svgNode("text", { x: plot.x - 8, y: at + 3, "text-anchor": "end", class: "sjdev-sleep__chart-y-label" }, axis);
      label.textContent = String(hours);
    }
    const unit = svgNode("text", { x: plot.x - 8, y: 9, "text-anchor": "end", class: "sjdev-sleep__chart-unit" }, axis);
    unit.textContent = "小时";
    const tickDays = new Set([1, 5, 10, 15, 20, 25, info.length]);
    for (const n of [...tickDays].filter(n => n <= info.length).sort((a, b) => a - b)) {
      svgNode("line", { x1: x(n), y1: plot.y + plot.height, x2: x(n), y2: plot.y + plot.height + 4, class: "sjdev-sleep__chart-tick" }, axis);
      const label = svgNode("text", { x: x(n), y: plot.y + plot.height + 17, "text-anchor": "middle", class: "sjdev-sleep__chart-x-label" }, axis);
      label.textContent = `${n}`;
    }
    const lines = svgNode("g", { class: "sjdev-sleep__chart-lines", "aria-hidden": "true" }, svg);
    let segment = [], segmentCount = 0;
    function flush() {
      if (segment.length > 1) {
        svgNode("polyline", { points: segment.map(row => `${x(row.day)},${y(row.minutes)}`).join(" "), class: "sjdev-sleep__chart-line" }, lines);
        segmentCount++;
      }
      segment = [];
    }
    for (const row of rows) { if (row.minutes === null) flush(); else segment.push(row); }
    flush();
    section.dataset.lineSegments = String(segmentCount);
    const points = svgNode("g", { class: "sjdev-sleep__chart-points" }, svg);
    for (const row of recorded) {
      const isSelected = row.date === selectedDate;
      const point = svgNode("circle", {
        cx: x(row.day), cy: y(row.minutes), r: isSelected ? 4.5 : 3,
        class: "sjdev-sleep__chart-point", tabindex: "0", role: "img",
        "aria-label": `${row.date}，睡眠${duration(Math.round(row.minutes))}${isSelected ? "，月历所选日期" : ""}`,
        "data-date": row.date, "data-selected": String(isSelected)
      }, points);
      svgNode("title", {}, point).textContent = `${row.date} · ${duration(Math.round(row.minutes))}`;
    }
    for (const row of rows) {
      const li = element("li", "sjdev-sleep__chart-value", undefined, values);
      if (row.date === selectedDate) li.dataset.selected = "true";
      const time = element("time", "", `${row.day}日`, li); time.dateTime = row.date;
      element("span", "", row.minutes === null ? "未记录" : duration(Math.round(row.minutes)), li);
    }
  }
  return { render };
};
