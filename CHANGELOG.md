# Changelog

This file records completed features, fixes, and process milestones in `YukieMiona/dsh-antigravity-oauth`. Open tasks and acceptance rules live on [Issue 2](https://github.com/YukieMiona/dsh-antigravity-oauth/issues/2). Pull requests hold full test and review logs.

## Unreleased

- Official CLI: a 429 `RESOURCE_EXHAUSTED` from Google stops the run at once (instead of `agy`'s eight silent retries), and no request goes to Google for 5 minutes afterwards, for any model (API server: 429 with `Retry-After`). Failures of DSH chats on this route are written to the service log.
- Official CLI: requests are sized in tokens within `agy`'s own cap of about 195K input tokens (measured; English, code and Chinese differ), up to about 185K tokens per request instead of 620 KB. Before, a long Chinese or code conversation could exceed the cap and fail outright. If `agy` still refuses an input as too large, the plugin retries with fewer earlier turns; after the last try DSH gets `CONTEXT_WINDOW_EXCEEDED` and the API server 400 `context_length_exceeded`. The reported window stays 192K with an 8K output reserve (DSH compacts at about 123K tokens).
- Official CLI: the conversation `agy` saves for each plugin run is deleted afterwards (about 90 MB a day at a chat bot's volume, and it held the full prompt). Error text from `agy`'s result is now part of the error message.
- Official CLI: switching a chat to this route no longer fails with "leaving no pressure budget". The route reports a 192K-token window with a 16K output reserve (DSH compacts at about 115K tokens); on other routes the output reserve is at most a quarter of the window, so the 128K choice on the Advanced tab works too.
- Official CLI: the plugin turns off `agy`'s background self-update for the processes it starts (`AGY_CLI_DISABLE_AUTO_UPDATE=true`, built into `agy` 1.5.9). The version no longer changes between two requests, and no updater process starts every 15 minutes. Run `agy update` to update.
- Official CLI: a second `agy` process may run beside the first while the host has at least 700 MB available; a model that Google refused for capacity is held back for 45 seconds; the plugin reads the `agy` quota and version every 30 minutes while the route is in use and logs a low quota or a self-update.
- API server: optional limits for chat requests per hour and per day (HTTP 429 with `Retry-After`), request counters on the API Server tab, `Retry-After` on 503 answers, and the last `agy` reading in `/health`.
- Official CLI: a request fails fast. The plugin reads `agy`'s run log and stops after a few refused model calls (for example Google's `503 No capacity`) instead of waiting about two minutes for `agy`'s silent retries; a request leaves the queue when its client disconnects or after a time limit.
- Official CLI: images are sent. Each image is written to a folder of that request, `agy`'s file viewer may read that folder only, and the folder is deleted afterwards. An answer is discarded when `agy` did not open the image.
- Accounts: every account has an off switch. An account that is off is never selected (chats, failover, rotation, API server), and the plugin sends nothing to Google for it: no model call, no quota check, no token refresh. Turning off the current account moves the current role to another usable account.
- API server: failures get an HTTP status before any stream header (503 `model_capacity_exhausted`, 503 `server_busy`, 504 `upstream_timeout`, 400 `image_input_not_supported`, 502 `image_not_read`); a stream that fails midway ends with an `error` event; a disconnected client stops its model call.

## v0.2.5 (2026-11-14)

Release `v0.2.5` adds three request routes (Direct, Gateway, Official CLI), a local OpenAI-compatible API server, handling for accounts that Google disables, and a rebuilt settings UI. Every item below passed GitHub Actions gates on `dev`:

- Routes: a Route tab chooses how the provider reaches Google: Direct (the plugin's own client), Gateway (any OpenAI-compatible gateway, with tool-call translation, usage, and two 5xx retries), or Official CLI (#23, #24, #26).
- Official CLI: requests go to Google's `agy` client, signed in as the user. DSH's system prompt and tools go into a generated agent template that removes `agy`'s built-in tools; a deny rule for every action class backs it up; DSH runs the tools. Text streams as written, and tool calls use a validated `<tool_call>` contract (#26, #27).
- Official CLI: about 620 KB travels per request (100 KB in the message, older turns in the template), and the plugin reports a 128K-token context window on this route so DSH compacts before anything is dropped. The Route tab shows the CLI version and the Gemini quota left, and warns outside the tested 1.5.x line (#32).
- API server: a local OpenAI-compatible endpoint (`/v1/models`, `/v1/chat/completions`, stream and non-stream, tools) that follows the selected route, accepts effort-suffixed model ids and `reasoning_effort`, and binds to an IP literal of your choice (#23, #25, #31).
- Bans: Google's `403 TOS_VIOLATION` is recognised, persisted as `bannedAt`, skipped by every account picker, failed over before output, and labelled "Disabled by Google (ToS)". The active role moves to a healthy account (#25, #28).
- Models: the model list comes from the upstream catalog with a 60-second failure backoff and one shared in-flight fetch; Advanced gains an Enabled Models list (#23).
- Stability: the API server force-closes lingering sockets on stop and retries `EADDRINUSE` during hot reload (#23).
- UI: Advanced, API Server, Web2API and Network use shared primitives in the Accounts tab's style; route and strategy choices are lists with descriptions; the header and account list follow the route; the tab bar fits any tab count; the API server key is masked by default (#23, #24, #28, #30).
- Gateway: no default URL; an unset URL is reported as such (#32).
- Diagnostics: one `route=… model=… effort=…` log line per request, for DSH chats and for the API server (#24, #31).
- Docs: README documents the request routes in English and Chinese (#32).

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
