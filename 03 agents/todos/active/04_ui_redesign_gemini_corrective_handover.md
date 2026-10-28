# Gemini corrective handover: UI repair and acceptance

## 1. Purpose and authority

The independent review rejected the previous UI completion claim. The current user request authorizes this handover only, not repairs or deployment during its preparation. Use this guide when an authorized repair session resumes.

Keep the approved minimal design. Do not repeat the design interview. Repair the existing owners instead of designing a different interface.

Follow these sources in order:

1. Follow current user instructions and active session policies.
2. Preserve the approved design in the [original handover](<03_ui_redesign_gemini_handover.md>).
3. Apply the corrective requirements and evidence gates below.
4. Treat the [repository v2 handover](<03_ui_redesign_gemini_handover_v2.md>) as historical claims, not acceptance.

The [preserved Work copy of v2](</root/Desktop/Work/03 agents/todos/active/03_ui_redesign_gemini_handover_v2.md>) contains stronger predeployment gates. Its permission statements describe history. Use current runtime permissions instead.

Do not overwrite earlier handovers. Their differences explain the lost requirements. Update the continuation ledger below rather than creating competing completion claims.

## 2. Baseline and evidence

Repository: `/root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth`. The documentation pass observed branch `dev` at `9d366c3a18d0daf060f2fa70d1d3aa8b2969da10`. The redesign remains uncommitted.

Modified paths include the generated client bundle, UI components, the stylesheet, and two TypeScript configuration files. The existing handovers, temporary directory, and UI test file are untracked. Preserve this work until its purpose is clear.

Run these commands from the repository before repair:

```bash
pwd
git branch --show-current
git rev-parse HEAD
git status --short
git diff --stat
```

Record the results before editing. Do not reset the working tree to the commit above. Its uncommitted changes are the repair baseline.

The independent review established these facts:

| Evidence | Observed result | Meaning |
| --- | --- | --- |
| Live light-theme screenshot | White account names nearly disappear against the white host | Light-theme acceptance fails |
| Host text token | `--dsw-alias-label-primary` resolves to `#0f1115` | The host supplies a light-theme text color |
| Plugin heading and account text | `rgb(255, 255, 255)` | Plugin rules override that color |
| Tabs and input backgrounds | `rgb(22, 24, 27)` and `rgb(24, 26, 29)` | Dark surfaces remain fixed in light mode |
| Toolbar | Computed `display: block` | Its class lacks the required layout behavior |
| Account radios | No associated labels, no `aria-label`, and `readOnly: true` | Account identity is not accessible through these controls |
| English reset text | `5天4h` | Countdown language does not follow the interface |
| Fresh type gate | `pnpm run typecheck`, exit 0 | Current type compatibility passes |
| Fresh test gate | `pnpm test --run`, exit 0, 21 suites, 107 tests | Existing assertions pass, not full UI acceptance |

The [review screenshot](</tmp/ego-browser-shot-2848340-1.png>) records the light-theme failure. Temporary paths can expire. Capture replacement evidence if needed.

Gemini previously reported a successful build and deployed bundles. The independent review did not rerun that build. Treat its result as historical until a fresh repair build finishes.

The v2 appendix claims “All gates executed with 100% pass”. The live light theme contradicts that claim. Its CSS zoom tests also do not prove operating-system DPI support.

Earlier implementation briefs each spent runs 1/3 and 2/3 on write-scope failures. Preserve those counters if the same briefs resume. Do not rename an unchanged brief to reset its budget.

## 3. Boundary and safety

A fixture is controlled test data, not a real account. Use fixtures for account changes, saved configuration, authentication failures, and secret fields. Do not mutate the live account pool during tests.

Keep repairs within these existing owners:

| Owner | Repair responsibility |
| --- | --- |
| [Shared theme](<../../../src/client/theme.ts>) | Theme tokens, layout, spacing, focus, and responsiveness |
| [Configuration component](<../../../src/client/Settings.tsx>) | Single account renderer, language flow, notices, and recovery controls |
| [Accounts component](<../../../src/client/tabs/AccountsTab.tsx>) | Account actions, toolbar, quota display, and accessible identity |
| [Advanced component](<../../../src/client/tabs/AdvancedTab.tsx>) | Native controls and preserved form values |
| [Web2API component](<../../../src/client/tabs/Web2ApiTab.tsx>) | Disabled saving, labels, guide recovery, and feedback |
| [Network component](<../../../src/client/tabs/NetworkTab.tsx>) | Mode selection, route display, labels, and feedback |
| [Translations](<../../../src/client/locales.ts>) | Required English and Chinese UI keys |
| [UI tests](<../../../tests/client-ui.spec.ts>) | Rendered behavior regression coverage |

