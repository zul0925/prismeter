const providers = {
  openai: {
    name: "OpenAI",
    short: "OA",
    color: "#313a4c",
    gradient: "linear-gradient(135deg,#263042,#778299)",
    description: "ChatGPT 订阅身份与 Codex 远端用量",
    primaryProduct: "codex",
    products: {}
  },
  volcengine: {
    name: "火山引擎方舟",
    short: "火",
    color: "#4c72f4",
    gradient: "linear-gradient(135deg,#3d7bff,#6d56e8)",
    description: "以计费产品区分 Agent Plan、Coding Plan 与按量 API",
    primaryProduct: "remote",
    products: {}
  },
  mimo: {
    name: "Xiaomi MiMo",
    short: "Mi",
    color: "#ef7c31",
    gradient: "linear-gradient(135deg,#ff9b45,#e75f2b)",
    description: "添加账户后读取 MiMo 官方模型能力",
    primaryProduct: "remote",
    products: {}
  },
  deepseek: {
    name: "DeepSeek 官方",
    short: "DS",
    color: "#26a4d8",
    gradient: "linear-gradient(135deg,#1aa8dc,#3972dc)",
    description: "余额官方查询，历史用量从 Prismeter 连接后开始采集",
    primaryProduct: "remote",
    products: {}
  }
};

const APP_DEFAULTS = Object.freeze({
  volcengineRegion: "cn-beijing",
  volcengineProject: "default",
  mimoPaygUrl: "https://api.xiaomimimo.com/v1",
  mimoTokenPlanUrl: "https://token-plan-cn.xiaomimimo.com/v1"
});
const SYNC_POLL_INTERVAL_MS = 900;
const RELATIVE_TIME_REFRESH_MS = 60_000;
const BACKGROUND_STATE_REFRESH_MS = 60_000;

const platformLogoSources = {"openai":"data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiMwMDgwRjciLz4KPHBhdGggZD0iTTkuOTQ0OTQgOS41OTE2M1Y4LjEzMjI3QzkuOTQ0OTQgOC4wMDkzNSA5Ljk5MTA1IDcuOTE3MTMgMTAuMDk4NSA3Ljg1NTc1TDEzLjAzMjcgNi4xNjU5OUMxMy40MzIxIDUuOTM1NTggMTMuOTA4MyA1LjgyODEgMTQuMzk5OCA1LjgyODFDMTYuMjQzMiA1LjgyODEgMTcuNDEwOCA3LjI1Njc3IDE3LjQxMDggOC43Nzc1MUMxNy40MTA4IDguODg1IDE3LjQxMDggOS4wMDc5MiAxNy4zOTUzIDkuMTMwODNMMTQuMzUzNyA3LjM0ODg0QzE0LjE2OTQgNy4yNDEzNSAxMy45ODUgNy4yNDEzNSAxMy44MDA3IDcuMzQ4ODRMOS45NDQ5NCA5LjU5MTYzWk0xNi43OTYzIDE1LjI3NTVWMTEuNzg4M0MxNi43OTYzIDExLjU3MzIgMTYuNzA0IDExLjQxOTYgMTYuNTE5NyAxMS4zMTIxTDEyLjY2NCA5LjA2OTNMMTMuOTIzNiA4LjM0NzI1QzE0LjAzMTEgOC4yODU4NyAxNC4xMjM0IDguMjg1ODcgMTQuMjMwOCA4LjM0NzI1TDE3LjE2NSAxMC4wMzdDMTguMDA5OSAxMC41Mjg3IDE4LjU3ODIgMTEuNTczMiAxOC41NzgyIDEyLjU4N0MxOC41NzgyIDEzLjc1NDQgMTcuODg3IDE0LjgyOTggMTYuNzk2MyAxNS4yNzUzVjE1LjI3NTVaTTkuMDM4NjEgMTIuMjAzMUw3Ljc3ODk2IDExLjQ2NThDNy42NzE0NiAxMS40MDQ1IDcuNjI1MzUgMTEuMzEyMiA3LjYyNTM1IDExLjE4OTNWNy44MDk4QzcuNjI1MzUgNi4xNjYxMyA4Ljg4NTAxIDQuOTIxNzYgMTAuNTkwMiA0LjkyMTc2QzExLjIzNTQgNC45MjE3NiAxMS44MzQ0IDUuMTM2ODkgMTIuMzQxNSA1LjUyMDg5TDkuMzE1MjYgNy4yNzIxOEM5LjEzMDk3IDcuMzc5NjggOS4wMzg3NSA3LjUzMzI4IDkuMDM4NzUgNy43NDg0MVYxMi4yMDMzTDkuMDM4NjEgMTIuMjAzMVpNMTEuNzUgMTMuNzdMOS45NDQ5NCAxMi43NTYyVjEwLjYwNTZMMTEuNzUgOS41OTE3OEwxMy41NTQ5IDEwLjYwNTZWMTIuNzU2MkwxMS43NSAxMy43N1pNMTIuOTA5OCAxOC40NEMxMi4yNjQ1IDE4LjQ0IDExLjY2NTUgMTguMjI0OSAxMS4xNTg1IDE3Ljg0MDlMMTQuMTg0NyAxNi4wODk2QzE0LjM2OSAxNS45ODIxIDE0LjQ2MTIgMTUuODI4NSAxNC40NjEyIDE1LjYxMzRWMTEuMTU4NUwxNS43MzYzIDExLjg5NThDMTUuODQzOCAxMS45NTcyIDE1Ljg4OTkgMTIuMDQ5NCAxNS44ODk5IDEyLjE3MjNWMTUuNTUxOUMxNS44ODk5IDE3LjE5NTUgMTQuNjE0OCAxOC40NCAxMi45MDk4IDE4LjQ0Wk05LjI2OTAxIDE1LjAxNDRMNi4zMzQ4NiAxMy4zMjQ2QzUuNDg5OSAxMi44MzMgNC45MjE2MSAxMS43ODg1IDQuOTIxNjEgMTAuNzc0NkM0LjkyMTYxIDkuNTkxNzcgNS42MjgyNCA4LjUzMTgzIDYuNzE4ODYgOC4wODYzVjExLjU4ODdDNi43MTg4NiAxMS44MDM5IDYuODExMDkgMTEuOTU3NSA2Ljk5NTM4IDEyLjA2NUwxMC44MzU5IDE0LjI5MjNMOS41NzYyMSAxNS4wMTQ0QzkuNDY4NzIgMTUuMDc1OCA5LjM3NjQ5IDE1LjA3NTggOS4yNjkwMSAxNS4wMTQ0Wk05LjEwMDEzIDE3LjUzMzdDNy4zNjQyNiAxNy41MzM3IDYuMDg5MTkgMTYuMjI3OSA2LjA4OTE5IDE0LjYxNDlDNi4wODkxOSAxNC40OTIgNi4xMDQ2IDE0LjM2OTEgNi4xMTk4OCAxNC4yNDYyTDkuMTQ2MSAxNS45OTc1QzkuMzMwMzkgMTYuMTA1IDkuNTE0ODMgMTYuMTA1IDkuNjk5MTIgMTUuOTk3NUwxMy41NTQ5IDEzLjc3MDJWMTUuMjI5NUMxMy41NTQ5IDE1LjM1MjQgMTMuNTA4OCAxNS40NDQ2IDEzLjQwMTMgMTUuNTA2TDEwLjQ2NzEgMTcuMTk1OEMxMC4wNjc3IDE3LjQyNjIgOS41OTE0OCAxNy41MzM3IDkuMDk5OTkgMTcuNTMzN0g5LjEwMDEzWk0xMi45MDk4IDE5LjM2MTZDMTQuNzY4NSAxOS4zNjE2IDE2LjMyIDE4LjA0MDYgMTYuNjczNSAxNi4yODkzQzE4LjM5MzkgMTUuODQzOCAxOS41IDE0LjIzMDggMTkuNSAxMi41ODcyQzE5LjUgMTEuNTExOCAxOS4wMzkxIDEwLjQ2NzMgMTguMjA5NiA5LjcxNDU0QzE4LjI4NjQgOS4zOTE5MiAxOC4zMzI2IDkuMDY5MyAxOC4zMzI2IDguNzQ2ODJDMTguMzMyNiA2LjU1MDE0IDE2LjU1MDUgNC45MDYzNCAxNC40OTIxIDQuOTA2MzRDMTQuMDc3NCA0LjkwNjM0IDEzLjY3NzkgNC45Njc3MiAxMy4yNzg1IDUuMTA2MDVDMTIuNTg3MiA0LjQzMDExIDExLjYzNDcgNCAxMC41OTAyIDRDOC43MzE0IDQgNy4xNzk5NiA1LjMyMTAzIDYuODI2NSA3LjA3MjMyQzUuMTA2MDUgNy41MTc4NiA0IDkuMTMwODMgNCAxMC43NzQ1QzQgMTEuODQ5OCA0LjQ2MDggMTIuODk0NCA1LjI5MDM1IDEzLjY0NzFDNS4yMTM1NCAxMy45Njk3IDUuMTY3NDMgMTQuMjkyMyA1LjE2NzQzIDE0LjYxNDhDNS4xNjc0MyAxNi44MTE0IDYuOTQ5NDEgMTguNDU1MiA5LjAwNzkyIDE4LjQ1NTJDOS40MjI2MSAxOC40NTUyIDkuODIyMDQgMTguMzkzOSAxMC4yMjE1IDE4LjI1NTZDMTAuOTEyNyAxOC45MzE1IDExLjg2NTEgMTkuMzYxNiAxMi45MDk4IDE5LjM2MTZaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K","volcengine":"data:image/png;base64,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","deepseek":"data:image/png;base64,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","xiaomi":"data:image/png;base64,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"};

// Provider records use `mimo`; the embedded Xiaomi artwork kept its original asset key.
platformLogoSources.mimo = platformLogoSources.xiaomi;

function platformLogo(providerId, sizeClass = "") {
  const source = platformLogoSources[providerId];
  const provider = providers[providerId];
  const safeClass = String(providerId || "unknown").replace(/[^a-z0-9_-]/gi, "-");
  if (!source) return `<span class="brand-logo ${escapeHtml(sizeClass)}" style="${providerStyle(providerId)}"><b>${escapeHtml(provider?.short || "?")}</b></span>`;
  return `<span class="brand-logo brand-logo-${safeClass} ${escapeHtml(sizeClass)}" style="${providerStyle(providerId)}"><span class="brand-logo-glow"></span><img src="${source}" alt="" draggable="false" /></span>`;
}

function resource(name, type, badge, metrics) { return { name, type, badge, metrics }; }

const state = { view: "overview", provider: "volcengine", accountId: null, renameAccountId: null, deleteAccountId: null, alertAccountId: null, connectionAccountId: null, diagnosticAccountId: null, alertFilter: "all", syncEventFilter: "all", products: {}, backend: { accounts: [], history: [], syncEvents: [] }, desktopPreferences: { closeToTray:null, launchAtStartup:null }, syncPollTimer: null, syncPollUsers: 0, updateCheckStarted: false, availableUpdate: null, storageNoticeShown: false, metricRangeDays: 7, metricHistoryCache: new Map(), metricSelections: {}, metricHistoryRequestKey: "", trayTooltip: "" };
Object.entries(providers).forEach(([id, p]) => state.products[id] = p.primaryProduct);
function remotePlaceholder(platformName, supported = false) {
  return {
    name: supported ? "等待连接" : "暂未支持",
    kind: "远端数据",
    usage: "—",
    usageLabel: supported ? "尚未连接" : "未接入远端 API",
    progress: 0,
    reset: supported ? "连接账户后同步" : "等待后续版本",
    summaries: [
      ["数据状态", "无远端数据", supported ? "请连接账户" : "当前版本未支持"],
      ["数据来源", "—", "不使用本地估算"],
      ["最近同步", "—", "尚未同步"],
      ["平台", platformName, "远端官方接口"]
    ],
    columns: [], rows: []
  };
}

function initializeRemoteOnlyProviders() {
  Object.entries(providers).forEach(([id, provider]) => {
    provider.products = { remote: remotePlaceholder(provider.name, true) };
    provider.primaryProduct = "remote";
    state.products[id] = "remote";
  });

  const openai = providers.openai;
  openai.description = "连接 OpenAI 登录账户后，分别展示 ChatGPT 订阅身份与 Codex 远端用量";

  const xiaomi = providers.mimo;
  xiaomi.description = "官方尚未开放第三方用量统计接口，当前暂不开放新的 MiMo 连接";
}

const els = Object.fromEntries([...document.querySelectorAll("[id]")].map(el => [el.id, el]));
const systemThemeQuery = window.matchMedia("(prefers-color-scheme: dark)");

function applyTheme(mode = "system", persist = true) {
  const normalized = ["system", "light", "dark"].includes(mode) ? mode : "system";
  const resolved = normalized === "system" ? (systemThemeQuery.matches ? "dark" : "light") : normalized;
  document.documentElement.dataset.themeMode = normalized;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "dark" ? "#101522" : "#e8edf6");
  if (persist) document.cookie = `prismeter-theme=${normalized}; Max-Age=31536000; Path=/; SameSite=Strict`;
}

systemThemeQuery.addEventListener("change", () => {
  if ((state.backend.settings?.appearanceMode || document.documentElement.dataset.themeMode) === "system") applyTheme("system", false);
});

