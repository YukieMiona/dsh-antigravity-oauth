window.__ModuleLoader__.load({
	id: "dsh-antigravity-oauth",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/quota-core.ts
		/**
		* Formats relative countdown string in exact parity across frontend and backend.
		*/
		function formatShortCountdown(isoString, lang = "zh") {
			if (!isoString) return "-";
			const deadline = new Date(isoString).getTime();
			if (!Number.isFinite(deadline)) return "-";
			const diff = deadline - Date.now();
			if (diff <= 0) return lang === "zh" ? "已到重置时间" : "Reset due";
			const totalMinutes = Math.floor(diff / 6e4);
			const days = Math.floor(totalMinutes / 1440);
			const hours = Math.floor(totalMinutes % 1440 / 60);
			const mins = totalMinutes % 60;
			if (lang === "zh") {
				if (days > 0) return hours > 0 ? `${days}天${hours}小时` : `${days}天`;
				if (hours > 0) return mins > 0 ? `${hours}小时${mins}分` : `${hours}小时`;
				return `${mins}分`;
			}
			if (days > 0) return hours > 0 ? `${days}d${hours}h` : `${days}d`;
			if (hours > 0) return `${hours}h${String(mins).padStart(2, "0")}m`;
			return `${mins}m`;
		}
		/**
		* Evaluates raw Google CCA quota groups and extracts Gemini core metrics.
		* Strictly isolates Gemini family buckets to eliminate false 100% 3P readings.
		*/
		function evaluateQuotaMetrics(quota, lang = "zh") {
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
				reset5h: b5h?.resetTime ? formatShortCountdown(b5h.resetTime, lang) : "",
				resetWeekly: bWeekly?.resetTime ? formatShortCountdown(bWeekly.resetTime, lang) : ""
			};
		}
		//#endregion
		//#region src/client/tabs/AccountsTab.tsx
		function RemoveAccountAction({ label, title, disabled, onRemove }) {
			const [hovered, setHovered] = (0, react.useState)(false);
			const [focused, setFocused] = (0, react.useState)(false);
			const [dismissed, setDismissed] = (0, react.useState)(false);
			const visible = !disabled && !dismissed && (hovered || focused);
			(0, react.useEffect)(() => {
				if (!visible) return;
				const dismiss = (event) => {
					if (event.key !== "Escape") return;
					event.preventDefault();
					event.stopPropagation();
					setDismissed(true);
				};
				document.addEventListener("keydown", dismiss, true);
				return () => document.removeEventListener("keydown", dismiss, true);
			}, [visible]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-agy-remove-control",
				onPointerEnter: () => {
					setHovered(true);
					setDismissed(false);
				},
				onPointerLeave: () => setHovered(false),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "dsh-agy-btn-icon is-remove-btn",
					disabled,
					"aria-label": label,
					title,
					onFocus: () => {
						setFocused(true);
						setDismissed(false);
					},
					onBlur: () => setFocused(false),
					onClick: onRemove,
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "14",
						height: "14",
						viewBox: "0 0 24 24",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: "2",
						strokeLinecap: "round",
						strokeLinejoin: "round",
						"aria-hidden": "true",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })
					})
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsh-agy-remove-tooltip" + (visible ? " is-visible" : ""),
					"aria-hidden": "true",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "dsh-agy-remove-tooltip-text",
						children: title
					})
				})]
			});
		}
		function AccountsTab(props) {
			const { t, language = "en", accounts, activeAccountId, activeAccount, switchingId, busy, searchQuery, setSearchQuery, sortBy, setSortBy, compactView, setCompactView, quotas, filteredAccounts, switchAccount, removeAccount, recover } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-agy-field dsh-agy-account-panel",
				children: [accounts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-agy-card",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-agy-toolbar-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								position: "relative",
								flex: "1 1 180px",
								minWidth: "140px"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								className: "dsh-agy-input",
								"aria-label": t("searchAccountsPlaceholder"),
								placeholder: t("searchAccountsPlaceholder"),
								value: searchQuery,
								onChange: (e) => setSearchQuery(e.target.value),
								style: { paddingRight: searchQuery ? "26px" : "8px" }
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
									color: "var(--dsw-alias-label-secondary, GrayText)",
									fontSize: "14px",
									lineHeight: "1",
									padding: "2px"
								},
								children: "×"
							}) : null]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-agy-actions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-agy-segmented",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh-agy-segmented-btn " + (sortBy === "default" ? "is-active" : ""),
									onClick: () => setSortBy("default"),
									"aria-pressed": sortBy === "default",
									title: t("sortDefault"),
									children: t("sortDefaultShort")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh-agy-segmented-btn " + (sortBy === "quota" ? "is-active" : ""),
									onClick: () => setSortBy("quota"),
									"aria-pressed": sortBy === "quota",
									title: t("sortQuota"),
									children: t("sortQuotaShort")
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dsh-agy-control-label",
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
							className: "dsh-agy-muted",
							children: t("noMatchingAccounts")
						}) : filteredAccounts.map((account) => {
							const isActive = account.id === activeAccountId;
							const isSwitching = account.id === switchingId;
							const summary = quotas[account.id];
							const metrics = evaluateQuotaMetrics(summary, language);
							const identity = account.email ?? account.id;
							const pending = summary === void 0;
							const unavailable = !pending && !metrics;
							const cells = [{
								period: t("quota5h"),
								value: metrics?.p5h,
								deadline: metrics?.b5h?.resetTime,
								countdown: metrics?.reset5h
							}, {
								period: t("quotaWeekly"),
								value: metrics?.pWeekly,
								deadline: metrics?.bWeekly?.resetTime,
								countdown: metrics?.resetWeekly
							}];
							const formatReset = (deadline, countdown) => {
								const resetAt = deadline ? Date.parse(deadline) : NaN;
								if (!Number.isFinite(resetAt)) return "";
								return resetAt <= Date.now() ? t("quotaResetDue") : t("resetsIn", { time: countdown });
							};
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-agy-account " + (isActive ? "is-active " : "") + (compactView ? "is-compact" : ""),
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-agy-account-header",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsh-agy-account-info",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: "dsh-agy-account-mail",
													title: account.email ?? account.id,
													"aria-label": isActive ? t("currentAccountAria", { email: identity }) : identity,
													"aria-pressed": isActive,
													disabled: busy || Boolean(switchingId) || isActive,
													onClick: () => {
														if (!busy && !switchingId && !isActive) switchAccount(account);
													},
													children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsh-agy-account-email-text",
														children: account.email ?? account.id
													}), isActive ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsh-agy-account-check",
														"aria-hidden": "true",
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
															width: "14",
															height: "14",
															viewBox: "0 0 24 24",
															fill: "none",
															stroke: "currentColor",
															strokeWidth: "2.5",
															strokeLinecap: "round",
															strokeLinejoin: "round",
															children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("polyline", { points: "20 6 9 17 4 12" })
														})
													}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsh-agy-account-check is-placeholder",
														"aria-hidden": "true"
													})]
												}),
												isSwitching ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsh-agy-status-badge is-switching",
													title: t("working"),
													role: compactView ? "img" : void 0,
													"aria-label": compactView ? t("working") : void 0,
													children: compactView ? "…" : t("working")
												}) : null,
												account.limited ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsh-agy-status-badge is-error",
													title: t("accountLimited"),
													role: compactView ? "img" : void 0,
													"aria-label": compactView ? t("accountLimited") : void 0,
													children: compactView ? "!" : t("accountLimited")
												}) : null,
												account.dead ? (() => {
													const label = t(account.banned === true ? "accountBanned" : "accountNeedsRelogin");
													return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsh-agy-status-badge is-error",
														title: label,
														role: compactView ? "img" : void 0,
														"aria-label": compactView ? label : void 0,
														children: compactView ? "×" : label
													});
												})() : null
											]
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "dsh-agy-account-action",
											children: !isActive ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RemoveAccountAction, {
												disabled: busy || Boolean(switchingId),
												label: t("removeAccountAria", { email: account.email ?? account.id }),
												title: t("removeAccount"),
												onRemove: () => {
													if (!busy && !switchingId) removeAccount(account.id);
												}
											}) : null
										})]
									}),
									pending || unavailable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh-agy-account-quota-state",
										children: t(pending ? "quotaPending" : "quotaUnavailable")
									}) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsh-agy-account-metrics",
										children: cells.map(({ period, value: rawValue, deadline, countdown }, index) => {
											const value = typeof rawValue === "number" && Number.isFinite(rawValue) ? Math.max(0, Math.min(100, Math.round(rawValue))) : void 0;
											const level = value === void 0 ? "is-unknown" : value > 40 ? "is-high" : value > 15 ? "is-med" : "is-low";
											const meter = {
												role: "progressbar",
												"aria-label": value === void 0 ? t(pending ? "meterPendingAria" : "meterUnknownAria", { period }) : t("meterAria", {
													period,
													pct: value
												}),
												"aria-valuenow": value,
												"aria-valuemin": value !== void 0 ? 0 : void 0,
												"aria-valuemax": value !== void 0 ? 100 : void 0
											};
											return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: "dsh-agy-quota-col",
												children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
														className: "dsh-agy-quota-row-label",
														...compactView ? meter : {},
														title: compactView ? meter["aria-label"] : void 0,
														children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dsh-agy-quota-period",
															children: compactView ? t(index === 0 ? "quota5hCompact" : "quotaWeeklyCompact") : period
														}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
															className: "dsh-agy-quota-pct " + level,
															children: value !== void 0 ? `${value}%` : "—"
														})]
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: "dsh-agy-quota-track",
														...!compactView ? meter : {},
														children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
															className: "dsh-agy-capsule-fill " + (value !== void 0 ? level : ""),
															style: { width: value !== void 0 ? `${value}%` : "0%" }
														})
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
														className: "dsh-agy-quota-reset",
														children: formatReset(deadline, countdown)
													})
												]
											}, index);
										})
									})
								]
							}, account.id);
						})
					})]
				}) : null, activeAccount !== void 0 && !activeAccount.ready ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-agy-card",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsh-agy-card-title",
						children: t("authorized")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							gap: "8px",
							flexWrap: "wrap",
							marginTop: "4px"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh-agy-btn dsh-agy-btn-primary",
							disabled: busy || Boolean(switchingId),
							onClick: () => {
								recover("retry");
							},
							children: t("retryEligibility")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh-agy-btn dsh-agy-btn-secondary",
							disabled: busy,
							onClick: () => {
								recover("cancel");
							},
							children: t("cancel")
						})]
					})]
				}) : null]
			});
		}
		//#endregion
		//#region src/models.ts
		const DEFAULT_CATALOG_MODELS = [
			{
				id: "gemini-4-argon",
				name: "Gemini 4 Argon",
				contextWindow: 1048576,
				maxTokens: 65536,
				supportsImages: true,
				supportsThinking: true
			},
			{
				id: "gemini-3.8-flash",
				name: "Gemini 3.8 Flash",
				contextWindow: 1048576,
				maxTokens: 65536,
				supportsImages: true,
				supportsThinking: true
			},
			{
				id: "gemini-3.7-flash",
				name: "Gemini 3.7 Flash",
				contextWindow: 1048576,
				maxTokens: 65536,
				supportsImages: true,
				supportsThinking: true
			},
			{
				id: "gemini-3.5-flash",
				name: "Gemini 3.5 Flash",
				contextWindow: 1048576,
				maxTokens: 65536,
				supportsImages: true
			},
			{
				id: "claude-sonnet-4-6",
				name: "Claude Sonnet 4.6 (Thinking)",
				contextWindow: 25e4,
				maxTokens: 64e3,
				supportsImages: true,
				supportsThinking: true
			},
			{
				id: "claude-opus-4-6-thinking",
				name: "Claude Opus 4.6 (Thinking)",
				contextWindow: 25e4,
				maxTokens: 64e3,
				supportsImages: true,
				supportsThinking: true
			},
			{
				id: "gemini-2.5-pro",
				name: "Gemini 2.5 Pro",
				contextWindow: 1048576,
				maxTokens: 65535,
				supportsImages: true,
				supportsThinking: true
			},
			{
				id: "gpt-oss-120b-medium",
				name: "GPT-OSS 120B (Medium)",
				contextWindow: 131072,
				maxTokens: 32768,
				supportsThinking: true
			},
			{
				id: "gemini-3.5-flash-lite",
				name: "Gemini 3.5 Flash Lite",
				contextWindow: 1048576,
				maxTokens: 65535,
				supportsImages: true
			}
		];
		const REASONING_EFFORTS = [
			"low",
			"medium",
			"high"
		];
		const DEFAULT_REASONING_EFFORT = "medium";
		const WIRE = {
			"gemini-4-argon": {
				low: "gemini-4-argon-low",
				medium: "gemini-4-argon-medium",
				high: "gemini-4-argon-high"
			},
			"gemini-3.8-flash": {
				low: "gemini-3.8-flash-low",
				medium: "gemini-3.8-flash-medium",
				high: "gemini-3.8-flash-high"
			},
			"gemini-3.7-flash": {
				low: "gemini-3.7-flash-low",
				medium: "gemini-3.7-flash-medium",
				high: "gemini-3.7-flash-high"
			},
			"gemini-3.5-flash": {
				low: "gemini-3.5-flash-extra-low",
				medium: "gemini-3.5-flash-low",
				high: "gemini-3-flash-agent"
			}
		};
		function routeChatModel(model, effort = DEFAULT_REASONING_EFFORT) {
			if (WIRE[model]) return WIRE[model][effort];
			return model;
		}
		//#endregion
		//#region src/client/tabs/AdvancedTab.tsx
		function AdvancedTab(props) {
			const { t, advancedEffort, setAdvancedEffort, advancedContextWindow, setAdvancedContextWindow, advancedStrategy, setAdvancedStrategy, advancedThreshold, setAdvancedThreshold, advancedEnabledModels, setAdvancedEnabledModels, availableModels, savingAdvanced, saveAdvanced } = props;
			const modelList = availableModels && availableModels.length > 0 ? availableModels : DEFAULT_CATALOG_MODELS;
			const contextLabel = (tokens) => tokens >= 1e6 ? `${Math.round(tokens / 1048576 * 10) / 10}M` : `${Math.round(tokens / 1024)}K`;
			const toggleModel = (id, checked) => {
				if (checked) {
					if (advancedEnabledModels.length > 1) setAdvancedEnabledModels(advancedEnabledModels.filter((m) => m !== id));
				} else setAdvancedEnabledModels([...advancedEnabledModels, id]);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-agy-stack",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-agy-card",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
							className: "dsh-agy-fieldset",
							disabled: savingAdvanced,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("legend", {
								className: "dsh-agy-section-text",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh-agy-section-title",
									children: t("enabledModelsTitle")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh-agy-section-desc",
									children: t("modelsDesc")
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh-agy-option-list",
								children: modelList.map((model) => {
									const isChecked = advancedEnabledModels.includes(model.id);
									const isLast = isChecked && advancedEnabledModels.length === 1;
									return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: "dsh-agy-option " + (isChecked ? "is-active" : ""),
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												type: "checkbox",
												checked: isChecked,
												disabled: savingAdvanced || isLast,
												onChange: () => toggleModel(model.id, isChecked)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "dsh-agy-option-text",
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsh-agy-option-name",
													children: model.name
												}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
													className: "dsh-agy-option-meta",
													children: model.id
												})]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "dsh-agy-pills",
												children: [
													model.id === "gemini-3.8-flash" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsh-agy-pill is-success",
														children: t("modelDefault")
													}) : null,
													model.id === "gemini-4-argon" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsh-agy-pill is-warn",
														children: t("modelArgonNote")
													}) : null,
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
														className: "dsh-agy-pill",
														children: t("contextShort", { size: contextLabel(model.contextWindow) })
													})
												]
											})
										]
									}, model.id);
								})
							})]
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-agy-card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
								className: "dsh-agy-fieldset",
								disabled: savingAdvanced,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("legend", {
									className: "dsh-agy-section-text",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh-agy-section-title",
										children: t("defaultReasoningEffort")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh-agy-section-desc",
										children: t("effortDesc")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsh-agy-segmented",
									children: [
										"low",
										"medium",
										"high"
									].map((effort, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: "dsh-agy-segmented-btn " + (advancedEffort === effort ? "is-active" : ""),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: "agy-effort",
											value: effort,
											checked: advancedEffort === effort,
											onChange: () => setAdvancedEffort(effort)
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t([
											"effortLow",
											"effortMedium",
											"effortHigh"
										][index]) })]
									}, effort))
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("hr", { className: "dsh-agy-divider" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
								className: "dsh-agy-fieldset",
								disabled: savingAdvanced,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("legend", {
									className: "dsh-agy-section-text",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh-agy-section-title",
										children: t("modelContextWindow")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh-agy-section-desc",
										children: t("contextDesc")
									})]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsh-agy-segmented",
									children: [
										131072,
										262144,
										524288,
										1048576
									].map((size, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: "dsh-agy-segmented-btn " + (advancedContextWindow === size ? "is-active" : ""),
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: "agy-context",
											value: size,
											checked: advancedContextWindow === size,
											onChange: () => setAdvancedContextWindow(size)
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t([
											"contextWindow128K",
											"contextWindow256K",
											"contextWindow512K",
											"contextWindow1M"
										][index]) })]
									}, size))
								})]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-agy-card",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
							className: "dsh-agy-fieldset",
							disabled: savingAdvanced,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("legend", {
								className: "dsh-agy-section-text",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh-agy-section-title",
									children: t("switchingStrategyTitle")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh-agy-section-desc",
									children: t("strategyDesc")
								})]
							}), [
								"failover_429",
								"proactive_threshold",
								"round_robin",
								"manual"
							].map((strategy, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dsh-agy-radio-card " + (advancedStrategy === strategy ? "is-active" : ""),
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "radio",
									name: "agy-strategy",
									value: strategy,
									checked: advancedStrategy === strategy,
									onChange: () => setAdvancedStrategy(strategy)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh-agy-choice-label",
									children: t([
										"strategyFailover",
										"strategyProactive",
										"strategyRoundRobin",
										"strategyManual"
									][index])
								})]
							}, strategy))]
						}), advancedStrategy === "proactive_threshold" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "dsh-agy-field",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-agy-control-label",
								children: t("thresholdLabel", { threshold: advancedThreshold })
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "range",
								className: "dsh-agy-range",
								min: "10",
								max: "40",
								step: "5",
								value: advancedThreshold,
								disabled: savingAdvanced,
								onChange: (e) => setAdvancedThreshold(Number(e.target.value))
							})]
						}) : null]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-agy-actions",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact",
							disabled: savingAdvanced,
							onClick: () => {
								saveAdvanced();
							},
							children: savingAdvanced ? t("working") : t("saveAdvanced")
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/tabs/ApiServerTab.tsx
		function ApiServerTab(props) {
			const { t, settings, status, saving, saveSettings, regenerateKey } = props;
			const [enabled, setEnabled] = (0, react.useState)(settings.enabled);
			const [host, setHost] = (0, react.useState)(settings.host);
			const [port, setPort] = (0, react.useState)(settings.port);
			const [apiKey, setApiKey] = (0, react.useState)(settings.apiKey);
			const [copiedUrl, setCopiedUrl] = (0, react.useState)(false);
			const [copiedKey, setCopiedKey] = (0, react.useState)(false);
			const [copiedCurl, setCopiedCurl] = (0, react.useState)(false);
			const [revealKey, setRevealKey] = (0, react.useState)(false);
			const effectiveHost = status.running ? status.host : host;
			const effectivePort = status.running ? status.port : port;
			const baseUrl = `http://${effectiveHost === "0.0.0.0" ? "127.0.0.1" : effectiveHost}:${effectivePort}/v1`;
			const curlFor = (key) => `curl -X POST ${baseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${key}" \\
  -d '{"model":"gemini-3.8-flash","messages":[{"role":"user","content":"Hello!"}]}'`;
			const curlExample = curlFor(apiKey);
			const maskedKey = apiKey.length > 10 ? `${apiKey.slice(0, 7)}…${apiKey.slice(-4)}` : "…";
			const handleSave = async (overrides) => {
				await saveSettings({
					enabled: overrides?.enabled !== void 0 ? overrides.enabled : enabled,
					host: overrides?.host !== void 0 ? overrides.host : host,
					port: overrides?.port !== void 0 ? overrides.port : port,
					apiKey: overrides?.apiKey !== void 0 ? overrides.apiKey : apiKey
				});
			};
			const copyText = (text, setter) => {
				navigator.clipboard.writeText(text);
				setter(true);
				setTimeout(() => setter(false), 2e3);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-agy-stack",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-agy-card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-agy-status-strip",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsh-agy-status-main",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dsh-agy-dot " + (status.running ? "is-signed-in" : status.error ? "is-error" : "") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh-agy-status-label",
											children: status.running ? t("apiServerRunning") : t("apiServerStopped")
										}),
										status.running ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh-agy-status-meta dsh-agy-mono",
											children: t("apiServerRunningAt", { address: `${status.host}:${status.port}` })
										}) : null
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh-agy-btn " + (enabled ? "dsh-agy-btn-secondary" : "dsh-agy-btn-primary") + " dsh-agy-btn-compact",
									disabled: saving,
									onClick: () => {
										const next = !enabled;
										setEnabled(next);
										handleSave({ enabled: next });
									},
									children: saving ? t("working") : enabled ? t("apiServerDisable") : t("apiServerEnable")
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsh-agy-hint",
								children: t("apiServerDesc")
							}),
							status.error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsh-agy-error",
								children: status.error
							}) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-agy-card",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-agy-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh-agy-control-label",
									children: t("apiServerBaseUrl")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsh-agy-code-terminal",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: baseUrl }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
										onClick: () => copyText(baseUrl, setCopiedUrl),
										children: copiedUrl ? t("copied") : t("copyCommand")
									})]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dsh-agy-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh-agy-control-label",
									children: t("apiServerKey")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsh-agy-input-row",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: revealKey ? "text" : "password",
											className: "dsh-agy-input dsh-agy-mono",
											value: apiKey,
											disabled: saving,
											autoComplete: "off",
											spellCheck: false,
											onChange: (e) => setApiKey(e.target.value),
											placeholder: "sk-agy-..."
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
											"aria-pressed": revealKey,
											onClick: () => setRevealKey(!revealKey),
											children: revealKey ? t("bridgeHide") : t("bridgeReveal")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
											onClick: () => copyText(apiKey, setCopiedKey),
											children: copiedKey ? t("copied") : t("copyCommand")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
											disabled: saving,
											onClick: () => {
												regenerateKey();
											},
											children: t("apiServerRegenerateKey")
										})
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-agy-field-grid",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dsh-agy-field",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh-agy-control-label",
											children: t("apiServerHost")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "text",
											className: "dsh-agy-input dsh-agy-mono",
											list: "dsh-agy-api-hosts",
											value: host,
											disabled: saving,
											spellCheck: false,
											onChange: (e) => setHost(e.target.value.trim())
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("datalist", {
											id: "dsh-agy-api-hosts",
											children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "127.0.0.1",
													children: "Localhost only"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "172.17.0.1",
													children: "Docker containers (docker0)"
												}),
												/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "0.0.0.0",
													children: "All interfaces (public if not firewalled)"
												})
											]
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dsh-agy-field",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh-agy-control-label",
										children: t("apiServerPort")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "number",
										className: "dsh-agy-input dsh-agy-mono",
										value: port,
										disabled: saving,
										min: 1024,
										max: 65535,
										onChange: (e) => setPort(Number(e.target.value))
									})]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsh-agy-actions",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact",
									disabled: saving,
									onClick: () => {
										handleSave();
									},
									children: saving ? t("working") : t("saveSettings")
								})
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-agy-card",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-agy-section-head",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsh-agy-section-title",
								children: t("apiServerQuickTest")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
								onClick: () => copyText(curlExample, setCopiedCurl),
								children: copiedCurl ? t("copied") : t("copyCommand")
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
							className: "dsh-agy-pre",
							children: revealKey ? curlExample : curlFor(maskedKey)
						})]
					})
				]
			});
		}
		//#endregion
		//#region src/client/tabs/ManagerTab.tsx
		function hostOf(url) {
			try {
				return new URL(url).host;
			} catch {
				return url;
			}
		}
		function HealthTile({ name, up, detail }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-agy-health-tile",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
					className: "dsh-agy-health-name",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dsh-agy-dot " + (up === void 0 ? "" : up ? "is-signed-in" : "is-error") }), name]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsh-agy-health-detail",
					children: detail
				})]
			});
		}
		function ManagerTab({ t, settings, enabledModels, save, test }) {
			const [baseUrl, setBaseUrl] = (0, react.useState)(settings?.baseUrl ?? "");
			const [apiKey, setApiKey] = (0, react.useState)("");
			const [reveal, setReveal] = (0, react.useState)(false);
			const [saving, setSaving] = (0, react.useState)(false);
			const [testing, setTesting] = (0, react.useState)(false);
			const [probe, setProbe] = (0, react.useState)();
			const [feedback, setFeedback] = (0, react.useState)(null);
			const probedOnce = (0, react.useRef)(false);
			(0, react.useEffect)(() => {
				if (settings !== void 0) setBaseUrl(settings.baseUrl);
			}, [settings?.baseUrl]);
			const runTest = async (quiet = false) => {
				setTesting(true);
				if (!quiet) setFeedback(null);
				try {
					const result = await test({
						baseUrl: baseUrl.trim(),
						...apiKey.trim() ? { apiKey: apiKey.trim() } : {}
					});
					setProbe(result);
					if (!quiet) setFeedback(result.ok ? {
						ok: true,
						msg: t("bridgeConnected", {
							latency: result.latencyMs,
							count: result.models.length
						})
					} : {
						ok: false,
						msg: t("bridgeFailed", { error: result.error ?? t("unknownError") })
					});
				} catch (error) {
					if (!quiet) setFeedback({
						ok: false,
						msg: t("bridgeFailed", { error: error instanceof Error ? error.message : t("unknownError") })
					});
				} finally {
					setTesting(false);
				}
			};
			(0, react.useEffect)(() => {
				if (settings === void 0 || probedOnce.current) return;
				probedOnce.current = true;
				runTest(true);
			}, [settings]);
			const persist = async (patch) => {
				setSaving(true);
				setFeedback(null);
				try {
					await save(patch);
					setApiKey("");
					setFeedback({
						ok: true,
						msg: t("bridgeSaved")
					});
				} catch (error) {
					setFeedback({
						ok: false,
						msg: error instanceof Error ? error.message : t("saveFailed")
					});
				} finally {
					setSaving(false);
				}
			};
			if (settings === void 0) return null;
			const busy = saving || testing;
			const enabled = settings.enabled;
			const offered = new Set(probe?.models ?? []);
			const missing = probe?.ok ? enabledModels.filter((id) => REASONING_EFFORTS.some((effort) => !offered.has(routeChatModel(id, effort)))) : [];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-agy-stack",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-agy-card",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
							className: "dsh-agy-fieldset",
							disabled: busy,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("legend", {
								className: "dsh-agy-section-text",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh-agy-section-title",
									children: t("routeTitle")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh-agy-section-desc",
									children: t("routeDesc")
								})]
							}), [[
								"direct",
								"routeDirect",
								"routeDirectDesc"
							], [
								"gateway",
								"routeBridge",
								"routeGatewayDesc"
							]].map(([value, label, desc]) => {
								const selected = value === "gateway" === enabled;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dsh-agy-radio-card " + (selected ? "is-active" : ""),
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: "agy-route",
											value,
											checked: selected,
											onChange: () => {
												persist({ enabled: value === "gateway" });
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
											className: "dsh-agy-option-text",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsh-agy-option-name",
												children: t(label)
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsh-agy-section-desc",
												children: t(desc)
											})]
										}),
										selected && value === "gateway" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsh-agy-pill " + (probe?.ok === false ? "is-error" : "is-success"),
											children: hostOf(settings.baseUrl)
										}) : null
									]
								}, value);
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-agy-health",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(HealthTile, {
								name: t("bridgeGateway"),
								up: probe === void 0 ? void 0 : probe.gatewayUp,
								detail: probe === void 0 ? testing ? t("bridgeTesting") : t("bridgeNotTested") : probe.ok ? `${t("bridgeUp")} · ${probe.latencyMs} ms · ${probe.models.length} models` : probe.gatewayUp ? probe.error ?? t("bridgeDown") : t("bridgeDown")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(HealthTile, {
								name: t("bridgeCore"),
								up: probe?.coreUp,
								detail: probe === void 0 ? t("bridgeNotTested") : `${probe.coreUp ? t("bridgeUp") : t("bridgeDown")} · 127.0.0.1:18046`
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsh-agy-hint",
							children: t("coreNote")
						}),
						missing.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsh-agy-callout is-warn",
							role: "status",
							children: t("bridgeModelsMissing", { models: missing.join(", ") })
						}) : null
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-agy-card",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-agy-section-text",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsh-agy-section-title",
								children: t("bridgeTitle")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsh-agy-section-desc",
								children: t("bridgeHelp")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "dsh-agy-field",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-agy-control-label",
								children: t("bridgeBaseUrl")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								className: "dsh-agy-input dsh-agy-mono",
								placeholder: "http://127.0.0.1:8045/v1",
								value: baseUrl,
								disabled: busy,
								spellCheck: false,
								onChange: (e) => setBaseUrl(e.target.value)
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-agy-field",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dsh-agy-field",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh-agy-control-label",
									children: t("bridgeApiKey")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsh-agy-input-row",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: reveal ? "text" : "password",
										className: "dsh-agy-input dsh-agy-mono",
										placeholder: settings.hasApiKey ? "••••••••" : "sk-…",
										value: apiKey,
										disabled: busy,
										autoComplete: "off",
										spellCheck: false,
										onChange: (e) => setApiKey(e.target.value)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
										"aria-pressed": reveal,
										disabled: apiKey.length === 0,
										onClick: () => setReveal(!reveal),
										children: reveal ? t("bridgeHide") : t("bridgeReveal")
									})]
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsh-agy-hint",
								children: [settings.hasApiKey ? t("bridgeApiKeySaved", { hint: settings.apiKeyHint }) : t("bridgeApiKeyNone"), settings.hasApiKey ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [" ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh-agy-link dsh-agy-link-btn",
									disabled: busy,
									onClick: () => {
										persist({ apiKey: "" });
									},
									children: t("bridgeClearKey")
								})] }) : null]
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-agy-actions",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact",
									disabled: busy || baseUrl.trim().length === 0,
									onClick: () => {
										persist({
											baseUrl: baseUrl.trim(),
											...apiKey.trim() ? { apiKey: apiKey.trim() } : {}
										});
									},
									children: saving ? t("working") : t("bridgeSave")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
									disabled: busy || baseUrl.trim().length === 0,
									onClick: () => {
										runTest();
									},
									children: testing ? t("bridgeTesting") : t("bridgeTest")
								}),
								probe?.ok ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsh-agy-pills",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsh-agy-pill " + (probe.latencyMs < 300 ? "is-success" : "is-warn"),
										children: [probe.latencyMs, " ms"]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsh-agy-pill",
										children: [probe.models.length, " models"]
									})]
								}) : null
							]
						}),
						feedback ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							role: feedback.ok ? "status" : "alert",
							className: "dsh-agy-feedback " + (feedback.ok ? "is-success" : "is-error"),
							children: feedback.msg
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsh-agy-callout",
							children: t("bridgeCallout")
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/client/tabs/Web2ApiTab.tsx
		function Web2ApiTab(props) {
			const { t, guideDismissed, dismissGuide, restoreGuide, dockerCmd, copiedDocker, copyDockerCommand, web2apiDetecting, detectLocalGateway, web2apiEnabled, setWeb2apiEnabled, web2apiSaving, web2apiBaseUrl, setWeb2apiBaseUrl, web2apiApiKey, setWeb2apiApiKey, web2apiImageTool, setWeb2apiImageTool, saveWeb2Api, web2apiTesting, testWeb2Api, web2apiFeedback } = props;
			const locked = web2apiSaving || web2apiTesting || web2apiDetecting;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-agy-stack",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-agy-card",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-agy-section-head",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsh-agy-section-text",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsh-agy-section-title",
									children: t("tabWeb2api")
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "dsh-agy-section-desc",
									children: t("web2apiDesc")
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dsh-agy-switch",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									checked: web2apiEnabled,
									disabled: locked,
									onChange: (e) => setWeb2apiEnabled(e.target.checked)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("web2apiEnable") })]
							})]
						}),
						web2apiEnabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-agy-stack is-tight",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dsh-agy-field",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh-agy-control-label",
										children: t("web2apiBaseUrl")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "text",
										className: "dsh-agy-input dsh-agy-mono",
										placeholder: "http://127.0.0.1:18088/v1",
										value: web2apiBaseUrl,
										disabled: locked,
										spellCheck: false,
										onChange: (e) => setWeb2apiBaseUrl(e.target.value)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsh-agy-actions",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsh-agy-chip",
										disabled: locked,
										onClick: () => setWeb2apiBaseUrl("http://127.0.0.1:18088/v1"),
										children: t("presetLocal")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "dsh-agy-chip",
										disabled: locked,
										onClick: () => setWeb2apiBaseUrl("http://localhost:18088/v1"),
										children: t("presetDocker")
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dsh-agy-field",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsh-agy-control-label",
										children: t("web2apiApiKey")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "password",
										className: "dsh-agy-input dsh-agy-mono",
										placeholder: "sk-...",
										value: web2apiApiKey,
										disabled: locked,
										autoComplete: "off",
										onChange: (e) => setWeb2apiApiKey(e.target.value)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: "dsh-agy-switch",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: web2apiImageTool,
										disabled: locked,
										onChange: (e) => setWeb2apiImageTool(e.target.checked)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("web2apiImageTool") })]
								})
							]
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-agy-actions",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact",
									disabled: locked,
									onClick: saveWeb2Api,
									children: web2apiSaving ? t("working") : t("web2apiSave")
								}),
								web2apiEnabled ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
									disabled: locked,
									onClick: testWeb2Api,
									children: web2apiTesting ? t("web2apiTesting") : t("web2apiTest")
								}) : null,
								web2apiFeedback ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									role: web2apiFeedback.ok ? "status" : "alert",
									className: "dsh-agy-feedback " + (web2apiFeedback.ok ? "is-success" : "is-error"),
									children: web2apiFeedback.msg
								}) : null
							]
						})
					]
				}), !guideDismissed ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-agy-card",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-agy-section-head",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: "dsh-agy-section-title",
								children: t("quickSetupTitle")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsh-agy-notice-close",
								"aria-label": t("hideGuide"),
								onClick: dismissGuide,
								children: "×"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-agy-code-terminal",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: dockerCmd }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
								onClick: copyDockerCommand,
								children: copiedDocker ? t("copied") : t("copyCommand")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsh-agy-actions",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
								disabled: locked,
								onClick: detectLocalGateway,
								children: web2apiDetecting ? t("detecting") : t("detectService")
							})
						})
					]
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsh-agy-actions",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
						onClick: restoreGuide,
						children: t("showGuide")
					})
				})]
			});
		}
		//#endregion
		//#region src/client/tabs/NetworkTab.tsx
		function NetworkTab(props) {
			const { t, network, setNetwork, savingNetwork, saveNetwork, networkMessage, networkError = false } = props;
			if (!network) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsh-agy-card",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-agy-section-text",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsh-agy-section-title",
						children: t("tabNetwork")
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsh-agy-section-desc",
						children: t("networkDesc")
					})]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsh-agy-stack is-tight",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "dsh-agy-field",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-agy-control-label",
								children: t("network")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
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
						network.mode === "proxy" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
							className: "dsh-agy-field",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-agy-control-label",
								children: t("proxyUrl")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								className: "dsh-agy-input dsh-agy-mono",
								"aria-label": t("proxyUrl"),
								placeholder: "http://127.0.0.1:7890",
								value: network.url,
								disabled: savingNetwork,
								onChange: (e) => setNetwork({
									...network,
									url: e.target.value
								})
							})]
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-agy-actions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsh-agy-status-meta",
								children: t("effectiveNetwork")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", {
								className: "dsh-agy-pill dsh-agy-mono dsh-agy-proxy-route",
								children: network.effective || "direct"
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsh-agy-actions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact",
								disabled: savingNetwork,
								onClick: saveNetwork,
								children: savingNetwork ? t("working") : t("saveNetwork")
							}), networkMessage ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								role: networkError ? "alert" : "status",
								className: "dsh-agy-feedback " + (networkError ? "is-error" : "is-success"),
								children: networkMessage
							}) : null]
						})
					]
				})]
			});
		}
		//#endregion
		//#region src/api-server/types.ts
		const DEFAULT_API_SERVER_SETTINGS = {
			enabled: false,
			host: "127.0.0.1",
			port: 18045,
			apiKey: ""
		};
		//#endregion
		//#region src/client/theme.ts
		const STYLE_ID = "dsh-antigravity-oauth-settings-theme";
		const SETTINGS_CSS = `
.dsh-agy-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 720px;
  color: var(--dsw-alias-label-primary, CanvasText);
  font-family: inherit;
  position: relative;
  container-type: inline-size;
  container-name: agy-settings;
  min-width: 0;
  box-sizing: border-box;
}

/* Header */
.dsh-agy-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.dsh-agy-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
}
.dsh-agy-title {
  margin: 0;
  font-size: 16px;
  line-height: 22px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, CanvasText);
}
.dsh-agy-header-active-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary, GrayText);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-agy-body {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary, GrayText);
}
.dsh-agy-error {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-state-error-primary, CanvasText);
  padding: 6px 12px;
  border-radius: 6px;
  background: rgba(242, 90, 90, 0.12);
  border: 1px solid rgba(242, 90, 90, 0.25);
}

/* Floating Toast */
.dsh-agy-toast-float {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2, Canvas);
  border: 1px solid var(--dsw-alias-state-success-primary, CanvasText);
  color: var(--dsw-alias-state-success-primary, CanvasText);
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  animation: dsh-agy-fadein 0.2s ease-out;
}
@keyframes dsh-agy-fadein {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Notice banner */
.dsh-agy-notice-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
}
.dsh-agy-notice-close {
  background: none;
  border: none;
  color: var(--dsw-alias-label-secondary, GrayText);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 4px;
}
.dsh-agy-notice-close:hover {
  color: var(--dsw-alias-label-primary, CanvasText);
  background: var(--dsw-alias-border-l3, GrayText);
}

/* Tabs: as many columns as fit, so adding a tab never breaks the row. */
.dsh-agy-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(78px, 1fr));
  gap: 3px;
  padding: 3px;
  background: var(--dsw-alias-bg-module-platform, Canvas);
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  border-radius: 8px;
  width: 100%;
  box-sizing: border-box;
}
.dsh-agy-tab-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, GrayText);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.dsh-agy-tab-btn:hover {
  color: var(--dsw-alias-label-primary, CanvasText);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
}
.dsh-agy-tab-btn.is-active {
  color: var(--dsw-alias-label-primary-foreground, HighlightText);
  background: var(--dsw-alias-button-primary-fill, Highlight);
  font-weight: 600;
}

/* Cards */
.dsh-agy-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l3, GrayText));
  border-radius: 8px;
  background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-2, Canvas));
  box-sizing: border-box;
  width: 100%;
}
.dsh-agy-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.dsh-agy-card-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, CanvasText);
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Status Indicators */
.dsh-agy-status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  color: var(--dsw-alias-label-secondary, GrayText);
}
.dsh-agy-status-badge.is-success {
  background: rgba(65, 201, 119, 0.12);
  color: var(--dsw-alias-state-success-primary, CanvasText);
}
.dsh-agy-status-badge.is-error {
  background: rgba(242, 90, 90, 0.12);
  color: var(--dsw-alias-state-error-primary, CanvasText);
}
.dsh-agy-status-badge.is-switching {
  background: rgba(250, 140, 22, 0.12);
  color: var(--dsw-alias-state-warn-primary, CanvasText);
}
.dsh-agy-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: var(--dsw-alias-label-secondary, GrayText);
}
.dsh-agy-dot.is-signed-in,
.dsh-agy-dot.is-active {
  background: var(--dsw-alias-state-success-primary, CanvasText);
}
.dsh-agy-dot.is-error {
  background: var(--dsw-alias-state-error-primary, CanvasText);
}
.dsh-agy-dot.is-signing-in {
  background: var(--dsw-alias-button-primary-fill, Highlight);
}

/* Buttons */
.dsh-agy-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 3px 12px;
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
  border: 1px solid transparent;
  user-select: none;
}
.dsh-agy-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.dsh-agy-btn-primary {
  background: var(--dsw-alias-button-primary-fill, Highlight);
  color: var(--dsw-alias-label-primary-foreground, HighlightText);
  border-color: var(--dsw-alias-button-primary-fill, Highlight);
  font-weight: 500;
}
.dsh-agy-btn-primary:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover, Highlight);
  border-color: var(--dsw-alias-button-primary-hover, Highlight);
}
.dsh-agy-btn-secondary {
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  color: var(--dsw-alias-label-primary, CanvasText);
}
.dsh-agy-btn-secondary:hover:not(:disabled) {
  background: var(--dsw-alias-border-l3, GrayText);
  border-color: var(--dsw-alias-border-l3, GrayText);
  color: var(--dsw-alias-label-primary, CanvasText);
}
.dsh-agy-btn-compact {
  min-height: 24px;
  padding: 2px 8px;
  border-radius: 4px;
}

/* Inputs & Selects */
.dsh-agy-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 28px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-bg-layer-2, Canvas);
  color: var(--dsw-alias-label-primary, CanvasText);
  font: inherit;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s ease;
}
.dsh-agy-input:focus {
  border-color: var(--dsw-alias-button-primary-fill, Highlight);
}
.dsh-agy-select {
  box-sizing: border-box;
  min-height: 26px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-bg-layer-2, Canvas);
  color: var(--dsw-alias-label-primary, CanvasText);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  outline: none;
}

/* Segmented Control */
.dsh-agy-segmented {
  display: inline-flex;
  align-items: center;
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}
.dsh-agy-segmented-btn {
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--dsw-alias-label-secondary, GrayText);
  font: inherit;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}
.dsh-agy-segmented-btn:hover {
  color: var(--dsw-alias-label-primary, CanvasText);
}
.dsh-agy-segmented-btn.is-active {
  background: var(--dsw-alias-button-primary-fill, Highlight);
  color: var(--dsw-alias-label-primary-foreground, HighlightText);
  font-weight: 600;
}

/* The account panel owns the breakpoint, not the viewport or its scroller. */
.dsh-agy-account-panel {
  container-type: inline-size;
  container-name: agy-accounts;
  width: 100%;
  min-width: 0;
}
.dsh-agy-account-list {
  max-height: 480px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}
.dsh-agy-account {
  --quota-track-gap: 4px;
  --quota-cell-gap: 12px;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 8px;
  background: transparent;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}
.dsh-agy-account + .dsh-agy-account {
  border-top: 2px solid var(--dsw-alias-border-l3, GrayText);
}
.dsh-agy-account.is-compact {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content 28px;
  align-items: center;
  padding: 6px 12px;
  gap: 8px;
  white-space: nowrap;
}
.dsh-agy-account-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 28px;
  gap: 8px;
  align-items: start;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.dsh-agy-account-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-width: 0;
}
.dsh-agy-account-mail {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: inherit;
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary, CanvasText);
  text-align: left;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  min-width: 0;
  max-width: 100%;
}
.dsh-agy-account-mail:disabled { cursor: default; }
.dsh-agy-account-email-text {
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}
.dsh-agy-account-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  min-width: 16px;
  height: 16px;
  color: var(--dsw-alias-button-primary-fill, Highlight);
  flex-shrink: 0;
}
.dsh-agy-account-check.is-placeholder { visibility: hidden; }
.dsh-agy-account-action {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 28px;
  min-width: 28px;
  height: 28px;
  flex-shrink: 0;
}
.dsh-agy-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 4px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary, GrayText);
  cursor: pointer;
  box-sizing: border-box;
}
.dsh-agy-btn-icon.is-remove-btn:is(:hover, :focus-visible):not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  color: var(--dsw-alias-state-error-primary, CanvasText);
  border-color: var(--dsw-alias-state-error-primary, CanvasText);
}
.dsh-agy-btn-icon:disabled { opacity: 0.5; cursor: not-allowed; }
.dsh-agy-remove-control {
  position: relative;
  display: inline-flex;
  width: 28px;
  height: 28px;
}
.dsh-agy-remove-tooltip {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 2;
  width: max-content;
  max-width: 200px;
  padding-top: 4px;
  cursor: default;
  pointer-events: auto;
  visibility: hidden;
}
.dsh-agy-remove-tooltip.is-visible { visibility: visible; }
.dsh-agy-remove-tooltip-text {
  display: block;
  padding: 4px 8px;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-2, Canvas);
  color: var(--dsw-alias-label-primary, CanvasText);
  font-size: 11px;
  line-height: 14px;
  font-weight: 400;
  white-space: normal;
  overflow-wrap: anywhere;
}
.dsh-agy-account-quota-state {
  font-size: 11px;
  line-height: 14px;
  color: var(--dsw-alias-label-secondary, GrayText);
  overflow-wrap: anywhere;
}
/* Columns contribute to shared label, track, and reset rows. */
.dsh-agy-account-metrics {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto 4px auto auto 4px auto;
  row-gap: var(--quota-track-gap);
  column-gap: 16px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.dsh-agy-quota-col {
  display: contents;
  --quota-column: 1;
  --quota-label-row: 1;
  --quota-track-row: 2;
  --quota-reset-row: 3;
}
.dsh-agy-quota-col:nth-child(2) {
  --quota-label-row: 4;
  --quota-track-row: 5;
  --quota-reset-row: 6;
}
.dsh-agy-quota-row-label {
  grid-column: var(--quota-column);
  grid-row: var(--quota-label-row);
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.dsh-agy-quota-col:nth-child(2) .dsh-agy-quota-row-label {
  margin-top: calc(var(--quota-cell-gap) - var(--quota-track-gap));
}
.dsh-agy-quota-period {
  min-width: 0;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  color: var(--dsw-alias-label-primary, CanvasText);
  overflow-wrap: anywhere;
}
.dsh-agy-quota-pct {
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary, CanvasText);
  white-space: nowrap;
}
.dsh-agy-quota-track {
  grid-column: var(--quota-column);
  grid-row: var(--quota-track-row);
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--dsw-alias-border-l3, GrayText);
  overflow: hidden;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: none;
}
.dsh-agy-capsule-fill { height: 100%; border-radius: 2px; transition: width 0.3s ease; }
.dsh-agy-capsule-fill.is-high { background: var(--dsw-alias-state-success-primary, CanvasText); }
.dsh-agy-capsule-fill.is-med { background: var(--dsw-alias-state-warn-primary, CanvasText); }
.dsh-agy-capsule-fill.is-low { background: var(--dsw-alias-state-error-primary, CanvasText); }
.dsh-agy-quota-reset {
  grid-column: var(--quota-column);
  grid-row: var(--quota-reset-row);
  min-width: 0;
  min-height: 14px;
  font-size: 11px;
  line-height: 14px;
  color: var(--dsw-alias-label-secondary, GrayText);
  white-space: normal;
  overflow-wrap: anywhere;
}
@container agy-accounts (min-width: 440px) {
  .dsh-agy-account-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: auto 4px auto;
  }
  .dsh-agy-quota-col:nth-child(2) {
    --quota-column: 2;
    --quota-label-row: 1;
    --quota-track-row: 2;
    --quota-reset-row: 3;
  }
  .dsh-agy-quota-col:nth-child(2) .dsh-agy-quota-row-label { margin-top: 0; }
}

/* Compact rows reserve quota and action space. Only the identity can shrink. */
.dsh-agy-account.is-compact .dsh-agy-account-header { display: contents; }
.dsh-agy-account.is-compact .dsh-agy-account-info {
  grid-column: 1;
  grid-row: 1;
  flex-wrap: nowrap;
  gap: 4px;
}
.dsh-agy-account.is-compact .dsh-agy-account-mail { flex: 1; }
.dsh-agy-account.is-compact .dsh-agy-account-email-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow-wrap: normal;
}
.dsh-agy-account.is-compact .dsh-agy-status-badge {
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  padding: 0;
}
.dsh-agy-account.is-compact .dsh-agy-account-action { grid-column: 3; grid-row: 1; }
.dsh-agy-account.is-compact .dsh-agy-account-metrics {
  grid-column: 2;
  grid-row: 1;
  grid-template-columns: repeat(2, max-content);
  grid-template-rows: auto;
  column-gap: 12px;
  row-gap: 0;
  width: auto;
}
.dsh-agy-account.is-compact .dsh-agy-quota-col { display: block; }
.dsh-agy-account.is-compact .dsh-agy-quota-row-label {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  white-space: nowrap;
}
.dsh-agy-account.is-compact .dsh-agy-quota-col:nth-child(2) .dsh-agy-quota-row-label { margin-top: 0; }
.dsh-agy-account.is-compact .dsh-agy-quota-track,
.dsh-agy-account.is-compact .dsh-agy-quota-reset,
.dsh-agy-account.is-compact .dsh-agy-account-quota-state { display: none; }

/* Reserve three tabular digits plus one em for '%' in both compact layouts. */
.dsh-agy-account.is-compact .dsh-agy-quota-pct { min-width: calc(3ch + 1em); text-align: right; }
.dsh-agy-account.is-compact .dsh-agy-quota-pct.is-high { color: var(--dsw-alias-state-success-primary, CanvasText); }
.dsh-agy-account.is-compact .dsh-agy-quota-pct.is-med { color: var(--dsw-alias-state-warn-primary, CanvasText); }
.dsh-agy-account.is-compact .dsh-agy-quota-pct.is-low { color: var(--dsw-alias-state-error-primary, CanvasText); }
.dsh-agy-account.is-compact .dsh-agy-quota-pct.is-unknown { color: var(--dsw-alias-label-secondary, GrayText); }

/* Compact rows share the list's columns, so 5h and 7d line up whatever their values. */
@supports (grid-template-columns: subgrid) {
  .dsh-agy-account-list.is-compact-mode {
    display: grid;
    grid-template-columns: minmax(0, 1fr) max-content max-content max-content;
    column-gap: 12px;
    align-content: start;
  }
  .dsh-agy-account-list.is-compact-mode > * { grid-column: 1 / -1; }
  .dsh-agy-account-list.is-compact-mode > .dsh-agy-account.is-compact {
    grid-template-columns: subgrid;
    column-gap: 12px;
  }
  .dsh-agy-account-list.is-compact-mode .dsh-agy-account-metrics { display: contents; }
  .dsh-agy-account-list.is-compact-mode .dsh-agy-quota-col:nth-child(1) { grid-column: 2; grid-row: 1; }
  .dsh-agy-account-list.is-compact-mode .dsh-agy-quota-col:nth-child(2) { grid-column: 3; grid-row: 1; }
  .dsh-agy-account-list.is-compact-mode .dsh-agy-quota-row-label { justify-content: space-between; }
  .dsh-agy-account-list.is-compact-mode .dsh-agy-account-action { grid-column: 4; }
}

/* Radio Cards (Advanced) */
.dsh-agy-radio-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  user-select: none;
}
.dsh-agy-radio-card:hover {
  border-color: var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
}
.dsh-agy-radio-card.is-active {
  border-color: var(--dsw-alias-button-primary-fill, Highlight);
  background: rgba(22, 119, 255, 0.06);
}
.dsh-agy-custom-radio {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dsh-agy-radio-card.is-active .dsh-agy-custom-radio {
  border-color: var(--dsw-alias-button-primary-fill, Highlight);
}
.dsh-agy-custom-radio-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: transparent;
}
.dsh-agy-radio-card.is-active .dsh-agy-custom-radio-dot {
  background: var(--dsw-alias-button-primary-fill, Highlight);
}

/* Quick Setup & Terminal */
.dsh-agy-code-terminal {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2, Canvas);
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  color: var(--dsw-alias-label-primary, CanvasText);
}
.dsh-agy-chip {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  color: var(--dsw-alias-label-secondary, GrayText);
  transition: all 0.15s ease;
}
.dsh-agy-chip:hover {
  border-color: var(--dsw-alias-button-primary-fill, Highlight);
  color: var(--dsw-alias-label-primary, CanvasText);
}
.dsh-agy-link {
  color: var(--dsw-alias-button-primary-fill, Highlight);
  text-decoration: none;
}
.dsh-agy-link:hover {
  text-decoration: underline;
}
.dsh-agy-link-btn { padding: 0; border: 0; background: none; font: inherit; font-size: inherit; cursor: pointer; }
.dsh-agy-link-btn:disabled { opacity: .5; cursor: not-allowed; }
.dsh-agy-segmented-btn { display: inline-flex; align-items: center; gap: 6px; }
.dsh-agy-radio-card, .dsh-agy-segmented { min-width: 0; flex-wrap: wrap; }
.dsh-agy-radio-card:has(input:disabled), .dsh-agy-segmented-btn:has(input:disabled) { cursor: not-allowed; opacity: .6; }
.dsh-agy-choice-label { min-width: 0; overflow-wrap: anywhere; }
.dsh-agy-toolbar-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.dsh-agy-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.dsh-agy-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.dsh-agy-muted, .dsh-agy-choice-description { color: var(--dsw-alias-label-secondary, GrayText); }
.dsh-agy-control-label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
.dsh-agy-choice-label { color: var(--dsw-alias-label-primary, CanvasText); }
.dsh-agy-feedback { color: var(--dsw-alias-state-success-primary, CanvasText); overflow-wrap: anywhere; }
.dsh-agy-feedback.is-error { color: var(--dsw-alias-state-error-primary, CanvasText); }
.dsh-agy-proxy-route { overflow-wrap: anywhere; min-width: 0; }
.dsh-agy-page :is(button, input, select, a):focus-visible { outline: 2px solid var(--dsw-alias-label-primary, Highlight); outline-offset: 2px; }
.dsh-agy-input::placeholder { color: var(--dsw-alias-label-secondary, GrayText); opacity: 1; }
.dsh-agy-page :is(input, select):disabled { opacity: .6; cursor: not-allowed; }

/* ---- Shared layout primitives (every tab uses these instead of inline styles) ---- */
.dsh-agy-stack { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.dsh-agy-stack.is-tight { gap: 6px; }
.dsh-agy-fieldset { border: 0; padding: 0; margin: 0; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.dsh-agy-fieldset > legend { padding: 0; margin-bottom: 6px; }

/* Card header: title and one-line description on the left, a trailing control on the right. */
.dsh-agy-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}
.dsh-agy-section-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dsh-agy-section-title {
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, CanvasText);
}
.dsh-agy-section-desc {
  margin: 0;
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary, GrayText);
  overflow-wrap: anywhere;
}
.dsh-agy-divider { height: 1px; border: 0; margin: 0; background: var(--dsw-alias-border-l3, GrayText); opacity: .7; }

/* Two fields side by side once the page is wide enough. */
.dsh-agy-field-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; min-width: 0; }
@container agy-settings (min-width: 460px) {
  .dsh-agy-field-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.dsh-agy-input-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.dsh-agy-input-row > .dsh-agy-input { flex: 1 1 auto; min-width: 0; }
.dsh-agy-input-row > .dsh-agy-btn { flex: 0 0 auto; }
.dsh-agy-mono, .dsh-agy-input.dsh-agy-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
}
.dsh-agy-hint { margin: 0; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary, GrayText); }

/* Toggle switch: a native checkbox restyled, so labels, forms and keyboard keep working. */
.dsh-agy-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-primary, CanvasText);
  cursor: pointer;
  user-select: none;
  min-width: 0;
}
.dsh-agy-switch input {
  appearance: none;
  -webkit-appearance: none;
  position: relative;
  flex: 0 0 auto;
  width: 30px;
  height: 18px;
  margin: 0;
  border-radius: 9px;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.dsh-agy-switch input::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--dsw-alias-label-secondary, GrayText);
  transition: transform 0.15s ease, background 0.15s ease;
}
.dsh-agy-switch input:checked {
  background: var(--dsw-alias-button-primary-fill, Highlight);
  border-color: var(--dsw-alias-button-primary-fill, Highlight);
}
.dsh-agy-switch input:checked::after {
  transform: translateX(12px);
  background: var(--dsw-alias-label-primary-foreground, HighlightText);
}
.dsh-agy-switch:has(input:disabled) { cursor: not-allowed; opacity: .6; }

/* Status strip: one line that says what is running, where, and how healthy. */
.dsh-agy-status-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-width: 0;
}
.dsh-agy-status-main { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dsh-agy-status-label { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--dsw-alias-label-primary, CanvasText); }
.dsh-agy-status-meta { font-size: 11px; color: var(--dsw-alias-label-secondary, GrayText); overflow-wrap: anywhere; }
.dsh-agy-dot.is-warn { background: var(--dsw-alias-state-warn-primary, CanvasText); }
.dsh-agy-dot.is-pulse { animation: dsh-agy-pulse 1.2s ease-in-out infinite; }
@keyframes dsh-agy-pulse { 50% { opacity: .35; } }

/* Health tiles: small independent checks shown side by side. */
.dsh-agy-health {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 6px;
}
.dsh-agy-health-tile {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  min-width: 0;
}
.dsh-agy-health-name { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--dsw-alias-label-primary, CanvasText); }
.dsh-agy-health-detail { font-size: 11px; color: var(--dsw-alias-label-secondary, GrayText); overflow-wrap: anywhere; }

/* Pills: compact facts such as latency or a model count. */
.dsh-agy-pills { display: flex; flex-wrap: wrap; gap: 4px; }
.dsh-agy-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  font-size: 11px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary, GrayText);
  white-space: nowrap;
}
.dsh-agy-pill.is-success { color: var(--dsw-alias-state-success-primary, CanvasText); border-color: rgba(65, 201, 119, 0.4); }
.dsh-agy-pill.is-warn { color: var(--dsw-alias-state-warn-primary, CanvasText); border-color: rgba(250, 140, 22, 0.4); }
.dsh-agy-pill.is-error { color: var(--dsw-alias-state-error-primary, CanvasText); border-color: rgba(242, 90, 90, 0.4); }

/* Callout: one explanatory paragraph that should not look like an error. */
.dsh-agy-callout {
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  border-left: 3px solid var(--dsw-alias-button-primary-fill, Highlight);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary, GrayText);
}
.dsh-agy-callout.is-warn { border-left-color: var(--dsw-alias-state-warn-primary, CanvasText); }

/* Code block for copyable snippets. */
.dsh-agy-pre {
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-bg-layer-2, Canvas);
  color: var(--dsw-alias-label-primary, CanvasText);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 16px;
  overflow-x: auto;
  white-space: pre;
}
.dsh-agy-code-terminal > code { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Selectable rows (model list): the account list's divider rhythm with a leading checkbox. */
.dsh-agy-option-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  border-radius: 6px;
  overflow: hidden;
}
.dsh-agy-option {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) max-content;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.15s ease;
  min-width: 0;
}
.dsh-agy-option + .dsh-agy-option { border-top: 1px solid var(--dsw-alias-border-l3, GrayText); }
.dsh-agy-option:hover { background: var(--dsw-alias-interactive-bg-hover, ButtonFace); }
.dsh-agy-option.is-active { background: rgba(22, 119, 255, 0.06); }
.dsh-agy-option input { margin: 0; accent-color: var(--dsw-alias-button-primary-fill, Highlight); cursor: pointer; }
.dsh-agy-option-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.dsh-agy-option-name { font-size: 12px; line-height: 18px; font-weight: 500; color: var(--dsw-alias-label-primary, CanvasText); overflow-wrap: anywhere; }
.dsh-agy-option-meta {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  line-height: 14px;
  color: var(--dsw-alias-label-secondary, GrayText);
  overflow-wrap: anywhere;
}
.dsh-agy-option:has(input:disabled) { cursor: not-allowed; opacity: .6; }
.dsh-agy-radio-card input[type="radio"] { margin: 0; accent-color: var(--dsw-alias-button-primary-fill, Highlight); }
.dsh-agy-segmented-btn input[type="radio"] { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.dsh-agy-segmented-btn { position: relative; }
.dsh-agy-segmented-btn:has(input:focus-visible) { outline: 2px solid var(--dsw-alias-label-primary, Highlight); outline-offset: 1px; }
.dsh-agy-radio-card > .dsh-agy-pill { margin-left: auto; }
.dsh-agy-range { width: 100%; accent-color: var(--dsw-alias-button-primary-fill, Highlight); }

/* Summary bar above the account list. */
.dsh-agy-summary { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.dsh-agy-summary-main { display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }

@media (prefers-reduced-motion: reduce) {
  .dsh-agy-page *, .dsh-agy-toast-float { animation: none !important; transition: none !important; }
}
`;
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
		//#endregion
		//#region src/client/Settings.tsx
		const STATUS_PATH = "/plugins/dsh-antigravity-oauth/auth/status";
		const LOGIN_PATH = "/plugins/dsh-antigravity-oauth/auth/login";
		const COMPLETE_PATH = "/plugins/dsh-antigravity-oauth/auth/complete";
		const SWITCH_PATH = "/plugins/dsh-antigravity-oauth/auth/accounts/switch";
		const REMOVE_PATH = "/plugins/dsh-antigravity-oauth/auth/accounts/remove";
		const QUOTAS_PATH = "/plugins/dsh-antigravity-oauth/auth/accounts/quotas";
		const ADVANCED_PATH = "/plugins/dsh-antigravity-oauth/advanced";
		const NETWORK_PATH = "/plugins/dsh-antigravity-oauth/network";
		const API_SERVER_PATH = "/plugins/dsh-antigravity-oauth/api-server";
		const AVAILABLE_MODELS_PATH = "/plugins/dsh-antigravity-oauth/models/available";
		const WEB2API_SETTINGS_PATH = "/plugins/dsh-antigravity-oauth/web2api/settings";
		const WEB2API_TEST_PATH = "/plugins/dsh-antigravity-oauth/web2api/test";
		const MANAGER_SETTINGS_PATH = "/plugins/dsh-antigravity-oauth/manager/settings";
		const MANAGER_TEST_PATH = "/plugins/dsh-antigravity-oauth/manager/test";
		const DOCKER_CMD = "docker run -d --name gemini-web2api -p 18088:18088 zexadev/gemini-web2api-go:latest";
		const COMPACT_VIEW_KEY = "dsh-antigravity-oauth.compact-view";
		const DISMISSED_BANNER_KEY = "dsh-antigravity-oauth.dismissed-banner";
		const DISMISSED_WEB2API_GUIDE_KEY = "dsh-antigravity-oauth.dismissed-web2api-guide";
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
			const accountAction = (0, react.useRef)(false);
			const [switchingId, setSwitchingId] = (0, react.useState)(null);
			const [draft, setDraft] = (0, react.useState)("");
			const [quotas, setQuotas] = (0, react.useState)({});
			const [loadingQuotas, setLoadingQuotas] = (0, react.useState)(false);
			const [searchQuery, setSearchQuery] = (0, react.useState)("");
			const [compactView, setCompactViewState] = (0, react.useState)(() => {
				try {
					return localStorage.getItem(COMPACT_VIEW_KEY) === "true";
				} catch {
					return false;
				}
			});
			const setCompactView = (compact) => {
				setCompactViewState(compact);
				try {
					localStorage.setItem(COMPACT_VIEW_KEY, String(compact));
				} catch {}
			};
			const [sortBy, setSortBy] = (0, react.useState)("default");
			const [advancedEffort, setAdvancedEffort] = (0, react.useState)("medium");
			const [advancedContextWindow, setAdvancedContextWindow] = (0, react.useState)(1048576);
			const [advancedStrategy, setAdvancedStrategy] = (0, react.useState)("failover_429");
			const [advancedThreshold, setAdvancedThreshold] = (0, react.useState)(20);
			const [advancedEnabledModels, setAdvancedEnabledModels] = (0, react.useState)(["gemini-3.8-flash"]);
			const [availableModels, setAvailableModels] = (0, react.useState)([...DEFAULT_CATALOG_MODELS]);
			const [savingAdvanced, setSavingAdvanced] = (0, react.useState)(false);
			const [apiServerSettings, setApiServerSettings] = (0, react.useState)(DEFAULT_API_SERVER_SETTINGS);
			const [apiServerStatus, setApiServerStatus] = (0, react.useState)({
				running: false,
				host: "127.0.0.1",
				port: 18045
			});
			const [savingApiServer, setSavingApiServer] = (0, react.useState)(false);
			const [bridgeSettings, setBridgeSettings] = (0, react.useState)();
			const [bannerDismissed, setBannerDismissed] = (0, react.useState)(() => {
				try {
					return localStorage.getItem(DISMISSED_BANNER_KEY) === "true";
				} catch {
					return false;
				}
			});
			const [guideDismissed, setGuideDismissed] = (0, react.useState)(() => {
				try {
					return localStorage.getItem(DISMISSED_WEB2API_GUIDE_KEY) === "true";
				} catch {
					return false;
				}
			});
			const [network, setNetwork] = (0, react.useState)();
			const [networkMessage, setNetworkMessage] = (0, react.useState)("");
			const [networkError, setNetworkError] = (0, react.useState)(false);
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
			const refreshQuotas = (0, react.useCallback)(async (announce = false) => {
				setLoadingQuotas(true);
				setError(void 0);
				try {
					const res = await jsonRequest(QUOTAS_PATH);
					if (res?.quotas) {
						setQuotas(res.quotas);
						if (announce) {
							setToastMessage(t("quotasRefreshed"));
							setTimeout(() => setToastMessage(null), 2500);
						}
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
						if (Array.isArray(res.settings.enabledModels) && res.settings.enabledModels.length > 0) setAdvancedEnabledModels(res.settings.enabledModels);
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
						proactiveThreshold: advancedThreshold,
						enabledModels: advancedEnabledModels
					});
					setToastMessage(t("advancedSaved"));
					setTimeout(() => setToastMessage(null), 3e3);
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : "Failed to save advanced settings");
				} finally {
					setSavingAdvanced(false);
				}
			};
			const loadApiServer = (0, react.useCallback)(async () => {
				try {
					const res = await jsonRequest(API_SERVER_PATH);
					if (res?.settings) setApiServerSettings(res.settings);
					if (res?.status) setApiServerStatus(res.status);
				} catch {}
			}, []);
			const saveApiServerSettings = async (partial) => {
				setSavingApiServer(true);
				setError(void 0);
				try {
					const nextSettings = {
						...apiServerSettings,
						...partial
					};
					const res = await jsonRequest(API_SERVER_PATH, "POST", nextSettings);
					if (res?.settings) setApiServerSettings(res.settings);
					if (res?.status) setApiServerStatus(res.status);
					setToastMessage(t("saveSettings"));
					setTimeout(() => setToastMessage(null), 2500);
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : "Failed to save API server settings");
				} finally {
					setSavingApiServer(false);
				}
			};
			const regenerateApiKey = () => {
				const chars = "0123456789abcdef";
				let rand = "";
				for (let i = 0; i < 32; i++) rand += chars[Math.floor(Math.random() * 16)];
				const newKey = `sk-agy-${rand}`;
				setApiServerSettings((prev) => ({
					...prev,
					apiKey: newKey
				}));
			};
			const loadBridge = (0, react.useCallback)(async () => {
				try {
					setBridgeSettings(await jsonRequest(MANAGER_SETTINGS_PATH));
				} catch {}
			}, []);
			const saveBridge = async (patch) => {
				const saved = await jsonRequest(MANAGER_SETTINGS_PATH, "POST", patch);
				setBridgeSettings(saved);
				return saved;
			};
			const testBridge = (target) => jsonRequest(MANAGER_TEST_PATH, "POST", target);
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
			const loadAvailableModels = (0, react.useCallback)(async () => {
				try {
					const res = await jsonRequest(AVAILABLE_MODELS_PATH);
					if (res?.models && Array.isArray(res.models) && res.models.length > 0) setAvailableModels(res.models);
				} catch {}
			}, []);
			(0, react.useEffect)(() => {
				refresh();
				refreshQuotas();
				loadNetwork();
				loadWeb2Api();
				loadAdvanced();
				loadApiServer();
				loadAvailableModels();
				loadBridge();
			}, [
				refresh,
				refreshQuotas,
				loadNetwork,
				loadWeb2Api,
				loadAdvanced,
				loadApiServer,
				loadAvailableModels,
				loadBridge
			]);
			const dismissGuide = () => {
				setGuideDismissed(true);
				try {
					localStorage.setItem(DISMISSED_WEB2API_GUIDE_KEY, "true");
				} catch {}
			};
			const restoreGuide = () => {
				setGuideDismissed(false);
				try {
					localStorage.removeItem(DISMISSED_WEB2API_GUIDE_KEY);
				} catch {}
			};
			const dismissBanner = () => {
				setBannerDismissed(true);
				try {
					localStorage.setItem(DISMISSED_BANNER_KEY, "true");
				} catch {}
			};
			const restoreBanner = () => {
				setBannerDismissed(false);
				try {
					localStorage.removeItem(DISMISSED_BANNER_KEY);
				} catch {}
			};
			const saveNetwork = async () => {
				if (!network) return;
				setSavingNetwork(true);
				setNetworkMessage("");
				setNetworkError(false);
				try {
					const saved = await jsonRequest(NETWORK_PATH, "POST", network);
					setNetwork(saved);
					setNetworkMessage(t("networkSaved"));
				} catch (e) {
					setNetworkError(true);
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
				if (busy || switchingId || accountAction.current) return;
				accountAction.current = true;
				setBusy(true);
				try {
					const challenge = await jsonRequest(LOGIN_PATH, "POST");
					if (typeof window !== "undefined") window.open(challenge.url, "_blank", "noopener,noreferrer");
					refresh();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				} finally {
					accountAction.current = false;
					setBusy(false);
				}
			};
			const complete = async () => {
				if (draft.trim().length === 0 || busy || switchingId || accountAction.current) return;
				accountAction.current = true;
				setBusy(true);
				try {
					await jsonRequest(COMPLETE_PATH, "POST", { url: draft.trim() });
					setDraft("");
					refresh();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				} finally {
					accountAction.current = false;
					setBusy(false);
				}
			};
			const switchAccount = async (targetAccount) => {
				if (busy || switchingId || accountAction.current) return;
				accountAction.current = true;
				setSwitchingId(targetAccount.id);
				setError(void 0);
				try {
					const res = await jsonRequest(SWITCH_PATH, "POST", { id: targetAccount.id });
					if (res?.account) setStatus(res.account);
					else await refresh();
					setToastMessage(t("accountSwitched", { email: targetAccount.email ?? targetAccount.id }));
					setTimeout(() => setToastMessage(null), 3e3);
				} catch (caught) {
					await refresh();
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				} finally {
					accountAction.current = false;
					setSwitchingId(null);
				}
			};
			const removeAccount = async (id) => {
				if (busy || switchingId || accountAction.current) return;
				accountAction.current = true;
				setBusy(true);
				try {
					await jsonRequest(REMOVE_PATH, "POST", { id });
					refresh();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				} finally {
					accountAction.current = false;
					setBusy(false);
				}
			};
			const recover = async (action) => {
				if (busy || switchingId || accountAction.current) return;
				accountAction.current = true;
				setBusy(true);
				try {
					await jsonRequest("/plugins/dsh-antigravity-oauth/auth/" + action, "POST");
					setDraft("");
					refresh();
				} catch (caught) {
					setError(caught instanceof Error ? caught.message : t("requestFailed"));
				} finally {
					accountAction.current = false;
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
					const qa = evaluateQuotaMetrics(quotas[a.id])?.score ?? -1;
					return (evaluateQuotaMetrics(quotas[b.id])?.score ?? -1) - qa;
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
			const readyCount = (0, react.useMemo)(() => accounts.filter((a) => a.ready && !a.dead && !a.limited).length, [accounts]);
			const bridgeOn = bridgeSettings?.enabled === true;
			const tabs = [
				{
					id: "accounts",
					label: t("tabAccounts")
				},
				{
					id: "bridge",
					label: t("tabBridge"),
					on: bridgeOn
				},
				{
					id: "advanced",
					label: t("tabAdvanced")
				},
				{
					id: "api-server",
					label: t("tabApiServer"),
					on: apiServerStatus.running
				},
				{
					id: "web2api",
					label: t("tabWeb2api"),
					on: web2apiEnabled
				},
				{
					id: "network",
					label: t("tabNetwork")
				}
			];
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
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
									id: "antigravity-settings-title",
									className: "dsh-agy-title",
									children: t("title")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsh-agy-header-active-badge",
									title: activeAccount ? activeAccount.email ?? activeAccount.id : t("signedOut"),
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dsh-agy-dot " + (signing ? "is-signing-in" : activeAccount?.ready ? "is-signed-in" : "is-error") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: signing ? t("signingIn") : activeAccount ? activeAccount.email ?? activeAccount.id : t("signedOut") })]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh-agy-pill " + (bridgeOn ? "is-success" : ""),
									title: bridgeOn ? t("bridgeStatusOn") : t("bridgeStatusOff"),
									children: bridgeOn ? t("routeBridge") : t("routeDirect")
								})
							]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("nav", {
							className: "dsh-agy-tabs",
							role: "tablist",
							children: tabs.map((tab) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "tab",
								"aria-selected": activeTab === tab.id,
								className: "dsh-agy-tab-btn " + (activeTab === tab.id ? "is-active" : ""),
								onClick: () => setActiveTab(tab.id),
								children: [tab.on !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsh-agy-dot " + (tab.on ? "is-signed-in" : ""),
									style: {
										width: "6px",
										height: "6px"
									}
								}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: tab.label })]
							}, tab.id))
						})]
					}),
					!bannerDismissed ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsh-agy-notice-banner",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "dsh-agy-body",
							style: { margin: 0 },
							children: t("tos")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh-agy-notice-close",
							"aria-label": t("dismissNotice"),
							title: t("dismissNotice"),
							onClick: dismissBanner,
							children: "×"
						})]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsh-agy-actions",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsh-agy-btn dsh-agy-btn-secondary",
							onClick: restoreBanner,
							children: t("restoreNotice")
						})
					}),
					error ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						className: "dsh-agy-error",
						role: "alert",
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
									className: "dsh-agy-summary",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-agy-summary-main",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: "dsh-agy-dot " + (signing ? "is-signing-in is-pulse" : activeAccount?.ready ? "is-signed-in" : "is-error") }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsh-agy-status-label",
												style: { fontSize: "12px" },
												children: signing ? t("signingIn") : activeAccount ? activeAccount.ready ? t("signedIn") : t("authorized") : t("signedOut")
											}),
											accounts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsh-agy-status-meta",
												children: t("accountsSummary", {
													ready: readyCount,
													total: accounts.length
												})
											}) : null
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsh-agy-actions",
										children: [signing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
											disabled: busy || Boolean(switchingId),
											onClick: () => {
												recover("cancel");
											},
											children: t("cancel")
										}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-agy-btn dsh-agy-btn-primary dsh-agy-btn-compact",
											disabled: busy || Boolean(switchingId),
											onClick: () => {
												signIn();
											},
											children: busy ? t("working") : accounts.length === 0 ? t("login") : t("addAccount")
										}), accounts.length > 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: "dsh-agy-btn dsh-agy-btn-secondary dsh-agy-btn-compact",
											disabled: busy || Boolean(switchingId) || loadingQuotas,
											onClick: () => {
												refreshQuotas(true);
											},
											children: loadingQuotas ? t("working") : t("refreshQuotas")
										}) : null]
									})]
								})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(AccountsTab, {
								t,
								language: t("quotaLanguage") === "zh" ? "zh" : "en",
								accounts,
								activeAccountId,
								activeAccount,
								switchingId,
								busy,
								searchQuery,
								setSearchQuery,
								sortBy,
								setSortBy,
								compactView,
								setCompactView,
								quotas,
								filteredAccounts,
								switchAccount,
								removeAccount,
								recover
							}),
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
										"aria-label": t("completePlaceholder"),
										placeholder: t("completePlaceholder"),
										value: draft,
										disabled: busy || Boolean(switchingId),
										onChange: (e) => setDraft(e.target.value)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "submit",
										className: "dsh-agy-btn dsh-agy-btn-primary",
										disabled: busy || Boolean(switchingId) || draft.trim().length === 0,
										children: busy ? t("working") : t("complete")
									})]
								})]
							}) : null
						]
					}) : null,
					activeTab === "bridge" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ManagerTab, {
						t,
						settings: bridgeSettings,
						enabledModels: advancedEnabledModels,
						save: saveBridge,
						test: testBridge
					}) : null,
					activeTab === "advanced" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AdvancedTab, {
						t,
						advancedEffort,
						setAdvancedEffort,
						advancedContextWindow,
						setAdvancedContextWindow,
						advancedStrategy,
						setAdvancedStrategy,
						advancedThreshold,
						setAdvancedThreshold,
						advancedEnabledModels,
						setAdvancedEnabledModels,
						availableModels,
						savingAdvanced,
						saveAdvanced: () => {
							saveAdvanced();
						}
					}) : null,
					activeTab === "api-server" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ApiServerTab, {
						t,
						settings: apiServerSettings,
						status: apiServerStatus,
						saving: savingApiServer,
						saveSettings: saveApiServerSettings,
						regenerateKey: regenerateApiKey
					}) : null,
					activeTab === "web2api" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Web2ApiTab, {
						t,
						guideDismissed,
						dismissGuide,
						restoreGuide,
						dockerCmd: DOCKER_CMD,
						copiedDocker,
						copyDockerCommand,
						web2apiDetecting,
						detectLocalGateway: () => {
							detectLocalGateway();
						},
						web2apiEnabled,
						setWeb2apiEnabled,
						web2apiSaving,
						web2apiBaseUrl,
						setWeb2apiBaseUrl,
						web2apiApiKey,
						setWeb2apiApiKey,
						web2apiImageTool,
						setWeb2apiImageTool,
						saveWeb2Api: () => {
							saveWeb2Api();
						},
						web2apiTesting,
						testWeb2Api: () => {
							testWeb2Api();
						},
						web2apiFeedback
					}) : null,
					activeTab === "network" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(NetworkTab, {
						t,
						network,
						setNetwork,
						savingNetwork,
						saveNetwork: () => {
							saveNetwork();
						},
						networkMessage,
						networkError
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
			quota5h: "5h",
			quotaWeekly: "Weekly",
			quota5hCompact: "5h",
			quotaWeeklyCompact: "7d",
			quotaResetsIn: "Resets in",
			effectiveQuota: "Effective",
			quotaUnavailable: "Quota unavailable",
			quotaPending: "Awaiting quota data",
			quotaResetDue: "Reset due",
			currentAccountAria: "{email}, current account",
			meterUnknownAria: "{period} quota, value unavailable",
			meterPendingAria: "{period} quota, awaiting data",
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
			resetsIn: "Resets in {time}",
			removeAccountAria: "Remove {email}",
			meterAria: "{period} quota, {pct}% remaining",
			dismissNotice: "Dismiss notice",
			restoreNotice: "Show login notice",
			quotaLanguage: "en",
			enabledModelsTitle: "Enabled Models",
			modelDefault: "Default",
			modelArgonNote: "Requires Argon entitlement",
			tabApiServer: "API Server",
			apiServerRunning: "API Server is running",
			apiServerStopped: "API Server is stopped",
			apiServerEnable: "Start Server",
			apiServerDisable: "Stop Server",
			apiServerBaseUrl: "OpenAI Base URL",
			apiServerKey: "API Key (Bearer Token)",
			apiServerRegenerateKey: "Regenerate",
			apiServerHost: "Listen Address",
			apiServerPort: "Listen Port",
			apiServerQuickTest: "cURL Test Example",
			saveSettings: "Save Settings",
			tabBridge: "Route",
			accountBanned: "Disabled by Google (ToS)",
			bridgeTitle: "OpenAI-compatible gateway",
			routeTitle: "Request route",
			routeDesc: "Choose how this provider reaches Google. Takes effect on the next request.",
			routeDirectDesc: "The plugin calls Cloud Code Assist itself, using the accounts on the Accounts tab.",
			routeGatewayDesc: "Requests go to a local OpenAI-compatible gateway such as Antigravity Manager, which uses its own accounts and failover.",
			coreNote: "Official core: health only. Its generation API takes one plain-text prompt with no tools or streaming, so DSH chats cannot use it yet.",
			bridgeHelp: "Used when the route is Gateway. Any OpenAI-compatible endpoint works; Antigravity Manager adds an account pool, 429 failover and quota smoothing.",
			bridgeBaseUrl: "Gateway URL (Base URL)",
			bridgeApiKey: "API key",
			bridgeApiKeySaved: "Saved key {hint}. Leave empty to keep it.",
			bridgeApiKeyNone: "No key saved.",
			bridgeReveal: "Show",
			bridgeHide: "Hide",
			bridgeClearKey: "Clear saved key",
			bridgeTest: "Test connection",
			bridgeTesting: "Testing…",
			bridgeSave: "Save bridge settings",
			bridgeSaved: "Bridge settings saved.",
			bridgeConnected: "Connected in {latency} ms, {count} models available.",
			bridgeFailed: "Connection failed: {error}",
			bridgeGateway: "Gateway",
			bridgeCore: "Native core",
			bridgeUp: "Reachable",
			bridgeDown: "Not reachable",
			bridgeNotTested: "Not checked yet",
			bridgeStatusOn: "Route: Gateway",
			bridgeStatusOff: "Route: Direct",
			bridgeModelsMissing: "Not offered by the gateway: {models}. Requests for these models will fail while the bridge is on.",
			bridgeCallout: "The gateway calls Google itself with its own accounts and HTTP client; requests do not pass through the official core.",
			routeDirect: "Direct",
			routeBridge: "Gateway",
			accountsSummary: "{ready} of {total} accounts ready",
			quotasRefreshed: "Quotas refreshed.",
			modelsDesc: "Only checked models appear in the DSH model picker. At least one stays on.",
			effortDesc: "Used when a chat does not pick an effort.",
			contextDesc: "Caps the context window DSH plans for. Smaller windows compact sooner.",
			strategyDesc: "How a request moves between saved accounts when one runs out.",
			networkDesc: "How this plugin reaches Google. The bridge and local gateways always connect directly.",
			web2apiDesc: "Adds the separate “agy-web” provider backed by a Gemini Web gateway.",
			apiServerDesc: "Serves your Antigravity accounts as an OpenAI-compatible endpoint for other local apps.",
			apiServerRunningAt: "Listening on {address}",
			contextShort: "{size} context"
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
			quota5h: "5小时",
			quotaWeekly: "每周",
			quota5hCompact: "5时",
			quotaWeeklyCompact: "7天",
			quotaResetsIn: "重置于",
			effectiveQuota: "综合余量",
			quotaUnavailable: "配额不可用",
			quotaPending: "等待配额数据",
			quotaResetDue: "已到重置时间",
			currentAccountAria: "{email}，当前账号",
			meterUnknownAria: "{period}配额，余量未知",
			meterPendingAria: "{period}配额，等待数据",
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
			tabWeb2api: "Web2API",
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
			resetsIn: "{time}后重置",
			removeAccountAria: "删除 {email}",
			meterAria: "{period}配额，剩余{pct}%",
			dismissNotice: "隐藏此提示",
			restoreNotice: "显示登录提示",
			quotaLanguage: "zh",
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
			quotaFullyAvailable: "全满可用",
			enabledModelsTitle: "启用模型列表",
			modelDefault: "默认推荐",
			modelArgonNote: "需具备 Argon 资格",
			tabApiServer: "API 代理",
			apiServerRunning: "API 代理服务运行中",
			apiServerStopped: "API 代理服务已停止",
			apiServerEnable: "启动服务",
			apiServerDisable: "停止服务",
			apiServerBaseUrl: "兼容 Base URL",
			apiServerKey: "API 密钥 (Bearer Token)",
			apiServerRegenerateKey: "重新生成",
			apiServerHost: "监听地址",
			apiServerPort: "监听端口",
			apiServerQuickTest: "cURL 调用示例",
			saveSettings: "保存配置",
			tabBridge: "路由",
			accountBanned: "已被 Google 停用（违反条款）",
			bridgeTitle: "OpenAI 兼容网关",
			routeTitle: "请求路由",
			routeDesc: "选择本提供方访问 Google 的方式，下一次请求即生效。",
			routeDirectDesc: "插件自行调用 Cloud Code Assist，使用“账号”页中的账号。",
			routeGatewayDesc: "请求发送到本地 OpenAI 兼容网关（如 Antigravity Manager），由网关使用自己的账号与切换策略。",
			coreNote: "官方核心：仅显示健康状态。其生成接口只接受单段纯文本提示，不支持工具与流式输出，DSH 对话暂时无法使用。",
			bridgeHelp: "路由为“网关”时使用。任何 OpenAI 兼容接口均可；Antigravity Manager 另提供账号池、429 自动切换与配额平滑。",
			bridgeBaseUrl: "网关地址 (Base URL)",
			bridgeApiKey: "访问密钥 (API Key)",
			bridgeApiKeySaved: "已保存密钥 {hint}，留空则保持不变。",
			bridgeApiKeyNone: "尚未保存密钥。",
			bridgeReveal: "显示",
			bridgeHide: "隐藏",
			bridgeClearKey: "清除已保存密钥",
			bridgeTest: "测试连通性",
			bridgeTesting: "正在测试…",
			bridgeSave: "保存桥接配置",
			bridgeSaved: "桥接配置已保存。",
			bridgeConnected: "连接成功：{latency} ms，可用模型 {count} 个。",
			bridgeFailed: "连接失败：{error}",
			bridgeGateway: "网关",
			bridgeCore: "官方原生核心",
			bridgeUp: "可访问",
			bridgeDown: "无法访问",
			bridgeNotTested: "尚未检测",
			bridgeStatusOn: "路由：网关",
			bridgeStatusOff: "路由：直连",
			bridgeModelsMissing: "网关未提供：{models}。桥接开启时，这些模型的请求会失败。",
			bridgeCallout: "网关使用自己的账号与 HTTP 客户端直接请求 Google，请求不会经过官方核心。",
			routeDirect: "直连",
			routeBridge: "网关",
			accountsSummary: "{total} 个账号中 {ready} 个可用",
			quotasRefreshed: "配额已刷新。",
			modelsDesc: "只有勾选的模型会出现在 DSH 模型选择器中，至少保留一个。",
			effortDesc: "对话未指定思考档位时使用。",
			contextDesc: "限制 DSH 规划的上下文窗口，窗口越小越早压缩。",
			strategyDesc: "某个账号额度用尽时，请求如何切换到其他已保存账号。",
			networkDesc: "本插件访问 Google 的方式。桥接与本地网关始终直连。",
			web2apiDesc: "新增独立的 “agy-web” 提供方，由 Gemini 网页网关驱动。",
			apiServerDesc: "把你的 Antigravity 账号以 OpenAI 兼容接口提供给本机其他应用。",
			apiServerRunningAt: "监听于 {address}",
			contextShort: "{size} 上下文"
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