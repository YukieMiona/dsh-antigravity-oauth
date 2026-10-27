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
		const NETWORK_PATH = "/plugins/dsh-antigravity-oauth/network";
		const WEB2API_SETTINGS_PATH = "/plugins/dsh-antigravity-oauth/web2api/settings";
		const WEB2API_TEST_PATH = "/plugins/dsh-antigravity-oauth/web2api/test";
		const STYLE_ID = "dsh-antigravity-oauth-settings-theme";
		const DOCKER_CMD = "docker run -d --name gemini-web2api -p 18088:18088 zexadev/gemini-web2api-go:latest";
		const DISMISSED_NOTICE_KEY = "dsh-antigravity-oauth.dismissed-notice";
		const SETTINGS_CSS = `
.dsh-agy-page { display:flex; flex-direction:column; gap:12px; width:100%; max-width:820px; color:#e0e0e0; font-family:inherit; position:relative; scrollbar-gutter:stable; }

/* Top Header with Unified Action Bar (NO AWKWARD 2ND ROW) */
.dsh-agy-header {
  display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:2px;
}
.dsh-agy-header-left { display:flex; align-items:center; gap:12px; }
.dsh-agy-title { margin:0; font-size:18px; line-height:24px; font-weight:600; color:#ffffff; }

/* Header Actions Toolbar */
.dsh-agy-header-actions {
  display:flex; align-items:center; gap:8px; margin-left:auto;
}

/* Floating Notification */
.dsh-agy-toast-float {
  position:fixed; top:24px; right:24px; z-index:9999;
  display:flex; align-items:center; gap:8px;
  padding:10px 16px; border-radius:8px;
  background:#1a231e; border:1px solid #41c977;
  color:#41c977; font-size:13px; font-weight:500;
  box-shadow:0 8px 24px rgba(0,0,0,0.4);
  animation:dsh-agy-fadein 0.2s ease-out;
}
@keyframes dsh-agy-fadein { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }

/* Dismissible Description Banner */
.dsh-agy-notice-banner {
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:8px 12px; border-radius:8px;
  background:#1e2023; border:1px solid rgba(255,255,255,0.06);
}
.dsh-agy-notice-close {
  background:none; border:none; color:#9a9ea5; cursor:pointer;
  font-size:16px; line-height:1; padding:2px 6px; border-radius:4px;
}
.dsh-agy-notice-close:hover { color:#ffffff; background:rgba(255,255,255,0.08); }

/* Navigation Tabs */
.dsh-agy-tabs-container {
  display:inline-flex; align-items:center; gap:4px; padding:3px;
  background:#1a1c1e !important;
  border:1px solid rgba(255,255,255,0.1) !important;
  border-radius:10px; width:fit-content;
}
.dsh-agy-tab-btn {
  display:inline-flex; align-items:center; gap:6px; padding:6px 14px;
  border:none !important; border-radius:7px !important;
  background:transparent !important;
  color:#9a9ea5 !important; font:inherit; font-size:13px; font-weight:500;
  cursor:pointer; transition:all 0.15s ease; user-select:none;
}
.dsh-agy-tab-btn:hover { color:#ffffff !important; background:rgba(255,255,255,0.06) !important; }
.dsh-agy-tab-btn.is-active {
  color:#ffffff !important; background:#1677ff !important;
  box-shadow:0 2px 6px rgba(22, 119, 255, 0.4) !important;
  font-weight:600 !important;
}
.dsh-agy-tab-count {
  font-size:11px; padding:1px 6px; border-radius:10px;
  background:rgba(255,255,255,0.15); color:#ffffff;
}

/* Status Badges */
.dsh-agy-status-badge {
  display:inline-flex; align-items:center; gap:5px; padding:2px 8px; border-radius:10px;
  font-size:11px; font-weight:500; background:rgba(255,255,255,0.08); color:#a0a0a0;
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
  border:1px solid #1677ff !important; box-shadow:0 1px 3px rgba(0,0,0,0.2); font-weight:500;
}
.dsh-agy-btn-primary:hover:not(:disabled) { background:#0958d9 !important; border-color:#0958d9 !important; }
.dsh-agy-btn-secondary {
  border:1px solid rgba(255,255,255,0.12) !important;
  background:#2b2d30 !important; color:#f0f0f0 !important;
}
.dsh-agy-btn-secondary:hover:not(:disabled) {
  background:#383b40 !important; border-color:#1677ff !important; color:#ffffff !important;
}
.dsh-agy-btn-compact { min-height:22px; padding:1px 8px; font-size:11px; border-radius:4px; }

/* Inputs with Scrollbar-Gutter Protection */
.dsh-agy-input {
  box-sizing:border-box; width:100%; min-height:30px; padding:4px 8px; border-radius:6px;
  border:1px solid rgba(255,255,255,0.12);
  background:#141517; color:#f0f0f0;
  font:inherit; font-size:12px; outline:none; transition:border-color 0.15s ease;
}
.dsh-agy-input:focus { border-color:#1677ff; }
.dsh-agy-select {
  box-sizing:border-box; min-height:26px; padding:2px 8px; border-radius:6px;
  border:1px solid rgba(255,255,255,0.12);
  background:#141517; color:#f0f0f0;
  font:inherit; font-size:11px; cursor:pointer; outline:none;
}

/* Accounts List Container with Stable Scrollbar */
.dsh-agy-account-list {
  max-height:540px; overflow-y:auto; padding-right:2px; display:flex; flex-direction:column; gap:6px;
  scrollbar-gutter:stable;
}
.dsh-agy-account {
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:8px 12px; border-radius:8px;
  border:1px solid rgba(255,255,255,0.08);
  background:rgba(255,255,255,0.02); transition:all 0.15s ease;
  overflow:hidden; cursor:pointer;
}
.dsh-agy-account:hover { background:rgba(255,255,255,0.04); }
.dsh-agy-account.is-active {
  border-color:#1677ff;
  background:rgba(22, 119, 255, 0.08);
}

/* Compact mode: single row */
.dsh-agy-account.is-compact {
  padding:3px 10px; min-height:28px; gap:8px;
}
.dsh-agy-account-main {
  display:flex; align-items:center; gap:8px; flex:1 1 0; min-width:0; overflow:hidden;
}
.dsh-agy-account-mail {
  font-size:13px; font-weight:500; color:#f0f0f0;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.dsh-agy-account.is-compact .dsh-agy-account-mail { font-size:12px; }

/* Metrics container */
.dsh-agy-account-metrics {
  display:flex; align-items:center; gap:8px; flex:0 0 auto;
}

/* Default Quota Capsule */
.dsh-agy-capsule-bar {
  box-sizing:border-box; width:135px; display:flex; flex-direction:column;
  gap:2px; padding:3px 8px; border-radius:6px;
  background:rgba(255,255,255,0.06); color:#b0b4ba;
  user-select:none;
}
.dsh-agy-capsule-header {
  display:flex; align-items:center; justify-content:space-between; width:100%; font-size:11px;
}
.dsh-agy-capsule-progress {
  width:44px; height:6px; border-radius:3px; background:rgba(255,255,255,0.15); overflow:hidden; flex:0 0 44px;
}
.dsh-agy-capsule-fill { height:100%; border-radius:3px; transition:width 0.3s ease; }
.dsh-agy-capsule-fill.is-high { background:#41c977; }
.dsh-agy-capsule-fill.is-med { background:#fa8c16; }
.dsh-agy-capsule-fill.is-low { background:#f25a5a; }
.dsh-agy-capsule-reset {
  font-size:10px; opacity:0.75; line-height:12px; white-space:nowrap;
}

/* Compact Quota Capsule: Strictly Synchronized Single Line for Both 5h & Weekly */
.dsh-agy-account.is-compact .dsh-agy-capsule-bar {
  width:95px; height:22px; flex-direction:row; align-items:center; justify-content:space-between;
  padding:2px 6px; gap:4px;
}
.dsh-agy-account.is-compact .dsh-agy-capsule-header {
  display:flex; align-items:center; justify-content:space-between; width:100%; font-size:10px;
}
.dsh-agy-account.is-compact .dsh-agy-capsule-progress {
  width:32px; height:5px; flex:0 0 32px;
}
.dsh-agy-account.is-compact .dsh-agy-capsule-reset {
  display:none;
}

/* Stepper Card (Plan C) */
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
		function formatReset(iso) {
			if (!iso) return "";
			const t = new Date(iso).getTime() - Date.now();
			if (t <= 0) return "0m";
			const m = Math.floor(t / 6e4);
			const h = Math.floor(m / 60);
			const d = Math.floor(h / 24);
			if (d > 0) return d + "d";
			if (h > 0) return h + "h" + m % 60 + "m";
			return m + "m";
		}
		/**
		* Disambiguates between Gemini models vs 3P models (Claude/GPT).
		* Always prioritizes Gemini buckets to match antigravity_quota.mjs.
		*/
		function getAccountQuotaMetrics(quota) {
			if (!quota?.ok || !quota.groups) return void 0;
			const allBuckets = quota.groups.flatMap((g) => g.buckets);
			const b5h = allBuckets.find((b) => b.window === "5h" && /^gemini[-_]/i.test(b.bucketId)) ?? allBuckets.find((b) => b.window === "5h");
			const bWeekly = allBuckets.find((b) => b.window === "weekly" && /^gemini[-_]/i.test(b.bucketId)) ?? allBuckets.find((b) => b.window === "weekly");
			if (!b5h && !bWeekly) return void 0;
			const f5h = b5h?.remainingFraction;
			const fWeekly = bWeekly?.remainingFraction;
			return {
				b5h,
				bWeekly,
				p5h: f5h !== void 0 ? Math.round(f5h * 100) : void 0,
				pWeekly: fWeekly !== void 0 ? Math.round(fWeekly * 100) : void 0,
				isExhausted: (b5h ? f5h !== void 0 ? f5h <= 0 : false : true) && (bWeekly ? fWeekly !== void 0 ? fWeekly <= 0 : false : true) && (!!b5h || !!bWeekly),
				score: Math.min(f5h !== void 0 ? f5h * 100 : 100, fWeekly !== void 0 ? fWeekly * 100 : 100),
				reset5h: b5h?.resetTime ? formatReset(b5h.resetTime) : "",
				resetWeekly: bWeekly?.resetTime ? formatReset(bWeekly.resetTime) : ""
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
			const response = await fetch(path, {
				method,
				headers: {
					accept: "application/json",
					...body === void 0 ? {} : { "content-type": "application/json" }
				},
				credentials: "same-origin",
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
			const [noticeDismissed, setNoticeDismissed] = (0, react.useState)(() => {
				if (typeof localStorage !== "undefined") return localStorage.getItem(DISMISSED_NOTICE_KEY) === "true";
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
				try {
					const res = await jsonRequest(QUOTAS_PATH);
					if (res?.quotas) setQuotas(res.quotas);
				} catch {} finally {
					setLoadingQuotas(false);
				}
			}, []);
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
			}, [
				refresh,
				refreshQuotas,
				loadNetwork,
				loadWeb2Api
			]);
			const dismissNotice = () => {
				setNoticeDismissed(true);
				if (typeof localStorage !== "undefined") localStorage.setItem(DISMISSED_NOTICE_KEY, "true");
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
							className: "dsh-agy-header-left",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
									id: "antigravity-settings-title",
									className: "dsh-agy-title",
									children: t("title")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dsh-agy-dot " + (signing ? "is-signing-in" : activeAccount?.ready ? "is-signed-in" : "is-error") }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									style: {
										fontSize: "12px",
										color: "#9a9ea5"
									},
									children: signing ? t("signingIn") : activeAccount ? activeAccount.email ?? activeAccount.id : t("signedOut")
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsh-agy-header-actions",
							children: activeTab === "accounts" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									style: {
										display: "inline-flex",
										alignItems: "center",
										gap: "4px",
										fontSize: "11px",
										cursor: "pointer",
										color: "#b0b4ba",
										marginRight: "4px"
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: compactView,
										onChange: (e) => setCompactView(e.target.checked)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("compactView") })]
								}),
								signing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
									onClick: () => {
										recover("cancel");
									},
									children: t("cancel")
								}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact",
									disabled: busy,
									onClick: () => {
										signIn();
									},
									children: busy ? t("working") : accounts.length === 0 ? t("login") : t("addAccount")
								}),
								accounts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
									disabled: busy || loadingQuotas,
									onClick: () => {
										refreshQuotas();
									},
									children: loadingQuotas ? t("working") : t("refreshQuotas")
								}) : null
							] }) : null
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							gap: "8px"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("nav", {
							className: "dsh-agy-tabs-container",
							role: "tablist",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "tab",
									"aria-selected": activeTab === "accounts",
									className: "dsh-agy-tab-btn " + (activeTab === "accounts" ? "is-active" : ""),
									onClick: () => setActiveTab("accounts"),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("tabAccounts") }), accounts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh-agy-tab-count",
										children: accounts.length
									}) : null]
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
						}), activeTab === "accounts" && accounts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: {
								display: "flex",
								alignItems: "center",
								gap: "6px"
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								className: "dsh-agy-select",
								value: sortBy,
								onChange: (e) => setSortBy(e.target.value),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "default",
									children: t("sortDefault")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "quota",
									children: t("sortQuota")
								})]
							})
						}) : null]
					}),
					!noticeDismissed && !compactView ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-agy-notice-banner",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsh-agy-body",
							style: { margin: 0 },
							children: t("tos")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh-agy-notice-close",
							title: t("dismissNotice"),
							onClick: dismissNotice,
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
							gap: "8px"
						},
						children: [
							accounts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									flexDirection: "column",
									gap: "6px"
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										position: "relative",
										width: "100%"
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
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsh-agy-account-list",
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
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsh-agy-account " + (isActive ? "is-active " : "") + (compactView ? "is-compact" : ""),
											onClick: () => {
												if (!isActive && !switchingId) switchAccount(account);
											},
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsh-agy-account-main",
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
														gap: "1px",
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
															!isSwitching && isActive ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "dsh-agy-status-badge is-success",
																children: t("activeBadge")
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
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsh-agy-account-metrics",
												onClick: (e) => e.stopPropagation(),
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "dsh-agy-capsule-bar",
														title: "5h Window: " + (p5h !== void 0 ? p5h + "%" : "--") + (metrics?.reset5h ? " (" + metrics.reset5h + ")" : ""),
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: "dsh-agy-capsule-header",
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
																t("quota5h"),
																" ",
																p5h !== void 0 ? p5h + "%" : "--"
															] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																className: "dsh-agy-capsule-progress",
																children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																	className: "dsh-agy-capsule-fill " + ((p5h ?? 0) > 40 ? "is-high" : (p5h ?? 0) > 15 ? "is-med" : "is-low"),
																	style: { width: (p5h ?? 0) + "%" }
																})
															})]
														}), !compactView && metrics?.reset5h ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dsh-agy-capsule-reset",
															children: t("resetsIn", { time: metrics.reset5h })
														}) : null]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "dsh-agy-capsule-bar",
														title: "Weekly Budget: " + (pWeekly !== void 0 ? pWeekly + "%" : "--") + (metrics?.resetWeekly ? " (" + metrics.resetWeekly + ")" : ""),
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
															className: "dsh-agy-capsule-header",
															children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
																t("quotaWeeklyShort"),
																" ",
																pWeekly !== void 0 ? pWeekly + "%" : "--"
															] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																className: "dsh-agy-capsule-progress",
																children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																	className: "dsh-agy-capsule-fill " + ((pWeekly ?? 0) > 40 ? "is-high" : (pWeekly ?? 0) > 15 ? "is-med" : "is-low"),
																	style: { width: (pWeekly ?? 0) + "%" }
																})
															})]
														}), !compactView && metrics?.resetWeekly ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dsh-agy-capsule-reset",
															children: t("resetsIn", { time: metrics.resetWeekly })
														}) : null]
													}),
													!compactView ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														style: {
															width: "60px",
															display: "flex",
															justifyContent: "flex-end",
															flexShrink: 0
														},
														children: !isActive ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
															disabled: busy || Boolean(switchingId),
															onClick: () => {
																removeAccount(account.id);
															},
															children: t("removeAccount")
														}) : null
													}) : null
												]
											})]
										}, account.id);
									})
								})]
							}) : null,
							signing && status?.url ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									padding: "12px",
									borderRadius: "8px",
									background: "#1e2023",
									border: "1px solid rgba(255,255,255,0.08)"
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: "dsh-agy-body",
									children: [
										t("openUrl"),
										" ",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
											href: status.url,
											target: "_blank",
											rel: "noreferrer",
											style: {
												color: "#1677ff",
												textDecoration: "underline"
											},
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
					activeTab === "web2api" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							flexDirection: "column",
							gap: "14px"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: { fontSize: "16px" },
												children: "🚀"
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												style: {
													fontSize: "14px",
													fontWeight: 600,
													color: "#fff"
												},
												children: t("quickSetupTitle")
											})]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh-agy-status-badge is-success",
											children: "Docker / Binary Ready"
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
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									flexDirection: "column",
									gap: "12px",
									padding: "14px 16px",
									borderRadius: "10px",
									background: "#1e2023",
									border: "1px solid rgba(255,255,255,0.08)"
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: {
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											flexWrap: "wrap",
											gap: "8px"
										},
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											style: {
												display: "flex",
												alignItems: "center",
												gap: "8px"
											},
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dsh-agy-dot " + (web2apiEnabled ? "is-signed-in" : "") }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													style: {
														fontSize: "14px",
														fontWeight: 600,
														color: "#fff"
													},
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
												fontSize: "12px"
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
											marginTop: "2px"
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
															fontSize: "11px",
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
													fontSize: "11px",
													display: "block",
													marginBottom: "4px",
													fontWeight: 500,
													color: "#b0b4ba"
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
													fontSize: "11px",
													display: "block",
													marginBottom: "4px",
													fontWeight: 500,
													color: "#b0b4ba"
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
													fontSize: "12px"
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
												className: web2apiFeedback.ok ? "dsh-agy-toast-float" : "dsh-agy-error",
												style: {
													marginTop: "2px",
													fontSize: "11px"
												},
												children: web2apiFeedback.msg
											}) : null
										]
									}) : null
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									flexDirection: "column",
									gap: "6px",
									padding: "12px 14px",
									borderRadius: "8px",
									border: "1px solid rgba(255,255,255,0.06)"
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									style: {
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between"
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										style: {
											fontSize: "12px",
											fontWeight: 600,
											color: "#fff"
										},
										children: t("creditTitle")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("a", {
										href: "https://github.com/zexadev/gemini-web2api-go",
										target: "_blank",
										rel: "noreferrer",
										style: {
											fontSize: "11px",
											color: "#1677ff",
											textDecoration: "none"
										},
										children: [t("visitRepo"), " →"]
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsh-agy-body",
									style: { fontSize: "11px" },
									children: t("creditBody")
								})]
							})
						]
					}) : null,
					activeTab === "network" && network ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							flexDirection: "column",
							gap: "12px",
							padding: "14px 16px",
							borderRadius: "10px",
							background: "#1e2023",
							border: "1px solid rgba(255,255,255,0.08)"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: {
									fontSize: "14px",
									fontWeight: 600,
									color: "#fff"
								},
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
									marginTop: "4px"
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										style: {
											fontSize: "11px",
											display: "flex",
											flexDirection: "column",
											gap: "4px",
											color: "#b0b4ba"
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
											fontSize: "11px",
											display: "block",
											marginBottom: "4px",
											color: "#b0b4ba"
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
										style: { fontSize: "11px" },
										children: [
											t("effectiveNetwork"),
											" ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
												style: { color: "#58a6ff" },
												children: network.effective || "direct"
											})
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
										className: "dsh-agy-toast-float",
										style: { fontSize: "11px" },
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
			refreshQuotas: "Refresh quotas",
			quota5h: "5h limit",
			quotaWeekly: "Weekly limit",
			quotaResetsIn: "Resets in",
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
			tabAccounts: "Accounts & Quota",
			tabWeb2api: "Web2API Gateway",
			tabNetwork: "Network & Proxy",
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
			refreshQuotas: "刷新配额",
			quota5h: "5小时滚动",
			quotaWeekly: "每周总额度",
			quotaResetsIn: "重置于",
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
			tabAccounts: "账号与配额",
			tabWeb2api: "Web2API 网页网关",
			tabNetwork: "网络与代理",
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
			dismissNotice: "隐藏此提示"
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