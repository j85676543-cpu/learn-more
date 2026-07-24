(function () {
  "use strict";

  const RADIO_GROUP_NAME = "selectedGame";
  const CUSTOM_GAME_ID = "profile";

  // welcome.html / todos.html / wordsearch.html live in a separate repo
  // hosted on GitHub Pages instead of being bundled into this extension's
  // package. That's deliberate: bundled files only update for users once a
  // new extension version is built AND approved by the Chrome Web Store
  // (which can take hours to days, and then only rolls out gradually via
  // Chrome's auto-update). Pages hosted here update the moment you push to
  // the repo's default branch — instantly live for everyone, no store
  // review, no version bump.
  //
  // Setup (one-time):
  //   1. Create a public GitHub repo (or reuse an existing one) and add
  //      welcome.html, todos.html, wordsearch.html (and wordsearch.js) to
  //      its root, or to a /docs folder.
  //   2. Repo Settings → Pages → set the source to that branch/folder.
  //   3. GitHub gives you a URL like https://<user>.github.io/<repo> —
  //      paste it below (no trailing slash).
  //   4. From then on: edit a file, commit, push — it's live in ~a minute.
  const OVERLAY_PLUS_DOCS_URL = "https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPO-NAME";

  const DEFAULT_AVATAR =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
      '<circle cx="32" cy="32" r="32" fill="#5b6b7c"/>' +
      '<circle cx="32" cy="24" r="12" fill="#cfd8e0"/>' +
      '<path d="M8 58c3-14 15-22 24-22s21 8 24 22" fill="#cfd8e0"/>' +
      "</svg>"
    );

  const DEFAULT_BANNER =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100">' +
      '<rect width="400" height="100" fill="#2d3748"/>' +
      '<circle cx="200" cy="50" r="30" fill="#4a90e2" opacity="0.3"/>' +
      '<circle cx="150" cy="30" r="20" fill="#4a90e2" opacity="0.2"/>' +
      '<circle cx="250" cy="70" r="25" fill="#4a90e2" opacity="0.2"/>' +
      "</svg>"
    );

  const STATUS_OPTIONS = [
    { value: "online", label: "Online", color: "#43b581" },
    { value: "idle", label: "Idle", color: "#faa61a" },
    { value: "dnd", label: "DND", color: "#f04747" },
  ];

  const ROLE_DEFINITIONS = [
    { id: "systembot", label: "SystemBot", color: "#e91e8c" },
    { id: "mio", label: "Mio", color: "#ff8fc7" },
    { id: "developer", label: "Developer", color: "#a970ff" },
    { id: "administrator", label: "Administrator", color: "#f04747" },
    { id: "moderator", label: "Moderator", color: "#4a90e2" },
    { id: "trusted", label: "Trusted", color: "#43b581" },
    { id: "user", label: "User", color: "#8b93a7" },
  ];

  const SYSTEM_BOT_ID = "system_bot_mio";
  const SYSTEM_BOT_PROFILE = {
    id: SYSTEM_BOT_ID,
    name: "Mio",
    description: "MioBot\nOwner: root\nDiscord: @rooticles",
    roles: ["systembot", "mio"],
    status: "dnd",
    avatarUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRoNfYfJHNMqDlF_RHRqw5x4xjRethKYP4cbwy8PpK3lw&s=10",
    bannerUrl: "https://c4.wallpaperflare.com/wallpaper/796/165/116/anime-girls-k-on-akiyama-mio-don-t-say-lazy-wallpaper-thumb.jpg",
    banned: false
  };

  const NAME_MAX_LENGTH = 20;
  const DESCRIPTION_MAX_LENGTH = 100;
  const PANEL_NAME_PREVIEW_LENGTH = 15;
  const PANEL_DESCRIPTION_PREVIEW_LENGTH = 20;

  const STORAGE_KEY = "jklm_ext_profile_data";
  const FRIENDS_STORAGE_KEY = "jklm_ext_friends_list";
  const BLOCKED_STORAGE_KEY = "jklm_ext_blocked_list";
  const FRIEND_REQUESTS_STORAGE_KEY = "jklm_ext_friend_requests";
  const KNOWN_USERS_STORAGE_KEY = "jklm_ext_known_users";
  const USER_REGISTRY_STORAGE_KEY = "jklm_ext_user_registry";
  const DM_MESSAGES_STORAGE_KEY = "jklm_ext_dm_messages";
  const PINNED_USERS_STORAGE_KEY = "jklm_ext_pinned_users";
  const UNREAD_COUNTS_STORAGE_KEY = "jklm_ext_unread_counts";
  const GROUPS_STORAGE_KEY = "jklm_ext_groups_cache";
  const GROUP_MESSAGES_STORAGE_KEY = "jklm_ext_group_messages";
  const NOTIFICATION_SOUND_STORAGE_KEY = "jklm_ext_notification_sound_settings";
  const MUTED_CONVERSATIONS_STORAGE_KEY = "jklm_ext_muted_conversations";

  // Stored in the *page's* localStorage (jklm.fun origin), not chrome.storage.
  // chrome.storage.local is wiped whenever the extension is uninstalled, but
  // a website's own localStorage survives extension removal/reinstall and
  // extension updates — it's only cleared if the user clears site data for
  // jklm.fun. Using it as a durable fallback keeps the same userId forever.
  const PAGE_USER_ID_STORAGE_KEY = "jklm_ext_user_id";

  // WebSocket chat server. Deploy /server (see server/README.md) and paste
  // its public wss:// URL here — real-time ping notifications, read
  // receipts and typing indicators all depend on this being reachable.
  const WS_SERVER_URL = "wss://jklm-ext-server-production.up.railway.app";

  // Admin panel access is role-based (server-authoritative "administrator"
  // or "developer" role — see refreshOwnServerState / currentUserRoles),
  // not a shared password anymore.

  let injected = false;
  let customInput = null;
  let playButtonBound = false;
  let profileAvatarImg = null;
  let profileNameEl = null;
  let profileDescEl = null;

  let previewAvatarImg = null;
  let previewNameEl = null;
  let previewStatusDot = null;
  let previewStatusTextEl = null;
  let previewRolesWrap = null;
  let previewDescEl = null;
  let previewBanner = null;

  let formPicInput = null;
  let formNameInput = null;
  let formNameCounter = null;
  let formStatusSelect = null;
  let formStatusDot = null;
  let formDescInput = null;
  let formDescCounter = null;
  let formRolesWrap = null;
  let formBannerFileInput = null;
  let formBannerPreview = null;
  let formBannerPositionX = null;
  let formBannerPositionY = null;
  let formBannerScale = null;

  let userId = null;
  let sharedProfileLinkChecked = false;
  let panelOpen = false;
  let bannerDataUrl = null;
  let cropperInstance = null;
  let notificationAudioCtx = null;

  // --- Realtime chat (WebSocket) state ---
  let ws = null;
  let wsReconnectTimer = null;
  let wsReconnectDelay = 1000;
  // The friendId of whichever DM conversation is currently open on screen.
  // Used to suppress ping toasts for the chat you're already looking at,
  // and to fire read receipts as soon as a message arrives.
  let activeConversationWith = null;
  // Callbacks subscribed by whichever DM chat UI is currently open, so
  // WS-driven events (typing / read receipts) can update it live.
  const dmMessageListeners = new Set();
  // requestId -> resolver, for the request/response helper wsRequest().
  const pendingWSRequests = new Map();
  // userId -> { online, lastActive }. Purely in-memory (not persisted to
  // chrome.storage) — it's live presence, refreshed via get_presence and
  // kept current by presence_update pushes. Drives the online indicator
  // dot next to each friend in the DMs sidebar.
  const presenceCache = new Map();

  function generateUserId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 16; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  function getUserId() {
    return new Promise((resolve) => {
      // Read the durable, page-level copy first. This lives in jklm.fun's
      // own localStorage, so it survives the extension being deleted and
      // reinstalled (or updated to a new version) — unlike chrome.storage.local,
      // which gets wiped on uninstall.
      let pageId = null;
      try {
        pageId = window.localStorage.getItem(PAGE_USER_ID_STORAGE_KEY);
      } catch (e) {
        // localStorage can be unavailable (privacy mode, disabled storage, etc.)
      }

      chrome.storage.local.get(['jklm_ext_user_id'], (result) => {
        // Priority: existing extension-storage id > existing page-storage id > brand new id.
        const id = result.jklm_ext_user_id || pageId || generateUserId();

        // Always write back to BOTH stores, so whichever one happens to
        // survive next time (page localStorage across reinstalls, or
        // chrome.storage.local across ordinary updates) has the same value.
        chrome.storage.local.set({ jklm_ext_user_id: id }, () => {
          try {
            window.localStorage.setItem(PAGE_USER_ID_STORAGE_KEY, id);
          } catch (e) {
            // ignore — worst case we fall back to chrome.storage.local next time
          }
          resolve(id);
        });
      });
    });
  }

  function getDefaultProfileData() {
    return {
      avatarUrl: DEFAULT_AVATAR,
      bannerUrl: DEFAULT_BANNER,
      bannerPosition: 'center center',
      bannerScale: 'cover',
      name: '',
      status: 'online',
      description: '',
      roles: ['user']
    };
  }

  function loadProfileData() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        const data = result[STORAGE_KEY];
        if (data) {
          resolve(data);
        } else {
          resolve(getDefaultProfileData());
        }
      });
    });
  }

  function saveProfileData(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEY]: data }, resolve);
    });
  }

  function getDefaultNotificationSoundSettings() {
    return { enabled: true, volume: 0.5, customSoundDataUrl: null, customSoundName: null };
  }

  function loadNotificationSoundSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([NOTIFICATION_SOUND_STORAGE_KEY], (result) => {
        const data = result[NOTIFICATION_SOUND_STORAGE_KEY];
        resolve({ ...getDefaultNotificationSoundSettings(), ...(data || {}) });
      });
    });
  }

  function saveNotificationSoundSettings(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [NOTIFICATION_SOUND_STORAGE_KEY]: data }, resolve);
    });
  }

  // Plays a short two-note notification chime, similar in spirit to the
  // classic "message received" pings used by most chat apps. This is a
  // synthesized sound (Web Audio API), not a reproduction of any
  // particular app's proprietary audio asset — we can style/tune it, but
  // can't ship someone else's copyrighted sound file.
  // Plays the user's custom ping sound if they've picked one in Settings
  // (stored as a data URL in chrome.storage.local), otherwise falls back
  // to the synthesized chime below.
  function playNotificationSound(volumeOverride, customSoundDataUrl) {
    const masterVolume = typeof volumeOverride === "number" ? volumeOverride : 0.5;
    if (masterVolume <= 0) return;

    if (customSoundDataUrl) {
      try {
        const audio = new Audio(customSoundDataUrl);
        audio.volume = Math.min(1, Math.max(0, masterVolume));
        audio.addEventListener("error", () => playSynthNotificationSound(masterVolume), { once: true });
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => playSynthNotificationSound(masterVolume));
        }
        return;
      } catch (err) {
        // Corrupt/unsupported file — fall through to the synth chime below.
      }
    }
    playSynthNotificationSound(masterVolume);
  }

  // Plays a short two-note notification chime, similar in spirit to the
  // classic "message received" pings used by most chat apps. This is a
  // synthesized sound (Web Audio API), used whenever no custom sound is
  // set (or the custom one fails to play).
  function playSynthNotificationSound(masterVolume) {
    try {
      if (!notificationAudioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        notificationAudioCtx = new Ctx();
      }
      const ctx = notificationAudioCtx;
      if (ctx.state === "suspended") ctx.resume();

      const now = ctx.currentTime;

      // Two quick tones (a rising interval) with a fast attack and short
      // decay, one after another, similar to a typical notification "pop".
      const notes = [
        { freq: 830, start: 0, duration: 0.11 },
        { freq: 1245, start: 0.09, duration: 0.16 }
      ];

      notes.forEach(({ freq, start, duration }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0, now + start);
        gain.gain.linearRampToValueAtTime(masterVolume * 0.5, now + start + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + duration + 0.02);
      });
    } catch (err) {
      // Autoplay restrictions or an unsupported browser shouldn't ever
      // break the rest of the notification (toast still shows either way).
    }
  }

  function loadFriendsList() {
    return new Promise((resolve) => {
      chrome.storage.local.get([FRIENDS_STORAGE_KEY], (result) => {
        const raw = Array.isArray(result[FRIENDS_STORAGE_KEY]) ? result[FRIENDS_STORAGE_KEY] : [];
        const deduped = Array.from(new Set(raw));
        if (deduped.length !== raw.length) {
          // Legacy entries from before writes were deduped — heal storage
          // once so this doesn't keep re-appearing.
          saveFriendsList(deduped).then(() => resolve(deduped));
        } else {
          resolve(raw);
        }
      });
    });
  }

  function saveFriendsList(list) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [FRIENDS_STORAGE_KEY]: list }, resolve);
    });
  }

  function loadBlockedList() {
    return new Promise((resolve) => {
      chrome.storage.local.get([BLOCKED_STORAGE_KEY], (result) => {
        resolve(Array.isArray(result[BLOCKED_STORAGE_KEY]) ? result[BLOCKED_STORAGE_KEY] : []);
      });
    });
  }

  function saveBlockedList(list) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [BLOCKED_STORAGE_KEY]: list }, resolve);
    });
  }

  function loadUserRegistry() {
    return new Promise((resolve) => {
      chrome.storage.local.get([USER_REGISTRY_STORAGE_KEY], (result) => {
        resolve(Array.isArray(result[USER_REGISTRY_STORAGE_KEY]) ? result[USER_REGISTRY_STORAGE_KEY] : []);
      });
    });
  }

  function saveUserRegistry(list) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [USER_REGISTRY_STORAGE_KEY]: list }, resolve);
    });
  }

  function loadFriendRequests() {
    return new Promise((resolve) => {
      chrome.storage.local.get([FRIEND_REQUESTS_STORAGE_KEY], (result) => {
        resolve(Array.isArray(result[FRIEND_REQUESTS_STORAGE_KEY]) ? result[FRIEND_REQUESTS_STORAGE_KEY] : []);
      });
    });
  }

  function saveFriendRequests(list) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [FRIEND_REQUESTS_STORAGE_KEY]: list }, resolve);
    });
  }

  function loadKnownUsers() {
    return new Promise((resolve) => {
      chrome.storage.local.get([KNOWN_USERS_STORAGE_KEY], (result) => {
        resolve(Array.isArray(result[KNOWN_USERS_STORAGE_KEY]) ? result[KNOWN_USERS_STORAGE_KEY] : []);
      });
    });
  }

  function saveKnownUsers(list) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [KNOWN_USERS_STORAGE_KEY]: list }, resolve);
    });
  }

  function conversationKey(a, b) {
    return [a, b].sort().join("::");
  }

  // Used for the little quoted-message preview shown above a reply (both in
  // the reply-composer bar and on the reply reference line rendered above a
  // message that replies to another one). Kept short like Discord's quote.
  function truncateForReplyPreview(text) {
    const oneLine = String(text || "").replace(/\s+/g, " ").trim();
    return oneLine.length > 120 ? oneLine.slice(0, 120) + "…" : oneLine;
  }

  function loadDMMessages() {
    return new Promise((resolve) => {
      chrome.storage.local.get([DM_MESSAGES_STORAGE_KEY], (result) => {
        const data = result[DM_MESSAGES_STORAGE_KEY];
        resolve(data && typeof data === "object" ? data : {});
      });
    });
  }

  function saveDMMessages(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [DM_MESSAGES_STORAGE_KEY]: data }, resolve);
    });
  }

  // Group chats: the server is authoritative (data.groups / data.groupMessages
  // in server.js), these are just a local cache so the sidebar and chat can
  // render instantly without waiting on a round trip every time the panel
  // opens — refreshed via get_groups / group_history and kept current by the
  // group_created / group_updated / group_removed / group_left / group_message
  // pushes handled in handleWSMessage().
  function loadGroupsCache() {
    return new Promise((resolve) => {
      chrome.storage.local.get([GROUPS_STORAGE_KEY], (result) => {
        resolve(Array.isArray(result[GROUPS_STORAGE_KEY]) ? result[GROUPS_STORAGE_KEY] : []);
      });
    });
  }

  function saveGroupsCache(list) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [GROUPS_STORAGE_KEY]: list }, resolve);
    });
  }

  function loadGroupMessages() {
    return new Promise((resolve) => {
      chrome.storage.local.get([GROUP_MESSAGES_STORAGE_KEY], (result) => {
        const data = result[GROUP_MESSAGES_STORAGE_KEY];
        resolve(data && typeof data === "object" ? data : {});
      });
    });
  }

  function saveGroupMessages(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [GROUP_MESSAGES_STORAGE_KEY]: data }, resolve);
    });
  }

  function loadPinnedUsers() {
    return new Promise((resolve) => {
      chrome.storage.local.get([PINNED_USERS_STORAGE_KEY], (result) => {
        resolve(Array.isArray(result[PINNED_USERS_STORAGE_KEY]) ? result[PINNED_USERS_STORAGE_KEY] : []);
      });
    });
  }

  function savePinnedUsers(list) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [PINNED_USERS_STORAGE_KEY]: list }, resolve);
    });
  }

  // Ids (friend ids or group ids — same flat list, like pinned users) whose
  // ping sound the user has turned off from the "⋮" menu. The toast itself
  // still shows; only playNotificationSound() gets skipped for these.
  function loadMutedConversations() {
    return new Promise((resolve) => {
      chrome.storage.local.get([MUTED_CONVERSATIONS_STORAGE_KEY], (result) => {
        resolve(Array.isArray(result[MUTED_CONVERSATIONS_STORAGE_KEY]) ? result[MUTED_CONVERSATIONS_STORAGE_KEY] : []);
      });
    });
  }

  function saveMutedConversations(list) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [MUTED_CONVERSATIONS_STORAGE_KEY]: list }, resolve);
    });
  }

  function loadUnreadCounts() {
    return new Promise((resolve) => {
      chrome.storage.local.get([UNREAD_COUNTS_STORAGE_KEY], (result) => {
        const map = result[UNREAD_COUNTS_STORAGE_KEY];
        resolve(map && typeof map === "object" ? map : {});
      });
    });
  }

  function saveUnreadCounts(map) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [UNREAD_COUNTS_STORAGE_KEY]: map }, resolve);
    });
  }

  function bumpUnread(friendId) {
    loadUnreadCounts().then((map) => {
      const next = { ...map, [friendId]: (map[friendId] || 0) + 1 };
      saveUnreadCounts(next).then(() => {
        dmMessageListeners.forEach((fn) => fn("unread", next[friendId], friendId));
      });
    });
  }

  function clearUnread(friendId) {
    loadUnreadCounts().then((map) => {
      if (!map[friendId]) return;
      const next = { ...map };
      delete next[friendId];
      saveUnreadCounts(next).then(() => {
        dmMessageListeners.forEach((fn) => fn("unread", 0, friendId));
      });
    });
  }

  // --- WebSocket connection to the chat server ---
  // See server/README.md. Handles reconnect with backoff so a restart of
  // the server (or a flaky connection) doesn't need a page reload.

  function sendWS(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  // Request/response helper on top of the plain WS message stream: sends
  // `type` + a generated requestId, resolves with the server's reply once
  // it echoes that requestId back (or null on timeout / no connection).
  function wsRequest(type, payload, timeoutMs) {
    return new Promise((resolve) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        resolve(null);
        return;
      }
      const requestId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
      const timer = setTimeout(() => {
        pendingWSRequests.delete(requestId);
        resolve(null);
      }, timeoutMs || 5000);
      pendingWSRequests.set(requestId, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
      sendWS({ type, requestId, ...payload });
    });
  }

  function isGroupId(id) {
    return typeof id === "string" && id.indexOf("g_") === 0;
  }

  // Bulk presence lookup for the sidebar's online indicators. Resolves with
  // an {id: {online, lastActive}} map and updates presenceCache as a side
  // effect; falls back to whatever's already cached if the request times out
  // or the socket is down, rather than blanking everything to "unknown".
  function fetchPresence(ids) {
    if (!ids.length) return Promise.resolve({});
    return wsRequest("get_presence", { ids }).then((res) => {
      const map = (res && res.presence) || {};
      Object.keys(map).forEach((id) => presenceCache.set(id, map[id]));
      const merged = {};
      ids.forEach((id) => {
        merged[id] = presenceCache.get(id) || null;
      });
      return merged;
    });
  }

  function leaveActiveConversation() {
    if (activeConversationWith && activeConversationWith !== SYSTEM_BOT_ID && !isGroupId(activeConversationWith)) {
      sendWS({ type: "close_conversation" });
    }
    activeConversationWith = null;
  }

  function scheduleWSReconnect() {
    if (wsReconnectTimer) return;
    wsReconnectTimer = setTimeout(() => {
      wsReconnectTimer = null;
      connectWebSocket();
    }, wsReconnectDelay);
    wsReconnectDelay = Math.min(wsReconnectDelay * 2, 30000);
  }

  function handleWSMessage(data) {
    if (!data || !data.type) return;

    if (data.requestId && pendingWSRequests.has(data.requestId)) {
      const resolve = pendingWSRequests.get(data.requestId);
      pendingWSRequests.delete(data.requestId);
      resolve(data);
      return;
    }

    if (data.type === "friend_request_incoming") {
      loadFriendRequests().then((current) => {
        const exists = current.some(
          (r) => r.from === data.from && r.to === userId && r.status === "pending"
        );
        if (exists) return;
        const next = [
          ...current,
          { from: data.from, to: userId, status: "pending", createdAt: Date.now() }
        ];
        saveFriendRequests(next).then(() => {
          dmMessageListeners.forEach((fn) => fn("friend_requests", next));
        });
        showFriendRequestToast(data.from, data.profile);
      });
      if (data.profile) {
        ensureKnownUser(data.from);
        loadUserRegistry().then((registry) => {
          const others = registry.filter((r) => r.id !== data.from);
          saveUserRegistry([
            ...others,
            {
              id: data.from,
              name: data.profile.name || data.from,
              roles: Array.isArray(data.profile.roles) ? data.profile.roles : ["user"],
              status: data.profile.status,
              description: data.profile.description,
              avatarUrl: data.profile.avatarUrl,
              bannerUrl: data.profile.bannerUrl,
              banned: Boolean(data.profile.banned),
              banReason: data.profile.banReason || ""
            }
          ]);
        });
      }
      return;
    } else if (data.type === "friend_request_resolved") {
      loadFriendRequests().then((current) => {
        const updated = current.map((r) => {
          if (r.from === userId && r.to === data.by && r.status === "pending") {
            return { ...r, status: data.accepted ? "accepted" : "declined" };
          }
          return r;
        });
        saveFriendRequests(updated).then(() => {
          dmMessageListeners.forEach((fn) => fn("friend_requests", updated));
        });
      });
      if (data.accepted) {
        ensureKnownUser(data.by);
        if (data.profile) {
          loadUserRegistry().then((registry) => {
            const others = registry.filter((r) => r.id !== data.by);
            saveUserRegistry([
              ...others,
              {
                id: data.by,
                name: data.profile.name || data.by,
                roles: Array.isArray(data.profile.roles) ? data.profile.roles : ["user"],
                status: data.profile.status,
                description: data.profile.description,
                avatarUrl: data.profile.avatarUrl,
                bannerUrl: data.profile.bannerUrl,
                banned: Boolean(data.profile.banned),
                banReason: data.profile.banReason || ""
              }
            ]);
          });
        }
        loadFriendsList().then((friends) => {
          if (friends.includes(data.by)) return;
          const next = [...friends, data.by];
          saveFriendsList(next).then(() => {
            dmMessageListeners.forEach((fn) => fn("friends_list", next));
          });
        });
      }
      return;
    }

    if (data.type === "profile_updated") {
      const friendId = data.userId;
      if (!friendId || !data.profile) return;
      loadUserRegistry().then((registry) => {
        const merged = {
          id: friendId,
          name: data.profile.name || friendId,
          roles: Array.isArray(data.profile.roles) ? data.profile.roles : ["user"],
          status: data.profile.status,
          description: data.profile.description,
          avatarUrl: data.profile.avatarUrl,
          bannerUrl: data.profile.bannerUrl,
          // The server is authoritative for ban status (only admin_ban_user /
          // admin_unban_user change it there) — trust what it sends instead
          // of falling back to whatever this browser had cached locally.
          banned: Boolean(data.profile.banned),
          banReason: data.profile.banReason || ""
        };
        const others = registry.filter((r) => r.id !== friendId);
        saveUserRegistry([...others, merged]).then(() => {
          dmMessageListeners.forEach((fn) => fn("profile_updated", merged, friendId));
        });
      });
      return;
    }

    // --- our own ban status changed (an admin banned/unbanned us just now,
    // while we're connected) — update the cache and, if the config panel
    // happens to be open, rebuild it immediately instead of waiting for the
    // next time it's opened. ---
    if (data.type === "you_are_banned" || data.type === "you_are_unbanned") {
      const banned = data.type === "you_are_banned";
      loadUserRegistry().then((registry) => {
        const existing = registry.find((r) => r.id === userId) || {};
        const merged = { ...existing, id: userId, banned, banReason: banned ? (data.reason || "") : "" };
        const others = registry.filter((r) => r.id !== userId);
        saveUserRegistry([...others, merged]).then(() => {
          const overlay = document.getElementById("jklm-ext-config-overlay");
          if (!overlay) return;
          if (cropperInstance) {
            cropperInstance.destroy();
            cropperInstance = null;
          }
          overlay.remove();
          leaveActiveConversation();
          dmMessageListeners.clear();
          buildConfigPanel();
        });
      });
      return;
    }

    // --- our own roles changed (an admin/developer just changed them while
    // we're connected) — update the cache and, if the config panel is open,
    // rebuild it so the Admin tab appears/disappears immediately instead of
    // waiting for the next time the panel is opened. ---
    if (data.type === "role_updated") {
      const roles = Array.isArray(data.roles) ? data.roles : ["user"];
      // Only skip the full rebuild if we caused this ourselves AND it
      // doesn't change whether the Admin tab should be visible — losing or
      // gaining admin/developer still needs the tab bar rebuilt, so that
      // case falls through to the normal rebuild below.
      const hadAdminAccess = currentUserRoles.includes("administrator") || currentUserRoles.includes("developer");
      const hasAdminAccessNow = roles.includes("administrator") || roles.includes("developer");
      const skipRebuild = suppressOwnRoleRebuild && hadAdminAccess === hasAdminAccessNow;
      suppressOwnRoleRebuild = false;
      currentUserRoles = roles;
      loadUserRegistry().then((registry) => {
        const existing = registry.find((r) => r.id === userId) || {};
        const merged = { ...existing, id: userId, roles };
        const others = registry.filter((r) => r.id !== userId);
        saveUserRegistry([...others, merged]).then(() => {
          renderRoleBadges(formRolesWrap, true);
          renderRoleBadges(previewRolesWrap, false);
          if (skipRebuild) return;
          const overlay = document.getElementById("jklm-ext-config-overlay");
          if (!overlay) return;
          if (cropperInstance) {
            cropperInstance.destroy();
            cropperInstance = null;
          }
          overlay.remove();
          leaveActiveConversation();
          dmMessageListeners.clear();
          buildConfigPanel();
        });
      });
      return;
    }

    if (data.type === "auth_ok") {
      loadProfileData().then((profile) => sendWS({ type: "sync_profile", profile }));
      return;
    }

    if (data.type === "message") {
      const msg = data.message;
      if (!msg || !msg.from || !msg.to) return;
      const otherId = msg.from === userId ? msg.to : msg.from;

      loadDMMessages().then((all) => {
        const key = conversationKey(msg.from, msg.to);
        const list = all[key] || [];
        if (list.some((m) => m.id === msg.id)) return;
        const nextAll = { ...all, [key]: [...list, msg] };
        saveDMMessages(nextAll);
      });

      if (msg.from !== userId) {
        if (activeConversationWith === msg.from) {
          sendWS({ type: "read", withUserId: msg.from });
        } else {
          bumpUnread(otherId);
          showPingToast(otherId, msg.text);
        }
      }
    } else if (data.type === "typing") {
      dmMessageListeners.forEach((fn) => fn("typing", data.isTyping, data.from));
    } else if (data.type === "read_receipt") {
      dmMessageListeners.forEach((fn) => fn("read_receipt", true, data.withUserId));
    } else if (data.type === "history") {
      const withUserId = data.withUserId;
      if (!withUserId) return;
      loadDMMessages().then((all) => {
        const key = conversationKey(userId, withUserId);
        const existing = all[key] || [];
        const byId = new Map(existing.map((m) => [m.id, m]));
        (data.messages || []).forEach((m) => {
          if (m && m.id) byId.set(m.id, m);
        });
        const merged = Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
        saveDMMessages({ ...all, [key]: merged });
      });
    } else if (data.type === "group_created" || data.type === "group_updated") {
      if (!data.group || !data.group.id) return;
      loadGroupsCache().then((list) => {
        const others = list.filter((g) => g.id !== data.group.id);
        saveGroupsCache([...others, data.group]).then(() => {
          dmMessageListeners.forEach((fn) => fn("groups_list", null));
        });
      });
    } else if (data.type === "group_removed" || data.type === "group_left") {
      if (!data.groupId) return;
      loadGroupsCache().then((list) => {
        saveGroupsCache(list.filter((g) => g.id !== data.groupId)).then(() => {
          dmMessageListeners.forEach((fn) => fn("groups_list", null));
        });
      });
    } else if (data.type === "group_message") {
      const msg = data.message;
      if (!msg || !msg.groupId) return;

      loadGroupMessages().then((all) => {
        const list = all[msg.groupId] || [];
        if (list.some((m) => m.id === msg.id)) return;
        saveGroupMessages({ ...all, [msg.groupId]: [...list, msg] });
      });

      if (msg.from !== userId) {
        if (activeConversationWith === msg.groupId) {
          // Chat's already open on screen — this message is seen the moment
          // it arrives, so push our read position forward instead of piling
          // up unread count / a ping toast for something already visible.
          sendWS({ type: "group_read", groupId: msg.groupId });
        } else {
          bumpUnread(msg.groupId);
          const mentionedMe = Array.isArray(msg.mentions) && msg.mentions.includes(userId);
          loadGroupsCache().then((groups) => {
            const group = groups.find((g) => g.id === msg.groupId);
            showPingToast(msg.groupId, (mentionedMe ? "📣 You were mentioned: " : "") + msg.text, {
              name: (group && group.name) || "Group Chat",
              avatarUrl: DEFAULT_AVATAR
            });
          });
        }
      }
    } else if (data.type === "group_history") {
      const groupId = data.groupId;
      if (!groupId) return;
      loadGroupMessages().then((all) => {
        const existing = all[groupId] || [];
        const byId = new Map(existing.map((m) => [m.id, m]));
        (data.messages || []).forEach((m) => {
          if (m && m.id) byId.set(m.id, m);
        });
        const merged = Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
        saveGroupMessages({ ...all, [groupId]: merged });
      });
      dmMessageListeners.forEach((fn) => fn("group_read_state", data.readState || {}, groupId));
    } else if (data.type === "group_read_receipt") {
      if (!data.groupId || !data.userId) return;
      dmMessageListeners.forEach((fn) =>
        fn("group_read_receipt", { userId: data.userId, timestamp: data.timestamp }, data.groupId)
      );
    } else if (data.type === "group_invite_update") {
      if (!data.withUserId || !data.inviteId) return;
      const key = conversationKey(userId, data.withUserId);
      loadDMMessages().then((all) => {
        const list = all[key] || [];
        const idx = list.findIndex((m) => m.id === data.inviteId);
        if (idx === -1) return;
        const updated = list.slice();
        updated[idx] = { ...updated[idx], status: data.status };
        saveDMMessages({ ...all, [key]: updated });
      });
    } else if (data.type === "presence_update") {
      if (!data.userId) return;
      presenceCache.set(data.userId, { online: Boolean(data.online), lastActive: data.lastActive || null });
      dmMessageListeners.forEach((fn) =>
        fn("presence_update", presenceCache.get(data.userId), data.userId)
      );
    }
  }

  function connectWebSocket() {
    if (!userId) return;
    if (!WS_SERVER_URL || WS_SERVER_URL.indexOf("REPLACE-ME") !== -1) return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    try {
      ws = new WebSocket(WS_SERVER_URL);
    } catch (e) {
      scheduleWSReconnect();
      return;
    }

    ws.addEventListener("open", () => {
      wsReconnectDelay = 1000;
      sendWS({ type: "auth", userId });
      if (activeConversationWith) {
        sendWS({ type: "open_conversation", withUserId: activeConversationWith });
      }
      checkSharedProfileLink();
    });

    ws.addEventListener("message", (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      handleWSMessage(data);
    });

    ws.addEventListener("close", scheduleWSReconnect);
    ws.addEventListener("error", () => {
      try {
        ws.close();
      } catch (e) {
        /* noop */
      }
    });
  }

  // Ping notification: shown whenever a DM arrives for a conversation that
  // isn't the one currently on screen (including when the whole panel is
  // closed). Clicking it jumps straight to that conversation.
  function showPingToast(friendId, text, override) {
    loadNotificationSoundSettings().then((settings) => {
      if (!settings.enabled) return;
      loadMutedConversations().then((muted) => {
        if (muted.includes(friendId)) return;
        playNotificationSound(settings.volume, settings.customSoundDataUrl);
      });
    });

    const lookup = override
      ? Promise.resolve(override)
      : loadUserRegistry().then((registry) => {
        const record = registry.find((r) => r.id === friendId);
        return {
          name: (record && record.name) || (friendId === SYSTEM_BOT_ID ? "Mio" : "Someone"),
          avatarUrl: (record && record.avatarUrl) || DEFAULT_AVATAR
        };
      });

    lookup.then(({ name, avatarUrl }) => {
      let stack = document.getElementById("jklm-ext-toast-stack");
      if (!stack) {
        stack = document.createElement("div");
        stack.id = "jklm-ext-toast-stack";
        stack.className = "jklm-ext-toast-stack";
        document.body.appendChild(stack);
      }

      const toast = document.createElement("div");
      toast.className = "jklm-ext-toast";

      const avatar = document.createElement("img");
      avatar.className = "jklm-ext-toast-avatar";
      avatar.src = avatarUrl;
      avatar.alt = name;

      const body = document.createElement("div");
      body.className = "jklm-ext-toast-body";

      const title = document.createElement("div");
      title.className = "jklm-ext-toast-title";
      title.textContent = name;

      const preview = document.createElement("div");
      preview.className = "jklm-ext-toast-preview";
      preview.textContent = (text || "").slice(0, 80);

      body.appendChild(title);
      body.appendChild(preview);
      toast.appendChild(avatar);
      toast.appendChild(body);

      toast.addEventListener("click", () => {
        toast.remove();
        openConfigPanel();
        setTimeout(() => {
          const friendsTabBtn = document.querySelector('.jklm-ext-tab[data-tab="friends"]');
          if (friendsTabBtn) friendsTabBtn.click();
          const dmsTabBtn = document.querySelector('.jklm-ext-subtab[data-subtab="dms"]');
          if (dmsTabBtn) dmsTabBtn.click();
          const friendItem = document.querySelector(
            '[data-friend-id="' + CSS.escape(friendId) + '"] .jklm-ext-dms-friend-item-main'
          );
          if (friendItem) friendItem.click();
        }, 60);
      });

      stack.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add("show"));

      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
      }, 6000);
    });
  }

  // Friend-request notification: shown the moment a request comes in over
  // the socket, so it doesn't require reloading the page (or reopening the
  // panel) to notice it. Clicking it jumps straight to Friends -> Add.
  function showFriendRequestToast(fromId, profile) {
    const name = (profile && profile.name) || fromId;
    const avatarUrl = (profile && profile.avatarUrl) || DEFAULT_AVATAR;

    let stack = document.getElementById("jklm-ext-toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "jklm-ext-toast-stack";
      stack.className = "jklm-ext-toast-stack";
      document.body.appendChild(stack);
    }

    const toast = document.createElement("div");
    toast.className = "jklm-ext-toast";

    const avatar = document.createElement("img");
    avatar.className = "jklm-ext-toast-avatar";
    avatar.src = avatarUrl;
    avatar.alt = name;

    const body = document.createElement("div");
    body.className = "jklm-ext-toast-body";

    const title = document.createElement("div");
    title.className = "jklm-ext-toast-title";
    title.textContent = name;

    const preview = document.createElement("div");
    preview.className = "jklm-ext-toast-preview";
    preview.textContent = "sent you a friend request";

    body.appendChild(title);
    body.appendChild(preview);
    toast.appendChild(avatar);
    toast.appendChild(body);

    toast.addEventListener("click", () => {
      toast.remove();
      openConfigPanel();
      setTimeout(() => {
        const friendsTabBtn = document.querySelector('.jklm-ext-tab[data-tab="friends"]');
        if (friendsTabBtn) friendsTabBtn.click();
        const addTabBtn = document.querySelector('.jklm-ext-subtab[data-subtab="add"]');
        if (addTabBtn) addTabBtn.click();
      }, 60);
    });

    stack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  }

  function getStatusColor(statusValue) {
    const opt = STATUS_OPTIONS.find((o) => o.value === statusValue);
    return opt ? opt.color : STATUS_OPTIONS[0].color;
  }

  // Coarse "time ago" label for the friend statistics panel's last-activity
  // row. Deliberately low-precision (no seconds/exact timestamps) since this
  // is shown for any friend, not just the viewer's own account.
  function formatRelativeTime(ts) {
    if (!ts) return "Unknown";
    const diffMs = Date.now() - ts;
    if (diffMs < 0) return "Just now";
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diffMs < minute) return "Just now";
    if (diffMs < hour) {
      const mins = Math.floor(diffMs / minute);
      return mins + (mins === 1 ? " minute ago" : " minutes ago");
    }
    if (diffMs < day) {
      const hrs = Math.floor(diffMs / hour);
      return hrs + (hrs === 1 ? " hour ago" : " hours ago");
    }
    const days = Math.floor(diffMs / day);
    if (days < 30) return days + (days === 1 ? " day ago" : " days ago");
    const months = Math.floor(days / 30);
    if (months < 12) return months + (months === 1 ? " month ago" : " months ago");
    const years = Math.floor(months / 12);
    return years + (years === 1 ? " year ago" : " years ago");
  }

  function ensureKnownUser(id) {
    const normalized = (id || "").trim();
    if (!normalized) return Promise.resolve();
    return loadKnownUsers().then((current) => {
      if (current.includes(normalized)) {
        return current;
      }
      const updated = [...current, normalized];
      return saveKnownUsers(updated).then(() => updated);
    });
  }

  // Some code paths only ever learn a user's ID (e.g. you were the one who
  // sent a friend request, or a friendship predates this fix) — the
  // registry never got their name/roles/status/description. This asks the
  // server for the latest profile and backfills the registry so the UI can
  // show a username instead of a raw ID. Always hits the network so that
  // profile changes (name, bio, avatar, ...) show up immediately for users
  // who aren't friends and therefore don't get live profile_updated pushes.
  function ensureUserProfile(id) {
    if (!id || id === userId || id === SYSTEM_BOT_ID) return Promise.resolve(null);
    return wsRequest("lookup_user", { userId: id }).then((res) => {
      if (!res || !res.found || !res.profile) return null;
      return loadUserRegistry().then((registry) => {
        const merged = {
          id,
          name: res.profile.name || id,
          roles: Array.isArray(res.profile.roles) ? res.profile.roles : ["user"],
          status: res.profile.status,
          description: res.profile.description,
          avatarUrl: res.profile.avatarUrl,
          bannerUrl: res.profile.bannerUrl,
          // Server-authoritative — see profile_updated handler above.
          banned: Boolean(res.profile.banned),
          banReason: res.profile.banReason || ""
        };
        const others = registry.filter((r) => r.id !== id);
        // mutualFriends reflects the relationship between the viewer and this
        // user (computed server-side, since neither side's friends list is
        // visible to the other client) — it's per-lookup context, not part
        // of the cached registry entry, so it's attached to the returned
        // copy only, after the registry itself is saved.
        return saveUserRegistry([...others, merged]).then(() => ({
          ...merged,
          mutualFriends: Array.isArray(res.mutualFriends) ? res.mutualFriends : [],
          // Only present when the server considers this user a confirmed
          // friend of the viewer (see lookup_user on the server) — per-lookup
          // context like mutualFriends, not part of the cached registry entry.
          friendStats: res.friendStats && typeof res.friendStats === "object" ? res.friendStats : null
        }));
      });
    }).catch(() => null);
  }

  function ensureSystemBotRegistered() {
    return ensureKnownUser(SYSTEM_BOT_ID).then(() =>
      loadUserRegistry().then((registry) => {
        // The SystemBot only ever sends automated messages and can never be
        // banned — enforced here too, not just in the Admin panel UI.
        const merged = {
          ...SYSTEM_BOT_PROFILE,
          banned: false,
          banReason: ''
        };
        const withoutBot = registry.filter((entry) => entry.id !== SYSTEM_BOT_ID);
        return saveUserRegistry([...withoutBot, merged]);
      })
    );
  }

  function tryInject() {
    if (injected) return;

    const container = document.querySelector(".gameSelection");
    if (!container) return;

    const existing = container.querySelector('div[data-game-id="' + CUSTOM_GAME_ID + '"]');
    if (existing) {
      injected = true;
      customInput = document.getElementById("gameRadio-" + CUSTOM_GAME_ID);
      profileAvatarImg = existing.querySelector("img.jklm-ext-avatar-img");
      profileNameEl = existing.querySelector("div.name");
      profileDescEl = existing.querySelector("div.description");
      updatePanelFromStorage();
      return;
    }

    const popsauce = container.querySelector('div[data-game-id="popsauce"]');
    const template = popsauce || container.querySelector("div[data-game-id]");
    if (!template) return;

    const clone = template.cloneNode(true);
    clone.setAttribute("data-game-id", CUSTOM_GAME_ID);

    const input = clone.querySelector('input[name="' + RADIO_GROUP_NAME + '"]');
    const label = clone.querySelector("label");
    const iconEl = clone.querySelector("div.icon");
    const nameEl = clone.querySelector("div.name");
    const descEl = clone.querySelector("div.description");

    const newId = "gameRadio-" + CUSTOM_GAME_ID;
    if (input) {
      input.id = newId;
      input.value = CUSTOM_GAME_ID;
      input.checked = false;
      customInput = input;
    }
    if (label) label.setAttribute("for", newId);

    if (iconEl) {
      iconEl.textContent = "";
      iconEl.classList.add("jklm-ext-avatar-icon");
      const avatarImg = document.createElement("img");
      avatarImg.className = "jklm-ext-avatar-img";
      avatarImg.src = DEFAULT_AVATAR;
      avatarImg.alt = "Profile picture";
      iconEl.appendChild(avatarImg);
      profileAvatarImg = avatarImg;
    }
    if (nameEl) {
      nameEl.textContent = "No name yet";
      profileNameEl = nameEl;
    }
    if (descEl) {
      descEl.textContent = "No description yet";
      profileDescEl = descEl;
    }

    if (popsauce) {
      popsauce.insertAdjacentElement("afterend", clone);
    } else {
      container.appendChild(clone);
    }

    injected = true;
    tryBindPlayButton();
    updatePanelFromStorage();
  }

  function updatePanelFromStorage() {
    loadProfileData().then((data) => {
      if (profileAvatarImg) {
        profileAvatarImg.src = data.avatarUrl || DEFAULT_AVATAR;
      }
      if (profileNameEl) {
        const name = (data.name || '').trim();
        profileNameEl.textContent = name.slice(0, PANEL_NAME_PREVIEW_LENGTH) || "No name yet";
      }
      if (profileDescEl) {
        const desc = (data.description || '').trim();
        profileDescEl.textContent = desc.slice(0, PANEL_DESCRIPTION_PREVIEW_LENGTH) || "No description yet";
      }
    });
  }

  function findPlayButton() {
    const candidates = Array.from(
      document.querySelectorAll("button, [role='button'], div, span")
    );
    return candidates.find(
      (el) =>
        el.children.length === 0 &&
        el.textContent.trim().toLowerCase() === "play"
    );
  }

  function tryBindPlayButton() {
    if (playButtonBound) return;
    const playButton = findPlayButton();
    if (!playButton) return;

    playButton.addEventListener(
      "click",
      (e) => {
        if (customInput && customInput.checked) {
          e.stopPropagation();
          e.preventDefault();
          openConfigPanel();
        }
      },
      true
    );

    playButtonBound = true;
  }

  function openConfigPanel() {
    if (document.getElementById("jklm-ext-config-overlay")) return;
    if (panelOpen) return;
    panelOpen = true;

    if (!userId) {
      getUserId().then((id) => {
        userId = id;
        ensureKnownUser(id);
        buildConfigPanel();
      });
    } else {
      buildConfigPanel();
    }
  }

  function buildConfigPanel() {
    if (document.getElementById("jklm-ext-config-overlay")) {
      panelOpen = false;
      return;
    }

    // Gate the whole panel behind the user's own ban status first — a
    // banned user shouldn't be able to touch Profile/Friends/DMs/Settings/
    // Admin at all, so we check before building any of the tab content.
    // Ban status is server-authoritative, so pull the latest value before
    // deciding (falls back to the last cached value if there's no
    // connection yet).
    refreshOwnServerState().then(() => {
      loadUserRegistry().then((registry) => {
        const ownRecord = registry.find((entry) => entry.id === userId);
        if (ownRecord && ownRecord.banned) {
          buildBannedOverlay(ownRecord);
        } else {
          buildConfigPanelContent();
        }
      });
    });
  }

  // Asks the server for our own current profile (which includes ban status
  // AND roles — both are server-authoritative now) and writes it into the
  // local registry cache + currentUserRoles. Safe to call with no
  // connection yet — it just resolves immediately and buildConfigPanel
  // falls back to whatever was cached from the last successful refresh.
  function refreshOwnServerState() {
    if (!userId) return Promise.resolve();
    return wsRequest("lookup_user", { userId })
      .then((res) => {
        if (!res || !res.found || !res.profile) return;
        const roles = Array.isArray(res.profile.roles) ? res.profile.roles : ["user"];
        currentUserRoles = roles;
        return loadUserRegistry().then((registry) => {
          const existing = registry.find((r) => r.id === userId) || {};
          const merged = {
            ...existing,
            id: userId,
            roles,
            banned: Boolean(res.profile.banned),
            banReason: res.profile.banReason || ""
          };
          const others = registry.filter((r) => r.id !== userId);
          return saveUserRegistry([...others, merged]);
        });
      })
      .catch(() => { });
  }

  function buildBannedOverlay(ownRecord) {
    if (document.getElementById("jklm-ext-config-overlay")) {
      panelOpen = false;
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "jklm-ext-config-overlay";
    overlay.className = "jklm-ext-config-overlay";

    const panel = document.createElement("div");
    panel.className = "jklm-ext-config-panel jklm-ext-banned-panel";

    const closeBtn = document.createElement("button");
    closeBtn.className = "jklm-ext-config-close";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => {
      overlay.remove();
      panelOpen = false;
      leaveActiveConversation();
      dmMessageListeners.clear();
    });

    const screen = document.createElement("div");
    screen.className = "jklm-ext-banned-screen";

    const icon = document.createElement("div");
    icon.className = "jklm-ext-banned-screen-icon";
    icon.textContent = "🚫";

    const title = document.createElement("div");
    title.className = "jklm-ext-banned-screen-title";
    title.textContent = "You are banned";

    const reason = document.createElement("div");
    reason.className = "jklm-ext-banned-screen-reason";
    reason.textContent = ownRecord.banReason
      ? "Reason: " + ownRecord.banReason
      : "No reason was given.";

    const hint = document.createElement("div");
    hint.className = "jklm-ext-banned-screen-hint";
    hint.textContent = "Profile, Friends, DMs, Settings and Admin are all locked while you're banned.";

    screen.appendChild(icon);
    screen.appendChild(title);
    screen.appendChild(reason);
    screen.appendChild(hint);

    panel.appendChild(closeBtn);
    panel.appendChild(screen);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        overlay.remove();
        panelOpen = false;
        leaveActiveConversation();
        dmMessageListeners.clear();
      }
    });
  }

  function buildConfigPanelContent() {
    if (document.getElementById("jklm-ext-config-overlay")) {
      panelOpen = false;
      return;
    }

    const isAdminOrDev = currentUserRoles.includes("administrator") || currentUserRoles.includes("developer");
    const tabs = ["Profile", "Preview", "Friends", "Settings"];
    if (isAdminOrDev) tabs.push("Admin");

    const overlay = document.createElement("div");
    overlay.id = "jklm-ext-config-overlay";
    overlay.className = "jklm-ext-config-overlay";

    const panel = document.createElement("div");
    panel.className = "jklm-ext-config-panel";

    const closeBtn = document.createElement("button");
    closeBtn.className = "jklm-ext-config-close";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => {
      if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
      }
      overlay.remove();
      panelOpen = false;
      leaveActiveConversation();
      dmMessageListeners.clear();
      document.removeEventListener("keydown", handleConfigPanelHotkeys);
    });

    const tabBar = document.createElement("div");
    tabBar.className = "jklm-ext-config-tabs";

    const content = document.createElement("div");
    content.className = "jklm-ext-config-content";

    tabs.forEach((tabName, i) => {
      const key = tabName.toLowerCase();

      const tabBtn = document.createElement("button");
      tabBtn.className = "jklm-ext-tab" + (i === 0 ? " active" : "");
      tabBtn.textContent = tabName;
      tabBtn.dataset.tab = key;

      const tabPanel = document.createElement("div");
      tabPanel.className = "jklm-ext-tab-panel" + (i === 0 ? " active" : "");
      tabPanel.dataset.tabPanel = key;

      if (key === "profile") {
        buildProfileForm(tabPanel);
      } else if (key === "preview") {
        buildPreviewTab(tabPanel);
      } else if (key === "friends") {
        buildFriendsTab(tabPanel);
      } else if (key === "settings") {
        buildSettingsTab(tabPanel);
      } else if (key === "admin") {
        buildAdminTab(tabPanel);
      }

      tabBtn.addEventListener("click", () => {
        if (key !== "friends") leaveActiveConversation();
        tabBar
          .querySelectorAll(".jklm-ext-tab")
          .forEach((b) => b.classList.remove("active"));
        content
          .querySelectorAll(".jklm-ext-tab-panel")
          .forEach((p) => p.classList.remove("active"));
        tabBtn.classList.add("active");
        tabPanel.classList.add("active");

        if (cropperInstance) {
          cropperInstance.destroy();
          cropperInstance = null;
          const cropperContainer = document.getElementById("jklm-ext-cropper-container");
          if (cropperContainer) {
            cropperContainer.style.display = "none";
            cropperContainer.innerHTML = "";
          }
        }
      });

      tabBar.appendChild(tabBtn);
      content.appendChild(tabPanel);
    });

    // Hotkey: Ctrl+ArrowRight / Ctrl+ArrowLeft cycles through the panel's
    // tabs (Profile/Preview/Friends/Settings/Admin), like quickly switching
    // between overlay apps. Skipped while a text field has focus so it
    // doesn't fight with normal Ctrl+Arrow word-jump behavior while typing.
    function switchConfigTab(offset) {
      const buttons = Array.from(tabBar.querySelectorAll(".jklm-ext-tab"));
      if (!buttons.length) return;
      const currentIndex = buttons.findIndex((b) => b.classList.contains("active"));
      const nextIndex = (currentIndex + offset + buttons.length) % buttons.length;
      buttons[nextIndex].click();
    }

    function handleConfigPanelHotkeys(event) {
      if (!event.ctrlKey || event.altKey || event.metaKey) return;
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      const active = document.activeElement;
      const tag = active && active.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (active && active.isContentEditable)) return;
      event.preventDefault();
      switchConfigTab(event.key === "ArrowRight" ? 1 : -1);
    }

    document.addEventListener("keydown", handleConfigPanelHotkeys);

    const footer = document.createElement("div");
    footer.className = "jklm-ext-config-footer";

    const saveStatus = document.createElement("span");
    saveStatus.className = "jklm-ext-save-status";

    const closeFooterBtn = document.createElement("button");
    closeFooterBtn.className = "jklm-ext-btn jklm-ext-btn-secondary";
    closeFooterBtn.textContent = "Close";
    closeFooterBtn.addEventListener("click", () => {
      if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
      }
      overlay.remove();
      panelOpen = false;
      leaveActiveConversation();
      dmMessageListeners.clear();
      document.removeEventListener("keydown", handleConfigPanelHotkeys);
    });

    const saveBtn = document.createElement("button");
    saveBtn.className = "jklm-ext-btn jklm-ext-btn-primary";
    saveBtn.textContent = "Save";
    let saveStatusTimeout = null;
    saveBtn.addEventListener("click", () => {
      saveCurrentProfileData().then(() => {
        saveStatus.textContent = "Saved!";
        if (saveStatusTimeout) clearTimeout(saveStatusTimeout);
        saveStatusTimeout = setTimeout(() => {
          saveStatus.textContent = "";
        }, 2000);
        updatePanelFromStorage();
      });
    });

    footer.appendChild(saveStatus);
    footer.appendChild(closeFooterBtn);
    footer.appendChild(saveBtn);

    panel.appendChild(closeBtn);
    panel.appendChild(tabBar);
    panel.appendChild(content);
    panel.appendChild(footer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Note: clicking outside the panel no longer closes it — only the
    // ✕ button or the "Close" footer button do. This avoids accidentally
    // losing unsaved changes from a stray click.

    loadProfileData().then((data) => {
      populateForm(data);
    });
  }

  function buildProfileForm(container) {
    const form = document.createElement("div");
    form.className = "jklm-ext-profile-form";

    const userIdSection = document.createElement("div");
    userIdSection.className = "jklm-ext-userid-section";

    const userIdLabel = document.createElement("div");
    userIdLabel.className = "jklm-ext-userid-label";
    userIdLabel.textContent = "User ID";

    const userIdRow = document.createElement("div");
    userIdRow.className = "jklm-ext-userid-row";

    const userIdValue = document.createElement("span");
    userIdValue.className = "jklm-ext-userid-value";
    userIdValue.textContent = userId || "Loading...";

    const copyBtn = document.createElement("button");
    copyBtn.className = "jklm-ext-userid-copy-btn";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      const text = userId || "";
      navigator.clipboard.writeText(text).catch(() => {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      });
      copyBtn.textContent = "Copied!";
      copyBtn.classList.add("copied");
      setTimeout(() => {
        copyBtn.textContent = "Copy";
        copyBtn.classList.remove("copied");
      }, 2000);
    });

    userIdRow.appendChild(userIdValue);
    userIdRow.appendChild(copyBtn);
    userIdSection.appendChild(userIdLabel);
    userIdSection.appendChild(userIdRow);

    const picRow = buildFormRow("Profile picture");
    const picInput = document.createElement("input");
    picInput.type = "url";
    picInput.placeholder = "https://example.com/avatar.png";
    picInput.className = "jklm-ext-input";
    picInput.id = "jklm-ext-pic-input";
    picInput.addEventListener("input", () => {
      const src = picInput.value.trim() || DEFAULT_AVATAR;
      if (profileAvatarImg) {
        profileAvatarImg.src = src;
      }
      if (previewAvatarImg) {
        previewAvatarImg.src = src;
      }
    });
    picRow.appendChild(picInput);
    formPicInput = picInput;

    const { row: nameRow, counter: nameCounter } = buildFormRowWithCounter("Name", NAME_MAX_LENGTH);
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "Your name";
    nameInput.className = "jklm-ext-input";
    nameInput.maxLength = NAME_MAX_LENGTH;
    nameInput.id = "jklm-ext-name-input";
    nameInput.addEventListener("input", () => {
      const val = nameInput.value;
      nameCounter.textContent = val.length + "/" + NAME_MAX_LENGTH;
      const trimmed = val.trim();
      if (profileNameEl) {
        profileNameEl.textContent =
          trimmed.slice(0, PANEL_NAME_PREVIEW_LENGTH) || "No name yet";
      }
      if (previewNameEl) {
        previewNameEl.textContent = trimmed || "No name yet";
      }
    });
    nameRow.appendChild(nameInput);
    formNameInput = nameInput;
    formNameCounter = nameCounter;

    const rolesRow = buildFormRow("Roles");
    const rolesWrap = document.createElement("div");
    rolesWrap.className = "jklm-ext-input jklm-ext-roles-badge-wrap";
    rolesWrap.id = "jklm-ext-roles-wrap";
    renderRoleBadges(rolesWrap, true);
    rolesRow.appendChild(rolesWrap);
    formRolesWrap = rolesWrap;

    const statusRow = buildFormRow("Status");
    const statusWrapper = document.createElement("div");
    statusWrapper.className = "jklm-ext-status-wrapper";

    const statusDot = document.createElement("span");
    statusDot.className = "jklm-ext-status-dot";

    const statusSelect = document.createElement("select");
    statusSelect.className = "jklm-ext-input jklm-ext-status-select";
    statusSelect.id = "jklm-ext-status-select";
    STATUS_OPTIONS.forEach((opt) => {
      const optionEl = document.createElement("option");
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      statusSelect.appendChild(optionEl);
    });

    function applyStatusColor() {
      const selected =
        STATUS_OPTIONS.find((o) => o.value === statusSelect.value) || STATUS_OPTIONS[0];
      statusDot.style.backgroundColor = selected.color;
      statusSelect.style.color = selected.color;
      applyPreviewStatus(selected);
    }
    statusSelect.addEventListener("change", applyStatusColor);
    applyStatusColor();

    statusWrapper.appendChild(statusDot);
    statusWrapper.appendChild(statusSelect);
    statusRow.appendChild(statusWrapper);
    formStatusSelect = statusSelect;
    formStatusDot = statusDot;

    const { row: descRow, counter: descCounter } = buildFormRowWithCounter(
      "Description",
      DESCRIPTION_MAX_LENGTH
    );
    const descInput = document.createElement("textarea");
    descInput.placeholder = "Say something about yourself";
    descInput.className = "jklm-ext-input jklm-ext-textarea";
    descInput.maxLength = DESCRIPTION_MAX_LENGTH;
    descInput.rows = 4;
    descInput.id = "jklm-ext-desc-input";
    descInput.addEventListener("input", () => {
      const val = descInput.value;
      descCounter.textContent = val.length + "/" + DESCRIPTION_MAX_LENGTH;
      const trimmed = val.trim();
      if (profileDescEl) {
        profileDescEl.textContent =
          trimmed.slice(0, PANEL_DESCRIPTION_PREVIEW_LENGTH) || "No description yet";
      }
      if (previewDescEl) {
        previewDescEl.textContent = trimmed || "No description yet";
      }
    });
    descRow.appendChild(descInput);
    formDescInput = descInput;
    formDescCounter = descCounter;

    form.appendChild(userIdSection);
    form.appendChild(picRow);
    form.appendChild(nameRow);
    form.appendChild(rolesRow);
    form.appendChild(statusRow);
    form.appendChild(descRow);

    container.appendChild(form);
  }

  function buildFriendsTab(container) {
    const wrap = document.createElement("div");
    wrap.className = "jklm-ext-friends-tab";

    const subTabBar = document.createElement("div");
    subTabBar.className = "jklm-ext-subtabs";

    const subContent = document.createElement("div");
    subContent.className = "jklm-ext-subtab-content";

    const subTabs = ["Add", "Blocked", "DMs", "Info"];

    subTabs.forEach((subName, i) => {
      const key = subName.toLowerCase();

      const subBtn = document.createElement("button");
      subBtn.className = "jklm-ext-subtab" + (i === 0 ? " active" : "");
      subBtn.textContent = subName;
      subBtn.dataset.subtab = key;

      const subPanel = document.createElement("div");
      subPanel.className = "jklm-ext-subtab-panel" + (i === 0 ? " active" : "");
      subPanel.dataset.subtabPanel = key;

      if (key === "add") {
        buildFriendsAddPanel(subPanel);
      } else if (key === "blocked") {
        buildFriendsBlockedPanel(subPanel);
      } else if (key === "dms") {
        buildFriendsDMsPanel(subPanel);
      } else if (key === "info") {
        buildFriendsInfoPanel(subPanel);
      }

      subBtn.addEventListener("click", () => {
        if (key !== "dms") leaveActiveConversation();
        subTabBar
          .querySelectorAll(".jklm-ext-subtab")
          .forEach((b) => b.classList.remove("active"));
        subContent
          .querySelectorAll(".jklm-ext-subtab-panel")
          .forEach((p) => p.classList.remove("active"));
        subBtn.classList.add("active");
        subPanel.classList.add("active");
      });

      subTabBar.appendChild(subBtn);
      subContent.appendChild(subPanel);
    });

    wrap.appendChild(subTabBar);
    wrap.appendChild(subContent);
    container.appendChild(wrap);
  }

  function buildFriendsAddPanel(container) {
    const form = document.createElement("div");
    form.className = "jklm-ext-profile-form";

    const addRow = buildFormRow("Add friend by User ID");
    const inputWrap = document.createElement("div");
    inputWrap.className = "jklm-ext-add-friend-row";

    const idInput = document.createElement("input");
    idInput.type = "text";
    idInput.placeholder = "Paste a User ID...";
    idInput.className = "jklm-ext-input";

    const addBtn = document.createElement("button");
    addBtn.className = "jklm-ext-btn jklm-ext-btn-primary";
    addBtn.textContent = "Send request";

    inputWrap.appendChild(idInput);
    inputWrap.appendChild(addBtn);
    addRow.appendChild(inputWrap);

    const feedback = document.createElement("div");
    feedback.className = "jklm-ext-settings-hint";
    feedback.style.marginTop = "6px";

    const requestsLabel = document.createElement("div");
    requestsLabel.className = "jklm-ext-userid-label";
    requestsLabel.style.marginTop = "18px";
    requestsLabel.textContent = "Friend requests";

    const requestsWrap = document.createElement("div");
    requestsWrap.className = "jklm-ext-friend-list";

    const listLabel = document.createElement("div");
    listLabel.className = "jklm-ext-userid-label";
    listLabel.style.marginTop = "18px";
    listLabel.textContent = "Your friends";

    const listWrap = document.createElement("div");
    listWrap.className = "jklm-ext-friend-list";

    function renderFriends(list) {
      listWrap.innerHTML = "";
      if (!list.length) {
        const empty = document.createElement("div");
        empty.className = "jklm-ext-settings-hint";
        empty.textContent = "No friends added yet.";
        listWrap.appendChild(empty);
        return;
      }

      // Load the registry once for the whole list instead of once per row —
      // this way all buttons render immediately, without a delayed pop-in.
      loadUserRegistry().then((registry) => {
        const registryById = new Map(registry.map((entry) => [entry.id, entry]));
        const fragment = document.createDocumentFragment();

        list.forEach((id) => {
          const row = document.createElement("div");
          row.className = "jklm-ext-friend-row";

          const userRecord = registryById.get(id);

          const idSpan = document.createElement("span");
          idSpan.className = "jklm-ext-friend-id";
          idSpan.textContent = (userRecord && userRecord.name) ? userRecord.name : id;
          idSpan.title = id;

          if (!userRecord || !userRecord.name) {
            ensureUserProfile(id).then((profile) => {
              if (profile) renderFriends(list);
            });
          }

          const actionsWrap = document.createElement("div");
          actionsWrap.style.display = "flex";
          actionsWrap.style.gap = "6px";

          const viewProfileBtn = document.createElement("button");
          viewProfileBtn.className = "jklm-ext-userid-copy-btn";
          viewProfileBtn.textContent = "View Profile";
          viewProfileBtn.addEventListener("click", () => {
            // Always hits the server (not just the cached registry entry)
            // so friendStats — messages, last active, shared chats — comes
            // back along with the rest of the profile.
            ensureUserProfile(id).then((profile) => {
              if (profile) showUserProfilePreview(profile);
            });
          });
          actionsWrap.appendChild(viewProfileBtn);

          const isBanned = Boolean(userRecord && userRecord.banned);

          if (isBanned) {
            const unbanBtn = document.createElement("button");
            unbanBtn.className = "jklm-ext-userid-copy-btn";
            unbanBtn.textContent = "Unban";
            unbanBtn.addEventListener("click", () => {
              loadUserRegistry().then((currentRegistry) => {
                const withoutCurrent = currentRegistry.filter((entry) => entry.id !== id);
                const roleSet = new Set(userRecord && Array.isArray(userRecord.roles) ? userRecord.roles : ['user']);
                roleSet.delete('banned');
                const updatedRecord = {
                  id,
                  name: userRecord ? userRecord.name : id,
                  roles: Array.from(roleSet),
                  status: userRecord ? userRecord.status : 'online',
                  description: userRecord ? userRecord.description : '',
                  banned: false,
                  banReason: ''
                };
                saveUserRegistry([...withoutCurrent, updatedRecord]).then(() => renderFriends(list));
              });
            });
            actionsWrap.appendChild(unbanBtn);
          } else {
            const bannedHint = document.createElement("span");
            bannedHint.className = "jklm-ext-friend-ban-hint";
            bannedHint.textContent = "Ban via Admin panel";
            actionsWrap.appendChild(bannedHint);
          }

          const removeBtn = document.createElement("button");
          removeBtn.className = "jklm-ext-userid-copy-btn";
          removeBtn.textContent = "Remove";
          removeBtn.addEventListener("click", () => {
            loadFriendsList().then((current) => {
              const updated = current.filter((f) => f !== id);
              saveFriendsList(updated).then(() => renderFriends(updated));
            });
          });

          actionsWrap.appendChild(removeBtn);
          row.appendChild(idSpan);
          row.appendChild(actionsWrap);
          fragment.appendChild(row);
        });

        listWrap.appendChild(fragment);
      });
    }

    function renderRequests(list) {
      requestsWrap.innerHTML = "";
      const incoming = list.filter((request) => request.to === userId && request.status === "pending");
      const outgoing = list.filter((request) => request.from === userId && request.status === "pending");

      if (!incoming.length && !outgoing.length) {
        const empty = document.createElement("div");
        empty.className = "jklm-ext-settings-hint";
        empty.textContent = "No pending requests.";
        requestsWrap.appendChild(empty);
        return;
      }

      loadUserRegistry().then((registry) => {
        const registryById = new Map(registry.map((entry) => [entry.id, entry]));

        const renderRequestRow = (request, type) => {
          const targetId = type === "incoming" ? request.from : request.to;
          const targetRecord = registryById.get(targetId);

          if (!targetRecord || !targetRecord.name) {
            ensureUserProfile(targetId).then((profile) => {
              if (profile) renderRequests(list);
            });
          }

          const row = document.createElement("div");
          row.className = "jklm-ext-friend-row";

          const idSpan = document.createElement("span");
          idSpan.className = "jklm-ext-friend-id";
          idSpan.textContent = (targetRecord && targetRecord.name) ? targetRecord.name : targetId;
          idSpan.title = targetId;

          const actionsWrap = document.createElement("div");
          actionsWrap.style.display = "flex";
          actionsWrap.style.gap = "6px";

          if (type === "incoming") {
            const acceptBtn = document.createElement("button");
            acceptBtn.className = "jklm-ext-btn jklm-ext-btn-primary";
            acceptBtn.textContent = "Accept";
            acceptBtn.addEventListener("click", () => {
              loadFriendRequests().then((current) => {
                const pairKey = [request.from, request.to].sort().join("::");
                const updated = current.map((entry) => {
                  const entryPairKey = [entry.from, entry.to].sort().join("::");
                  if (entryPairKey === pairKey && entry.status === "pending") {
                    return { ...entry, status: "accepted", acceptedAt: Date.now() };
                  }
                  return entry;
                });
                saveFriendRequests(updated).then(() => {
                  loadFriendsList().then((friends) => {
                    const targetId = request.from;
                    const updatedFriends = friends.includes(targetId) ? friends : [...friends, targetId];
                    saveFriendsList(updatedFriends).then(() => {
                      ensureKnownUser(request.from);
                      ensureKnownUser(request.to);
                      feedback.textContent = "Friend request accepted.";
                      renderFriends(updatedFriends);
                      renderRequests(updated);
                      sendWS({ type: "respond_friend_request", from: request.from, accept: true });
                    });
                  });
                });
              });
            });

            const declineBtn = document.createElement("button");
            declineBtn.className = "jklm-ext-userid-copy-btn";
            declineBtn.textContent = "Decline";
            declineBtn.addEventListener("click", () => {
              loadFriendRequests().then((current) => {
                const pairKey = [request.from, request.to].sort().join("::");
                const updated = current.filter((entry) => {
                  const entryPairKey = [entry.from, entry.to].sort().join("::");
                  return entryPairKey !== pairKey || entry.status !== "pending";
                });
                saveFriendRequests(updated).then(() => {
                  feedback.textContent = "Friend request declined.";
                  renderRequests(updated);
                  sendWS({ type: "respond_friend_request", from: request.from, accept: false });
                });
              });
            });

            actionsWrap.appendChild(acceptBtn);
            actionsWrap.appendChild(declineBtn);
          } else {
            const pendingText = document.createElement("span");
            pendingText.className = "jklm-ext-settings-hint";
            pendingText.textContent = "Pending";
            actionsWrap.appendChild(pendingText);
          }

          row.appendChild(idSpan);
          row.appendChild(actionsWrap);
          requestsWrap.appendChild(row);
        };

        incoming.forEach((request) => renderRequestRow(request, "incoming"));
        outgoing.forEach((request) => renderRequestRow(request, "outgoing"));
      });
    }

    addBtn.addEventListener("click", () => {
      const value = idInput.value.trim();
      feedback.textContent = "";
      if (!value) return;
      if (userId && value === userId) {
        feedback.textContent = "You can't add yourself.";
        return;
      }

      wsRequest("lookup_user", { userId: value }).then((lookupRes) => {
        const knownCheck = lookupRes
          ? Promise.resolve(lookupRes.found)
          : loadKnownUsers().then((knownUsers) => knownUsers.includes(value));

        knownCheck.then((isKnown) => {
          if (!isKnown) {
            feedback.textContent = "This user ID is not known yet.";
            return;
          }

          loadBlockedList().then((blocked) => {
            if (blocked.includes(value)) {
              feedback.textContent = "This user is blocked.";
              return;
            }

            loadFriendsList().then((friends) => {
              if (friends.includes(value)) {
                feedback.textContent = "Already in your friends list.";
                return;
              }

              loadFriendRequests().then((requests) => {
                const existingPending = requests.find((request) => {
                  if (request.status !== "pending") return false;
                  return (request.from === userId && request.to === value) || (request.from === value && request.to === userId);
                });

                if (existingPending) {
                  feedback.textContent = existingPending.from === userId ? "Friend request already sent." : "This user already sent you a request.";
                  return;
                }

                const request = {
                  id: `${userId}-${value}-${Date.now()}`,
                  from: userId,
                  to: value,
                  status: "pending",
                  createdAt: Date.now()
                };

                const updatedRequests = [...requests, request];
                saveFriendRequests(updatedRequests).then(() => {
                  idInput.value = "";
                  feedback.textContent = "Friend request sent.";
                  renderRequests(updatedRequests);
                  sendWS({ type: "friend_request", to: value });
                });
              });
            });
          });
        });
      });
    });

    idInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addBtn.click();
      }
    });

    form.appendChild(addRow);
    form.appendChild(feedback);
    form.appendChild(requestsLabel);
    form.appendChild(requestsWrap);
    form.appendChild(listLabel);
    form.appendChild(listWrap);
    container.appendChild(form);

    loadFriendsList().then(renderFriends);
    loadFriendRequests().then(renderRequests);

    // Keep this panel live: re-render the moment a request/friends update
    // arrives over the socket, instead of only picking it up on next open.
    const liveUpdateListener = (kind, value) => {
      if (kind === "friend_requests") renderRequests(value);
      else if (kind === "friends_list") renderFriends(value);
      else if (kind === "profile_updated") {
        loadFriendsList().then(renderFriends);
        loadFriendRequests().then(renderRequests);
      }
    };
    dmMessageListeners.add(liveUpdateListener);

    // Pull anything the server knows about that arrived while we were
    // offline (requests sent to us, or friendships confirmed elsewhere).
    //
    // Also reconciles the opposite case, which is the source of a bug
    // where an outgoing request kept showing "Pending" forever after it
    // was actually accepted: friend_request_resolved is only ever pushed
    // live to a connected socket, so if we were offline at the moment the
    // other person accepted/declined, we never got that event and our
    // locally-cached copy stayed stuck on "pending". The server's pending
    // list is authoritative, so anything we still have marked "pending"
    // that the server no longer lists as pending has been resolved
    // elsewhere — drop it locally too (checking the confirmed friends
    // list to tell an acceptance apart from a decline).
    Promise.all([wsRequest("get_friend_requests", {}), wsRequest("get_friends", {})]).then(
      ([requestsRes, friendsRes]) => {
        const serverPending = (requestsRes && requestsRes.requests) || [];
        const serverFriends = (friendsRes && friendsRes.friends) || [];

        loadFriendRequests().then((current) => {
          let changed = false;

          const reconciled = current.map((r) => {
            if (r.status !== "pending" || (r.from !== userId && r.to !== userId)) return r;
            const stillPending = serverPending.some((s) => s.from === r.from && s.to === r.to);
            if (stillPending) return r;
            const otherId = r.from === userId ? r.to : r.from;
            changed = true;
            return { ...r, status: serverFriends.includes(otherId) ? "accepted" : "declined" };
          });

          serverPending.forEach((r) => {
            const exists = reconciled.some(
              (m) => m.from === r.from && m.to === r.to && m.status === "pending"
            );
            if (!exists) {
              reconciled.push(r);
              changed = true;
            }
          });

          if (changed) {
            saveFriendRequests(reconciled).then(() => renderRequests(reconciled));
          }
        });

        loadFriendsList().then((current) => {
          const merged = Array.from(new Set([...current, ...serverFriends]));
          if (merged.length !== current.length) {
            saveFriendsList(merged).then(() => renderFriends(merged));
          }
        });
      }
    );
  }

  function buildFriendsBlockedPanel(container) {
    const form = document.createElement("div");
    form.className = "jklm-ext-profile-form";

    const blockRow = buildFormRow("Block a user by ID");
    const inputWrap = document.createElement("div");
    inputWrap.className = "jklm-ext-add-friend-row";

    const idInput = document.createElement("input");
    idInput.type = "text";
    idInput.placeholder = "Paste a User ID...";
    idInput.className = "jklm-ext-input";

    const blockBtn = document.createElement("button");
    blockBtn.className = "jklm-ext-btn jklm-ext-btn-secondary";
    blockBtn.textContent = "Block";

    inputWrap.appendChild(idInput);
    inputWrap.appendChild(blockBtn);
    blockRow.appendChild(inputWrap);

    const feedback = document.createElement("div");
    feedback.className = "jklm-ext-settings-hint";
    feedback.style.marginTop = "6px";

    const listLabel = document.createElement("div");
    listLabel.className = "jklm-ext-userid-label";
    listLabel.style.marginTop = "18px";
    listLabel.textContent = "Blocked users";

    const listWrap = document.createElement("div");
    listWrap.className = "jklm-ext-friend-list";

    function renderBlocked(list) {
      listWrap.innerHTML = "";
      if (!list.length) {
        const empty = document.createElement("div");
        empty.className = "jklm-ext-settings-hint";
        empty.textContent = "No blocked users.";
        listWrap.appendChild(empty);
        return;
      }
      list.forEach((id) => {
        const row = document.createElement("div");
        row.className = "jklm-ext-friend-row";

        const idSpan = document.createElement("span");
        idSpan.className = "jklm-ext-friend-id";
        idSpan.textContent = id;

        const unblockBtn = document.createElement("button");
        unblockBtn.className = "jklm-ext-userid-copy-btn";
        unblockBtn.textContent = "Unblock";
        unblockBtn.addEventListener("click", () => {
          loadBlockedList().then((current) => {
            const updated = current.filter((f) => f !== id);
            saveBlockedList(updated).then(() => renderBlocked(updated));
          });
        });

        row.appendChild(idSpan);
        row.appendChild(unblockBtn);
        listWrap.appendChild(row);
      });
    }

    blockBtn.addEventListener("click", () => {
      const value = idInput.value.trim();
      feedback.textContent = "";
      if (!value) return;
      if (userId && value === userId) {
        feedback.textContent = "You can't block yourself.";
        return;
      }

      wsRequest("lookup_user", { userId: value }).then((lookupRes) => {
        const knownCheck = lookupRes
          ? Promise.resolve(lookupRes.found)
          : loadKnownUsers().then((knownUsers) => knownUsers.includes(value));

        knownCheck.then((isKnown) => {
          if (!isKnown) {
            feedback.textContent = "This user ID is not known yet.";
            return;
          }

          loadBlockedList().then((current) => {
            if (current.includes(value)) {
              feedback.textContent = "Already blocked.";
              return;
            }
            const updated = [...current, value];
            saveBlockedList(updated).then(() => {
              idInput.value = "";
              renderBlocked(updated);
            });

            loadFriendRequests().then((requests) => {
              const updatedRequests = requests.filter((request) => {
                if (request.status !== "pending") return true;
                return !(request.from === value && request.to === userId) && !(request.from === userId && request.to === value);
              });
              saveFriendRequests(updatedRequests);
            });

            loadFriendsList().then((friends) => {
              if (friends.includes(value)) {
                saveFriendsList(friends.filter((f) => f !== value));
              }
            });
          });
        });
      });
    });

    idInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        blockBtn.click();
      }
    });

    form.appendChild(blockRow);
    form.appendChild(feedback);
    form.appendChild(listLabel);
    form.appendChild(listWrap);
    container.appendChild(form);

    loadBlockedList().then(renderBlocked);
  }

  function showUserProfilePreview(profile) {
    const existing = document.getElementById("jklm-ext-profile-preview-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "jklm-ext-profile-preview-overlay";
    overlay.className = "jklm-ext-config-overlay jklm-ext-profile-preview-overlay";

    const closeBtn = document.createElement("button");
    closeBtn.className = "jklm-ext-config-close";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => overlay.remove());

    const wrap = document.createElement("div");
    wrap.className = "jklm-ext-preview-tab jklm-ext-profile-preview-modal";

    const card = document.createElement("div");
    card.className = "jklm-ext-preview-card";
    if (profile.banned) {
      card.classList.add("jklm-ext-banned");
    }

    const banner = document.createElement("div");
    banner.className = "jklm-ext-preview-banner";
    banner.style.backgroundImage = `url(${profile.bannerUrl || DEFAULT_BANNER})`;
    banner.style.backgroundSize = "cover";
    banner.style.backgroundPosition = "center";
    banner.style.backgroundRepeat = "no-repeat";

    const body = document.createElement("div");
    body.className = "jklm-ext-preview-body";

    const avatarWrap = document.createElement("div");
    avatarWrap.className = "jklm-ext-preview-avatar-wrap";

    const avatarImg = document.createElement("img");
    avatarImg.className = "jklm-ext-preview-avatar";
    avatarImg.src = profile.avatarUrl || DEFAULT_AVATAR;
    avatarImg.alt = profile.name;

    const statusRing = document.createElement("span");
    statusRing.className = "jklm-ext-preview-status-dot-ring";
    const statusDot = document.createElement("span");
    statusDot.className = "jklm-ext-preview-status-dot";
    statusDot.style.setProperty("--jklm-ext-status-color", getStatusColor(profile.status));
    statusRing.appendChild(statusDot);

    avatarWrap.appendChild(avatarImg);
    avatarWrap.appendChild(statusRing);

    const nameEl = document.createElement("div");
    nameEl.className = "jklm-ext-preview-name";
    nameEl.textContent = profile.name || profile.id;

    const statusOpt = STATUS_OPTIONS.find((o) => o.value === profile.status) || STATUS_OPTIONS[0];
    const statusTextEl = document.createElement("div");
    statusTextEl.className = "jklm-ext-preview-status-text";
    statusTextEl.style.setProperty("--jklm-ext-status-color", statusOpt.color);
    statusTextEl.textContent = statusOpt.label;

    const rolesWrap = document.createElement("div");
    rolesWrap.className = "jklm-ext-preview-roles";
    const roles = Array.isArray(profile.roles) ? profile.roles : [];
    if (roles.length) {
      ROLE_DEFINITIONS.filter((roleDef) => roles.includes(roleDef.id)).forEach((roleDef) => {
        const badge = document.createElement("span");
        badge.className = "jklm-ext-role-badge";
        badge.style.color = roleDef.color;
        badge.textContent = roleDef.label;
        rolesWrap.appendChild(badge);
      });
    } else {
      const hint = document.createElement("span");
      hint.className = "jklm-ext-roles-hint";
      hint.textContent = "No roles yet";
      rolesWrap.appendChild(hint);
    }

    const divider = document.createElement("div");
    divider.className = "jklm-ext-preview-divider";

    const descLabel = document.createElement("div");
    descLabel.className = "jklm-ext-preview-desc-label";
    descLabel.textContent = "About";

    const descEl = document.createElement("div");
    descEl.className = "jklm-ext-preview-desc";
    descEl.textContent = (profile.description || "").trim() || "No description yet";

    body.appendChild(avatarWrap);
    body.appendChild(nameEl);
    body.appendChild(statusTextEl);
    body.appendChild(rolesWrap);

    if (profile.banned) {
      const bannedNotice = document.createElement("div");
      bannedNotice.className = "jklm-ext-preview-banned-notice";

      const bannedTitle = document.createElement("strong");
      bannedTitle.textContent = "🚫 This user is banned";
      bannedNotice.appendChild(bannedTitle);

      const bannedReason = document.createElement("span");
      bannedReason.textContent = profile.banReason
        ? "Reason: " + profile.banReason
        : "No reason was given.";
      bannedNotice.appendChild(bannedReason);

      body.appendChild(bannedNotice);
    }

    body.appendChild(divider);
    body.appendChild(descLabel);
    body.appendChild(descEl);

    // mutualFriends only arrives from a fresh server lookup (see
    // ensureUserProfile) — omit the section entirely rather than show a
    // misleading "no mutual friends" for a profile we only have cached.
    if (Array.isArray(profile.mutualFriends)) {
      const mutualDivider = document.createElement("div");
      mutualDivider.className = "jklm-ext-preview-divider";

      const mutualLabel = document.createElement("div");
      mutualLabel.className = "jklm-ext-preview-desc-label";
      mutualLabel.textContent =
        "Mutual Friends" + (profile.mutualFriends.length ? " (" + profile.mutualFriends.length + ")" : "");

      body.appendChild(mutualDivider);
      body.appendChild(mutualLabel);

      if (profile.mutualFriends.length) {
        const mutualList = document.createElement("div");
        mutualList.className = "jklm-ext-preview-mutual-list";
        profile.mutualFriends.forEach((mf) => {
          const chip = document.createElement("div");
          chip.className = "jklm-ext-preview-mutual-chip";

          const chipAvatar = document.createElement("img");
          chipAvatar.className = "jklm-ext-preview-mutual-avatar";
          chipAvatar.src = mf.avatarUrl || DEFAULT_AVATAR;
          chipAvatar.alt = mf.name || mf.id;

          const chipName = document.createElement("span");
          chipName.textContent = mf.name || mf.id;

          chip.appendChild(chipAvatar);
          chip.appendChild(chipName);
          mutualList.appendChild(chip);
        });
        body.appendChild(mutualList);
      } else {
        const mutualEmpty = document.createElement("span");
        mutualEmpty.className = "jklm-ext-roles-hint";
        mutualEmpty.textContent = "No mutual friends";
        body.appendChild(mutualEmpty);
      }
    }

    // friendStats only arrives from a fresh server lookup, and only when
    // the server considers this user a confirmed friend of the viewer (see
    // lookup_user) — omitted entirely otherwise, same reasoning as
    // mutualFriends above.
    if (profile.friendStats) {
      const statsDivider = document.createElement("div");
      statsDivider.className = "jklm-ext-preview-divider";

      const statsLabel = document.createElement("div");
      statsLabel.className = "jklm-ext-preview-desc-label";
      statsLabel.textContent = "Friend Statistics";

      const statsList = document.createElement("div");
      statsList.className = "jklm-ext-preview-stats-list";

      const messageCount = Number(profile.friendStats.messageCount) || 0;
      const sharedGroups = Array.isArray(profile.friendStats.sharedGroups)
        ? profile.friendStats.sharedGroups
        : [];

      function addStatRow(label, valueText) {
        const row = document.createElement("div");
        row.className = "jklm-ext-preview-stat-row";

        const rowLabel = document.createElement("span");
        rowLabel.className = "jklm-ext-preview-stat-label";
        rowLabel.textContent = label;

        const rowValue = document.createElement("span");
        rowValue.className = "jklm-ext-preview-stat-value";
        rowValue.textContent = valueText;

        row.appendChild(rowLabel);
        row.appendChild(rowValue);
        statsList.appendChild(row);
      }

      addStatRow("Messages", messageCount === 1 ? "1 message" : messageCount + " messages");
      addStatRow("Last active", formatRelativeTime(profile.friendStats.lastActive));
      addStatRow(
        "Shared chats",
        sharedGroups.length === 1 ? "1 group chat" : sharedGroups.length + " group chats"
      );

      body.appendChild(statsDivider);
      body.appendChild(statsLabel);
      body.appendChild(statsList);

      if (sharedGroups.length) {
        const sharedList = document.createElement("div");
        sharedList.className = "jklm-ext-preview-shared-list";
        sharedGroups.forEach((g) => {
          const chip = document.createElement("span");
          chip.className = "jklm-ext-preview-shared-chip";
          chip.textContent = g.name || g.id;
          sharedList.appendChild(chip);
        });
        body.appendChild(sharedList);
      }
    }

    card.appendChild(banner);
    card.appendChild(body);

    const idHint = document.createElement("p");
    idHint.className = "jklm-ext-preview-hint";
    idHint.textContent = "User ID: " + profile.id;

    wrap.appendChild(card);
    wrap.appendChild(idHint);

    overlay.appendChild(closeBtn);
    overlay.appendChild(wrap);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  // Builds a link that, when opened by anyone on this site, pops open a
  // read-only preview of the given user's profile (see
  // checkSharedProfileLink). Strips any query string already on the page
  // first so re-sharing a link someone sent you doesn't chain params.
  function buildProfileShareUrl(id) {
    let url;
    try {
      url = new URL(location.origin + location.pathname);
    } catch (e) {
      url = new URL(location.href);
    }
    url.searchParams.set("jklmProfile", id);
    return url.toString();
  }

  // Runs once, after the WS connection is up (so ensureUserProfile's
  // lookup_user request can actually resolve). If the page was opened via
  // a profile share link, shows that profile and then scrubs the param
  // from the URL so refreshing/reconnecting doesn't reopen it.
  function checkSharedProfileLink() {
    if (sharedProfileLinkChecked) return;
    sharedProfileLinkChecked = true;

    let sharedId = null;
    try {
      sharedId = new URL(location.href).searchParams.get("jklmProfile");
    } catch (e) {
      return;
    }
    if (!sharedId) return;

    if (sharedId === userId) {
      // You opened your own share link (e.g. testing it, or clicking it in
      // the same browser it was created in). ensureUserProfile() always
      // resolves to null for your own id (it's meant for looking up other
      // people), so build the preview from local profile data instead of
      // silently doing nothing.
      loadProfileData().then((data) => {
        showUserProfilePreview({
          id: userId,
          name: (data.name || "").trim() || userId,
          roles: Array.isArray(data.roles) ? data.roles : currentUserRoles,
          status: data.status,
          description: data.description,
          avatarUrl: data.avatarUrl,
          bannerUrl: data.bannerUrl,
          banned: false
        });
      });
    } else {
      ensureUserProfile(sharedId).then((profile) => {
        if (profile) showUserProfilePreview(profile);
      });
    }

    try {
      const cleanUrl = new URL(location.href);
      cleanUrl.searchParams.delete("jklmProfile");
      history.replaceState(null, "", cleanUrl.toString());
    } catch (e) {
      /* noop */
    }
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Renders a PNG of the profile card (banner, avatar, name, status, role
  // badges, about text) purely with Canvas 2D — no external screenshot
  // library is available to this extension. Images are loaded with
  // crossOrigin="anonymous" so a host without CORS headers simply fails to
  // load (falls back to a solid color) instead of silently tainting the
  // canvas and breaking toDataURL for everyone.
  function renderProfileCardToPng(data) {
    const width = 420;
    const height = 560;
    const bannerHeight = 150;
    const avatarSize = 96;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    function loadImage(src) {
      return new Promise((resolve) => {
        if (!src) {
          resolve(null);
          return;
        }
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
      });
    }

    function drawCover(img, x, y, w, h) {
      if (!img || !img.width || !img.height) return;
      const scale = Math.max(w / img.width, h / img.height);
      const sw = w / scale;
      const sh = h / scale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    }

    function wrapText(text, x, y, maxWidth, lineHeight) {
      const words = text.split(/\s+/);
      let line = "";
      let cy = y;
      words.forEach((word) => {
        const test = line ? line + " " + word : word;
        if (line && ctx.measureText(test).width > maxWidth) {
          ctx.fillText(line, x, cy);
          line = word;
          cy += lineHeight;
        } else {
          line = test;
        }
      });
      if (line) ctx.fillText(line, x, cy);
      return cy + lineHeight;
    }

    return Promise.all([loadImage(data.bannerUrl), loadImage(data.avatarUrl)]).then(
      ([bannerImg, avatarImg]) => {
        ctx.fillStyle = "#17181c";
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        roundRectPath(ctx, 0, 0, width, height, 16);
        ctx.clip();

        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width, bannerHeight);
        ctx.clip();
        if (bannerImg) {
          drawCover(bannerImg, 0, 0, width, bannerHeight);
        } else {
          ctx.fillStyle = "#2d3748";
          ctx.fillRect(0, 0, width, bannerHeight);
        }
        ctx.restore();

        const avatarX = width / 2;
        const avatarY = bannerHeight;

        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2 + 4, 0, Math.PI * 2);
        ctx.fillStyle = "#17181c";
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();
        if (avatarImg) {
          drawCover(avatarImg, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
        } else {
          ctx.fillStyle = "#3d4f66";
          ctx.fillRect(avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
        }
        ctx.restore();

        const statusOpt = STATUS_OPTIONS.find((o) => o.value === data.status) || STATUS_OPTIONS[0];
        const dotX = avatarX + avatarSize / 2 - 8;
        const dotY = avatarY + avatarSize / 2 - 8;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 10, 0, Math.PI * 2);
        ctx.fillStyle = "#17181c";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(dotX, dotY, 6.5, 0, Math.PI * 2);
        ctx.fillStyle = statusOpt.color;
        ctx.fill();

        let cursorY = avatarY + avatarSize / 2 + 34;

        ctx.textAlign = "center";
        ctx.fillStyle = "#ffffff";
        ctx.font = "700 21px 'Segoe UI', Arial, sans-serif";
        ctx.fillText(data.name, avatarX, cursorY);
        cursorY += 24;

        ctx.font = "500 13px 'Segoe UI', Arial, sans-serif";
        ctx.fillStyle = statusOpt.color;
        ctx.fillText(statusOpt.label, avatarX, cursorY);
        cursorY += 28;

        const roles = (Array.isArray(data.roles) ? data.roles : []).filter((r) => r !== "user");
        const badgeDefs = ROLE_DEFINITIONS.filter((rd) => roles.includes(rd.id));
        if (badgeDefs.length) {
          ctx.font = "600 11px 'Segoe UI', Arial, sans-serif";
          const paddingX = 10;
          const gap = 8;
          const badgeHeight = 22;
          const widths = badgeDefs.map((b) => ctx.measureText(b.label).width + paddingX * 2);
          const totalWidth = widths.reduce((a, b) => a + b, 0) + gap * (widths.length - 1);
          let bx = avatarX - totalWidth / 2;
          badgeDefs.forEach((b, i) => {
            const w = widths[i];
            ctx.fillStyle = b.color + "33";
            roundRectPath(ctx, bx, cursorY - badgeHeight / 2, w, badgeHeight, 11);
            ctx.fill();
            ctx.fillStyle = b.color;
            ctx.textAlign = "center";
            ctx.fillText(b.label, bx + w / 2, cursorY + 4);
            bx += w + gap;
          });
          cursorY += badgeHeight + 22;
        } else {
          cursorY += 4;
        }

        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.beginPath();
        ctx.moveTo(30, cursorY);
        ctx.lineTo(width - 30, cursorY);
        ctx.stroke();
        cursorY += 26;

        ctx.textAlign = "left";
        ctx.fillStyle = "#666666";
        ctx.font = "700 11px 'Segoe UI', Arial, sans-serif";
        ctx.fillText("ABOUT", 30, cursorY);
        cursorY += 22;

        ctx.fillStyle = "#cccccc";
        ctx.font = "400 14px 'Segoe UI', Arial, sans-serif";
        wrapText(data.description, 30, cursorY, width - 60, 20);

        ctx.restore();

        try {
          return canvas.toDataURL("image/png");
        } catch (e) {
          throw e;
        }
      }
    );
  }

  const GROUP_ICON = "data:image/svg+xml;utf8," + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<circle cx="32" cy="32" r="32" fill="#3d4f66"/>' +
    '<circle cx="23" cy="26" r="9" fill="#cfd8e0"/>' +
    '<circle cx="43" cy="26" r="9" fill="#a9b6c6"/>' +
    '<path d="M6 54c2-11 10-17 17-17s10 3 12 6c2-3 5-6 12-6s15 6 17 17" fill="#cfd8e0"/>' +
    "</svg>"
  );

  // Shared by both the DM search box and the per-conversation message search
  // (used inside individual chat views) — case-insensitive substring match,
  // wraps the hit in a <mark> after escaping the rest of the text.
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function highlightMatch(text, query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return escapeHtml(text);
    return (
      escapeHtml(text.slice(0, idx)) +
      "<mark class=\"jklm-ext-search-highlight\">" +
      escapeHtml(text.slice(idx, idx + query.length)) +
      "</mark>" +
      escapeHtml(text.slice(idx + query.length))
    );
  }

  // Renders a group message's text into a bubble, wrapping any "@Name"
  // substring that corresponds to one of the message's server-validated
  // mentions in a highlighted span. Longest names are matched first so
  // "@Jo" can't shadow a match inside "@John". Falls back to plain escaped
  // text for DMs / messages with no mentions.
  function renderBubbleText(bubbleText, text, mentions, names) {
    bubbleText.dataset.rawText = text;
    const mentionIds = Array.isArray(mentions) ? mentions : [];
    const tags = mentionIds
      .map((id) => ({ id, name: names && names[id] }))
      .filter((t) => t.name)
      .sort((a, b) => b.name.length - a.name.length);

    if (!tags.length) {
      bubbleText.textContent = text;
      bubbleText.dataset.formattedHtml = escapeHtml(text);
      return;
    }

    const lowerText = text.toLowerCase();
    let html = "";
    let cursor = 0;
    while (cursor < text.length) {
      const tag = tags.find((t) => lowerText.startsWith("@" + t.name.toLowerCase(), cursor));
      if (tag) {
        const raw = text.slice(cursor, cursor + tag.name.length + 1);
        html += '<span class="jklm-ext-mention">' + escapeHtml(raw) + "</span>";
        cursor += raw.length;
      } else {
        html += escapeHtml(text[cursor]);
        cursor += 1;
      }
    }
    bubbleText.innerHTML = html;
    bubbleText.dataset.formattedHtml = html;
  }

  // Filters the currently-rendered bubbles inside one open conversation
  // (DM or group) by search text, without needing to re-fetch or re-render
  // the underlying message list.
  function applyMessageSearchFilter(messagesWrap, query, noResultsHint) {
    const q = query.trim();
    let anyMatch = false;
    let anyRow = false;
    messagesWrap.querySelectorAll(".jklm-ext-dms-bubble-row").forEach((row) => {
      const bubble = row.querySelector(".jklm-ext-dms-bubble-text");
      if (!bubble) return;
      anyRow = true;
      const raw = bubble.dataset.rawText || "";
      if (!q) {
        row.style.display = "";
        // Group bubbles may carry @mention highlighting (see renderBubbleText)
        // — restore that instead of flattening back to plain escaped text.
        bubble.innerHTML = bubble.dataset.formattedHtml || escapeHtml(raw);
        return;
      }
      const matches = raw.toLowerCase().indexOf(q.toLowerCase()) !== -1;
      row.style.display = matches ? "" : "none";
      if (matches) {
        anyMatch = true;
        bubble.innerHTML = highlightMatch(raw, q);
      }
    });
    if (noResultsHint) {
      noResultsHint.style.display = q && anyRow && !anyMatch ? "block" : "none";
    }
  }

  // Searches message text across every DM and group conversation at once
  // (not just the currently-open one), for the global search field in the
  // DMs sidebar. Returns the most recent matches first, capped so a very
  // common word doesn't return thousands of rows.
  function searchAllMessages(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return Promise.resolve([]);

    return Promise.all([loadDMMessages(), loadGroupMessages(), loadUserRegistry(), loadGroupsCache()]).then(
      ([dmAll, groupAll, registry, groups]) => {
        const registryById = new Map(registry.map((r) => [r.id, r]));
        const groupsById = new Map(groups.map((g) => [g.id, g]));
        const results = [];

        Object.keys(dmAll).forEach((key) => {
          const ids = key.split("::");
          const otherId = ids.find((id) => id !== userId) || ids[0];
          (dmAll[key] || []).forEach((msg) => {
            if ((msg.text || "").toLowerCase().indexOf(q) !== -1) {
              const record = registryById.get(otherId);
              results.push({
                type: "dm",
                conversationId: otherId,
                conversationName: (record && record.name) || (otherId === SYSTEM_BOT_ID ? "Mio" : otherId),
                avatarUrl: (record && record.avatarUrl) || DEFAULT_AVATAR,
                senderName: msg.from === userId ? "You" : (record && record.name) || otherId,
                text: msg.text,
                timestamp: msg.timestamp || 0
              });
            }
          });
        });

        Object.keys(groupAll).forEach((groupId) => {
          const group = groupsById.get(groupId);
          (groupAll[groupId] || []).forEach((msg) => {
            if ((msg.text || "").toLowerCase().indexOf(q) !== -1) {
              const senderRecord = registryById.get(msg.from);
              results.push({
                type: "group",
                conversationId: groupId,
                conversationName: (group && group.name) || "Group Chat",
                avatarUrl: GROUP_ICON,
                senderName: msg.from === userId ? "You" : (senderRecord && senderRecord.name) || msg.from,
                text: msg.text,
                timestamp: msg.timestamp || 0
              });
            }
          });
        });

        results.sort((a, b) => b.timestamp - a.timestamp);
        return results.slice(0, 50);
      }
    );
  }

  function buildFriendsDMsPanel(container) {
    const wrap = document.createElement("div");
    wrap.className = "jklm-ext-dms-wrap";

    const sidebarCol = document.createElement("div");
    sidebarCol.className = "jklm-ext-dms-sidebar-col";

    const sidebarTools = document.createElement("div");
    sidebarTools.className = "jklm-ext-dms-sidebar-tools";

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "jklm-ext-input jklm-ext-dms-sidebar-search";
    searchInput.placeholder = "Search all chats...";

    const newGroupBtn = document.createElement("button");
    newGroupBtn.type = "button";
    newGroupBtn.className = "jklm-ext-btn jklm-ext-btn-secondary jklm-ext-dms-new-group-btn";
    newGroupBtn.textContent = "+ Group";
    newGroupBtn.title = "Start a new group chat";

    sidebarTools.appendChild(searchInput);
    sidebarTools.appendChild(newGroupBtn);
    sidebarTools.style.position = "relative";

    const globalSearchResults = document.createElement("div");
    globalSearchResults.className = "jklm-ext-dms-global-search-results";
    globalSearchResults.style.display = "none";
    sidebarTools.appendChild(globalSearchResults);

    const sidebar = document.createElement("div");
    sidebar.className = "jklm-ext-dms-sidebar";

    sidebarCol.appendChild(sidebarTools);
    sidebarCol.appendChild(sidebar);

    const chatArea = document.createElement("div");
    chatArea.className = "jklm-ext-dms-chat";

    let activeFriendId = null;
    let pollInterval = null;
    let closeOpenMenu = null;
    let currentChatListener = null;

    function setUnreadBadge(friendId, count) {
      const item = sidebar.querySelector('[data-friend-id="' + CSS.escape(friendId) + '"]');
      if (!item) return;
      const mainRow = item.querySelector(".jklm-ext-dms-friend-item-main");
      let badge = item.querySelector(".jklm-ext-dms-unread-badge");
      if (!count) {
        if (badge) badge.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "jklm-ext-dms-unread-badge";
        if (mainRow) mainRow.appendChild(badge);
      }
      badge.textContent = count > 9 ? "9+" : String(count);
    }

    const unreadListener = (kind, value, friendId) => {
      if (kind === "unread") setUnreadBadge(friendId, value);
    };
    dmMessageListeners.add(unreadListener);

    const friendsListListener = (kind, value) => {
      if (
        kind === "friends_list" ||
        kind === "profile_updated" ||
        kind === "groups_list" ||
        kind === "presence_update"
      ) {
        loadFriendsList().then(renderSidebar);
      }
    };
    dmMessageListeners.add(friendsListListener);

    function applySidebarSearch() {
      const q = searchInput.value.trim().toLowerCase();
      sidebar.querySelectorAll("[data-search-name]").forEach((el) => {
        const name = el.dataset.searchName || "";
        el.style.display = !q || name.indexOf(q) !== -1 ? "" : "none";
      });
    }

    function renderGlobalSearchResults(results, query) {
      globalSearchResults.innerHTML = "";
      if (!results.length) {
        const empty = document.createElement("div");
        empty.className = "jklm-ext-global-search-empty";
        empty.textContent = "No messages match your search.";
        globalSearchResults.appendChild(empty);
        globalSearchResults.style.display = "block";
        return;
      }

      results.forEach((result) => {
        const row = document.createElement("div");
        row.className = "jklm-ext-global-search-result";

        const avatar = document.createElement("img");
        avatar.className = "jklm-ext-global-search-result-avatar";
        avatar.src = result.avatarUrl;
        avatar.alt = result.conversationName;

        const body = document.createElement("div");
        body.className = "jklm-ext-global-search-result-body";

        const meta = document.createElement("div");
        meta.className = "jklm-ext-global-search-result-meta";
        meta.textContent =
          result.type === "group"
            ? result.conversationName + " · " + result.senderName
            : result.conversationName;

        const snippet = document.createElement("div");
        snippet.className = "jklm-ext-global-search-result-snippet";
        snippet.innerHTML = highlightMatch(result.text, query);

        body.appendChild(meta);
        body.appendChild(snippet);
        row.appendChild(avatar);
        row.appendChild(body);

        row.addEventListener("click", () => {
          globalSearchResults.style.display = "none";
          searchInput.value = "";
          applySidebarSearch();

          const target = sidebar.querySelector(
            '[data-friend-id="' + CSS.escape(result.conversationId) + '"] .jklm-ext-dms-friend-item-main'
          );
          if (target) target.click();

          // Jump to the matching message by reusing the per-conversation
          // search bar — opens it (if not already) and fills in the same
          // query, which filters/highlights the hit inside the now-open
          // chat. Small delay since openChat/openGroupChat build the chat
          // header synchronously, but the message list itself loads async.
          setTimeout(() => {
            const toggleBtn = chatArea.querySelector(".jklm-ext-dms-search-toggle-btn");
            const searchBar = chatArea.querySelector(".jklm-ext-dms-search-bar");
            const searchBarInputEl = chatArea.querySelector(".jklm-ext-dms-search-bar input");
            if (toggleBtn && searchBar && searchBarInputEl) {
              if (searchBar.style.display === "none") toggleBtn.click();
              searchBarInputEl.value = query;
              searchBarInputEl.dispatchEvent(new Event("input"));
            }
          }, 200);
        });

        globalSearchResults.appendChild(row);
      });
      globalSearchResults.style.display = "block";
    }

    searchInput.addEventListener("input", () => {
      applySidebarSearch();
      const q = searchInput.value.trim();
      if (!q) {
        globalSearchResults.style.display = "none";
        globalSearchResults.innerHTML = "";
        return;
      }
      searchAllMessages(q).then((results) => {
        // Stale response guard: only render if the query hasn't changed
        // while this lookup was in flight.
        if (searchInput.value.trim() === q) renderGlobalSearchResults(results, q);
      });
    });
    searchInput.addEventListener("focus", () => {
      if (searchInput.value.trim().length >= 2) globalSearchResults.style.display = "block";
    });
    searchInput.addEventListener("blur", () => {
      // Delay so a click on a result fires before the dropdown disappears.
      setTimeout(() => {
        globalSearchResults.style.display = "none";
      }, 150);
    });

    function renderEmptyState() {
      chatArea.innerHTML = "";
      const empty = document.createElement("div");
      empty.className = "jklm-ext-dms-empty";
      empty.textContent = "Select a contact on the left to open the chat.";
      chatArea.appendChild(empty);
    }

    function openChat(profile) {
      activeFriendId = profile.id;
      // Which message (if any) is currently being replied to in this chat.
      let replyingTo = null;
      if (pollInterval) clearInterval(pollInterval);
      if (currentChatListener) {
        dmMessageListeners.delete(currentChatListener);
        currentChatListener = null;
      }
      chatArea.innerHTML = "";

      if (activeConversationWith !== profile.id) {
        leaveActiveConversation();
        activeConversationWith = profile.id;
        if (profile.id !== SYSTEM_BOT_ID) {
          sendWS({ type: "open_conversation", withUserId: profile.id });
          sendWS({ type: "read", withUserId: profile.id });
          sendWS({ type: "history", withUserId: profile.id });
        }
      }
      clearUnread(profile.id);

      const header = document.createElement("div");
      header.className = "jklm-ext-dms-chat-header";

      const headerAvatarWrap = document.createElement("div");
      headerAvatarWrap.className = "jklm-ext-dms-chat-header-avatar-wrap";

      const headerAvatar = document.createElement("img");
      headerAvatar.className = "jklm-ext-dms-chat-header-avatar";
      headerAvatar.src = profile.avatarUrl || DEFAULT_AVATAR;
      headerAvatar.alt = profile.name;

      const headerDot = document.createElement("span");
      headerDot.className = "jklm-ext-dms-chat-header-dot";
      headerDot.style.backgroundColor = getStatusColor(profile.status);

      headerAvatarWrap.appendChild(headerAvatar);
      headerAvatarWrap.appendChild(headerDot);

      const headerName = document.createElement("span");
      headerName.className = "jklm-ext-dms-chat-header-name";
      headerName.textContent = profile.name;

      const searchToggleBtn = document.createElement("button");
      searchToggleBtn.type = "button";
      searchToggleBtn.className = "jklm-ext-dms-search-toggle-btn";
      searchToggleBtn.title = "Search this conversation";
      searchToggleBtn.textContent = "🔍";

      header.appendChild(headerAvatarWrap);
      header.appendChild(headerName);
      header.appendChild(searchToggleBtn);
      chatArea.appendChild(header);

      const searchBar = document.createElement("div");
      searchBar.className = "jklm-ext-dms-search-bar";
      searchBar.style.display = "none";
      const searchBarInput = document.createElement("input");
      searchBarInput.type = "text";
      searchBarInput.className = "jklm-ext-input";
      searchBarInput.placeholder = "Search messages in this conversation...";
      searchBar.appendChild(searchBarInput);
      chatArea.appendChild(searchBar);

      const messagesWrap = document.createElement("div");
      messagesWrap.className = "jklm-ext-dms-messages";
      chatArea.appendChild(messagesWrap);

      const noSearchResultsHint = document.createElement("div");
      noSearchResultsHint.className = "jklm-ext-settings-hint jklm-ext-dms-no-search-results";
      noSearchResultsHint.style.display = "none";
      noSearchResultsHint.textContent = "No messages match your search.";
      chatArea.appendChild(noSearchResultsHint);

      searchToggleBtn.addEventListener("click", () => {
        const showing = searchBar.style.display !== "none";
        searchBar.style.display = showing ? "none" : "flex";
        searchToggleBtn.classList.toggle("active", !showing);
        if (showing) {
          searchBarInput.value = "";
          applyMessageSearchFilter(messagesWrap, "", noSearchResultsHint);
        } else {
          searchBarInput.focus();
        }
      });
      searchBarInput.addEventListener("input", () => {
        applyMessageSearchFilter(messagesWrap, searchBarInput.value, noSearchResultsHint);
      });

      const typingIndicatorEl = document.createElement("div");
      typingIndicatorEl.className = "jklm-ext-typing-indicator";
      typingIndicatorEl.style.display = "none";
      const typingLabel = document.createElement("span");
      typingLabel.className = "jklm-ext-typing-label";
      typingLabel.textContent = profile.name + " is typing";
      const typingDots = document.createElement("span");
      typingDots.className = "jklm-ext-typing-dots";
      typingDots.appendChild(document.createElement("span"));
      typingDots.appendChild(document.createElement("span"));
      typingDots.appendChild(document.createElement("span"));
      typingIndicatorEl.appendChild(typingLabel);
      typingIndicatorEl.appendChild(typingDots);
      chatArea.appendChild(typingIndicatorEl);

      let lastReadReceiptAt = 0;

      // Applies a new status to a pending invite in local storage (after
      // the person responds, or after a live group_invite_update push),
      // then re-renders so the card's buttons resolve into a status line.
      function updateLocalInviteStatus(inviteId, status) {
        loadDMMessages().then((all) => {
          const key = conversationKey(userId, profile.id);
          const list = all[key] || [];
          const idx = list.findIndex((m) => m.id === inviteId);
          if (idx === -1) return;
          const updated = list.slice();
          updated[idx] = { ...updated[idx], status };
          saveDMMessages({ ...all, [key]: updated }).then(() => refresh());
        });
      }

      // Renders a group_invite message as a card (instead of a plain text
      // bubble) with Join/Decline buttons for the recipient, or a status
      // line once it's been responded to.
      function buildGroupInviteCard(msg) {
        const card = document.createElement("div");
        card.className = "jklm-ext-dms-invite-card";

        const icon = document.createElement("div");
        icon.className = "jklm-ext-dms-invite-icon";
        icon.textContent = "👥";
        card.appendChild(icon);

        const body = document.createElement("div");
        body.className = "jklm-ext-dms-invite-body";

        const groupName = msg.groupName || "a group";
        const isRecipient = msg.to === userId;

        const text = document.createElement("div");
        text.className = "jklm-ext-dms-invite-text";
        text.textContent = isRecipient
          ? profile.name + " invited you to join \"" + groupName + "\""
          : "You invited " + profile.name + " to join \"" + groupName + "\"";
        body.appendChild(text);

        if (msg.status === "pending" && isRecipient) {
          const actions = document.createElement("div");
          actions.className = "jklm-ext-dms-invite-actions";

          const joinBtn = document.createElement("button");
          joinBtn.type = "button";
          joinBtn.className = "jklm-ext-btn jklm-ext-btn-primary jklm-ext-invite-btn";
          joinBtn.textContent = "Join";

          const declineBtn = document.createElement("button");
          declineBtn.type = "button";
          declineBtn.className = "jklm-ext-btn jklm-ext-btn-secondary jklm-ext-invite-btn";
          declineBtn.textContent = "Decline";

          function respond(accept) {
            joinBtn.disabled = true;
            declineBtn.disabled = true;
            wsRequest("group_invite_respond", { withUserId: profile.id, inviteId: msg.id, accept }).then((res) => {
              const status = res && res.ok ? res.status : (accept ? "accepted" : "declined");
              updateLocalInviteStatus(msg.id, status);
              if (res && res.ok && accept && res.group) {
                loadGroupsCache().then((list) => {
                  const others = list.filter((g) => g.id !== res.group.id);
                  saveGroupsCache([...others, res.group]).then(() => loadFriendsList().then(renderSidebar));
                });
              }
            });
          }

          joinBtn.addEventListener("click", () => respond(true));
          declineBtn.addEventListener("click", () => respond(false));

          actions.appendChild(joinBtn);
          actions.appendChild(declineBtn);
          body.appendChild(actions);
        } else {
          const status = document.createElement("div");
          status.className = "jklm-ext-dms-invite-status";
          if (msg.status === "accepted") {
            status.textContent = isRecipient ? "You joined the group" : profile.name + " joined the group";
          } else if (msg.status === "declined") {
            status.textContent = isRecipient ? "You declined" : profile.name + " declined";
          } else {
            status.textContent = "Waiting for a response…";
          }
          body.appendChild(status);
        }

        card.appendChild(body);
        return card;
      }

      function scrollToMessage(id) {
        const target = messagesWrap.querySelector('[data-message-id="' + id + '"]');
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.remove("reply-flash");
        // Force reflow so re-adding the class restarts the animation even
        // if the same message was just jumped to a moment ago.
        void target.offsetWidth;
        target.classList.add("reply-flash");
      }

      function buildReplyReference(replyTo) {
        const ref = document.createElement("div");
        ref.className = "jklm-ext-dms-reply-ref";
        const name = document.createElement("span");
        name.className = "jklm-ext-dms-reply-ref-name";
        name.textContent = replyTo.from === userId ? "You" : profile.name;
        const text = document.createElement("span");
        text.className = "jklm-ext-dms-reply-ref-text";
        text.textContent = truncateForReplyPreview(replyTo.text);
        ref.appendChild(name);
        ref.appendChild(text);
        ref.addEventListener("click", () => scrollToMessage(replyTo.id));
        return ref;
      }

      function renderMessages(list) {
        // Preserve where the reader is before we tear the list down and
        // rebuild it. If they were scrolled near the bottom (or this is the
        // first render), keep following the newest message like before. If
        // they'd scrolled up to read older messages, keep them at the same
        // spot instead of yanking them back down on every poll/update.
        const wasNearBottom =
          messagesWrap.childElementCount === 0 ||
          messagesWrap.scrollHeight - messagesWrap.scrollTop - messagesWrap.clientHeight < 60;
        const distanceFromBottom = messagesWrap.scrollHeight - messagesWrap.scrollTop;

        messagesWrap.innerHTML = "";
        if (!list.length) {
          const hint = document.createElement("div");
          hint.className = "jklm-ext-settings-hint";
          hint.style.marginTop = "0";
          hint.textContent = "No messages yet. Send the first one!";
          messagesWrap.appendChild(hint);
          return;
        }
        let lastOwnRow = null;
        list.forEach((msg) => {
          const row = document.createElement("div");
          row.className = "jklm-ext-dms-bubble-row" + (msg.from === userId ? " own" : "");
          row.dataset.messageId = msg.id;
          const col = document.createElement("div");
          col.className = "jklm-ext-dms-bubble-col";
          if (msg.kind === "group_invite") {
            col.appendChild(buildGroupInviteCard(msg));
          } else {
            if (msg.replyTo) {
              col.appendChild(buildReplyReference(msg.replyTo));
            }
            const hoverWrap = document.createElement("div");
            hoverWrap.className = "jklm-ext-dms-bubble-hover-wrap";
            const bubble = document.createElement("div");
            bubble.className = "jklm-ext-dms-bubble";
            const bubbleText = document.createElement("span");
            bubbleText.className = "jklm-ext-dms-bubble-text";
            bubbleText.dataset.rawText = msg.text;
            bubbleText.textContent = msg.text;
            bubble.appendChild(bubbleText);
            hoverWrap.appendChild(bubble);
            // The SystemBot chat has no input row at all (see below), so a
            // reply button there would have nowhere to go — leave it off.
            if (profile.id !== SYSTEM_BOT_ID) {
              const replyBtn = document.createElement("button");
              replyBtn.type = "button";
              replyBtn.className = "jklm-ext-msg-reply-btn";
              replyBtn.title = "Reply";
              replyBtn.textContent = "↩";
              replyBtn.addEventListener("click", () => startReply(msg));
              hoverWrap.appendChild(replyBtn);
            }
            col.appendChild(hoverWrap);
          }
          row.appendChild(col);
          messagesWrap.appendChild(row);
          if (msg.from === userId) lastOwnRow = { row, msg };
        });
        if (lastOwnRow && lastReadReceiptAt >= lastOwnRow.msg.timestamp) {
          const readLabel = document.createElement("div");
          readLabel.className = "jklm-ext-dms-read-label";
          readLabel.textContent = "Read";
          lastOwnRow.row.appendChild(readLabel);
        }
        if (wasNearBottom) {
          messagesWrap.scrollTop = messagesWrap.scrollHeight;
        } else {
          messagesWrap.scrollTop = messagesWrap.scrollHeight - distanceFromBottom;
        }
        if (searchBarInput.value.trim()) {
          applyMessageSearchFilter(messagesWrap, searchBarInput.value, noSearchResultsHint);
        }
      }


      function refresh() {
        if (!chatArea.isConnected) {
          clearInterval(pollInterval);
          return;
        }
        loadDMMessages().then((all) => {
          if (activeFriendId !== profile.id) return;
          renderMessages(all[conversationKey(userId, profile.id)] || []);
        });
      }

      refresh();
      // Light polling so new messages show up without having to reopen the tab.
      pollInterval = setInterval(refresh, 1500);

      // Message edits only get pushed live to devices that were connected
      // at the moment they happened — a device that was offline, or that
      // had this chat open the whole time without ever re-opening it,
      // would otherwise never learn about them. Pulling fresh history
      // every few seconds while the chat is open closes that gap without
      // needing a full reconnect/reopen.
      if (profile.id !== SYSTEM_BOT_ID) {
        sendWS({ type: "history", withUserId: profile.id });
        const historySyncInterval = setInterval(() => {
          if (!chatArea.isConnected) {
            clearInterval(historySyncInterval);
            return;
          }
          sendWS({ type: "history", withUserId: profile.id });
        }, 4000);
      }

      currentChatListener = (kind, value, otherId) => {
        if (otherId !== profile.id) return;
        if (kind === "typing") {
          typingIndicatorEl.style.display = value ? "flex" : "none";
        } else if (kind === "read_receipt") {
          lastReadReceiptAt = Date.now();
          refresh();
        } else if (kind === "profile_updated") {
          headerName.textContent = value.name || profile.id;
          headerAvatar.src = value.avatarUrl || DEFAULT_AVATAR;
          headerAvatar.alt = value.name || profile.id;
          headerDot.style.backgroundColor = getStatusColor(value.status);
        }
      };
      dmMessageListeners.add(currentChatListener);

      const inputRow = document.createElement("div");
      inputRow.className = "jklm-ext-dms-input-row";

      // The SystemBot only ever sends automated system messages — it can't
      // receive DMs, so we swap the input row for a small notice instead.
      if (profile.id === SYSTEM_BOT_ID) {
        const botNotice = document.createElement("div");
        botNotice.className = "jklm-ext-dms-systembot-notice";
        botNotice.textContent = "Mio is a system bot and only sends automated messages — you can't write to it.";
        inputRow.appendChild(botNotice);
        chatArea.appendChild(inputRow);
        return;
      }

      const replyPreviewBar = document.createElement("div");
      replyPreviewBar.className = "jklm-ext-dms-reply-preview";
      replyPreviewBar.style.display = "none";
      const replyPreviewText = document.createElement("div");
      replyPreviewText.className = "jklm-ext-dms-reply-preview-text";
      const replyCancelBtn = document.createElement("button");
      replyCancelBtn.type = "button";
      replyCancelBtn.className = "jklm-ext-dms-reply-cancel-btn";
      replyCancelBtn.title = "Cancel reply";
      replyCancelBtn.textContent = "✕";
      replyPreviewBar.appendChild(replyPreviewText);
      replyPreviewBar.appendChild(replyCancelBtn);
      chatArea.appendChild(replyPreviewBar);

      function cancelReply() {
        replyingTo = null;
        replyPreviewBar.style.display = "none";
      }

      function startReply(msg) {
        replyingTo = { id: msg.id, from: msg.from, text: msg.text };
        replyPreviewText.innerHTML = "";
        const label = document.createElement("b");
        label.textContent = msg.from === userId ? "yourself" : profile.name;
        replyPreviewText.appendChild(document.createTextNode("Replying to "));
        replyPreviewText.appendChild(label);
        replyPreviewText.appendChild(document.createTextNode(": " + truncateForReplyPreview(msg.text)));
        replyPreviewBar.style.display = "flex";
        msgInput.focus();
      }

      replyCancelBtn.addEventListener("click", cancelReply);

      const msgInput = document.createElement("input");
      msgInput.type = "text";
      msgInput.placeholder = "Write a message...";
      msgInput.className = "jklm-ext-input";
      msgInput.maxLength = 500;

      const sendBtn = document.createElement("button");
      sendBtn.className = "jklm-ext-btn jklm-ext-btn-primary";
      sendBtn.textContent = "Send";

      let typingActive = false;
      let typingStopTimer = null;

      function stopTypingSignal() {
        if (typingStopTimer) clearTimeout(typingStopTimer);
        typingStopTimer = null;
        if (typingActive) {
          typingActive = false;
          sendWS({ type: "typing", to: profile.id, isTyping: false });
        }
      }

      msgInput.addEventListener("input", () => {
        if (!typingActive) {
          typingActive = true;
          sendWS({ type: "typing", to: profile.id, isTyping: true });
        }
        if (typingStopTimer) clearTimeout(typingStopTimer);
        typingStopTimer = setTimeout(stopTypingSignal, 2000);
      });

      function sendMessage() {
        // Extra safety net in case this ever gets called for the bot chat.
        if (profile.id === SYSTEM_BOT_ID) return;
        const text = msgInput.value.trim();
        if (!text || activeFriendId !== profile.id) return;
        stopTypingSignal();
        const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
        const replySnippet = replyingTo
          ? { id: replyingTo.id, from: replyingTo.from, text: truncateForReplyPreview(replyingTo.text) }
          : null;
        loadDMMessages().then((all) => {
          const key = conversationKey(userId, profile.id);
          const list = all[key] || [];
          const updated = [
            ...list,
            { id, from: userId, to: profile.id, text, timestamp: Date.now(), replyTo: replySnippet }
          ];
          const nextAll = { ...all, [key]: updated };
          saveDMMessages(nextAll).then(() => {
            msgInput.value = "";
            cancelReply();
            renderMessages(updated);
            sendWS({ type: "message", id, to: profile.id, text, replyTo: replySnippet ? replySnippet.id : undefined });
          });
        });
      }

      sendBtn.addEventListener("click", sendMessage);
      msgInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          sendMessage();
        } else if (event.key === "Escape" && replyingTo) {
          cancelReply();
        }
      });

      inputRow.appendChild(msgInput);
      inputRow.appendChild(sendBtn);
      chatArea.appendChild(inputRow);
    }

    // Resolves display names for a list of user IDs (group message senders,
    // or a group's full member list for @mention purposes), backfilling the
    // local user registry for members who aren't friends (and therefore
    // never got a profile pushed to us) the same way the friends list does.
    function resolveGroupSenderNames(senderIds) {
      return loadUserRegistry().then((registry) => {
        const byId = new Map(registry.map((r) => [r.id, r]));
        const names = {};
        senderIds.forEach((id) => {
          const record = byId.get(id);
          names[id] = id === userId ? "You" : (record && record.name) || id;
          if (!record || !record.name) {
            ensureUserProfile(id);
          }
        });
        return names;
      });
    }

    function openGroupChat(group) {
      activeFriendId = group.id;
      if (pollInterval) clearInterval(pollInterval);
      if (currentChatListener) {
        dmMessageListeners.delete(currentChatListener);
        currentChatListener = null;
      }
      chatArea.innerHTML = "";
      leaveActiveConversation();
      activeConversationWith = group.id;
      clearUnread(group.id);
      sendWS({ type: "group_history", groupId: group.id });
      sendWS({ type: "group_read", groupId: group.id });

      // userId -> timestamp of that member's last "seen everything up to
      // now" mark, seeded from group_history and kept current by live
      // group_read_receipt pushes. Drives the "Read by ..." label under
      // this user's most recent message.
      let readState = {};
      // Most recently resolved id -> display name map for this group's
      // members, used both to render @mentions in bubbles and to power the
      // mention autocomplete dropdown while composing.
      let latestMemberNames = {};
      // Which message (if any) is currently being replied to in this group.
      let replyingTo = null;

      const header = document.createElement("div");
      header.className = "jklm-ext-dms-chat-header";

      const headerAvatarWrap = document.createElement("div");
      headerAvatarWrap.className = "jklm-ext-dms-chat-header-avatar-wrap";
      const headerAvatar = document.createElement("img");
      headerAvatar.className = "jklm-ext-dms-chat-header-avatar";
      headerAvatar.src = GROUP_ICON;
      headerAvatar.alt = group.name;
      headerAvatarWrap.appendChild(headerAvatar);

      const headerNameWrap = document.createElement("div");
      headerNameWrap.className = "jklm-ext-dms-chat-header-name-wrap jklm-ext-dms-chat-header-name-wrap-clickable";
      headerNameWrap.title = "View members";
      const headerName = document.createElement("span");
      headerName.className = "jklm-ext-dms-chat-header-name";
      headerName.textContent = group.name;
      const headerMemberCount = document.createElement("span");
      headerMemberCount.className = "jklm-ext-dms-chat-header-subtext";
      headerMemberCount.textContent = group.members.length + " member" + (group.members.length === 1 ? "" : "s");
      headerNameWrap.appendChild(headerName);
      headerNameWrap.appendChild(headerMemberCount);
      headerNameWrap.addEventListener("click", (e) => {
        e.stopPropagation();
        const alreadyOpen = document.querySelector(".jklm-ext-dms-members-panel");
        if (alreadyOpen) {
          closeAnyOpenMenu();
          return;
        }
        openGroupMembersPanel(headerNameWrap, group);
      });

      const searchToggleBtn = document.createElement("button");
      searchToggleBtn.type = "button";
      searchToggleBtn.className = "jklm-ext-dms-search-toggle-btn";
      searchToggleBtn.title = "Search this conversation";
      searchToggleBtn.textContent = "🔍";

      const manageBtn = document.createElement("button");
      manageBtn.type = "button";
      manageBtn.className = "jklm-ext-dms-friend-menu-btn";
      manageBtn.textContent = "⋮";
      manageBtn.setAttribute("aria-label", "Manage group");

      header.appendChild(headerAvatarWrap);
      header.appendChild(headerNameWrap);
      header.appendChild(searchToggleBtn);
      header.appendChild(manageBtn);
      chatArea.appendChild(header);

      manageBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const alreadyOpen = document.querySelector(".jklm-ext-dms-menu");
        if (alreadyOpen) {
          closeAnyOpenMenu();
          return;
        }
        const isOwner = group.ownerId === userId;
        const menuOptions = [
          {
            label: "Copy Group ID",
            feedbackLabel: "Copied!",
            onClick: () => {
              navigator.clipboard.writeText(group.id).catch(() => { });
            }
          },
          {
            label: "Add Member",
            onClick: () => openAddGroupMemberPrompt(group)
          }
        ];
        if (isOwner) {
          menuOptions.push({
            label: "Rename Group",
            onClick: () => {
              const name = window.prompt("New group name:", group.name);
              if (name && name.trim()) {
                wsRequest("group_rename", { groupId: group.id, name: name.trim() });
              }
            }
          });
          menuOptions.push({
            label: "Manage Members",
            onClick: () => openManageGroupMembersPrompt(group)
          });
        }
        menuOptions.push({
          label: "Leave Group",
          onClick: () => {
            if (!window.confirm('Leave "' + group.name + '"?')) return;
            sendWS({ type: "group_leave", groupId: group.id });
            if (pollInterval) clearInterval(pollInterval);
            if (currentChatListener) {
              dmMessageListeners.delete(currentChatListener);
              currentChatListener = null;
            }
            activeFriendId = null;
            activeConversationWith = null;
            renderEmptyState();
          }
        });
        openMenuFor(header, manageBtn, menuOptions);
      });

      const searchBar = document.createElement("div");
      searchBar.className = "jklm-ext-dms-search-bar";
      searchBar.style.display = "none";
      const searchBarInput = document.createElement("input");
      searchBarInput.type = "text";
      searchBarInput.className = "jklm-ext-input";
      searchBarInput.placeholder = "Search messages in this conversation...";
      searchBar.appendChild(searchBarInput);
      chatArea.appendChild(searchBar);

      const messagesWrap = document.createElement("div");
      messagesWrap.className = "jklm-ext-dms-messages";
      chatArea.appendChild(messagesWrap);

      const noSearchResultsHint = document.createElement("div");
      noSearchResultsHint.className = "jklm-ext-settings-hint jklm-ext-dms-no-search-results";
      noSearchResultsHint.style.display = "none";
      noSearchResultsHint.textContent = "No messages match your search.";
      chatArea.appendChild(noSearchResultsHint);

      searchToggleBtn.addEventListener("click", () => {
        const showing = searchBar.style.display !== "none";
        searchBar.style.display = showing ? "none" : "flex";
        searchToggleBtn.classList.toggle("active", !showing);
        if (showing) {
          searchBarInput.value = "";
          applyMessageSearchFilter(messagesWrap, "", noSearchResultsHint);
        } else {
          searchBarInput.focus();
        }
      });
      searchBarInput.addEventListener("input", () => {
        applyMessageSearchFilter(messagesWrap, searchBarInput.value, noSearchResultsHint);
      });

      function scrollToMessage(id) {
        const target = messagesWrap.querySelector('[data-message-id="' + id + '"]');
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.remove("reply-flash");
        // Force reflow so re-adding the class restarts the animation even
        // if the same message was just jumped to a moment ago.
        void target.offsetWidth;
        target.classList.add("reply-flash");
      }

      function buildReplyReference(replyTo, names) {
        const ref = document.createElement("div");
        ref.className = "jklm-ext-dms-reply-ref";
        const name = document.createElement("span");
        name.className = "jklm-ext-dms-reply-ref-name";
        name.textContent = replyTo.from === userId ? "You" : names[replyTo.from] || replyTo.from;
        const text = document.createElement("span");
        text.className = "jklm-ext-dms-reply-ref-text";
        text.textContent = truncateForReplyPreview(replyTo.text);
        ref.appendChild(name);
        ref.appendChild(text);
        ref.addEventListener("click", () => scrollToMessage(replyTo.id));
        return ref;
      }

      function renderMessages(list) {
        if (!list.length) {
          messagesWrap.innerHTML = "";
          const hint = document.createElement("div");
          hint.className = "jklm-ext-settings-hint";
          hint.style.marginTop = "0";
          hint.textContent = "No messages yet. Send the first one!";
          messagesWrap.appendChild(hint);
          return;
        }
        // Resolve names for everyone who might show up as a sender AND
        // every current member (members who haven't posted yet still need
        // to resolve if they're @mentioned in someone else's message).
        const relevantIds = Array.from(new Set([...list.map((m) => m.from), ...group.members]));
        resolveGroupSenderNames(relevantIds).then((names) => {
          if (activeFriendId !== group.id) return;
          latestMemberNames = names;
          // Preserve where the reader is before we tear the list down and
          // rebuild it. If they were scrolled near the bottom (or this is
          // the first render), keep following the newest message like
          // before. If they'd scrolled up to read older messages, keep
          // them at the same spot instead of yanking them back down on
          // every poll/update.
          const wasNearBottom =
            messagesWrap.childElementCount === 0 ||
            messagesWrap.scrollHeight - messagesWrap.scrollTop - messagesWrap.clientHeight < 60;
          const distanceFromBottom = messagesWrap.scrollHeight - messagesWrap.scrollTop;
          messagesWrap.innerHTML = "";
          let lastOwnRow = null;
          list.forEach((msg) => {
            const mentionsMe = Array.isArray(msg.mentions) && msg.mentions.includes(userId);
            const row = document.createElement("div");
            row.className =
              "jklm-ext-dms-bubble-row" +
              (msg.from === userId ? " own" : "") +
              (mentionsMe ? " mentioned" : "");
            row.dataset.messageId = msg.id;
            const col = document.createElement("div");
            col.className = "jklm-ext-dms-bubble-col";
            if (msg.from !== userId) {
              const senderLabel = document.createElement("div");
              senderLabel.className = "jklm-ext-dms-group-sender";
              senderLabel.textContent = names[msg.from] || msg.from;
              col.appendChild(senderLabel);
            }
            if (msg.replyTo) {
              col.appendChild(buildReplyReference(msg.replyTo, names));
            }
            const hoverWrap = document.createElement("div");
            hoverWrap.className = "jklm-ext-dms-bubble-hover-wrap";
            const bubble = document.createElement("div");
            bubble.className = "jklm-ext-dms-bubble";
            const bubbleText = document.createElement("span");
            bubbleText.className = "jklm-ext-dms-bubble-text";
            renderBubbleText(bubbleText, msg.text, msg.mentions, names);
            bubble.appendChild(bubbleText);
            hoverWrap.appendChild(bubble);
            const replyBtn = document.createElement("button");
            replyBtn.type = "button";
            replyBtn.className = "jklm-ext-msg-reply-btn";
            replyBtn.title = "Reply";
            replyBtn.textContent = "↩";
            replyBtn.addEventListener("click", () => startReply(msg, names));
            hoverWrap.appendChild(replyBtn);
            col.appendChild(hoverWrap);
            row.appendChild(col);
            messagesWrap.appendChild(row);
            if (msg.from === userId) lastOwnRow = { row, msg };
          });
          if (lastOwnRow) {
            const readerNames = group.members
              .filter((id) => id !== userId)
              .filter((id) => (readState[id] || 0) >= lastOwnRow.msg.timestamp)
              .map((id) => names[id] || id);
            if (readerNames.length) {
              const readLabel = document.createElement("div");
              readLabel.className = "jklm-ext-dms-read-label";
              readLabel.textContent = "Read by " + readerNames.join(", ");
              lastOwnRow.row.appendChild(readLabel);
            }
          }
          if (wasNearBottom) {
            messagesWrap.scrollTop = messagesWrap.scrollHeight;
          } else {
            messagesWrap.scrollTop = messagesWrap.scrollHeight - distanceFromBottom;
          }
          if (searchBarInput.value.trim()) {
            applyMessageSearchFilter(messagesWrap, searchBarInput.value, noSearchResultsHint);
          }
        });
      }

      // Cheap fingerprint of "what's currently on screen" — lets the
      // background poll below tell whether anything actually changed
      // before tearing down and rebuilding the whole message list (which
      // also resets scroll position). Without this, the chat visibly
      // "refreshes" every 1.5s even when nothing new happened.
      let renderedSignature = null;
      function messagesSignature(list) {
        return list.map((m) => m.id).join(",");
      }

      function refresh() {
        if (!chatArea.isConnected) {
          clearInterval(pollInterval);
          return;
        }
        loadGroupMessages().then((all) => {
          if (activeFriendId !== group.id) return;
          const list = all[group.id] || [];
          renderedSignature = messagesSignature(list);
          renderMessages(list);
        });
      }

      // Like refresh(), but skips the rebuild entirely when the message
      // list hasn't actually changed since the last render — this is what
      // keeps the group chat feeling like a normal DM (static until
      // something new arrives) instead of visibly rebuilding on a timer.
      function pollRefresh() {
        if (!chatArea.isConnected) {
          clearInterval(pollInterval);
          return;
        }
        loadGroupMessages().then((all) => {
          if (activeFriendId !== group.id) return;
          const list = all[group.id] || [];
          const signature = messagesSignature(list);
          if (signature === renderedSignature) return;
          renderedSignature = signature;
          renderMessages(list);
        });
      }

      refresh();
      pollInterval = setInterval(pollRefresh, 1500);

      // Same reasoning as the DM chat: message edits only push live to
      // devices that were connected at that moment, so periodically re-pull
      // the group's history to pick up anything that was missed.
      const historySyncInterval = setInterval(() => {
        if (!chatArea.isConnected) {
          clearInterval(historySyncInterval);
          return;
        }
        sendWS({ type: "group_history", groupId: group.id });
      }, 4000);

      currentChatListener = (kind, value, groupId) => {
        if (kind === "groups_list") {
          loadGroupsCache().then((groups) => {
            const updated = groups.find((g) => g.id === group.id);
            if (!updated) return;
            group.members = updated.members;
            group.name = updated.name;
            group.ownerId = updated.ownerId;
            headerName.textContent = group.name;
            headerMemberCount.textContent =
              group.members.length + " member" + (group.members.length === 1 ? "" : "s");
          });
          return;
        }
        if (groupId !== group.id) return;
        if (kind === "group_read_state") {
          const merged = { ...readState, ...(value || {}) };
          // The periodic history re-sync (see historySyncInterval below)
          // triggers this on every response, even when nothing actually
          // changed — only force a re-render/rescroll when the read state
          // genuinely moved, so the chat doesn't visibly "refresh" every
          // few seconds for no reason.
          const changed = JSON.stringify(merged) !== JSON.stringify(readState);
          readState = merged;
          if (changed) refresh();
        } else if (kind === "group_read_receipt") {
          const next = { ...readState, [value.userId]: value.timestamp };
          const changed = next[value.userId] !== readState[value.userId];
          readState = next;
          if (changed) refresh();
        }
      };
      dmMessageListeners.add(currentChatListener);

      // --- @mention autocomplete -------------------------------------------
      const mentionDropdown = document.createElement("div");
      mentionDropdown.className = "jklm-ext-mention-dropdown";
      chatArea.appendChild(mentionDropdown);

      let mentionCandidates = [];

      function closeMentionDropdown() {
        mentionDropdown.style.display = "none";
        mentionDropdown.innerHTML = "";
        mentionCandidates = [];
      }

      // Matches an "@partial" token that's still being typed at the cursor
      // (preceded by start-of-text or whitespace, no space inside it yet).
      function activeMentionQuery() {
        const value = msgInput.value;
        const cursor = msgInput.selectionStart == null ? value.length : msgInput.selectionStart;
        const match = value.slice(0, cursor).match(/(^|\s)@([^\s@]*)$/);
        return match ? match[2] : null;
      }

      function insertMention(name) {
        const value = msgInput.value;
        const cursor = msgInput.selectionStart == null ? value.length : msgInput.selectionStart;
        const before = value.slice(0, cursor);
        const match = before.match(/(^|\s)@([^\s@]*)$/);
        if (!match) return;
        const atIndex = cursor - match[2].length - 1;
        const insertion = "@" + name + " ";
        const nextValue = value.slice(0, atIndex) + insertion + value.slice(cursor);
        msgInput.value = nextValue;
        const nextCursor = atIndex + insertion.length;
        msgInput.focus();
        msgInput.setSelectionRange(nextCursor, nextCursor);
        closeMentionDropdown();
      }

      function updateMentionDropdown() {
        const query = activeMentionQuery();
        if (query === null) {
          closeMentionDropdown();
          return;
        }
        const q = query.toLowerCase();
        mentionCandidates = group.members
          .filter((id) => id !== userId)
          .map((id) => ({ id, name: latestMemberNames[id] || id }))
          .filter((c) => c.name.toLowerCase().indexOf(q) !== -1)
          .slice(0, 6);
        if (!mentionCandidates.length) {
          closeMentionDropdown();
          return;
        }
        mentionDropdown.innerHTML = "";
        mentionCandidates.forEach((c) => {
          const opt = document.createElement("div");
          opt.className = "jklm-ext-mention-dropdown-item";
          opt.textContent = c.name;
          // mousedown (not click) fires before the input blurs, so the
          // selection still has an intact caret position to insert against.
          opt.addEventListener("mousedown", (e) => {
            e.preventDefault();
            insertMention(c.name);
          });
          mentionDropdown.appendChild(opt);
        });
        mentionDropdown.style.display = "flex";
      }

      // Everyone whose name appears as "@Name" in the final text is treated
      // as mentioned — covers both autocomplete picks and manually typed
      // mentions. The server re-validates against real membership anyway.
      function computeMentions(text) {
        const lower = text.toLowerCase();
        return Object.keys(latestMemberNames).filter((id) => {
          if (id === userId) return false;
          const name = latestMemberNames[id];
          return name && lower.indexOf("@" + name.toLowerCase()) !== -1;
        });
      }

      const inputRow = document.createElement("div");
      inputRow.className = "jklm-ext-dms-input-row";

      const replyPreviewBar = document.createElement("div");
      replyPreviewBar.className = "jklm-ext-dms-reply-preview";
      replyPreviewBar.style.display = "none";
      const replyPreviewText = document.createElement("div");
      replyPreviewText.className = "jklm-ext-dms-reply-preview-text";
      const replyCancelBtn = document.createElement("button");
      replyCancelBtn.type = "button";
      replyCancelBtn.className = "jklm-ext-dms-reply-cancel-btn";
      replyCancelBtn.title = "Cancel reply";
      replyCancelBtn.textContent = "✕";
      replyPreviewBar.appendChild(replyPreviewText);
      replyPreviewBar.appendChild(replyCancelBtn);
      chatArea.appendChild(replyPreviewBar);

      function cancelReply() {
        replyingTo = null;
        replyPreviewBar.style.display = "none";
      }

      function startReply(msg, names) {
        replyingTo = { id: msg.id, from: msg.from, text: msg.text };
        replyPreviewText.innerHTML = "";
        const label = document.createElement("b");
        label.textContent = msg.from === userId ? "yourself" : names[msg.from] || msg.from;
        replyPreviewText.appendChild(document.createTextNode("Replying to "));
        replyPreviewText.appendChild(label);
        replyPreviewText.appendChild(document.createTextNode(": " + truncateForReplyPreview(msg.text)));
        replyPreviewBar.style.display = "flex";
        msgInput.focus();
      }

      replyCancelBtn.addEventListener("click", cancelReply);

      const msgInput = document.createElement("input");
      msgInput.type = "text";
      msgInput.placeholder = "Message the group... (@ to mention someone)";
      msgInput.className = "jklm-ext-input";
      msgInput.maxLength = 500;

      const sendBtn = document.createElement("button");
      sendBtn.className = "jklm-ext-btn jklm-ext-btn-primary";
      sendBtn.textContent = "Send";

      function sendMessage() {
        const text = msgInput.value.trim();
        if (!text || activeFriendId !== group.id) return;
        closeMentionDropdown();
        const mentions = computeMentions(text);
        const id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
        const replySnippet = replyingTo
          ? { id: replyingTo.id, from: replyingTo.from, text: truncateForReplyPreview(replyingTo.text) }
          : null;
        loadGroupMessages().then((all) => {
          const list = all[group.id] || [];
          const updated = [
            ...list,
            { id, groupId: group.id, from: userId, text, mentions, timestamp: Date.now(), replyTo: replySnippet }
          ];
          saveGroupMessages({ ...all, [group.id]: updated }).then(() => {
            msgInput.value = "";
            cancelReply();
            renderedSignature = messagesSignature(updated);
            renderMessages(updated);
            sendWS({
              type: "group_message",
              id,
              groupId: group.id,
              text,
              mentions,
              replyTo: replySnippet ? replySnippet.id : undefined
            });
          });
        });
      }

      sendBtn.addEventListener("click", sendMessage);
      msgInput.addEventListener("input", updateMentionDropdown);
      msgInput.addEventListener("blur", () => {
        // Small delay so a mousedown on a dropdown item still registers
        // before the dropdown gets torn down.
        setTimeout(closeMentionDropdown, 150);
      });
      msgInput.addEventListener("keydown", (event) => {
        if (mentionCandidates.length && (event.key === "Enter" || event.key === "Tab")) {
          event.preventDefault();
          insertMention(mentionCandidates[0].name);
          return;
        }
        if (event.key === "Escape" && mentionCandidates.length) {
          closeMentionDropdown();
          return;
        }
        if (event.key === "Escape" && replyingTo) {
          cancelReply();
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          sendMessage();
        }
      });

      inputRow.appendChild(msgInput);
      inputRow.appendChild(sendBtn);
      chatArea.appendChild(inputRow);
    }

    // Small floating prompt (reuses the same menu styling) letting the user
    // pick one friend at a time to add to a group.
    function openAddGroupMemberPrompt(group) {
      loadFriendsList().then((friends) => {
        loadUserRegistry().then((registry) => {
          const byId = new Map(registry.map((r) => [r.id, r]));
          const candidates = friends.filter((id) => id !== userId && !group.members.includes(id));
          if (!candidates.length) {
            window.alert("All of your friends are already in this group.");
            return;
          }
          const label = window.prompt(
            "Add which friend? (type their exact name)\n" +
            candidates.map((id) => (byId.get(id) && byId.get(id).name) || id).join(", ")
          );
          if (!label) return;
          const match = candidates.find(
            (id) => ((byId.get(id) && byId.get(id).name) || id).toLowerCase() === label.trim().toLowerCase()
          );
          if (!match) {
            window.alert("Couldn't find that friend in the list.");
            return;
          }
          wsRequest("group_add_member", { groupId: group.id, target: match }).then((res) => {
            if (res && res.ok) {
              window.alert("Invite sent — they'll see a join request in their DMs.");
            } else if (res && res.error === "already_invited") {
              window.alert("They already have a pending invite to this group.");
            } else if (res) {
              window.alert("Couldn't send the invite — try again.");
            }
          });
        });
      });
    }

    // Owner-only: pick a member to remove from the group.
    function openManageGroupMembersPrompt(group) {
      loadUserRegistry().then((registry) => {
        const byId = new Map(registry.map((r) => [r.id, r]));
        const removable = group.members.filter((id) => id !== group.ownerId);
        if (!removable.length) {
          window.alert("There's no one else in this group yet.");
          return;
        }
        const label = window.prompt(
          "Remove which member? (type their exact name)\n" +
          removable.map((id) => (id === userId ? "You" : (byId.get(id) && byId.get(id).name) || id)).join(", ")
        );
        if (!label) return;
        const match = removable.find(
          (id) => ((id === userId ? "You" : (byId.get(id) && byId.get(id).name) || id)).toLowerCase() === label.trim().toLowerCase()
        );
        if (!match) {
          window.alert("Couldn't find that member.");
          return;
        }
        wsRequest("group_remove_member", { groupId: group.id, target: match });
      });
    }

    function closeAnyOpenMenu() {
      if (closeOpenMenu) {
        closeOpenMenu();
        closeOpenMenu = null;
      }
    }

    function openMenuFor(item, menuBtn, options) {
      closeAnyOpenMenu();

      const menu = document.createElement("div");
      menu.className = "jklm-ext-dms-menu";

      options.forEach((opt) => {
        const optBtn = document.createElement("button");
        optBtn.type = "button";
        optBtn.className = "jklm-ext-dms-menu-item";
        optBtn.textContent = opt.label;
        optBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          if (opt.feedbackLabel) {
            opt.onClick();
            optBtn.textContent = opt.feedbackLabel;
            setTimeout(closeAnyOpenMenu, 700);
          } else {
            closeAnyOpenMenu();
            opt.onClick();
          }
        });
        menu.appendChild(optBtn);
      });

      // Append to <body> instead of the list item: the sidebar scrolls
      // (overflow-y: auto), which would clip an absolutely-positioned menu
      // that lives inside it. Fixed-positioning against the button avoids that.
      document.body.appendChild(menu);

      function positionMenu() {
        const btnRect = menuBtn.getBoundingClientRect();
        menu.style.top = (btnRect.bottom + 4) + "px";
        menu.style.left = "auto";
        menu.style.right = (window.innerWidth - btnRect.right) + "px";
      }
      positionMenu();

      const outsideClickHandler = (e) => {
        if (!menu.isConnected) {
          document.removeEventListener("click", outsideClickHandler, true);
          return;
        }
        if (!menu.contains(e.target) && e.target !== menuBtn) {
          menu.remove();
          document.removeEventListener("click", outsideClickHandler, true);
        }
      };
      setTimeout(() => document.addEventListener("click", outsideClickHandler, true), 0);

      // Close instead of leaving a stale menu behind if the sidebar list
      // (or the page) scrolls out from under it.
      const scrollCloseHandler = () => closeAnyOpenMenu();
      sidebar.addEventListener("scroll", scrollCloseHandler);
      window.addEventListener("scroll", scrollCloseHandler, true);

      closeOpenMenu = () => {
        menu.remove();
        document.removeEventListener("click", outsideClickHandler, true);
        sidebar.removeEventListener("scroll", scrollCloseHandler);
        window.removeEventListener("scroll", scrollCloseHandler, true);
      };
    }

    // Small dropdown listing every member of a group — avatar, name, an
    // "Owner" badge for the group's owner, and an online dot for members
    // who are currently connected. Opened by clicking the group name in
    // the chat header; reuses the same fixed-position / outside-click /
    // scroll-close wiring as openMenuFor so it behaves consistently with
    // the other dropdown menus.
    function openGroupMembersPanel(anchorEl, group) {
      closeAnyOpenMenu();

      const panel = document.createElement("div");
      panel.className = "jklm-ext-dms-menu jklm-ext-dms-members-panel";

      const title = document.createElement("div");
      title.className = "jklm-ext-dms-members-panel-title";
      title.textContent = group.members.length + " member" + (group.members.length === 1 ? "" : "s");
      panel.appendChild(title);

      const list = document.createElement("div");
      list.className = "jklm-ext-dms-members-panel-list";
      panel.appendChild(list);

      document.body.appendChild(panel);

      function positionPanel() {
        const rect = anchorEl.getBoundingClientRect();
        panel.style.top = (rect.bottom + 4) + "px";
        panel.style.left = rect.left + "px";
      }
      positionPanel();

      const outsideClickHandler = (e) => {
        if (!panel.isConnected) {
          document.removeEventListener("click", outsideClickHandler, true);
          return;
        }
        if (!panel.contains(e.target) && !anchorEl.contains(e.target)) {
          panel.remove();
          document.removeEventListener("click", outsideClickHandler, true);
        }
      };
      setTimeout(() => document.addEventListener("click", outsideClickHandler, true), 0);

      const scrollCloseHandler = () => closeAnyOpenMenu();
      sidebar.addEventListener("scroll", scrollCloseHandler);
      window.addEventListener("scroll", scrollCloseHandler, true);

      closeOpenMenu = () => {
        panel.remove();
        document.removeEventListener("click", outsideClickHandler, true);
        sidebar.removeEventListener("scroll", scrollCloseHandler);
        window.removeEventListener("scroll", scrollCloseHandler, true);
      };

      const memberIds = group.members.slice();
      Promise.all([
        resolveGroupSenderNames(memberIds),
        loadUserRegistry(),
        fetchPresence(memberIds.filter((id) => id !== userId))
      ]).then(([names, registry, presenceMap]) => {
        if (!panel.isConnected) return;
        const registryById = new Map(registry.map((r) => [r.id, r]));
        list.innerHTML = "";
        memberIds.forEach((id) => {
          const record = registryById.get(id);
          const row = document.createElement("div");
          row.className = "jklm-ext-dms-members-panel-row";

          const avatarWrap = document.createElement("div");
          avatarWrap.className = "jklm-ext-dms-friend-avatar-wrap";
          const avatar = document.createElement("img");
          avatar.className = "jklm-ext-dms-friend-avatar";
          avatar.src = (record && record.avatarUrl) || DEFAULT_AVATAR;
          avatar.alt = names[id] || id;
          avatarWrap.appendChild(avatar);
          const presence = presenceMap[id];
          if (id === userId || (presence && presence.online)) {
            const dot = document.createElement("span");
            dot.className = "jklm-ext-dms-presence-dot";
            avatarWrap.appendChild(dot);
          }

          const nameCol = document.createElement("div");
          nameCol.className = "jklm-ext-dms-members-panel-name-col";
          const nameEl = document.createElement("span");
          nameEl.className = "jklm-ext-dms-members-panel-name";
          nameEl.textContent = names[id] || id;
          nameCol.appendChild(nameEl);
          if (group.ownerId === id) {
            const badge = document.createElement("span");
            badge.className = "jklm-ext-dms-members-panel-owner-badge";
            badge.textContent = "Owner";
            nameCol.appendChild(badge);
          }

          row.appendChild(avatarWrap);
          row.appendChild(nameCol);
          list.appendChild(row);
        });
      });
    }

    function createSidebarItem(profile, options) {
      const item = document.createElement("div");
      item.className = "jklm-ext-dms-friend-item";
      item.dataset.friendId = profile.id;
      item.dataset.searchName = (profile.name || "").toLowerCase();

      const mainRow = document.createElement("div");
      mainRow.className = "jklm-ext-dms-friend-item-main";
      mainRow.setAttribute("role", "button");
      mainRow.tabIndex = 0;

      const avatarWrap = document.createElement("div");
      avatarWrap.className = "jklm-ext-dms-friend-avatar-wrap";

      const avatar = document.createElement("img");
      avatar.className = "jklm-ext-dms-friend-avatar";
      avatar.src = profile.avatarUrl || DEFAULT_AVATAR;
      avatar.alt = profile.name;
      avatarWrap.appendChild(avatar);

      if (options.online) {
        const presenceDot = document.createElement("span");
        presenceDot.className = "jklm-ext-dms-presence-dot";
        presenceDot.title = "Online now";
        avatarWrap.appendChild(presenceDot);
      }

      const nameEl = document.createElement("span");
      nameEl.className = "jklm-ext-dms-friend-name";
      nameEl.textContent = profile.name;

      mainRow.appendChild(avatarWrap);
      mainRow.appendChild(nameEl);

      if (options.pinned) {
        const pinIcon = document.createElement("span");
        pinIcon.className = "jklm-ext-dms-pin-icon";
        pinIcon.textContent = "📌";
        mainRow.appendChild(pinIcon);
      }

      if (options.muted) {
        const muteIcon = document.createElement("span");
        muteIcon.className = "jklm-ext-dms-mute-icon";
        muteIcon.textContent = "🔇";
        muteIcon.title = "Muted";
        mainRow.appendChild(muteIcon);
      }

      if (options.unreadCount) {
        const badge = document.createElement("span");
        badge.className = "jklm-ext-dms-unread-badge";
        badge.textContent = options.unreadCount > 9 ? "9+" : String(options.unreadCount);
        mainRow.appendChild(badge);
      }

      function activateChat() {
        sidebar
          .querySelectorAll(".jklm-ext-dms-friend-item")
          .forEach((el) => el.classList.remove("active"));
        item.classList.add("active");
        openChat(profile);
      }

      mainRow.addEventListener("click", activateChat);
      mainRow.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateChat();
        }
      });

      const menuBtn = document.createElement("button");
      menuBtn.type = "button";
      menuBtn.className = "jklm-ext-dms-friend-menu-btn";
      menuBtn.textContent = "⋮";
      menuBtn.setAttribute("aria-label", "More options");
      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const alreadyOpen = item.querySelector(".jklm-ext-dms-menu");
        if (alreadyOpen) {
          closeAnyOpenMenu();
          return;
        }

        const menuOptions = [
          {
            label: "Copy User ID",
            feedbackLabel: "Copied!",
            onClick: () => {
              navigator.clipboard.writeText(profile.id).catch(() => {
                const textarea = document.createElement("textarea");
                textarea.value = profile.id;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                textarea.remove();
              });
            }
          }
        ];

        if (options.canPin) {
          menuOptions.push({
            label: options.pinned ? "Unpin it" : "Pin it",
            onClick: () => {
              loadPinnedUsers().then((pinned) => {
                const nextPinned = options.pinned
                  ? pinned.filter((pid) => pid !== profile.id)
                  : [...pinned, profile.id];
                savePinnedUsers(nextPinned).then(() => {
                  loadFriendsList().then(renderSidebar);
                });
              });
            }
          });
        }

        menuOptions.push({
          label: options.muted ? "Unmute" : "Mute",
          onClick: () => {
            loadMutedConversations().then((muted) => {
              const nextMuted = options.muted
                ? muted.filter((id) => id !== profile.id)
                : [...muted, profile.id];
              saveMutedConversations(nextMuted).then(() => {
                loadFriendsList().then(renderSidebar);
              });
            });
          }
        });

        menuOptions.push({
          label: "View Profile",
          onClick: () => {
            // Wait for the fresh data before showing anything, so the
            // stale cached version never flashes up first. Fall back to
            // the cached profile only if the server lookup fails.
            ensureUserProfile(profile.id).then((fresh) => {
              showUserProfilePreview(fresh ? { ...profile, ...fresh } : profile);
            });
          }
        });

        openMenuFor(item, menuBtn, menuOptions);
      });

      item.appendChild(mainRow);
      item.appendChild(menuBtn);
      return item;
    }

    function createGroupSidebarItem(group, options) {
      const item = document.createElement("div");
      item.className = "jklm-ext-dms-friend-item jklm-ext-dms-group-item";
      item.dataset.friendId = group.id;
      item.dataset.searchName = (group.name || "").toLowerCase();

      const mainRow = document.createElement("div");
      mainRow.className = "jklm-ext-dms-friend-item-main";
      mainRow.setAttribute("role", "button");
      mainRow.tabIndex = 0;

      const avatar = document.createElement("img");
      avatar.className = "jklm-ext-dms-friend-avatar";
      avatar.src = GROUP_ICON;
      avatar.alt = group.name;

      const nameCol = document.createElement("div");
      nameCol.className = "jklm-ext-dms-group-name-col";
      const nameEl = document.createElement("span");
      nameEl.className = "jklm-ext-dms-friend-name";
      nameEl.textContent = group.name;
      const memberEl = document.createElement("span");
      memberEl.className = "jklm-ext-dms-group-members";
      memberEl.textContent = group.members.length + " member" + (group.members.length === 1 ? "" : "s");
      nameCol.appendChild(nameEl);
      nameCol.appendChild(memberEl);

      mainRow.appendChild(avatar);
      mainRow.appendChild(nameCol);

      if (options.muted) {
        const muteIcon = document.createElement("span");
        muteIcon.className = "jklm-ext-dms-mute-icon";
        muteIcon.textContent = "🔇";
        muteIcon.title = "Muted";
        mainRow.appendChild(muteIcon);
      }

      if (options.unreadCount) {
        const badge = document.createElement("span");
        badge.className = "jklm-ext-dms-unread-badge";
        badge.textContent = options.unreadCount > 9 ? "9+" : String(options.unreadCount);
        mainRow.appendChild(badge);
      }

      function activateChat() {
        sidebar
          .querySelectorAll(".jklm-ext-dms-friend-item")
          .forEach((el) => el.classList.remove("active"));
        item.classList.add("active");
        openGroupChat(group);
      }

      mainRow.addEventListener("click", activateChat);
      mainRow.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateChat();
        }
      });

      const menuBtn = document.createElement("button");
      menuBtn.type = "button";
      menuBtn.className = "jklm-ext-dms-friend-menu-btn";
      menuBtn.textContent = "⋮";
      menuBtn.setAttribute("aria-label", "More options");
      menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const alreadyOpen = item.querySelector(".jklm-ext-dms-menu");
        if (alreadyOpen) {
          closeAnyOpenMenu();
          return;
        }
        openMenuFor(item, menuBtn, [
          {
            label: "Copy Group ID",
            feedbackLabel: "Copied!",
            onClick: () => {
              navigator.clipboard.writeText(group.id).catch(() => { });
            }
          },
          {
            label: options.muted ? "Unmute" : "Mute",
            onClick: () => {
              loadMutedConversations().then((muted) => {
                const nextMuted = options.muted
                  ? muted.filter((id) => id !== group.id)
                  : [...muted, group.id];
                saveMutedConversations(nextMuted).then(() => {
                  loadFriendsList().then(renderSidebar);
                });
              });
            }
          },
          {
            label: "Leave Group",
            onClick: () => {
              if (!window.confirm('Leave "' + group.name + '"?')) return;
              sendWS({ type: "group_leave", groupId: group.id });
              if (activeFriendId === group.id) {
                if (pollInterval) clearInterval(pollInterval);
                if (currentChatListener) {
                  dmMessageListeners.delete(currentChatListener);
                  currentChatListener = null;
                }
                activeFriendId = null;
                activeConversationWith = null;
                renderEmptyState();
              }
            }
          }
        ]);
      });

      item.appendChild(mainRow);
      item.appendChild(menuBtn);
      return item;
    }

    // "+ Group" panel: name field + friend checkboxes, replaces the chat
    // area (same spot the empty state / an open chat would occupy) until
    // the group is created or the user picks a conversation instead.
    function openNewGroupForm() {
      sidebar.querySelectorAll(".jklm-ext-dms-friend-item").forEach((el) => el.classList.remove("active"));
      activeFriendId = null;
      if (pollInterval) clearInterval(pollInterval);
      if (currentChatListener) {
        dmMessageListeners.delete(currentChatListener);
        currentChatListener = null;
      }
      chatArea.innerHTML = "";

      const form = document.createElement("div");
      form.className = "jklm-ext-dms-new-group-form";

      const title = document.createElement("div");
      title.className = "jklm-ext-dms-chat-header-name";
      title.textContent = "New group chat";
      form.appendChild(title);

      const nameInput = document.createElement("input");
      nameInput.type = "text";
      nameInput.className = "jklm-ext-input";
      nameInput.placeholder = "Group name (optional)";
      nameInput.maxLength = 40;
      form.appendChild(nameInput);

      const membersLabel = document.createElement("div");
      membersLabel.className = "jklm-ext-dms-sidebar-section-label";
      membersLabel.textContent = "Invite friends";
      form.appendChild(membersLabel);

      const memberList = document.createElement("div");
      memberList.className = "jklm-ext-dms-new-group-members";
      form.appendChild(memberList);

      const errorEl = document.createElement("div");
      errorEl.className = "jklm-ext-input-error";
      errorEl.style.display = "none";
      form.appendChild(errorEl);

      const createBtn = document.createElement("button");
      createBtn.className = "jklm-ext-btn jklm-ext-btn-primary";
      createBtn.textContent = "Create Group";
      form.appendChild(createBtn);

      chatArea.appendChild(form);

      Promise.all([loadFriendsList(), loadUserRegistry()]).then(([friends, registry]) => {
        const byId = new Map(registry.map((r) => [r.id, r]));
        const realFriends = friends.filter((id) => id !== userId && id !== SYSTEM_BOT_ID);
        if (!realFriends.length) {
          memberList.textContent = "No friends to add yet — you can still create the group and invite people later.";
          return;
        }
        realFriends.forEach((id) => {
          const row = document.createElement("label");
          row.className = "jklm-ext-dms-new-group-member-row";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.value = id;
          const name = document.createElement("span");
          name.textContent = (byId.get(id) && byId.get(id).name) || id;
          row.appendChild(checkbox);
          row.appendChild(name);
          memberList.appendChild(row);
        });
      });

      createBtn.addEventListener("click", () => {
        const enteredName = nameInput.value.trim();
        const selected = Array.from(memberList.querySelectorAll("input[type=checkbox]:checked")).map(
          (cb) => cb.value
        );
        errorEl.style.display = "none";
        createBtn.disabled = true;
        createBtn.textContent = "Creating...";

        // No name typed in? Default to "<your name>'s Group" instead of
        // making the user pick one.
        const namePromise = enteredName
          ? Promise.resolve(enteredName)
          : loadProfileData().then((profile) => {
            const ownName = (profile.name || "").trim() || "Someone";
            return ownName + "'s Group";
          });

        namePromise.then((name) => {
          wsRequest("create_group", { name, members: selected }).then((res) => {
            createBtn.disabled = false;
            createBtn.textContent = "Create Group";
            if (!res || !res.ok) {
              errorEl.textContent = "Couldn't create the group — try again.";
              errorEl.style.display = "block";
              return;
            }
            loadGroupsCache().then((list) => {
              const others = list.filter((g) => g.id !== res.group.id);
              saveGroupsCache([...others, res.group]).then(() => {
                loadFriendsList().then(renderSidebar);
                openGroupChat(res.group);
              });
            });
          });
        });
      });
    }

    let sidebarRenderSeq = 0;

    function renderSidebar(friendIds) {
      closeAnyOpenMenu();
      const previousActive = activeFriendId;
      const renderSeq = ++sidebarRenderSeq;

      Promise.all([
        loadProfileData(),
        loadUserRegistry(),
        loadPinnedUsers(),
        loadUnreadCounts(),
        loadGroupsCache(),
        loadMutedConversations(),
        fetchPresence(friendIds.filter((id) => id !== userId && id !== SYSTEM_BOT_ID))
      ]).then(
        ([ownProfile, registry, pinnedIds, unreadMap, groups, mutedIds, presenceMap]) => {
          // A newer renderSidebar() call started after this one — its result
          // will replace the DOM instead, so don't let this stale call
          // append on top of it (which would duplicate every entry).
          if (renderSeq !== sidebarRenderSeq) return;

          const registryById = new Map(registry.map((entry) => [entry.id, entry]));
          const mutedSet = new Set(mutedIds);
          const fragment = document.createDocumentFragment();

          // Self chat ("write to yourself") — always pinned at the top.
          const ownRecord = registryById.get(userId);
          const ownName = (ownProfile.name || "").trim() || "You";
          const selfProfile = {
            id: userId,
            name: ownName + " (You)",
            avatarUrl: ownProfile.avatarUrl,
            bannerUrl: ownProfile.bannerUrl,
            status: ownProfile.status,
            roles: ownProfile.roles,
            description: ownProfile.description,
            banned: Boolean(ownRecord && ownRecord.banned),
            banReason: ownRecord && ownRecord.banReason
          };
          fragment.appendChild(createSidebarItem(selfProfile, { canPin: false, pinned: false, muted: mutedSet.has(userId) }));

          // Mio SystemBot — always pinned, independent of the friends list.
          const botRecord = registryById.get(SYSTEM_BOT_ID) || SYSTEM_BOT_PROFILE;
          const botProfile = {
            id: SYSTEM_BOT_ID,
            name: botRecord.name,
            avatarUrl: botRecord.avatarUrl,
            bannerUrl: botRecord.bannerUrl,
            status: botRecord.status,
            roles: botRecord.roles,
            description: botRecord.description,
            banned: Boolean(botRecord.banned),
            banReason: botRecord.banReason
          };
          const botItem = createSidebarItem(botProfile, { canPin: false, pinned: false, muted: mutedSet.has(SYSTEM_BOT_ID) });
          botItem.classList.add("jklm-ext-dms-friend-item-bot");
          fragment.appendChild(botItem);

          const realFriends = Array.from(new Set(friendIds)).filter(
            (id) => id !== userId && id !== SYSTEM_BOT_ID
          );
          const pinnedSet = new Set(pinnedIds);
          const pinnedFriends = realFriends
            .filter((id) => pinnedSet.has(id))
            .sort((a, b) => pinnedIds.indexOf(a) - pinnedIds.indexOf(b));
          const unpinnedFriends = realFriends.filter((id) => !pinnedSet.has(id));

          function appendFriendItem(id) {
            const record = registryById.get(id);
            if (!record || !record.name) {
              ensureUserProfile(id).then((profile) => {
                if (profile) loadFriendsList().then(renderSidebar);
              });
            }
            const presence = presenceMap[id];
            const profile = {
              id,
              name: (record && record.name) ? record.name : id,
              avatarUrl: record && record.avatarUrl,
              bannerUrl: record && record.bannerUrl,
              status: record && record.status,
              roles: record && record.roles,
              description: record && record.description,
              banned: Boolean(record && record.banned),
              banReason: record && record.banReason
            };
            fragment.appendChild(
              createSidebarItem(profile, {
                canPin: true,
                pinned: pinnedSet.has(id),
                unreadCount: unreadMap[id] || 0,
                online: Boolean(presence && presence.online),
                muted: mutedSet.has(id)
              })
            );
          }

          if (pinnedFriends.length) {
            const divider = document.createElement("div");
            divider.className = "jklm-ext-dms-sidebar-divider";
            fragment.appendChild(divider);
            pinnedFriends.forEach(appendFriendItem);
          }

          if (unpinnedFriends.length) {
            const divider = document.createElement("div");
            divider.className = "jklm-ext-dms-sidebar-divider";
            fragment.appendChild(divider);

            // Online friends first, then most-recently-active; unknown/never
            // synced presence falls back to name so ordering is still stable.
            const sortedFriends = unpinnedFriends.slice().sort((a, b) => {
              const aPresence = presenceMap[a];
              const bPresence = presenceMap[b];
              const aOnline = Boolean(aPresence && aPresence.online);
              const bOnline = Boolean(bPresence && bPresence.online);
              if (aOnline !== bOnline) return aOnline ? -1 : 1;
              const aTime = (aPresence && aPresence.lastActive) || 0;
              const bTime = (bPresence && bPresence.lastActive) || 0;
              return bTime - aTime;
            });

            sortedFriends.forEach(appendFriendItem);
          }

          const myGroups = groups.filter((g) => Array.isArray(g.members) && g.members.includes(userId));
          if (myGroups.length) {
            const groupDivider = document.createElement("div");
            groupDivider.className = "jklm-ext-dms-sidebar-divider";
            fragment.appendChild(groupDivider);

            const groupLabel = document.createElement("div");
            groupLabel.className = "jklm-ext-dms-sidebar-section-label";
            groupLabel.textContent = "Groups";
            fragment.appendChild(groupLabel);

            myGroups
              .slice()
              .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
              .forEach((group) => {
                fragment.appendChild(
                  createGroupSidebarItem(group, { unreadCount: unreadMap[group.id] || 0, muted: mutedSet.has(group.id) })
                );
              });
          }

          sidebar.innerHTML = "";
          sidebar.appendChild(fragment);

          if (previousActive) {
            const activeEl = sidebar.querySelector('[data-friend-id="' + CSS.escape(previousActive) + '"]');
            if (activeEl) activeEl.classList.add("active");
          }
        }
      );
    }

    newGroupBtn.addEventListener("click", openNewGroupForm);

    wrap.appendChild(sidebarCol);
    wrap.appendChild(chatArea);
    container.appendChild(wrap);

    renderEmptyState();
    loadFriendsList().then(renderSidebar);

    // Pull the authoritative group list from the server once on open (the
    // cache used for the initial instant render may be stale or empty).
    // This is merged into the local cache rather than replacing it outright —
    // if the server briefly returns an empty/incomplete list (e.g. right
    // after the extension reloads/updates and the socket is still
    // reconnecting), that shouldn't make groups the user is still in
    // silently vanish from their sidebar. Groups are only ever removed
    // locally in response to an explicit group_removed / group_left push
    // (see handleWSMessage), i.e. the user (or the owner) actually leaving
    // or being removed — never as a side effect of this background sync.
    wsRequest("get_groups", {}).then((res) => {
      if (!res || !Array.isArray(res.groups)) return;
      loadGroupsCache().then((existing) => {
        const byId = new Map(existing.map((g) => [g.id, g]));
        res.groups.forEach((g) => {
          if (g && g.id) byId.set(g.id, g);
        });
        saveGroupsCache(Array.from(byId.values())).then(() => {
          loadFriendsList().then(renderSidebar);
        });
      });
    });
  }

  function buildFriendsInfoPanel(container) {
    const wrap = document.createElement("div");
    wrap.className = "jklm-ext-profile-form";

    const items = [
      "Add: paste a known User ID to send a friend request. The other person must accept it before both of you are friends.",
      "Blocked: block a known User ID to stop them from interacting with you. Blocking also removes pending requests with that user.",
      "DMs: direct messages between friends — coming soon.",
      "Friends, requests and blocked lists are stored locally in your browser and aren't shared with anyone else yet."
    ];

    items.forEach((text) => {
      const line = document.createElement("div");
      line.className = "jklm-ext-settings-hint";
      line.style.marginTop = "0";
      line.style.marginBottom = "10px";
      line.textContent = text;
      wrap.appendChild(line);
    });

    container.appendChild(wrap);
  }

  function buildSettingsTab(container) {
    const settingsForm = document.createElement("div");
    settingsForm.className = "jklm-ext-profile-form";

    // Banner Upload
    const bannerRow = buildFormRow("Banner Image");
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.className = "jklm-ext-input jklm-ext-banner-file-input";
    fileInput.id = "jklm-ext-banner-file";
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function (event) {
          bannerDataUrl = event.target.result;
          openCropper(bannerDataUrl);
        };
        reader.readAsDataURL(file);
      }
    });
    bannerRow.appendChild(fileInput);
    formBannerFileInput = fileInput;
    settingsForm.appendChild(bannerRow);

    // Cropper Container
    const cropperContainer = document.createElement("div");
    cropperContainer.id = "jklm-ext-cropper-container";
    cropperContainer.style.cssText = `
        display: none;
        margin-top: 10px;
        margin-bottom: 15px;
        background: #0d0d0d;
        border-radius: 12px;
        padding: 16px;
        border: 1px solid #262626;
    `;
    settingsForm.appendChild(cropperContainer);

    // Banner Preview
    const previewRow = document.createElement("div");
    previewRow.className = "jklm-ext-form-row";
    const previewLabel = document.createElement("label");
    previewLabel.textContent = "Preview";
    previewRow.appendChild(previewLabel);

    const previewContainer = document.createElement("div");
    previewContainer.style.cssText = `
        width: 100%;
        height: 100px;
        border-radius: 8px;
        border: 1px solid #333;
        background: #1a1a1a;
        overflow: hidden;
        position: relative;
    `;

    const previewImg = document.createElement("img");
    previewImg.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center center;
        display: block;
    `;
    previewImg.src = DEFAULT_BANNER;
    previewContainer.appendChild(previewImg);
    formBannerPreview = previewImg;
    previewRow.appendChild(previewContainer);
    settingsForm.appendChild(previewRow);

    // Position Controls
    const positionRow = document.createElement("div");
    positionRow.className = "jklm-ext-form-row";
    const positionLabel = document.createElement("label");
    positionLabel.textContent = "Position";
    positionRow.appendChild(positionLabel);

    const positionControls = document.createElement("div");
    positionControls.style.cssText = "display: flex; gap: 12px; align-items: center; flex-wrap: wrap;";

    const xGroup = document.createElement("div");
    xGroup.style.cssText = "display: flex; align-items: center; gap: 6px;";
    const xLabel = document.createElement("span");
    xLabel.textContent = "X:";
    xLabel.style.cssText = "color: #999; font-size: 12px;";
    const xSelect = document.createElement("select");
    xSelect.className = "jklm-ext-input";
    xSelect.style.cssText = "padding: 4px 8px; font-size: 12px; width: 80px;";
    ["left", "center", "right"].forEach((pos) => {
      const opt = document.createElement("option");
      opt.value = pos;
      opt.textContent = pos.charAt(0).toUpperCase() + pos.slice(1);
      xSelect.appendChild(opt);
    });
    xSelect.value = "center";
    xSelect.addEventListener("change", updateBannerPreview);
    xGroup.appendChild(xLabel);
    xGroup.appendChild(xSelect);
    positionControls.appendChild(xGroup);
    formBannerPositionX = xSelect;

    const yGroup = document.createElement("div");
    yGroup.style.cssText = "display: flex; align-items: center; gap: 6px;";
    const yLabel = document.createElement("span");
    yLabel.textContent = "Y:";
    yLabel.style.cssText = "color: #999; font-size: 12px;";
    const ySelect = document.createElement("select");
    ySelect.className = "jklm-ext-input";
    ySelect.style.cssText = "padding: 4px 8px; font-size: 12px; width: 80px;";
    ["top", "center", "bottom"].forEach((pos) => {
      const opt = document.createElement("option");
      opt.value = pos;
      opt.textContent = pos.charAt(0).toUpperCase() + pos.slice(1);
      ySelect.appendChild(opt);
    });
    ySelect.value = "center";
    ySelect.addEventListener("change", updateBannerPreview);
    yGroup.appendChild(yLabel);
    yGroup.appendChild(ySelect);
    positionControls.appendChild(yGroup);
    formBannerPositionY = ySelect;

    const scaleGroup = document.createElement("div");
    scaleGroup.style.cssText = "display: flex; align-items: center; gap: 6px;";
    const scaleLabel = document.createElement("span");
    scaleLabel.textContent = "Size:";
    scaleLabel.style.cssText = "color: #999; font-size: 12px;";
    const scaleSelect = document.createElement("select");
    scaleSelect.className = "jklm-ext-input";
    scaleSelect.style.cssText = "padding: 4px 8px; font-size: 12px; width: 100px;";
    [
      { value: "cover", label: "Cover" },
      { value: "contain", label: "Contain" },
      { value: "fill", label: "Fill" }
    ].forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      scaleSelect.appendChild(option);
    });
    scaleSelect.value = "cover";
    scaleSelect.addEventListener("change", updateBannerPreview);
    scaleGroup.appendChild(scaleLabel);
    scaleGroup.appendChild(scaleSelect);
    positionControls.appendChild(scaleGroup);
    formBannerScale = scaleSelect;

    positionRow.appendChild(positionControls);
    settingsForm.appendChild(positionRow);

    // Reset Button
    const resetRow = document.createElement("div");
    resetRow.className = "jklm-ext-form-row";
    resetRow.style.marginTop = "10px";

    const resetBtn = document.createElement("button");
    resetBtn.className = "jklm-ext-btn jklm-ext-btn-secondary";
    resetBtn.textContent = "Reset to Default Banner";
    resetBtn.addEventListener("click", () => {
      bannerDataUrl = null;
      if (formBannerFileInput) formBannerFileInput.value = "";
      if (formBannerPreview) formBannerPreview.src = DEFAULT_BANNER;
      if (formBannerPositionX) formBannerPositionX.value = "center";
      if (formBannerPositionY) formBannerPositionY.value = "center";
      if (formBannerScale) formBannerScale.value = "cover";

      const cropperContainer = document.getElementById("jklm-ext-cropper-container");
      if (cropperContainer) {
        cropperContainer.style.display = "none";
        cropperContainer.innerHTML = "";
      }
      if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
      }
      updateBannerPreview();
    });
    resetRow.appendChild(resetBtn);

    settingsForm.appendChild(resetRow);

    // --- Notification sound -------------------------------------------
    const soundDivider = document.createElement("div");
    soundDivider.className = "jklm-ext-preview-divider";
    soundDivider.style.margin = "18px 0 14px";
    settingsForm.appendChild(soundDivider);

    const soundSectionLabel = document.createElement("div");
    soundSectionLabel.className = "jklm-ext-userid-label";
    soundSectionLabel.style.marginTop = "0";
    soundSectionLabel.textContent = "Notification Sound";
    settingsForm.appendChild(soundSectionLabel);

    const soundHint = document.createElement("div");
    soundHint.className = "jklm-ext-settings-hint";
    soundHint.style.marginTop = "0";
    soundHint.textContent = "Play a short chime when you get a DM or group message while the chat isn't open.";
    settingsForm.appendChild(soundHint);

    const soundToggleRow = buildFormRow("Play sound on new message");
    const soundToggle = document.createElement("input");
    soundToggle.type = "checkbox";
    soundToggle.className = "jklm-ext-checkbox";
    soundToggleRow.appendChild(soundToggle);
    settingsForm.appendChild(soundToggleRow);

    const volumeRow = buildFormRow("Volume");
    const volumeControls = document.createElement("div");
    volumeControls.style.cssText = "display: flex; align-items: center; gap: 10px; flex: 1;";
    const volumeSlider = document.createElement("input");
    volumeSlider.type = "range";
    volumeSlider.min = "0";
    volumeSlider.max = "1";
    volumeSlider.step = "0.05";
    volumeSlider.style.cssText = "flex: 1;";
    const testSoundBtn = document.createElement("button");
    testSoundBtn.type = "button";
    testSoundBtn.className = "jklm-ext-btn jklm-ext-btn-secondary";
    testSoundBtn.textContent = "🔊 Test";
    testSoundBtn.addEventListener("click", () => {
      playNotificationSound(parseFloat(volumeSlider.value), currentCustomSoundDataUrl);
    });
    volumeControls.appendChild(volumeSlider);
    volumeControls.appendChild(testSoundBtn);
    volumeRow.appendChild(volumeControls);
    settingsForm.appendChild(volumeRow);

    // --- Custom ping sound ----------------------------------------------
    const MAX_CUSTOM_SOUND_BYTES = 4 * 1024 * 1024; // chrome.storage.local's
    // default quota is ~5MB total, shared with every other saved setting —
    // add "unlimitedStorage" to manifest.json's permissions if you need
    // bigger files than this.

    let currentCustomSoundDataUrl = null;
    let currentCustomSoundName = null;

    const customSoundRow = buildFormRow("Custom ping sound");
    const customSoundControls = document.createElement("div");
    customSoundControls.style.cssText = "display: flex; align-items: center; gap: 10px; flex-wrap: wrap;";

    const customSoundFileInput = document.createElement("input");
    customSoundFileInput.type = "file";
    customSoundFileInput.accept = "audio/*";
    customSoundFileInput.className = "jklm-ext-input jklm-ext-banner-file-input";

    const customSoundRemoveBtn = document.createElement("button");
    customSoundRemoveBtn.type = "button";
    customSoundRemoveBtn.className = "jklm-ext-btn jklm-ext-btn-secondary";
    customSoundRemoveBtn.textContent = "Remove";
    customSoundRemoveBtn.style.display = "none";

    customSoundControls.appendChild(customSoundFileInput);
    customSoundControls.appendChild(customSoundRemoveBtn);
    customSoundRow.appendChild(customSoundControls);

    const customSoundStatus = document.createElement("div");
    customSoundStatus.className = "jklm-ext-settings-hint";
    customSoundStatus.style.marginTop = "6px";
    customSoundStatus.textContent = "No custom sound set — using default chime";
    customSoundRow.appendChild(customSoundStatus);

    settingsForm.appendChild(customSoundRow);

    function persistSoundSettings() {
      saveNotificationSoundSettings({
        enabled: soundToggle.checked,
        volume: parseFloat(volumeSlider.value),
        customSoundDataUrl: currentCustomSoundDataUrl,
        customSoundName: currentCustomSoundName
      });
    }

    customSoundFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > MAX_CUSTOM_SOUND_BYTES) {
        customSoundStatus.textContent =
          "That file is " + (file.size / 1024 / 1024).toFixed(1) + " MB — keep it under 4 MB.";
        customSoundFileInput.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        currentCustomSoundDataUrl = event.target.result;
        currentCustomSoundName = file.name;
        customSoundStatus.textContent = "Using: " + file.name;
        customSoundRemoveBtn.style.display = "";
        persistSoundSettings();
      };
      reader.readAsDataURL(file);
    });

    customSoundRemoveBtn.addEventListener("click", () => {
      currentCustomSoundDataUrl = null;
      currentCustomSoundName = null;
      customSoundFileInput.value = "";
      customSoundStatus.textContent = "No custom sound set — using default chime";
      customSoundRemoveBtn.style.display = "none";
      persistSoundSettings();
    });

    soundToggle.addEventListener("change", persistSoundSettings);
    volumeSlider.addEventListener("change", persistSoundSettings);

    loadNotificationSoundSettings().then((settings) => {
      soundToggle.checked = settings.enabled;
      volumeSlider.value = String(settings.volume);
      volumeSlider.disabled = !settings.enabled;
      currentCustomSoundDataUrl = settings.customSoundDataUrl || null;
      currentCustomSoundName = settings.customSoundName || null;
      if (currentCustomSoundDataUrl) {
        customSoundStatus.textContent = "Using: " + (currentCustomSoundName || "custom sound");
        customSoundRemoveBtn.style.display = "";
      }
    });
    soundToggle.addEventListener("change", () => {
      volumeSlider.disabled = !soundToggle.checked;
    });

    container.appendChild(settingsForm);
  }

  // ---------------------------------------------------------------------
  // Admin tab: role-gated panel (administrator or developer) for managing
  // roles / bans across all known users, plus a slash-command box for the
  // same actions. The tab itself is already hidden for non-admins (see
  // buildConfigPanelContent), this is just a defensive second check in
  // case currentUserRoles is stale for some reason.
  // ---------------------------------------------------------------------
  function buildAdminTab(container) {
    container.innerHTML = "";
    const hasAccess = currentUserRoles.includes("administrator") || currentUserRoles.includes("developer");
    if (!hasAccess) {
      renderAdminNoAccess(container);
    } else {
      renderAdminPanel(container);
    }
  }

  function renderAdminNoAccess(container) {
    const wrap = document.createElement("div");
    wrap.className = "jklm-ext-admin-login";

    const icon = document.createElement("div");
    icon.className = "jklm-ext-admin-login-icon";
    icon.textContent = "🔒";

    const title = document.createElement("div");
    title.className = "jklm-ext-admin-login-title";
    title.textContent = "Admin Panel";

    const subtitle = document.createElement("div");
    subtitle.className = "jklm-ext-admin-login-subtitle";
    subtitle.textContent = "You need the Administrator or Developer role to access this panel.";

    wrap.appendChild(icon);
    wrap.appendChild(title);
    wrap.appendChild(subtitle);
    container.appendChild(wrap);
  }

  function renderAdminPanel(container) {
    const wrap = document.createElement("div");
    wrap.className = "jklm-ext-admin-panel";

    const isDev = currentUserRoles.includes("developer");

    const header = document.createElement("div");
    header.className = "jklm-ext-admin-header";

    const headerTitle = document.createElement("span");
    headerTitle.textContent = "User management";
    header.appendChild(headerTitle);

    wrap.appendChild(header);

    // --- Slash commands -------------------------------------------------
    const cmdLabel = document.createElement("div");
    cmdLabel.className = "jklm-ext-userid-label";
    cmdLabel.style.marginTop = "0";
    cmdLabel.textContent = "Commands";
    wrap.appendChild(cmdLabel);

    const cmdHint = document.createElement("div");
    cmdHint.className = "jklm-ext-settings-hint";
    cmdHint.style.marginTop = "0";
    cmdHint.textContent = "/ban <userid> <reason>\n/unban <userid>\n/role <userid> <moderator|trusted|administrator|developer|user>";
    wrap.appendChild(cmdHint);

    const cmdRow = document.createElement("div");
    cmdRow.className = "jklm-ext-admin-cmd-row";

    const cmdInput = document.createElement("input");
    cmdInput.type = "text";
    cmdInput.className = "jklm-ext-input jklm-ext-admin-cmd-input";
    cmdInput.placeholder = "/ban y5I6xjWX77BiiHS1 spamming";
    cmdInput.autocomplete = "off";

    const cmdRunBtn = document.createElement("button");
    cmdRunBtn.type = "button";
    cmdRunBtn.className = "jklm-ext-btn jklm-ext-btn-primary";
    cmdRunBtn.textContent = "Run";

    cmdRow.appendChild(cmdInput);
    cmdRow.appendChild(cmdRunBtn);
    wrap.appendChild(cmdRow);

    const cmdLog = document.createElement("div");
    cmdLog.className = "jklm-ext-admin-cmd-log";
    wrap.appendChild(cmdLog);

    function logCommand(text, ok) {
      const line = document.createElement("div");
      line.className = "jklm-ext-admin-cmd-log-line" + (ok ? "" : " jklm-ext-admin-cmd-log-error");
      line.textContent = text;
      cmdLog.insertBefore(line, cmdLog.firstChild);
      while (cmdLog.children.length > 20) cmdLog.removeChild(cmdLog.lastChild);
    }

    const ROLE_NAMES = ["moderator", "user", "administrator", "developer", "trusted"];

    // Writes an admin_ban_result / admin_unban_result response (which
    // carries the server's authoritative post-change profile) into the
    // local registry cache. Used so the command list reflects the change
    // immediately instead of showing whatever was cached before the call.
    function mergeAdminResultIntoRegistry(target, res) {
      return loadUserRegistry().then((registry) => {
        const existing = registry.find((u) => u.id === target) || {};
        const merged = {
          ...existing,
          id: target,
          roles: res.profile && Array.isArray(res.profile.roles) ? res.profile.roles : existing.roles,
          banned: res.profile ? Boolean(res.profile.banned) : Boolean(res.banned),
          banReason: res.profile ? (res.profile.banReason || "") : ""
        };
        const others = registry.filter((u) => u.id !== target);
        return saveUserRegistry([...others, merged]);
      });
    }

    function runCommand() {
      const raw = cmdInput.value.trim();
      if (!raw) return;
      const match = raw.match(/^\/(\w+)\s*(.*)$/);
      if (!match) {
        logCommand("Unknown input — commands start with /", false);
        return;
      }
      const cmd = match[1].toLowerCase();
      const rest = match[2].trim();

      if (cmd === "ban") {
        const parts = rest.split(/\s+/);
        const target = parts.shift();
        const reason = parts.join(" ").trim();
        if (!target || !reason) {
          logCommand("Usage: /ban <userid> <reason>", false);
          return;
        }
        if (target === userId) {
          logCommand("You can't ban yourself.", false);
          return;
        }
        cmdInput.value = "";
        wsRequest("admin_ban_user", { target, reason }).then((res) => {
          if (res && res.ok) {
            logCommand("Banned " + target + " (" + reason + ")", true);
            mergeAdminResultIntoRegistry(target, res).then(refreshRegistry);
          } else {
            logCommand("Ban failed: " + describeAdminError(res), false);
          }
        });
        return;
      }

      if (cmd === "unban") {
        const target = rest.split(/\s+/)[0];
        if (!target) {
          logCommand("Usage: /unban <userid>", false);
          return;
        }
        cmdInput.value = "";
        wsRequest("admin_unban_user", { target }).then((res) => {
          if (res && res.ok) {
            logCommand("Unbanned " + target, true);
            mergeAdminResultIntoRegistry(target, res).then(refreshRegistry);
          } else {
            logCommand("Unban failed: " + describeAdminError(res), false);
          }
        });
        return;
      }

      if (cmd === "role") {
        const parts = rest.split(/\s+/);
        const target = parts[0];
        const role = (parts[1] || "").toLowerCase();
        if (!target || !role) {
          logCommand("Usage: /role <userid> <role>", false);
          return;
        }
        if (!ROLE_NAMES.includes(role)) {
          logCommand("Unknown role. Use one of: " + ROLE_NAMES.join(", "), false);
          return;
        }
        if (target === userId && !isDev) {
          logCommand("Administrators can't change their own roles.", false);
          return;
        }
        cmdInput.value = "";
        if (target === userId) suppressOwnRoleRebuild = true;
        wsRequest("admin_set_role", { target, role }).then((res) => {
          if (res && res.ok) {
            logCommand(target + " roles: " + res.roles.join(", "), true);
            // Mirror the server's authoritative result into the local
            // registry cache before refreshing — refreshRegistry() alone
            // just re-reads whatever was cached before this call, so
            // without this the list/popup kept showing the old role even
            // though the server had already toggled it.
            loadUserRegistry().then((registry) => {
              const existing = registry.find((u) => u.id === target) || {};
              const merged = {
                ...existing,
                id: target,
                roles: res.roles,
                banned: res.profile ? Boolean(res.profile.banned) : existing.banned,
                banReason: res.profile ? (res.profile.banReason || "") : existing.banReason
              };
              const others = registry.filter((u) => u.id !== target);
              saveUserRegistry([...others, merged]).then(() => {
                if (target === userId) {
                  currentUserRoles = res.roles;
                  renderRoleBadges(formRolesWrap, true);
                  renderRoleBadges(previewRolesWrap, false);
                }
                refreshRegistry();
              });
            });
          } else {
            suppressOwnRoleRebuild = false;
            logCommand("Role change failed: " + describeAdminError(res), false);
          }
        });
        return;
      }

      logCommand("Unknown command \"/" + cmd + "\". Available: /ban, /unban, /role", false);
    }

    function describeAdminError(res) {
      const code = res && res.error;
      if (code === "forbidden") return "you don't have permission";
      if (code === "invalid_target") return "unknown user";
      if (code === "invalid_role") return "invalid role";
      if (code === "invalid_text") return "message text is empty";
      if (code === "cant_ban_self") return "you can't ban yourself";
      if (code === "cant_edit_self") return "you can't change your own roles";
      if (code === "insufficient_rank") return "administrators can't ban other administrators or developers";
      return "unknown error";
    }

    cmdRunBtn.addEventListener("click", runCommand);
    cmdInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        runCommand();
      }
    });

    const botDivider = document.createElement("div");
    botDivider.className = "jklm-ext-preview-divider";
    wrap.appendChild(botDivider);

    // --- Send message as MioBot ------------------------------------------
    const botLabel = document.createElement("div");
    botLabel.className = "jklm-ext-userid-label";
    botLabel.style.marginTop = "0";
    botLabel.textContent = "Send message as MioBot";
    wrap.appendChild(botLabel);

    const botHint = document.createElement("div");
    botHint.className = "jklm-ext-settings-hint";
    botHint.style.marginTop = "0";
    botHint.textContent = "Leave the User ID empty to send to every user.";
    wrap.appendChild(botHint);

    const botTargetInput = document.createElement("input");
    botTargetInput.type = "text";
    botTargetInput.className = "jklm-ext-input jklm-ext-admin-cmd-input";
    botTargetInput.placeholder = "User ID (empty = all users)";
    botTargetInput.autocomplete = "off";
    wrap.appendChild(botTargetInput);

    const botTextRow = document.createElement("div");
    botTextRow.className = "jklm-ext-admin-cmd-row jklm-ext-admin-cmd-row-textarea";

    const botTextInput = document.createElement("textarea");
    botTextInput.className = "jklm-ext-input jklm-ext-textarea jklm-ext-admin-bot-textarea";
    botTextInput.placeholder = "Message text";
    botTextInput.autocomplete = "off";
    botTextInput.maxLength = 500;
    botTextInput.rows = 4;

    const botSendBtn = document.createElement("button");
    botSendBtn.type = "button";
    botSendBtn.className = "jklm-ext-btn jklm-ext-btn-primary";
    botSendBtn.textContent = "Send";

    botTextRow.appendChild(botTextInput);
    botTextRow.appendChild(botSendBtn);
    wrap.appendChild(botTextRow);

    function sendAsBot() {
      const target = botTargetInput.value.trim();
      const text = botTextInput.value.trim();
      if (!text) {
        logCommand("Enter a message to send.", false);
        return;
      }
      botSendBtn.disabled = true;
      wsRequest("admin_send_as_bot", { target: target || null, text }).then((res) => {
        botSendBtn.disabled = false;
        if (res && res.ok) {
          botTextInput.value = "";
          logCommand(
            res.target ? "Sent as MioBot to " + res.target : "Sent as MioBot to all users (" + res.count + ")",
            true
          );
        } else {
          logCommand("Send as MioBot failed: " + describeAdminError(res), false);
        }
      });
    }

    // Sending is deliberately gated behind the Send button only — this is a
    // multi-line textarea now, so Enter should just insert a newline like
    // any other textarea, not submit the message.
    botSendBtn.addEventListener("click", sendAsBot);

    const divider = document.createElement("div");
    divider.className = "jklm-ext-preview-divider";
    wrap.appendChild(divider);

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "jklm-ext-input jklm-ext-admin-search-input";
    searchInput.placeholder = "Search by username or User ID...";
    wrap.appendChild(searchInput);

    const resultsWrap = document.createElement("div");
    resultsWrap.className = "jklm-ext-admin-user-list";
    wrap.appendChild(resultsWrap);

    const ASSIGNABLE_ROLES = ["administrator", "moderator", "trusted", "developer"];
    let cachedRegistry = [];

    function renderResults() {
      resultsWrap.innerHTML = "";
      const query = searchInput.value.trim().toLowerCase();

      if (!query) {
        const hint = document.createElement("div");
        hint.className = "jklm-ext-settings-hint";
        hint.style.marginTop = "0";
        hint.textContent = "Start typing a username or User ID to search.";
        resultsWrap.appendChild(hint);
        return;
      }

      const matches = cachedRegistry
        .filter((entry) => {
          // Administrators can't manage themselves through this panel at
          // all, so keep them out of their own search results. Developers
          // are exempt — "kann alles außer sich selber bannen".
          if (entry.id === userId && !isDev) return false;
          const name = (entry.name || "").toLowerCase();
          const id = (entry.id || "").toLowerCase();
          return name.includes(query) || id.includes(query);
        })
        .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));

      if (!matches.length) {
        const empty = document.createElement("div");
        empty.className = "jklm-ext-settings-hint";
        empty.style.marginTop = "0";
        empty.textContent = "No users found.";
        resultsWrap.appendChild(empty);
        return;
      }

      matches.forEach((entry) => {
        const row = document.createElement("div");
        row.className = "jklm-ext-admin-user-row jklm-ext-admin-search-row";
        row.setAttribute("role", "button");
        row.tabIndex = 0;

        const avatar = document.createElement("img");
        avatar.className = "jklm-ext-admin-search-avatar";
        avatar.src = entry.avatarUrl || DEFAULT_AVATAR;
        avatar.alt = entry.name || entry.id;

        const info = document.createElement("div");
        info.className = "jklm-ext-admin-user-info";

        const nameEl = document.createElement("div");
        nameEl.className = "jklm-ext-admin-user-name";
        nameEl.textContent = entry.name || entry.id;
        if (entry.banned) {
          const banTag = document.createElement("span");
          banTag.className = "jklm-ext-admin-banned-tag";
          banTag.textContent = "BANNED";
          nameEl.appendChild(banTag);
        }

        const idEl = document.createElement("div");
        idEl.className = "jklm-ext-admin-user-id";
        idEl.textContent = entry.id;

        info.appendChild(nameEl);
        info.appendChild(idEl);

        row.appendChild(avatar);
        row.appendChild(info);

        const openPopup = () => openAdminUserPopup(entry.id);
        row.addEventListener("click", openPopup);
        row.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPopup();
          }
        });

        resultsWrap.appendChild(row);
      });
    }

    function refreshRegistry() {
      return loadUserRegistry().then((registry) => {
        cachedRegistry = registry;
        renderResults();
        return registry;
      });
    }

    searchInput.addEventListener("input", renderResults);

    function openAdminUserPopup(id) {
      const entry = cachedRegistry.find((u) => u.id === id);
      if (!entry) return;

      const existingOverlay = document.getElementById("jklm-ext-admin-user-popup-overlay");
      if (existingOverlay) existingOverlay.remove();

      const overlay = document.createElement("div");
      overlay.id = "jklm-ext-admin-user-popup-overlay";
      overlay.className = "jklm-ext-config-overlay";

      const panel = document.createElement("div");
      panel.className = "jklm-ext-admin-user-popup";

      const closeBtn = document.createElement("button");
      closeBtn.className = "jklm-ext-config-close";
      closeBtn.textContent = "✕";
      closeBtn.addEventListener("click", () => overlay.remove());

      const body = document.createElement("div");
      body.className = "jklm-ext-admin-popup-body";

      function afterChange(target) {
        if (target.id === userId) {
          currentUserRoles = target.roles;
          renderRoleBadges(formRolesWrap, true);
          renderRoleBadges(previewRolesWrap, false);
        }
        refreshRegistry().then((registry) => {
          const fresh = registry.find((u) => u.id === target.id);
          if (fresh) renderBody(fresh);
        });
      }

      function renderBody(current) {
        body.innerHTML = "";

        const headRow = document.createElement("div");
        headRow.className = "jklm-ext-admin-popup-head";

        const avatar = document.createElement("img");
        avatar.className = "jklm-ext-admin-popup-avatar";
        avatar.src = current.avatarUrl || DEFAULT_AVATAR;
        avatar.alt = current.name || current.id;

        const info = document.createElement("div");
        info.className = "jklm-ext-admin-user-info";

        const nameEl = document.createElement("div");
        nameEl.className = "jklm-ext-admin-user-name";
        nameEl.textContent = current.name || current.id;
        if (current.banned) {
          const banTag = document.createElement("span");
          banTag.className = "jklm-ext-admin-banned-tag";
          banTag.textContent = "BANNED";
          nameEl.appendChild(banTag);
        }

        const idEl = document.createElement("div");
        idEl.className = "jklm-ext-admin-user-id";
        idEl.textContent = current.id;

        info.appendChild(nameEl);
        info.appendChild(idEl);

        headRow.appendChild(avatar);
        headRow.appendChild(info);
        body.appendChild(headRow);

        const rolesLabel = document.createElement("div");
        rolesLabel.className = "jklm-ext-userid-label";
        rolesLabel.style.marginTop = "18px";
        rolesLabel.textContent = "Roles";
        body.appendChild(rolesLabel);

        const isSelf = current.id === userId;
        // Administrators can't touch their own roles at all; developers can
        // ("kann alles außer sich selber bannen").
        const rolesLocked = isSelf && !isDev;

        if (rolesLocked) {
          const lockedNote = document.createElement("div");
          lockedNote.className = "jklm-ext-admin-system-note";
          lockedNote.textContent = "You can't change your own roles.";
          body.appendChild(lockedNote);
        }

        const rolesWrap = document.createElement("div");
        rolesWrap.className = "jklm-ext-admin-role-toggles";
        const entryRoles = new Set(Array.isArray(current.roles) ? current.roles : []);

        ROLE_DEFINITIONS.filter((r) => ASSIGNABLE_ROLES.includes(r.id)).forEach((roleDef) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "jklm-ext-admin-role-chip" + (entryRoles.has(roleDef.id) ? " active" : "");
          chip.style.setProperty("--jklm-ext-role-color", roleDef.color);
          chip.textContent = roleDef.label;
          if (rolesLocked) {
            chip.disabled = true;
          } else {
            chip.addEventListener("click", () => {
              chip.disabled = true;
              // Roles are server-authoritative — ask the server to toggle
              // this role, then mirror the result into the local cache.
              // This is the same admin_set_role call the /role slash
              // command uses.
              if (current.id === userId) suppressOwnRoleRebuild = true;
              wsRequest("admin_set_role", { target: current.id, role: roleDef.id }).then((res) => {
                chip.disabled = false;
                if (!res || !res.ok) {
                  suppressOwnRoleRebuild = false;
                  return;
                }
                loadUserRegistry().then((currentRegistry) => {
                  const target = currentRegistry.find((u) => u.id === current.id);
                  if (!target) return;
                  target.roles = res.roles;
                  saveUserRegistry(currentRegistry).then(() => afterChange(target));
                });
              });
            });
          }
          rolesWrap.appendChild(chip);
        });
        body.appendChild(rolesWrap);

        const banLabel = document.createElement("div");
        banLabel.className = "jklm-ext-userid-label";
        banLabel.style.marginTop = "18px";
        banLabel.textContent = "Ban status";
        body.appendChild(banLabel);

        const banWrap = document.createElement("div");
        banWrap.className = "jklm-ext-admin-ban-wrap";

        if (current.id === SYSTEM_BOT_ID) {
          const systemNote = document.createElement("span");
          systemNote.className = "jklm-ext-admin-system-note";
          systemNote.textContent = "System account — can't be banned";
          banWrap.appendChild(systemNote);
        } else if (isSelf) {
          // Nobody — not even developers — can ban themselves.
          const selfNote = document.createElement("span");
          selfNote.className = "jklm-ext-admin-system-note";
          selfNote.textContent = "You can't ban yourself.";
          banWrap.appendChild(selfNote);
        } else if (!isDev && (entryRoles.has("developer") || entryRoles.has("administrator"))) {
          // Plain administrators can't ban other administrators or
          // developers — only a developer can do that.
          const rankNote = document.createElement("span");
          rankNote.className = "jklm-ext-admin-system-note";
          rankNote.textContent = "Only a Developer can ban an Administrator or Developer.";
          banWrap.appendChild(rankNote);
        } else if (current.banned) {
          const reasonDisplay = document.createElement("div");
          reasonDisplay.className = "jklm-ext-admin-ban-reason-display";
          reasonDisplay.textContent = current.banReason
            ? "Reason: " + current.banReason
            : "No reason given";

          const unbanBtn = document.createElement("button");
          unbanBtn.type = "button";
          unbanBtn.className = "jklm-ext-btn jklm-ext-btn-secondary jklm-ext-admin-ban-btn";
          unbanBtn.textContent = "Unban";
          unbanBtn.addEventListener("click", () => {
            unbanBtn.disabled = true;
            // Ban status lives on the server so it's the same for every
            // client — the banned user's own device and anyone previewing
            // their profile. Ask the server to unban, then mirror the
            // result into the local registry cache. Access is checked
            // server-side via the caller's own role, no password needed.
            wsRequest("admin_unban_user", { target: current.id }).then((res) => {
              unbanBtn.disabled = false;
              if (!res || !res.ok) return;
              loadUserRegistry().then((currentRegistry) => {
                const target = currentRegistry.find((u) => u.id === current.id);
                if (!target) return;
                target.banned = false;
                target.banReason = "";
                const roleSet = new Set(Array.isArray(target.roles) ? target.roles : ["user"]);
                roleSet.delete("banned");
                target.roles = Array.from(roleSet);
                saveUserRegistry(currentRegistry).then(() => afterChange(target));
              });
            });
          });

          banWrap.appendChild(reasonDisplay);
          banWrap.appendChild(unbanBtn);
        } else {
          const reasonInput = document.createElement("input");
          reasonInput.type = "text";
          reasonInput.className = "jklm-ext-input jklm-ext-admin-ban-reason-input";
          reasonInput.placeholder = "Reason for ban...";
          reasonInput.maxLength = 200;
          reasonInput.addEventListener("input", () => {
            reasonInput.classList.remove("jklm-ext-input-error");
          });

          const banBtn = document.createElement("button");
          banBtn.type = "button";
          banBtn.className = "jklm-ext-btn jklm-ext-btn-secondary jklm-ext-admin-ban-btn";
          banBtn.textContent = "Ban";
          banBtn.addEventListener("click", () => {
            const reason = reasonInput.value.trim();
            if (!reason) {
              reasonInput.classList.add("jklm-ext-input-error");
              reasonInput.placeholder = "A reason is required";
              reasonInput.focus();
              return;
            }
            banBtn.disabled = true;
            // Ban status lives on the server so it's the same for every
            // client — the banned user's own device (locked out live if
            // they're online right now) and anyone previewing their
            // profile. Ask the server to ban, then mirror the result into
            // the local registry cache. Access is checked server-side via
            // the caller's own role, no password needed.
            wsRequest("admin_ban_user", { target: current.id, reason }).then((res) => {
              banBtn.disabled = false;
              if (!res || !res.ok) return;
              loadUserRegistry().then((currentRegistry) => {
                const target = currentRegistry.find((u) => u.id === current.id);
                if (!target) return;
                target.banned = true;
                target.banReason = reason;
                const roleSet = new Set(Array.isArray(target.roles) ? target.roles : ["user"]);
                roleSet.add("banned");
                target.roles = Array.from(roleSet);
                saveUserRegistry(currentRegistry).then(() => afterChange(target));
              });
            });
          });

          banWrap.appendChild(reasonInput);
          banWrap.appendChild(banBtn);
        }

        body.appendChild(banWrap);
      }

      renderBody(entry);

      panel.appendChild(closeBtn);
      panel.appendChild(body);
      overlay.appendChild(panel);
      document.body.appendChild(overlay);

      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.remove();
      });
    }

    refreshRegistry();
    container.appendChild(wrap);
  }

  function openCropper(imageUrl) {
    const container = document.getElementById("jklm-ext-cropper-container");
    if (!container) return;

    if (cropperInstance) {
      cropperInstance.destroy();
      cropperInstance = null;
    }

    container.style.display = "block";
    container.innerHTML = "";

    const imgWrapper = document.createElement("div");
    imgWrapper.style.cssText = `
        width: 100%;
        max-height: 350px;
        overflow: hidden;
        border-radius: 8px;
        background: #0a0a0a;
    `;

    const img = document.createElement("img");
    img.id = "jklm-ext-cropper-image";
    img.src = imageUrl;
    img.style.cssText = "max-width: 100%; display: block;";
    imgWrapper.appendChild(img);
    container.appendChild(imgWrapper);

    // Toolbar
    const toolbar = document.createElement("div");
    toolbar.style.cssText = `
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-top: 12px;
        flex-wrap: wrap;
    `;

    const tools = [
      { label: "🔍 Zoom +", action: () => { if (cropperInstance) cropperInstance.zoom(0.1); } },
      { label: "🔍 Zoom -", action: () => { if (cropperInstance) cropperInstance.zoom(-0.1); } },
      { label: "🔄 Rotate", action: () => { if (cropperInstance) cropperInstance.rotate(90); } },
      { label: "↔️ Flip H", action: () => { if (cropperInstance) cropperInstance.scaleX(-cropperInstance.getData().scaleX || -1); } },
      { label: "↕️ Flip V", action: () => { if (cropperInstance) cropperInstance.scaleY(-cropperInstance.getData().scaleY || -1); } },
    ];

    tools.forEach((tool) => {
      const btn = document.createElement("button");
      btn.className = "jklm-ext-btn jklm-ext-btn-secondary";
      btn.textContent = tool.label;
      btn.style.cssText = "padding: 4px 12px; font-size: 12px;";
      btn.addEventListener("click", tool.action);
      toolbar.appendChild(btn);
    });

    container.appendChild(toolbar);

    // Buttons
    const btnRow = document.createElement("div");
    btnRow.style.cssText = `
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 12px;
    `;

    const resetBtn = document.createElement("button");
    resetBtn.className = "jklm-ext-btn jklm-ext-btn-secondary";
    resetBtn.textContent = "Reset";
    resetBtn.style.cssText = "padding: 6px 16px; font-size: 12px;";
    resetBtn.addEventListener("click", () => {
      if (cropperInstance) {
        cropperInstance.reset();
        cropperInstance.clear();
        cropperInstance.crop();
      }
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "jklm-ext-btn jklm-ext-btn-secondary";
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = "padding: 6px 16px; font-size: 12px;";
    cancelBtn.addEventListener("click", () => {
      container.style.display = "none";
      container.innerHTML = "";
      if (formBannerFileInput) formBannerFileInput.value = "";
      bannerDataUrl = null;
      if (cropperInstance) {
        cropperInstance.destroy();
        cropperInstance = null;
      }
    });

    const applyBtn = document.createElement("button");
    applyBtn.className = "jklm-ext-btn jklm-ext-btn-primary";
    applyBtn.textContent = "Apply";
    applyBtn.style.cssText = "padding: 6px 16px; font-size: 12px;";
    applyBtn.addEventListener("click", () => {
      if (cropperInstance) {
        const croppedCanvas = cropperInstance.getCroppedCanvas({
          width: 800,
          height: 200,
          fillColor: '#2d3748',
        });

        if (croppedCanvas) {
          const croppedDataUrl = croppedCanvas.toDataURL('image/png');

          if (formBannerPreview) {
            formBannerPreview.src = croppedDataUrl;
          }

          bannerDataUrl = croppedDataUrl;
          updateBannerPreview();

          container.style.display = "none";
          container.innerHTML = "";

          if (cropperInstance) {
            cropperInstance.destroy();
            cropperInstance = null;
          }
        }
      }
    });

    btnRow.appendChild(resetBtn);
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(applyBtn);
    container.appendChild(btnRow);

    const hint = document.createElement("div");
    hint.style.cssText = "color: #666; font-size: 11px; margin-top: 8px; text-align: center;";
    hint.textContent = "Drag the frame to define the visible area. Use the tools to adjust.";
    container.appendChild(hint);

    setTimeout(() => {
      const imageEl = document.getElementById("jklm-ext-cropper-image");
      if (imageEl && typeof Cropper !== 'undefined') {
        cropperInstance = new Cropper(imageEl, {
          aspectRatio: 4 / 1,
          viewMode: 1,
          dragMode: 'move',
          autoCropArea: 0.8,
          restore: false,
          guides: true,
          center: true,
          highlight: false,
          cropBoxMovable: true,
          cropBoxResizable: true,
          toggleDragModeOnDblclick: true,
        });
      } else {
        console.warn('Cropper.js not loaded');
      }
    }, 100);
  }

  function updateBannerPreview() {
    const src = bannerDataUrl || DEFAULT_BANNER;
    const x = formBannerPositionX ? formBannerPositionX.value : "center";
    const y = formBannerPositionY ? formBannerPositionY.value : "center";
    const scale = formBannerScale ? formBannerScale.value : "cover";

    if (formBannerPreview) {
      formBannerPreview.src = src;
      formBannerPreview.style.objectFit = scale;
      formBannerPreview.style.objectPosition = x + " " + y;
    }

    if (previewBanner) {
      previewBanner.style.backgroundImage = `url(${src})`;
      previewBanner.style.backgroundSize = scale;
      previewBanner.style.backgroundPosition = x + " " + y;
      previewBanner.style.backgroundRepeat = "no-repeat";
    }
  }

  function buildFormRow(labelText) {
    const row = document.createElement("div");
    row.className = "jklm-ext-form-row";
    const label = document.createElement("label");
    label.textContent = labelText;
    row.appendChild(label);
    return row;
  }

  function buildFormRowWithCounter(labelText, maxLength) {
    const row = document.createElement("div");
    row.className = "jklm-ext-form-row";

    const labelRow = document.createElement("div");
    labelRow.className = "jklm-ext-form-label-row";

    const label = document.createElement("label");
    label.textContent = labelText;

    const counter = document.createElement("span");
    counter.className = "jklm-ext-char-counter";
    counter.textContent = "0/" + maxLength;

    labelRow.appendChild(label);
    labelRow.appendChild(counter);
    row.appendChild(labelRow);

    return { row, counter };
  }

  function populateForm(data) {
    if (formPicInput) {
      formPicInput.value = data.avatarUrl || '';
      if (profileAvatarImg) profileAvatarImg.src = data.avatarUrl || DEFAULT_AVATAR;
      if (previewAvatarImg) previewAvatarImg.src = data.avatarUrl || DEFAULT_AVATAR;
    }
    if (formNameInput) {
      formNameInput.value = data.name || '';
      if (formNameCounter) {
        formNameCounter.textContent = (data.name || '').length + '/' + NAME_MAX_LENGTH;
      }
      if (profileNameEl) {
        const name = (data.name || '').trim();
        profileNameEl.textContent = name.slice(0, PANEL_NAME_PREVIEW_LENGTH) || "No name yet";
      }
      if (previewNameEl) {
        previewNameEl.textContent = (data.name || '').trim() || "No name yet";
      }
    }
    if (formStatusSelect) {
      const status = data.status || 'online';
      formStatusSelect.value = status;
      const selected = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];
      if (formStatusDot) formStatusDot.style.backgroundColor = selected.color;
      formStatusSelect.style.color = selected.color;
      applyPreviewStatus(selected);
    }
    if (formDescInput) {
      formDescInput.value = data.description || '';
      if (formDescCounter) {
        formDescCounter.textContent = (data.description || '').length + '/' + DESCRIPTION_MAX_LENGTH;
      }
      if (profileDescEl) {
        const desc = (data.description || '').trim();
        profileDescEl.textContent = desc.slice(0, PANEL_DESCRIPTION_PREVIEW_LENGTH) || "No description yet";
      }
      if (previewDescEl) {
        previewDescEl.textContent = (data.description || '').trim() || "No description yet";
      }
    }

    // Banner
    if (formBannerPreview) {
      const bannerSrc = data.bannerUrl || DEFAULT_BANNER;
      formBannerPreview.src = bannerSrc;
      formBannerPreview.style.objectFit = data.bannerScale || 'cover';
      formBannerPreview.style.objectPosition = data.bannerPosition || 'center center';
    }
    if (formBannerPositionX && data.bannerPosition) {
      const pos = data.bannerPosition.split(' ');
      if (pos.length === 2) {
        formBannerPositionX.value = pos[0] || 'center';
        formBannerPositionY.value = pos[1] || 'center';
      }
    }
    if (formBannerScale && data.bannerScale) {
      formBannerScale.value = data.bannerScale;
    }

    // Banner in Preview aktualisieren
    if (data.bannerUrl) {
      bannerDataUrl = data.bannerUrl;
      setTimeout(updateBannerPreview, 50);
    }

    renderRoleBadges(formRolesWrap, true);
    renderRoleBadges(previewRolesWrap, false);

    const userIdEl = document.querySelector('.jklm-ext-userid-value');
    if (userIdEl && userId) {
      userIdEl.textContent = userId;
    }
  }

  function saveCurrentProfileData() {
    const data = {
      avatarUrl: formPicInput ? formPicInput.value.trim() || DEFAULT_AVATAR : DEFAULT_AVATAR,
      bannerUrl: bannerDataUrl || DEFAULT_BANNER,
      bannerPosition: (formBannerPositionX && formBannerPositionY)
        ? formBannerPositionX.value + ' ' + formBannerPositionY.value
        : 'center center',
      bannerScale: formBannerScale ? formBannerScale.value : 'cover',
      name: formNameInput ? formNameInput.value : '',
      status: formStatusSelect ? formStatusSelect.value : 'online',
      description: formDescInput ? formDescInput.value : ''
      // No roles/banned/banReason here — those are server-authoritative
      // (see refreshOwnServerState / the role_updated & you_are_banned
      // handlers) and the server ignores/strips these fields anyway if we
      // did send them.
    };

    const nextName = (data.name || '').trim().toLowerCase();
    return loadUserRegistry().then((registry) => {
      const existing = registry.find((entry) => entry.id === userId);
      const duplicate = registry.some((entry) => entry.id !== userId && entry.name && entry.name.trim().toLowerCase() === nextName);
      if (nextName && duplicate) {
        throw new Error("That username is already taken.");
      }

      const updatedRegistry = registry.filter((entry) => entry.id !== userId);
      const currentRecord = {
        id: userId,
        name: data.name || 'User',
        roles: existing && Array.isArray(existing.roles) ? existing.roles : currentUserRoles,
        status: data.status || 'online',
        description: data.description || '',
        banned: existing && existing.banned,
        banReason: existing && existing.banReason
      };

      return saveProfileData(data).then(() => saveUserRegistry([...updatedRegistry, currentRecord])).then(() => {
        renderRoleBadges(formRolesWrap, true);
        renderRoleBadges(previewRolesWrap, false);
        sendWS({ type: "sync_profile", profile: data });
      });
    });
  }

  let currentUserRoles = ["user"];
  // Set right before we ask the server to change OUR OWN roles from inside
  // the admin panel (self-testing, e.g. a developer toggling their own
  // roles). Without this, the role_updated push the server sends back to
  // us for that same change raced with our own in-flight UI update: it
  // tore down and rebuilt the entire settings overlay (the "panel closes
  // and reopens" symptom) out from under the popup that initiated the
  // change, so the toggle's own follow-up DOM update landed on now-detached
  // elements and never visibly took effect. Consumed once by the
  // role_updated handler below.
  let suppressOwnRoleRebuild = false;

  function renderRoleBadges(target, large) {
    if (!target) return;
    target.innerHTML = "";

    if (currentUserRoles.length) {
      // Display order follows ROLE_DEFINITIONS (SystemBot, Mio, Developer,
      // Administrator, Moderator, Trusted, User), not the raw order roles
      // happen to be stored in on the user's record.
      ROLE_DEFINITIONS.filter((roleDef) => currentUserRoles.includes(roleDef.id)).forEach((roleDef) => {
        const badge = document.createElement("span");
        badge.className = "jklm-ext-role-badge" + (large ? " jklm-ext-role-badge-large" : "");
        badge.style.color = roleDef.color;
        badge.textContent = roleDef.label;
        target.appendChild(badge);
      });
    } else {
      const hint = document.createElement("span");
      hint.className = "jklm-ext-roles-hint";
      hint.textContent = "No roles yet";
      target.appendChild(hint);
    }
  }

  function applyPreviewStatus(selected) {
    const opt = selected || STATUS_OPTIONS[0];
    if (previewStatusDot) previewStatusDot.style.setProperty("--jklm-ext-status-color", opt.color);
    if (previewStatusTextEl) {
      previewStatusTextEl.style.setProperty("--jklm-ext-status-color", opt.color);
      previewStatusTextEl.textContent = opt.label;
    }
  }

  function buildPreviewTab(container) {
    const wrap = document.createElement("div");
    wrap.className = "jklm-ext-preview-tab";

    const card = document.createElement("div");
    card.className = "jklm-ext-preview-card";

    const banner = document.createElement("div");
    banner.className = "jklm-ext-preview-banner";
    banner.style.backgroundImage = `url(${DEFAULT_BANNER})`;
    banner.style.backgroundSize = "cover";
    banner.style.backgroundPosition = "center";
    banner.style.backgroundRepeat = "no-repeat";
    previewBanner = banner;

    const body = document.createElement("div");
    body.className = "jklm-ext-preview-body";

    const avatarWrap = document.createElement("div");
    avatarWrap.className = "jklm-ext-preview-avatar-wrap";

    const avatarImg = document.createElement("img");
    avatarImg.className = "jklm-ext-preview-avatar";
    avatarImg.src = DEFAULT_AVATAR;
    avatarImg.alt = "Profile picture";
    previewAvatarImg = avatarImg;

    const statusRing = document.createElement("span");
    statusRing.className = "jklm-ext-preview-status-dot-ring";
    const statusDot = document.createElement("span");
    statusDot.className = "jklm-ext-preview-status-dot";
    previewStatusDot = statusDot;
    statusRing.appendChild(statusDot);

    avatarWrap.appendChild(avatarImg);
    avatarWrap.appendChild(statusRing);

    const nameEl = document.createElement("div");
    nameEl.className = "jklm-ext-preview-name";
    nameEl.textContent = "No name yet";
    previewNameEl = nameEl;

    const statusTextEl = document.createElement("div");
    statusTextEl.className = "jklm-ext-preview-status-text";
    previewStatusTextEl = statusTextEl;

    const rolesWrap = document.createElement("div");
    rolesWrap.className = "jklm-ext-preview-roles";
    previewRolesWrap = rolesWrap;
    renderRoleBadges(rolesWrap, false);

    const divider = document.createElement("div");
    divider.className = "jklm-ext-preview-divider";

    const descLabel = document.createElement("div");
    descLabel.className = "jklm-ext-preview-desc-label";
    descLabel.textContent = "About";

    const descEl = document.createElement("div");
    descEl.className = "jklm-ext-preview-desc";
    descEl.textContent = "No description yet";
    previewDescEl = descEl;

    body.appendChild(avatarWrap);
    body.appendChild(nameEl);
    body.appendChild(statusTextEl);
    body.appendChild(rolesWrap);
    body.appendChild(divider);
    body.appendChild(descLabel);
    body.appendChild(descEl);

    card.appendChild(banner);
    card.appendChild(body);

    const hint = document.createElement("p");
    hint.className = "jklm-ext-preview-hint";
    hint.textContent = "This is how other players see your profile.";

    const shareSection = document.createElement("div");
    shareSection.className = "jklm-ext-share-section";

    const shareLabel = document.createElement("div");
    shareLabel.className = "jklm-ext-preview-desc-label";
    shareLabel.textContent = "Share profile";

    const shareBtnRow = document.createElement("div");
    shareBtnRow.className = "jklm-ext-share-btn-row";

    const shareLinkBtn = document.createElement("button");
    shareLinkBtn.type = "button";
    shareLinkBtn.className = "jklm-ext-btn jklm-ext-btn-secondary jklm-ext-share-btn";
    shareLinkBtn.textContent = "🔗 Copy link";
    shareLinkBtn.addEventListener("click", () => {
      if (!userId) return;
      const text = buildProfileShareUrl(userId);
      const done = () => {
        shareLinkBtn.textContent = "Copied!";
        shareLinkBtn.classList.add("copied");
        setTimeout(() => {
          shareLinkBtn.textContent = "🔗 Copy link";
          shareLinkBtn.classList.remove("copied");
        }, 2000);
      };
      navigator.clipboard.writeText(text).then(done).catch(() => {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
        done();
      });
    });

    const shareShotBtn = document.createElement("button");
    shareShotBtn.type = "button";
    shareShotBtn.className = "jklm-ext-btn jklm-ext-btn-secondary jklm-ext-share-btn";
    const shareShotDefaultLabel = "🖼️ Save screenshot";
    shareShotBtn.textContent = shareShotDefaultLabel;
    shareShotBtn.addEventListener("click", () => {
      if (shareShotBtn.disabled) return;
      shareShotBtn.disabled = true;
      shareShotBtn.textContent = "Rendering…";
      loadProfileData().then((data) =>
        renderProfileCardToPng({
          name: (data.name || "").trim() || "No name yet",
          description: (data.description || "").trim() || "No description yet",
          avatarUrl: data.avatarUrl || DEFAULT_AVATAR,
          bannerUrl: data.bannerUrl || DEFAULT_BANNER,
          status: data.status,
          roles: currentUserRoles
        })
      ).then((dataUrl) => {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = "jklm-profile.png";
        document.body.appendChild(link);
        link.click();
        link.remove();
        shareShotBtn.textContent = shareShotDefaultLabel;
        shareShotBtn.disabled = false;
      }).catch(() => {
        shareShotBtn.textContent = "Couldn't render image";
        setTimeout(() => {
          shareShotBtn.textContent = shareShotDefaultLabel;
        }, 2500);
        shareShotBtn.disabled = false;
      });
    });

    shareBtnRow.appendChild(shareLinkBtn);
    shareBtnRow.appendChild(shareShotBtn);
    shareSection.appendChild(shareLabel);
    shareSection.appendChild(shareBtnRow);

    wrap.appendChild(card);
    wrap.appendChild(hint);
    wrap.appendChild(shareSection);
    container.appendChild(wrap);

    applyPreviewStatus(STATUS_OPTIONS[0]);

    loadProfileData().then((data) => {
      if (previewAvatarImg) previewAvatarImg.src = data.avatarUrl || DEFAULT_AVATAR;
      if (previewNameEl) previewNameEl.textContent = (data.name || '').trim() || "No name yet";
      if (previewDescEl) previewDescEl.textContent = (data.description || '').trim() || "No description yet";
      if (previewBanner) {
        const bannerSrc = data.bannerUrl || DEFAULT_BANNER;
        previewBanner.style.backgroundImage = `url(${bannerSrc})`;
        previewBanner.style.backgroundSize = data.bannerScale || 'cover';
        previewBanner.style.backgroundPosition = data.bannerPosition || 'center center';
        previewBanner.style.backgroundRepeat = 'no-repeat';
      }
      if (data.status) {
        const selected = STATUS_OPTIONS.find(o => o.value === data.status) || STATUS_OPTIONS[0];
        applyPreviewStatus(selected);
      }
      renderRoleBadges(previewRolesWrap, false);
    });
  }

  let footerInjected = false;

  function tryInjectFooterLinks() {
    if (footerInjected) return;

    const linksContainer = document.querySelector("div.links");
    if (!linksContainer) return;

    if (linksContainer.querySelector(".jklm-ext-footer-extra")) {
      footerInjected = true;
      return;
    }

    const extra = document.createElement("div");
    extra.className = "jklm-ext-footer-extra";

    const creditLine = document.createElement("div");
    creditLine.append("Made with ♥️ by ");
    const creditName = document.createElement("span");
    creditName.textContent = "Root";
    creditName.style.color = "#ff69b4";
    creditLine.append(creditName);

    const discordAndLearnMoreRow = document.createElement("div");
    discordAndLearnMoreRow.className = "jklm-ext-footer-row";

    const discordLine = document.createElement("div");

    const discordIcon = document.createElement("img");
    discordIcon.src = "/images/auth/discord.png";
    discordIcon.width = 16;
    discordIcon.height = 16;
    discordIcon.className = "discord";
    discordIcon.alt = "Discord";

    const discordLink = document.createElement("a");
    discordLink.href = "https://discord.gg/ZSZmh6Efwn";
    discordLink.target = "_blank";
    discordLink.rel = "noopener";
    discordLink.textContent = "Discord";

    discordLine.appendChild(discordIcon);
    discordLine.appendChild(document.createTextNode("\u00A0"));
    discordLine.appendChild(discordLink);

    const learnMoreLine = document.createElement("div");
    const learnMoreLink = document.createElement("a");
    // Hosted on GitHub Pages (not bundled into the extension package) so
    // edits to welcome.html/todos.html/wordsearch.html go live for every
    // user the moment they're pushed — no new extension version/store
    // review needed. Replace OVERLAY_PLUS_DOCS_URL below with your repo's
    // actual Pages URL once it's set up (see setup notes where it's
    // defined near the top of this file).
    learnMoreLink.href = OVERLAY_PLUS_DOCS_URL + "/welcome.html";
    learnMoreLink.target = "_blank";
    learnMoreLink.rel = "noopener";
    learnMoreLink.textContent = "Learn more";
    learnMoreLine.appendChild(learnMoreLink);

    discordAndLearnMoreRow.appendChild(discordLine);
    discordAndLearnMoreRow.appendChild(learnMoreLine);

    const privacyPolicyLine = document.createElement("div");
    const privacyPolicyLink = document.createElement("a");
    privacyPolicyLink.href = "https://j85676543-cpu.github.io/jklm-profile-privacy/";
    privacyPolicyLink.target = "_blank";
    privacyPolicyLink.rel = "noopener";
    privacyPolicyLink.textContent = "Privacy Policy";
    privacyPolicyLine.appendChild(privacyPolicyLink);

    extra.appendChild(creditLine);
    extra.appendChild(discordAndLearnMoreRow);
    extra.appendChild(privacyPolicyLine);

    linksContainer.appendChild(extra);
    footerInjected = true;
  }

  const observer = new MutationObserver(() => {
    if (!injected) tryInject();
    if (!playButtonBound) tryBindPlayButton();
    if (!footerInjected) tryInjectFooterLinks();
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) leaveActiveConversation();
  });

  getUserId().then((id) => {
    userId = id;
    tryInject();
    tryInjectFooterLinks();
    ensureSystemBotRegistered();
    connectWebSocket();
  });
})();