function providerStyle(id) {
  const p = providers[id] || { color:"#667085", gradient:"linear-gradient(135deg,#667085,#98a2b3)" };
  return `--platform-color:${p.color};--platform-gradient:${p.gradient}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}

function errorMessage(error, fallback = "操作未完成，请稍后重试") {
  if (typeof error === "string" && error.trim()) return error;
  if (typeof error?.message === "string" && error.message.trim()) return error.message;
  if (typeof error?.error === "string" && error.error.trim()) return error.error;
  return fallback;
}

function moneySymbol(currency) { return currency === "CNY" ? "¥" : currency === "USD" ? "$" : `${currency || ""} `; }

function formatDate(value) {
  if (!value) return "尚未同步";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "时间无效";
  return new Intl.DateTimeFormat("zh-CN", { month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" }).format(date);
}

function relativeSyncTime(value) {
  if (!value) return "从未同步";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "时间无效";
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function relativeFutureTime(value) {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const remaining = timestamp - Date.now();
  if (remaining <= 0) return "即将自动重试";
  const minutes = Math.max(1, Math.ceil(remaining / 60000));
  return minutes < 60 ? `${minutes} 分钟后自动重试` : `${Math.ceil(minutes / 60)} 小时后自动重试`;
}

function accountFreshness(account) {
  if (account?.enabled === false) return { level:"paused", label:"监控已暂停", detail:"不会参与自动或全部同步" };
  if (!account?.lastSync) return { level:"never", label:"尚未同步", detail:"等待首次远端同步" };
  const elapsedMinutes = Math.max(0, (Date.now() - new Date(account.lastSync).getTime()) / 60000);
  const configured = Number(state.backend.settings?.autoSyncMinutes || 0);
  const accountStaleLimit = account?.alertSettings?.staleAfterMinutes;
  const explicitStaleLimit = Number(accountStaleLimit ?? state.backend.settings?.staleAfterMinutes ?? 0);
  const staleLimit = explicitStaleLimit || (configured ? Math.max(60, configured * 3) : 360);
  const expectedFreshLimit = configured ? Math.max(15, configured * 1.5) : 60;
  const freshLimit = Math.min(expectedFreshLimit, staleLimit / 2);
  const relative = relativeSyncTime(account.lastSync);
  if (account.lastError) return { level:"error", label:Number(account.consecutiveFailures || 0) >= 3 ? "持续失败" : "同步失败", detail:`上次成功：${relative}` };
  if (elapsedMinutes <= freshLimit) return { level:"fresh", label:"数据新鲜", detail:`更新于 ${relative}` };
  if (elapsedMinutes <= staleLimit) return { level:"aging", label:"建议刷新", detail:`更新于 ${relative}` };
  return { level:"stale", label:"数据已过期", detail:`更新于 ${relative}` };
}

function overallFreshness(accounts = state.backend.accounts || []) {
  const counts = { fresh:0, aging:0, stale:0, error:0, never:0, paused:0 };
  accounts.forEach(account => counts[accountFreshness(account).level]++);
  const healthy = counts.fresh;
  const monitored = accounts.length - counts.paused;
  return { counts, healthy, monitored, attention:monitored - healthy };
}

async function apiRequest(path, options = {}, allowPartial = false) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({ error: "本地服务返回异常" }));
  if (!response.ok || (!allowPartial && payload.ok === false)) throw new Error(payload.error || "操作失败");
  return payload;
}

function formatDuration(value) {
  const milliseconds = Number(value || 0);
  if (!milliseconds) return "尚无耗时记录";
  return milliseconds < 1000 ? `${milliseconds} ms` : `${(milliseconds / 1000).toFixed(milliseconds < 10000 ? 1 : 0)} s`;
}

function safeFilePart(value) {
  return String(value || "data").replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "data";
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportCurrentProduct() {
  const provider = providers[state.provider];
  const account = getSelectedAccount(state.provider);
  const product = provider?.products?.[state.products[state.provider]];
  if (!account || !product || !(product.rows || []).length) {
    showToast("当前产品没有可导出的远端明细");
    return;
  }
  const header = ["平台", "账户", "产品", "资源 / 日期", "类型", ...(product.columns || [])];
  const rows = (product.rows || []).map(row => [
    provider.name, account.name, product.name, row.name, row.type,
    ...(row.metrics || []).map(metric => metric?.[0] ?? "—")
  ]);
  const meta = [
    ["数据来源", "平台远端官方接口"],
    ["最近同步", account.lastSync || "—"],
    ["导出时间", new Date().toISOString()]
  ];
  const csv = "\uFEFF" + [
    ...meta.map(row => row.map(csvCell).join(",")),
    "",
    header.map(csvCell).join(","),
    ...rows.map(row => row.map(csvCell).join(","))
  ].join("\r\n");
  downloadText(`Prismeter-${safeFilePart(provider.name)}-${safeFilePart(product.name)}-${new Date().toISOString().slice(0,10)}.csv`, csv, "text/csv;charset=utf-8");
  showToast("远端产品明细已导出");
}

function getSelectedAccount(providerId = state.provider) {
  const accounts = state.backend.accounts || [];
  return accounts.find(account => account.id === state.accountId && account.provider === providerId)
    || accounts.find(account => account.provider === providerId);
}

function applyDeepSeekAccountData(account = getSelectedAccount("deepseek")) {
  const provider = providers.deepseek;
  if (!account) {
    provider.products = { remote: remotePlaceholder(provider.name, true) };
    provider.primaryProduct = "remote";
    provider.description = "尚未连接真实账户；添加 API Key 后读取官方余额数据";
    state.products.deepseek = "remote";
    return;
  }

  const balance = account.balances?.find(item => item.currency === "CNY") || account.balances?.[0];
  const symbol = moneySymbol(balance?.currency);
  const historyCount = state.backend.history.filter(item => item.accountId === account.id).length;
  provider.description = `${account.name} · 官方余额查询 · ${account.keyHint}`;
  provider.products = { api: {
    name: "DeepSeek API",
    kind: "按量计费",
    usage: balance ? `${symbol} ${balance.total}` : "—",
    usageLabel: "当前总余额",
    progress: 0,
    reset: `同步于 ${formatDate(account.lastSync)}`,
    summaries: [
      ["当前总余额", balance ? `${symbol} ${balance.total}` : "—", "DeepSeek 官方"],
      ["赠送余额", balance ? `${symbol} ${balance.granted}` : "—", "官方"],
      ["充值余额", balance ? `${symbol} ${balance.toppedUp}` : "—", "官方"],
      ["本地快照", `${historyCount} 条`, "连接后采集"]
    ],
    columns: ["币种", "总余额", "赠送余额", "充值余额"],
    rows: (account.balances || []).map(item => resource(account.name, account.isAvailable ? "API 可调用" : "余额不可用", "DS", [
      [item.currency, "官方"], [`${moneySymbol(item.currency)} ${item.total}`, "官方"], [`${moneySymbol(item.currency)} ${item.granted}`, "官方"], [`${moneySymbol(item.currency)} ${item.toppedUp}`, "官方"]
    ]))
  }};
  provider.primaryProduct = "api";
  if (!provider.products[state.products.deepseek]) state.products.deepseek = "api";
}

function applyOpenAIAccountData(account = getSelectedAccount("openai")) {
  const provider = providers.openai;
  if (!account) {
    provider.products = { remote: remotePlaceholder(provider.name, true) };
    provider.primaryProduct = "remote";
    provider.description = "连接当前 Windows 用户的 OpenAI 登录账户；ChatGPT 与 Codex 按产品分开展示";
    state.products.openai = "remote";
    return;
  }

  const products = {};
  for (const item of account.products || []) {
    const percent = String(item.usage || "").match(/(-?\d+(?:\.\d+)?)\s*%/);
    products[item.id] = {
      name: item.name || item.id,
      kind: item.kind || "ChatGPT 订阅",
      usage: item.usage || "—",
      usageLabel: item.usageLabel || "远端用量",
      progress: percent ? Math.max(0, Math.min(100, Number(percent[1]))) : 0,
      reset: `同步于 ${formatDate(account.lastSync)}`,
      summaries: (item.summaries || []).map(metric => [metric.label, metric.value, metric.note]),
      columns: item.columns || [],
      rows: (item.rows || []).map(row => resource(row.name, row.type, row.badge, (row.metrics || []).map(metric => [metric.value, metric.unit])))
    };
  }
  provider.products = products;
  provider.primaryProduct = Object.keys(products)[0] || "codex";
  provider.description = `${account.name} · OpenAI ${account.planType || "ChatGPT"} · ${account.email || "官方登录态"}`;
  if (!provider.products[state.products.openai]) state.products.openai = provider.primaryProduct;
}

function applyVolcengineAccountData(account = getSelectedAccount("volcengine")) {
  const provider = providers.volcengine;
  if (!account) {
    provider.products = { remote: remotePlaceholder(provider.name, true) };
    provider.primaryProduct = "remote";
    provider.description = "添加 AK/SK 后从火山控制面同步读取套餐用量";
    state.products.volcengine = "remote";
    return;
  }

  const products = {};
  for (const item of account.products || []) {
    const percent = String(item.usage || "").match(/(-?\d+(?:\.\d+)?)\s*%/);
    products[item.id] = {
      name: item.name || item.id,
      kind: item.kind || "官方产品",
      usage: item.usage || "—",
      usageLabel: item.usageLabel || "官方用量",
      progress: percent ? Math.max(0, Math.min(100, Number(percent[1]))) : 0,
      reset: `同步于 ${formatDate(account.lastSync)}`,
      summaries: (item.summaries || []).map(metric => [metric.label, metric.value, metric.note]),
      columns: item.columns || [],
      rows: (item.rows || []).map(row => resource(row.name, row.type, row.badge, (row.metrics || []).map(metric => [metric.value, metric.unit])))
    };
  }
  provider.products = products;
  provider.primaryProduct = Object.keys(products)[0] || "payg";
  provider.description = `${account.name} · ${account.keyHint} · ${account.projectName || APP_DEFAULTS.volcengineProject}`;
  if (!provider.products[state.products.volcengine]) state.products.volcengine = provider.primaryProduct;
}

function applyMimoAccountData(account = getSelectedAccount("mimo")) {
  const provider = providers.mimo;
  if (!account) {
    provider.products = { remote: remotePlaceholder(provider.name, true) };
    provider.primaryProduct = "remote";
    provider.description = "添加 MiMo API Key 后读取官方模型列表；余额与 Credits 仅在小米控制台可见";
    state.products.mimo = "remote";
    return;
  }
  const products = {};
  for (const item of account.products || []) {
    products[item.id] = {
      name: item.name || item.id,
      kind: item.kind || "API Key 能力",
      usage: item.usage || "—",
      usageLabel: item.usageLabel || "远端模型",
      progress: 0,
      reset: `同步于 ${formatDate(account.lastSync)}`,
      summaries: (item.summaries || []).map(metric => [metric.label, metric.value, metric.note]),
      columns: item.columns || [],
      rows: (item.rows || []).map(row => resource(row.name, row.type, row.badge, (row.metrics || []).map(metric => [metric.value, metric.unit])))
    };
  }
  provider.products = products;
  provider.primaryProduct = Object.keys(products)[0] || "mimo-models";
  provider.description = `${account.name} · ${account.planType === "token_plan" ? "Token Plan" : "按量 API"} · ${account.keyHint}`;
  if (!provider.products[state.products.mimo]) state.products.mimo = provider.primaryProduct;
}

async function loadBackendState({quiet = false} = {}) {
  try {
    const payload = await apiRequest("/api/state");
    state.backend = payload;
    updateTrayTooltip(payload);
    applyTheme(payload.settings?.appearanceMode || "system");
    await syncDesktopPreferences(payload.settings);
    if (state.accountId && !payload.accounts.some(account => account.id === state.accountId)) state.accountId = null;
    applyDeepSeekAccountData();
    applyOpenAIAccountData();
    applyVolcengineAccountData();
    applyMimoAccountData();
    renderNavigation();
    renderOverview();
    renderAccounts();
    renderAlerts();
    populateSettings();
    maybeCheckForUpdates();
    if (state.view === "platforms") renderPlatform();
    if (state.view === "models") renderComparisons();
    if (!quiet) els.syncText.textContent = state.backend.accounts.length ? formatSyncSetting() : "等待连接账户";
    if (payload.startupNotice && !state.storageNoticeShown) {
      state.storageNoticeShown = true;
      showToast(payload.startupNotice, "warning");
    }
  } catch (error) {
    els.syncText.textContent = "本地服务异常";
    if (!quiet) showToast(errorMessage(error));
  }
}

function monitoringSummary(payload = state.backend) {
  const accounts = payload.accounts || [];
  const monitored = accounts.filter(account => account.enabled !== false);
  if (!accounts.length) return { level:"empty", title:"尚未连接账户", detail:"打开 Prismeter 添加账户" };
  if (!monitored.length) return { level:"paused", title:"监控已暂停", detail:`${accounts.length} 个账户均已暂停` };
  const failed = monitored.find(account => account.lastError);
  if (failed) return { level:"attention", title:"需要处理", detail:`${failed.name} 同步失败` };
  const stale = monitored.find(account => accountFreshness(account).level === "stale" || accountFreshness(account).level === "never");
  if (stale) return { level:"attention", title:"需要刷新", detail:`${stale.name} ${accountFreshness(stale).label}` };
  const alerts = actionableAlerts(payload);
  if (alerts.length) return { level:"attention", title:"请留意用量", detail:`${alerts.length} 条提醒等待处理` };
  return { level:"healthy", title:"可以继续使用", detail:`${monitored.length} 个账户状态正常` };
}

function isAlertSnoozed(alert) {
  return Boolean(alert?.snoozedUntil) && new Date(alert.snoozedUntil).getTime() > Date.now();
}

function actionableAlerts(payload = state.backend) {
  return (payload.alerts || []).filter(alert => !isAlertSnoozed(alert));
}

function automaticSyncLabel(settings = state.backend.settings) {
  const minutes = Number(settings?.autoSyncMinutes || 0);
  if (!minutes) return "自动同步已关闭";
  const next = state.backend.nextAutomaticSyncAt;
  return next ? `每 ${minutes} 分钟 · 下次 ${relativeFutureTime(next)}` : `每 ${minutes} 分钟自动同步`;
}

async function updateTrayTooltip(payload = state.backend) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) return;
  const summary = monitoringSummary(payload);
  const tooltip = `Prismeter · ${summary.title}\n${summary.detail}\n${automaticSyncLabel(payload.settings)}`;
  if (tooltip === state.trayTooltip) return;
  try {
    await invoke("set_tray_tooltip", { tooltip });
    state.trayTooltip = tooltip;
  } catch (_) {
    // The desktop shell may not be ready during the first page render.
  }
}

function renderNavigation() {
  const accounts = state.backend.accounts || [];
  els.platformNav.innerHTML = accounts.length ? accounts.map(account => {
    const provider = providers[account.provider];
    const accountId = escapeHtml(account.id);
    return `<button class="${account.id === state.accountId ? 'active' : ''} ${account.enabled === false ? 'paused-account' : ''}" data-account="${accountId}" data-sort-account="${accountId}" data-account-provider="${escapeHtml(account.provider)}">${platformLogo(account.provider, "nav-brand-logo")}<span><b>${escapeHtml(account.name)}</b><small>${escapeHtml(provider?.name || account.provider)}</small></span><i class="drag-handle nav-drag-handle" data-drag-account="${accountId}" title="按住拖拽排序" aria-label="拖拽排序">⋮⋮</i></button>`;
  }).join("") : `<button class="nav-empty-account" data-view="accounts"><span class="nav-add-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></span><span><b>添加账户</b><small>连接后显示在这里</small></span></button>`;
}