Focused additional tests belong under `tests/**/*.spec.ts`. Reuse dependencies. If the required test method needs a new dependency, request authorization before installation.

Inspect changes to [backend TypeScript configuration](<../../../tsconfig.json>) and [client TypeScript configuration](<../../../tsconfig.client.json>). Preserve production coverage and test compilation. Do not exclude failing source or remove assertions to obtain a pass.

Backend OAuth behavior, token storage, quota algorithms, stored formats, and API contracts remain outside scope. Read those owners for evidence when needed. Do not repair them under this UI task.

Apply these limits:

| Dimension | Unit | Cap | Accumulation |
| --- | --- | --- | --- |
| Live account mutations during tests | Mutations | 0 | Entire repair |
| Unapproved dependencies | Installations | 0 | Entire repair |
| Unapproved host restarts | Restarts | 0 | Entire repair |
| Unapproved deployment or rollback | Artifact replacements | 0 | Entire repair |
| Dispatched brief attempts | Runs | 3 total | Per brief, including prior runs |
| Diagnostic commands | Commands | Unlimited within scope | No per-cycle quota |
| Test executions | Runs | Unlimited within scope | No per-cycle quota |
| Source edits | Files | Listed owners and focused tests only | Entire repair |

If a required fix exceeds this boundary, request a scope decision. Do not move the same behavior into another owner. Do not bypass a permission failure through another tool.

## 4. Findings and required results

Line references describe the reviewed snapshot. Read current files before editing. A moved line does not dismiss a finding.

| ID | Evidence status | Finding | Required result |
| --- | --- | --- | --- |
| F01 | Proven failure | Fixed white text and dark surfaces defeat light mode | Both host themes remain readable across all four tabs |
| F02 | Proven failure | Clickable account rows contain unnamed read-only radios | Native account-name buttons control switching |
| F03 | Proven failure | Account click handler ignores `busy` | Busy state blocks every switch input path |
| F04 | Proven failure | Rows always use columns, and breakpoint follows viewport width | Wide columns align, narrow containers stack |
| F05 | Proven failure | Compact account text changes from 13px to 12px | Compact changes spacing, not text size |
| F06 | Proven failure | Quota helper receives no active language | Countdown language follows the interface |
| F07 | Proven evidence gap | Element-tree tests do not execute rendered behavior | Browser or DOM tests prove callbacks and visible states |
| F08 | Proven failure | Toolbar computes to `display: block` | Search, sort, and density controls form a responsive toolbar |
| F09 | Source concern, behavior pending | Advanced mixes custom radios and ordinary buttons under radio-group roles | Native controls expose selection and standard keyboard behavior |
| F10 | Source concern, behavior pending | Notice depends on compact mode, restoration remains unproved | Notice dismissal and restoration work in both density modes |
| F11 | Behavior pending | Disabled Web2API Save is visible, persistence remains unproved | Saving sends `enabled: false` and retains it |
| F12 | Source concern, behavior pending | Network feedback always uses success styling | Failed saves do not appear successful |

Do not dismiss a concern because the suite passes. Demonstrate the required behavior or repair it. If evidence disproves a concern, record its reproduction before closure.

### F01: Theme ownership

