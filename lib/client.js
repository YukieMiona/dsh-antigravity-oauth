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
		const LOGOUT_PATH = "/plugins/dsh-antigravity-oauth/auth/logout";
		const SWITCH_PATH = "/plugins/dsh-antigravity-oauth/auth/accounts/switch";
		const REMOVE_PATH = "/plugins/dsh-antigravity-oauth/auth/accounts/remove";
		const QUOTAS_PATH = "/plugins/dsh-antigravity-oauth/auth/accounts/quotas";
		const POLL_INTERVAL_MS = 1e3;
		const STYLE_ID = "dsh-antigravity-oauth-settings-theme";
		const NETWORK_PATH = "/plugins/dsh-antigravity-oauth/network";
		const SETTINGS_CSS = `
.dsh-agy-page { display:flex; flex-direction:column; gap:16px; max-width:640px; color:var(--dsw-alias-label-primary); }
.dsh-agy-title { margin:0; font-size:20px; line-height:28px; font-weight:600; color:var(--dsw-alias-label-primary); }
.dsh-agy-body { margin:0; font-size:13px; line-height:20px; color:var(--dsw-alias-label-secondary); }
.dsh-agy-error { margin:0; font-size:13px; line-height:20px; color:var(--dsw-alias-state-error-primary); }
.dsh-agy-card {
  display:flex; flex-direction:column; gap:8px; padding:14px 16px;
  border:1px solid var(--dsw-alias-border-l2); border-radius:12px;
  background:var(--dsw-alias-bg-module-platform);
}
.dsh-agy-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; }
.dsh-agy-name { margin:0; font-size:15px; font-weight:600; color:var(--dsw-alias-label-primary); }
.dsh-agy-status { display:flex; align-items:center; flex-wrap:wrap; gap:6px; font-size:13px; color:var(--dsw-alias-label-secondary); }
.dsh-agy-dot { width:8px; height:8px; border-radius:50%; flex:0 0 auto; background:var(--dsw-alias-label-dimmed, #9aa0a6); }
.dsh-agy-dot.is-signed-in { background:var(--dsw-alias-state-success-primary, #22a06b); }
.dsh-agy-dot.is-error { background:var(--dsw-alias-state-error-primary, #d92d20); }
.dsh-agy-dot.is-signing-in { background:var(--dsw-alias-brand-primary, #1677ff); }
.dsh-agy-btn {
  box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center;
  min-height:32px; padding:4px 14px; border-radius:16px; font:inherit; font-size:13px; line-height:20px; cursor:pointer;
}
.dsh-agy-btn:disabled { opacity:0.55; cursor:not-allowed; }
.dsh-agy-btn-secondary {
  border:1px solid var(--dsw-alias-border-l2);
  background:transparent;
  color:var(--dsw-alias-label-primary);
}
.dsh-agy-btn-primary {
  border:none;
  background:var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary));
  color:var(--dsw-alias-label-primary-foreground, #fff);
}
.dsh-agy-link { color:var(--dsw-alias-brand-primary); word-break:break-all; }
.dsh-agy-form { display:flex; flex-direction:column; gap:8px; }
.dsh-agy-input {
  box-sizing:border-box; width:100%; min-height:36px; padding:7px 10px;
  border:1px solid var(--dsw-alias-border-l2); border-radius:8px;
  background:var(--dsw-alias-bg-page-primary, transparent);
  color:var(--dsw-alias-label-primary); font:inherit; font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.dsh-agy-actions { display:flex; justify-content:flex-end; }
.dsh-agy-summary-bar {
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  padding:6px 12px; border-radius:8px; font-size:12px;
  background:var(--dsw-alias-bg-page-primary, rgba(0,0,0,0.02));
  border:1px solid var(--dsw-alias-border-l2);
  color:var(--dsw-alias-label-secondary);
}
.dsh-agy-summary-badge {
  display:inline-flex; align-items:center; gap:4px;
}
.dsh-agy-summary-badge.is-available {
  color:var(--dsw-alias-state-success-primary, #22a06b); font-weight:500;
}
.dsh-agy-summary-badge.is-exhausted {
  color:var(--dsw-alias-state-error-primary, #d92d20); font-weight:500;
}
.dsh-agy-toolbar {
  display:flex; flex-direction:column; gap:8px;
}
.dsh-agy-search-box {
  position:relative; display:flex; align-items:center; width:100%;
}
.dsh-agy-search-input {
  box-sizing:border-box; width:100%; min-height:32px; padding:5px 28px 5px 10px;
  border:1px solid var(--dsw-alias-border-l2); border-radius:8px;
  background:var(--dsw-alias-bg-page-primary, transparent);
  color:var(--dsw-alias-label-primary); font:inherit; font-size:12px;
}
.dsh-agy-search-clear {
  position:absolute; right:6px; background:none; border:none;
  cursor:pointer; color:var(--dsw-alias-label-secondary); font-size:14px;
  padding:2px 6px; line-height:1;
}
.dsh-agy-controls {
  display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; font-size:12px;
  color:var(--dsw-alias-label-secondary);
}
.dsh-agy-filters {
  display:flex; align-items:center; gap:12px; flex-wrap:wrap;
}
.dsh-agy-check-label {
  display:inline-flex; align-items:center; gap:5px; cursor:pointer; user-select:none;
}
.dsh-agy-check-label input[type="checkbox"] {
  accent-color:var(--dsw-alias-brand-primary, #1677ff); cursor:pointer; margin:0;
}
.dsh-agy-sort {
  display:inline-flex; align-items:center; gap:6px; margin-left:auto;
}
.dsh-agy-select {
  box-sizing:border-box; min-height:26px; padding:2px 8px; border-radius:6px;
  border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-page-primary, transparent);
  color:var(--dsw-alias-label-primary); font:inherit; font-size:12px; cursor:pointer;
}
.dsh-agy-account-list {
  max-height:480px; overflow-y:auto; padding-right:4px;
  display:flex; flex-direction:column; gap:8px;
}
.dsh-agy-empty-tip {
  padding:16px; text-align:center; font-size:13px;
  color:var(--dsw-alias-label-secondary);
  border:1px dashed var(--dsw-alias-border-l2); border-radius:8px;
}
.dsh-agy-account {
  display:flex; align-items:center; gap:8px; flex-wrap:wrap;
  padding:8px 10px; border:1px solid var(--dsw-alias-border-l2); border-radius:8px;
}
.dsh-agy-account.is-active {
  border-color:var(--dsw-alias-brand-primary, #1677ff);
  background:var(--dsw-alias-brand-primary-faint, rgba(22, 119, 255, 0.04));
}
.dsh-agy-account-main { display:flex; align-items:center; gap:8px; flex:1 1 auto; min-width:0; cursor:pointer; }
.dsh-agy-account-main input[type="radio"] { accent-color:var(--dsw-alias-brand-primary, #1677ff); }
.dsh-agy-account-mail { font-size:13px; color:var(--dsw-alias-label-primary); word-break:break-all; }
.dsh-agy-badges { display:inline-flex; gap:6px; flex-wrap:wrap; align-items:center; }
.dsh-agy-badge {
  display:inline-flex; align-items:center; padding:1px 8px; border-radius:10px;
  font-size:12px; line-height:18px;
  border:1px solid var(--dsw-alias-border-l2); color:var(--dsw-alias-label-secondary);
}
.dsh-agy-badge.is-error {
  border-color:var(--dsw-alias-state-error-primary, #d92d20);
  color:var(--dsw-alias-state-error-primary, #d92d20);
}
.dsh-agy-badge.is-active {
  border-color:var(--dsw-alias-brand-primary, #1677ff);
  color:var(--dsw-alias-brand-primary, #1677ff);
  font-weight:600;
}
.dsh-agy-quota-capsule {
  display:inline-flex; align-items:center; gap:4px;
  padding:1px 8px; border-radius:10px; font-size:11px; line-height:18px;
  border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-page-primary, rgba(0,0,0,0.02));
  font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}
.dsh-agy-quota-capsule.is-high {
  border-color:rgba(34,160,107,0.3); color:var(--dsw-alias-state-success-primary, #22a06b);
}
.dsh-agy-quota-capsule.is-med {
  border-color:rgba(245,158,11,0.3); color:#d97706;
}
.dsh-agy-quota-capsule.is-low {
  border-color:rgba(217,45,32,0.3); color:var(--dsw-alias-state-error-primary, #d92d20);
}
.dsh-agy-remove { margin-left:auto; }
.dsh-agy-quota-box {
  width:100%; display:flex; flex-direction:column; gap:6px;
  padding:8px 10px; margin-top:4px; border-radius:6px;
  background:var(--dsw-alias-bg-page-primary, rgba(0,0,0,0.03));
  border:1px dashed var(--dsw-alias-border-l2);
}
.dsh-agy-quota-grid { display:flex; flex-wrap:wrap; gap:14px; align-items:center; }
.dsh-agy-quota-item { display:inline-flex; align-items:center; gap:6px; font-size:12px; }
.dsh-agy-quota-bar {
  width:64px; height:6px; border-radius:3px;
  background:var(--dsw-alias-border-l2, #e5e7eb); overflow:hidden;
}
.dsh-agy-quota-fill { height:100%; border-radius:3px; }
.dsh-agy-quota-fill.is-high { background:var(--dsw-alias-state-success-primary, #22a06b); }
.dsh-agy-quota-fill.is-med { background:#f59e0b; }
.dsh-agy-quota-fill.is-low { background:var(--dsw-alias-state-error-primary, #d92d20); }
`;
		function formatReset(iso) {
			if (!iso) return "";
			const t = new Date(iso).getTime() - Date.now();
			if (t <= 0) return "";
			const h = Math.floor(t / 36e5);
			const m = Math.floor(t % 36e5 / 6e4);
			if (h >= 24) return `${Math.floor(h / 24)}d`;
			return `${h}h${m}m`;
		}
		function getAccountQuotaMetrics(quota) {
			if (!quota?.ok || !quota.groups) return void 0;
			const buckets = quota.groups.flatMap((g) => g.buckets).filter((b) => b.window === "5h" || b.window === "weekly");
			const b5h = buckets.find((b) => b.window === "5h");
			const bWeekly = buckets.find((b) => b.window === "weekly");
			if (!b5h && !bWeekly) return void 0;
			const f5h = b5h?.remainingFraction;
			const fWeekly = bWeekly?.remainingFraction;
			const p5h = f5h !== void 0 ? Math.round(f5h * 1e3) / 10 : void 0;
			const pWeekly = fWeekly !== void 0 ? Math.round(fWeekly * 1e3) / 10 : void 0;
			const is5hExhausted = f5h !== void 0 ? f5h <= 0 : false;
			const isWeeklyExhausted = fWeekly !== void 0 ? fWeekly <= 0 : false;
			const isExhausted = (b5h ? is5hExhausted : true) && (bWeekly ? isWeeklyExhausted : true) && (!!b5h || !!bWeekly);
			const score = Math.min(
				f5h !== void 0 ? f5h * 100 : 100,
				fWeekly !== void 0 ? fWeekly * 100 : 100
			);
			const reset5h = b5h ? formatReset(b5h.resetTime) : "";
			const resetWeekly = bWeekly ? formatReset(bWeekly.resetTime) : "";
			return {
				b5h,
				bWeekly,
				p5h,
				pWeekly,
				isExhausted,
				score,
				reset5h,
				resetWeekly
			};
		}
		function ensureThemeStyles() {
			if (typeof document === "undefined") return;
			if (document.getElementById(STYLE_ID) !== null) return;
			const style = document.createElement("style");
			style.id = STYLE_ID;
			style.textContent = SETTINGS_CSS;
			document.head.appendChild(style);
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
				const message = typeof value === "object" && value !== null && "error" in value && typeof value.error === "string" ? value.error : `HTTP ${response.status}`;
				throw new Error(message);
			}
			return value;
		}
		function AntigravitySettings({ t }) {
			if (t === void 0) throw new Error("Antigravity settings requires its translation function");
			const [status, setStatus] = (0, react.useState)(void 0);
			const [error, setError] = (0, react.useState)(void 0);
			const [busy, setBusy] = (0, react.useState)(false);
			const [draft, setDraft] = (0, react.useState)("");
			const [network, setNetwork] = (0, react.useState)();
			const [networkMessage, setNetworkMessage] = (0, react.useState)("");
			const [quotas, setQuotas] = (0, react.useState)({});
			const [loadingQuotas, setLoadingQuotas] = (0, react.useState)(false);
			const [searchQuery, setSearchQuery] = (0, react.useState)("");
			const [hideExhausted, setHideExhausted] = (0, react.useState)(false);
			const [compactView, setCompactView] = (0, react.useState)(false);
			const [sortBy, setSortBy] = (0, react.useState)("default");
			(0, react.useEffect)(() => {
				ensureThemeStyles();
			}, []);
			const refreshQuotas = (0, react.useCallback)(async () => {
				setLoadingQuotas(true);
				try {
					const res = await jsonRequest(QUOTAS_PATH);
					if (res?.quotas) setQuotas(res.quotas);
				} catch {} finally {
					setLoadingQuotas(false);
				}
			}, []);
			const refresh = (0, react.useCallback)(async () => {
				try {
					setStatus(await jsonRequest(STATUS_PATH));
					setError(void 0);
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				}
			}, [t]);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			(0, react.useEffect)(() => {
				refreshQuotas();
			}, [refreshQuotas]);
			(0, react.useEffect)(() => {
				jsonRequest(NETWORK_PATH).then(setNetwork).catch((err) => setError(String(err)));
			}, []);
			const signing = status?.status === "signing-in";
			(0, react.useEffect)(() => {
				if (!signing) return;
				const timer = window.setInterval(() => {
					refresh();
				}, POLL_INTERVAL_MS);
				return () => {
					window.clearInterval(timer);
				};
			}, [refresh, signing]);
			const signIn = async () => {
				const popup = window.open("about:blank", "_blank");
				if (popup !== null) popup.opener = null;
				setBusy(true);
				try {
					const challenge = await jsonRequest(LOGIN_PATH, "POST", {});
					if (popup !== null && challenge.url !== void 0) popup.location.replace(challenge.url);
					if (popup === null && challenge.url !== void 0) window.open(challenge.url, "_blank", "noopener,noreferrer");
					if (popup !== null && challenge.url === void 0) popup.close();
					await refresh();
				} catch (caught) {
					popup?.close();
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				} finally {
					setBusy(false);
				}
			};
			const complete = async () => {
				const value = draft.trim();
				if (value.length === 0) return;
				setBusy(true);
				try {
					await jsonRequest(COMPLETE_PATH, "POST", { url: value });
					setDraft("");
					await refresh();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				} finally {
					setBusy(false);
				}
			};
			const removeAccount = async (id) => {
				setBusy(true);
				try {
					const result = await jsonRequest(REMOVE_PATH, "POST", { id });
					setStatus(result.account);
					await refresh();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				} finally {
					setBusy(false);
				}
			};
			const switchAccount = async (id) => {
				setBusy(true);
				try {
					const result = await jsonRequest(SWITCH_PATH, "POST", { id });
					setStatus(result.account);
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				} finally {
					setBusy(false);
				}
			};
			const signOutActive = async () => {
				setBusy(true);
				try {
					await jsonRequest(LOGOUT_PATH, "POST", {});
					await refresh();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				} finally {
					setBusy(false);
				}
			};
			const recover = async (action) => {
				setBusy(true);
				try {
					await jsonRequest(`/plugins/dsh-antigravity-oauth/auth/${action}`, "POST", {});
					setDraft("");
					await refresh();
				} catch (err) {
					setError(String(err));
				} finally {
					setBusy(false);
				}
			};
			const saveNetwork = async () => {
				if (!network) return;
				setBusy(true);
				try {
					setNetwork(await jsonRequest(NETWORK_PATH, "POST", {
						mode: network.mode,
						url: network.url
					}));
					setNetworkMessage(t("networkSaved"));
				} catch (err) {
					setError(String(err));
				} finally {
					setBusy(false);
				}
			};
			const accounts = status?.accounts ?? [];
			const activeId = status?.status === "signed-in" ? status.activeId : void 0;
			const activeAccount = accounts.find((account) => account.id === activeId);
			const loginError = status?.status === "error" ? status.message : void 0;
			const serviceMessage = status?.status === "signed-in" ? status.message : void 0;

			let availableCount = 0;
			let exhaustedCount = 0;
			for (const account of accounts) {
				const isDead = account.dead;
				const metrics = getAccountQuotaMetrics(quotas[account.id]);
				const isEx = isDead || (metrics ? metrics.isExhausted : false);
				if (isEx) {
					exhaustedCount++;
				} else {
					availableCount++;
				}
			}

			const filteredAccounts = accounts.filter((account) => {
				if (hideExhausted && account.id !== activeId) {
					const isDead = account.dead;
					const metrics = getAccountQuotaMetrics(quotas[account.id]);
					if (isDead || metrics?.isExhausted) return false;
				}
				const q = searchQuery.trim().toLowerCase();
				if (q) {
					const email = (account.email ?? "").toLowerCase();
					const proj = (account.projectId ?? "").toLowerCase();
					const id = account.id.toLowerCase();
					if (!email.includes(q) && !proj.includes(q) && !id.includes(q)) return false;
				}
				return true;
			});

			const visibleAccounts = [...filteredAccounts].sort((a, b) => {
				if (a.id === activeId) return -1;
				if (b.id === activeId) return 1;
				if (sortBy === "quota") {
					const scoreA = getAccountQuotaMetrics(quotas[a.id])?.score ?? -1;
					const scoreB = getAccountQuotaMetrics(quotas[b.id])?.score ?? -1;
					return scoreB - scoreA;
				}
				return 0;
			});

			const label = status === void 0 ? t("loadingAccount") : status.status === "signing-in" ? t("signingIn") : status.status === "error" ? t("requestFailed") : status.status === "signed-out" ? t("signedOut") : activeAccount?.ready === false ? t("authorized") : t("signedIn");
			const dotClass = status?.status === "signed-in" ? "dsh-agy-dot is-signed-in" : status?.status === "error" ? "dsh-agy-dot is-error" : status?.status === "signing-in" ? "dsh-agy-dot is-signing-in" : "dsh-agy-dot";

			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsh-agy-page",
				"aria-labelledby": "antigravity-settings-title",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						id: "antigravity-settings-title",
						className: "dsh-agy-title",
						children: t("title")
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsh-agy-body",
						children: t("tos")
					}),
					error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsh-agy-error",
						children: error
					}) : null,
					network && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-agy-card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsh-agy-name",
								children: t("network")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsh-agy-body",
								children: t("networkHelp")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								children: [
									t("network"),
									" ",
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
										"aria-label": t("network"),
										value: network.mode,
										disabled: busy,
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
									})
								]
							}),
							network.mode === "proxy" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "dsh-agy-input",
								"aria-label": t("proxyUrl"),
								placeholder: "http://127.0.0.1:45678",
								value: network.url,
								disabled: busy,
								onChange: (e) => setNetwork({
									...network,
									url: e.target.value
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: "dsh-agy-body",
								children: [
									t("effectiveNetwork"),
									" ",
									network.effective
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								className: "dsh-agy-btn dsh-agy-btn-secondary",
								disabled: busy,
								onClick: () => {
									saveNetwork();
								},
								children: t("saveNetwork")
							}),
							networkMessage && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								role: "status",
								children: networkMessage
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
						className: "dsh-agy-card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-agy-row",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										style: {
											display: "flex",
											alignItems: "center",
											gap: "8px"
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
												className: "dsh-agy-name",
												children: t("accounts")
											}),
											accounts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: "dsh-agy-btn dsh-agy-btn-secondary",
												style: {
													padding: "2px 8px",
													fontSize: "11px",
													minHeight: "22px"
												},
												disabled: busy || loadingQuotas,
												onClick: () => {
													refreshQuotas();
												},
												children: loadingQuotas ? t("working") : t("refreshQuotas")
											}) : null
										]
									}),
									signing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsh-agy-btn dsh-agy-btn-secondary",
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
										children: busy ? t("working") : status?.status === "error" ? t("loginAgain") : accounts.length === 0 ? t("login") : t("addAccount")
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-agy-status",
								role: "status",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										"aria-hidden": "true",
										className: dotClass
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										children: label
									})
								]
							}),
							loginError !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsh-agy-error",
								children: loginError
							}) : null,
							serviceMessage !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsh-agy-error",
								children: serviceMessage
							}) : null,
							accounts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsh-agy-body",
								children: t("quotaHint")
							}) : null,

							accounts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-agy-summary-bar",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "dsh-agy-summary-badge",
												children: [
													t("totalLabel"),
													" ",
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
														children: accounts.length
													})
												]
											}),
											"·",
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "dsh-agy-summary-badge is-available",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
														children: availableCount
													}),
													" ",
													t("availableLabel")
												]
											}),
											exhaustedCount > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, {
												children: [
													"·",
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: "dsh-agy-summary-badge is-exhausted",
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
																children: exhaustedCount
															}),
															" ",
															t("exhaustedLabel")
														]
													})
												]
											}) : null
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-agy-toolbar",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsh-agy-search-box",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
														type: "text",
														className: "dsh-agy-search-input",
														placeholder: t("searchAccountsPlaceholder"),
														value: searchQuery,
														onChange: (e) => setSearchQuery(e.target.value)
													}),
													searchQuery ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dsh-agy-search-clear",
														"aria-label": "Clear search",
														onClick: () => setSearchQuery(""),
														children: "\xD7"
													}) : null
												]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsh-agy-controls",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "dsh-agy-filters",
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																className: "dsh-agy-check-label",
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																		type: "checkbox",
																		checked: hideExhausted,
																		onChange: (e) => setHideExhausted(e.target.checked)
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		children: t("hideExhausted")
																	})
																]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
																className: "dsh-agy-check-label",
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																		type: "checkbox",
																		checked: compactView,
																		onChange: (e) => setCompactView(e.target.checked)
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		children: t("compactView")
																	})
																]
															})
														]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "dsh-agy-sort",
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																children: [
																	t("sortBy"),
																	":"
																]
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
																className: "dsh-agy-select",
																value: sortBy,
																onChange: (e) => setSortBy(e.target.value),
																children: [
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: "default",
																		children: t("sortDefault")
																	}),
																	/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
																		value: "quota",
																		children: t("sortQuota")
																	})
																]
															})
														]
													})
												]
											})
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh-agy-account-list",
										children: visibleAccounts.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "dsh-agy-empty-tip",
											children: t("noMatchingAccounts")
										}) : visibleAccounts.map((account) => {
											const isActive = account.id === activeId;
											const metrics = getAccountQuotaMetrics(quotas[account.id]);
											const score = metrics?.score ?? 0;
											const capsuleClass = score >= 50 ? "is-high" : score >= 20 ? "is-med" : "is-low";
											return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: `dsh-agy-account${isActive ? " is-active" : ""}`,
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
														className: "dsh-agy-account-main",
														children: [
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
																type: "radio",
																name: "dsh-agy-active-account",
																"aria-label": t("switchAccount"),
																checked: isActive,
																disabled: busy || signing,
																onChange: () => {
																	switchAccount(account.id);
																}
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																className: "dsh-agy-account-mail",
																children: account.email ?? t("unknownAccount")
															}),
															/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																className: "dsh-agy-badges",
																children: [
																	isActive ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "dsh-agy-badge is-active",
																		children: t("activeBadge")
																	}) : null,
																	account.dead ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "dsh-agy-badge is-error",
																		children: t("accountNeedsRelogin")
																	}) : null,
																	account.limited ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "dsh-agy-badge",
																		children: t("accountLimited")
																	}) : null,
																	!account.ready && !account.dead ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																		className: "dsh-agy-badge",
																		children: t("accountNeedsEligibility")
																	}) : null,
																	compactView && metrics ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																		className: `dsh-agy-quota-capsule ${capsuleClass}`,
																		title: `${metrics.b5h ? `5h: ${metrics.p5h}% ${metrics.reset5h ? `(${metrics.reset5h})` : ""}` : ""}${metrics.bWeekly ? ` | ${t("quotaWeeklyShort")}: ${metrics.pWeekly}% ${metrics.resetWeekly ? `(${metrics.resetWeekly})` : ""}` : ""}`,
																		children: [
																			metrics.p5h !== void 0 ? `5h: ${metrics.p5h}%` : "",
																			metrics.p5h !== void 0 && metrics.pWeekly !== void 0 ? " | " : "",
																			metrics.pWeekly !== void 0 ? `${t("quotaWeeklyShort")}: ${metrics.pWeekly}%` : ""
																		]
																	}) : null
																]
															})
														]
													}),
													account.projectId !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
														className: "dsh-agy-body",
														children: [
															t("project"),
															" ",
															account.projectId
														]
													}) : null,
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-remove",
														disabled: busy || signing,
														onClick: () => {
															account.id === activeId ? signOutActive() : removeAccount(account.id);
														},
														children: t("removeAccount")
													}),
													!compactView && quotas[account.id]?.ok && quotas[account.id]?.groups ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: "dsh-agy-quota-box",
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
															className: "dsh-agy-quota-grid",
															children: quotas[account.id].groups.flatMap((g) => g.buckets).filter((b) => b.window === "5h" || b.window === "weekly").map((b) => {
																const pct = Math.round(b.remainingFraction * 100);
																const fillClass = pct >= 50 ? "is-high" : pct >= 20 ? "is-med" : "is-low";
																const label2 = b.window === "5h" ? t("quota5h") : t("quotaWeekly");
																const reset = formatReset(b.resetTime);
																return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
																	className: "dsh-agy-quota-item",
																	title: b.description || `${label2}: ${pct}%`,
																	children: [
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
																			children: label2
																		}),
																		/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																			className: "dsh-agy-quota-bar",
																			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
																				className: `dsh-agy-quota-fill ${fillClass}`,
																				style: {
																					width: `${pct}%`
																				}
																			})
																		}),
																		/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																			style: {
																				fontWeight: 600
																			},
																			children: [
																				pct,
																				"%"
																			]
																		}),
																		reset ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
																			style: {
																				opacity: 0.65
																			},
																			children: [
																				"(",
																				reset,
																				")"
																			]
																		}) : null
																	]
																}, b.bucketId);
															})
														})
													}) : null
												]
											}, account.id);
										})
									})
								]
							}) : null,

							signing && status?.status === "signing-in" && status.url !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
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
							}) : null,
							signing ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
								className: "dsh-agy-form",
								onSubmit: (event) => {
									event.preventDefault();
									complete();
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
										className: "dsh-agy-body",
										children: t("completeHelp")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "text",
										className: "dsh-agy-input",
										autoComplete: "off",
										spellCheck: false,
										placeholder: t("completePlaceholder"),
										value: draft,
										disabled: busy,
										onChange: (event) => {
											setDraft(event.target.value);
										}
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh-agy-actions",
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "submit",
											className: "dsh-agy-btn dsh-agy-btn-primary",
											disabled: busy || draft.trim().length === 0,
											children: busy ? t("working") : t("complete")
										})
									})
								]
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
					})
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
			quotaWeeklyShort: "Wk"
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
			quotaWeeklyShort: "周"
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
