# Changelog

This file records completed features, fixes, and process milestones in `YukieMiona/dsh-antigravity-oauth`. Open tasks and acceptance rules live on [Issue 2](https://github.com/YukieMiona/dsh-antigravity-oauth/issues/2). Pull requests hold full test and review logs.

## Unreleased

- Q1: Cache account quotas for 60 seconds, rotate in memory without disk writes, retry across candidates, and persist custom Manager endpoints (#20).
- AM1: Automatically downgrade background compaction and session-title tasks to `gemini-3.8-flash` to save Argon quota (#19).
- R2b: Wire `switchingStrategy` (`manual`, `failover_429`, `round_robin`, `proactive_threshold`) across Flash and Argon account pools (#19).
- P5: Remove redundant `DSHX_HARNESS` git clone steps from GitHub Actions workflows (#19).
- UI1: Unify Accounts with sub-tabs for Native OAuth, Web2API, and Antigravity-Manager, and collapse top navigation to three tabs (#18).
- U2: Clamp out-of-range quota percentage values to `0%` through `100%` in text and `aria-valuenow` (#14, #18).
- R2: Add an interactive Argon toggle and status badge on account cards, and register the toggle route (#18).
- AM0: Add the Antigravity-Manager tab with direct status probe, copyable endpoints, and account export guidance (#18).

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