function renderOverview() {
  const accounts = state.backend.accounts || [];
  const connectedCount = accounts.length;
  const alertCount = actionableAlerts().length;
  const freshness = overallFreshness(accounts);
  const activeCount = freshness.monitored;
  const monitoring = monitoringSummary();
  const pausedSuffix = freshness.counts.paused ? ` · ${freshness.counts.paused} 个已暂停` : "";
  els.globalStatusText.textContent = `${monitoring.title} · ${monitoring.detail}${pausedSuffix}`;
  const livePill = document.querySelector(".live-pill");
  livePill.classList.toggle("attention", connectedCount > 0 && freshness.attention > 0);
  livePill.classList.toggle("empty", connectedCount === 0);
  document.querySelector(".hero-copy > p").textContent = "工作可用性";
  document.querySelector(".hero-value strong").textContent = String(activeCount);
  document.querySelector(".hero-value span").textContent = "个监控账户";
  document.querySelector(".hero-delta").innerHTML = monitoring.level === "healthy"
    ? "<b>可安心继续</b> · 暂无需要处理的远端告警"
    : monitoring.level === "empty" ? "<b>等待连接</b> · 添加账户后开始监控"
    : `<b>${escapeHtml(monitoring.detail)}</b> · 打开账户中心查看原因`;
  document.querySelector(".hero-chart-wrap").hidden = false;
  document.querySelector("#heroHealthy").textContent = String(freshness.healthy);
  document.querySelector("#heroAttention").textContent = String(freshness.attention);
  document.querySelector("#heroPaused").textContent = String(freshness.counts.paused);
  document.querySelector("#heroSchedule").textContent = automaticSyncLabel();
  renderActionCenter();
  const insight = document.querySelector(".insight-card");
  insight.querySelector("h3").textContent = "所有指标均来自平台远端";
  insight.querySelector("p:not(.eyebrow)").innerHTML = connectedCount
    ? `当前监控 <strong>${connectedCount}</strong> 个账户；不读取本地会话日志，也不使用模拟数据补齐。`
    : "添加账户后，Prismeter 才会展示对应平台实际支持的远端指标。";
  insight.querySelector("button").textContent = "查看账户";
  insight.querySelector("button").dataset.targetView = "accounts";
  const platformOrder = orderedProviderIds(accounts);
  els.platformCards.innerHTML = platformOrder.map(id => [id, providers[id]]).filter(([,provider]) => provider).map(([id,p]) => {
    const product = p.products[p.primaryProduct] || remotePlaceholder(p.name, false);
    const connectedAccounts = accounts.filter(account => account.provider === id);
    const isRemote = connectedAccounts.length > 0;
    const platformFreshness = overallFreshness(connectedAccounts);
    const freshnessClass = !isRemote ? "none" : platformFreshness.monitored === 0 ? "paused" : platformFreshness.attention ? "attention" : "fresh";
    const freshnessLabel = !isRemote ? "—" : platformFreshness.monitored === 0 ? "已暂停" : platformFreshness.attention ? `${platformFreshness.attention} 个需刷新` : "数据新鲜";
    const productLabel = isRemote ? `${connectedAccounts.length} 个账户 · ${product.name}` : "无远端数据";
    return `<article class="platform-card ${isRemote ? 'real-data' : 'remote-empty'}" data-provider="${escapeHtml(id)}" data-sort-provider="${escapeHtml(id)}" style="${providerStyle(id)}">
      <div class="platform-card-top">${platformLogo(id, "card-brand-logo")}<span><i class="status-dot ${freshnessClass}" title="${escapeHtml(freshnessLabel)}"></i><i class="drag-handle" data-drag-provider="${escapeHtml(id)}" title="按住拖拽调整平台顺序" aria-label="拖拽调整平台顺序">⋮⋮</i></span></div>
      <h4>${escapeHtml(p.name)}</h4><div class="product-name">${escapeHtml(productLabel)}</div>
      <div class="usage-row"><strong>${escapeHtml(isRemote ? product.usage : "—")}</strong><span>${escapeHtml(isRemote ? product.usageLabel : "未连接")}</span></div>
      <div class="progress"><i style="--progress:${isRemote ? product.progress : 0}%"></i></div>
      <div class="platform-card-foot"><span>${escapeHtml(isRemote ? product.reset : "连接账户后同步")}</span><span class="freshness-text ${freshnessClass}">${escapeHtml(freshnessLabel)}</span></div>
    </article>`;
  }).join("");
  if (!els.platformCards.children.length) {
    els.platformCards.innerHTML = '<article class="overview-platform-empty glass-panel"><span>＋</span><div><b>尚未连接平台</b><p>请到账户中心添加平台账户，连接成功后才会出现在这里。</p></div><button class="soft-button" data-target-view="accounts">前往账户中心</button></article>';
  }
  els.activityList.innerHTML = accounts.length ? accounts.map(account => {
    const provider = providers[account.provider];
    const primary = account.provider === "deepseek"
      ? account.balances?.[0]
      : account.products?.[0];
    const value = account.provider === "deepseek"
      ? (primary ? escapeHtml(`${moneySymbol(primary.currency)} ${primary.total}`) : "—")
      : escapeHtml(primary?.usage || "—");
    const freshness = accountFreshness(account); return `<div class="activity-item">${platformLogo(account.provider, "activity-brand-logo")}<div class="activity-main"><b>${escapeHtml(account.name)}</b><span>${escapeHtml(provider?.name || account.provider)} · 远端同步</span></div><div class="activity-value"><b>${value}</b><span class="freshness-text ${freshness.level}">${escapeHtml(freshness.label)} · ${escapeHtml(relativeSyncTime(account.lastSync))}</span></div></div>`;
  }).join("") : `<div class="history-empty">连接账户并完成远端同步后，这里才会显示活动。</div>`;
}

function renderActionCenter() {
  const alerts = actionableAlerts();
  const priority = { sync:0, freshness:1, status:1, balance:2, quota:2 };
  const symbols = { sync:"!", freshness:"↻", status:"!", balance:"¥", quota:"%" };
  const items = alerts.slice().sort((left, right) => (priority[left.kind] ?? 3) - (priority[right.kind] ?? 3)).slice(0, 3);
  els.actionCenterTitle.textContent = items.length ? `${items.length} 项需要处理` : "当前无需处理";
  els.actionList.innerHTML = items.length ? items.map(item => {
    const account = (state.backend.accounts || []).find(candidate => candidate.id === item.accountId);
    const canSync = account && ["sync", "freshness", "status"].includes(item.kind);
    const actions = canSync
      ? `<button class="mini-button" data-sync-account="${escapeHtml(account.id)}"><span>立即同步</span></button><button class="mini-button" data-view-account="${escapeHtml(account.id)}" data-account-provider="${escapeHtml(account.provider)}">查看账户</button>`
      : `<button class="mini-button" data-target-view="alerts">查看提醒</button>${account ? `<button class="mini-button" data-account-alerts="${escapeHtml(account.id)}">调整规则</button>` : ""}`;
    return `<article class="action-item"><span class="action-symbol ${["sync", "freshness", "status"].includes(item.kind) ? "sync" : ""}">${symbols[item.kind] || "!"}</span><div class="action-copy"><b>${escapeHtml(item.title || "远端状态需要关注")}</b><span>${escapeHtml(item.message || "请查看提醒中心了解详情")}</span></div><div class="action-actions">${actions}</div></article>`;
  }).join("") : `<article class="action-item"><span class="action-symbol good">✓</span><div class="action-copy"><b>没有需要立即处理的事项</b><span>已暂缓的提醒仍会保留在提醒中心，且不会影响首页或托盘状态。</span></div></article>`;
}

function renderPlatform() {
  const id = state.provider, provider = providers[id], account = getSelectedAccount(id);
  if (!provider) {
    state.provider = "openai";
    return renderPlatform();
  }
  if (id === "deepseek") applyDeepSeekAccountData(account);
  if (id === "openai") applyOpenAIAccountData(account);
  if (id === "volcengine") applyVolcengineAccountData(account);
  if (id === "mimo") applyMimoAccountData(account);
  let productId = state.products[id];
  let product = provider.products[productId];
  if (!product) {
    productId = Object.keys(provider.products)[0] || "remote";
    product = provider.products[productId] || remotePlaceholder(provider.name, Boolean(account));
    state.products[id] = productId;
  }
  els.selectedPlatformIcon.innerHTML = platformLogo(id, "large-brand-logo");
  els.selectedPlatformIcon.removeAttribute("style");
  els.selectedPlatformName.textContent = account ? account.name : provider.name;
  const warningSuffix = account?.productErrors?.length ? ` · ${account.productErrors.length} 项未授权或未开通` : "";
  els.selectedPlatformDescription.textContent = account ? `${provider.name} · ${account.keyHint} · 独立账户数据${warningSuffix}` : provider.description;
  const connectionBadge = document.querySelector(".connected-badge");
  const isConnected = Boolean(account);
  const freshness = accountFreshness(account); connectionBadge.textContent = isConnected ? freshness.label : "未连接";
  connectionBadge.classList.toggle("offline", !isConnected); connectionBadge.dataset.freshness = isConnected ? freshness.level : "none";
  document.querySelector(".header-stat strong").textContent = isConnected ? relativeSyncTime(account.lastSync) : "—";
  els.productTabs.innerHTML = Object.entries(provider.products).map(([pid,p]) => `<button class="${pid===productId?'active':''}" data-product="${escapeHtml(pid)}">${escapeHtml(p.name)}</button>`).join("");
  els.productSummary.innerHTML = product.summaries.map(([label,value,note]) => `<article class="summary-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`).join("");
  els.detailEyebrow.textContent = product.kind;
  els.detailTitle.textContent = `${product.name} · 远端指标`;
  renderDynamicTable(product);
  els.exportProductButton.disabled = !account || !(product.rows || []).length;
  renderMetricTrend(account, productId);
}

function metricHistoryKey(account, productId) {
  return `${account.id}|${productId}|${state.metricRangeDays}|${account.lastSync || "never"}`;
}

function formatMetricNumber(value, unit = "") {
  const number = Number(value);
  const formatted = Number.isFinite(number)
    ? new Intl.NumberFormat("zh-CN", { maximumFractionDigits:Math.abs(number) < 10 ? 2 : 1 }).format(number)
    : "—";
  if (unit === "CNY") return `¥ ${formatted}`;
  if (unit === "USD") return `$ ${formatted}`;
  return `${formatted}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
}

function clearMetricTrend(message) {
  els.trendPath.setAttribute("d", "");
  els.trendArea.setAttribute("d", "");
  els.trendPoints.innerHTML = "";
  els.trendChange.textContent = "等待采集";
  els.trendChange.classList.remove("down");
  els.trendEmpty.textContent = message;
  els.trendEmpty.hidden = false;
}

async function loadMetricHistory(account, productId, key) {
  if (state.metricHistoryRequestKey === key) return;
  state.metricHistoryRequestKey = key;
  try {
    const payload = await apiRequest("/api/metric-history", {
      method:"POST",
      body:JSON.stringify({ accountId:account.id, productId, rangeDays:state.metricRangeDays })
    });
    state.metricHistoryCache.set(key, payload.snapshots || []);
  } catch (error) {
    state.metricHistoryCache.set(key, { error:errorMessage(error) });
  } finally {
    if (state.metricHistoryRequestKey === key) state.metricHistoryRequestKey = "";
    const current = getSelectedAccount(state.provider);
    if (current?.id === account.id && state.products[state.provider] === productId) renderMetricTrend(account, productId);
  }
}

function renderMetricTrend(account, productId) {
  if (!account || account.provider === "mimo" || productId === "remote") {
    els.balanceTrendCard.hidden = true;
    return;
  }
  els.balanceTrendCard.hidden = false;
  document.querySelectorAll("[data-trend-range]").forEach(button => {
    const active = Number(button.dataset.trendRange) === state.metricRangeDays;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const key = metricHistoryKey(account, productId);
  const cached = state.metricHistoryCache.get(key);
  if (!cached) {
    els.trendMetricTabs.innerHTML = "";
    els.trendCaption.textContent = `正在读取最近 ${state.metricRangeDays} 天的远端快照`;
    clearMetricTrend("正在读取远端指标历史…");
    loadMetricHistory(account, productId, key);
    return;
  }
  if (cached.error) {
    els.trendMetricTabs.innerHTML = "";
    els.trendCaption.textContent = "趋势读取失败";
    clearMetricTrend(cached.error);
    return;
  }
  const groups = new Map();
  for (const item of cached) {
    if (!groups.has(item.metricId)) groups.set(item.metricId, []);
    groups.get(item.metricId).push(item);
  }
  const metrics = [...groups.entries()].map(([id,items]) => ({ id, label:items[0].label, unit:items[0].unit, items }));
  const selectionKey = `${account.id}|${productId}`;
  let selectedId = state.metricSelections[selectionKey];
  if (!metrics.some(metric => metric.id === selectedId)) selectedId = metrics[0]?.id || "";
  state.metricSelections[selectionKey] = selectedId;
  els.trendMetricTabs.innerHTML = metrics.map(metric => `<button type="button" class="${metric.id === selectedId ? "active" : ""}" data-trend-metric="${escapeHtml(metric.id)}" title="${escapeHtml(metric.label)}">${escapeHtml(metric.label)}</button>`).join("");
  const selected = metrics.find(metric => metric.id === selectedId);
  if (!selected) {
    els.trendCaption.textContent = `最近 ${state.metricRangeDays} 天 · 尚无可绘制数值`;
    clearMetricTrend("当前产品暂未返回可用于趋势分析的数值指标。");
    return;
  }
  const snapshots = selected.items.sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
  els.trendCaption.textContent = `${snapshots.length} 个远端快照 · 最近 ${state.metricRangeDays} 天`;
  if (snapshots.length < 2) {
    clearMetricTrend("至少完成两次跨小时同步后，才会显示变化曲线。");
    return;
  }
  const values = snapshots.map(item => Number(item.value));
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const points = values.map((value,index) => ({
    x:20 + index * (560 / Math.max(values.length - 1, 1)),
    y:140 - ((value - min) / range) * 110,
    value,
    timestamp:snapshots[index].timestamp
  }));
  const line = points.map((point,index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  els.trendPath.setAttribute("d", line);
  els.trendArea.setAttribute("d", `${line} L580,155 L20,155 Z`);
  els.trendPoints.innerHTML = points.map(point => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="4"><title>${escapeHtml(formatDate(point.timestamp))} · ${escapeHtml(formatMetricNumber(point.value, selected.unit))}</title></circle>`).join("");
  const change = values.at(-1) - values[0];
  els.trendChange.textContent = selected.unit === "%"
    ? `${change > 0 ? "+" : ""}${change.toFixed(1)} 个百分点`
    : `${change > 0 ? "+" : ""}${formatMetricNumber(change, selected.unit)}`;
  els.trendChange.classList.toggle("down", change < 0);
  els.trendEmpty.hidden = true;
}

function formatSyncSetting() {
  const minutes = state.backend.settings?.autoSyncMinutes || 0;
  return minutes ? `每 ${minutes} 分钟自动同步` : "自动同步已关闭";
}

async function syncDesktopPreferences(settings = state.backend.settings, strictKeys = []) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) return;
  const desired = {
    closeToTray:settings?.closeToTray !== false,
    launchAtStartup:Boolean(settings?.launchAtStartup)
  };
  const commands = {
    closeToTray:"set_close_to_tray",
    launchAtStartup:"set_launch_on_startup"
  };
  for (const key of Object.keys(commands)) {
    if (state.desktopPreferences[key] === desired[key]) continue;
    try {
      await invoke(commands[key], { value:desired[key] });
      state.desktopPreferences[key] = desired[key];
    } catch (error) {
      console.error(`应用桌面设置 ${key} 失败`, error);
      if (strictKeys.includes(key)) throw new Error(errorMessage(error, "Windows 拒绝应用此设置"));
    }
  }
}

function populateSettings() {
  const settings = state.backend.settings;
  if (!settings) return;
  setComboboxValue(els.appearanceMode, settings.appearanceMode || "system", false);
  setComboboxValue(els.autoSyncMinutes, String(settings.autoSyncMinutes), false);
  setComboboxValue(els.staleAfterMinutes, String(settings.staleAfterMinutes || 0), false);
  setComboboxValue(els.updateCheckMode, settings.updateCheckMode || "startup", false);
  setComboboxValue(els.historyRetentionDays, String(settings.historyRetentionDays || 90), false);
  els.lowBalanceThreshold.value = settings.lowBalanceThreshold;
  els.usageThreshold.value = settings.usageThreshold || 80;
  els.notificationsEnabled.checked = settings.notificationsEnabled;
  els.syncOnStartup.checked = Boolean(settings.syncOnStartup);
  els.closeToTray.checked = settings.closeToTray !== false;
  els.launchAtStartup.checked = Boolean(settings.launchAtStartup);
  els.updateCurrentVersion.textContent = state.backend.version || "—";
  const storage = state.backend.historyStorage || {};
  const balanceSnapshots = Number(storage.balanceSnapshots || 0);
  const metricSnapshots = Number(storage.metricSnapshots || 0);
  const syncEvents = Number(storage.syncEvents || 0);
  els.historyStorageSummary.textContent = `${balanceSnapshots + metricSnapshots + syncEvents} 条`;
  els.historyStorageDetail.textContent = `${metricSnapshots} 条指标快照 · ${balanceSnapshots} 条余额兼容快照 · ${syncEvents} 条同步记录`;
  els.clearHistoryButton.disabled = balanceSnapshots + metricSnapshots + syncEvents === 0;
}

function closeComboboxes(except) {
  document.querySelectorAll("[data-combobox].open").forEach(combo => {
    if (combo === except) return;
    combo.classList.remove("open");
    combo.querySelector("[data-combo-trigger]")?.setAttribute("aria-expanded", "false");
  });
}

function setComboboxValue(input, value, dispatch = true) {
  if (!input) return;
  const combo = input.closest("[data-combobox]");
  const option = [...combo.querySelectorAll(".combo-option[data-value]")].find(item => item.dataset.value === String(value));
  input.value = String(value);
  combo.querySelectorAll(".combo-option").forEach(item => item.classList.toggle("selected", item === option));
  if (option) combo.querySelector("[data-combo-label]").textContent = option.childNodes[0].textContent.trim();
  if (dispatch) input.dispatchEvent(new Event("change", { bubbles:true }));
}

