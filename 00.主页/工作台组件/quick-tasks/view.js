// Writes are restricted to the dedicated prototype or published-home task list.
const options = input ?? {};
const doc = dv.container.ownerDocument;
const win = doc.defaultView;
if (options.mount !== undefined && !(options.mount instanceof win.HTMLElement && dv.container.contains(options.mount))) return;
const mount = options.mount ?? dv.container;
const app = dv.app;
const path = options.path ?? "90_ObsidianDev/tests/主页待办.md";
const root = doc.createElement("section");
root.className = "sjdev-quick-tasks";
root.dataset.sjdevStatus = "loading";
root.dataset.source = path;
root.setAttribute("aria-label", "主页待办");
mount.appendChild(root);
if (!["90_ObsidianDev/tests/主页待办.md", "00.主页/主页待办.md"].includes(path)) {
  root.dataset.sjdevStatus = "error";
  const message = doc.createElement("p");
  message.className = "sjdev-quick-tasks__message";
  message.dataset.error = "true";
  message.textContent = "待办清单路径无效，请检查主页配置。";
  root.appendChild(message);
  return;
}
const storesKey = Symbol.for("sjdev.quickTasks.stores");
const stores = app[storesKey] ?? (app[storesKey] = new Map());
const store = stores.get(path) ?? { draft: "", filter: "pending", busy: false, message: "", error: false, tasks: [], callbacks: new Set(), sequence: 0, inputActive: false, selection: 0, focusUntil: 0 };
stores.set(path, store);
let disposed = false;
let readSequence = 0;
const refs = [];
const punctuation = /[\\`*_[\]{}()#+\-.!<>|~]/g;
const taskPattern = /^- \[([ xX])\] (.*?) <!-- sjdev-task:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}) -->[ \t\r]*$/gmi;

function el(tag, cls, text, parent = root) {
  const node = doc.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node);
  return node;
}
function parse(content) {
  const tasks = [];
  const seen = new Set();
  for (const match of content.matchAll(taskPattern)) {
    const id = match[3].toLowerCase();
    if (seen.has(id)) throw new Error("duplicate task IDs");
    seen.add(id);
    tasks.push({ id, done: match[1] !== " ", text: match[2].replace(/\\([\\`*_[\]{}()#+\-.!<>|~])/g, "$1") });
  }
  return tasks;
}
function notify() {
  for (const callback of [...store.callbacks]) callback();
}
function cleanText(value) {
  return value.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim();
}
async function read() {
  const sequence = ++readSequence;
  const writeSequence = store.sequence;
  try {
    const file = app.vault.getFileByPath(path);
    const content = file ? await app.vault.read(file) : "";
    if (disposed || sequence !== readSequence || writeSequence !== store.sequence) return;
    store.tasks = parse(content);
    if (store.readError) { store.error = false; store.message = ""; }
    store.readError = false;
    render();
  } catch (error) {
    if (disposed || sequence !== readSequence || writeSequence !== store.sequence) return;
    store.error = true;
    store.readError = true;
    store.message = "暂时无法读取待办，请打开清单检查后重试。";
    render();
  }
}
async function write(transform) {
  let file = app.vault.getFileByPath(path);
  if (!file) {
    // Creating the note is deferred until the first actual add. A competing
    // window may create it first; in that case process its latest contents.
    const initial = "# 主页待办\n\n从主页添加的待办保存在这里，也可以直接编辑任务文字与勾选状态。编辑时请保留每行末尾的任务标记。\n\n";
    const candidate = transform(initial);
    try {
      file = await app.vault.create(path, candidate);
      store.tasks = parse(candidate);
      store.readError = false;
      return;
    } catch (error) {
      file = app.vault.getFileByPath(path);
      if (!file) throw error;
    }
  }
  let result;
  await app.vault.process(file, content => {
    result = transform(content);
    return result;
  });
  store.tasks = parse(result);
  store.readError = false;
}
async function act(transform, success, after) {
  if (store.busy) return;
  store.busy = true;
  store.sequence++;
  store.error = false;
  store.message = "正在保存…";
  notify();
  try {
    await write(transform);
    after?.();
    store.message = success;
  } catch (error) {
    store.error = true;
    store.message = "保存失败，内容已保留。请检查清单文件后重试。";
    console.error("sjdev-quick-tasks: save failed", error?.name ?? "Error");
  } finally {
    store.busy = false;
    if (store.inputActive) store.focusUntil = Date.now() + 10000;
    notify();
  }
}

