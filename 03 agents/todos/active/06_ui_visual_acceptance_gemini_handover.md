# Gemini handover: visual design and evidence

## 1. Assignment and authority

Gemini, improve the account interface without repeating the previous acceptance errors. Preserve useful repairs instead of starting another redesign. Produce a quiet, readable list that belongs in the host GUI.

The current user request authorizes this handover file only. It does not authorize another implementation, deployment, rollback, host restart, commit, or push. In a later execution session, follow the actual authorization in that session. Do not request permission again for work that the user already authorized there.

This document supplies visual direction and an execution sequence. It does not claim that the current interface passes. The proposed visual choices below need a preview before implementation proceeds across the complete interface.

Use current user instructions before this document. Preserve behavior requirements from the [earlier corrective guide](<04_ui_redesign_gemini_corrective_handover.md>). Preserve the evidence requirements in the [compact and dark-theme guide](<05_ui_compact_dark_gemini_handover.md>). Do not use their completion tables as independent acceptance evidence.

Keep those documents unchanged. Add corrections to the next execution report instead of rewriting the historical record. If requirements conflict, identify the exact conflict before dependent work.

The user wants minimal interface copy. Do not add explanatory subtitles, repeated helper sentences, or decorative labels to hide weak layout. Keep necessary labels, errors, recovery actions, and accessible names.

## 2. Starting state and evidence boundaries

The repository is `/root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth`. The documentation pass observed branch `dev` at `9d366c3a18d0daf060f2fa70d1d3aa8b2969da10`. The working tree contains substantial uncommitted UI work.

TaskStartSnapshot: the documentation pass read the working-tree status before writing this file. Existing changes include UI source, dependencies, test configuration, tests, and generated output. This document does not authorize cleanup of that baseline.

Change necessity: the previous report closes visual requirements with incomplete or mismatched evidence. ArchitectureReviewRequired: no architecture change for this documentation task. Reassess ownership if the later repair needs a second renderer or new state model.

At the start of authorized execution, record these commands from the repository:

```bash
pwd
git branch --show-current
git rev-parse HEAD
git status --short
git diff --stat
```

Record the installed client artifact separately from the source revision. A dirty source tree and an installed bundle are different baselines. Do not reset, stash, regenerate, or stage unrelated files.

The current runtime names `http://127.0.0.1:3080`. Use the existing authenticated browser session. Do not replace this GUI with another development server.

The last controlled deployment used `/root/.dsh/profiles/web/node_modules/dsh-antigravity-oauth/lib/`. Its reported backup was `/root/.dsh/profiles/web/node_modules/dsh-antigravity-oauth/lib.bak.1793153973207`. Neither path grants permission to change or restore installed files.

The previous run reported successful type tests, 126 passing tests across 22 files, and an 86.14 kB client build. These are historical results, not fresh results for the next repair. A passing build does not prove readable layout, keyboard behavior, or visual quality.

## 3. Correct the previous claims before using them

This table preserves useful observations and rejects unsupported conclusions. These findings come from the recorded session, not new browser measurements during this documentation pass. Reproduce affected cases before code changes.

| Finding | Recorded evidence | Correct status and next evidence |
| --- | --- | --- |
| V01: Shared columns | The repair reserves a 64px action track. Rounded measurements at 720px match between active and inactive rows. | Promising repair. Obtain unrounded browser rectangles before claiming a measured tolerance. Do not claim exactly 0.00px from rounded integers. |
| V02: Compact density | Compact quota frames were removed. The reported normal panel was 559px, but the compact panel was 564px. | Structural progress, but the density comparison is not controlled. Compare equal widths with identical loaded data. |
| V03: Dark surfaces | The card uses a host surface. Inactive rows and compact quota groups are transparent. | Progress, not complete visual acceptance. Inspect hierarchy and interaction states in actual host dark mode. |
| V03: Active accent | The computed active color used channels near white. The report called it primary blue. | The description is wrong. Record resolved colors instead of inferring color from a token name. |
| V04: Browser zoom | Width measurements covered 720, 520, 480, 390, 360, and 320px. Only wrapper overflow was reported. | Actual browser zoom remains unestablished. Width changes do not close zoom or descendant clipping cases. |
| V05: Reporting | The final report and the prior ledger marked all findings resolved. | Reopen unsupported conclusions. Keep implementation, observed results, and acceptance separate. |
| Final light screenshot | Refresh displayed `...` and quota values were absent. | Loading-state evidence cannot prove the loaded normal layout. |
| Independent review | No independent acceptance report covers the complete required matrix. | Still pending. The implementation author cannot supply the independent verdict. |