function updateCredentialFields() {
  const provider = els.accountProvider.value;
  const isVolcengine = provider === "volcengine";
  const isOpenAI = provider === "openai";
  const isMimo = provider === "mimo";
  els.deepseekCredentials.hidden = isVolcengine || isOpenAI || isMimo;
  els.volcengineCredentials.hidden = !isVolcengine;
  els.openaiCredentials.hidden = !isOpenAI;
  els.mimoCredentials.hidden = !isMimo;
  els.deepseekCapability.hidden = isVolcengine || isOpenAI || isMimo;
  els.volcengineCapability.hidden = !isVolcengine;
  els.openaiCapability.hidden = !isOpenAI;
  els.mimoCapability.hidden = !isMimo;
  els.accountKey.required = !isVolcengine && !isOpenAI && !isMimo;
  els.volcAccessKey.required = isVolcengine;
  els.volcSecretKey.required = isVolcengine;
  els.mimoApiKey.required = isMimo;
  els.accountName.placeholder = isVolcengine ? "例如：火山工作账户" : isOpenAI ? "例如：OpenAI 个人账户" : isMimo ? "例如：MiMo Token Plan" : "例如：工作室主账户";
  syncMimoEndpointPresets();
}

function syncMimoEndpointPresets(targetId = "mimoBaseUrl") {
  const current = (els[targetId]?.value || "").trim().replace(/\/$/, "");
  document.querySelectorAll(`[data-mimo-target="${targetId}"]`).forEach(button => {
    button.classList.toggle("selected", button.dataset.mimoBaseUrl === current);
  });
}

function openConnectionDialog(account) {
  if (!account || account.provider === "openai") return;
  state.connectionAccountId = account.id;
  els.connectionDialogTitle.textContent = `${account.name} · 连接设置`;
  els.connectionDialogSubtitle.textContent = `${providers[account.provider]?.name || account.provider} · ${account.keyHint || "当前凭据已保存"}`;
  els.editDeepseekCredentials.hidden = account.provider !== "deepseek";
  els.editVolcengineCredentials.hidden = account.provider !== "volcengine";
  els.editMimoCredentials.hidden = account.provider !== "mimo";
  els.editAccountKey.value = "";
  els.editVolcAccessKey.value = "";
  els.editVolcSecretKey.value = "";
  els.editVolcRegion.value = account.region || APP_DEFAULTS.volcengineRegion;
  els.editVolcProject.value = account.projectName || APP_DEFAULTS.volcengineProject;
  els.editMimoApiKey.value = "";
  els.editMimoBaseUrl.value = account.baseUrl || APP_DEFAULTS.mimoPaygUrl;
  syncMimoEndpointPresets("editMimoBaseUrl");
  els.connectionDialog.showModal();
}

function renderDynamicTable(product) {
  const columns = product.columns || [];
  const productRows = product.rows || [];
  if (!columns.length || !productRows.length) {
    els.dynamicTable.innerHTML = `<div class="history-empty"><b>${escapeHtml(product.name)}</b><br>该产品没有可公开展示的明细字段；Prismeter 不会用其他产品或本地估算补齐。</div>`;
    return;
  }
  const header = `<div class="data-row header" style="--columns:${columns.length}"><span>模型 / 能力</span>${columns.map(c=>`<span>${escapeHtml(c)}</span>`).join("")}<span></span></div>`;
  const rows = productRows.map((row, index) => `<div class="data-row" data-row="${index}" style="--columns:${columns.length}">
    <div class="resource-cell"><div class="resource-badge">${escapeHtml(row.badge)}</div><div><b>${escapeHtml(row.name)}</b><span>${escapeHtml(row.type)}</span></div></div>
    ${row.metrics.map(([v,u])=>`<div class="metric-cell"><b>${escapeHtml(v)}</b><span>${escapeHtml(u)}</span></div>`).join("")}<span class="chevron">›</span>
  </div>`).join("");
  els.dynamicTable.innerHTML = header + rows;
}

function modelFamilyDefinition(id) {
  return {
    all:{ label:"全部模型与产品", aliases:[] },
    deepseek:{ label:"DeepSeek", aliases:["deepseek","深度求索"] },
    glm:{ label:"GLM", aliases:["glm","智谱"] },
    doubao:{ label:"Doubao", aliases:["doubao","豆包"] },
    mimo:{ label:"MiMo", aliases:["mimo","xiaomi","小米"] },
    gpt:{ label:"GPT / Codex", aliases:["gpt","codex","chatgpt","openai"] }
  }[id] || { label:id, aliases:[id] };
}

function matchesModelFamily(value, definition) {
  const text = String(value || "").toLocaleLowerCase();
  return definition.aliases.some(alias => text.includes(alias));
}

function collectRemoteModelRecords(familyId, levelFilter = "all", query = "") {
  const definition = modelFamilyDefinition(familyId);
  const includeAll = familyId === "all";
  const accounts = state.backend.accounts || [];
  const familyRecords = [];
  for (const account of accounts) {
    for (const product of account.products || []) {
      const productMatches = includeAll || matchesModelFamily(product.name, definition) || matchesModelFamily(product.kind, definition) || matchesModelFamily(product.id, definition);
      const matchedRows = (product.rows || []).filter(row => includeAll || matchesModelFamily(row.name, definition) || matchesModelFamily(row.type, definition));
      for (const row of matchedRows) {
        familyRecords.push({ account, product, row, level:"row" });
      }
      if (productMatches) familyRecords.push({ account, product, row:null, level:"product" });
    }
  }
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const records = familyRecords.filter(record => {
    if (levelFilter !== "all" && record.level !== levelFilter) return false;
    if (!normalizedQuery) return true;
    const provider = providers[record.account.provider];
    return [provider?.name, record.account.name, record.product.name, record.product.kind, record.row?.name, record.row?.type]
      .some(value => String(value || "").toLocaleLowerCase().includes(normalizedQuery));
  });
  return { definition, accounts, familyRecords, records };
}

function renderComparisons() {
  const familyId = els.modelFamilySelect.value;
  const levelFilter = els.modelLevelSelect.value;
  const query = els.modelSearchInput.value;
  const { definition, accounts, familyRecords, records } = collectRemoteModelRecords(familyId, levelFilter, query);
  const connectedProviderIds = [...new Set(accounts.map(account => account.provider))];
  const coveredProviderIds = [...new Set(familyRecords.map(record => record.account.provider))];
  const rowCount = records.filter(record => record.level === "row").length;
  const productCount = records.filter(record => record.level === "product").length;
  els.modelTotal.textContent = String(records.length);
  els.modelRowTotal.textContent = String(rowCount);
  els.modelProductTotal.textContent = String(productCount);
  els.modelTotalUnit.textContent = records.length ? `${definition.label} · 当前筛选结果` : `${definition.label} · 暂无匹配记录`;
  els.mainSource.textContent = connectedProviderIds.length ? `${coveredProviderIds.length} / ${connectedProviderIds.length} 个平台` : "尚未连接平台";
  const latestSync = accounts.map(account => account.lastSync).filter(Boolean).sort().at(-1);
  els.modelLatestSync.textContent = latestSync ? relativeSyncTime(latestSync) : "从未同步";
  els.modelResultCount.textContent = `${records.length} 条`;
  els.modelResultsTitle.textContent = query.trim() ? `“${query.trim()}”的远端结果` : `${definition.label} · ${levelFilter === "row" ? "模型级记录" : levelFilter === "product" ? "产品级记录" : "全部远端记录"}`;

  els.modelCoverage.innerHTML = connectedProviderIds.map(id => {
    const providerAccounts = accounts.filter(account => account.provider === id);
    const providerRecords = familyRecords.filter(record => record.account.provider === id);
    const rows = providerRecords.filter(record => record.level === "row").length;
    const products = providerRecords.filter(record => record.level === "product").length;
    const paused = providerAccounts.filter(account => account.enabled === false).length;
    return `<article class="glass-panel model-coverage-item ${providerRecords.length ? "covered" : "uncovered"}">
      ${platformLogo(id, "activity-brand-logo")}<div><b>${escapeHtml(providers[id]?.name || id)}</b><span>${providerAccounts.length} 个账户${paused ? ` · ${paused} 个已暂停` : ""}</span></div>
      <strong>${providerRecords.length ? `${rows} 模型级 · ${products} 产品级` : `无 ${escapeHtml(definition.label)} 字段`}</strong>
    </article>`;
  }).join("");

  if (!accounts.length) {
    els.modelCoverage.innerHTML = "";
    els.comparisonCards.innerHTML = '<article class="comparison-card remote-empty"><div class="comparison-card-top"><div><h4>请先连接平台账户</h4><span>账户连接成功并完成远端同步后，Prismeter 才会分析平台实际返回的模型或产品字段。</span></div></div><button class="soft-button model-account-link" data-target-view="accounts">前往账户中心</button></article>';
    return;
  }

  const cards = records.map(record => {
    const provider = providers[record.account.provider];
    const metricItems = record.row
      ? (record.row.metrics || []).slice(0, 4).map((metric,index) => ({ label:(record.product.columns || [])[index] || "指标 " + (index + 1), value:metric.value || "—", unit:metric.unit || "远端" }))
      : (record.product.summaries || []).slice(0, 4).map(metric => ({ label:metric.label || "远端指标", value:metric.value || "—", unit:metric.note || "平台返回" }));
    if (!metricItems.length) metricItems.push(
      { label:record.product.usageLabel || "远端用量", value:record.product.usage || "—", unit:record.product.kind || "官方产品" },
      { label:"产品状态", value:record.product.status || "正常", unit:"平台返回" }
    );
    const freshness = accountFreshness(record.account);
    return '<article class="comparison-card remote-model-card">' +
      '<div class="model-source-head">' + platformLogo(record.account.provider, "activity-brand-logo") + '<div><h4>' + escapeHtml(record.row?.name || record.product.name || definition.label) + '</h4><span>' + escapeHtml(provider?.name || record.account.provider) + ' · ' + escapeHtml(record.account.name) + ' · ' + escapeHtml(record.product.name || "远端产品") + '</span></div><span class="model-level-badge ' + record.level + '">' + (record.level === "row" ? "模型级" : "产品级") + '</span></div>' +
      '<div class="model-metrics">' + metricItems.map(metric => '<div><span>' + escapeHtml(metric.label) + '</span><strong>' + escapeHtml(metric.value) + '</strong><small>' + escapeHtml(metric.unit) + '</small></div>').join("") + '</div>' +
      '<div class="model-record-foot"><span class="freshness-text ' + freshness.level + '">' + escapeHtml(freshness.label) + ' · ' + escapeHtml(relativeSyncTime(record.account.lastSync)) + '</span><button class="text-button" data-view-account="' + escapeHtml(record.account.id) + '" data-account-provider="' + escapeHtml(record.account.provider) + '">查看账户数据 →</button></div>' +
    '</article>';
  });
  const uncovered = connectedProviderIds.filter(id => !coveredProviderIds.includes(id)).map(id => providers[id]?.name || id);
  const note = familyId !== "all" && uncovered.length ? '<article class="comparison-coverage-note"><b>' + escapeHtml(uncovered.join("、")) + '</b><span>当前远端响应没有 ' + escapeHtml(definition.label) + ' 模型级字段，因此未纳入；不会使用账户余额、套餐窗口或本地日志代替。</span></article>' : "";
  const emptyReason = query.trim() ? `没有包含“${escapeHtml(query.trim())}”的远端记录，请尝试账户名、模型名或产品名。` : `已检查 ${connectedProviderIds.map(id => escapeHtml(providers[id]?.name || id)).join("、")}，当前筛选条件下没有可展示字段。`;
  els.comparisonCards.innerHTML = cards.length ? cards.join("") + note : '<article class="comparison-card remote-empty"><div class="comparison-card-top"><div><h4>没有匹配的 ' + escapeHtml(definition.label) + ' 记录</h4><span>' + emptyReason + ' Prismeter 不会用其他口径或本地日志补齐。</span></div></div></article>' + note;
}