const header = el("header", "sjdev-quick-tasks__header");
const heading = el("div", "sjdev-quick-tasks__heading", undefined, header);
el("p", "sjdev-quick-tasks__eyebrow", "QUICK CAPTURE · 随手记", heading);
el("h2", "sjdev-quick-tasks__title", "主页待办", heading);
const count = el("span", "sjdev-quick-tasks__count", "", header);
const form = el("form", "sjdev-quick-tasks__form");
const inputBox = el("input", "sjdev-quick-tasks__input", undefined, form);
inputBox.type = "text";
inputBox.maxLength = 240;
inputBox.placeholder = "写下一件想推进的事…";
inputBox.setAttribute("aria-label", "新增待办，最多 240 字");
inputBox.autocomplete = "off";
const add = el("button", "sjdev-quick-tasks__add", "+ 添加", form);
add.type = "submit";
const filters = el("div", "sjdev-quick-tasks__filters");
filters.setAttribute("aria-label", "筛选待办");
const filterButtons = new Map();
for (const [value, label] of [["pending", "待办"], ["done", "已完成"]]) {
  const button = el("button", "sjdev-quick-tasks__filter", label, filters);
  button.type = "button";
  button.dataset.filter = value;
  button.addEventListener("click", () => { store.filter = value; notify(); });
  filterButtons.set(value, button);
}
const body = el("div", "sjdev-quick-tasks__body");
const message = el("p", "sjdev-quick-tasks__message");
message.setAttribute("role", "status");
message.setAttribute("aria-live", "polite");
const footer = el("footer", "sjdev-quick-tasks__footer");
el("span", "sjdev-quick-tasks__hint", "Enter 添加 · 自动保存到清单", footer);
const source = el("button", "sjdev-quick-tasks__source", "打开清单 ↗", footer);
source.type = "button";
source.addEventListener("click", async () => {
  const file = app.vault.getFileByPath(path);
  if (!file) { store.message = "添加第一件待办后，就会创建清单。"; store.error = false; notify(); return; }
  try { await app.workspace.getLeaf(false).openFile(file); }
  catch { store.error = true; store.message = "暂时无法打开清单，请重试。"; notify(); }
});

inputBox.addEventListener("input", () => { store.draft = inputBox.value; store.selection = inputBox.selectionStart ?? inputBox.value.length; store.focusUntil = Date.now() + 10000; });
inputBox.addEventListener("focus", () => { store.inputActive = true; store.focusUntil = Date.now() + 10000; });
inputBox.addEventListener("blur", () => { if (root.isConnected && !store.busy) store.inputActive = false; });
inputBox.addEventListener("keyup", () => { store.selection = inputBox.selectionStart ?? inputBox.value.length; store.focusUntil = Date.now() + 10000; });
form.addEventListener("submit", event => {
  event.preventDefault();
  if (store.busy) return;
  const text = cleanText(inputBox.value);
  if (!text) { store.message = "先写下一件小事吧。"; store.error = false; notify(); inputBox.focus(); return; }
  if (text.length > 240) { store.message = "这件事有点长，请控制在 240 字以内。"; store.error = true; notify(); return; }
  const id = win.crypto.randomUUID();
  const line = `- [ ] ${text.replace(punctuation, "\\$&")} <!-- sjdev-task:${id} -->`;
  store.inputActive = true;
  store.focusUntil = Date.now() + 10000;
  void act(content => {
    // An action carries a stable ID, making retries idempotent.
    if (parse(content).some(task => task.id === id)) return content;
    return content + (content.endsWith("\n") ? "" : "\n") + line + "\n";
  }, "已添加，慢慢推进就好。", () => { store.draft = ""; store.selection = 0; store.filter = "pending"; });
});

