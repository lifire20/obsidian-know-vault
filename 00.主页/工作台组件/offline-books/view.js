// Production reads local Weread-exported notes; prototype reads marked fixtures.
// Never accesses credentials or triggers synchronization. Covers load as images.
const options = input ?? {};
const fixtureRoot = "90_ObsidianDev/tests/fixtures/offline-books";
const HostElement = dv.container.ownerDocument.defaultView.HTMLElement;
// A stale async parent mount must not fall back into a newer render's container.
if (options.mount !== undefined && !(options.mount instanceof HostElement && dv.container.contains(options.mount))) return;
const mount = options.mount ?? dv.container;
const root = document.createElement("section");
root.className = "sjdev-offline-books";
root.dataset.sjdevStatus = "loading";
root.dataset.dataSource = options.showSamples === false ? "weread-local-notes" : "fictional-offline-fixtures";
root.setAttribute("aria-label", options.showSamples === false ? "微信读书阅读书架" : "微信读书离线书架，虚构样本");
mount.appendChild(root);

function el(tag, cls, text, parent = root) {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node);
  return node;
}
function string(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function sampleDate(value) {
  const text = value && typeof value.toISODate === "function" ? value.toISODate() : value;
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = dv.luxon.DateTime.fromISO(text, { zone: "local" });
  return date.isValid && date.toISODate() === text ? text : null;
}
function exactFile(path) {
  if (typeof path !== "string" || !path.startsWith(fixtureRoot + "/") ||
      path.split("/").some(part => part === ".." || part === ".")) return null;
  return dv.app.vault.getFileByPath(path);
}
function localLink(parent, path) {
  const file = exactFile(path);
  if (!file || file.extension !== "md") {
    el("span", "sjdev-offline-books__muted", "样本笔记不可用", parent);
    return;
  }
  const holder = dv.el("span", dv.fileLink(path, false, "打开样本笔记 ↗"), {
    container: parent, cls: "sjdev-offline-books__link"
  });
  holder.addEventListener("click", event => {
    if (!event.target.closest?.("a")) return;
    event.preventDefault();
    event.stopPropagation();
    const latest = exactFile(path);
    if (!latest || latest.extension !== "md") {
      holder.textContent = "样本已移动或删除，请刷新";
      return;
    }
    void dv.app.workspace.getLeaf(event.ctrlKey || event.metaKey ? "tab" : false)
      .openFile(latest).catch(() => { holder.textContent = "暂时无法打开样本"; });
  }, true);
}
function cover(parent, page, title) {
  const shell = el("div", "sjdev-offline-books__cover", undefined, parent);
  const file = exactFile(page.sample_cover);
  const allowedImage = file && ["svg", "png", "jpg", "jpeg", "webp"].includes(file.extension.toLowerCase());
  const placeholder = () => {
    shell.replaceChildren();
    el("span", "sjdev-offline-books__cover-kicker", "LOCAL SAMPLE", shell);
    el("span", "sjdev-offline-books__cover-title", title, shell);
    el("span", "sjdev-offline-books__cover-label", "虚构封面", shell);
  };
  if (!allowedImage) { placeholder(); return; }
  const img = el("img", "sjdev-offline-books__cover-image", undefined, shell);
  img.alt = `${title}，本地自制虚构样本封面`;
  img.decoding = "async";
  img.loading = "lazy";
  img.addEventListener("error", placeholder, { once: true });
  img.src = dv.app.vault.getResourcePath(file);
}

function readingProgress(value) {
  if (typeof value === "string") {
    const text = value.trim();
    if (!/^\d+(?:\.\d+)?%?$/.test(text)) return null;
    value = Number(text.replace(/%$/, ""));
  }
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
function bookId(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? String(value) : null;
}
function renderSyncedBooks(limit, badge) {
  const noteRoot = string(options.sourceRoot, "06.日常阅读").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const validRoot = noteRoot && !noteRoot.split("/").some(part => !part || part === "." || part === "..") &&
    noteRoot !== "90_ObsidianDev" && !noteRoot.startsWith("90_ObsidianDev/");
  function liveFile(path) {
    if (!validRoot || typeof path !== "string" || !path.startsWith(noteRoot + "/") ||
        path.split("/").some(part => part === "." || part === "..")) return null;
    const file = dv.app.vault.getFileByPath(path);
    const meta = file && dv.app.metadataCache.getFileCache(file)?.frontmatter;
    return file?.extension === "md" && meta?.doc_type === "weread-highlights-reviews" && bookId(meta.bookId) ? file : null;
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 12) {
    root.dataset.sjdevStatus = "invalid";
    el("p", "sjdev-offline-books__muted", "limit 必须为 1 到 12 的整数。");
    return;
  }
  // Register the Dataview source dependency; no whole-vault or plugin-cache query.
  const pages = validRoot && dv.app.vault.getFolderByPath(noteRoot) ?
    dv.pages(JSON.stringify(noteRoot)).array().filter(page => page.doc_type === "weread-highlights-reviews" &&
      page.sjdev_test !== true && bookId(page.bookId) && liveFile(page.file.path)) : [];
  const updated = page => liveFile(page.file.path)?.stat.mtime ?? 0;
  const rank = page => String(page.readingStatus) === "2" ? 0 : String(page.readingStatus) === "4" ? 2 : 1;
  // For duplicate IDs show the most recently edited note, then prioritize in-progress books.
  pages.sort((a, b) => updated(b) - updated(a) || a.file.path.localeCompare(b.file.path));
  const ids = new Set();
  const unique = pages.filter(page => {
    const id = bookId(page.bookId);
    if (ids.has(id)) return false;
    ids.add(id); return true;
  }).sort((a, b) => rank(a) - rank(b) || updated(b) - updated(a) || a.file.path.localeCompare(b.file.path));
  const rows = unique.slice(0, limit);
  root.dataset.bookCount = String(unique.length);
  root.dataset.visibleCount = String(rows.length);
  root.dataset.duplicateCount = String(pages.length - unique.length);
  root.dataset.sourceRoot = noteRoot;
  badge.textContent = rows.length ? `已接入 · ${unique.length} 本` : "等待同步笔记";
  el("p", "sjdev-offline-books__notice", rows.length ? "今天也读一点 · 优先展示在读书籍" :
    dv.app.plugins.getPlugin("obsidian-weread-plugin") ? "Weread 已启用，正常同步后，书籍会显示在这里。" : "启用 Weread 并同步笔记后，即可在这里继续阅读。");
  const grid = el("div", "sjdev-offline-books__grid");
  for (const page of rows) {
    const title = string(page.title, page.file.name);
    const card = el("article", "sjdev-offline-books__book", undefined, grid);
    card.dataset.notePath = page.file.path;
    const shell = el("div", "sjdev-offline-books__cover", undefined, card);
    const placeholder = () => {
      shell.replaceChildren();
      el("span", "sjdev-offline-books__cover-kicker", "READING", shell);
      el("span", "sjdev-offline-books__cover-title", title, shell);
      el("span", "sjdev-offline-books__cover-label", "微信读书", shell);
    };
    placeholder();
    let coverUrl = null;
    try {
      const url = new URL(page.cover);
      if (url.protocol === "https:" && !url.username && !url.password && !url.port &&
          ["cdn.weread.qq.com", "wfqqreader-1252317822.image.myqcloud.com"].includes(url.hostname)) coverUrl = url.href;
    } catch (_) { /* Missing or untrusted cover keeps the text cover. */ }
    if (coverUrl) {
      shell.replaceChildren();
      const img = el("img", "sjdev-offline-books__cover-image", undefined, shell);
      img.alt = `${title}封面`;
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.addEventListener("error", placeholder, { once: true });
      img.src = coverUrl;
    }
    const body = el("div", "sjdev-offline-books__body", undefined, card);
    const status = String(page.readingStatus);
    el("p", "sjdev-offline-books__sample-label", status === "4" ? "已读完" : status === "2" ? "在读" : "阅读笔记", body);
    el("h3", "sjdev-offline-books__book-title", title, body);
    el("p", "sjdev-offline-books__author", string(page.author, "作者未记录"), body);
    const progress = readingProgress(page.progress);
    el("p", "sjdev-offline-books__progress-label", progress === null ? "阅读进度未记录" : `阅读进度 ${progress}%`, body);
    if (progress !== null) {
      const bar = el("progress", "sjdev-offline-books__progress", undefined, body);
      bar.max = 100; bar.value = progress;
      bar.setAttribute("aria-label", `${title}，阅读进度 ${progress}%`);
    }
    const file = liveFile(page.file.path);
    const date = file && dv.luxon.DateTime.fromMillis(file.stat.mtime).toFormat("MM-dd");
    el("p", "sjdev-offline-books__activity", date ? `笔记更新 · ${date}` : "笔记更新时间未知", body);
    const holder = dv.el("span", dv.fileLink(page.file.path, false, "打开读书笔记 ↗"), {
      container: body, cls: "sjdev-offline-books__link"
    });
    holder.addEventListener("click", event => {
      if (!event.target.closest?.("a")) return;
      event.preventDefault(); event.stopPropagation();
      const latest = liveFile(page.file.path);
      if (!latest) { holder.textContent = "笔记已移动或删除，请刷新"; return; }
      void dv.app.workspace.getLeaf(event.ctrlKey || event.metaKey ? "tab" : false).openFile(latest)
        .catch(() => { holder.textContent = "暂时无法打开笔记"; });
    }, true);
  }
  if (pages.length > unique.length) el("p", "sjdev-offline-books__muted", `另有 ${pages.length - unique.length} 份相同书籍的笔记，展示最近修改的一份。`);
  const footer = el("footer", "sjdev-offline-books__footer");
  el("span", "sjdev-offline-books__muted", "来自 Weread 同步笔记", footer);
  const command = "obsidian-weread-plugin:open-weread-bookshelf-view";
  if (dv.app.commands.commands[command]) {
    const button = el("button", "sjdev-offline-books__action", "打开 Weread 书架 ↗", footer);
    button.type = "button";
    button.addEventListener("click", () => {
      // User explicitly opens the plugin's own view; it may fetch the online shelf.
      try {
        if (!dv.app.commands.executeCommandById(command)) button.textContent = "请先启用 Weread";
      } catch (_) { button.textContent = "暂时无法打开书架"; }
    });
  } else {
    const external = el("a", "sjdev-offline-books__platform", "打开微信读书官网 ↗", footer);
    external.href = "https://weread.qq.com/";
    external.target = "_blank"; external.rel = "noopener noreferrer";
  }
  root.dataset.sjdevStatus = "ready";
}

try {
  const limit = options.limit ?? 3;
  const header = el("header", "sjdev-offline-books__header");
  const headings = el("div", "sjdev-offline-books__headings", undefined, header);
  el("p", "sjdev-offline-books__eyebrow", options.showSamples === false ? "READING / 阅读时光" : "READING / 离线展示", headings);
  el("h2", "sjdev-offline-books__title", string(options.title, "阅读书架"), headings);
  const badge = el("span", "sjdev-offline-books__badge", options.showSamples === false ? "读取笔记" : "虚构样本", header);
  if (options.showSamples === false) {
    renderSyncedBooks(limit, badge);
    return;
  }
  el("p", "sjdev-offline-books__notice", "微信读书尚未接入。以下书籍、作者、进度与笔记活动均为虚构测试数据，不计入真实阅读统计。", root);
  if (!Number.isInteger(limit) || limit < 1 || limit > 12) {
    root.dataset.sjdevStatus = "invalid";
    el("p", "sjdev-offline-books__muted", "limit 必须为 1 到 12 的整数。");
  } else if (!dv.app.vault.getFolderByPath(fixtureRoot)) {
    root.dataset.sjdevStatus = "missing";
    el("p", "sjdev-offline-books__muted", "尚无离线样本目录；未查询真实书架或全库。");
  } else {
    const pages = dv.pages(`"${fixtureRoot}"`).array().filter(page =>
      page.sjdev_test === true && page.fixture_model === "sjdev-offline-book" &&
      typeof page.sample_id === "string" && exactFile(page.file.path));
    const ids = new Set();
    let duplicateCount = 0;
    const rows = pages.filter(page => {
      if (ids.has(page.sample_id)) { duplicateCount++; return false; }
      ids.add(page.sample_id); return true;
    }).sort((a, b) => (sampleDate(b.sample_activity_date) ?? "").localeCompare(sampleDate(a.sample_activity_date) ?? "") ||
      a.file.path.localeCompare(b.file.path)).slice(0, limit);
    root.dataset.bookCount = String(rows.length);
    root.dataset.duplicateCount = String(duplicateCount);
    const grid = el("div", "sjdev-offline-books__grid");
    for (const page of rows) {
      const title = string(page.sample_title, "未命名虚构书籍");
      const card = el("article", "sjdev-offline-books__book", undefined, grid);
      card.dataset.sampleId = page.sample_id;
      card.dataset.notePath = page.file.path;
      cover(card, page, title);
      const body = el("div", "sjdev-offline-books__body", undefined, card);
      el("p", "sjdev-offline-books__sample-label", "虚构书籍 · 测试", body);
      el("h3", "sjdev-offline-books__book-title", title, body);
      el("p", "sjdev-offline-books__author", string(page.sample_author, "作者未填写（样本）"), body);
      const progress = page.sample_progress;
      if (typeof progress === "number" && Number.isFinite(progress) && progress >= 0 && progress <= 100) {
        el("p", "sjdev-offline-books__progress-label", `样本进度 ${progress}%`, body);
        const bar = el("progress", "sjdev-offline-books__progress", undefined, body);
        bar.max = 100; bar.value = progress;
        bar.setAttribute("aria-label", `${title}，虚构样本进度 ${progress}%`);
      } else {
        el("p", "sjdev-offline-books__progress-label", "样本进度未记录或无效", body);
      }
      const activity = sampleDate(page.sample_activity_date);
      el("p", "sjdev-offline-books__activity", activity ? `虚构笔记活动 · ${activity}` : "虚构笔记活动 · 未记录日期", body);
      localLink(body, page.file.path);
    }
    if (!rows.length) el("p", "sjdev-offline-books__muted", "没有符合测试标记的离线书籍；真实阅读数据未接入。");
    if (duplicateCount) el("p", "sjdev-offline-books__muted", `检测到 ${duplicateCount} 个重复样本标识，已避免重复展示。`);
    const footer = el("footer", "sjdev-offline-books__footer");
    el("span", "sjdev-offline-books__muted", "本地封面与笔记 · 无账号同步 · 无阅读时长推算", footer);
    const external = el("a", "sjdev-offline-books__platform", "打开微信读书官网 ↗", footer);
    external.href = "https://weread.qq.com/";
    external.target = "_blank";
    external.rel = "noopener noreferrer";
    root.dataset.sjdevStatus = rows.length ? "ready" : "empty";
  }
} catch (error) {
  root.dataset.sjdevStatus = "error";
  el("p", "sjdev-offline-books__muted", options.showSamples === false ? "读书笔记暂时未能加载，请稍后刷新主页。" : "离线样本未能加载；研究与生活数据不受影响。");
  console.error("sjdev-offline-books: render failed", error?.name ?? "Error");
}