function renderAlerts() {
  const accounts = state.backend.accounts || [];
  const allAlerts = state.backend.alerts || [];
  const category = item => ["sync", "freshness", "status"].includes(item.kind) ? "sync" : item.kind;
  const counts = {
    balance:allAlerts.filter(item => category(item) === "balance").length,
    quota:allAlerts.filter(item => category(item) === "quota").length,
    sync:allAlerts.filter(item => category(item) === "sync").length
  };
  els.alertTotal.textContent = String(allAlerts.length);
  els.alertBalanceTotal.textContent = String(counts.balance);
  els.alertQuotaTotal.textContent = String(counts.quota);
  els.alertSyncTotal.textContent = String(counts.sync);
  const ruleAccounts = accounts.filter(account => account.provider !== "mimo");
  const disabledRules = ruleAccounts.filter(account => account.alertSettings?.enabled === false).length;
  const customizedRules = ruleAccounts.filter(account => {
    const settings = account.alertSettings || {};
    return settings.lowBalanceThreshold != null || settings.usageThreshold != null || settings.staleAfterMinutes != null;
  }).length;
  els.alertRuleSummary.textContent = ruleAccounts.length
    ? `${ruleAccounts.length - disabledRules} 个启用${disabledRules ? ` · ${disabledRules} 个关闭` : ""}${customizedRules ? ` · ${customizedRules} 个自定义` : ""}`
    : "尚未连接支持账户";
  els.alertRuleList.innerHTML = ruleAccounts.length ? ruleAccounts.map(account => {
    const settings = account.alertSettings || {};
    const disabled = settings.enabled === false;
    const overrides = [];
    if (settings.lowBalanceThreshold != null) overrides.push(`余额 ${settings.lowBalanceThreshold}`);
    if (settings.usageThreshold != null) overrides.push(`额度 ${settings.usageThreshold}%`);
    if (settings.staleAfterMinutes != null) overrides.push(`时效 ${formatRuleDuration(settings.staleAfterMinutes)}`);
    const stateLabel = disabled ? "提醒已关闭" : overrides.length ? overrides.join(" · ") : "跟随全局规则";
    return `<article class="alert-rule-item ${disabled ? "disabled" : overrides.length ? "custom" : "inherited"}">
      ${platformLogo(account.provider, "activity-brand-logo")}<div><b>${escapeHtml(account.name)}</b><span>${escapeHtml(stateLabel)}</span></div>
      <button type="button" class="mini-button" data-account-alerts="${escapeHtml(account.id)}">${disabled ? "重新启用" : "调整规则"}</button>
    </article>`;
  }).join("") : `<div class="alert-rule-empty">连接 OpenAI/Codex、火山方舟或 DeepSeek 后，可在这里管理账户提醒规则。</div>`;
  document.querySelectorAll("[data-alert-filter]").forEach(button => {
    const active = button.dataset.alertFilter === state.alertFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const visibleAlerts = state.alertFilter === "all" ? allAlerts : allAlerts.filter(item => category(item) === state.alertFilter);
  const snoozedCount = visibleAlerts.filter(isAlertSnoozed).length;
  els.alertFilterResult.textContent = `${visibleAlerts.length} 条提醒${snoozedCount ? ` · ${snoozedCount} 条已暂缓` : ""}`;
  const symbols = { balance:"¥", quota:"%", sync:"!", freshness:"↻", status:"!" };
  const badges = { balance:"余额", quota:"额度", sync:"同步", freshness:"时效", status:"状态" };
  els.alertList.innerHTML = visibleAlerts.length ? visibleAlerts.map(item => {
    const account = (state.backend.accounts || []).find(candidate => candidate.id === item.accountId);
    const kind = category(item);
    const snoozed = isAlertSnoozed(item);
    const snoozeButton = item.alertKey ? `<button class="mini-button" ${snoozed ? "data-resume-alert" : "data-snooze-alert"}="${escapeHtml(item.alertKey)}">${snoozed ? "恢复提醒" : "暂缓 24 小时"}</button>` : "";
    return `<article class="alert-item glass-panel live-alert ${kind}${snoozed ? " snoozed" : ""}" data-alert-kind="${kind}">
      <div class="alert-symbol">${symbols[item.kind] || "!"}</div>
      <div class="alert-copy"><div class="alert-title-row">${platformLogo(item.provider || account?.provider, "activity-brand-logo")}<div><h4>${escapeHtml(item.title || item.accountName || "远端状态需要关注")}</h4><span>${escapeHtml(providers[item.provider || account?.provider]?.name || "已连接平台")} · ${escapeHtml(item.accountName || account?.name || "账户")}</span></div></div><p>${escapeHtml(item.message || "远端状态需要关注")}</p></div>
      <div class="alert-side"><span class="official-alert${snoozed ? " snoozed" : ""}">${snoozed ? `已暂缓至 ${escapeHtml(formatDate(item.snoozedUntil))}` : `${badges[item.kind] || "提醒"} · 远端`}</span><div class="alert-actions">${snoozeButton}${account ? `<button class="mini-button" data-account-alerts="${escapeHtml(account.id)}">调整规则</button><button class="mini-button" data-view-account="${escapeHtml(account.id)}" data-account-provider="${escapeHtml(account.provider)}">查看数据</button><button class="mini-button alert-sync-button" data-sync-account="${escapeHtml(account.id)}"><span>立即同步</span></button>` : ""}</div></div>
    </article>`;
  }).join("") : allAlerts.length
    ? `<article class="alert-empty glass-panel"><div class="alert-symbol">✓</div><div><h4>此分类暂无提醒</h4><p>可以切换其他分类，或前往设置调整余额和额度阈值。</p></div></article>`
    : accounts.length
      ? `<article class="alert-empty glass-panel good"><div class="alert-symbol">✓</div><div><h4>暂无远端提醒</h4><p>当前账户没有余额、套餐额度、同步结果或数据时效提醒。</p></div></article>`
      : `<article class="alert-empty glass-panel"><div class="alert-symbol">i</div><div><h4>尚未连接账户</h4><p>添加平台账户并完成远端同步后，这里会显示余额、额度和同步状态提醒。</p></div></article>`;
}

function formatRuleDuration(minutes) {
  const value = Number(minutes || 0);
  if (value >= 10080 && value % 10080 === 0) return `${value / 10080} 周`;
  if (value >= 1440 && value % 1440 === 0) return `${value / 1440} 天`;
  if (value >= 60 && value % 60 === 0) return `${value / 60} 小时`;
  return `${value} 分钟`;
}

function openAccountAlertsDialog(account) {
  if (!account || account.provider === "mimo") return;
  const settings = account.alertSettings || {};
  state.alertAccountId = account.id;
  els.accountAlertsTitle.textContent = `${account.name} · 提醒规则`;
  els.accountAlertsSummary.textContent = `未单独设置的阈值将跟随全局规则：低余额 ${state.backend.settings?.lowBalanceThreshold ?? 10}，套餐额度 ${state.backend.settings?.usageThreshold ?? 80}% 已用。`;
  els.accountAlertsEnabled.checked = settings.enabled !== false;
  els.accountLowBalanceThreshold.value = settings.lowBalanceThreshold ?? "";
  els.accountUsageThreshold.value = settings.usageThreshold ?? "";
  setComboboxValue(els.accountStaleAfterMinutes, settings.staleAfterMinutes ?? "", false);
  els.accountBalanceRule.hidden = account.provider !== "deepseek";
  els.accountUsageRule.hidden = account.provider === "deepseek";
  updateAccountAlertFieldState();
  els.accountAlertsDialog.showModal();
}

function renderAccountHealth(accounts) {
  const freshness = overallFreshness(accounts);
  const healthy = accounts.filter(account => account.enabled !== false && ["fresh", "aging"].includes(accountFreshness(account).level)).length;
  const attention = accounts.filter(account => account.enabled !== false && ["error", "stale", "never"].includes(accountFreshness(account).level)).length;
  els.healthMonitored.textContent = freshness.monitored;
  els.healthHealthy.textContent = healthy;
  els.healthAttention.textContent = attention;
  els.healthPaused.textContent = freshness.counts.paused;
  els.retryFailedButton.disabled = !accounts.some(account => account.enabled !== false && account.lastError);
}

function renderSyncCenter(accounts) {
  const sync = state.backend.sync || {};
  const activeIds = new Set(sync.activeAccountIds || []);
  const activeCount = activeIds.size;
  els.syncCenterBadge.className = `sync-center-badge${activeCount ? " active" : ""}`;
  els.syncCenterBadge.textContent = activeCount ? `${activeCount} 个任务进行中` : "当前空闲";
  els.syncCenterSummary.innerHTML = [
    ["监控账户", String(sync.monitoredCount ?? accounts.filter(account => account.enabled !== false).length)],
    ["同步失败", String(sync.failedCount ?? accounts.filter(account => account.lastError).length)],
    ["最近尝试", relativeSyncTime(sync.lastAttemptAt)],
    ["最近成功", relativeSyncTime(sync.lastSuccessAt)]
  ].map(([label,value]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");

  els.syncQueueList.innerHTML = accounts.length ? accounts.map(account => {
    const active = activeIds.has(account.id);
    const freshness = accountFreshness(account);
    const retryLabel = Number(state.backend.settings?.autoSyncMinutes || 0) > 0 ? relativeFutureTime(account.nextRetryAt) : "";
    const status = active ? "正在读取远端" : account.enabled === false ? "已暂停" : retryLabel ? retryLabel : account.lastError ? "等待下次同步" : account.lastSync ? "等待下次同步" : "等待首次同步";
    const detail = active ? "同步结束前仍可浏览已有数据" : account.lastError && retryLabel ? `${account.consecutiveFailures || 1} 次连续失败 · 最近尝试 ${relativeSyncTime(account.lastAttemptAt)}` : account.lastAttemptAt ? `最近尝试 ${relativeSyncTime(account.lastAttemptAt)}` : "尚未发起远端请求";
    return `<div class="sync-queue-row ${active ? "active" : ""}">${platformLogo(account.provider, "sync-provider-logo")}<div><b>${escapeHtml(account.name)}</b><span>${escapeHtml(providers[account.provider]?.name || account.provider)} · ${escapeHtml(detail)}</span></div><span class="sync-queue-status ${active ? "active" : freshness.level}"><i></i>${escapeHtml(status)}</span></div>`;
  }).join("") : `<div class="sync-center-empty">连接账户后，这里会显示每个远端同步任务的实时状态。</div>`;
}

function renderCapabilityMatrix() {
  const matrix = state.backend.capabilities?.matrix || [];
  els.capabilityMatrix.innerHTML = matrix.length ? matrix.map(platform => {
    const observed = new Set(platform.observedProductIds || []);
    const items = (platform.items || []).map(item => {
      const isObserved = observed.has(item.id) || (platform.provider === "deepseek" && item.id === "balance" && platform.connected);
      const statusClass = item.support === "unavailable" || item.support === "console_only" || item.support === "disabled" ? "limited" : isObserved ? "available" : "supported";
      const statusText = item.support === "disabled" ? "暂不可添加" : item.support === "unavailable" ? "接口未提供" : item.support === "console_only" ? "仅控制台" : isObserved ? "已读取" : platform.connected ? "尚未返回" : "支持连接";
      return `<div class="capability-item"><span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.source)}</small></span><em class="${statusClass}">${statusText}</em></div>`;
    }).join("");
    return `<section class="capability-provider"><header>${platformLogo(platform.provider, "capability-provider-logo")}<div><b>${escapeHtml(platform.label)}</b><span>${platform.connected ? `${platform.accountCount} 个账户已连接` : "尚未连接账户"}</span></div></header>${items}</section>`;
  }).join("") : `<div class="sync-center-empty">正在读取平台能力定义…</div>`;
}

function renderSyncHistory(accounts) {
  const events = state.backend.syncEvents || [];
  const successCount = events.filter(event => event.success).length;
  const failedCount = events.length - successCount;
  const averageDuration = events.length ? Math.round(events.reduce((sum,event) => sum + Number(event.durationMs || 0), 0) / events.length) : 0;
  els.syncEventSummary.innerHTML = [
    ["全部任务", String(events.length), "本机保存的同步元数据"],
    ["同步成功", String(successCount), events.length ? `${Math.round(successCount / events.length * 100)}% 成功率` : "暂无记录"],
    ["同步失败", String(failedCount), failedCount ? "可以直接重试账户" : "当前无失败"],
    ["平均耗时", formatDuration(averageDuration), "最近 120 条记录"]
  ].map(([label,value,note]) => `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></div>`).join("");
  document.querySelectorAll("[data-sync-history-filter]").forEach(button => {
    const active = button.dataset.syncHistoryFilter === state.syncEventFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const visible = events.filter(event => state.syncEventFilter === "all" || (state.syncEventFilter === "success" ? event.success : !event.success));
  els.syncEventCount.textContent = `${visible.length} 条记录`;
  els.syncEventList.innerHTML = visible.length ? visible.slice(0, 40).map(event => {
    const account = accounts.find(item => item.id === event.accountId);
    const logo = account ? platformLogo(account.provider, "sync-provider-logo") : '<span class="sync-event-fallback">?</span>';
    return `<article class="sync-event-row ${event.success ? "success" : "failed"}">
      ${logo}<div class="sync-event-main"><b>${escapeHtml(account?.name || "已移除账户")}</b><span>${escapeHtml(account ? providers[account.provider]?.name || account.provider : "历史账户")} · ${escapeHtml(formatDate(event.timestamp))}</span></div>
      <div class="sync-event-metrics"><span>${formatDuration(event.durationMs)}</span><span>${event.productCount || 0} 项远端数据</span></div>
      <div class="sync-event-result"><strong>${event.success ? "同步成功" : "同步失败"}</strong><small>${escapeHtml(event.message || (event.success ? "远端数据已更新" : "远端请求失败"))}</small></div>
      ${!event.success && account ? `<button class="mini-button" data-sync-account="${escapeHtml(account.id)}"><span>重试</span></button>` : ""}
    </article>`;
  }).join("") : `<div class="sync-history-empty">${events.length ? "此分类暂无同步记录。" : "完成一次账户同步后，这里会显示任务结果和耗时。"}</div>`;
}

function renderAccounts() {
  const accounts = state.backend.accounts || [];
  const history = state.backend.history || [];
  renderAccountHealth(accounts);
  renderSyncCenter(accounts);
  renderCapabilityMatrix();
  renderSyncHistory(accounts);
  els.accountListTitle.textContent = `账户列表 · ${accounts.length}`;
  els.accountsEmpty.hidden = accounts.length > 0;
  els.accountsList.innerHTML = accounts.map(account => {
    const provider = providers[account.provider];
    const balance = account.balances?.find(item => item.currency === "CNY") || account.balances?.[0];
    const primaryProduct = account.products?.[0];
    const metricLabel = balance ? "当前余额" : "主要指标";
    const metricValue = balance ? `${moneySymbol(balance.currency)} ${balance.total}` : primaryProduct?.usage || "—";
    const syncing = (state.backend.sync?.activeAccountIds || []).includes(account.id);
    const availability = syncing ? "正在同步" : account.enabled === false ? "监控已暂停" : account.isAvailable ? ((account.provider === "volcengine" || account.provider === "openai" || account.provider === "mimo") ? `${account.products?.length || 0} 个产品` : "可用") : "同步异常";
    const freshness = syncing ? { level:"syncing", label:"正在同步" } : accountFreshness(account);
    const accountId = escapeHtml(account.id);
    return `<article class="saved-account directory-account ${account.id === state.accountId ? 'selected' : ''} ${account.enabled === false ? 'paused-account' : ''}" data-sort-account="${accountId}">
      <div class="saved-account-head">
        ${platformLogo(account.provider, "account-brand-logo")}
        <div><b>${escapeHtml(account.name)}</b><span>${escapeHtml(provider?.name || account.provider)} · ${escapeHtml(account.keyHint)}</span></div>
        <span class="freshness-badge ${freshness.level}"><i></i>${escapeHtml(freshness.label)}</span>
        <i class="drag-handle account-drag-handle" data-drag-account="${accountId}" title="按住拖拽调整账户顺序" aria-label="拖拽调整账户顺序">⋮⋮</i>
      </div>
      <div class="account-directory-metrics"><div><span>连接状态</span><strong>${escapeHtml(availability)}</strong></div><div><span>${metricLabel}</span><strong>${escapeHtml(metricValue)}</strong></div><div><span>最近同步</span><strong>${escapeHtml(relativeSyncTime(account.lastSync))}</strong><small>${escapeHtml(formatDate(account.lastSync))} · 远端耗时 ${escapeHtml(formatDuration(account.lastSyncDurationMs))}</small></div></div>
      ${account.lastError ? `<p class="account-error">${escapeHtml(account.lastError)}</p>` : ""}
      ${(account.productErrors || []).length ? `<p class="account-error">${(account.productErrors || []).map(escapeHtml).join("<br>")}</p>` : ""}
      <div class="account-actions"><button class="soft-button compact" data-view-account="${accountId}" data-account-provider="${escapeHtml(account.provider)}">查看数据</button><span><button class="mini-button" data-diagnose-account="${accountId}">连接诊断</button>${account.provider === "mimo" ? "" : `<button class="mini-button" data-account-alerts="${accountId}">${account.alertSettings?.enabled === false ? "提醒已关闭" : "提醒规则"}</button>`}${account.provider === "openai" ? "" : `<button class="mini-button" data-edit-connection="${accountId}" ${syncing ? "disabled" : ""}>连接设置</button>`}<button class="mini-button" data-rename-account="${accountId}">重命名</button><button class="mini-button" data-toggle-account="${accountId}">${account.enabled === false ? "恢复监控" : "暂停监控"}</button><button class="mini-button" data-sync-account="${accountId}" ${syncing ? "disabled" : ""}><span>${syncing ? "同步中" : "立即同步"}</span></button><button class="danger-link" data-delete-account="${accountId}" ${syncing ? "disabled" : ""}>移除</button></span></div>
    </article>`;
  }).join("");

  els.historyCount.textContent = `${history.length} 条记录`;
  els.historyList.innerHTML = history.length ? history.slice(0, 24).map(item => {
    const account = accounts.find(candidate => candidate.id === item.accountId);
    return `<div class="history-row"><i></i><div><b>${escapeHtml(account?.name || "已移除账户")}</b><span>${escapeHtml(formatDate(item.timestamp))}</span></div><strong>${escapeHtml(`${moneySymbol(item.currency)} ${item.total}`)}</strong><small>${escapeHtml(item.currency)}</small></div>`;
  }).join("") : `<div class="history-empty">DeepSeek 完成远端同步后，这里会保存官方余额快照；快照不参与用量推算。</div>`;
}

function updateAccountAlertFieldState() {
  const disabled = !els.accountAlertsEnabled.checked;
  els.accountAlertFields.classList.toggle("disabled-fields", disabled);
  [els.accountLowBalanceThreshold, els.accountUsageThreshold].forEach(input => { input.disabled = disabled; });
  const trigger = els.accountStaleAfterMinutes.closest("[data-combobox]")?.querySelector("[data-combo-trigger]");
  if (trigger) trigger.disabled = disabled;
}

function switchView(view, providerId, accountId) {
  if (providerId) {
    state.provider = providerId;
    state.accountId = accountId || null;
    state.view = "platforms";
    renderNavigation();
  }
  else state.view = view;
  document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v.id === `${state.view}View`));
  document.querySelectorAll(".nav-item").forEach(button => {
    const active = button.dataset.view === state.view;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const headings = {
    overview:["用量总览","集中查看各平台远端用量"], platforms:["平台中心","按平台支持能力展示远端指标"],
    models:["模型分析","只分析平台实际返回的模型与产品字段"], alerts:["提醒中心","关注余额、额度与同步状态"],
    accounts:["账户中心","连接远端账户，凭据加密保存在本机"],
    settings:["设置","外观、同步与提醒按你的习惯运行"]
  }[state.view];
  els.eyebrow.textContent = headings[0]; els.pageTitle.textContent = headings[1];
  if (state.view === "platforms") renderPlatform();
  if (state.view === "models") renderComparisons();
  if (state.view === "alerts") renderAlerts();
  if (state.view === "accounts") renderAccounts();
  if (state.view === "settings") populateSettings();
}

function diagnosticPayload(account) {
  const freshness = accountFreshness(account);
  return {
    appVersion: state.backend.version || "未知版本",
    generatedAt: new Date().toISOString(),
    account: account.name,
    platform: providers[account.provider]?.name || account.provider,
    accountHint: account.keyHint || "—",
    monitoring: account.enabled === false ? "paused" : "active",
    status: freshness.label,
    createdAt: account.createdAt || null,
    lastAttemptAt: account.lastAttemptAt || null,
    lastSuccessAt: account.lastSync || null,
    durationMs: Number(account.lastSyncDurationMs || 0),
    consecutiveFailures: Number(account.consecutiveFailures || 0),
    nextRetryAt: Number(state.backend.settings?.autoSyncMinutes || 0) > 0 ? account.nextRetryAt || null : null,
    products: (account.products || []).map(product => ({ id:product.id, name:product.name, status:product.status || null })),
    productWarnings: account.productErrors || [],
    error: account.lastError || null
  };
}

function showAccountDiagnostics(account) {
  if (!account) return;
  state.diagnosticAccountId = account.id;
  const freshness = accountFreshness(account);
  els.diagnosticTitle.textContent = account.name;
  els.diagnosticSubtitle.textContent = `${providers[account.provider]?.name || account.provider} · ${account.keyHint || "已连接账户"}`;
  els.diagnosticBadge.className = `freshness-badge ${freshness.level}`;
  els.diagnosticBadge.querySelector("b").textContent = freshness.label;
  const metrics = [
    ["监控状态", account.enabled === false ? "已暂停" : "正在监控", account.enabled === false ? "不参与自动同步" : "参与自动同步"],
    ["最近尝试", relativeSyncTime(account.lastAttemptAt), formatDate(account.lastAttemptAt)],
    ["最近成功", relativeSyncTime(account.lastSync), formatDate(account.lastSync)],
    ["远端耗时", formatDuration(account.lastSyncDurationMs), "最近一次请求"],
    ["连续失败", String(account.consecutiveFailures || 0), Number(state.backend.settings?.autoSyncMinutes || 0) > 0 && account.nextRetryAt ? relativeFutureTime(account.nextRetryAt) : Number(account.consecutiveFailures || 0) ? "建议检查凭据或手动重试" : "连接稳定"],
    ["发现产品", String((account.products || []).length), (account.productErrors || []).length ? `${account.productErrors.length} 条产品警告` : "无产品警告"]
  ];
  els.diagnosticMetrics.innerHTML = metrics.map(item => `<div><span>${escapeHtml(item[0])}</span><strong>${escapeHtml(item[1])}</strong><small>${escapeHtml(item[2])}</small></div>`).join("");
  const errors = [account.lastError, ...(account.productErrors || [])].filter(Boolean);
  els.diagnosticError.hidden = !errors.length;
  els.diagnosticError.innerHTML = errors.length ? `<b>远端返回信息</b><p>${errors.map(escapeHtml).join("<br>")}</p>` : "";
  els.diagnosticDialog.showModal();
}

function showRowDialog(index) {
  const provider = providers[state.provider];
  const product = provider.products[state.products[state.provider]];
  const row = product.rows[index];
  els.dialogTitle.textContent = row.name;
  els.dialogDescription.textContent = `${provider.name} · ${product.name} · ${row.type}。这里只展示当前产品和该资源实际支持的指标；不支持的字段不会按 0 处理。`;
  els.dialogMetrics.innerHTML = product.columns.map((label,i)=>`<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(row.metrics[i]?.[0] || "—")}</strong><small>${escapeHtml(row.metrics[i]?.[1] || "远端")}</small></div>`).join("");
  els.metricDialog.showModal();
}

let toastTimer;
function showToast(text, requestedTone = "auto") {
  const message = String(text || "操作未完成");
  const tone = requestedTone !== "auto" ? requestedTone
    : /同步完成.*失败|仍失败|已暂停|需要重试/.test(message) ? "warning"
    : /失败|错误|异常|无法|无效|拒绝|过期/.test(message) ? "error"
    : /尚未|暂无|当前没有|未添加|不支持|未提供/.test(message) ? "info"
    : "success";
  const icon = { success:"✓", info:"i", warning:"!", error:"×" }[tone];
  clearTimeout(toastTimer);
  els.toast.classList.remove("success", "info", "warning", "error", "show");
  els.toast.classList.add(tone);
  els.toast.querySelector(".toast-icon").textContent = icon;
  els.toast.querySelector("p").textContent = message;
  requestAnimationFrame(()=>els.toast.classList.add("show"));
  toastTimer = setTimeout(()=>els.toast.classList.remove("show"), 2400);
}

function setUpdateStatus(text, tone = "") {
  els.updateStatusText.textContent = text;
  els.updateStatusText.className = tone ? `update-status-${tone}` : "";
}

function renderUpdateNotes(notes) {
  const source = String(notes || "").trim();
  if (!source) return "<p>此版本暂未提供更新说明。</p>";
  let inList = false;
  const output = [];
  const closeList = () => {
    if (inList) { output.push("</ul>"); inList = false; }
  };
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) { closeList(); continue; }
    if (line === "---") { closeList(); output.push("<hr>"); continue; }
    if (line.startsWith("### ")) { closeList(); output.push(`<h4>${escapeHtml(line.slice(4))}</h4>`); continue; }
    if (line.startsWith("## ")) { closeList(); output.push(`<h3>${escapeHtml(line.slice(3))}</h3>`); continue; }
    if (line.startsWith("- ")) {
      if (!inList) { output.push("<ul>"); inList = true; }
      output.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      continue;
    }
    closeList();
    output.push(`<p>${escapeHtml(line)}</p>`);
  }
  closeList();
  return output.join("");
}

function showUpdateDialog(update) {
  state.availableUpdate = update;
  els.updateDialogTitle.textContent = `Prismeter ${update.version} 已可用`;
  els.updateDialogSummary.textContent = `当前版本 ${update.currentVersion}。下载安装前会验证更新签名，安装时应用将自动关闭。`;
  els.updateReleaseNotes.innerHTML = renderUpdateNotes(update.notes);
  els.updateProgress.hidden = true;
  els.updateProgressBar.style.width = "0%";
  els.updateProgressText.textContent = "准备下载…";
  [els.updateDialogClose, els.skipUpdateButton, els.laterUpdateButton, els.installUpdateButton].forEach(button => button.disabled = false);
  els.installUpdateButton.querySelector("span").textContent = "下载并安装";
  if (!els.updateDialog.open) els.updateDialog.showModal();
}

async function checkForUpdates({manual = false} = {}) {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) {
    if (manual) showToast("仅安装版支持应用内更新", "info");
    return;
  }
  const button = els.checkUpdateButton;
  button.disabled = true;
  button.classList.add("checking");
  button.querySelector("span").textContent = "正在检查…";
  setUpdateStatus("正在连接 GitHub Release…");
  try {
    const update = await invoke("check_for_update");
    if (!update) {
      state.availableUpdate = null;
      setUpdateStatus("当前已是最新版本", "success");
      if (manual) showToast("当前已是最新版本");
      return;
    }
    setUpdateStatus(`发现 ${update.version}`, "available");
    const skipped = state.backend.settings?.skippedUpdateVersion === update.version;
    if (manual || !skipped) showUpdateDialog(update);
  } catch (error) {
    const message = String(error || "无法检查更新");
    setUpdateStatus("检查失败，请稍后重试", "error");
    if (manual) showToast(message, "error");
    else console.warn("自动检查更新失败", message);
  } finally {
    button.disabled = false;
    button.classList.remove("checking");
    button.querySelector("span").textContent = "检查更新";
  }
}

function maybeCheckForUpdates() {
  if (state.updateCheckStarted || !state.backend.settings) return;
  state.updateCheckStarted = true;
  if ((state.backend.settings.updateCheckMode || "startup") === "startup") {
    window.setTimeout(() => checkForUpdates(), 1600);
  }
}

async function installAvailableUpdate() {
  const invoke = window.__TAURI__?.core?.invoke;
  const Channel = window.__TAURI__?.core?.Channel;
  if (!invoke || !Channel) { showToast("当前环境无法安装更新", "error"); return; }
  let downloaded = 0;
  let contentLength = 0;
  const channel = new Channel();
  channel.onmessage = message => {
    const event = String(message?.event || "").toLowerCase();
    const data = message?.data || {};
    if (event === "started") {
      contentLength = Number(data.contentLength ?? data.content_length ?? 0);
      els.updateProgressText.textContent = contentLength ? "开始下载更新…" : "正在下载更新…";
    } else if (event === "progress") {
      downloaded += Number(data.chunkLength ?? data.chunk_length ?? 0);
      if (contentLength > 0) {
        const percent = Math.min(100, Math.round(downloaded / contentLength * 100));
        els.updateProgressBar.style.width = `${percent}%`;
        els.updateProgressText.textContent = `已下载 ${percent}%`;
      }
    } else if (event === "finished") {
      els.updateProgressBar.style.width = "100%";
      els.updateProgressText.textContent = "下载完成，正在验证并安装…";
    }
  };
  [els.updateDialogClose, els.skipUpdateButton, els.laterUpdateButton, els.installUpdateButton].forEach(button => button.disabled = true);
  els.updateProgress.hidden = false;
  els.installUpdateButton.querySelector("span").textContent = "正在安装…";
  try {
    await invoke("install_update", { onEvent: channel });
  } catch (error) {
    setUpdateStatus("安装失败，请重新检查", "error");
    showToast(String(error || "更新安装失败"), "error");
    [els.updateDialogClose, els.skipUpdateButton, els.laterUpdateButton, els.installUpdateButton].forEach(button => button.disabled = false);
    els.installUpdateButton.querySelector("span").textContent = "重新检查";
    state.availableUpdate = null;
  }
}

let dragState = null;
let suppressClickUntil = 0;

function renderOrderedAccountSurfaces() {
  renderNavigation();
  renderOverview();
  renderAccounts();
  if (state.view === "models") renderComparisons();
}

function orderedProviderIds(accounts = state.backend.accounts || []) {
  const available = [...new Set(accounts.map(account => account.provider))];
  return [...new Set([...(state.backend.providerOrder || []), ...available])].filter(provider => available.includes(provider));
}

const sortableSurfaces = [
  ["#platformNav [data-sort-account]", "sortAccount"],
  ["#platformCards [data-sort-provider]", "sortProvider"],
  ["#accountsList [data-sort-account]", "sortAccount"]
];

function captureSortableLayout() {
  return sortableSurfaces.map(([selector, key]) => ({
    selector,
    key,
    rects:new Map([...document.querySelectorAll(selector)].map(element => [element.dataset[key], element.getBoundingClientRect()]))
  }));
}

function animateSortableLayout(layout) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  layout.forEach(({selector, key, rects}) => {
    document.querySelectorAll(selector).forEach(element => {
      const before = rects.get(element.dataset[key]);
      const after = element.getBoundingClientRect();
      if (!before) return;
      const x = before.left - after.left;
      const y = before.top - after.top;
      if (Math.abs(x) < 1 && Math.abs(y) < 1) return;
      element.animate([
        { transform:`translate3d(${x}px, ${y}px, 0)` },
        { transform:"translate3d(0, 0, 0)" }
      ], { duration:360, easing:"cubic-bezier(.22,.8,.22,1)" });
    });
  });
}

function updateOrderedAccountSurfaces(accounts) {
  const layout = captureSortableLayout();
  state.backend.accounts = accounts;
  renderOrderedAccountSurfaces();
  animateSortableLayout(layout);
}

function updateProviderOrder(providerOrder) {
  const layout = captureSortableLayout();
  state.backend.providerOrder = providerOrder;
  renderOverview();
  animateSortableLayout(layout);
}

async function persistAccountOrder(nextAccounts, successText = "顺序已保存") {
  const previousAccounts = [...(state.backend.accounts || [])];
  updateOrderedAccountSurfaces(nextAccounts);
  try {
    await apiRequest("/api/accounts/reorder", {
      method:"POST",
      body:JSON.stringify({accountIds:nextAccounts.map(account => account.id)})
    });
    showToast(successText);
  } catch (error) {
    updateOrderedAccountSurfaces(previousAccounts);
    showToast(errorMessage(error), "error");
  }
}

function moveAccount(sourceId, targetId, insertAfter) {
  const accounts = [...(state.backend.accounts || [])];
  const sourceIndex = accounts.findIndex(account => account.id === sourceId);
  const targetIndex = accounts.findIndex(account => account.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
  const [source] = accounts.splice(sourceIndex, 1);
  let insertion = accounts.findIndex(account => account.id === targetId);
  if (insertAfter) insertion += 1;
  accounts.splice(insertion, 0, source);
  persistAccountOrder(accounts, "账户顺序已保存");
}

function moveProvider(sourceProvider, targetProvider, insertAfter) {
  const providersInOrder = orderedProviderIds();
  const sourceIndex = providersInOrder.indexOf(sourceProvider);
  const targetIndex = providersInOrder.indexOf(targetProvider);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
  providersInOrder.splice(sourceIndex, 1);
  let insertion = providersInOrder.indexOf(targetProvider);
  if (insertAfter) insertion += 1;
  providersInOrder.splice(insertion, 0, sourceProvider);
  persistProviderOrder(providersInOrder);
}

async function persistProviderOrder(providerOrder) {
  const previousOrder = orderedProviderIds();
  updateProviderOrder(providerOrder);
  try {
    const result = await apiRequest("/api/providers/reorder", {
      method:"POST",
      body:JSON.stringify({providerIds:providerOrder})
    });
    state.backend.providerOrder = result.providerOrder || providerOrder;
    showToast("平台顺序已保存");
  } catch (error) {
    updateProviderOrder(previousOrder);
    showToast(errorMessage(error), "error");
  }
}

function clearDragTargets() {
  document.querySelectorAll(".drag-over,.drag-before,.drag-after").forEach(element => element.classList.remove("drag-over", "drag-before", "drag-after"));
}

function clearPointerSort() {
  if (!dragState) return;
  dragState.source?.classList.remove("sorting-source");
  dragState.ghost?.remove();
  clearDragTargets();
  document.body.classList.remove("pointer-sorting");
  dragState = null;
}

document.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  const accountHandle = event.target.closest("[data-drag-account]");
  const providerHandle = event.target.closest("[data-drag-provider]");
  const handle = accountHandle || providerHandle;
  if (!handle) return;
  const kind = accountHandle ? "account" : "provider";
  const source = handle.closest(kind === "account" ? "[data-sort-account]" : "[data-sort-provider]");
  if (!source) return;
  dragState = {
    kind,
    id:accountHandle ? accountHandle.dataset.dragAccount : providerHandle.dataset.dragProvider,
    pointerId:event.pointerId,
    startX:event.clientX,
    startY:event.clientY,
    moved:false,
    source,
    target:null,
    insertAfter:false
  };
  handle.setPointerCapture?.(event.pointerId);
  event.preventDefault();
  event.stopPropagation();
});

document.addEventListener("pointermove", event => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  if (!dragState.moved && Math.hypot(event.clientX - dragState.startX, event.clientY - dragState.startY) < 5) return;
  if (!dragState.moved) {
    dragState.moved = true;
    const rect = dragState.source.getBoundingClientRect();
    const ghost = dragState.source.cloneNode(true);
    ghost.classList.remove("sorting-source", "drag-over", "drag-before", "drag-after");
    ghost.classList.add("sort-drag-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    dragState.offsetX = event.clientX - rect.left;
    dragState.offsetY = event.clientY - rect.top;
    dragState.ghost = ghost;
    document.body.appendChild(ghost);
    dragState.source.classList.add("sorting-source");
    document.body.classList.add("pointer-sorting");
  }
  dragState.ghost.style.transform = `translate3d(${event.clientX - dragState.offsetX}px, ${event.clientY - dragState.offsetY}px, 0) rotate(.35deg)`;
  const selector = dragState.kind === "account" ? "[data-sort-account]" : "[data-sort-provider]";
  const dataKey = dragState.kind === "account" ? "sortAccount" : "sortProvider";
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(selector);
  clearDragTargets();
  dragState.target = null;
  if (target && target.dataset[dataKey] !== dragState.id) {
    const rect = target.getBoundingClientRect();
    dragState.target = target;
    dragState.insertAfter = dragState.kind === "provider"
      ? event.clientY > rect.top + rect.height / 2 || (Math.abs(event.clientY - (rect.top + rect.height / 2)) < rect.height / 3 && event.clientX > rect.left + rect.width / 2)
      : event.clientY > rect.top + rect.height / 2;
    target.classList.add("drag-over", dragState.insertAfter ? "drag-after" : "drag-before");
  }
  event.preventDefault();
});

document.addEventListener("pointerup", event => {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const {kind, id, moved, target, insertAfter} = dragState;
  const targetId = target?.dataset[kind === "account" ? "sortAccount" : "sortProvider"];
  clearPointerSort();
  if (moved) suppressClickUntil = Date.now() + 300;
  if (!moved || !targetId) return;
  if (kind === "account") moveAccount(id, targetId, insertAfter);
  else moveProvider(id, targetId, insertAfter);
});

document.addEventListener("pointercancel", clearPointerSort);

function startSyncPolling() {
  state.syncPollUsers += 1;
  if (state.syncPollTimer) return;
  state.syncPollTimer = setInterval(() => loadBackendState({quiet:true}), SYNC_POLL_INTERVAL_MS);
}

function stopSyncPolling() {
  state.syncPollUsers = Math.max(0, state.syncPollUsers - 1);
  if (state.syncPollUsers || !state.syncPollTimer) return;
  clearInterval(state.syncPollTimer);
  state.syncPollTimer = null;
}

document.addEventListener("click", async e => {
  if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); return; }
  const mimoEndpoint = e.target.closest("[data-mimo-base-url]");
  if (mimoEndpoint) {
    const targetId = mimoEndpoint.dataset.mimoTarget || "mimoBaseUrl";
    els[targetId].value = mimoEndpoint.dataset.mimoBaseUrl;
    syncMimoEndpointPresets(targetId);
  }
  const comboOption = e.target.closest(".combo-option[data-value]");
  const comboTrigger = e.target.closest("[data-combo-trigger]");
  if (comboOption && !comboOption.disabled) {
    const combo = comboOption.closest("[data-combobox]");
    setComboboxValue(combo.querySelector("input[type=hidden]"), comboOption.dataset.value);
    closeComboboxes();
  } else if (comboTrigger) {
    const combo = comboTrigger.closest("[data-combobox]");
    const willOpen = !combo.classList.contains("open");
    closeComboboxes(combo);
    combo.classList.toggle("open", willOpen);
    comboTrigger.setAttribute("aria-expanded", String(willOpen));
  } else if (!e.target.closest("[data-combobox]")) {
    closeComboboxes();
  }
  const nav = e.target.closest("[data-view]"); if (nav) switchView(nav.dataset.view);
  const target = e.target.closest("[data-target-view]"); if (target) switchView(target.dataset.targetView);
  const alertFilter = e.target.closest("[data-alert-filter]");
  if (alertFilter) { state.alertFilter = alertFilter.dataset.alertFilter; renderAlerts(); }
  const snoozeAlert = e.target.closest("[data-snooze-alert], [data-resume-alert]");
  if (snoozeAlert) {
    const resume = snoozeAlert.hasAttribute("data-resume-alert");
    const alertKey = snoozeAlert.getAttribute(resume ? "data-resume-alert" : "data-snooze-alert");
    snoozeAlert.disabled = true;
    try {
      await apiRequest("/api/alerts/snooze", { method:resume ? "DELETE" : "POST", body:JSON.stringify({alertKey}) });
      await loadBackendState({quiet:true});
      showToast(resume ? "已恢复此提醒的 Windows 通知" : "此提醒已暂缓 24 小时");
    } catch (error) { showToast(errorMessage(error), "error"); }
    finally { snoozeAlert.disabled = false; }
  }
  const syncHistoryFilter = e.target.closest("[data-sync-history-filter]");
  if (syncHistoryFilter) { state.syncEventFilter = syncHistoryFilter.dataset.syncHistoryFilter; renderSyncHistory(state.backend.accounts || []); }
  const accountNav = e.target.closest("[data-account]");
  if (accountNav) switchView("platforms", accountNav.dataset.accountProvider, accountNav.dataset.account);
  const viewAccount = e.target.closest("[data-view-account]");
  if (viewAccount) switchView("platforms", viewAccount.dataset.accountProvider, viewAccount.dataset.viewAccount);
  const provider = e.target.closest("[data-provider]"); if (provider) switchView("platforms", provider.dataset.provider);
  const openAccountDialog = e.target.closest("[data-open-account-dialog]"); if (openAccountDialog) els.accountDialog.showModal();
  const openSettings = e.target.closest("[data-open-settings]"); if (openSettings) switchView("settings");
  const product = e.target.closest("[data-product]"); if (product) { state.products[state.provider] = product.dataset.product; renderPlatform(); }
  const trendRange = e.target.closest("[data-trend-range]");
  if (trendRange) { state.metricRangeDays = Number(trendRange.dataset.trendRange); renderPlatform(); }
  const trendMetric = e.target.closest("[data-trend-metric]");
  if (trendMetric) {
    const account = getSelectedAccount(state.provider);
    if (account) state.metricSelections[`${account.id}|${state.products[state.provider]}`] = trendMetric.dataset.trendMetric;
    renderMetricTrend(account, state.products[state.provider]);
  }
  const row = e.target.closest("[data-row]"); if (row) showRowDialog(Number(row.dataset.row));
  const toggle = e.target.closest(".toggle"); if (toggle) toggle.classList.toggle("off");
  const diagnoseAccount = e.target.closest("[data-diagnose-account]");
  if (diagnoseAccount) {
    showAccountDiagnostics((state.backend.accounts || []).find(item => item.id === diagnoseAccount.dataset.diagnoseAccount));
  }
  const editConnection = e.target.closest("[data-edit-connection]");
  if (editConnection) {
    openConnectionDialog((state.backend.accounts || []).find(item => item.id === editConnection.dataset.editConnection));
  }
  const accountAlerts = e.target.closest("[data-account-alerts]");
  if (accountAlerts) {
    const account = (state.backend.accounts || []).find(item => item.id === accountAlerts.dataset.accountAlerts);
    openAccountAlertsDialog(account);
  }
  const renameAccount = e.target.closest("[data-rename-account]");
  if (renameAccount) {
    const account = (state.backend.accounts || []).find(item => item.id === renameAccount.dataset.renameAccount);
    state.renameAccountId = account?.id || null;
    els.renameAccountName.value = account?.name || "";
    els.renameAccountDialog.showModal();
    setTimeout(() => { els.renameAccountName.focus(); els.renameAccountName.select(); }, 30);
  }
  const toggleAccount = e.target.closest("[data-toggle-account]");
  if (toggleAccount) {
    const account = (state.backend.accounts || []).find(item => item.id === toggleAccount.dataset.toggleAccount);
    const nextEnabled = account?.enabled === false;
    try {
      await apiRequest(`/api/accounts/${toggleAccount.dataset.toggleAccount}`, { method:"PATCH", body:JSON.stringify({enabled:nextEnabled}) });
      await loadBackendState({quiet:true});
      showToast(nextEnabled ? "账户监控已恢复" : "账户监控已暂停；已有数据会保留");
    } catch (error) { showToast(errorMessage(error)); }
  }
  const syncAccount = e.target.closest("[data-sync-account]");
  if (syncAccount) {
    syncAccount.disabled = true;
    const label = syncAccount.querySelector("span");
    if (label) label.textContent = "同步中…";
    startSyncPolling();
    try {
      await apiRequest(`/api/accounts/${syncAccount.dataset.syncAccount}/sync`, { method:"POST" });
      await loadBackendState({quiet:true});
      const synced = state.backend.accounts.find(account => account.id === syncAccount.dataset.syncAccount);
      showToast(synced?.enabled === false ? "远端数据已同步；账户监控仍处于暂停状态" : synced?.provider === "volcengine" ? "火山方舟用量已同步" : synced?.provider === "openai" ? "Codex 远端用量已同步" : synced?.provider === "mimo" ? "MiMo 官方模型列表已同步" : "DeepSeek 余额已同步");
    } catch (error) { await loadBackendState({quiet:true}); showToast(errorMessage(error)); }
    finally { stopSyncPolling(); syncAccount.disabled = false; if (label) label.textContent = "立即同步"; }
  }
  const deleteAccount = e.target.closest("[data-delete-account]");
  if (deleteAccount) {
    const account = (state.backend.accounts || []).find(item => item.id === deleteAccount.dataset.deleteAccount);
    if (!account) return;
    state.deleteAccountId = account.id;
    els.deleteAccountDialogTitle.textContent = `移除“${account.name}”？`;
    els.deleteAccountDialogSummary.textContent = "移除后，本机保存的连接凭据和该账户的历史记录会一并删除；平台侧账户与远端数据不会受到影响。";
    els.deleteAccountDialog.showModal();
  }
});