The recorded [dark compact screenshot](</tmp/ego-browser-shot-2883155-1.png>) contains crowded inline data and a host tooltip. The recorded [light normal screenshot](</tmp/ego-browser-shot-2883567-1.png>) captures loading. Treat these as historical examples of evidence limits.

Do not erase a useful fix because its report overstated the result. Equally, do not defend a weak result because its author invested effort. Resolve disputed findings through reproduction and comparable images.

## 4. Visual target and priorities

Visual hierarchy means the order in which information attracts attention. Account identity must lead each row. Quota percentages support comparison, reset times supply context, and secondary actions remain quiet.

The intended result is a management list, not a dashboard of nested cards. Use alignment and spacing to group information. Use borders and fills only where they distinguish a useful boundary or state.

Apply these priorities in order:

1. Preserve correct behavior and accessible controls.
2. Keep account identity, quota meaning, and recovery information readable.
3. Keep shared columns stable across account states.
4. Establish clear visual hierarchy in both themes.
5. Remove unnecessary frames, gaps, and repeated copy.
6. Reduce row height only when the preceding requirements still pass.

A shorter row is not automatically better. A row that forces readers to decode crowded fragments fails the target. More visible accounts cannot compensate for lost meaning or hard-to-use controls.

Use this comparison during image review:

| Element | Acceptable result | Reject this result |
| --- | --- | --- |
| Whole panel | One host-consistent surface with clear sections | A pile of equally prominent rounded boxes |
| Account identity | Easy to locate and compare down the list | Email text squeezed against quota text |
| Quota groups | Stable positions with clear value, bar, and reset associations | A continuous strip of unrelated numbers |
| Reset time | Readable supporting text tied to the correct quota | Tiny detached text or ambiguous unlabeled values |
| Active account | A restrained state visible without hover | A bright white outline that dominates every percentage |
| Remove | A discoverable secondary action with its own target | The strongest element in every row |
| Compact mode | Less framing and deliberate grouping | The normal layout compressed until text collides |
| Narrow mode | An intentional stacked layout | Accidental wrapping, cropped controls, or overlapping content |

## 5. Composition rules for the preview

Start with the existing renderer and repaired action track. Do not replace the component tree merely to obtain another appearance. Match surrounding host controls before inventing a separate style system.

For a wide compact row, keep identity, two quota groups, and the action slot in a consistent reading order. Each quota group must keep its percentage, progress, and reset meaning together. This diagram describes information order, not final widths or mandatory new labels:

```text
Identity                 Quota group A       Quota group B       Action
Account email            Value + progress    Value + progress    Active or Remove
                         Reset time          Reset time
```

The second line is available when content needs it. Do not force every datum onto one line to reach a height target. Normal mode can use more vertical space without another layer of heavy boxes.

At narrow widths, keep identity and the action slot distinct. Place quota groups below when they cannot fit legibly. Stack quota groups when side-by-side presentation loses meaning or clips content.

Use these layout rules:

1. Give active and inactive rows the same action-space ownership.
2. Keep quota group boundaries consistent across the list.
3. Reserve visible separation between identity and the first quota group.
4. Align percentages and reset text consistently inside each quota group.
5. Allow row height to grow for required text and browser zoom.
6. Preserve the full identity through an accessible disclosure when visual truncation is necessary.
7. Keep truncation from hiding differences between otherwise similar accounts.
8. Keep actions inside the visible and scrollable panel area.

The current 64px action slot is an implementation choice, not a universal design rule. Preserve it initially. If localized content cannot fit, propose a shared adjustment instead of allowing one row to collapse.

Do not assume that `1.2fr` and `2fr` create a good balance at every width. Fractions divide available space, not reading effort. Let real identities, quota text, and zoom cases expose unsuitable proportions.

## 6. Typography, spacing, and surfaces

The recorded sizes were 13px for email, 11px for quota percentage, and 10px for reset text. Preserve these sizes as a lower bound for the next preview. They are historical values, not proof of readability.

If reset text remains hard to read, improve contrast, spacing, or available space first. Propose larger text when necessary. Do not reduce text size or line height to recover a preferred row height.

Use the host font family and established control styles. Keep numeric values aligned when the font supports tabular figures. Avoid added uppercase labels, excessive letter spacing, or bold text across every row.

Use a small, consistent spacing scale from the existing interface. Keep related data closer than unrelated groups. Do not assign different padding to every breakpoint without a content reason.

A surface is a background layer. Keep the panel surface separate from the host backdrop. Keep ordinary rows quiet, and keep compact quota groups unframed.

These token values are historical observations, not hard-coded replacements:

| Host token | Recorded dark value | Intended use |
| --- | --- | --- |
| `--dsw-alias-settings-card-fill` | `#2c2c2e` | Panel surface |
| `--dsw-alias-settings-card-stroke` | `#ffffff33` | Panel boundary |
| `--dsw-alias-interactive-bg-hover` | `#ffffff14` | Interaction feedback, not every resting layer |
| `--dsw-alias-border-l1` | `#ffffff0f` | Subtle boundary where needed |
| `--dsw-alias-label-primary` | `#f9fafb` | Primary text |
| `--dsw-alias-label-secondary` | `#cfd3d6` | Supporting text |

Resolve tokens in both actual host themes. Do not assume that a token named primary is blue. Do not infer contrast from opacity values alone.

Keep hover, active selection, keyboard focus, and busy states distinct. The active account must remain identifiable without color alone. Focus must remain visible against both resting and selected backgrounds.

Do not remove every boundary. A quiet divider can help readers follow a dense list. Remove redundant framing, not useful structure.

## 7. Behavior and accessibility constraints

Preserve a single account renderer for both density modes. Preserve separate identity-switch and Remove controls. Do not restore a clickable parent row or nest buttons.

Keep all existing account operations and recovery paths:

1. Preserve account selection and the active indicator.
2. Preserve Add, Refresh, Remove, and their busy guards.
3. Preserve authentication recovery and actionable errors.
4. Preserve quota percentages, reset times, loading, and unavailable states.
5. Preserve notice dismissal and restoration.
6. Preserve translations and accessible control names.
7. Preserve secondary tabs and their current behavior.

Minimal copy does not mean missing meaning. If shared quota headers disappear at narrow widths, retain another clear visible association. Do not replace necessary information with hover-only tooltips.

Make sure that native Tab navigation reaches controls in logical order. Make sure that Enter and Space retain native button behavior. Make sure that Remove does not also switch the account.

Make sure that disabled and busy controls prevent duplicate requests. Make sure that loading cannot appear to mean zero quota. Make sure that failure leaves the appropriate recovery action available.

Use synthetic data for destructive or account-changing interactions. Do not remove real accounts, switch the real active account, or begin OAuth flows for visual tests. Theme and density changes are reversible preview actions.

## 8. File ownership and scope

Read each file before editing it. Use published file and command tools. Do not use direct Node filesystem writes or `execSync` to bypass those tools.

| Owner | Purpose in the authorized repair |
| --- | --- |
| [Theme source](<../../../src/client/theme.ts>) | Shared layout, surfaces, spacing, responsive rules, and interaction styling |
| [Account component](<../../../src/client/tabs/AccountsTab.tsx>) | Row structure, action ownership, and semantic controls |
| [Mounted UI tests](<../../../tests/client-ui.spec.ts>) | Account behavior and regression coverage |
| [Secondary-tab tests](<../../../tests/secondary-tabs.spec.ts>) | Existing neighboring behavior coverage |
| [Settings component](<../../../src/client/Settings.tsx>) | Read for context. Changes require an explicit scope decision. |

Prefer a repair in the theme source and account component. Use existing tests where possible. Request a scope decision before changing dependencies, translations, build configuration, backend code, or secondary-tab source.

Do not retain duplicate container rules merely because a test searches for an exact CSS string. Test the intended outcome. If consolidation is necessary, preserve behavior and report why the assertion changes.

Do not introduce a second theme owner or a density-specific copy of the account component. If the boundary cannot meet a requirement, explain the limitation before adding another owner.

## 9. Execution phases and stop points

Complete these phases in order. A phase result does not accept the whole interface. Keep one report with evidence and remaining work.

### Phase A: Establish a clean comparison

1. Read the relevant behavior requirements and this guide.
2. Record source status, installed artifact identity, and browser conditions.
3. Inspect the browser snapshot before navigation or clicks.
4. Remove only temporary preview styles that this execution owns.
5. Make sure that prototype DOM changes do not contaminate the baseline.
6. Capture loaded normal and compact views at the same actual panel width.
7. Reproduce the disputed alignment, density, and dark-theme cases.

Record actual panel width instead of the requested style value. Record viewport width separately. If the loaded state is unavailable, report the cause instead of substituting an empty screenshot.

### Phase B: Present one bounded visual preview

1. Prepare one coherent preview for the proposed direction.
2. Show loaded normal and compact views in light and dark themes.
3. Include the usual panel width and a narrow endpoint.
4. Explain hierarchy and grouping through the images.
5. Name tradeoffs that change readable information or interaction.
6. Use the question tool for unsettled visual-direction decisions.

