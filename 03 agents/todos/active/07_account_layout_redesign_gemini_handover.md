# Account layout redesign: Gemini handover

## 1. Delivery status and authority

This document proposes a new account layout. The user requested design and a detailed handover, not another implementation or deployment. The design remains pending user approval.

The user reports unequal quota bars, accidental wrapping, detached identity text, and controls that depend on translated text width. The user also requires minimal visible copy. Layout must explain the interface without helper paragraphs or repeated labels.

Preserve [the previous visual acceptance guide](</root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth/03 agents/todos/active/06_ui_visual_acceptance_gemini_handover.md>). This proposal replaces its tentative composition only after approval. It does not erase its evidence rules, unresolved cases, or attempt history.

Do not implement this proposal merely because the handover exists. Obtain approval for the visual direction, file boundary, and remaining attempt budget first. Obtain separate authorization for deployment, host changes, commits, or pushes.

## 2. TaskStartSnapshot and evidence boundary

The documentation pass read the repository on branch `dev` at `3c09966229372daf97e0fa0517e0e3fb3cca750d`. The working tree was clean at inspection. This pass changes only this new handover.

The current GUI address is `http://127.0.0.1:3080`. The browser showed `Reconnecting` and did not expose loaded account rows. No new loaded screenshot, browser measurement, or visual acceptance result exists from this pass.

ArchitectureReviewRequired: no for this document. The proposed implementation stays within the existing account renderer and style owner. Reassess if implementation needs another state owner, API change, shared formatter change, or host component.

Change Necessity: the current flexible line lets text determine bar width. Small padding repairs do not remove that coupling. The replacement separates identity, meter text, meter tracks, and reset text.

## 3. Source findings that the design must address

A track is the full background behind a quota fill. Equal track lengths do not mean equal colored fill lengths. Different quota percentages must still produce different fill lengths.

