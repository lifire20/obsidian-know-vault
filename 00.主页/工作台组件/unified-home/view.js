// 研究数据只读；主页待办与生活记录分别保存。
const options = input ?? {};
const started = performance.now();
const generation = (dv.container.sjdevHomeGeneration ?? 0) + 1;
dv.container.sjdevHomeGeneration = generation;
for (const old of dv.container.querySelectorAll(":scope > .sjdev-home")) old.remove();
const root = document.createElement("main");
root.className = "sjdev-home sjdev-home--anya";
root.dataset.sjdevStatus = "loading";
dv.container.appendChild(root);
const app = dv.app;
const DateTime = dv.luxon.DateTime;
const isProduction = options.mode === "production";
const viewBase = isProduction ? "00.主页/工作台组件" : "90_ObsidianDev/views";
if (isProduction) root.classList.add("sjdev-home--published");
const dailyFolder = "02.生活记录/每日记录";
const taskFolders = [dailyFolder, "03.项目管理", "07.会议与商业/与导师会议"];

function el(tag, cls, text, parent = root) {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node);
  return node;
}
function fileLink(parent, path, label) {
  if (!app.vault.getFileByPath(path)) {
    el("span", "sjdev-home__muted", `${label} · 暂无笔记`, parent);
    return false;
  }
  const holder = dv.el("span", dv.fileLink(path, false, label), { container: parent });
  holder.addEventListener("click", event => {
    if (!event.target.closest?.("a")) return;
    event.preventDefault();
    event.stopPropagation();
    const file = app.vault.getFileByPath(path);
    if (!file) { holder.textContent = `${label} · 文件已移动，请刷新`; return; }
    void app.workspace.getLeaf(event.ctrlKey || event.metaKey ? "tab" : false)
      .openFile(file).catch(() => { holder.textContent = `${label} · 暂时无法打开`; });
  }, true);
  return true;
}
function searchLink(parent, query, label) {
  const link = el("a", "sjdev-home__search", label, parent);
  link.href = `obsidian://search?vault=${encodeURIComponent(app.vault.getName())}&query=${encodeURIComponent(query)}`;
  link.dataset.query = query;
}
function localDate(value) {
  const text = typeof value?.toISODate === "function" ? value.toISODate() : value;
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = DateTime.fromISO(text, { zone: "local" });
  return date.isValid && date.toISODate() === text ? date : null;
}
function getPages(folder) {
  if (!app.vault.getFolderByPath(folder)) return [];
  return dv.pages(`"${folder}"`).array();
}
function dateOfDaily(page) {
  const match = /^(\d{4}-\d{2}-\d{2}) 星期([一二三四五六日天])$/.exec(page.file.name);
  if (!match) return null;
  const date = localDate(match[1]);
  if (!date || "一二三四五六日"[date.weekday - 1] !== match[2].replace("天", "日")) return null;
  if (page.date !== undefined) {
    const declared = localDate(page.date);
    if (!declared || declared.toISODate() !== date.toISODate()) return null;
  }
  return date.toISODate();
}
async function mountView(name, host, params) {
  if (dv.container.sjdevHomeGeneration !== generation || !dv.container.contains(root)) return;
  await dv.view(`${viewBase}/${name}`, { ...params, mount: host });
  if (dv.container.sjdevHomeGeneration !== generation || !dv.container.contains(root)) return;
  // dv.view可能内部捕获异常，因此同时验证实际组件根状态。
  const component = host.querySelector("[data-sjdev-status]");
  if (!component || component.dataset.sjdevStatus === "error") {
    el("p", "sjdev-home__error", "此模块暂未加载，请刷新后重试。", host);
    host.dataset.sjdevStatus = "error";
  }
}