function render() {
  if (disposed) return;
  const pending = store.tasks.filter(task => !task.done);
  const completed = store.tasks.length - pending.length;
  root.dataset.sjdevStatus = store.readError ? "error" : "ready";
  root.dataset.pending = String(pending.length);
  root.dataset.completed = String(completed);
  root.dataset.busy = String(store.busy);
  count.textContent = `${pending.length} 件待办`;
  if (inputBox.value !== store.draft) inputBox.value = store.draft;
  inputBox.disabled = store.busy;
  add.disabled = store.busy;
  for (const [value, button] of filterButtons) {
    button.setAttribute("aria-pressed", String(store.filter === value));
    button.textContent = `${value === "pending" ? "待办" : "已完成"} ${value === "pending" ? pending.length : completed}`;
  }
  body.replaceChildren();
  const visible = store.tasks.filter(task => task.done === (store.filter === "done"));
  if (!visible.length) {
    const empty = el("div", "sjdev-quick-tasks__empty", undefined, body);
    el("span", "sjdev-quick-tasks__spark", "✧", empty).setAttribute("aria-hidden", "true");
    el("p", "sjdev-quick-tasks__empty-title", store.filter === "done" ? "完成的每一小步，都会留在这里。" : completed ? "任务清空，状态不错。" : "给今天留一件小事。", empty);
    el("p", "sjdev-quick-tasks__empty-hint", store.filter === "done" ? "勾选一件待办，就能看到自己的积累。" : "读一节文献，或记下一个新想法。", empty);
  } else {
    const list = el("ul", "sjdev-quick-tasks__list", undefined, body);
    for (const task of visible) {
      const item = el("li", "sjdev-quick-tasks__item", undefined, list);
      item.dataset.taskId = task.id;
      item.dataset.done = String(task.done);
      const label = el("label", "sjdev-quick-tasks__task", undefined, item);
      const checkbox = el("input", "sjdev-quick-tasks__check", undefined, label);
      checkbox.type = "checkbox";
      checkbox.checked = task.done;
      checkbox.disabled = store.busy;
      checkbox.setAttribute("aria-label", `${task.done ? "恢复待办" : "完成待办"}：${task.text}`);
      el("span", "sjdev-quick-tasks__text", task.text, label);
      checkbox.addEventListener("change", () => {
        const done = checkbox.checked;
        store.inputActive = false;
        void act(content => {
          const matches = [...content.matchAll(taskPattern)].filter(match => match[3].toLowerCase() === task.id);
          if (matches.length !== 1) throw new Error("task missing or duplicated");
          const match = matches[0];
          return content.slice(0, match.index) + match[0].replace(/^- \[[ xX]\]/, done ? "- [x]" : "- [ ]") + content.slice(match.index + match[0].length);
        }, done ? "已完成，可以在“已完成”中恢复。" : "已恢复到待办。" );
      });
    }
  }
  message.textContent = store.message;
  message.dataset.error = String(store.error);
  if (root.isConnected && store.inputActive && Date.now() < store.focusUntil && !store.busy && (!doc.activeElement || doc.activeElement === doc.body || doc.activeElement === inputBox)) {
    inputBox.focus({ preventScroll: true });
    inputBox.setSelectionRange(Math.min(store.selection, inputBox.value.length), Math.min(store.selection, inputBox.value.length));
  }
}

store.callbacks.add(render);
for (const eventName of ["create", "modify", "delete"]) refs.push(app.vault.on(eventName, file => { if (file.path === path) void read(); }));
refs.push(app.vault.on("rename", (file, oldPath) => { if (file.path === path || oldPath === path) void read(); }));
const observer = new win.MutationObserver(() => {
  if (!dv.container.contains(root)) cleanup();
});
observer.observe(dv.container, { childList: true, subtree: true });
function cleanup() {
  if (disposed) return;
  disposed = true;
  store.callbacks.delete(render);
  for (const ref of refs) app.vault.offref(ref);
  observer.disconnect();
}
if (dv.component?.register) dv.component.register(cleanup);
render();
await read();
