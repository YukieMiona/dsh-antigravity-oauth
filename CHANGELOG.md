# Changelog

This file records completed features, fixes, and process milestones in `YukieMiona/dsh-antigravity-oauth`. Open tasks and acceptance rules live on [Issue 2](https://github.com/YukieMiona/dsh-antigravity-oauth/issues/2). Pull requests hold full test and review logs.

## Unreleased

Not yet through GitHub Actions; typecheck and bundle build pass locally.

- Bridge: route the `agy-google-antigravity` provider through a local OpenAI-compatible gateway (Antigravity Manager) when enabled, with full tool-call and tool-result translation, complete block lifecycles, usage, two gateway 5xx retries, and gateway plus native-core health probes. The API key never leaves the server (`GET` returns a masked view).
- Bridge: register the provider route while the bridge is on even without direct accounts, and keep DSH's own web tools on that route because native Google search exists only on the direct path.
- Stability: back off for 60 seconds after a failed model-catalog fetch and share one in-flight fetch, so a flaky upstream no longer stalls every model lookup.
- Stability: the local API server force-closes lingering sockets on stop and retries `EADDRINUSE` during hot reload instead of staying down.
- UI: add the Bridge tab; rebuild Advanced, API Server, Web2API and Network on shared primitives (section headers, switches, health tiles, option rows) in the Accounts tab's style; make the tab bar fit any tab count; mask the API server key by default; announce quota refreshes only when asked.

## v0.2.4.2 (2026-11-08)

Release `v0.2.4.2` adds background quota protection, multi-strategy account rotation, self-healing for bad images, extended idle timeouts, and restores the clean four-tab navigation. Every item below passed GitHub Actions gates on `dev`:

- UI: Restore clean four-tab navigation and remove experimental nested sub-tabs (#22).
- U2: Clamp out-of-range quota percentage values to `0%` through `100%` in text and `aria-valuenow` (#14, #18).
- AM2: Heal HTTP 400 bad-image rejections in place by blacklisting image IDs and retrying with text (#21).
- AM3: Rotate ready accounts on HTTP 503 capacity errors and distinguish account bans from model denials (#21).
- AM4: Extend first-byte idle timeout by 180 seconds for inline images and high reasoning effort (#21).
- P3: Add CONTRIBUTING.md documenting PR workflow, low-memory test constraints, and bundle builds (#21, `cde0253`).
- Q1: Cache account quotas for 60 seconds, rotate in memory without disk writes, and retry across candidates (#20).
- AM1: Automatically downgrade background compaction and session-title tasks to `gemini-3.8-flash` to save Argon quota (#19).
- R2b: Wire `switchingStrategy` (`manual`, `failover_429`, `round_robin`, `proactive_threshold`) across Flash and Argon account pools (#19).
- P5: Remove redundant `DSHX_HARNESS` git clone steps from GitHub Actions workflows (#19).

## v0.2.4.1 (2026-11-06)

Release `v0.2.4.1` (`06f8812`) adds Gemini 4 Argon routing, multimodal safety controls, dynamic context limits, and stream reliability fixes. Every item below passed GitHub Actions gates on `dev`. Each item names its board ID and pull request:

- C1: Apply dynamic context limits (128K, 256K, 512K, and 1M) and refresh routes on save (#17).
- I8: Port the turn-aware image sliding window and magic-byte header validation (#17).
- R1: Add Argon-aware account selection and isolated 403 and 429 account failover (#17).
- I7: Add an optional CCA route image upload kill-switch with abort safety (#16).
- U1: Align compact account quota columns and restore semantic colors (#15).
- M1: Add Gemini 4 Argon model routing and bump User-Agent to `2.29.0` (#13).
- S1: Make the Antigravity stream watchdog a real per-chunk idle timeout (#12).
- W3: Enforce `timeoutMs` on stalled Web2API streams (#11).
- T1, T2, and T3: Batch tool results by model turn, keep block order, and narrow image part types (#10).
- I3 and I4: Enforce the inline image request budget and keep saved paths on offloaded images (#8, #17).
- P2: Run type, test, and bundle build gates on pull requests and fork tags (#5, #9, `06f8812`).
- Send tool-result images inside `functionResponse.parts` (#6).
- I1: Send user photos on the Web2API route (#4).
- W1: Make sure that the system prompt reaches Web2API via `options.system` (2026-11-04).
- P1: Turn on GitHub Issues and move the project board to Issue 2 (#2).
- Send user photos to Gemini on the `agy-google-antigravity` route (`bdab7d7`).

## v0.2.4 and earlier

Earlier fork work added multi-account OAuth rotation, real-time 5-hour and weekly quota bars, persistent `thought_signature` storage, and the `gemini-web2api-go` bridge. Upstream commit `62d4721` merged cumulative SSE token usage deduplication. PR 1 from `@YiLianqaq` closed after `bdab7d7` fixed the photo drop bug, and its photo cases remain the I2 test reference.

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