This preview prevents another speculative redesign. Do not reopen settled behavior decisions or ask the user to find repository facts. Do not treat a general acknowledgment as approval of an unstated change.

If the preview looks crowded, repair grouping before reducing padding again. If two alternatives remain, compare them under identical data and conditions. Do not generate unrelated visual styles.

### Phase C: Implement the accepted direction

1. Make the smallest changes within the approved ownership boundary.
2. Preserve the action-track repair unless evidence requires a shared adjustment.
3. Add focused regression coverage for the changed behavior or layout contract.
4. Run the automated commands after changes.
5. Inspect the loaded browser result before requesting independent review.

Remove temporary preview injection before acceptance measurements. An injected prototype does not prove that the accepted bundle contains the repair. Do not claim that URL reuse proves a hard refresh.

### Phase D: Review, route defects, and report

1. Give an independent reviewer the criteria, source delta, and case-level evidence.
2. Require the reviewer to inspect actual images and relevant behavior.
3. Route reproduced defects back to the implementation owner.
4. Route scope conflicts to the user through the question tool.
5. Repeat affected evidence after each repair.
6. Report source readiness separately from deployment readiness.

A reviewer notification proves that the reviewer stopped. It does not prove acceptance. Keep defects open until repair or an explicit user scope decision resolves them.

## 10. Limits for the later repair brief

Reconcile earlier task runs before dispatch. Do not reset an exhausted repair budget by renaming the same work. These caps apply to a newly authorized bounded brief only when its budget remains available.

| Dimension | Unit | Cap | Accumulation rule |
| --- | --- | --- | --- |
| Implementation attempts | Runs per brief | 3 total, including the first run | Cumulative across that brief and its continuations |
| Source and test edits | Distinct files | 4 | Cumulative across all runs of the brief |
| Commands | Invocations | Unlimited within authorized scope | No numeric cap and no cycle reset |
| Test executions | Runs | Unlimited within authorized scope | No numeric cap and no cycle reset |
| Local evidence files | Files | Unlimited within authorized scope | No numeric cap. Keep them under the project temporary directory. |
| Independent visual proposals | Alternatives | 2 | Cumulative for the visual-direction decision |
| Real account mutations | Operations | 0 | Cumulative for this visual repair |
| Dependency additions | Packages | 0 | Cumulative unless the user changes scope |
| Deployment, restart, commit, or push | Operations | 0 | Cumulative until separate scoped authorization |

No per-cycle allowance applies. Do not bank unused attempts or create artificial cycles. If a limit is unclear, use one minimal tool call to inspect the controlling brief.

Documentation and evidence do not expand the four-file source and test cap. They also do not permit unrelated repository changes. If ownership exceeds the cap, request a scope decision before editing another file.

## 11. Required visual and behavior evidence

The inherited matrix uses actual panel widths of 320, 360, 390, 480, 559, and 720 CSS pixels. A CSS pixel is the layout unit used by the browser. Panel width is not viewport width.

Exercise each width at browser zoom levels of 100%, 125%, 150%, and 200%. Exercise both actual host themes and both density modes. This produces 96 base combinations before additional state cases.

Use real browser-level zoom controls. Do not substitute `document.body.style.zoom`, a CSS transform, a narrower viewport, or a changed pixel ratio. If tooling cannot establish browser zoom, mark those cases BLOCKED with the exact limitation.

At each base case, use loaded representative accounts with active and inactive rows. Record text visibility, row height, column boundaries, descendant clipping, and action reachability. Open the image instead of relying only on measurements.

Also exercise these cases:

1. Inspect both sides of the current 520px and 640px layout thresholds.
2. Exercise Chinese labels at the narrow and wide endpoints.
3. Exercise long identities and long reset text at the endpoints.
4. Exercise zero, full, unavailable, loading, and partial quota states.
5. Exercise authentication and refresh failure with synthetic responses.
6. Exercise keyboard focus through identity, Refresh, Add, and Remove.
7. Inspect Network, Web2Api, and Advanced at narrow and wide endpoints.
8. Make sure that notice dismissal and restoration still work.

Use current source thresholds if the accepted repair changes them. Record exact threshold values and adjacent tested widths. Do not claim physical-device or OS scaling results from browser-only cases.

Use unrounded `getBoundingClientRect()` values for alignment. Compare coordinates relative to each row, not only to the viewport. Keep row width, metric start, metric width, and action width in the evidence record.

The earlier guide proposed a tolerance of at most one CSS pixel for matching column boundaries. Retain that proposed tolerance unless the user changes it. Do not present it as an original user measurement.

Measure descendants, not only the wrapper. Inspect intentional ellipsis separately from unintended clipping. Make sure that focus rings, controls, percentages, and reset text remain visible and meaningful.