// Give each module its own portrait cropped from the user's material library.
// Selectors keep assignments stable across asynchronous renders and reordering.
function decorateModuleAvatars() {
  if (!dv.container.contains(root)) return;
  const portraits = [
    [".sjdev-pomodoro__title", "pomodoro"],
    [".sjdev-quick-tasks__title", "quick-tasks"],
    [".sjdev-home__section-title", "today"],
    [".sjdev-water__title", "water"],
    [".sjdev-anya-habits__title", "habits"],
    [".sjdev-daily-life__title", "daily-life"],
    [".sjdev-sleep__title", "sleep"],
    [".sjdev-month-calendar__title", "month-calendar"],
    [".sjdev-research-workspace__literature .sjdev-research-workspace__title", "literature"],
    [".sjdev-research-workspace__projects .sjdev-research-workspace__title", "projects"],
    [".sjdev-offline-books__title", "books"],
    [".sjdev-music-launcher__title", "music"],
    [".sjdev-activity-heatmap__title", "heatmap"],
    [".sjdev-week-calendar__title", "week-calendar"]
  ].map(([selector, key]) => {
    const file = app.vault.getFileByPath(`${viewBase}/unified-home/assets/avatars/avatar-${key}.webp`);
    return { selector, key, source: file ? app.vault.getResourcePath(file) : null };
  });
  const decorate = () => {
    for (const { selector, key, source } of portraits) {
      if (!source) continue;
      for (const heading of root.querySelectorAll(selector)) {
        let image = heading.querySelector(":scope > .sjdev-home__module-avatar");
        if (!image) {
          image = root.ownerDocument.createElement("img");
          image.className = "sjdev-home__module-avatar";
          image.alt = "";
          image.width = 32;
          image.height = 32;
          image.decoding = "async";
          image.setAttribute("aria-hidden", "true");
          image.draggable = false;
          heading.classList.add("sjdev-home__module-heading");
          heading.prepend(image);
        }
        if (image.getAttribute("src") !== source) image.src = source;
        image.dataset.sjdevAvatar = key;
      }
    }
  };
  decorate();
  const observer = new root.ownerDocument.defaultView.MutationObserver(decorate);
  observer.observe(root, { childList: true, subtree: true });
  const detached = new root.ownerDocument.defaultView.MutationObserver(() => {
    if (!dv.container.contains(root)) cleanup();
  });
  detached.observe(dv.container, { childList: true });
  function cleanup() { observer.disconnect(); detached.disconnect(); }
  if (dv.component?.register) dv.component.register(cleanup);
}

