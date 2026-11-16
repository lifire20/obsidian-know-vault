// Timer stays on this device; completed focus rounds can be saved to the life log.
const options = input ?? {};
const doc = dv.container.ownerDocument;
const win = doc.defaultView;
if (options.mount !== undefined && !(options.mount instanceof win.HTMLElement && dv.container.contains(options.mount))) return;
const mount = options.mount ?? dv.container;
const root = doc.createElement("section");
root.className = "sjdev-pomodoro";
root.dataset.sjdevStatus = "loading";
root.setAttribute("aria-label", "番茄钟");
mount.appendChild(root);

function el(tag, cls, text, parent = root) {
  const node = doc.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node);
  return node;
}

try {
  const modes = { focus: { label: "专注", minutes: 25 }, short: { label: "短休息", minutes: 5 }, long: { label: "长休息", minutes: 15 } };
  const lifeStore = options.store;
  const vaultIdentity = typeof dv.app.vault.adapter.getBasePath === "function" ? dv.app.vault.adapter.getBasePath() : dv.app.vault.getName();
  const key = `sjdev:pomodoro:v1:${vaultIdentity}${lifeStore?.base.startsWith("90_ObsidianDev/") ? ":prototype" : ""}`;
  const eventName = "sjdev-pomodoro-state";
  const memory = win.__sjdevPomodoroMemory ??= new Map();
  const day = (millis = Date.now()) => dv.luxon.DateTime.fromMillis(millis, { zone: "Asia/Shanghai" }).toISODate();
  const fresh = () => ({ version: 1, mode: "focus", remainingMs: 25*60000, endAt: null, status: "idle", day: day(), completed: 0, sessionId: null, pending: [] });
  const flushLocks = win.__sjdevPomodoroFlushLocks ??= new Set();
  let storageAvailable = true;
  let stopped = false;
  let timer;
  let observer;
  let state;
  let recordMessage = "";

  function valid(s) {
    return s?.version === 1 && Object.hasOwn(modes, s.mode) && ["idle","running","paused","complete"].includes(s.status)
      && Number.isFinite(s.remainingMs) && s.remainingMs >= 0 && s.remainingMs <= modes[s.mode].minutes*60000
      && (s.endAt === null || Number.isFinite(s.endAt)) && (s.status !== "running" || s.endAt !== null)
      && typeof s.day === "string" && Number.isSafeInteger(s.completed) && s.completed >= 0;
  }
  function load() {
    let candidate;
    try { const raw = win.localStorage.getItem(key); candidate = raw ? JSON.parse(raw) : undefined; }
    catch { storageAvailable = false; }
    const cached = memory.get(key);
    const current = !storageAvailable && valid(cached) ? { ...cached } : valid(candidate) ? candidate : valid(cached) ? { ...cached } : fresh();
    // Preserve older local timers without inventing past focus records.
    return { ...current, sessionId: typeof current.sessionId === "string" ? current.sessionId : null,
      pending: Array.isArray(current.pending) ? current.pending.filter(p => typeof p.id === "string" && Number.isFinite(p.endedAt) && p.minutes === 25) : [] };
  }
  function save(next, broadcast = true) {
    memory.set(key, { ...next });
    try { win.localStorage.setItem(key, JSON.stringify(next)); }
    catch { storageAvailable = false; }
    state = next;
    if (broadcast) win.dispatchEvent(new win.CustomEvent(eventName, { detail: { key } }));
  }
  function settle(s) {
    let changed = false;
    if (s.day !== day()) { s = { ...s, day: day(), completed: 0 }; changed = true; }
    if (s.status === "running" && s.endAt <= Date.now()) {
      const completedToday = s.mode === "focus" && day(s.endAt) === day();
      const pending = [...s.pending];
      if (lifeStore && s.mode === "focus" && s.sessionId && !pending.some(p => p.id === s.sessionId)) pending.push({ id: s.sessionId, minutes: 25, endedAt: s.endAt });
      s = { ...s, remainingMs: 0, endAt: null, status: "complete", completed: s.completed + (completedToday ? 1 : 0), pending, sessionId: null };
      changed = true;
    }
    if (changed) save(s, false);
    return s;
  }
  async function flushCompleted() {
    if (!lifeStore || flushLocks.has(key) || !load().pending.length) return;
    flushLocks.add(key);
    try {
      for (const entry of load().pending) {
        const date = day(entry.endedAt);
        await lifeStore.updateDay(date, draft => {
          if (!draft.focus.some(item => item.id === entry.id)) draft.focus.push({
            id: entry.id, minutes: entry.minutes, label: "番茄钟专注", source: "pomodoro",
            endedAt: dv.luxon.DateTime.fromMillis(entry.endedAt, { zone: "Asia/Shanghai" }).toISO()
          });
        });
        const current = load();
        save({ ...current, pending: current.pending.filter(item => item.id !== entry.id) }, false);
      }
      recordMessage = "完整专注轮次已保存";
    } catch (_) {
      recordMessage = "专注记录待保存，点击重试";
      // Keep the outbox until a successful write. Do not retry failed disk writes on every tick.
      retryAt = Date.now() + 60000;
    } finally {
      flushLocks.delete(key);
      if (!stopped) render();
    }
  }
  let retryAt = 0;

  const head = el("header", "sjdev-pomodoro__header");
  const heading = el("div", "sjdev-pomodoro__heading", undefined, head);
  el("p", "sjdev-pomodoro__eyebrow", "FOCUS & PAUSE", heading);
  el("h2", "sjdev-pomodoro__title", "番茄钟", heading);
  el("span", "sjdev-pomodoro__star", "✦", head).setAttribute("aria-hidden", "true");
  const modeGroup = el("div", "sjdev-pomodoro__modes");
  modeGroup.setAttribute("role", "group");
  modeGroup.setAttribute("aria-label", "计时模式");
  const modeButtons = Object.entries(modes).map(([id, mode]) => {
    const button = el("button", "sjdev-pomodoro__mode", mode.label, modeGroup);
    button.type = "button";
    button.dataset.mode = id;
    button.addEventListener("click", () => {
      const current = settle(load());
      if (current.status === "running" || current.mode === id) return;
      save({ ...current, mode: id, remainingMs: mode.minutes*60000, endAt: null, status: "idle" });
      render();
    });
    return button;
  });
  const dial = el("div", "sjdev-pomodoro__dial");
  const time = el("div", "sjdev-pomodoro__time", "25:00", dial);
  time.setAttribute("role", "timer");
  time.setAttribute("aria-live", "off");
  const detail = el("span", "sjdev-pomodoro__detail", "25 分钟，专心做一件事。", dial);
  const actions = el("div", "sjdev-pomodoro__actions");
  const start = el("button", "sjdev-pomodoro__start", "开始专注", actions);
  start.type = "button";
  start.dataset.action = "start-pause";
  const reset = el("button", "sjdev-pomodoro__reset", "重置", actions);
  reset.type = "button";
  reset.dataset.action = "reset";
  const status = el("p", "sjdev-pomodoro__status");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const footer = el("div", "sjdev-pomodoro__footer");
  const count = el("span", "sjdev-pomodoro__count", "今日专注 0 轮", footer);
  const persistence = el("span", "sjdev-pomodoro__persistence", "本机保留计时进度", footer);
  const retry = el("button", "sjdev-pomodoro__reset", "重试保存", footer);
  retry.type = "button";
  retry.dataset.action = "retry-record";
  retry.hidden = true;
  retry.addEventListener("click", () => { retryAt = 0; void flushCompleted(); });

  function text(node, value) { if (node.textContent !== value) node.textContent = value; }
  function render() {
    state = settle(load());
    const remaining = state.status === "running" ? Math.max(0, state.endAt - Date.now()) : state.remainingMs;
    const seconds = Math.ceil(remaining / 1000);
    const label = `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
    text(time, label);
    time.setAttribute("aria-label", `${modes[state.mode].label}剩余 ${Math.floor(seconds/60)} 分 ${seconds%60} 秒`);
    root.dataset.mode = state.mode;
    root.dataset.timerStatus = state.status;
    root.dataset.remainingMs = String(Math.round(remaining));
    root.style.setProperty("--sjdev-pomodoro-progress", `${Math.min(100, Math.max(0, (1-remaining/(modes[state.mode].minutes*60000))*100))}%`);
    for (const button of modeButtons) {
      button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
      button.disabled = state.status === "running";
      button.title = state.status === "running" ? "暂停后可切换模式" : "";
    }
    text(detail, state.mode === "focus" ? "25 分钟，专心做一件事。" : `${modes[state.mode].minutes} 分钟，让大脑歇一歇。`);
    text(start, state.status === "running" ? "暂停" : state.status === "paused" ? "继续" : state.status === "complete" ? "再来一轮" : state.mode === "focus" ? "开始专注" : "开始休息");
    text(status, state.status === "complete" ? state.mode === "focus" ? "本轮专注完成，休息一下吧。✦" : "休息结束，准备好再出发。" : state.status === "running" ? state.mode === "focus" ? "今天的研究，也在稳稳推进。" : "放松肩颈，看看远处。" : state.status === "paused" ? "已暂停，准备好再继续。" : "从一个小目标开始。计时结束后手动开启下一轮。");
    text(count, `今日专注 ${state.completed} 轮`);
    text(persistence, !storageAvailable ? "暂时无法保存，仅本次窗口保留" : recordMessage || (lifeStore ? "完成一轮自动记录 25 分钟" : "本机保留计时进度"));
    persistence.dataset.saved = String(storageAvailable);
    retry.hidden = !state.pending.length || !recordMessage.includes("待保存");
    if (lifeStore && state.pending.length && Date.now() >= retryAt) void flushCompleted();
  }
  start.addEventListener("click", () => {
    let current = settle(load());
    if (current.status === "running") current = { ...current, remainingMs: Math.max(0, current.endAt-Date.now()), endAt: null, status: "paused" };
    else {
      const remainingMs = current.status === "complete" ? modes[current.mode].minutes*60000 : current.remainingMs;
      const sessionId = current.mode === "focus" ? current.status === "paused" && current.sessionId ? current.sessionId : win.crypto.randomUUID() : null;
      current = { ...current, remainingMs, endAt: Date.now()+remainingMs, status: "running", sessionId };
    }
    save(current);
    render();
  });
  reset.addEventListener("click", () => {
    const current = settle(load());
    save({ ...current, remainingMs: modes[current.mode].minutes*60000, endAt: null, status: "idle", sessionId: null });
    render();
  });
  const sync = event => { if (!stopped && (event.type === "storage" ? event.key === key : event.detail?.key === key)) render(); };
  const visible = () => { if (!stopped && !doc.hidden) render(); };
  function cleanup() {
    if (stopped) return;
    stopped = true;
    win.clearInterval(timer);
    observer?.disconnect();
    win.removeEventListener("storage", sync);
    win.removeEventListener(eventName, sync);
    doc.removeEventListener("visibilitychange", visible);
  }
  win.addEventListener("storage", sync);
  win.addEventListener(eventName, sync);
  doc.addEventListener("visibilitychange", visible);
  render();
  // Reading view can detach an intact Dataview section while it is offscreen.
  // Its container still owns this root; only replacement or component unload disposes it.
  timer = win.setInterval(() => { if (!dv.container.contains(root)) cleanup(); else render(); }, 500);
  observer = new win.MutationObserver(() => { if (!dv.container.contains(root)) cleanup(); });
  observer.observe(dv.container, { childList: true, subtree: true });
  if (dv.component?.register) dv.component.register(cleanup);
  root.dataset.sjdevStatus = "ready";
} catch (error) {
  root.dataset.sjdevStatus = "error";
  el("p", "sjdev-pomodoro__error", "番茄钟暂未加载，请刷新后重试。");
  console.error("sjdev-pomodoro:", error?.name ?? "Error");
}
