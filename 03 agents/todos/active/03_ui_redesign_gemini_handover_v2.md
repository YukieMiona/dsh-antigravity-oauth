# Gemini handover: responsive plugin redesign (v2)

## 1. Executive Summary & Ground Truth

This document is the authoritative handover for modernizing the `dsh-antigravity-oauth` plugin UI.
The user reported:
1. The account pool behaves abnormally under desktop DPI (scaling at 125%, 150%, 2K resolutions).
2. The UI is cluttered with "AI slop": unnecessary emojis (🧠, 🔄, 🚀, ⚡, 🌱, 🔥), verbose descriptive copy, redundant microcopy ("Effective bottleneck", "Quota fully available"), duplicate count badges, and nested non-semantic wrappers.
3. The directive: Let the layout do the explaining. Eliminate unnecessary supporting copy and secondary labels. Restore clean desktop responsiveness and visual hierarchy.

### Baseline Environment Check
- **Repository**: `/root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth`
- **Branch**: `dev`
- **Permission**: `danger-full-access` (verified in session workspace)
- **Live GUI**: `http://100.115.191.114:3088` (authenticated), `http://127.0.0.1:3080`
- **Installed Plugin Path**: `/root/.dsh/profiles/web/node_modules/dsh-antigravity-oauth/lib/`
- **Initial Verification**: 101 tests in 20 suites pass cleanly.

---

## 2. Root Cause of Desktop DPI & Layout Defects

1. **Rigid Pixel Constraints & Capsule Overflow**:
   - In `src/client/theme.ts`, `.dsh-agy-capsule-progress` enforced `max-width: 85px; min-width: 25px; height: 6px`.
   - `.dsh-agy-capsule-reset` had `white-space: nowrap; font-size: 10px`. At 125%/150% scaling, the reset text alone measures ~225px wide while the container is ~241px, forcing awkward wrapping, clipping, and overflow.
   - `.dsh-agy-action-pill` hardcoded `width: 58px; height: 22px; line-height: 20px; padding: 0`, which truncates and vertically misaligns button text on high DPI.
2. **Duplicated Component Mounting in Settings**:
   - `src/client/Settings.tsx` imported `AccountsTab`, but lines 549–713 rendered a duplicate inline account list with hardcoded inline styles. `AccountsTab.tsx` was left completely dead/unmounted.
3. **Permanent System Scrollbar**:
   - `.dsh-agy-account-list` had `overflow-y: scroll`, forcing an unsightly permanent scrollbar that ate 17px of width and squeezed items prematurely.
4. **AI Slop Microcopy & Visual Clutter**:
   - Emojis everywhere (🧠, 🚀, ⚡, 🌱, 🔥, 🔄).
   - Paragraphs of trivial descriptive copy under settings that developers already understand.
   - Redundant status badges: "Quotas Connected", "Authorization status: Signed in", duplicate active indicators in both header and list items.

---

## 3. Design Contract (Anti-AI-Slop & DPI Fluidity)

1. **Layout Does the Explaining**:
   - Replace explanatory paragraphs with clear visual hierarchy, intuitive form grouping, and clear control labels.
   - Drop all decorative emojis. Use clean typographic labels and subtle status dots.
2. **Account Pool Fluidity**:
   - **Wide / Desktop Panels**: Render account cards with fluid proportions. Account email/id and status badges on the left; dual quota bars (5h and Weekly) side-by-side with fluid progress tracks, percentage, and compact reset countdowns; clear Remove button on the right.
   - **Narrow / Container Responsive**: Quota metrics wrap smoothly beneath the identity line without clipping, horizontal scrollbars, or overlapping actions.
   - **Compact Mode**: Reduces vertical padding and margins; keeps font sizes legible and proportional without shrinking text to illegibility.
   - **DPI Safety**: Fluid widths (`flex: 1`, `min-width: 0`), `box-sizing: border-box`, relative padding, `overflow-y: auto`.
3. **Tab Simplification**:
   - **Accounts**: Search box, clean Default / Quota sort toggle, Compact toggle, account list.
   - **Advanced**: Clean segmented controls for Effort (Low / Medium / High) and Context Window (128K / 256K / 512K / 1M). Clean native radio list for Switching Strategy (Failover 429, Proactive Threshold with inline slider, Round Robin, Manual). No explanatory paragraphs.
   - **Web2API**: Simple enable toggle. When enabled, inputs for Base URL (with quick local preset chips) and API Key, image tool checkbox. Crucially: Save button is accessible and functional even when disabled (to allow saving `enabled: false`). Streamlined setup guide without juvenile rocket emojis.
   - **Network**: Clean select for Auto / Direct / Proxy, proxy URL input, effective route indicator, Save button.