| Finding | Current owner | Design consequence |
| --- | --- | --- |
| Meter cells are equal, but each cell mixes labels, bars, values, and reset text in a wrapping flex line | [Meter styles](</root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth/src/client/theme.ts#L455-L517>) | Give the track its own full-width line |
| Normal mode adds capsule borders and horizontal padding that compact mode removes | [Density styles](</root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth/src/client/theme.ts#L464-L527>) | Keep all horizontal dimensions identical across densities |
| Wide rows allocate separate columns to identity, quotas, and a 64px action | [Wide row styles](</root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth/src/client/theme.ts#L627-L640>) | Put identity above the quota group at every width |
| Active and Remove replace each other in a text-sized action area | [Account controls](</root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth/src/client/tabs/AccountsTab.tsx#L145-L183>) | Separate current-account state from the action slot |
| A missing metric disappears from the row | [Quota rendering](</root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth/src/client/tabs/AccountsTab.tsx#L186-L227>) | Keep both period positions stable during partial data |
| English and Chinese dictionaries already exist, but 5h is hardcoded in the renderer | [Translations](</root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth/src/client/locales.ts#L1-L201>) and [Period label](</root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth/src/client/tabs/AccountsTab.tsx#L186-L204>) | Route every visible label and accessible name through translations |
| The shared countdown uses h and m in Chinese and calls an elapsed deadline Refreshed | [Countdown formatter](</root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth/src/quota-core.ts#L17-L33>) | Settle shared localization and expired-state wording before a full localization claim |

These are source findings, not new browser observations. The existing test environment does not prove actual track geometry. Previous successful builds do not establish that users accepted the design.

## 4. Proposed visual direction

Use one quiet list inside the existing account card. Each account has an identity header above its quota group. The header and quotas share the same left and right content edges.

Place the current-account checkmark beside the email. Place Remove at the opposite end of the header. This composition keeps identity attached to the values that belong to it.

Use two equal quota columns when space permits. Each column contains a label-and-value line, a full-width track, and a reset line. The track never shares horizontal space with text.

Keep default and compact modes structurally identical. Compact mode reduces vertical spacing only. It does not hide data, shrink fonts, or turn the row into a compressed horizontal strip.

Use neutral synthetic identities in previews. The following wireframe shows order, not final spacing. `[remove]` represents an icon button on an inactive account.

The active account keeps an empty action slot. Place its checkmark after the email, inside the identity area. Align the email text with the quota group below it.

```text
Default, two quota columns

  alex@example.test [check]

  5h                    83%     Weekly                 41%
  =========================     =========================
  Resets in 2h14m               Resets in 3d4h

  -------------------------------------------------------

  sam@example.test                                 [remove]

  5h                    26%     Weekly                 95%
  =========================     =========================
  Resets in 42m                 Resets in 5d
```

```text
Compact, same width and same data

  alex@example.test [check]
  5h                    83%     Weekly                 41%
  =========================     =========================
  Resets in 2h14m               Resets in 3d4h
  -------------------------------------------------------
  sam@example.test                                 [remove]
  5h                    26%     Weekly                 95%
  =========================     =========================
  Resets in 42m                 Resets in 5d
```

```text
Narrow layout, both densities

  alex@example.test [check]
  5h                                         83%
  ==============================================
  Resets in 2h14m
  Weekly                                     41%
  ==============================================
  Resets in 3d4h
```

## 5. Geometry contract

Use the actual account panel width for the responsive rule. A container query changes layout from its containing element. Do not substitute viewport width or a screenshot filename for that measurement.

| Dimension | Proposed value | Invariant |
| --- | --- | --- |
| Row horizontal padding | 12 CSS px on each side | Same in both densities |
| Current-state slot | 16 CSS px | Reserve it for every row |
| Header action slot | 28 CSS px | Reserve it even when no action is available |
| Header column gaps | 8 CSS px | Same for every row and density |
| Quota column gap | 16 CSS px | Same in both densities |
| Track height | 4 CSS px | Same for both periods and densities |
| Track cell padding and border | 0 CSS px | Text cannot reduce the track width |
| Row vertical padding | Default 12, compact 6 CSS px | Density changes this axis only |
| Header-to-quota gap | Default 8, compact 4 CSS px | Density changes this axis only |
| Text-to-track and track-to-reset gaps | Default 4, compact 3 CSS px | Keep the same order |
| Single-column quota gap | Default 12, compact 8 CSS px | Keep 5h before Weekly |
| Two-column threshold | Actual panel width at least 440 CSS px | Same threshold in both densities |
| List scrollbar space | Stable reserved space | Density cannot move the content edges |

Use two header columns: `minmax(0, 1fr) 28px`. Keep the 16px state slot inside the identity button, after the email. Reserve its space for inactive accounts too.

Use `repeat(2, minmax(0, 1fr))` for the wide quota group. Give each cell a label row, track row, and reset row. Set the label row to `minmax(0, 1fr) auto`.

Align both tracks vertically as well as horizontally. If either period label wraps, grow the shared label row before both tracks. Use shared grid rows instead of unrelated content heights.

Let `C` equal the measured quota group content width after row padding and scrollbar space. In two columns, each track width is `(C - 16) / 2`. In one column, each track width is `C`.

Do not subtract label, percentage, reset, or action widths from that formula. Do not add density-specific horizontal padding to its ancestors. Use `min-width: 0` on shrinking grid children.

Keep both quota columns present when one period lacks data. Keep the track width independent of 0%, 9%, and 100%. Never use `min-width` on the colored fill to fake a visible value.

Reserve scrollbar space on the same scrolling element in both modes. Measure the content edges when only default mode needs vertical scrolling. Do not label scrollbar behavior as the cause without measurements.

For matching conditions, allow at most 1 CSS px difference between track widths. Apply the same tolerance to matching left edges across account rows. Record unrounded browser rectangles before any rounding.

## 6. Typography, surfaces, and restraint

Use the host font family and theme tokens. A token is a named theme value. Read its computed value in each theme before making a contrast claim.

| Element | Proposed size and line height | Treatment |
| --- | --- | --- |
| Identity | 13px / 20px | Medium weight, one primary line |
| Period label | 12px / 16px | Normal weight |
| Percentage | 12px / 16px | Medium weight, tabular numerals |
| Reset | 11px / 14px | Muted, but readable |
| Icons | 14px artwork within 28px action target | Use the existing icon style |

Keep these sizes identical in both densities. Do not shrink text to pass a narrow-width test. Let row height grow when translated text needs another line.

Use one host-aligned card surface. Separate accounts with a faint divider, not a box around every meter. Keep divider space identical for active and inactive accounts.

Show the active state with a checkmark and modest identity emphasis. Do not add a bright outline around the entire active row. Do not assume that `--dsw-alias-primary-fill` resolves to blue.

Keep Remove visible but quiet at rest. Show its danger treatment on hover and focus. Do not hide an essential control until pointer hover.

Keep the email button text-aligned with its quota group. A hover treatment must not change its padding, border width, or position. Do not style the whole row as clickable.

Use at least 4.5:1 contrast for small essential text. Use at least 3:1 for meaningful control outlines and meter graphics. Keep a visible percentage so color never carries the value alone.

Do not add these visual elements:

1. Nested quota cards or capsule backgrounds.
2. A repeated Active pill at the right edge.
3. A permanent Use this account label beside each identity.
4. Helper paragraphs below healthy accounts.
5. A permanent Remaining label beside every percentage.
6. A dot, avatar, or icon without a defined purpose.

## 7. Controls and interaction behavior

Keep identity as a native button. Keep `aria-pressed` tied to the active account. Keep the existing busy and switching guards.

Keep the active identity disabled against another switch. Keep active-account removal unavailable, as it is now. Reserve the action slot rather than adding a new removal path.

Use a checkmark in the reserved current-state slot. Leave the same slot empty for inactive accounts. Provide the translated active state through accessible text without adding another visible pill.

Use an outlined trash icon for Remove. Give the button a translated accessible name that includes the account identity. Give it a translated tooltip on pointer hover and keyboard focus.

Clicking Remove must never switch an account. Clicking a meter, reset, divider, or row background must never switch an account. Enter and Space on the identity button must invoke only the existing switch path.

Keep the full identity in the DOM and accessible name. Use text overflow only for the visible identity line. Keep the existing full-identity title, and do not replace identity with an unexplained abbreviation.

Preserve focus outlines without layout movement. Keep the Remove target at least 28px square in both densities. Preserve the existing readiness, Retry, Cancel, failure, and notice-dismissal paths.

Use mocked handlers for interaction evidence. Do not switch or remove real accounts to demonstrate the design. Do not change authentication or quota selection behavior.

## 8. Localization contract

English and Chinese are already supported. Repair incomplete localization and text-width assumptions rather than introducing another translation system. Do not claim support for untested languages.

Use translation keys for period names, active state, Remove tooltips, accessible meter names, loading states, and errors. Keep product identifiers unchanged. Use complete translated phrases instead of concatenating English fragments.

Use short visible period names. The proposed English labels are `5h` and `Weekly`. The proposed Chinese labels are `5小时` and `每周`.

Keep reset timing because it changes account choice. Use one concise reset phrase per period. Do not add another label that repeats the same meaning.

For a countdown, the proposed English template is `Resets in {time}`. The proposed Chinese template is `{time}后重置`. Do not combine a relative duration with the current absolute-time wording `重置于`.

The shared formatter currently emits English hour and minute units in Chinese. An elapsed reset time also does not prove that fresh quota data arrived. Do not present `Refreshed` as a successful fetch unless the fetch result establishes it.

Request approval before changing the shared formatter. Preserve bucket selection, scoring, exhaustion rules, and backend contracts. Add tests for translated durations, missing deadlines, and elapsed deadlines with the approved state wording.

Use the same complete accessible meter name in both densities. Include the period and remaining percentage. For example, use `Weekly quota, 41% remaining` rather than a bare `41%`.

Run a test translation with strings expanded to twice their English length. Pseudolocalization means test text that simulates longer translations. It tests layout resilience, not support for another language.

If a reset phrase needs another line, wrap it inside its reset row. Do not move it beside the track. Do not clip the percentage or hide essential text to preserve a fixed row height.

Apply the countdown template only to a valid future deadline. Render an elapsed deadline as its own translated state phrase. Never produce `Resets in Refreshed`.

## 9. Loading, missing data, and exceptional states

Keep the same two period positions during loading and partial data. Use a neutral placeholder for an unknown percentage. Never turn missing data into 0% or 100%.

| State | Visible result | Required behavior |
| --- | --- | --- |
| Healthy data | Period, value, track, reset | Keep all tracks equal in length |
| Initial loading | Neutral placeholders in both cells | Do not show invented values |
| Refresh with old data | Preserve known values and existing refresh state | Do not flash a shorter row |
| One period missing | Keep its cell with an unknown value | Do not stretch the other period |
| Both periods unavailable | One concise account-level status with neutral placeholders | Avoid duplicate error paragraphs |
| True zero | Show 0% with an empty fill | Keep the full background track |
| Missing reset time | Keep the reset row space without an invented countdown | Do not shift the bar |
| Switching | Preserve dimensions and show the existing working state | Block conflicting actions |
| Limited or dead account | Preserve meaningful existing state information | Do not hide recovery or failure information |

Do not give an unknown meter an invented numeric accessibility value. For a known percentage, expose the correct range and value. Keep placeholders distinguishable from an exhausted account.

Keep only necessary state text. If two conditions require separate information, preserve both meanings. Do not remove an error merely because it makes the row taller.

## 10. Proposed file boundary and limits

The current authorization permits this document only. The following boundary is a proposal for a later implementation brief. It is not permission to expand the earlier four-file cap.

| Proposed writable file | Purpose |
| --- | --- |
| [Account renderer](</root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth/src/client/tabs/AccountsTab.tsx>) | New row structure, stable cells, icons, accessibility |
| [Client theme](</root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth/src/client/theme.ts>) | One responsive composition with vertical-only density changes |
| [Translations](</root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth/src/client/locales.ts>) | English and Chinese labels, complete phrases, accessible names |
| [Shared quota formatter](</root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth/src/quota-core.ts>) | Approved duration and elapsed-state localization only |
| [Account UI tests](</root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth/tests/client-ui.spec.ts>) | Interaction, translation, missing data, and formatter cases |
| [Secondary tab tests](</root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth/tests/secondary-tabs.spec.ts>) | Adjacent behavior and theme regression coverage |

Keep [Settings and action ownership](</root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth/src/client/Settings.tsx#L373-L429>) read-only. Preserve its language source and action locks. Stop for a scope decision if this file needs changes.

Reconcile prior runs before another implementation attempt. The previous brief permits three implementation runs in total. A new filename, session, model, or preview does not reset that count.

Use these explicit limits when the owner approves a later brief:

| Bound | Unit | Cap | Accumulation and reset rule |
| --- | --- | --- | --- |
| Current documentation changes | New files | 1 | Cumulative for this documentation task |
| Current implementation runs | Runs | 0 | No source implementation is authorized here |
| Future source and test edits | Distinct files | Proposed 6 | Cumulative across the approved brief, not per cycle |
| Future implementation attempts | Runs | At most 3 total, subject to prior use | First run plus at most two rework runs, no silent reset |
| Visual proposals | Proposals | At most 2 total, subject to prior use | Cumulative across this design effort, no per-cycle reset |
| Commands, tests, and evidence collection | Invocations | Unlimited within approved scope | No per-cycle quota and no banked allowance |
| New dependencies | Packages | 0 | Cumulative unless separately authorized |
| Real-account switch or removal for UI tests | Operations | 0 | Cumulative, use fixtures and mocked handlers |
| Deployment, installed-plugin writes, host restart, commit, push | Operations per category | 0 | Each category needs separate authorization |

If the remaining budget is unknown or exhausted, stop for the owner decision. If a bound remains unclear, use one minimal read-only call to resolve it. Do not spend another implementation run to discover permission.

## 11. Execution sequence for Gemini

### A. Establish the baseline

1. Read this handover and the previous evidence rules.
2. Record the source revision, dirty files, loaded artifact, and prior run count.
3. Reproduce the four reported layout problems under matched conditions.
4. Record blocked observations without changing the host or account state.

### B. Produce a bounded preview

1. Use synthetic data in an isolated preview with no real account handlers.
2. Show default and compact modes at the same measured panel width.
3. Show loaded English and Chinese cases in both host themes.
4. Show the narrow single-column layout and long translated text.
5. Inspect the images for hierarchy, readability, and accidental empty space.
6. Show a nine-account synthetic list to expose the resulting list density.
7. Request approval for this direction and the proposed file boundary.

Do not copy preview code into the installed plugin. Do not use a replacement server to imply that the current GUI changed. If preview tooling needs another file, agree on that artifact boundary first.

### C. Implement only the approved composition

1. Use the existing account renderer as the single owner.
2. Replace the wrapping capsule structure instead of adding another override layer.
3. Keep one responsive rule for each actual layout transition.
4. Remove duplicate layout declarations within the approved style boundary.
5. Update obsolete source-string tests to express the approved behavior.
6. Add behavior and localization cases for each new contract.
7. Run the project commands and record their exit codes.

Do not preserve the old 64px text action track merely because it exists. Do not preserve a duplicate 640px rule merely to satisfy a test string. Preserve user behavior, not accidental implementation details.

### D. Obtain independent acceptance

1. Ask a reviewer who did not author the implementation to inspect the final evidence.
2. Give the reviewer raw measurements, inspected images, and interaction results.
3. Send every failed criterion back as specific rework within the remaining budget.
4. Send unresolved scope or exhausted-budget decisions to the user.
5. Report acceptance separately from installation or deployment.

If the design still looks weak, identify the failed composition rule. Do not defend it with build results or time already spent. Propose a bounded alternative without silently replacing the approved direction.

## 12. Acceptance cases and measurement method

A fixture is a controlled set of test data. Hold the fixture, language, theme, zoom, and actual panel width constant for each density comparison. Record screenshots only after the expected data finishes loading.

Use panel widths of 320, 360, 390, 480, 559, and 720 CSS px. Use real browser zoom levels of 100%, 125%, 150%, and 200%. Test both themes, both densities, and both supported languages.

This produces 192 base cases: `6 × 4 × 2 × 2 × 2`. The earlier 96-case matrix lacked the second language dimension. This is a proposed acceptance expansion, not evidence that any case ran.

Add transition cases at 439px and 440px at 100% zoom. Add the long-string and exceptional-state fixtures at narrow and wide endpoints. Add native keyboard and adjacent-tab cases.

| ID | Acceptance criterion | Required evidence |
| --- | --- | --- |
| G01 | All same-mode quota tracks have equal width within 1 CSS px | Raw rectangles for every loaded row and period |
| G02 | Matched default and compact tracks keep their width and left edge within 1 CSS px | Paired measurements with the same actual content width |
| G03 | Percentages, resets, active state, and Remove do not determine track width | Short, long, 0%, 9%, and 100% fixtures |
| G04 | Identity sits above its quotas at every width | Inspected loaded images, not only CSS declarations |
| G05 | No accidental wrapping beside a track or empty inline meter area | Default-mode images with long reset text |
| G05a | Both wide-layout tracks stay level when either period label wraps | Shared label-row measurements with long translations |
| G06 | Compact changes vertical space only | Equal fonts, horizontal padding, tracks, action targets, and information order |
| G07 | English and Chinese contain no accidental hardcoded UI fragments | Mounted language cases and complete phrase inspection |
| G08 | Longer translations remain readable without clipping | Twice-length test translations and narrow images |
| G09 | Known zero, unknown value, and stale data remain distinct | Controlled state cases with accessible value readback |
| G10 | Remove never switches, and row background never switches | Handler counts and native keyboard tests |
| G11 | Active, working, limited, and dead states preserve geometry and meaning | State fixtures, screenshots, and action guards |
| G12 | Theme, focus, contrast, and neighboring tabs remain usable | Actual computed colors, keyboard evidence, adjacent-tab results |
| G13 | Default-only vertical scrolling does not change track widths | Matched list cases with one density below the scroll threshold |
| G14 | Shared countdown changes preserve quota evaluation behavior | Fresh formatter and existing quota regression tests |

Use `getBoundingClientRect()` for unrounded track rectangles. Measure the background track, not its percentage-dependent fill. Record the quota group width and the scrolling element content width too.

Inspect descendants for horizontal overflow and clipped text. A clean wrapper width alone does not establish this result. An intentional identity ellipsis is not permission to clip values or reset information.

Use real browser zoom controls and record the method. CSS `zoom`, device pixel ratio, and a narrower viewport are not equivalent proof. If a combination cannot run, mark it BLOCKED with its actual limitation.

Do not calculate density savings from different panel widths or different data states. Do not use a loading image to represent the loaded composition. Do not round measurements before testing the tolerance.

## 13. Commands and evidence records

After an approved implementation, run these commands from the repository root. Record each command and its exit code. Investigate failures before advancing the acceptance status.

```bash
pnpm run typecheck
pnpm test --run
pnpm run build
git diff --check
```

HappyDOM can support mounted behavior and selected style assertions. It does not establish actual container geometry or native browser keyboard behavior. A successful test suite does not establish visual acceptance.

Store synthetic evidence under `000 temp/active/<MMDD>/03_intermediate/` inside this project. Use the actual collection date. Keep credentials, cookies, and private account identities out of shared artifacts.

Use this record for each case. Keep failed and blocked records. Link each correction to its original finding.

```text
Case ID:
Source revision and dirty-file baseline:
Loaded artifact identity:
Fixture and language:
Viewport and measured panel width:
Quota group and scrolling-element content widths:
Real browser zoom and method:
Theme and density:
Expected result:
Observed result:
Unrounded track rectangles:
Image path and image inspection result:
Status: PASS | FAIL | NOT RUN | BLOCKED
Reviewer and next action:
```

Use PASS only for the observed criterion. Use FAIL for a reproduced defect. Use NOT RUN for an unexecuted case, and BLOCKED for a concrete execution limit.

## 14. Starting ledger and first action

This ledger separates the delivered design from work that still needs approval or evidence. No source repair ran during this documentation pass. No deployment or new visual acceptance is implied.

| Item | State at handover | Next action |
| --- | --- | --- |
| Design and detailed handover | Proposed | Read the document and settle the preview direction |
| User approval of new composition | Pending | Approve or revise before implementation |
| Six-file boundary and shared formatter change | Pending scope decision | Obtain explicit approval, do not inherit the old four-file allowance |
| Remaining attempts and preview allowance | Unreconciled | Read prior brief history before another run |
| Loaded GUI observations | Blocked by Reconnecting in this pass | Reproduce when the current GUI exposes loaded rows |
| New source changes and automated results | Not run | Execute only after the applicable approval |
| 192 base cases and added state cases | Not run | Agree on acceptance scope, then collect case records |
| Independent visual and behavior verdict | Pending | Review actual final artifacts, not the author summary |
| Deployment, restart, commit, and push | Not authorized | Obtain separate authorization for each needed operation |

The next action for Gemini is a read-only baseline and budget reconciliation. Then prepare the bounded preview under the approved artifact boundary. Do not start with another deployment or another compact-only CSS patch.
