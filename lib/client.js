window.__ModuleLoader__.load({
	id: "dsh-antigravity-oauth",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/Settings.tsx
		const STATUS_PATH = "/plugins/dsh-antigravity-oauth/auth/status";
		const LOGIN_PATH = "/plugins/dsh-antigravity-oauth/auth/login";
		const COMPLETE_PATH = "/plugins/dsh-antigravity-oauth/auth/complete";
		const SWITCH_PATH = "/plugins/dsh-antigravity-oauth/auth/accounts/switch";
		const REMOVE_PATH = "/plugins/dsh-antigravity-oauth/auth/accounts/remove";
		const QUOTAS_PATH = "/plugins/dsh-antigravity-oauth/auth/accounts/quotas";
		const ADVANCED_PATH = "/plugins/dsh-antigravity-oauth/advanced";
		const NETWORK_PATH = "/plugins/dsh-antigravity-oauth/network";
		const WEB2API_SETTINGS_PATH = "/plugins/dsh-antigravity-oauth/web2api/settings";
		const WEB2API_TEST_PATH = "/plugins/dsh-antigravity-oauth/web2api/test";
		const STYLE_ID = "dsh-antigravity-oauth-settings-theme";
		const DOCKER_CMD = "docker run -d --name gemini-web2api -p 18088:18088 zexadev/gemini-web2api-go:latest";
		const DISMISSED_BANNER_KEY = "dsh-antigravity-oauth.dismissed-banner";
		const DISMISSED_WEB2API_GUIDE_KEY = "dsh-antigravity-oauth.dismissed-web2api-guide";
		const SETTINGS_CSS = `
.dsh-agy-page { display:flex; flex-direction:column; gap:12px; width:100%; max-width:720px; color:var(--dsw-alias-label-primary, #e0e0e0); font-family:inherit; position:relative; }

/* Top Header */
.dsh-agy-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
.dsh-agy-title-row { display:flex; align-items:center; gap:10px; }
.dsh-agy-title { margin:0; font-size:18px; line-height:24px; font-weight:600; color:var(--dsw-alias-label-primary, #ffffff); }
.dsh-agy-header-active-badge {
  display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:12px;
  font-size:12px; font-weight:500; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
  color:#f0f0f0; max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.dsh-agy-body { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-secondary, #9aa0a6); }
.dsh-agy-error { margin:0; font-size:12px; line-height:18px; color:#f25a5a; padding:6px 12px; border-radius:6px; background:rgba(242,90,90,0.12); border:1px solid rgba(242,90,90,0.25); }

/* Floating Top-Right Toast Notification (Zero Layout Shift) */
.dsh-agy-toast-float {
  position:fixed; top:24px; right:24px; z-index:9999;
  display:flex; align-items:center; gap:8px;
  padding:10px 16px; border-radius:8px;
  background:#1a231e; border:1px solid #41c977;
  color:#41c977; font-size:13px; font-weight:500;
  box-shadow:0 8px 24px rgba(0,0,0,0.45);
  animation:dsh-agy-fadein 0.2s ease-out;
}
@keyframes dsh-agy-fadein { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }

/* One-time dismissible notice banner */
.dsh-agy-notice-banner {
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:8px 12px; border-radius:8px;
  background:var(--dsw-alias-bg-module-platform, rgba(128,128,128,0.08));
  border:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.2));
}
.dsh-agy-notice-close {
  background:none; border:none; color:var(--dsw-alias-label-secondary, #9aa0a6); cursor:pointer;
  font-size:16px; line-height:1; padding:2px 6px; border-radius:4px;
}
.dsh-agy-notice-close:hover { color:#ffffff; background:rgba(255,255,255,0.08); }

/* Navigation Tabs */
.dsh-agy-tabs {
  display:grid; grid-template-columns:repeat(4, 1fr); gap:3px; padding:2px;
  background:#1a1c1e !important;
  border:1px solid rgba(255,255,255,0.12) !important;
  border-radius:9px; width:100%; max-width:100%; box-sizing:border-box; margin-bottom:2px;
}
.dsh-agy-tab-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:4px; padding:6px 2px;
  border:none !important; border-radius:7px !important;
  background:transparent !important;
  color:#9a9ea5 !important; font:inherit; font-size:12px; font-weight:500;
  cursor:pointer; transition:all 0.15s ease; user-select:none;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;
}
.dsh-agy-tab-btn:hover { color:#ffffff !important; background:rgba(255,255,255,0.06) !important; }
.dsh-agy-tab-btn.is-active {
  color:#ffffff !important; background:#1677ff !important;
  box-shadow:0 1px 4px rgba(22, 119, 255, 0.4) !important; font-weight:600 !important;
}

/* Cards */
.dsh-agy-card {
  display:flex; flex-direction:column; gap:10px; padding:12px 14px;
  border:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.2));
  border-radius:10px; background:var(--dsw-alias-bg-module-platform, rgba(128,128,128,0.04));
  box-sizing:border-box; width:100%;
}
.dsh-agy-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; }
.dsh-agy-card-title { margin:0; font-size:14px; font-weight:600; color:var(--dsw-alias-label-primary, #ffffff); display:flex; align-items:center; gap:8px; }

/* Status Badges */
.dsh-agy-status-badge {
  display:inline-flex; align-items:center; justify-content:center; gap:4px;
  padding:2px 8px; border-radius:6px; min-width:54px;
  font-size:11px; font-weight:500; background:rgba(128,128,128,0.1); color:var(--dsw-alias-label-secondary, #9aa0a6);
}
.dsh-agy-status-badge.is-success { background:rgba(34,160,107,0.2); color:#41c977; font-weight:600; }
.dsh-agy-status-badge.is-error { background:rgba(217,45,32,0.2); color:#f25a5a; }
.dsh-agy-status-badge.is-switching { background:rgba(250,140,22,0.2); color:#fa8c16; font-weight:600; }
.dsh-agy-dot { width:8px; height:8px; border-radius:50%; flex:0 0 auto; background:#6b7280; }
.dsh-agy-dot.is-signed-in, .dsh-agy-dot.is-active { background:#41c977; }
.dsh-agy-dot.is-error { background:#f25a5a; }
.dsh-agy-dot.is-signing-in { background:#1677ff; }

/* Buttons */
.dsh-agy-btn {
  box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center;
  min-height:28px; padding:3px 12px; border-radius:6px; font:inherit; font-size:12px; line-height:18px;
  cursor:pointer; transition:all 0.15s ease; text-decoration:none;
}
.dsh-agy-btn:disabled { opacity:0.45; cursor:not-allowed; }
.dsh-agy-btn-primary {
  background:#1677ff !important; color:#ffffff !important;
  border:1px solid #1677ff !important; box-shadow:0 1px 2px rgba(0,0,0,0.15); font-weight:500;
}
.dsh-agy-btn-primary:hover:not(:disabled) { background:#0958d9 !important; border-color:#0958d9 !important; }
.dsh-agy-btn-secondary {
  border:1px solid rgba(255,255,255,0.15) !important;
  background:#2b2d30 !important; color:#f0f0f0 !important;
}
.dsh-agy-btn-secondary:hover:not(:disabled) {
  background:#3c3f41 !important; border-color:#1677ff !important; color:#ffffff !important;
}
.dsh-agy-btn-compact { min-height:22px; padding:1px 8px; font-size:11px; border-radius:4px; min-width:54px; }

/* Inputs */
.dsh-agy-input {
  box-sizing:border-box; width:100%; min-height:30px; padding:4px 8px; border-radius:6px;
  border:1px solid rgba(255,255,255,0.15);
  background:var(--dsw-alias-bg-page-primary, #1e1e1e); color:#f0f0f0;
  font:inherit; font-size:12px; outline:none; transition:border-color 0.15s ease;
}
.dsh-agy-input:focus { border-color:#1677ff; }
.dsh-agy-select {
  box-sizing:border-box; min-height:26px; padding:2px 6px; border-radius:6px;
  border:1px solid rgba(255,255,255,0.15);
  background:var(--dsw-alias-bg-page-primary, #1e1e1e); color:#f0f0f0;
  font:inherit; font-size:11px; cursor:pointer; outline:none;
}

/* Filter Chips */
.dsh-agy-chips { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.dsh-agy-chip {
  padding:2px 8px; border-radius:10px; font-size:11px; cursor:pointer;
  border:1px solid rgba(255,255,255,0.12);
  background:rgba(255,255,255,0.05); color:#9a9ea5;
  transition:all 0.15s ease;
}
.dsh-agy-chip:hover { border-color:#1677ff; color:#ffffff; }
.dsh-agy-chip.is-active {
  border-color:#1677ff; background:rgba(22, 119, 255, 0.18); color:#1677ff; font-weight:600;
}

/* Accounts List & Items */
.dsh-agy-account-list {
  max-height:480px; overflow-y:scroll; padding-right:4px; display:flex; flex-direction:column; gap:5px;
  box-sizing:border-box; width:100%;
}
.dsh-agy-account-list.is-compact-mode {
  gap:3px;
}
.dsh-agy-account {
  display:flex !important; flex-direction:column !important; align-items:stretch !important; gap:7px !important;
  padding:9px 12px !important; border-radius:10px !important;
  border:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.2)) !important;
  background:var(--dsw-alias-bg-module-platform, rgba(128,128,128,0.03)) !important;
  box-sizing:border-box !important; width:100% !important; cursor:pointer !important;
  transition:background 0.15s ease, border-color 0.15s ease !important;
}
.dsh-agy-account:hover {
  background:rgba(255,255,255,0.05) !important; border-color:rgba(255,255,255,0.2) !important;
}
.dsh-agy-account.is-active {
  border-color:#1677ff !important; background:rgba(22, 119, 255, 0.08) !important;
}
.dsh-agy-account.is-compact {
  padding:5px 10px !important; gap:4px !important;
}

.dsh-agy-account-header {
  display:flex !important; align-items:center !important; justify-content:space-between !important;
  gap:10px !important; width:100% !important; box-sizing:border-box !important;
}
.dsh-agy-account-info {
  display:flex !important; align-items:center !important; gap:8px !important;
  flex:1 1 auto !important; min-width:0 !important; overflow:hidden !important;
}
.dsh-agy-account-mail {
  font-size:13px !important; font-weight:600 !important; color:#ffffff !important;
  overflow:hidden !important; text-overflow:ellipsis !important; white-space:nowrap !important;
}
.dsh-agy-account.is-compact .dsh-agy-account-mail {
  font-size:12px !important;
}
.dsh-agy-link { color:#1677ff; text-decoration:none; }
.dsh-agy-link:hover { text-decoration:underline; }

.dsh-agy-account-metrics {
  display:flex !important; align-items:center !important; gap:8px !important;
  width:100% !important; box-sizing:border-box !important;
}

/* Quota Capsule Bars */
.dsh-agy-capsule-bar {
  flex:1 1 0 !important; min-width:0 !important; box-sizing:border-box !important;
  display:inline-flex !important; flex-direction:column !important; justify-content:center !important;
  gap:2px !important; font-size:11px !important; padding:4px 8px !important; border-radius:6px !important;
  background:rgba(128,128,128,0.08) !important; border:1px solid rgba(255,255,255,0.06) !important;
  color:#9aa0a6 !important; cursor:help !important; user-select:none !important;
}
.dsh-agy-capsule-main {
  display:flex !important; align-items:center !important; justify-content:space-between !important;
  width:100% !important; gap:6px !important;
}
.dsh-agy-capsule-progress {
  flex:1 1 30px !important; max-width:85px !important; min-width:25px !important;
  height:6px !important; border-radius:3px !important; background:rgba(128,128,128,0.25) !important; overflow:hidden !important;
}
.dsh-agy-capsule-reset {
  font-size:10px !important; line-height:12px !important; color:#8c9199 !important; white-space:nowrap !important; font-weight:500 !important;
}
.dsh-agy-account.is-compact .dsh-agy-capsule-bar {
  flex-direction:row !important; align-items:center !important; justify-content:space-between !important;
  padding:2px 8px !important; height:22px !important;
}
.dsh-agy-account.is-compact .dsh-agy-capsule-reset {
  display:none !important;
}
.dsh-agy-capsule-fill { height:100%; border-radius:3px; transition:width 0.3s ease; }
.dsh-agy-capsule-fill.is-high { background:#41c977; }
.dsh-agy-capsule-fill.is-med { background:#fa8c16; }
.dsh-agy-capsule-fill.is-low { background:#f25a5a; }

/* Rightmost Action Cell: Aligns Active badge and Remove button */
.dsh-agy-account-action {
  width:64px; display:flex; align-items:center; justify-content:flex-end; flex-shrink:0;
}
.dsh-agy-action-pill {
  box-sizing:border-box !important; width:58px !important; height:22px !important;
  min-height:22px !important; max-height:22px !important; padding:0 !important;
  font-size:11px !important; font-weight:500 !important; line-height:20px !important;
  border-radius:5px !important; display:inline-flex !important; align-items:center !important;
  justify-content:center !important; text-align:center !important; user-select:none;
}
.dsh-agy-action-pill.is-active-badge {
  background:rgba(34,160,107,0.2) !important; color:#41c977 !important;
  border:1px solid rgba(34,160,107,0.4) !important; font-weight:600 !important;
}
.dsh-agy-action-pill.is-remove-btn {
  border:1px solid rgba(255,255,255,0.15) !important; background:#2b2d30 !important;
  color:#f0f0f0 !important; cursor:pointer !important;
}
.dsh-agy-action-pill.is-remove-btn:hover:not(:disabled) {
  background:#3c3f41 !important; border-color:#1677ff !important; color:#ffffff !important;
}

/* Quick Setup Card (Plan C) */
.dsh-agy-guide-card {
  display:flex; flex-direction:column; gap:12px; padding:16px 18px;
  border-radius:12px;
  background:linear-gradient(145deg, #1e222b 0%, #171920 100%);
  border:1px solid rgba(22, 119, 255, 0.25);
  box-shadow:0 4px 12px rgba(0,0,0,0.2);
}
.dsh-agy-guide-header {
  display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;
}
.dsh-agy-step {
  display:flex; gap:12px; align-items:flex-start; margin-top:2px;
}
.dsh-agy-step-num {
  width:22px; height:22px; border-radius:50%; background:#1677ff; color:#fff;
  display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;
  flex:0 0 22px; margin-top:1px;
}
.dsh-agy-step-content {
  display:flex; flex-direction:column; gap:6px; flex:1; min-width:0;
}
.dsh-agy-code-terminal {
  display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 12px;
  border-radius:8px; background:#0e1013; border:1px solid rgba(255,255,255,0.08);
  font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; color:#58a6ff;
}
`;
		/**
		* Formats relative countdown string in exact parity with antigravity_quota.mjs formatShortCountdown.
		*/
		function formatShortCountdown(isoString) {
			if (!isoString) return "-";
			const diff = new Date(isoString).getTime() - Date.now();
			if (diff <= 0) return "已刷新";
			const totalMinutes = Math.floor(diff / 6e4);
			const days = Math.floor(totalMinutes / 1440);
			const hours = Math.floor(totalMinutes % 1440 / 60);
			const mins = totalMinutes % 60;
			if (days > 0) return hours > 0 ? `${days}d${hours}h` : `${days}d`;
			if (hours > 0) return `${hours}h${mins}m`;
			return `${mins}m`;
		}
		function getAccountQuotaMetrics(quota) {
			if (!quota?.ok || !quota.groups) return void 0;
			const allBuckets = quota.groups.flatMap((g) => g.buckets);
			const geminiBuckets = allBuckets.filter((b) => /^gemini[-_]/i.test(b.bucketId || ""));
			const b5h = geminiBuckets.find((b) => b.window === "5h") ?? allBuckets.find((b) => b.window === "5h" && !/^3p[-_]/i.test(b.bucketId || ""));
			const bWeekly = geminiBuckets.find((b) => b.window === "weekly") ?? allBuckets.find((b) => b.window === "weekly" && !/^3p[-_]/i.test(b.bucketId || ""));
			if (!b5h && !bWeekly) return void 0;
			const f5h = b5h?.remainingFraction;
			const fWeekly = bWeekly?.remainingFraction;
			const p5h = f5h !== void 0 ? Math.round(f5h * 100) : void 0;
			const pWeekly = fWeekly !== void 0 ? Math.round(fWeekly * 100) : void 0;
			const score = Math.min(f5h !== void 0 ? f5h * 100 : 100, fWeekly !== void 0 ? fWeekly * 100 : 100);
			return {
				b5h,
				bWeekly,
				p5h,
				pWeekly,
				isExhausted: score <= 10 || (b5h ? f5h !== void 0 ? f5h <= 0 : false : true) && (bWeekly ? fWeekly !== void 0 ? fWeekly <= 0 : false : true),
				score,
				reset5h: b5h?.resetTime ? formatShortCountdown(b5h.resetTime) : "",
				resetWeekly: bWeekly?.resetTime ? formatShortCountdown(bWeekly.resetTime) : ""
			};
		}
		function ensureThemeStyles() {
			if (typeof document === "undefined") return;
			let style = document.getElementById(STYLE_ID);
			if (!style) {
				style = document.createElement("style");
				style.id = STYLE_ID;
				document.head.appendChild(style);
			}
			style.textContent = SETTINGS_CSS;
		}
		async function jsonRequest(path, method = "GET", body) {
			const url = method === "GET" ? `${path}${path.includes("?") ? "&" : "?"}t=${Date.now()}` : path;
			const response = await fetch(url, {
				method,
				headers: {
					accept: "application/json",
					...body === void 0 ? {} : { "content-type": "application/json" }
				},
				credentials: "same-origin",
				cache: "no-store",
				...body === void 0 ? {} : { body: JSON.stringify(body) }
			});
			const value = await response.json().catch(() => void 0);
			if (!response.ok) {
				const message = typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : "HTTP " + response.status;
				throw new Error(message);
			}
			return value;
		}
		function AntigravitySettings({ t }) {
			if (t === void 0) throw new Error("Antigravity settings requires its translation function");
			const [activeTab, setActiveTab] = (0, react.useState)("accounts");
			const [status, setStatus] = (0, react.useState)(void 0);
			const [error, setError] = (0, react.useState)(void 0);
			const [toastMessage, setToastMessage] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [switchingId, setSwitchingId] = (0, react.useState)(null);
			const [draft, setDraft] = (0, react.useState)("");
			const [quotas, setQuotas] = (0, react.useState)({});
			const [loadingQuotas, setLoadingQuotas] = (0, react.useState)(false);
			const [searchQuery, setSearchQuery] = (0, react.useState)("");
			const [compactView, setCompactView] = (0, react.useState)(false);
			const [sortBy, setSortBy] = (0, react.useState)("default");
			const [advancedEffort, setAdvancedEffort] = (0, react.useState)("medium");
			const [advancedContextWindow, setAdvancedContextWindow] = (0, react.useState)(1048576);
			const [advancedStrategy, setAdvancedStrategy] = (0, react.useState)("failover_429");
			const [advancedThreshold, setAdvancedThreshold] = (0, react.useState)(20);
			const [savingAdvanced, setSavingAdvanced] = (0, react.useState)(false);
			const [bannerDismissed, setBannerDismissed] = (0, react.useState)(() => {
				if (typeof localStorage !== "undefined") return localStorage.getItem(DISMISSED_BANNER_KEY) === "true";
				return false;
			});
			const [guideDismissed, setGuideDismissed] = (0, react.useState)(() => {
				if (typeof localStorage !== "undefined") return localStorage.getItem(DISMISSED_WEB2API_GUIDE_KEY) === "true";
				return false;
			});
			const [network, setNetwork] = (0, react.useState)();
			const [networkMessage, setNetworkMessage] = (0, react.useState)("");
			const [savingNetwork, setSavingNetwork] = (0, react.useState)(false);
			const [web2apiEnabled, setWeb2apiEnabled] = (0, react.useState)(false);
			const [web2apiBaseUrl, setWeb2apiBaseUrl] = (0, react.useState)("http://127.0.0.1:18088/v1");
			const [web2apiApiKey, setWeb2apiApiKey] = (0, react.useState)("");
			const [web2apiImageTool, setWeb2apiImageTool] = (0, react.useState)(true);
			const [web2apiSaving, setWeb2apiSaving] = (0, react.useState)(false);
			const [web2apiTesting, setWeb2apiTesting] = (0, react.useState)(false);
			const [web2apiDetecting, setWeb2apiDetecting] = (0, react.useState)(false);
			const [web2apiFeedback, setWeb2apiFeedback] = (0, react.useState)(null);
			const [copiedDocker, setCopiedDocker] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				ensureThemeStyles();
			}, []);
			const refresh = (0, react.useCallback)(async () => {
				try {
					setStatus(await jsonRequest(STATUS_PATH));
					setError(void 0);
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				}
			}, [t]);
			const refreshQuotas = (0, react.useCallback)(async () => {
				setLoadingQuotas(true);
				setError(void 0);
				try {
					const res = await jsonRequest(QUOTAS_PATH);
					if (res?.quotas) {
						setQuotas(res.quotas);
						setToastMessage(t("quotas") + " " + (t("statusConnected") || "refreshed"));
						setTimeout(() => setToastMessage(null), 2500);
					} else setError("Quota response was empty");
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : "Failed to refresh quotas");
				} finally {
					setLoadingQuotas(false);
				}
			}, [t]);
			const loadAdvanced = (0, react.useCallback)(async () => {
				try {
					const res = await jsonRequest(ADVANCED_PATH);
					if (res?.settings) {
						if (res.settings.defaultReasoningEffort) setAdvancedEffort(res.settings.defaultReasoningEffort);
						if (res.settings.modelContextWindow) setAdvancedContextWindow(Number(res.settings.modelContextWindow));
						if (res.settings.switchingStrategy) setAdvancedStrategy(res.settings.switchingStrategy);
						if (typeof res.settings.proactiveThreshold === "number") setAdvancedThreshold(res.settings.proactiveThreshold);
					}
				} catch {}
			}, []);
			const saveAdvanced = async () => {
				setSavingAdvanced(true);
				setError(void 0);
				try {
					await jsonRequest(ADVANCED_PATH, "POST", {
						defaultReasoningEffort: advancedEffort,
						modelContextWindow: advancedContextWindow,
						switchingStrategy: advancedStrategy,
						proactiveThreshold: advancedThreshold
					});
					setToastMessage(t("advancedSaved"));
					setTimeout(() => setToastMessage(null), 3e3);
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : "Failed to save advanced settings");
				} finally {
					setSavingAdvanced(false);
				}
			};
			const loadNetwork = (0, react.useCallback)(async () => {
				try {
					setNetwork(await jsonRequest(NETWORK_PATH));
				} catch {}
			}, []);
			const loadWeb2Api = (0, react.useCallback)(async () => {
				try {
					const res = await fetch(WEB2API_SETTINGS_PATH);
					if (res.ok) {
						const data = await res.json();
						setWeb2apiEnabled(Boolean(data.enabled));
						if (data.baseUrl) setWeb2apiBaseUrl(data.baseUrl);
						if (data.apiKey) setWeb2apiApiKey(data.apiKey);
						setWeb2apiImageTool(data.enableImageTool !== false);
					}
				} catch {}
			}, []);
			(0, react.useEffect)(() => {
				refresh();
				refreshQuotas();
				loadNetwork();
				loadWeb2Api();
				loadAdvanced();
			}, [
				refresh,
				refreshQuotas,
				loadNetwork,
				loadWeb2Api,
				loadAdvanced
			]);
			const dismissGuide = () => {
				setGuideDismissed(true);
				if (typeof localStorage !== "undefined") localStorage.setItem(DISMISSED_WEB2API_GUIDE_KEY, "true");
			};
			const restoreGuide = () => {
				setGuideDismissed(false);
				if (typeof localStorage !== "undefined") localStorage.removeItem(DISMISSED_WEB2API_GUIDE_KEY);
			};
			const dismissBanner = () => {
				setBannerDismissed(true);
				if (typeof localStorage !== "undefined") localStorage.setItem(DISMISSED_BANNER_KEY, "true");
			};
			const saveNetwork = async () => {
				if (!network) return;
				setSavingNetwork(true);
				try {
					const saved = await jsonRequest(NETWORK_PATH, "POST", network);
					setNetwork(saved);
					setNetworkMessage(t("networkSaved"));
				} catch (e) {
					setNetworkMessage(e instanceof Error ? e.message : t("saveFailed"));
				} finally {
					setSavingNetwork(false);
				}
			};
			const saveWeb2Api = async (override) => {
				setWeb2apiSaving(true);
				setWeb2apiFeedback(null);
				const payload = {
					enabled: override?.enabled ?? web2apiEnabled,
					baseUrl: override?.baseUrl ?? web2apiBaseUrl,
					apiKey: web2apiApiKey,
					enableImageTool: web2apiImageTool
				};
				try {
					const res = await fetch(WEB2API_SETTINGS_PATH, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify(payload)
					});
					if (res.ok) {
						setWeb2apiFeedback({
							ok: true,
							msg: t("web2apiSaved")
						});
						refresh();
					} else {
						const err = await res.text();
						setWeb2apiFeedback({
							ok: false,
							msg: err || t("saveFailed")
						});
					}
				} catch (e) {
					setWeb2apiFeedback({
						ok: false,
						msg: e instanceof Error ? e.message : t("unknownError")
					});
				} finally {
					setWeb2apiSaving(false);
				}
			};
			const testWeb2Api = async () => {
				setWeb2apiTesting(true);
				setWeb2apiFeedback(null);
				try {
					const data = await (await fetch(WEB2API_TEST_PATH, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							enabled: true,
							baseUrl: web2apiBaseUrl,
							apiKey: web2apiApiKey
						})
					})).json();
					if (data.ok) setWeb2apiFeedback({
						ok: true,
						msg: t("web2apiConnected", { latency: data.latencyMs })
					});
					else setWeb2apiFeedback({
						ok: false,
						msg: t("web2apiFailed", { error: data.error ?? t("unknownError") })
					});
				} catch (e) {
					setWeb2apiFeedback({
						ok: false,
						msg: e instanceof Error ? e.message : t("unknownError")
					});
				} finally {
					setWeb2apiTesting(false);
				}
			};
			const detectLocalGateway = async () => {
				setWeb2apiDetecting(true);
				setWeb2apiFeedback(null);
				const candidates = ["http://127.0.0.1:18088/v1", "http://localhost:18088/v1"];
				let detected = false;
				for (const url of candidates) try {
					const data = await (await fetch(WEB2API_TEST_PATH, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							enabled: true,
							baseUrl: url,
							apiKey: web2apiApiKey
						})
					})).json();
					if (data.ok) {
						setWeb2apiBaseUrl(url);
						setWeb2apiEnabled(true);
						setWeb2apiFeedback({
							ok: true,
							msg: t("detectedSuccess", {
								url,
								latency: data.latencyMs
							})
						});
						await saveWeb2Api({
							enabled: true,
							baseUrl: url
						});
						detected = true;
						break;
					}
				} catch {}
				if (!detected) setWeb2apiFeedback({
					ok: false,
					msg: t("detectedNotFound")
				});
				setWeb2apiDetecting(false);
			};
			const copyDockerCommand = () => {
				if (typeof navigator !== "undefined" && navigator.clipboard) {
					navigator.clipboard.writeText(DOCKER_CMD);
					setCopiedDocker(true);
					setTimeout(() => setCopiedDocker(false), 2e3);
				}
			};
			const signIn = async () => {
				setBusy(true);
				try {
					const challenge = await jsonRequest(LOGIN_PATH, "POST");
					if (typeof window !== "undefined") window.open(challenge.url, "_blank", "noopener,noreferrer");
					refresh();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				} finally {
					setBusy(false);
				}
			};
			const complete = async () => {
				if (draft.trim().length === 0) return;
				setBusy(true);
				try {
					await jsonRequest(COMPLETE_PATH, "POST", { url: draft.trim() });
					setDraft("");
					refresh();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				} finally {
					setBusy(false);
				}
			};
			const switchAccount = async (targetAccount) => {
				setSwitchingId(targetAccount.id);
				setError(void 0);
				try {
					const res = await jsonRequest(SWITCH_PATH, "POST", { id: targetAccount.id });
					if (res?.account) setStatus(res.account);
					else await refresh();
					setToastMessage(t("accountSwitched", { email: targetAccount.email ?? targetAccount.id }));
					setTimeout(() => setToastMessage(null), 3e3);
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
					await refresh();
				} finally {
					setSwitchingId(null);
				}
			};
			const removeAccount = async (id) => {
				setBusy(true);
				try {
					await jsonRequest(REMOVE_PATH, "POST", { id });
					refresh();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				} finally {
					setBusy(false);
				}
			};
			const recover = async (action) => {
				setBusy(true);
				try {
					await jsonRequest("/plugins/dsh-antigravity-oauth/auth/" + action, "POST");
					setDraft("");
					refresh();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				} finally {
					setBusy(false);
				}
			};
			const accounts = (0, react.useMemo)(() => status?.accounts ?? [], [status]);
			const activeAccountId = (0, react.useMemo)(() => status?.status === "signed-in" ? status.activeId : void 0, [status]);
			const activeAccount = (0, react.useMemo)(() => accounts.find((a) => a.id === activeAccountId), [accounts, activeAccountId]);
			const filteredAccounts = (0, react.useMemo)(() => {
				let list = accounts.slice();
				if (searchQuery.trim().length > 0) {
					const query = searchQuery.toLowerCase().trim();
					list = list.filter((a) => a.email?.toLowerCase().includes(query) || a.id.toLowerCase().includes(query) || a.projectId?.toLowerCase().includes(query));
				}
				if (sortBy === "quota") list.sort((a, b) => {
					if (a.id === activeAccountId) return -1;
					if (b.id === activeAccountId) return 1;
					const qa = getAccountQuotaMetrics(quotas[a.id])?.score ?? -1;
					return (getAccountQuotaMetrics(quotas[b.id])?.score ?? -1) - qa;
				});
				return list;
			}, [
				accounts,
				searchQuery,
				sortBy,
				quotas,
				activeAccountId
			]);
			const signing = status?.status === "signing-in";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsh-agy-page",
				"aria-labelledby": "antigravity-settings-title",
				children: [
					toastMessage ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-agy-toast-float",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "✓" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: toastMessage })]
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-agy-header",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-agy-title-row",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
								id: "antigravity-settings-title",
								className: "dsh-agy-title",
								children: t("title")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-agy-header-active-badge",
								title: activeAccount ? activeAccount.email ?? activeAccount.id : t("signedOut"),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dsh-agy-dot " + (signing ? "is-signing-in" : activeAccount?.ready ? "is-signed-in" : "is-error") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: signing ? t("signingIn") : activeAccount ? activeAccount.email ?? activeAccount.id : t("signedOut") })]
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("nav", {
							className: "dsh-agy-tabs",
							role: "tablist",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "tab",
									"aria-selected": activeTab === "accounts",
									className: "dsh-agy-tab-btn " + (activeTab === "accounts" ? "is-active" : ""),
									onClick: () => setActiveTab("accounts"),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("tabAccounts") }), accounts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: {
											fontSize: "11px",
											opacity: .85,
											background: "rgba(255,255,255,0.25)",
											padding: "1px 6px",
											borderRadius: "10px"
										},
										children: accounts.length
									}) : null]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									role: "tab",
									"aria-selected": activeTab === "advanced",
									className: "dsh-agy-tab-btn " + (activeTab === "advanced" ? "is-active" : ""),
									onClick: () => setActiveTab("advanced"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("tabAdvanced") })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "tab",
									"aria-selected": activeTab === "web2api",
									className: "dsh-agy-tab-btn " + (activeTab === "web2api" ? "is-active" : ""),
									onClick: () => setActiveTab("web2api"),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh-agy-dot " + (web2apiEnabled ? "is-signed-in" : ""),
										style: {
											width: "6px",
											height: "6px"
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("tabWeb2api") })]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									role: "tab",
									"aria-selected": activeTab === "network",
									className: "dsh-agy-tab-btn " + (activeTab === "network" ? "is-active" : ""),
									onClick: () => setActiveTab("network"),
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("tabNetwork") })
								})
							]
						})]
					}),
					!bannerDismissed && !compactView ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-agy-notice-banner",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsh-agy-body",
							style: { margin: 0 },
							children: t("tos")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh-agy-notice-close",
							title: t("dismissNotice"),
							onClick: dismissBanner,
							children: "×"
						})]
					}) : null,
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsh-agy-error",
						children: error
					}) : null,
					activeTab === "accounts" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							flexDirection: "column",
							gap: "10px"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh-agy-card",
								style: { padding: "8px 12px" },
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsh-agy-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: {
											display: "flex",
											alignItems: "center",
											gap: "8px"
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dsh-agy-dot " + (signing ? "is-signing-in" : activeAccount?.ready ? "is-signed-in" : "is-error") }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												style: {
													fontSize: "13px",
													fontWeight: 600,
													color: "#fff"
												},
												children: [t("authStatus"), ":"]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsh-agy-status-badge " + (activeAccount?.ready ? "is-success" : "is-error"),
												children: signing ? t("signingIn") : activeAccount ? activeAccount.ready ? t("signedIn") : t("authorized") : t("signedOut")
											})
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: {
											display: "flex",
											gap: "8px"
										},
										children: [signing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-agy-action-pill is-remove-btn",
											onClick: () => {
												recover("cancel");
											},
											children: t("cancel")
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-agy-btn dsh-agy-btn-primary",
											disabled: busy,
											onClick: () => {
												signIn();
											},
											children: busy ? t("working") : accounts.length === 0 ? t("login") : t("addAccount")
										}), accounts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-agy-btn dsh-agy-btn-secondary",
											disabled: busy || loadingQuotas,
											onClick: () => {
												refreshQuotas();
											},
											children: loadingQuotas ? "..." : t("refreshQuotas")
										}) : null]
									})]
								})
							}),
							accounts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-agy-card",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsh-agy-row dsh-agy-toolbar-row",
									style: {
										gap: "10px",
										alignItems: "center"
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: {
											position: "relative",
											flex: "1 1 200px"
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "text",
											className: "dsh-agy-input",
											placeholder: t("searchAccountsPlaceholder"),
											value: searchQuery,
											onChange: (e) => setSearchQuery(e.target.value),
											style: { paddingRight: searchQuery ? "28px" : "10px" }
										}), searchQuery ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											"aria-label": t("clearSearch"),
											onClick: () => setSearchQuery(""),
											style: {
												position: "absolute",
												right: "6px",
												top: "50%",
												transform: "translateY(-50%)",
												border: "none",
												background: "transparent",
												cursor: "pointer",
												opacity: .6,
												color: "#fff"
											},
											children: "×"
										}) : null]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-agy-toolbar-controls",
										style: {
											display: "flex",
											alignItems: "center",
											gap: "10px",
											flexShrink: 0
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsh-agy-segmented",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dsh-agy-segmented-btn " + (sortBy === "default" ? "is-active" : ""),
												style: {
													padding: "3px 8px",
													fontSize: "11px"
												},
												onClick: () => setSortBy("default"),
												title: t("sortDefault"),
												children: t("sortDefaultShort")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: "dsh-agy-segmented-btn " + (sortBy === "quota" ? "is-active" : ""),
												style: {
													padding: "3px 8px",
													fontSize: "11px"
												},
												onClick: () => setSortBy("quota"),
												title: t("sortQuota"),
												children: ["⚡ ", t("sortQuotaShort")]
											})]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											style: {
												display: "inline-flex",
												alignItems: "center",
												gap: "5px",
												fontSize: "12px",
												cursor: "pointer",
												color: "#b0b4ba",
												userSelect: "none"
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: compactView,
												onChange: (e) => setCompactView(e.target.checked),
												style: { cursor: "pointer" }
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("compactView") })]
										})]
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsh-agy-account-list " + (compactView ? "is-compact-mode" : ""),
									children: filteredAccounts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										style: {
											padding: "24px",
											textAlign: "center",
											opacity: .6,
											fontSize: "13px"
										},
										children: t("noMatchingAccounts")
									}) : filteredAccounts.map((account) => {
										const isActive = account.id === activeAccountId;
										const isSwitching = account.id === switchingId;
										const metrics = getAccountQuotaMetrics(quotas[account.id]);
										const p5h = metrics?.p5h;
										const pWeekly = metrics?.pWeekly;
										const score = metrics?.score !== void 0 ? Math.round(metrics.score) : void 0;
										const title5h = p5h !== void 0 ? `5h limit: ${p5h}%${metrics?.reset5h ? ` (${t("quotaResetsIn")} ${metrics.reset5h})` : ""}` : "5h limit: Quota not loaded";
										const titleWeekly = pWeekly !== void 0 ? `Weekly limit: ${pWeekly}%${metrics?.resetWeekly ? ` (${t("quotaResetsIn")} ${metrics.resetWeekly})` : ""}` : "Weekly limit: Quota not loaded";
										const titleOverall = score !== void 0 ? `Effective bottleneck: ${score}% · 5h: ${p5h}% · Weekly: ${pWeekly}%` : "";
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsh-agy-account " + (isActive ? "is-active " : "") + (compactView ? "is-compact" : ""),
											onClick: () => {
												if (!isActive && !switchingId) switchAccount(account);
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsh-agy-account-header",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dsh-agy-account-info",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														type: "radio",
														checked: isActive,
														readOnly: true,
														style: {
															cursor: "pointer",
															flexShrink: 0
														}
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: {
															display: "flex",
															flexDirection: "column",
															minWidth: 0,
															overflow: "hidden"
														},
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															style: {
																display: "flex",
																alignItems: "center",
																gap: "6px"
															},
															children: [
																/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "dsh-agy-account-mail",
																	children: account.email ?? account.id
																}),
																isSwitching ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																	className: "dsh-agy-status-badge is-switching",
																	children: [t("working"), "..."]
																}) : null,
																account.limited ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "dsh-agy-status-badge is-error",
																	children: t("accountLimited")
																}) : null,
																account.dead ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																	className: "dsh-agy-status-badge is-error",
																	children: t("accountNeedsRelogin")
																}) : null
															]
														}), !compactView && account.projectId ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															style: {
																fontSize: "11px",
																opacity: .6,
																overflow: "hidden",
																textOverflow: "ellipsis"
															},
															children: account.projectId
														}) : null]
													})]
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: "dsh-agy-account-action",
													onClick: (e) => e.stopPropagation(),
													children: isActive ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsh-agy-action-pill is-active-badge",
														children: t("activeBadge")
													}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dsh-agy-action-pill is-remove-btn",
														disabled: busy || Boolean(switchingId),
														onClick: () => {
															removeAccount(account.id);
														},
														children: t("removeAccount")
													})
												})]
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsh-agy-account-metrics",
												onClick: (e) => e.stopPropagation(),
												title: titleOverall,
												children: [p5h !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dsh-agy-capsule-bar",
													title: title5h,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "dsh-agy-capsule-main",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
															"5h ",
															p5h,
															"%"
														] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
															className: "dsh-agy-capsule-progress",
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																className: "dsh-agy-capsule-fill " + (p5h > 40 ? "is-high" : p5h > 15 ? "is-med" : "is-low"),
																style: { width: p5h + "%" }
															})
														})]
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsh-agy-capsule-reset",
														children: metrics?.reset5h ? metrics.reset5h : t("quotaFullyAvailable")
													})]
												}) : null, pWeekly !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dsh-agy-capsule-bar",
													title: titleWeekly,
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "dsh-agy-capsule-main",
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
															t("quotaWeeklyShort"),
															" ",
															pWeekly,
															"%"
														] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
															className: "dsh-agy-capsule-progress",
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																className: "dsh-agy-capsule-fill " + (pWeekly > 40 ? "is-high" : pWeekly > 15 ? "is-med" : "is-low"),
																style: { width: pWeekly + "%" }
															})
														})]
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsh-agy-capsule-reset",
														children: metrics?.resetWeekly ? metrics.resetWeekly : t("quotaFullyAvailable")
													})]
												}) : null]
											})]
										}, account.id);
									})
								})]
							}) : null,
							signing && status?.url ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-agy-card",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: "dsh-agy-body",
									children: [
										t("openUrl"),
										" ",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
											href: status.url,
											target: "_blank",
											rel: "noreferrer",
											className: "dsh-agy-link",
											children: t("reopen")
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
									onSubmit: (e) => {
										e.preventDefault();
										complete();
									},
									style: {
										display: "flex",
										gap: "8px",
										marginTop: "6px"
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "text",
										className: "dsh-agy-input",
										placeholder: t("completePlaceholder"),
										value: draft,
										disabled: busy,
										onChange: (e) => setDraft(e.target.value)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "submit",
										className: "dsh-agy-btn dsh-agy-btn-primary",
										disabled: busy || draft.trim().length === 0,
										children: busy ? t("working") : t("complete")
									})]
								})]
							}) : null,
							activeAccount !== void 0 && !activeAccount.ready ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsh-agy-btn dsh-agy-btn-primary",
								disabled: busy,
								onClick: () => {
									recover("retry");
								},
								children: busy ? t("working") : t("retryEligibility")
							}) : null
						]
					}) : null,
					activeTab === "advanced" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							flexDirection: "column",
							gap: "12px"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-agy-card",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsh-agy-row",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
										className: "dsh-agy-card-title",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "🧠" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("modelTuningTitle") })]
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsh-agy-body",
									children: t("modelTuningDesc")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										flexDirection: "column",
										gap: "12px",
										marginTop: "4px"
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										style: {
											fontSize: "12px",
											display: "block",
											marginBottom: "6px",
											fontWeight: 500,
											color: "#f0f0f0"
										},
										children: t("defaultReasoningEffort")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-agy-segmented",
										role: "radiogroup",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: "dsh-agy-segmented-btn " + (advancedEffort === "low" ? "is-active" : ""),
												onClick: () => setAdvancedEffort("low"),
												children: ["🌱 ", t("effortLow")]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: "dsh-agy-segmented-btn " + (advancedEffort === "medium" ? "is-active" : ""),
												onClick: () => setAdvancedEffort("medium"),
												children: ["⚡ ", t("effortMedium")]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: "dsh-agy-segmented-btn " + (advancedEffort === "high" ? "is-active" : ""),
												onClick: () => setAdvancedEffort("high"),
												children: ["🔥 ", t("effortHigh")]
											})
										]
									})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										style: {
											fontSize: "12px",
											display: "block",
											marginBottom: "6px",
											fontWeight: 500,
											color: "#f0f0f0"
										},
										children: t("modelContextWindow")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-agy-segmented",
										role: "radiogroup",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dsh-agy-segmented-btn " + (advancedContextWindow === 131072 ? "is-active" : ""),
												onClick: () => setAdvancedContextWindow(131072),
												children: t("contextWindow128K")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dsh-agy-segmented-btn " + (advancedContextWindow === 262144 ? "is-active" : ""),
												onClick: () => setAdvancedContextWindow(262144),
												children: t("contextWindow256K")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dsh-agy-segmented-btn " + (advancedContextWindow === 524288 ? "is-active" : ""),
												onClick: () => setAdvancedContextWindow(524288),
												children: t("contextWindow512K")
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dsh-agy-segmented-btn " + (advancedContextWindow === 1048576 ? "is-active" : ""),
												onClick: () => setAdvancedContextWindow(1048576),
												children: t("contextWindow1M")
											})
										]
									})] })]
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-agy-card",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsh-agy-row",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
										className: "dsh-agy-card-title",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "🔄" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("switchingStrategyTitle") })]
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsh-agy-body",
									children: t("switchingStrategyDesc")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										flexDirection: "column",
										gap: "8px",
										marginTop: "4px"
									},
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsh-agy-radio-card " + (advancedStrategy === "failover_429" ? "is-active" : ""),
											onClick: () => setAdvancedStrategy("failover_429"),
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dsh-agy-custom-radio",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dsh-agy-custom-radio-dot" })
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													display: "flex",
													flexDirection: "column",
													flex: 1
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													style: {
														display: "flex",
														alignItems: "center",
														gap: "8px"
													},
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: {
															fontSize: "13px",
															fontWeight: 600,
															color: "#f0f0f0"
														},
														children: t("strategyFailover")
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsh-agy-card-badge",
														children: "Default"
													})]
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														fontSize: "11px",
														color: "#9a9ea5"
													},
													children: "Switch to the account with highest quota only when 429 quota exhaustion occurs."
												})]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsh-agy-radio-card " + (advancedStrategy === "proactive_threshold" ? "is-active" : ""),
											onClick: () => setAdvancedStrategy("proactive_threshold"),
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dsh-agy-custom-radio",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dsh-agy-custom-radio-dot" })
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													display: "flex",
													flexDirection: "column",
													width: "100%"
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: {
															fontSize: "13px",
															fontWeight: 600,
															color: "#f0f0f0"
														},
														children: t("strategyProactive")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														style: {
															fontSize: "11px",
															color: "#9a9ea5"
														},
														children: t("thresholdLabel", { threshold: advancedThreshold })
													}),
													advancedStrategy === "proactive_threshold" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														style: {
															display: "flex",
															alignItems: "center",
															gap: "12px",
															marginTop: "8px"
														},
														onClick: (e) => e.stopPropagation(),
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
															type: "range",
															min: "10",
															max: "40",
															step: "5",
															value: advancedThreshold,
															onChange: (e) => setAdvancedThreshold(Number(e.target.value)),
															style: {
																flex: "1 1 140px",
																cursor: "pointer",
																accentColor: "#1677ff"
															}
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
															style: {
																fontSize: "12px",
																fontWeight: 600,
																color: "#1677ff",
																minWidth: "35px"
															},
															children: [advancedThreshold, "%"]
														})]
													}) : null
												]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsh-agy-radio-card " + (advancedStrategy === "round_robin" ? "is-active" : ""),
											onClick: () => setAdvancedStrategy("round_robin"),
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dsh-agy-custom-radio",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dsh-agy-custom-radio-dot" })
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													display: "flex",
													flexDirection: "column",
													flex: 1
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														fontSize: "13px",
														fontWeight: 600,
														color: "#f0f0f0"
													},
													children: t("strategyRoundRobin")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														fontSize: "11px",
														color: "#9a9ea5"
													},
													children: "Rotate through all available accounts per turn to balance rolling usage."
												})]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsh-agy-radio-card " + (advancedStrategy === "manual" ? "is-active" : ""),
											onClick: () => setAdvancedStrategy("manual"),
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dsh-agy-custom-radio",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { className: "dsh-agy-custom-radio-dot" })
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													display: "flex",
													flexDirection: "column",
													flex: 1
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														fontSize: "13px",
														fontWeight: 600,
														color: "#f0f0f0"
													},
													children: t("strategyManual")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														fontSize: "11px",
														color: "#9a9ea5"
													},
													children: "Never auto-switch accounts; stay strictly on the currently selected account."
												})]
											})]
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									style: { marginTop: "8px" },
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsh-agy-btn dsh-agy-btn-primary",
										disabled: savingAdvanced,
										onClick: () => {
											saveAdvanced();
										},
										children: savingAdvanced ? t("working") : t("saveAdvanced")
									})
								})
							]
						})]
					}) : null,
					activeTab === "web2api" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							flexDirection: "column",
							gap: "14px"
						},
						children: [
							!guideDismissed ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-agy-guide-card",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-agy-guide-header",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: {
												display: "flex",
												alignItems: "center",
												gap: "8px"
											},
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: { fontSize: "16px" },
													children: "🚀"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														fontSize: "14px",
														fontWeight: 600,
														color: "#fff"
													},
													children: t("quickSetupTitle")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsh-agy-status-badge is-success",
													children: "Docker / Binary Ready"
												})
											]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-agy-notice-close",
											title: t("hideGuide"),
											onClick: dismissGuide,
											children: "×"
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsh-agy-body",
										style: { color: "#b0b4ba" },
										children: t("quickSetupDesc")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-agy-step",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "dsh-agy-step-num",
											children: "1"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsh-agy-step-content",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														fontSize: "12px",
														fontWeight: 600,
														color: "#f0f0f0"
													},
													children: t("step1Title")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsh-agy-body",
													style: { fontSize: "11px" },
													children: t("step1Desc")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
													className: "dsh-agy-code-terminal",
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
														style: {
															overflow: "hidden",
															textOverflow: "ellipsis",
															whiteSpace: "nowrap"
														},
														children: DOCKER_CMD
													}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
														style: { flexShrink: 0 },
														onClick: copyDockerCommand,
														children: copiedDocker ? t("copied") : t("copyCommand")
													})]
												})
											]
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-agy-step",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "dsh-agy-step-num",
											children: "2"
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsh-agy-step-content",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														fontSize: "12px",
														fontWeight: 600,
														color: "#f0f0f0"
													},
													children: t("step2Title")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsh-agy-body",
													style: { fontSize: "11px" },
													children: t("step2Desc")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact",
													style: { padding: "3px 12px" },
													disabled: web2apiDetecting,
													onClick: () => {
														detectLocalGateway();
													},
													children: web2apiDetecting ? t("detecting") : t("detectService")
												}) })
											]
										})]
									})
								]
							}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-agy-row",
								style: {
									padding: "8px 12px",
									borderRadius: "8px",
									border: "1px dashed rgba(255,255,255,0.15)",
									background: "rgba(255,255,255,0.02)"
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										alignItems: "center",
										gap: "8px"
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: { fontSize: "14px" },
										children: "🚀"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh-agy-body",
										style: {
											fontSize: "12px",
											color: "#c0c4cc"
										},
										children: t("quickSetupTitle")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
									style: {
										padding: "2px 10px",
										fontSize: "11px"
									},
									onClick: restoreGuide,
									children: t("showGuide")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-agy-card",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-agy-row",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: {
												display: "flex",
												alignItems: "center",
												gap: "8px"
											},
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dsh-agy-dot " + (web2apiEnabled ? "is-signed-in" : "") }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
													className: "dsh-agy-card-title",
													children: t("web2apiTitle")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsh-agy-status-badge " + (web2apiEnabled ? "is-success" : ""),
													children: web2apiEnabled ? t("statusConnected") : t("statusDisabled")
												})
											]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
											style: {
												display: "inline-flex",
												alignItems: "center",
												gap: "6px",
												cursor: "pointer",
												fontSize: "13px"
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: web2apiEnabled,
												disabled: web2apiSaving,
												onChange: (e) => setWeb2apiEnabled(e.target.checked)
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("web2apiEnable") })]
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsh-agy-body",
										children: t("web2apiHelp")
									}),
									web2apiEnabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: {
											display: "flex",
											flexDirection: "column",
											gap: "10px",
											marginTop: "4px"
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													display: "flex",
													alignItems: "center",
													gap: "6px",
													flexWrap: "wrap"
												},
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														style: {
															fontSize: "12px",
															opacity: .7
														},
														children: [t("presetLocal"), ":"]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dsh-agy-chip",
														onClick: () => setWeb2apiBaseUrl("http://127.0.0.1:18088/v1"),
														children: "127.0.0.1:18088"
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dsh-agy-chip",
														onClick: () => setWeb2apiBaseUrl("http://localhost:18088/v1"),
														children: "localhost:18088"
													})
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
												style: {
													fontSize: "12px",
													display: "block",
													marginBottom: "4px",
													fontWeight: 500
												},
												children: t("web2apiBaseUrl")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "text",
												className: "dsh-agy-input",
												placeholder: "http://127.0.0.1:18088/v1",
												value: web2apiBaseUrl,
												disabled: web2apiSaving,
												onChange: (e) => setWeb2apiBaseUrl(e.target.value)
											})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
												style: {
													fontSize: "12px",
													display: "block",
													marginBottom: "4px",
													fontWeight: 500
												},
												children: t("web2apiApiKey")
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "password",
												className: "dsh-agy-input",
												placeholder: "sk-...",
												value: web2apiApiKey,
												disabled: web2apiSaving,
												onChange: (e) => setWeb2apiApiKey(e.target.value)
											})] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
												style: {
													display: "inline-flex",
													alignItems: "center",
													gap: "6px",
													cursor: "pointer",
													fontSize: "13px"
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
													type: "checkbox",
													checked: web2apiImageTool,
													disabled: web2apiSaving,
													onChange: (e) => setWeb2apiImageTool(e.target.checked)
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("web2apiImageTool") })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												style: {
													display: "flex",
													alignItems: "center",
													gap: "8px",
													marginTop: "4px"
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
													disabled: web2apiTesting || web2apiSaving,
													onClick: () => {
														testWeb2Api();
													},
													children: web2apiTesting ? t("web2apiTesting") : t("web2apiTest")
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: "dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact",
													disabled: web2apiSaving,
													onClick: () => {
														saveWeb2Api();
													},
													children: web2apiSaving ? t("web2apiSaving") : t("web2apiSave")
												})]
											}),
											web2apiFeedback ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: web2apiFeedback.ok ? "dsh-agy-body" : "dsh-agy-error",
												style: {
													marginTop: "2px",
													fontSize: "12px"
												},
												children: web2apiFeedback.msg
											}) : null
										]
									}) : null
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-agy-card",
								style: {
									background: "transparent",
									opacity: .85
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsh-agy-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsh-agy-card-title",
										style: { fontSize: "13px" },
										children: t("creditTitle")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
										href: "https://github.com/zexadev/gemini-web2api-go",
										target: "_blank",
										rel: "noreferrer",
										className: "dsh-agy-link",
										style: { fontSize: "12px" },
										children: [t("visitRepo"), " →"]
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsh-agy-body",
									style: { fontSize: "12px" },
									children: t("creditBody")
								})]
							})
						]
					}) : null,
					activeTab === "network" && network ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-agy-card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsh-agy-card-title",
								children: t("network")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsh-agy-body",
								children: t("networkHelp")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									flexDirection: "column",
									gap: "10px",
									marginTop: "6px"
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										style: {
											fontSize: "12px",
											display: "flex",
											flexDirection: "column",
											gap: "4px"
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("network") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
											className: "dsh-agy-select",
											"aria-label": t("network"),
											value: network.mode,
											disabled: savingNetwork,
											onChange: (e) => setNetwork({
												...network,
												mode: e.target.value
											}),
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "auto",
													children: t("networkAuto")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "direct",
													children: t("networkDirect")
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "proxy",
													children: t("networkProxy")
												})
											]
										})]
									}),
									network.mode === "proxy" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										style: {
											fontSize: "12px",
											display: "block",
											marginBottom: "4px"
										},
										children: t("proxyUrl")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "text",
										className: "dsh-agy-input",
										"aria-label": t("proxyUrl"),
										placeholder: "http://127.0.0.1:7890",
										value: network.url,
										disabled: savingNetwork,
										onChange: (e) => setNetwork({
											...network,
											url: e.target.value
										})
									})] }) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
										className: "dsh-agy-body",
										style: { fontSize: "12px" },
										children: [
											t("effectiveNetwork"),
											" ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: network.effective || "direct" })
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact",
										style: { width: "fit-content" },
										disabled: savingNetwork,
										onClick: () => {
											saveNetwork();
										},
										children: savingNetwork ? t("working") : t("saveNetwork")
									}),
									networkMessage ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										role: "status",
										className: "dsh-agy-body",
										style: { fontSize: "12px" },
										children: networkMessage
									}) : null
								]
							})
						]
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const en = {
			nav: "Antigravity",
			title: "Google Antigravity",
			tos: "Unofficial Cloud Code Assist login. Review Google Terms of Service before signing in. Credentials stay in DSH’s private store, not in official CLI files.",
			loadingAccount: "Loading accounts…",
			signedOut: "Not signed in",
			signingIn: "Waiting for authorization…",
			signedIn: "Signed in",
			authorized: "Google authorized · Antigravity not ready",
			retryEligibility: "Retry service eligibility",
			cancel: "Cancel",
			reopen: "Reopen authorization page",
			network: "Antigravity network",
			networkHelp: "Applies only to this plugin. Subscription Login proxy settings are separate. Saving applies to new requests.",
			networkAuto: "Use Host proxy environment",
			networkDirect: "Direct",
			networkProxy: "HTTP(S) proxy",
			proxyUrl: "Proxy URL",
			effectiveNetwork: "Saved request route:",
			saveNetwork: "Save network settings",
			networkSaved: "Saved. Retry service eligibility to check the connection.",
			login: "Sign in",
			loginAgain: "Sign in again",
			working: "Working…",
			openUrl: "Authorize",
			completeHelp: "If the browser window does not return, paste the redirect URL or authorization code.",
			completePlaceholder: "Paste redirect URL or code",
			complete: "Finish sign-in",
			requestFailed: "The login request failed.",
			email: "Account",
			project: "Project",
			accounts: "Accounts",
			addAccount: "Add account",
			quotaHint: "Saved accounts stay signed in. When one hits its quota, switch to another here without signing out.",
			switchAccount: "Use this account",
			removeAccount: "Remove",
			accountLimited: "Quota limited",
			accountNeedsRelogin: "Re-login required",
			accountNeedsEligibility: "Eligibility pending",
			unknownAccount: "Unknown account",
			quotas: "Quotas",
			refreshQuotas: "Refresh",
			refreshed: "Quotas refreshed",
			quota5h: "5h limit",
			quotaWeekly: "Weekly limit",
			quotaResetsIn: "Resets in",
			effectiveQuota: "Effective",
			quotaUnavailable: "Quota unavailable",
			searchAccountsPlaceholder: "Search accounts / projects…",
			hideExhausted: "Hide exhausted",
			compactView: "Compact view",
			sortBy: "Sort",
			sortDefault: "Default",
			sortQuota: "Highest quota",
			totalLabel: "Total",
			availableLabel: "available",
			exhaustedLabel: "exhausted",
			noMatchingAccounts: "No matching accounts found",
			activeBadge: "Active",
			quotaWeeklyShort: "Wk",
			authStatus: "Authorization status",
			web2apiTitle: "Gemini Web2API Gateway (Optional)",
			web2apiHelp: "Integrates self-hosted Gemini Web reverse proxy (gemini-web2api-go). Provides optional Imagen 3 image generation and Web-exclusive models without Google Cloud billing.",
			web2apiEnable: "Enable Web2API Gateway",
			web2apiBaseUrl: "Gateway Base URL",
			web2apiApiKey: "API Key (Optional)",
			web2apiImageTool: "Enable Image Generation (Imagen 3)",
			web2apiTest: "Test Connection",
			web2apiTesting: "Testing…",
			web2apiSave: "Save Web2API Settings",
			web2apiSaving: "Saving…",
			web2apiSaved: "Web2API settings saved.",
			web2apiCredit: "Powered by zexadev/gemini-web2api-go",
			web2apiConnected: "Connection successful (Latency: {latency}ms)",
			web2apiFailed: "Connection failed: {error}",
			tabAccounts: "Accounts",
			showGuide: "Show Setup Guide",
			hideGuide: "Hide Guide",
			sortDefaultShort: "Default",
			sortQuotaShort: "By Quota",
			tabAdvanced: "Advanced",
			modelTuningTitle: "Model Reasoning & Context Window",
			modelTuningDesc: "Configure default thinking budget and context limits.",
			defaultReasoningEffort: "Default Reasoning Effort",
			effortLow: "Low",
			effortMedium: "Medium (Default)",
			effortHigh: "High",
			modelContextWindow: "Model Context Window Limit",
			contextWindow1M: "1M (Default)",
			contextWindow512K: "512K",
			contextWindow256K: "256K",
			contextWindow128K: "128K",
			switchingStrategyTitle: "Account Switching Strategies",
			switchingStrategyDesc: "Manage how and when accounts rotate during generations.",
			strategyFailover: "Failover on 429 (Default)",
			strategyProactive: "Proactive Threshold",
			strategyRoundRobin: "Round-Robin",
			strategyManual: "Manual Only",
			thresholdLabel: "Switch when quota drops below: {threshold}%",
			saveAdvanced: "Save Advanced Settings",
			advancedSaved: "Advanced settings saved.",
			quotaFullyAvailable: "Fully available",
			tabWeb2api: "Web2API",
			tabNetwork: "Network",
			clearSearch: "Clear search",
			saveFailed: "Failed to save settings.",
			unknownError: "Unknown error",
			presetLocal: "Local (127.0.0.1:18088)",
			presetDocker: "Docker (localhost:18088)",
			gatewayStatus: "Gateway status:",
			statusConnected: "Connected",
			statusDisabled: "Disabled",
			statusError: "Disconnected",
			filterAll: "All",
			filterAvailable: "Available",
			filterExhausted: "Exhausted",
			creditTitle: "Open Source Attribution",
			creditBody: "Web2API reverse-proxy protocol and inspiration courtesy of zexadev/gemini-web2api-go.",
			visitRepo: "Visit GitHub Repository",
			detectService: "Detect Local Gateway",
			detecting: "Detecting…",
			detectedSuccess: "Detected local gateway at {url} ({latency}ms)",
			detectedNotFound: "No local gateway detected at 127.0.0.1:18088. Ensure the container or binary is running.",
			dockerOneLiner: "Docker One-Liner:",
			copyCommand: "Copy",
			copied: "Copied!",
			quickSetupTitle: "Quick Setup Guide",
			quickSetupDesc: "Run gemini-web2api-go locally via Docker or binary to bypass Google WAF with genuine Chrome TLS fingerprinting.",
			step1Title: "Step 1: Start Container",
			step1Desc: "Run the lightweight reverse-proxy locally on port 18088:",
			step2Title: "Step 2: Auto-Connect",
			step2Desc: "Detect and link the running gateway automatically:",
			accountSwitched: "Switched to {email}",
			resetsIn: "resets in {time}",
			dismissNotice: "Dismiss banner"
		};
		const zh = {
			nav: "Antigravity",
			title: "Google Antigravity",
			tos: "非官方 Cloud Code Assist 登录。登录前请阅读 Google 服务条款。凭据只保存在 DSH 的私有文件中，不会写入官方 CLI 登录文件。",
			loadingAccount: "正在加载账号…",
			signedOut: "尚未登录",
			signingIn: "正在等待授权…",
			signedIn: "已登录",
			authorized: "Google 已授权 · Antigravity 尚未就绪",
			retryEligibility: "重新检查服务资格",
			cancel: "取消",
			reopen: "重新打开授权页",
			network: "Antigravity 网络",
			networkHelp: "仅作用于本插件，与“订阅登录”的代理设置独立。保存后用于新请求。",
			networkAuto: "沿用 Host 代理环境",
			networkDirect: "直连",
			networkProxy: "HTTP(S) 代理",
			proxyUrl: "代理地址",
			effectiveNetwork: "已保存的请求路径：",
			saveNetwork: "保存网络设置",
			networkSaved: "已保存，可重新检查服务资格以验证连接。",
			login: "登录",
			loginAgain: "重新登录",
			working: "处理中…",
			openUrl: "授权",
			completeHelp: "如果浏览器没有自动返回，请粘贴跳转 URL 或授权码。",
			completePlaceholder: "粘贴跳转 URL 或授权码",
			complete: "完成登录",
			requestFailed: "登录请求失败。",
			email: "账号",
			project: "项目",
			accounts: "账号",
			addAccount: "添加账号",
			quotaHint: "已保存的账号保持登录状态。某个账号配额用完后，在这里切换到下一个账号，无需退出登录。",
			switchAccount: "使用此账号",
			removeAccount: "删除",
			accountLimited: "配额受限",
			accountNeedsRelogin: "需要重新登录",
			accountNeedsEligibility: "资格待确认",
			unknownAccount: "未知账号",
			quotas: "配额",
			refreshQuotas: "刷新",
			refreshed: "配额已刷新",
			quota5h: "5小时滚动",
			quotaWeekly: "每周总额度",
			quotaResetsIn: "重置于",
			effectiveQuota: "综合余量",
			quotaUnavailable: "配额不可用",
			searchAccountsPlaceholder: "搜索账号 / 项目…",
			hideExhausted: "仅看可用",
			compactView: "紧凑视图",
			sortBy: "排序",
			sortDefault: "默认排序",
			sortQuota: "配额充裕优先",
			totalLabel: "共",
			availableLabel: "个可用",
			exhaustedLabel: "个耗尽",
			noMatchingAccounts: "未找到匹配的账号",
			activeBadge: "当前",
			quotaWeeklyShort: "周",
			authStatus: "授权与登录",
			web2apiTitle: "Gemini Web2API 网页网关 (可选)",
			web2apiHelp: "接入自建的 Gemini 网页反代服务（gemini-web2api-go）。提供可选的 Imagen 3 生图与网页端专属模型，无需 Google Cloud 账号。",
			web2apiEnable: "启用 Web2API 网关",
			web2apiBaseUrl: "网关服务地址 (Base URL)",
			web2apiApiKey: "访问密钥 (可选)",
			web2apiImageTool: "启用图片生成工具 (Imagen 3)",
			web2apiTest: "测试连通性",
			web2apiTesting: "正在测试…",
			web2apiSave: "保存 Web2API 配置",
			web2apiSaving: "正在保存…",
			web2apiSaved: "Web2API 配置已保存。",
			web2apiCredit: "基于 zexadev/gemini-web2api-go 开源项目",
			web2apiConnected: "连接成功 (延迟: {latency}ms)",
			web2apiFailed: "连接失败: {error}",
			tabAccounts: "账号",
			tabWeb2api: "Web2API 网页网关",
			tabNetwork: "网络",
			clearSearch: "清空搜索",
			saveFailed: "保存配置失败。",
			unknownError: "未知错误",
			presetLocal: "本地默认 (127.0.0.1:18088)",
			presetDocker: "Docker 默认 (localhost:18088)",
			gatewayStatus: "网关状态：",
			statusConnected: "已连接",
			statusDisabled: "未启用",
			statusError: "连接异常",
			filterAll: "全部",
			filterAvailable: "可用",
			filterExhausted: "耗尽",
			creditTitle: "开源致谢",
			creditBody: "Web2API 逆向协议设计与特性对接基于 zexadev/gemini-web2api-go 开源项目。",
			visitRepo: "访问 GitHub 仓库",
			detectService: "自动探测本地网关",
			detecting: "探测中…",
			detectedSuccess: "在 {url} 成功连通网关 ({latency}ms)",
			detectedNotFound: "在 127.0.0.1:18088 未探测到运行中的服务，请先启动 Docker 容器或二进制。",
			dockerOneLiner: "Docker 一键运行命令：",
			copyCommand: "复制",
			copied: "已复制！",
			quickSetupTitle: "快速部署与接入指引 (Plan C)",
			quickSetupDesc: "本地使用 Docker 或独立二进制运行 gemini-web2api-go，自带 Chrome 146 TLS 指纹绕过 Google 盾。",
			step1Title: "第一步：启动容器",
			step1Desc: "在本地 18088 端口运行免配逆向网关服务：",
			step2Title: "第二步：一键连通",
			step2Desc: "点击自动探测并绑定本地网关：",
			accountSwitched: "已成功切换至 {email}",
			resetsIn: "{time} 后重置",
			dismissNotice: "隐藏此提示",
			showGuide: "查看快速部署指南",
			hideGuide: "隐藏指南",
			sortDefaultShort: "默认排序",
			sortQuotaShort: "按配额排序",
			tabAdvanced: "高级",
			modelTuningTitle: "模型推理与上下文微调",
			modelTuningDesc: "微调默认思维链深度与上下文窗口门限。",
			defaultReasoningEffort: "默认思考深度",
			effortLow: "低 (Low)",
			effortMedium: "中 (Medium - 默认)",
			effortHigh: "高 (High)",
			modelContextWindow: "上下文窗口上限",
			contextWindow1M: "1M (全量默认)",
			contextWindow512K: "512K",
			contextWindow256K: "256K",
			contextWindow128K: "128K",
			switchingStrategyTitle: "多策略账号轮换",
			switchingStrategyDesc: "管理在生成过程中账号自动切换的策略与时机。",
			strategyFailover: "429 耗尽故障转移 (默认)",
			strategyProactive: "配额低阈值主动轮换",
			strategyRoundRobin: "轮询负载均衡",
			strategyManual: "纯手动锁定",
			thresholdLabel: "配额低于 {threshold}% 时自动切换",
			saveAdvanced: "保存高级配置",
			advancedSaved: "高级配置已保存。",
			quotaFullyAvailable: "全满可用"
		};
		//#endregion
		//#region src/client/index.tsx
		const name = "dsh-antigravity-oauth-client";
		const inject = ["slots", "locale"];
		function apply(ctx) {
			const namespace = "settings.antigravity-oauth";
			ctx.effect(() => ctx.locale.register(namespace, {
				zh,
				en
			}), "dsh-antigravity-oauth: settings copy");
			const t = ctx.locale.bind(namespace);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "antigravity-oauth",
				order: 18,
				label: () => t("nav"),
				inject: () => ({ t })
			}, AntigravitySettings));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map