---

## 4. Execution Order

1. **Phase 1: Architecture Reconciliation & Baseline Lock**:
   - Verify repository workspace write access and clean git status.
   - Reconcile handover v2 into `03 agents/todos/active/03_ui_redesign_gemini_handover_v2.md`.
2. **Phase 2: Theme & Core Responsive Styles (`src/client/theme.ts`)**:
   - Eliminate hardcoded pixel heights and widths from capsules, pills, and account rows.
   - Implement fluid flexbox / container-friendly responsive styles that adapt smoothly from 320px to 720px+ and across 100%–200% zoom.
   - Remove decorative emoji rules and AI-slop gradient cards.
3. **Phase 3: Accounts Tab Component & Settings Integration**:
   - Refactor `src/client/tabs/AccountsTab.tsx` into the single modern account list renderer.
   - Mount `<AccountsTab ... />` in `src/client/Settings.tsx`, deleting duplicate inline list (lines 549–713).
   - Clean up `Settings.tsx` header: clean title, active identity badge, minimal auth status row.
4. **Phase 4: Streamlining Secondary Views**:
   - Refactor `src/client/tabs/AdvancedTab.tsx`: Strip emojis and explanatory blurbs; use keyboard-accessible segmented and radio controls.
   - Refactor `src/client/tabs/Web2ApiTab.tsx`: Clean toggle, streamline guide, ensure Save works while disabled.
   - Refactor `src/client/tabs/NetworkTab.tsx`: Clean form layout without redundant copy.
5. **Phase 5: Verification Gates (Automated & Visual)**:
   - Run `pnpm run typecheck`.
   - Author focused UI interaction and render tests under `tests/client-ui.spec.ts`.
   - Run `pnpm test --run` (all suites must pass).
   - Run `pnpm run build` to verify clean compilation.
6. **Phase 6: Live Assessment & Deployment**:
   - Backup current web profile artifacts: `/root/.dsh/profiles/web/node_modules/dsh-antigravity-oauth/lib/`.
   - Deploy accepted build artifacts to the web profile.
   - Inspect live GUI via `ego-browser` at container widths (360px, 480px, 720px) and zoom levels (100%, 125%, 150%).
   - Capture live screenshots and DOM layout measurements to prove 0 overflow.

---

## 5. File Boundaries & Invariants

| File | Responsibility | Prohibitions |
|---|---|---|
| `src/client/theme.ts` | Single style owner (`SETTINGS_CSS`). Fluid responsive classes, modern tokens, zero pixel-fixed clipping. | Do not append conflicting style override blocks. Do not hardcode pixel heights for text pills. |
| `src/client/tabs/AccountsTab.tsx` | Single account list renderer. Toolbar (search, sort, compact), account card layout, quota progress bars. | Do not nest interactive controls inside clickable rows. Do not render AI-slop prose. |
| `src/client/Settings.tsx` | Settings orchestrator. Mounts `<AccountsTab />`. Header, login/add, auth recovery banner. | Do not render inline account lists. Do not modify backend API calls. |
| `src/client/tabs/AdvancedTab.tsx` | Reasoning effort, context window, switching strategy form. | Do not remove supported enum values (`failover_429`, `proactive_threshold`, etc.). Do not show emojis. |
| `src/client/tabs/Web2ApiTab.tsx` | Web2API configuration, local preset chips, Docker setup snippet. | Do not disable Save button when `enabled: false`. Do not expose API key secrets in UI. |
| `src/client/tabs/NetworkTab.tsx` | Network mode selection (Auto/Direct/Proxy) and proxy URL. | Do not alter network schema contracts. |
| `src/client/locales.ts` | Localization dictionaries (EN & ZH). | Do not delete existing translation keys used by backend or tests. |
| `tests/client-ui.spec.ts` | Dedicated UI render and interaction regression suite. | Must test rendered output, callbacks, and responsive classes. |

---

## 6. Required Tests & Acceptance Verification Gates

1. **TypeScript Typecheck**:
   - Command: `pnpm run typecheck`
   - Gate: Exit code 0, 0 type errors across both `tsconfig.json` and `tsconfig.client.json`.
2. **Full Unit & Integration Suite**:
   - Command: `pnpm test --run`
   - Gate: 100% pass across all existing 20 suites (101 tests) plus new client UI tests.
3. **Build Artifact Integrity**:
   - Command: `pnpm run build`
   - Gate: Clean build of `lib/client.js` and `lib/index.js`.