document.addEventListener("keydown", event => { if (event.key === "Escape") closeComboboxes(); });
document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click",()=>switchView(b.dataset.view)));
els.modelFamilySelect.addEventListener("change", renderComparisons);
els.modelLevelSelect.addEventListener("change", renderComparisons);
els.modelSearchInput.addEventListener("input", renderComparisons);
els.accountProvider.addEventListener("change", updateCredentialFields);
els.appearanceMode.addEventListener("change", () => { applyTheme(els.appearanceMode.value); queueSettingsSave(); });
els.autoSyncMinutes.addEventListener("change", () => queueSettingsSave());
els.staleAfterMinutes.addEventListener("change", () => queueSettingsSave());
els.updateCheckMode.addEventListener("change", () => queueSettingsSave());
els.historyRetentionDays.addEventListener("change", () => queueSettingsSave());
els.mimoBaseUrl.addEventListener("input", syncMimoEndpointPresets);
els.mimoApiKey.addEventListener("input", () => {
  const key = els.mimoApiKey.value.trim();
  const current = els.mimoBaseUrl.value.trim();
  if (key.startsWith("tp-") && current === APP_DEFAULTS.mimoPaygUrl) {
    els.mimoBaseUrl.value = APP_DEFAULTS.mimoTokenPlanUrl;
  } else if (key.startsWith("sk-") && current.includes("token-plan-")) {
    els.mimoBaseUrl.value = APP_DEFAULTS.mimoPaygUrl;
  }
  syncMimoEndpointPresets();
});
els.editMimoBaseUrl.addEventListener("input", () => syncMimoEndpointPresets("editMimoBaseUrl"));
els.editMimoApiKey.addEventListener("input", () => {
  const key = els.editMimoApiKey.value.trim();
  const current = els.editMimoBaseUrl.value.trim();
  if (key.startsWith("tp-") && current === APP_DEFAULTS.mimoPaygUrl) {
    els.editMimoBaseUrl.value = APP_DEFAULTS.mimoTokenPlanUrl;
  } else if (key.startsWith("sk-") && current.includes("token-plan-")) {
    els.editMimoBaseUrl.value = APP_DEFAULTS.mimoPaygUrl;
  }
  syncMimoEndpointPresets("editMimoBaseUrl");
});
els.refreshButton.addEventListener("click", async () => {
  els.refreshButton.classList.add("spinning");
  els.refreshButton.disabled = true;
  els.refreshButton.setAttribute("aria-busy", "true");
  els.refreshButton.title = "正在从远端同步…";
  els.syncText.textContent = "正在同步…";
  startSyncPolling();
  try {
    const result = await apiRequest("/api/sync", { method:"POST" }, true);
    await loadBackendState({quiet:true});
    const results = result.results || [];
    const succeeded = results.filter(item => item.ok).length;
    const failed = results.length - succeeded;
    els.syncText.textContent = failed ? `${succeeded} 成功 · ${failed} 失败` : succeeded ? `${succeeded} 个账户已同步` : "尚未添加账户";
    showToast(failed ? `同步完成：${succeeded} 个成功，${failed} 个失败` : succeeded ? `已从远端更新 ${succeeded} 个账户` : "尚未添加真实账户", failed ? "warning" : succeeded ? "success" : "info");
  } catch (error) { els.syncText.textContent = "同步失败"; showToast(errorMessage(error)); }
  finally {
    stopSyncPolling();
    els.refreshButton.classList.remove("spinning");
    els.refreshButton.disabled = false;
    els.refreshButton.removeAttribute("aria-busy");
    els.refreshButton.title = "从远端刷新数据";
  }
});
els.accountForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = els.connectAccountButton;
  const provider = els.accountProvider.value;
  button.disabled = true;
  button.classList.add("loading");
  button.querySelector("span").textContent = provider === "volcengine" ? "正在发现产品…" : provider === "openai" ? "正在读取 Codex…" : "正在验证…";
  try {
    const body = provider === "volcengine"
      ? { provider, name:els.accountName.value, accessKey:els.volcAccessKey.value, secretKey:els.volcSecretKey.value, region:els.volcRegion.value, projectName:els.volcProject.value }
      : provider === "openai"
        ? { provider, name:els.accountName.value }
        : provider === "mimo"
          ? { provider, name:els.accountName.value, apiKey:els.mimoApiKey.value, baseUrl:els.mimoBaseUrl.value }
          : { provider, name:els.accountName.value, apiKey:els.accountKey.value };
    const result = await apiRequest("/api/accounts", { method:"POST", body:JSON.stringify(body) });
    state.accountId = result.account.id;
    state.provider = result.account.provider;
    els.accountForm.reset();
    setComboboxValue(els.accountProvider, "deepseek", false);
    els.volcRegion.value = APP_DEFAULTS.volcengineRegion;
    els.volcProject.value = APP_DEFAULTS.volcengineProject;
    els.mimoBaseUrl.value = APP_DEFAULTS.mimoPaygUrl;
    updateCredentialFields();
    await loadBackendState({quiet:true});
    els.accountDialog.close();
    showToast(provider === "volcengine" ? `火山方舟已连接 · 发现 ${result.account.products?.length || 0} 个产品` : provider === "openai" ? `OpenAI 已连接 · ChatGPT 与 Codex 已分开` : provider === "mimo" ? "Xiaomi MiMo 已连接 · 官方模型列表已同步" : "DeepSeek 账户连接成功");
  } catch (error) { showToast(errorMessage(error)); }
  finally {
    button.disabled = false;
    button.classList.remove("loading");
    button.querySelector("span").textContent = "连接并验证";
  }
});
els.syncAccountsButton.addEventListener("click", () => els.refreshButton.click());
els.retryFailedButton.addEventListener("click", async () => {
  const failed = (state.backend.accounts || []).filter(account => account.enabled !== false && account.lastError);
  if (!failed.length) { showToast("当前没有需要重试的账户"); return; }
  els.retryFailedButton.disabled = true;
  els.retryFailedButton.textContent = `正在重试 0/${failed.length}`;
  startSyncPolling();
  let succeeded = 0;
  for (let index = 0; index < failed.length; index++) {
    els.retryFailedButton.textContent = `正在重试 ${index + 1}/${failed.length}`;
    try { await apiRequest(`/api/accounts/${failed[index].id}/sync`, { method:"POST" }); succeeded++; } catch (_) {}
  }
  await loadBackendState({quiet:true});
  stopSyncPolling();
  els.retryFailedButton.textContent = "重试失败账户";
  renderAccounts();
  showToast(succeeded === failed.length ? `已恢复 ${succeeded} 个账户` : `重试完成：${succeeded} 成功，${failed.length - succeeded} 仍失败`);
});
els.exportProductButton.addEventListener("click", exportCurrentProduct);
els.dialogClose.addEventListener("click",()=>els.metricDialog.close());
els.diagnosticDialogClose.addEventListener("click",()=>els.diagnosticDialog.close());
els.diagnosticDialogDone.addEventListener("click",()=>els.diagnosticDialog.close());
els.copyDiagnosticButton.addEventListener("click", async () => {
  const account = (state.backend.accounts || []).find(item => item.id === state.diagnosticAccountId);
  if (!account) return;
  const text = JSON.stringify(diagnosticPayload(account), null, 2);
  try { await navigator.clipboard.writeText(text); showToast("脱敏诊断信息已复制"); }
  catch (_) { downloadText(`Prismeter-diagnostic-${safeFilePart(account.name)}.json`, text, "application/json;charset=utf-8"); showToast("诊断信息已导出为 JSON"); }
});
els.addAccountButton.addEventListener("click",()=>{ updateCredentialFields(); els.accountDialog.showModal(); });
els.accountDialogClose.addEventListener("click",()=>els.accountDialog.close());
els.accountAlertsDialogClose.addEventListener("click",()=>els.accountAlertsDialog.close());
els.accountAlertsCancel.addEventListener("click",()=>els.accountAlertsDialog.close());
els.accountAlertsEnabled.addEventListener("change",updateAccountAlertFieldState);
els.deleteAccountDialogClose.addEventListener("click",()=>els.deleteAccountDialog.close());
els.deleteAccountCancel.addEventListener("click",()=>els.deleteAccountDialog.close());
els.renameAccountDialogClose.addEventListener("click",()=>els.renameAccountDialog.close());
els.renameAccountCancel.addEventListener("click",()=>els.renameAccountDialog.close());
els.connectionDialogClose.addEventListener("click",()=>els.connectionDialog.close());
els.connectionDialogCancel.addEventListener("click",()=>els.connectionDialog.close());
els.connectionForm.addEventListener("submit", async event => {
  event.preventDefault();
  const account = (state.backend.accounts || []).find(item => item.id === state.connectionAccountId);
  if (!account) return;
  const button = els.connectionSave;
  button.disabled = true;
  button.querySelector("span").textContent = "正在验证…";
  const body = account.provider === "volcengine"
    ? { accessKey:els.editVolcAccessKey.value, secretKey:els.editVolcSecretKey.value, region:els.editVolcRegion.value, projectName:els.editVolcProject.value }
    : account.provider === "mimo"
      ? { apiKey:els.editMimoApiKey.value, baseUrl:els.editMimoBaseUrl.value }
      : { apiKey:els.editAccountKey.value };
  startSyncPolling();
  try {
    await apiRequest(`/api/accounts/${account.id}/connection`, { method:"PUT", body:JSON.stringify(body) });
    await loadBackendState({quiet:true});
    els.connectionDialog.close();
    showToast(`${providers[account.provider]?.name || account.provider} 连接设置已更新`);
  } catch (error) { showToast(errorMessage(error)); }
  finally { stopSyncPolling(); button.disabled = false; button.querySelector("span").textContent = "验证并保存"; }
});
els.renameAccountForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!state.renameAccountId) return;
  const button = els.renameAccountSave;
  button.disabled = true;
  button.querySelector("span").textContent = "保存中…";
  try {
    await apiRequest(`/api/accounts/${state.renameAccountId}`, { method:"PATCH", body:JSON.stringify({name:els.renameAccountName.value}) });
    await loadBackendState({quiet:true});
    els.renameAccountDialog.close();
    showToast("账户名称已更新");
  } catch (error) { showToast(errorMessage(error)); }
  finally { button.disabled = false; button.querySelector("span").textContent = "保存名称"; }
});
els.accountAlertsForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!state.alertAccountId) return;
  const button = els.accountAlertsSave;
  const optionalNumber = input => input.value.trim() === "" ? null : Number(input.value);
  if (!els.accountLowBalanceThreshold.checkValidity() || !els.accountUsageThreshold.checkValidity()) {
    showToast("请检查账户提醒阈值", "error");
    return;
  }
  button.disabled = true;
  button.querySelector("span").textContent = "正在应用…";
  try {
    await apiRequest(`/api/accounts/${state.alertAccountId}/alerts`, {
      method:"PUT",
      body:JSON.stringify({
        enabled:els.accountAlertsEnabled.checked,
        lowBalanceThreshold:optionalNumber(els.accountLowBalanceThreshold),
        usageThreshold:optionalNumber(els.accountUsageThreshold),
        staleAfterMinutes:els.accountStaleAfterMinutes.value === "" ? null : Number(els.accountStaleAfterMinutes.value)
      })
    });
    await loadBackendState({quiet:true});
    els.accountAlertsDialog.close();
    showToast("账户提醒规则已更新");
  } catch (error) { showToast(errorMessage(error, "无法更新账户提醒规则"), "error"); }
  finally { button.disabled = false; button.querySelector("span").textContent = "应用规则"; }
});
els.deleteAccountConfirm.addEventListener("click", async () => {
  const accountId = state.deleteAccountId;
  if (!accountId) { els.deleteAccountDialog.close(); return; }
  const button = els.deleteAccountConfirm;
  button.disabled = true;
  button.querySelector("span").textContent = "正在移除…";
  try {
    await apiRequest(`/api/accounts/${accountId}`, { method:"DELETE" });
    state.metricHistoryCache.clear();
    state.deleteAccountId = null;
    await loadBackendState({quiet:true});
    els.deleteAccountDialog.close();
    showToast("账户及其本地数据已移除");
  } catch (error) {
    showToast(errorMessage(error, "无法移除账户"), "error");
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = "确认移除";
  }
});
els.testNotificationButton.addEventListener("click", async () => {
  const button = els.testNotificationButton;
  button.disabled = true;
  button.textContent = "正在发送…";
  try {
    await apiRequest("/api/notifications/test", { method:"POST" });
    showToast("测试通知已发送到 Windows 通知中心");
  } catch (error) { showToast(errorMessage(error)); }
  finally { button.disabled = false; button.textContent = "发送测试通知"; }
});
els.checkUpdateButton.addEventListener("click", () => checkForUpdates({manual:true}));
els.updateDialogClose.addEventListener("click", () => els.updateDialog.close());
els.laterUpdateButton.addEventListener("click", () => els.updateDialog.close());
els.skipUpdateButton.addEventListener("click", () => {
  if (!state.availableUpdate || !state.backend.settings) return;
  state.backend.settings.skippedUpdateVersion = state.availableUpdate.version;
  queueSettingsSave();
  els.updateDialog.close();
  setUpdateStatus(`${state.availableUpdate.version} 已跳过`);
  showToast(`已跳过 ${state.availableUpdate.version}，仍可手动检查`, "info");
});
els.installUpdateButton.addEventListener("click", () => {
  if (state.availableUpdate) installAvailableUpdate();
  else checkForUpdates({manual:true});
});
els.clearHistoryButton.addEventListener("click", () => {
  const storage = state.backend.historyStorage || {};
  const balanceSnapshots = Number(storage.balanceSnapshots || 0);
  const metricSnapshots = Number(storage.metricSnapshots || 0);
  const syncEvents = Number(storage.syncEvents || 0);
  els.clearHistoryDialogSummary.textContent = `将删除本机保存的 ${metricSnapshots} 条远端指标快照、${balanceSnapshots} 条余额兼容快照和 ${syncEvents} 条同步记录。已连接账户、凭据、设置和当前远端数据不会受到影响。`;
  els.clearHistoryDialog.showModal();
});
els.clearHistoryDialogClose.addEventListener("click", () => els.clearHistoryDialog.close());
els.clearHistoryCancel.addEventListener("click", () => els.clearHistoryDialog.close());
els.clearHistoryConfirm.addEventListener("click", async () => {
  const button = els.clearHistoryConfirm;
  button.disabled = true;
  button.querySelector("span").textContent = "正在清除…";
  try {
    const result = await apiRequest("/api/history", { method:"DELETE" });
    const removed = Number(result.removed?.balanceSnapshots || 0) + Number(result.removed?.metricSnapshots || 0) + Number(result.removed?.syncEvents || 0);
    state.metricHistoryCache.clear();
    await loadBackendState({quiet:true});
    els.clearHistoryDialog.close();
    showToast(removed ? `已清除 ${removed} 条本地历史记录` : "当前没有可清除的历史记录", removed ? "success" : "info");
  } catch (error) {
    showToast(errorMessage(error, "无法清除历史记录"), "error");
  } finally {
    button.disabled = false;
    button.querySelector("span").textContent = "确认清除";
  }
});
els.exitAppButton.addEventListener("click", async () => {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) { showToast("仅桌面应用支持退出操作", "info"); return; }
  els.exitAppButton.disabled = true;
  els.exitAppButton.textContent = "正在退出…";
  try { await invoke("exit_app"); }
  catch (error) {
    els.exitAppButton.disabled = false;
    els.exitAppButton.textContent = "退出 Prismeter";
    showToast(errorMessage(error, "无法退出应用"), "error");
  }
});