try {
  const recordRoot = isProduction ? "02.生活记录/主页记录" : "90_ObsidianDev/tests/fixtures/life-records";
  const makeLifeStore = new Function("app", "DateTime", "base", await app.vault.adapter.read(`${viewBase}/life-store/store.js`));
  const lifeStore = makeLifeStore(app, DateTime, recordRoot);
  const today = localDate(options.today) ?? DateTime.now().setZone("Asia/Shanghai").startOf("day");
  const todayISO = today.toISODate();
  root.dataset.today = todayISO;
  const diaries = getPages(dailyFolder);
  const todayPages = diaries.filter(p => dateOfDaily(p) === todayISO);
  const hero = el("header", "sjdev-home__hero");
  const bannerFile = app.vault.getFileByPath(`${viewBase}/unified-home/assets/anya-banner.webp`);
  if (bannerFile) {
    hero.classList.add("sjdev-home__hero--banner");
    const art = el("div", "sjdev-anya-banner__art", undefined, hero);
    art.setAttribute("aria-hidden", "true");
    const banner = el("img", "sjdev-anya-banner__image", undefined, art);
    banner.src = app.vault.getResourcePath(bannerFile);
    banner.alt = "";
    banner.width = 1280;
    banner.height = 720;
    banner.decoding = "async";
  }
  const identity = el("div", "sjdev-home__identity", undefined, hero);
  el("p", "sjdev-home__eyebrow", isProduction ? "PERSONAL WORKSPACE / 研究与生活" : "PERSONAL WORKSPACE / 独立原型 · 第二轮", identity);
  const title = el("h1", "sjdev-home__title", "研究与生活", identity);
  el("span", "sjdev-anya-title-star", "✦", title).setAttribute("aria-hidden", "true");
  el("p", "sjdev-home__subtitle", "让今天有方向，让积累有迹可循。", identity);
  const companion = el("aside", "sjdev-anya-companion", undefined, hero);
  companion.setAttribute("aria-label", "研究搭子的欢迎语");
  const avatarFile = app.vault.getFileByPath(`${viewBase}/unified-home/assets/anya-avatar-library.webp`);
  if (avatarFile && !bannerFile) {
    const avatar = el("img", "sjdev-anya-companion__avatar", undefined, companion);
    avatar.src = app.vault.getResourcePath(avatarFile);
    avatar.alt = "";
    avatar.width = 88;
    avatar.height = 88;
    avatar.setAttribute("aria-hidden", "true");
  }
  const bubble = el("div", "sjdev-anya-companion__bubble", undefined, companion);
  el("span", "sjdev-anya-companion__label", "研究搭子", bubble);
  el("p", "sjdev-anya-companion__message", "哇酷哇酷，开始学习吧。", bubble);
  const date = el("div", "sjdev-home__date", undefined, hero);
  const time = el("time", "sjdev-home__date-value", today.toFormat("yyyy.MM.dd"), date);
  time.dateTime = todayISO;
  el("span", "sjdev-home__muted", `星期${"一二三四五六日"[today.weekday - 1]} · 第 ${today.weekNumber} 周`, date);

  const nav = el("nav", "sjdev-home__nav");
  nav.setAttribute("aria-label", "工作台导航");
  if (todayPages.length === 1) fileLink(nav, todayPages[0].file.path, "今日笔记 ↗");
  else searchLink(nav, `path:"${dailyFolder}" ${todayISO}`, todayPages.length > 1 ? "今日笔记 · 多个候选" : "查找今日笔记");
  fileLink(nav, "01.文献阅读/文献笔记总索引.md", "文献总索引");
  searchLink(nav, 'path:"03.项目管理"', "研究项目 · 搜索");
  fileLink(nav, "05.知识卡片/知识卡片索引.md", "知识卡片");
  fileLink(nav, "Quick Capture.md", "快速捕捉");

  const actions = el("div", "sjdev-home__action-grid");
  const pomodoro = el("div", "sjdev-home__pomodoro-host", undefined, actions);
  const quickTasks = el("div", "sjdev-home__quick-tasks-host", undefined, actions);
  await mountView("pomodoro", pomodoro, { store: lifeStore });
  await mountView("quick-tasks", quickTasks, isProduction ? { path: "00.主页/主页待办.md" } : {});

  const top = el("div", "sjdev-home__today-grid");
  const focus = el("section", "sjdev-home__focus", undefined, top);
  el("p", "sjdev-home__eyebrow", "把注意力留给重要的事", focus);
  el("h2", "sjdev-home__section-title", "今日推进", focus);
  const datedTasks = [];
  const seen = new Set();
  for (const folder of taskFolders) for (const page of getPages(folder)) {
    for (const task of page.file.tasks ?? []) {
      if (task.completed || (task.status !== " " && task.status !== "")) continue;
      const clean = String(task.text ?? "").replace(/#[\p{L}\p{N}_/-]+/gu, "").trim();
      if (!clean) continue;
      const due = localDate(task.due);
      const scheduled = localDate(task.scheduled);
      if (!due && !scheduled) continue;
      const key = `${page.file.path}:${task.line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      datedTasks.push({ text: String(task.text), path: page.file.path, due, scheduled });
    }
  }
  const isToday = value => value?.toISODate() === todayISO;
  const overdue = datedTasks.filter(t => t.due && t.due < today);
  const dueToday = datedTasks.filter(t => isToday(t.due) || isToday(t.scheduled));
  const nextWeek = datedTasks.filter(t => [t.due, t.scheduled].some(d => d && d > today && d <= today.plus({ days: 7 })));
  const metrics = el("div", "sjdev-home__metrics", undefined, focus);
  for (const [label, count] of [["今天到期 / 计划", dueToday.length], ["已逾期", overdue.length], ["未来七天", nextWeek.length]]) {
    const metric = el("div", "sjdev-home__metric", undefined, metrics);
    el("strong", "sjdev-home__metric-value", String(count), metric);
    el("span", "sjdev-home__metric-label", label, metric);
  }
  root.dataset.datedTasks = String(datedTasks.length);
  const visible = [...new Set([...overdue, ...dueToday, ...nextWeek])].slice(0, 5);
  if (visible.length) {
    const list = el("ul", "sjdev-home__task-list", undefined, focus);
    for (const task of visible) {
      const item = el("li", "sjdev-home__task", undefined, list);
      el("p", "sjdev-home__task-text", task.text, item);
      fileLink(item, task.path, "打开任务来源 ↗");
    }
  } else {
    el("p", "sjdev-home__empty", "尚无已记录日期的待办。先从今日笔记开始，写下想推进的一件小事。", focus);
  }
  el("p", "sjdev-home__scope", "仅统计日记、项目、导师会议中的标准未完成待办及明确到期/计划日；无日期或自定义状态任务未纳入。", focus);
  const review = el("div", "sjdev-home__review", undefined, focus);
  searchLink(review, 'path:"02.生活记录/每周记录"', "周回顾");
  searchLink(review, 'path:"02.生活记录/每月记录"', "月回顾");

  // Each Dataview block owns its selection, including across its own rerenders.
  const selections = app[Symbol.for("sjdev.home.calendarDates")] ??= new WeakMap();
  let dates = selections.get(dv.container);
  if (!dates) { dates = new Map(); selections.set(dv.container, dates); }
  const calendarState = dates.get(recordRoot) ?? { date: todayISO, followToday: true };
  if (calendarState.followToday || !lifeStore.validDate(calendarState.date)) calendarState.date = todayISO;
  dates.set(recordRoot, calendarState);
  const dateListeners = new Set();
  const dateSource = {
    getDate: () => calendarState.date,
    subscribe: callback => { dateListeners.add(callback); return () => dateListeners.delete(callback); }
  };
  const calendar = el("div", "sjdev-home__calendar-host", undefined, top);
  await mountView("month-calendar", calendar, {
    dailyFolder, taskFolders, today: todayISO,
    initialMonth: calendarState.date.slice(0, 7), selectedDate: calendarState.date,
    openOnSelect: false, followSystemDate: options.today === undefined,
    onSelectDate: iso => {
      if (dv.container.sjdevHomeGeneration !== generation || !dv.container.contains(root)) return;
      const changed = calendarState.date !== iso;
      calendarState.date = iso; calendarState.followToday = iso === lifeStore.today();
      if (changed) for (const callback of [...dateListeners]) callback(iso);
    }
  });

  const life = el("div", "sjdev-home__life-grid");
  const habits = el("div", "sjdev-home__habits-host", undefined, life);
  await mountView("habit-tracker", habits, { store: lifeStore });
  const water = el("div", "sjdev-home__water-host", undefined, life);
  await mountView("water-tracker", water, { store: lifeStore });
  const sleep = el("div", "sjdev-home__sleep-host", undefined, life);
  await mountView("sleep-tracker", sleep, { store: lifeStore, dateSource, viewBase: `${viewBase}/sleep-tracker` });
  const dailyLife = el("div", "sjdev-home__daily-life-host", undefined, life);
  await mountView("daily-life", dailyLife, { store: lifeStore });

  const research = el("div", "sjdev-home__research-host");
  await mountView("research-workspace", research, {
    literatureFolder: "01.文献阅读/01.文献笔记", literatureTree: "01.文献阅读",
    projectFolder: "03.项目管理", limit: 5
  });
  const leisure = el("div", "sjdev-home__leisure-grid");
  const books = el("div", "sjdev-home__books-host", undefined, leisure);
  await mountView("offline-books", books, { limit: 3, title: "阅读书架", showSamples: !isProduction });
  const music = el("div", "sjdev-home__music-host", undefined, leisure);
  await mountView("music-launcher", music, isProduction ? {
    playlists: [{ name: "网易云热歌榜", playlistId: "3778678" }, { name: "网易云飙升榜", playlistId: "19723756" }]
  } : {});

  const activity = el("div", "sjdev-home__activity-host");
  await mountView("activity-heatmap", activity, { dailyFolder, today: todayISO, year: today.year });
  el("p", "sjdev-anya-footnote", "✦ 每一小步，都算数。还没记录的日子，也可以慢慢补上。", activity);

  const week = el("div", "sjdev-home__week-calendar-host");
  await mountView("week-calendar", week, { today: todayISO, timezone: "Asia/Shanghai" });

  const footer = el("footer", "sjdev-home__footer");
  el("span", "sjdev-home__muted", "习惯、饮水与睡眠打卡即时保存 · 三餐与补记点击保存 · 完整番茄轮次计入专注时长", footer);
  el("span", "sjdev-home__muted", isProduction ? "iCloud 日历支持双向连接 · 音乐按需加载" : "生活操作仅保存到测试记录 · 书架为虚构样本", footer);
  fileLink(footer, "使用说明.md", "模板使用说明 ↗");
  root.dataset.sjdevStatus = root.querySelector('[data-sjdev-status="error"]') ? "partial" : "ready";
} catch (error) {
  root.dataset.sjdevStatus = "error";
  el("p", "sjdev-home__error", "工作台暂时无法加载，请刷新或查看模板使用说明。");
  console.error("sjdev-home: render failed", error?.name ?? "Error");
} finally {
  decorateModuleAvatars();
  // Dataview 0.5.68 does not return the inner async view promise.
  // Clean CSS at actual completion, after all child loaders have run.
  const seenStyles = new Set();
  for (const style of dv.container.querySelectorAll(":scope > style")) {
    if (seenStyles.has(style.textContent)) style.remove();
    else seenStyles.add(style.textContent);
  }
  root.dataset.renderMs = String(Math.round(performance.now() - started));
}
