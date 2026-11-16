// sjdev music-launcher · local controls; official network frame only after an explicit click.
const options = input ?? {};
const isConfigured = options.playlists !== undefined;
// An obsolete async render must not fall back into a replacement container.
if (options.mount !== undefined && !(options.mount instanceof dv.container.ownerDocument.defaultView.HTMLElement && dv.container.contains(options.mount))) return;
const document = dv.container.ownerDocument;
const mount = options.mount instanceof document.defaultView.HTMLElement &&
  dv.container.contains(options.mount) ? options.mount : dv.container;
const root = document.createElement("section");
root.className = "sjdev-music-launcher";
root.dataset.sjdevStatus = "loading";
root.dataset.playerState = "closed";
root.setAttribute("aria-label", isConfigured ? "网易云音乐歌单播放器" : "网易云音乐公共测试入口");
mount.appendChild(root);

function el(tag, cls, text, parent = root) {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  parent.appendChild(node);
  return node;
}

function closePlayers() {
  // Explicit page-wide exclusivity is limited to this component's own frames.
  // Removing an iframe destroys its child browsing context and its media.
  for (const frame of document.querySelectorAll("iframe.sjdev-music-launcher__player")) {
    const owner = frame.closest(".sjdev-music-launcher");
    frame.remove();
    if (!owner) continue;
    owner.dataset.playerState = "closed";
    const status = owner.querySelector(".sjdev-music-launcher__status");
    if (status) status.textContent = "播放器已关闭。官方打开入口始终可用。";
    const close = owner.querySelector('[data-action="close"]');
    if (close) close.disabled = true;
  }
}

try {
  const defaults = [
    { name: "云音乐热歌榜", playlistId: "3778678" },
    { name: "云音乐飙升榜", playlistId: "19723756" }
  ];
  const raw = options.playlists === undefined ? defaults : options.playlists;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 12) throw new Error("playlist-config");
  const playlists = raw.map(p => {
    if (!p || typeof p.name !== "string" || !p.name.trim() || p.name.length > 80 ||
        !/^[1-9]\d{0,17}$/.test(String(p.playlistId ?? ""))) throw new Error("playlist-config");
    return { name: p.name.trim(), playlistId: String(p.playlistId) };
  });
  if (new Set(playlists.map(p => p.playlistId)).size !== playlists.length) throw new Error("playlist-config");
  el("p", "sjdev-music-launcher__eyebrow", "音乐 / 网易云");
  el("h2", "sjdev-music-launcher__title", "给思绪留一点声音");
  el("p", "sjdev-music-launcher__badge", isConfigured ? `已配置 · ${playlists.length} 个歌单` : "公共测试歌单 · 非个人收藏");
  const label = el("label", "sjdev-music-launcher__label", isConfigured ? "常听歌单" : "选择公开歌单");
  const select = el("select", "sjdev-music-launcher__select", undefined, label);
  select.dataset.action = "playlist";
  for (const playlist of playlists) {
    const option = el("option", "", playlist.name, select);
    option.value = playlist.playlistId;
    option.title = playlist.name;
  }
  const actions = el("div", "sjdev-music-launcher__actions");
  const official = el("a", "sjdev-music-launcher__official", "在网易云打开 ↗", actions);
  official.target = "_blank";
  official.rel = "noopener noreferrer";
  official.dataset.action = "official";
  const load = el("button", "sjdev-music-launcher__button", "加载官方播放器", actions);
  load.type = "button";
  load.dataset.action = "load";
  const close = el("button", "sjdev-music-launcher__button sjdev-music-launcher__button--quiet", "关闭播放器", actions);
  close.type = "button";
  close.dataset.action = "close";
  close.disabled = true;
  el("p", "sjdev-music-launcher__notice", isConfigured ? "外链播放器可能只显示部分歌曲。查看完整歌单，请点“在网易云打开”；播放权限以平台为准。" : "点击加载后才连接网易云及其内容服务。官方页面可能使用自身会话；本组件不读取或保存凭证。不自动播放。版权、会员、地区或登录限制请以平台为准。");
  const status = el("p", "sjdev-music-launcher__status", isConfigured ? "歌单已就绪，播放器按需加载。" : "尚未联网加载播放器。收藏、最近播放与客户端状态未接入。");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const slot = el("div", "sjdev-music-launcher__slot");

  function setSelection() {
    official.href = `https://music.163.com/#/playlist?id=${select.value}`;
    root.dataset.playlistId = select.value;
    select.title = playlists.find(p => p.playlistId === select.value).name;
  }
  setSelection();
  select.addEventListener("change", () => {
    const own = slot.querySelector("iframe");
    if (own) own.remove();
    root.dataset.playerState = "closed";
    close.disabled = true;
    setSelection();
    status.textContent = "已切换歌单，旧播放器已移除；点击加载后才连接新歌单。";
  });
  load.addEventListener("click", () => {
    if (!root.isConnected) return;
    const current = slot.querySelector("iframe");
    if (current && current.dataset.playlistId === select.value) {
      status.textContent = "此歌单的官方播放器已打开。播放与曲目信息请查看播放器。";
      return;
    }
    closePlayers();
    const frame = document.createElement("iframe");
    frame.className = "sjdev-music-launcher__player";
    frame.title = `网易云官方播放器 · ${playlists.find(p => p.playlistId === select.value).name}${isConfigured ? "" : " · 公共测试"}`;
    frame.dataset.playlistId = select.value;
    frame.referrerPolicy = "no-referrer";
    // No autoplay permission. A sandbox confines platform scripts to their own origin.
    frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox");
    frame.src = `https://music.163.com/outchain/player?type=0&id=${select.value}&auto=0&height=430`;
    frame.addEventListener("load", () => {
      if (!frame.isConnected) return;
      status.textContent = isConfigured ? "已打开官方播放器页面。若无法播放，请使用“在网易云打开”。" : "已请求官方页面；载入事件不代表歌曲可播。若空白、受限或要求登录，请关闭并使用官方打开入口。";
      root.dataset.playerState = "requested";
    });
    slot.appendChild(frame);
    root.dataset.playerState = "requested";
    close.disabled = false;
    status.textContent = isConfigured ? "正在加载官方播放器，请手动开始播放。" : "正在请求官方播放器。由你在播放器内手动开始播放；当前曲目、进度及声音状态未被本组件读取。";
  });
  close.addEventListener("click", () => {
    const frame = slot.querySelector("iframe");
    if (frame) frame.remove();
    close.disabled = true;
    root.dataset.playerState = "closed";
    status.textContent = "播放器已关闭。官方打开入口始终可用。";
  });
  root.dataset.sjdevStatus = "ready";
} catch (_) {
  root.dataset.sjdevStatus = "error";
  el("p", "sjdev-music-launcher__notice", "歌单配置无效：请提供1–12个不重复的公开歌单ID及名称。未发起网络请求。");
}