let settingsSaveTimer = null;
let settingsSaveRunning = false;
let settingsSaveQueued = false;

function settingsPayload() {
  return {
    autoSyncMinutes:Number(els.autoSyncMinutes.value),
    lowBalanceThreshold:Number(els.lowBalanceThreshold.value),
    usageThreshold:Number(els.usageThreshold.value),
    notificationsEnabled:els.notificationsEnabled.checked,
    appearanceMode:els.appearanceMode.value,
    syncOnStartup:els.syncOnStartup.checked,
    closeToTray:els.closeToTray.checked,
    launchAtStartup:els.launchAtStartup.checked,
    updateCheckMode:els.updateCheckMode.value,
    skippedUpdateVersion:state.backend.settings?.skippedUpdateVersion || "",
    historyRetentionDays:Number(els.historyRetentionDays.value),
    staleAfterMinutes:Number(els.staleAfterMinutes.value)
  };
}

function setSettingsSaveStatus(text, tone = "idle") {
  els.settingsSaveStatus.className = `settings-save-status ${tone}`;
  els.settingsSaveStatus.lastChild.textContent = text;
}

function queueSettingsSave(delay = 0) {
  if (!state.backend.settings) return;
  clearTimeout(settingsSaveTimer);
  setSettingsSaveStatus("等待保存…", "pending");
  settingsSaveTimer = setTimeout(() => {
    settingsSaveQueued = true;
    flushSettingsSave();
  }, delay);
}

