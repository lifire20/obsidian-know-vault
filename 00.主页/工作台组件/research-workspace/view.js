// research-workspace v1 · Dataview 0.5.68 / Obsidian 1.14.5
// Indexed metadata stays read-only; an explicit form submission can create a project note.
const options = input ?? {};
// An obsolete async render must not fall back into a replacement container.
if (options.mount !== undefined && !(options.mount instanceof dv.container.ownerDocument.defaultView.HTMLElement && dv.container.contains(options.mount))) return;
const root = document.createElement("section");
root.className = "sjdev-research-workspace";
root.setAttribute("aria-label", "研究工作区");
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
function notice(text, status, parent = root) {
  if (status) root.dataset.sjdevStatus = status;
  return el("p", "sjdev-research-workspace__notice", text, parent);
}
function folderPath(value) {
  if (typeof value !== "string") return null;
  const p = value.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (!p || p.startsWith("/") || /["\x00-\x1f\x7f:]/.test(p) ||
      p.split("/").some(part => !part || part === "." || part === "..")) return null;
  return p;
}
function folderExists(p) {
  const file = dv.app.vault.getAbstractFileByPath(p);
  return file && Array.isArray(file.children);
}
function inside(path, folder) { return typeof path === "string" && path.startsWith(folder + "/"); }
function mdFile(path) {
  const file = dv.app.vault.getAbstractFileByPath(path);
  return file?.extension === "md" ? file : null;
}
function safeLink(parent, path, label, cls = "sjdev-research-workspace__link") {
  const file = mdFile(path);
  if (!file) return el("span", cls, `${label}（文件已不可用）`, parent);
  const holder = dv.el("span", dv.fileLink(path, false, label), { container: parent, cls });
  // Recheck the exact TFile at click time, so a stale link can never create a missing note.
  holder.addEventListener("click", event => {
    if (!event.target.closest?.("a")) return;
    event.preventDefault();
    event.stopPropagation();
    const target = mdFile(path);
    if (!target) { notice("目标笔记已移动或删除，请刷新工作台。", null); return; }
    void dv.app.workspace.getLeaf(event.ctrlKey || event.metaKey ? "tab" : false)
      .openFile(target).catch(() => notice("笔记暂时无法打开，请在文件列表中检查。", null));
  }, true);
  return holder;
}
function searchLink(parent, folder, label) {
  const a = el("a", "sjdev-research-workspace__browse", label, parent);
  a.href = `obsidian://search?vault=${encodeURIComponent(dv.app.vault.getName())}&query=${encodeURIComponent(`path:"${folder}"`)}`;
  a.dataset.searchFolder = folder;
  a.setAttribute("aria-label", `${label}，使用 Obsidian 原生搜索`);
  return a;
}
function values(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value.array === "function") return value.array();
  return [value];
}
function displayText(value) {
  return values(value).map(item => {
    if (typeof item === "string") return item.trim();
    if (typeof item === "number" && Number.isFinite(item)) return String(item);
    if (item && typeof item.path === "string") return item.display || item.path.replace(/.*\//, "").replace(/\.md$/i, "");
    return "";
  }).filter(Boolean).join("、");
}
function firstText(page, keys) {
  for (const key of keys) {
    const value = displayText(page[key]);
    if (value) return value;
  }
  return "";
}
function yearText(page) {
  for (const key of ["论文年份", "year", "发表年份"]) {
    const value = displayText(page[key]);
    if (/^[12]\d{3}$/.test(value)) return value;
    if (value) return "年份未记录";
  }
  return "年份未记录";
}
function modifiedMs(page) {
  const value = page?.file?.mtime?.toMillis?.();
  return Number.isFinite(value) ? value : -Infinity;
}
function recentFirst(a, b) {
  const left = modifiedMs(a), right = modifiedMs(b);
  if (left !== right) return left > right ? -1 : 1;
  return a.file.path < b.file.path ? -1 : a.file.path > b.file.path ? 1 : 0;
}
function indexed(folder) {
  return dv.pages(`"${folder}"`).array()
    .filter(page => inside(page?.file?.path, folder) && mdFile(page.file.path));
}
function excludedProject(path) {
  return path.split("/").some(part => part === "Templator" || part === "90_ObsidianDev" || part.startsWith("_tmp"));
}
function dateISO(value) {
  if (!value) return "";
  try {
    const date = dv.date(value);
    return date?.isValid ? date.toFormat("yyyy-MM-dd") : "";
  } catch { return ""; }
}
function panelHeader(panel, eyebrow, title, folder) {
  const header = el("header", "sjdev-research-workspace__panel-header", undefined, panel);
  const copy = el("div", "sjdev-research-workspace__header-copy", undefined, header);
  el("p", "sjdev-research-workspace__eyebrow", eyebrow, copy);
  el("h2", "sjdev-research-workspace__title", title, copy);
  searchLink(header, folder, "浏览全部 ↗");
  return header;
}
function noteRow(parent, page, isLiterature) {
  const row = el("li", "sjdev-research-workspace__note", undefined, parent);
  row.dataset.path = page.file.path;
  row.dataset.mtime = String(modifiedMs(page));
  const top = el("div", "sjdev-research-workspace__note-top", undefined, row);
  const heading = el("h3", "sjdev-research-workspace__note-title", undefined, top);
  safeLink(heading, page.file.path, page.file.name);
  const stamp = page.file.mtime;
  const time = el("time", "sjdev-research-workspace__time",
    Number.isFinite(modifiedMs(page)) && stamp?.isValid ? stamp.toFormat("MM-dd HH:mm") : "时间未知", top);
  if (stamp?.isValid) {
    time.dateTime = stamp.toISO();
    time.title = `最后修改 ${stamp.toFormat("yyyy-MM-dd HH:mm")}`;
  }
  if (isLiterature) {
    const author = firstText(page, ["论文作者", "authors", "author"]) || "作者未记录";
    const journal = firstText(page, ["论文期刊", "journal", "venue"]) || "期刊／来源未记录";
    el("p", "sjdev-research-workspace__author", author, row);
    const meta = el("p", "sjdev-research-workspace__meta", undefined, row);
    el("span", "sjdev-research-workspace__year", yearText(page), meta);
    el("span", "sjdev-research-workspace__journal", journal, meta);
  } else {
    const relative = page.file.folder.slice(projectFolder.length).replace(/^\//, "");
    el("p", "sjdev-research-workspace__meta", relative || "项目资料目录", row);
  }
}
function projectFolderRow(parent, folder, pages) {
  const row = el("li", "sjdev-research-workspace__note sjdev-research-workspace__folder", undefined, parent);
  row.dataset.folder = folder.path;
  const link = searchLink(row, folder.path + "/", folder.name);
  link.classList.add("sjdev-research-workspace__folder-link");
  link.setAttribute("aria-label", `查看项目文件夹：${folder.name}`);
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z");
  icon.appendChild(path);
  link.prepend(icon);
  link.addEventListener("click", event => {
    if (folderExists(folder.path)) return;
    event.preventDefault();
    notice("项目文件夹已移动或删除，请刷新工作台。", null, parent.parentElement);
  });
  const count = pages.filter(page => inside(page.file.path, folder.path)).length;
  const actions = el("div", "sjdev-research-workspace__folder-actions", undefined, row);
  el("span", "sjdev-research-workspace__folder-count", count ? `${count} 篇笔记` : folder.children.length ? "暂无笔记" : "空文件夹", actions);
  const create = el("button", "sjdev-research-workspace__create", "＋ 新建笔记", actions);
  create.type = "button";
  create.setAttribute("aria-label", `在${folder.name}中新建笔记`);
  create.addEventListener("click", () => newProjectNote(folder, create));
}
function newProjectNote(folder, trigger) {
  if (!dv.container.contains(root) || root.querySelector("dialog[open]")) return;
  if (!inside(folder.path, projectFolder) || !folderExists(folder.path)) {
    notice("项目文件夹已移动或删除，请刷新工作台。", null); return;
  }
  const dialog = el("dialog", "sjdev-research-workspace__dialog");
  dialog.setAttribute("aria-label", "新建项目笔记");
  el("h3", "sjdev-research-workspace__dialog-title", "新建项目笔记", dialog);
  el("p", "sjdev-research-workspace__destination", `保存到：${folder.path}`, dialog);
  const form = el("form", "sjdev-research-workspace__create-form", undefined, dialog);
  const label = el("label", "sjdev-research-workspace__filename-label", "笔记名称", form);
  const name = el("input", "sjdev-research-workspace__filename", undefined, label);
  name.type = "text";
  name.placeholder = "输入笔记名称，无需填写 .md";
  name.required = true;
  name.maxLength = 120;
  name.autocomplete = "off";
  const message = el("p", "sjdev-research-workspace__create-message", "", form);
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  const actions = el("div", "sjdev-research-workspace__dialog-actions", undefined, form);
  const cancel = el("button", "sjdev-research-workspace__cancel", "取消", actions);
  cancel.type = "button";
  const submit = el("button", "sjdev-research-workspace__submit mod-cta", "创建并打开", actions);
  submit.type = "submit";
  let busy = false;
  cancel.addEventListener("click", () => dialog.close());
  dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
  dialog.addEventListener("close", () => {
    dialog.remove();
    if (trigger.isConnected) trigger.focus();
  }, { once: true });
  name.addEventListener("input", () => { message.textContent = ""; });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (busy) return;
    const title = name.value.trim().replace(/\.md$/i, "");
    if (!title || title.length > 120 || /[<>:"/\\|?*\x00-\x1f\x7f]/.test(title) ||
        /[. ]$/.test(title) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(title)) {
      message.textContent = "请输入有效的文件名，不要包含路径、特殊字符或末尾的点。";
      name.focus(); return;
    }
    if (!dv.container.contains(root) || !inside(folder.path, projectFolder) || !folderExists(folder.path)) {
      message.textContent = "项目文件夹已移动或删除，请取消并刷新工作台。"; return;
    }
    const path = `${folder.path}/${title}.md`;
    if (dv.app.vault.getAbstractFileByPath(path)) {
      message.textContent = "同名笔记已存在，请换一个名称。";
      name.focus(); return;
    }
    busy = true;
    submit.disabled = cancel.disabled = name.disabled = true;
    message.textContent = "正在创建…";
    let file;
    try {
      file = await dv.app.vault.create(path, "");
    } catch {
      busy = false;
      submit.disabled = cancel.disabled = name.disabled = false;
      message.textContent = dv.app.vault.getAbstractFileByPath(path)
        ? "同名笔记已存在，请换一个名称。" : "笔记创建失败，请检查文件夹和文件名后重试。";
      return;
    }
    // Close before opening: a successful write must never be retried after an open failure.
    dialog.close();
    try {
      const leaf = dv.app.workspace.getLeaf("tab");
      await leaf.openFile(file, { state: { mode: "source" } });
    } catch {
      const text = `笔记已创建：${path}。暂时无法自动打开，请从文件列表打开。`;
      // Index refresh may have detached the old view while the file was being created.
      new (require("obsidian").Notice)(text, 10000);
    }
  });
  dialog.showModal();
  name.focus();
}

let projectFolder = "";
async function render() {
  if (typeof options !== "object" || Array.isArray(options)) {
    notice("组件参数应为对象。", "invalid"); return;
  }
  const literatureFolder = folderPath(options.literatureFolder ?? "01.文献阅读/01.文献笔记");
  const literatureTree = folderPath(options.literatureTree ?? "01.文献阅读");
  projectFolder = folderPath(options.projectFolder ?? "03.项目管理");
  const limit = options.limit ?? 5;
  const projectLimit = options.projectLimit ?? 20;
  const taskLimit = options.taskLimit ?? 4;
  if (![literatureFolder, literatureTree, projectFolder].every(Boolean)) {
    notice("请提供有效的库内文献与项目目录，不能使用父目录或绝对路径。", "invalid"); return;
  }
  if (![limit, projectLimit, taskLimit].every(value => Number.isInteger(value) && value >= 1 && value <= 20)) {
    notice("显示数量应为 1–20 的整数。", "invalid"); return;
  }
  if (!(literatureFolder === literatureTree || inside(literatureFolder, literatureTree))) {
    notice("literatureFolder 必须位于 literatureTree 内，以保持统计口径一致。", "invalid"); return;
  }
  root.dataset.literatureFolder = literatureFolder;
  root.dataset.literatureTree = literatureTree;
  root.dataset.projectFolder = projectFolder;
  const columns = el("div", "sjdev-research-workspace__columns");
  const literaturePanel = el("section", "sjdev-research-workspace__panel sjdev-research-workspace__literature", undefined, columns);
  const projectPanel = el("section", "sjdev-research-workspace__panel sjdev-research-workspace__projects", undefined, columns);
  panelHeader(literaturePanel, "阅读与思考", typeof options.literatureTitle === "string" ? options.literatureTitle : "文献工作区", literatureFolder);
  panelHeader(projectPanel, "课题与资料", typeof options.projectTitle === "string" ? options.projectTitle : "研究项目", projectFolder);
  const states = [];
  if (!folderExists(literatureFolder) || !folderExists(literatureTree)) {
    notice("文献来源目录不存在，请检查组件参数。", null, literaturePanel); states.push("missing");
  } else {
    const pages = indexed(literatureFolder);
    const treePages = literatureFolder === literatureTree ? pages : indexed(literatureTree);
    root.dataset.literatureCount = String(pages.length);
    root.dataset.literatureTreeCount = String(treePages.length);
    const stats = el("div", "sjdev-research-workspace__stats", undefined, literaturePanel);
    const main = el("div", "sjdev-research-workspace__stat", undefined, stats);
    el("strong", "sjdev-research-workspace__number", pages.length.toLocaleString("zh-CN"), main);
    el("span", "sjdev-research-workspace__stat-label", "文献目录笔记", main);
    const total = el("div", "sjdev-research-workspace__stat sjdev-research-workspace__stat-secondary", undefined, stats);
    el("strong", "sjdev-research-workspace__number", treePages.length.toLocaleString("zh-CN"), total);
    el("span", "sjdev-research-workspace__stat-label", "文献全树 Markdown", total);
    el("p", "sjdev-research-workspace__caption", "最近修改 · 不代表最近阅读或已读完成", literaturePanel);
    if (pages.length) {
      const list = el("ol", "sjdev-research-workspace__list", undefined, literaturePanel);
      const rows = pages.slice().sort(recentFirst).slice(0, limit);
      for (const page of rows) noteRow(list, page, true);
      root.dataset.literatureShown = String(rows.length);
      states.push("ready");
    } else { notice("该目录尚无 Markdown 笔记。", null, literaturePanel); states.push("empty"); }
    el("p", "sjdev-research-workspace__footnote", "按目录统计全部 Markdown（如目录中有索引也计入），不计 PDF；书目信息缺失保留为空态。", literaturePanel);
  }
  if (!folderExists(projectFolder)) {
    notice("项目资料目录不存在，请检查组件参数。", null, projectPanel); states.push("missing");
  } else {
    const allPages = indexed(projectFolder);
    const pages = allPages.filter(page => !excludedProject(page.file.path));
    root.dataset.projectCount = String(allPages.length);
    root.dataset.projectEligibleCount = String(pages.length);
    const folders = dv.app.vault.getAbstractFileByPath(projectFolder).children
      .filter(child => Array.isArray(child.children) && !excludedProject(child.path))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-CN", { numeric: true, sensitivity: "base" }));
    root.dataset.projectFolderCount = String(folders.length);
    el("p", "sjdev-research-workspace__project-summary", `${folders.length} 个项目文件夹`, projectPanel);
    el("p", "sjdev-research-workspace__caption", "点击项目名称查看资料 · ＋ 新建笔记", projectPanel);
    if (folders.length) {
      const list = el("ul", "sjdev-research-workspace__list sjdev-research-workspace__project-list", undefined, projectPanel);
      const rows = folders.slice(0, projectLimit);
      for (const folder of rows) projectFolderRow(list, folder, pages);
      root.dataset.projectShown = String(rows.length);
      states.push("ready");
    } else { notice("该目录暂无项目文件夹。", null, projectPanel); states.push("empty"); }
    const tasks = [];
    let unknownTaskStatuses = 0;
    for (const page of pages) {
      for (const task of values(page.file.tasks).filter(Boolean)) {
        if (task.completed === true) continue;
        if (task.status !== " ") { unknownTaskStatuses++; continue; }
        const text = typeof task.text === "string" ? task.text.trim() : "";
        const meaningful = text.replace(/#[\p{L}\p{N}_/-]+/gu, "").replace(/\[[^\]]*::[^\]]*\]/g, "").trim();
        if (!meaningful) continue;
        tasks.push({ text, path: page.file.path, name: page.file.name, line: task.line,
          due: dateISO(task.due), scheduled: dateISO(task.scheduled) });
      }
    }
    tasks.sort((a, b) => {
      const left = a.due || a.scheduled || "9999-12-31", right = b.due || b.scheduled || "9999-12-31";
      return left < right ? -1 : left > right ? 1 : a.path < b.path ? -1 : a.path > b.path ? 1 : (a.line ?? 0) - (b.line ?? 0);
    });
    root.dataset.researchTaskCount = String(tasks.length);
    el("h3", "sjdev-research-workspace__task-title", "研究任务", projectPanel);
    if (!tasks.length) {
      notice("项目资料中尚无已识别的实质待办；进度与截止日期未推断。", null, projectPanel);
    } else {
      const list = el("ul", "sjdev-research-workspace__tasks", undefined, projectPanel);
      for (const task of tasks.slice(0, taskLimit)) {
        const row = el("li", "sjdev-research-workspace__task", undefined, list);
        row.dataset.path = task.path;
        el("p", "sjdev-research-workspace__task-text", task.text, row);
        const meta = el("div", "sjdev-research-workspace__task-meta", undefined, row);
        safeLink(meta, task.path, task.name);
        if (task.due) el("span", "sjdev-research-workspace__task-date", `截止 ${task.due}`, meta);
        if (task.scheduled) el("span", "sjdev-research-workspace__task-date", `计划 ${task.scheduled}`, meta);
      }
    }
    let scope = "只读展示，不提供任务完成按钮。";
    if (allPages.length !== pages.length) scope += ` 笔记计数与研究任务排除 ${allPages.length - pages.length} 篇临时提取文件。`;
    if (unknownTaskStatuses) scope += ` ${unknownTaskStatuses} 条自定义任务状态未作完成推断。`;
    el("p", "sjdev-research-workspace__footnote", scope, projectPanel);
  }
  root.dataset.sjdevStatus = states.every(state => state === "missing") ? "missing"
    : states.includes("missing") ? "partial" : states.every(state => state === "empty") ? "empty" : "ready";
}
try {
  await render();
} catch {
  root.replaceChildren();
  notice("研究工作区暂时加载失败，请检查 Dataview 索引与参数。", "error");
  // Never log page objects, private task text or account configuration.
}