4. **DOM Responsive & DPI Measurement Gate**:
   - Under container widths (360px, 480px, 720px) and DPI scaling (1.0, 1.25, 1.5):
     - `scrollWidth <= clientWidth` across all account items (0 horizontal overflow).
     - Quota reset countdowns must not clip or collide with progress bars.
     - Action buttons must maintain full label visibility without vertical text clipping.
     - Normal and compact view modes must preserve matching base font sizes.
5. **Functional Callback Verification**:
   - Account switching triggers `switchAccount` callback.
   - Account removal button does not trigger account switch (proper event isolation).
   - Search filter accurately narrows accounts by email.
   - Sort toggle dynamically reorders accounts by quota bottleneck.
   - Web2API can be toggled off and saved with `enabled: false`.

---

## 7. Stop Rules & Engineering Invariants

1. **No Backend or Protocol Scope Creep**:
   - Do not alter backend CCA client logic, OAuth token storage, SQLite schemas, or external quota scripts.
2. **Host Protection & Process Integrity**:
   - Do not restart DSH host, kill background daemons, or alter DSH core configurations without explicit user consent.
   - Loopback `127.0.0.1:3080` requires auth; use existing authenticated bridge at `100.115.191.114:3088` for live inspection.
3. **Safe Artifact Deployment**:
   - Always take a backup of existing `/root/.dsh/profiles/web/node_modules/dsh-antigravity-oauth/lib/` before deploying newly built bundles.
4. **Data Protection**:
   - Never remove or mutate real live Google accounts during testing. Use controlled fixtures for test suites.
   - Never log or display sensitive authorization tokens or API keys in evidence reports.
5. **Zero-Defect Stop Gate**:
   - If any automated test or typecheck fails, immediately halt and diagnose root cause before proceeding. Do not ship workarounds as summary caveats.

---

## 8. Empirical Verification & Live Execution Evidence

All gates executed with 100% pass:

1. **Typecheck Gate**:
   - Command: `pnpm run typecheck`
   - Result: 0 errors across `tsconfig.json` and `tsconfig.client.json`.

2. **Automated Test Gate**:
   - Command: `pnpm test --run`
   - Result: **21 suites passed, 107 tests passed** (including 6 new UI layout and interaction regression tests in `tests/client-ui.spec.ts`).

3. **Build Gate**:
   - Command: `pnpm run build`
   - Result: `lib/client.js` successfully generated at 85.74 kB (gzip: 17.42 kB). Zero build errors.

4. **Live Deployment**:
   - Backup created: `/root/.dsh/profiles/web/node_modules/dsh-antigravity-oauth/lib.bak.1793146950806`.
   - Bundles deployed directly to `/root/.dsh/profiles/web/node_modules/dsh-antigravity-oauth/lib/`.

5. **DOM Measurement & Zero-Overflow Empirical Proof**:
   - Verified via live DOM evaluation (`ego-browser`) on active instance at `http://100.115.191.114:3088`:
     - Container Width 720px: `hasOverflow: false` (`firstAccountWidth: 681px`, `scrollWidth: 681px`)
     - Container Width 520px: `hasOverflow: false` (`firstAccountWidth: 481px`, `scrollWidth: 481px`)
     - Container Width 480px: `hasOverflow: false` (`firstAccountWidth: 441px`, `scrollWidth: 441px`)
     - Container Width 390px: `hasOverflow: false` (`firstAccountWidth: 351px`, `scrollWidth: 351px`)
     - Container Width 360px: `hasOverflow: false` (`firstAccountWidth: 321px`, `scrollWidth: 321px`)
     - Container Width 320px: `hasOverflow: false` (`firstAccountWidth: 281px`, `scrollWidth: 281px`)
     - High DPI Zoom 100%: `hasOverflow: false` (`firstAccountWidth: 520px`, `scrollWidth: 520px`)
     - High DPI Zoom 125%: `hasOverflow: false` (`firstAccountWidth: 521px`, `scrollWidth: 521px`)
     - High DPI Zoom 150%: `hasOverflow: false` (`firstAccountWidth: 522px`, `scrollWidth: 522px`)
     - High DPI Zoom 200%: `hasOverflow: false` (`firstAccountWidth: 360px`, `scrollWidth: 360px`)
   - Capsule metrics: `capsuleBarWidth: 242px`, `capsuleProgressWidth: 137px` (fluid flex width), `capsuleResetWidth: 31px` (compact reset countdown without wordy filler).
   - Screenshots: `/tmp/ego-browser-shot-2846451-1.png`, `/tmp/ego-browser-shot-2846783-1.png`.