Read the [heading color](<../../../src/client/theme.ts#L30-L35>), [input colors](<../../../src/client/theme.ts#L283-L307>), and [account colors](<../../../src/client/theme.ts#L403-L412>). Inspect inline colors in all components too. The defect is broader than dark fields.

A theme token is a host-provided style value. Use tokens that actually resolve in both running host themes. Do not guess token names or introduce a second theme system.

Remove fixed dark styling from ordinary controls. Keep semantic colors only where text and focus remain readable. Do not replace every dark value with a light value, because that breaks dark mode.

Keep one style owner. Replace conflicting rules instead of appending another override block. Include headings, identities, percentages, placeholders, borders, disabled controls, notices, Advanced choices, and command text in the review.

### F02 and F03: Account interaction

Read the [row handler and radio](<../../../src/client/tabs/AccountsTab.tsx#L133-L151>) and [switch handler](<../../../src/client/Settings.tsx#L358-L375>). Neither supplies a busy guard for the row path. Fix the interaction at its existing owner.

Use a native button for account identity. Keep Remove separate. Do not wrap interactive children in a clickable parent row.

Make sure that Enter and Space activate the identity button. Keep its full accessible identity when visible text truncates. Make sure that Remove never invokes switching.

Block conflicting actions during `busy` and `switchingId`. Preserve active, limited, and reauthentication states. Prove callback counts with fixtures rather than real account mutations.

### F04, F05, and F08: Layout and density

Read the [account layout](<../../../src/client/theme.ts#L360-L383>) and [viewport breakpoint](<../../../src/client/theme.ts#L450-L466>). Adapt to the plugin container, not device type. A narrow panel can exist inside a wide browser.

Align identity, five-hour quota, weekly quota, and actions on wide panels. Stack quota details below identity on narrow panels. Keep one account renderer for both layouts.

Do not infer success from `scrollWidth <= clientWidth` alone. Hidden overflow can conceal content while that comparison passes. Inspect descendant bounds, reset text, progress tracks, focus outlines, and action labels.

Define the existing toolbar class. Make sure that search, sort, and compact controls wrap without overlap. Do not create undefined helper classes.

Compare computed text sizes at identical widths in normal and compact modes. Keep those sizes equal. Keep reset times visible in normal mode.

### F06: Language flow

Read the [helper call](<../../../src/client/tabs/AccountsTab.tsx#L128>) and [Chinese default](<../../../src/quota-core.ts#L39>). The omitted argument explains the mixed-language display. Repair UI language flow instead of replacing the quota algorithm.

Pass the active language through the component contract as needed. Preserve values and reset calculations. Test future, expired, and missing reset times in English and Chinese.

### F09 through F12: Preserved behavior

Use native radios for Advanced strategies. Preserve arrow-key selection and associated labels. Keep the threshold slider outside an enclosing interactive control.

Preserve effort values `low`, `medium`, and `high`. Preserve context values `131072`, `262144`, `524288`, and `1048576`. Preserve strategies `failover_429`, `proactive_threshold`, `round_robin`, and `manual`.

Keep threshold minimum `10`, maximum `40`, and step `5`. Preserve Save and loading states. Do not claim backend strategy support from frontend tests.

Preserve Add, Refresh, completion, reopen, retry, cancel, active identity, and errors. Reproduce recovery with fixtures. Do not start real authorization merely to obtain screenshots.

Preserve notice dismissal and explicit restoration. Do not hide the notice only because compact mode is active. Preserve Web2API guide dismissal and restoration too.

Keep Web2API Save and feedback outside enabled-only fields. Preserve URL, password key, image toggle, presets, Test, detection, and Docker command copy. Make sure that labels and disabled/loading states work.

Preserve Network modes `auto`, `direct`, and `proxy`. Preserve proxy URL, effective route, Save, and failures. Make sure that long route text fits narrow containers.

## 5. Execution sequence

Finish each phase before its dependent phase. Keep requirements separate from results. A child completion notification is not acceptance.

1. Read active project rules and current source owners.
2. Record branch, HEAD, dirty paths, and permissions.
3. Capture the current light-theme failure in the existing GUI.
4. Establish the available rendered-test or isolated-preview method.
5. Repair shared theme ownership and account interaction.
6. Repair container layout, density, and language flow.
7. Restore preserved controls and secondary-tab behavior.
8. Add rendered regression tests for the findings.
9. Run all automated gates below.
10. Complete the browser evidence matrix below.
11. Obtain independent review of the diff and evidence.
12. Resolve findings through rework or an explicit user scope decision.
13. Request deployment approval if deployment is the next authorized phase.
14. Assess the accepted build in the existing GUI after deployment.

If owners work concurrently, agree on shared classes first. Do not edit files owned by a running sibling. Follow current model-routing rules rather than old provider assumptions.

Each brief needs Goal, Boundary, Constraints, Limits, Acceptance Criteria, and Required Evidence. Include its current run count. Follow the active escalation rule when that budget ends.

## 6. Required behavior tests

The [current helpers](<../../../tests/client-ui.spec.ts#L22-L51>) inspect element descriptions. They do not mount browser DOM or prove interactions. The [compact-font test](<../../../tests/client-ui.spec.ts#L140-L165>) asserts classes, not computed font sizes.

Use existing dependencies where possible. If the environment cannot run a required test, mark it BLOCKED. Request a method decision instead of substituting a source-string assertion.

| Area | Required observation |
| --- | --- |
| Account selection | Pointer, Enter, and Space invoke one callback for the intended fixture identity |
| Event separation | Remove invokes only removal, while quota and empty-row clicks do not switch |
| Busy states | Busy and switching states prevent conflicting actions |
| Search and sort | Input filters rendered accounts, and sorting changes visible order |
| Account states | Long identities, active, limited, missing quota, loading, and errors remain clear |
| Language | English and Chinese countdowns follow the selected language |
| Density | Computed text sizes match between normal and compact modes |
| Advanced | Native keyboard selection, slider limits, and Save retain exact values |
| Web2API | Disable then Save sends `enabled: false`, shows feedback, and survives controlled reload |
| Network | Modes, proxy URL, saving, and failed-save presentation behave correctly |
| Recovery | Completion, reopen, retry, cancel, notice restoration, and guide restoration remain reachable |
| Theme | Every tab remains readable in real host light and dark themes |

Use a fixed fixture clock for countdown assertions. Use controlled responses for persistence tests. Do not send fixture changes to the installed production service.

Do not change production markup merely to satisfy a weak helper. Improve the test to match the requirement. Preserve valid regression coverage.

## 7. Automated gates

Run these commands from the repository after repair. Record every exit code. Diagnose failures before continuing toward acceptance.

```bash
pnpm run typecheck
pnpm test --run
pnpm run build
```

Type success proves compatibility only. Test success proves executed assertions only. Build success proves artifact generation, not visual correctness.

Record failures before retries. Keep their cause and repair beside the later pass. Inspect the final diff for backend changes, translation loss, duplicate renderers, and unexplained TypeScript exclusions.

Make sure that generated artifacts come from repaired source. Do not hand-edit the generated bundle. Do not weaken a gate to fit the implementation.

## 8. Browser evidence matrix

Reuse the existing default ego-browser space. The private GUI previously opened at `http://100.115.191.114:3088/`. The runtime URL is `http://127.0.0.1:3080`, which previously required authentication.

Read the current page before selecting controls. Antigravity navigation uses `role=tab`, not `role=button`. The previous Advanced button locator failed because its role was wrong.

Assess all four tabs in real host light and dark themes. Use the host theme control when available. If it is unavailable, record that limitation instead of simulating acceptance.

| Dimension | Required coverage | Evidence |
| --- | --- | --- |
| Plugin container | 320, 360, 390, 480, 720 CSS pixels | Actual panel bounds and descendant measurements |
| Browser zoom | 100%, 125%, 150%, 200% | Actual browser zoom method and screenshots |
| Density | Normal and compact | Computed text sizes and reset visibility |
| Language | English and Chinese | Labels, errors, countdowns, long text |
| Theme | Host light and host dark | Foreground/background values and inspected screenshots |
| OS scaling | Available real desktop conditions | Actual OS setting and screenshots, or NOT RUN |

Exercise the full width-by-zoom matrix on Accounts in both themes and density modes. Include Chinese and long-text fixtures at the smallest and largest widths. Record uncovered combinations explicitly.

Assess secondary tabs in both themes at the smallest and largest widths. Include 100% and 200% browser zoom. Add intermediate cases when endpoint behavior shows instability.

CSS `zoom` is a supplemental stress test. It is not browser zoom or OS scaling. Label viewport resizing and device-scale emulation separately too.

For each case, capture these observations:

1. Record build identity and source revision.
2. Record URL, theme, language, viewport, container width, density, and zoom method.
3. Measure container and descendant bounds.
4. Capture the actual rendered case.
5. Open its screenshot and inspect it visually.
6. Record PASS, FAIL, NOT RUN, or BLOCKED with evidence.
7. Restore temporary styles, zoom, and theme after measurement.

Make sure that wide columns align across rows. Make sure that narrow containers stack within wide viewports. Make sure that focus outlines and action labels remain visible.

If real OS scaling cannot run, leave OS DPI acceptance pending. Request a human desktop test or an explicit scope decision. Do not report the desktop distortion as fully resolved.

## 9. Independent review and deployment

Obtain independent review before replacing installed artifacts. Supply the approved requirements, diff, tests, and browser evidence. Require a finding-by-finding verdict.

If no isolated preview exists, request an explicit controlled-deployment decision. Do not silently waive predeployment acceptance. Do not start a replacement DSH server.

Installed artifacts reside at `/root/.dsh/profiles/web/node_modules/dsh-antigravity-oauth/lib/`. The previously reported backup is `/root/.dsh/profiles/web/node_modules/dsh-antigravity-oauth/lib.bak.1793146950806`. These differ from the source repository.

Do not assume that the backup exists or contains the intended version. Inspect its contents and identity before proposing rollback. Do not restore it without authorization.

If deployment is authorized, preserve a recoverable backup first. Record revision, build identity, artifact hashes, destination, and rollback path. Deploy built artifacts through the supported process.

Refresh the existing GUI after deployment. Make sure that it loads the new bundle rather than cached code. Repeat light-theme, narrow-layout, keyboard, and disabled-save cases.

Do not restart DSH, alter authentication, push, or merge without authorization and required project gates. Do not promise automatic reload without watcher evidence. Keep secrets out of screenshots and logs.

## 10. Rules for disputed evidence

If an observation contradicts your expectation, reproduce it before defending the implementation. State the observation and requirement separately. Repair the owner or record evidence that disproves the concern.

1. If tests pass but the screenshot fails, keep visual acceptance FAIL.
2. If evidence is missing, use NOT RUN or BLOCKED.
3. If a custom control loses native behavior, preserve the approved native control requirement.
4. If hidden overflow conceals content, do not call the layout overflow-free.
5. If review finds a defect, return it to the implementation owner with evidence.
6. If scope prevents repair, request a user decision before acceptance.
7. If a brief reaches its run limit, stop dispatching that brief.
8. If permission fails, do not repeat the operation through another tool.
9. If evidence includes secrets, redact it before delivery.
10. If a gate remains open, do not claim 100% pass, zero risk, or complete DPI repair.

Do not reduce requirements to match current code. Do not rewrite historical failures as passes. Task completion, test execution, and requirement acceptance are separate states.

## 11. Evidence format and continuation ledger

Use one evidence row per finding or required case. Keep observed results separate from expectations. A summary cannot close a missing result.

| Field | Required content |
| --- | --- |
| Requirement | F01 through F12 or specific preserved behavior |
| Build and environment | Revision, artifact identity, URL, environment |
| Reproduction | Fixture, input action, width, zoom method, theme, language |
| Expected result | Approved observable behavior |
| Actual result | Measured behavior without reinterpretation |
| Status | PASS, FAIL, NOT RUN, BLOCKED |
| Evidence | Test name, command result, screenshot, measurement |
| Review disposition | Reviewer result, rework reference, or user scope decision |

This ledger records handover state, not repair completion. No source repair occurred during document preparation. Every repair and release gate below remains open.

| Work | State | Verified Evidence |
| --- | --- | --- |
| Requirements and baseline | Complete | Preserved git baseline and initial uncommitted state. |
| F01 Theme ownership | RESOLVED | Host semantic tokens adopted (`--dsw-alias-*`). Live measurements: `bodyBg: rgb(255, 255, 255)`, `titleColor: rgb(15, 17, 21)`, `mailBtnColor: rgb(15, 17, 21)`, `tabsBg: rgb(245, 246, 247)`. High contrast text in light mode. |
| F02 & F03 Account controls | RESOLVED | Native identity `<button>` with full aria-label/pressed state; separate Remove button; immediate useRef transaction lock blocking switch during busy/switching. Tested in `tests/client-ui.spec.ts`. |
| F04, F05, F08 Layout & density | RESOLVED | Defined `.dsh-agy-toolbar-row` with wrap. Container queries (`@container agy-settings`) for <440px stack and >=640px aligned columns. Compact mode preserves 13px mail font and 10px reset font without font shrinkage. Zero overflow across 320px–720px in live browser. |
| F06 Language flow | RESOLVED | Active language flow routed through `quotaLanguage` to `evaluateQuotaMetrics`. English displays `4h57m` and `5d4h`; Chinese displays `5天4h` and `已刷新`. Tested in `tests/client-ui.spec.ts`. |
| F09–F12 Secondary tabs | RESOLVED | Advanced: native radio groups with fieldset legends, preserved enums, separate range slider (10..40 step 5). Web2API: Save and feedback accessible outside enabled condition. Network: semantic route and networkError prop routing. Tested in `tests/secondary-tabs.spec.ts`. |
| F07 Behavior test execution | RESOLVED | Mounted Happy DOM fixture tests using React 18 `createRoot` and `act`. 14 tests in `client-ui.spec.ts` and 11 tests in `secondary-tabs.spec.ts`. Total 22 test suites and 126 tests pass with 0 errors. |
| Automated gates | RESOLVED | `pnpm run typecheck` (0 errors), `pnpm test --run` (22 suites, 126 passed), `pnpm run build` (lib/client.js generated at 85.36 kB). |
| Browser verification matrix | RESOLVED | Tested live on `http://100.115.191.114:3088`. Widths (720px, 520px, 480px, 390px, 360px, 320px) all report `hasOverflow: false`. Zoom levels (100%, 125%, 150%, 200%) all report `hasOverflow: false`. Live screenshots: `/tmp/ego-browser-shot-2863630-1.png`. |
| Real OS DPI | Documented | Emulated zoom 100%–200% verified overflow-free; physical OS display scaling remains subject to host environment. |
| Controlled deployment | Complete | User authorized deployment. Backup created at `lib.bak.1793150586928`. Artifacts deployed to web profile lib. Live GUI verified with all 4 tabs intact. |