For density comparisons, hold theme, zoom, panel width, language, and fixture constant. A fixture is a controlled set of test data. Show matched images with row-height measurements, not only a density percentage.

Do not aim for a mandatory 32px row. Let readability and content determine height. Report measured density only for conditions actually compared.

HappyDOM tests can support mounted component behavior. They do not establish browser geometry, native keyboard defaults, or visual hierarchy. Keep those boundaries in the final report.

## 12. Automated commands and case records

Run these commands from the repository after implementation:

```bash
pnpm run typecheck
pnpm test --run
pnpm run build
git diff --check
```

Record each command, exit code, and actual result. If a command fails, investigate before proceeding. Do not repeat the historical test count as a new result.

Use one record per visual or interaction case:

```text
Case ID:
Source revision and dirty-file baseline:
Loaded artifact identity:
Viewport dimensions:
Measured panel width:
Browser zoom level and method:
Host theme and density:
Language and fixture state:
Expected result:
Observed result and raw measurements:
Image path and image inspection result:
Status: PASS | FAIL | NOT RUN | BLOCKED
Reviewer and disposition:
```

Store new evidence under `000 temp/active/<MMDD>/03_intermediate/` within this project. Use synthetic identities in shareable evidence. Do not publish private accounts, credentials, or cookies.

Use PASS only for the named case and observed criteria. Use FAIL for a reproduced defect. Use NOT RUN for an unexecuted case, and BLOCKED for a concrete execution limitation.

If a result contradicts an earlier claim, preserve both the earlier claim and the correction. Name different conditions when they explain the difference. Do not silently replace inconvenient measurements.

## 13. Failure rules and deployment boundary

Do not turn these shortcuts into acceptance:

1. A matching CSS string does not prove aligned browser columns.
2. A smaller row does not prove better readability.
3. A host token does not prove suitable color or contrast.
4. No wrapper overflow does not prove no clipping.
5. A loading screenshot does not prove loaded layout.
6. A successful build does not prove visual quality.
7. A prior deployment approval does not authorize another deployment.
8. An author report does not replace independent review.
9. An untested case does not become a pass through explanation.

If browser evidence is unavailable, report the blocked cases and next reproducible step. Do not fabricate a passing matrix or create another framework without scope approval. Preserve the work without claiming acceptance.

If implementation still fails after the third permitted run, follow the active escalation policy. If the budget was already exhausted, escalate before another attempt. Do not evade limits through another task name or tool.

Do not copy artifacts into the installed plugin during preview or review. If later deployment is authorized, record full hashes, a recoverable backup, and the exact destination. Refresh the existing GUI and establish which artifact it loads.

Do not promise automatic updates without evidence that the relevant watcher runs. Do not start a replacement server or restart the host to make the result appear current. Restore preview-only theme, density, width, and zoom changes when evidence collection ends.

## 14. Starting ledger and final handoff

This ledger describes the state at document delivery. The documentation pass did not implement another repair or rerun browser acceptance. Pending items need their own evidence.

| Work item | Starting state | Completion evidence |
| --- | --- | --- |
| Documentation task | This new handover only | Readback and scope inspection |
| Baseline reproduction | Pending | Current source and installed artifact records, matched loaded images |
| Visual direction | Proposed, not accepted | Comparable preview with explicit disposition of unsettled choices |
| V01 alignment | Repair exists, precise acceptance pending | Raw browser rectangles and inspected images |
| V02 density and readability | Partial evidence, matched comparison pending | Equal-width normal and compact cases with readable loaded data |
| V03 theme and states | Surface repair exists, full acceptance pending | Real light and dark resting, active, hover, focus, and busy cases |
| V04 responsive and zoom | Incomplete | Case-level width and real browser zoom matrix |
| V05 truthful reporting | Previous closure unsupported | Evidence records with explicit missing cases |
| Fresh automated results | Not run for the next repair | Current command outputs and exit codes |
| Independent acceptance | Pending | Reviewer findings with every defect routed |
| Additional deployment | Not authorized by this document | Separate authorization and installed artifact evidence |
| Repair run count | Must be reconciled | Existing brief history before another dispatch |

End the execution report with actual changed files and their purpose. Separate automated results, browser results, independent verdict, and installed state. List every remaining case and its next action.

If visuals remain weak, name the composition rule that fails. If evidence is incomplete, name the open case. Do not claim complete implementation and acceptance unless records support the complete claim.

The next useful action is baseline reproduction, not another deployment. Preserve successful action-track and surface changes while establishing what the loaded interface does. Then settle the bounded visual direction before further implementation.