async function flushSettingsSave() {
  if (settingsSaveRunning || !settingsSaveQueued) return;
  settingsSaveQueued = false;
  settingsSaveRunning = true;
  setSettingsSaveStatus("正在保存…", "saving");
  const previousSettings = state.backend.settings;
  const nextSettings = settingsPayload();
  const retentionChanged = previousSettings?.historyRetentionDays !== nextSettings.historyRetentionDays;
  const strictDesktopKeys = ["closeToTray", "launchAtStartup"].filter(key => previousSettings?.[key] !== nextSettings[key]);
  try {
    await syncDesktopPreferences(nextSettings, strictDesktopKeys);
    const result = await apiRequest("/api/settings", { method:"PUT", body:JSON.stringify(nextSettings) });
    state.backend.settings = result.settings;
    applyTheme(result.settings.appearanceMode || "system");
    els.syncText.textContent = formatSyncSetting();
    if (retentionChanged) await loadBackendState({quiet:true});
    setSettingsSaveStatus("已自动保存", "saved");
  } catch (error) {
    strictDesktopKeys.forEach(key => { state.desktopPreferences[key] = null; });
    await syncDesktopPreferences(previousSettings);
    populateSettings();
    applyTheme(state.backend.settings?.appearanceMode || "system");
    setSettingsSaveStatus("保存失败", "error");
    showToast(errorMessage(error), "error");
  } finally {
    settingsSaveRunning = false;
    if (settingsSaveQueued) flushSettingsSave();
  }
}

[els.notificationsEnabled, els.syncOnStartup, els.closeToTray, els.launchAtStartup].forEach(input => input.addEventListener("change", () => queueSettingsSave()));
[els.lowBalanceThreshold, els.usageThreshold].forEach(input => {
  input.addEventListener("input", () => { if (input.checkValidity() && input.value !== "") queueSettingsSave(450); });
  input.addEventListener("change", () => { if (input.checkValidity() && input.value !== "") queueSettingsSave(); });
});

initializeRemoteOnlyProviders(); applyDeepSeekAccountData(null); applyOpenAIAccountData(null); applyVolcengineAccountData(null); updateCredentialFields(); renderNavigation(); renderOverview(); renderAlerts(); renderComparisons(); renderAccounts(); switchView("overview");
loadBackendState();
setInterval(() => { if (!state.backend.accounts?.length) return; renderOverview(); renderAccounts(); renderAlerts(); if (state.view === "platforms") renderPlatform(); }, RELATIVE_TIME_REFRESH_MS);
setInterval(() => { if (state.backend.accounts?.length) loadBackendState({quiet:true}); }, BACKGROUND_STATE_REFRESH_MS);


















document.addEventListener("DOMContentLoaded",()=>{
  const api=window.__TAURI__?.window;
  const current=api?.getCurrentWindow?.();
  if(!current) return;
  const maximizeButton=document.getElementById("windowMaximize");
  let resizeStateTimer;
  const updateMaximizeState=async()=>{
    try {
      const maximized=await current.isMaximized();
      document.documentElement.classList.toggle("window-maximized",maximized);
      if(maximizeButton){
        const label=maximized?"还原":"最大化";
        maximizeButton.setAttribute("aria-label",label);
        maximizeButton.title=label;
      }
    } catch(error) { console.error("读取窗口状态失败",error); }
  };
  const runWindowAction=action=>async event=>{
    event.preventDefault();
    event.stopPropagation();
    try {
      await current[action]();
      if(action==="toggleMaximize") await updateMaximizeState();
    }
    catch(error) {
      console.error(`窗口操作 ${action} 失败`,error);
      showToast(errorMessage(error, "窗口操作未完成"), "error");
    }
  };
  document.getElementById("windowMinimize")?.addEventListener("click",runWindowAction("minimize"));
  maximizeButton?.addEventListener("click",runWindowAction("toggleMaximize"));
  document.getElementById("windowClose")?.addEventListener("click",runWindowAction("close"));
  document.querySelector(".window-chrome")?.addEventListener("dblclick",event=>{
    if(!event.target.closest(".window-controls")) runWindowAction("toggleMaximize")(event);
  });
  document.querySelectorAll("[data-resize-direction]").forEach(handle=>{
    handle.addEventListener("pointerdown",async event=>{
      if(event.button!==0 || document.documentElement.classList.contains("window-maximized")) return;
      event.preventDefault();
      try { await current.startResizeDragging(handle.dataset.resizeDirection); }
      catch(error) { console.error("窗口缩放失败",error); }
    });
  });
  window.addEventListener("resize",()=>{
    clearTimeout(resizeStateTimer);
    resizeStateTimer=setTimeout(updateMaximizeState,80);
  });
  updateMaximizeState();
});
