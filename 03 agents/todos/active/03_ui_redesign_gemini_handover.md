# Gemini handover: responsive plugin redesign

## State and approved outcome

The user approved an adaptive plain account list and a minimal redesign of all four plugin pages. Do not repeat the design interview. This is a pending task, not a completion report.

No redesign files changed. Both implementation briefs used runs 1/3 and 2/3. All four runs stopped because child write access covered /root/Desktop/Work, not the repository. The user now reports access is fixed. Actual child access remains untested after that report. Do not dispatch again until the scope is correct. Do not bypass a denial with another tool or shell.

Fresh Git inspection returned exit code 0. Branch: dev. HEAD: 9d366c3a18d0daf060f2fa70d1d3aa8b2969da10. Only untracked 000 temp/ appeared. Preserve it. Compare this baseline with the current worktree before edits.

## Design contract

Wide panels show aligned email, five-hour quota, weekly quota, and actions. Narrow panels stack quota details below the account. Respond to container width, not device type. Compact mode changes spacing, not font size. Normal mode shows reset times. Keep the active account beside the plugin title.

Remove decorative icons, badges, project IDs from the main account view, repeated labels, and unnecessary prose. Do not add account-count decoration. Preserve necessary labels, errors, unofficial-login notice, and recovery controls. Preserve English and Chinese translations.

Backend behavior, quota calculations, stored formats, and APIs remain outside scope. Do not expand this task into the earlier Brooks backlog. Do not promise that Advanced strategies work in the backend.

## Source and defect map

Repository: /root/Desktop/Project/2026/active/1005 dsh-antigravity-oauth. Paths and lines below are relative to it. Line numbers describe the inspected baseline. Read current files before editing.

1. src/client/Settings.tsx imports AccountsTab but renders a duplicate inline list at lines 549–713. Mount one AccountsTab. Preserve login/add/refresh at lines 530–544, completion/reopen/form at 715–734, and retry at 736–745.
2. src/client/theme.ts forces column layout at every width near line 146. Compact rules reduce fonts near lines 175–177 and hide reset information near 209–211. Replace conflicting owner rules. Do not append another override pile.
3. src/client/tabs/AccountsTab.tsx is unused. Make switching an explicit native account-name button. Keep Remove separate. Do not wrap nested controls in a clickable row.
4. src/client/tabs/Web2ApiTab.tsx hides Save and feedback when disabled. The existing handler supports enabled: false. Move Save and feedback outside enabled-only fields.
5. src/client/tabs/AdvancedTab.tsx uses pointer-only strategy choices. Use native keyboard-accessible controls.

## Pending todo list

- [ ] Read project instructions and load ui-ux-governance. Load systematic-debugging if unexpected failures occur.
- [ ] Open the repository as the session workspace. Make sure that actual child permission scope covers it before implementation.
- [ ] Implement account layout, header, and shared styles. Boundary: src/client/Settings.tsx, src/client/theme.ts, src/client/tabs/AccountsTab.tsx, src/client/locales.ts, and focused new tests.
- [ ] Simplify the three other views. Boundary: src/client/tabs/AdvancedTab.tsx, src/client/tabs/Web2ApiTab.tsx, src/client/tabs/NetworkTab.tsx, and focused new tests. Preserve existing props and callbacks.
- [ ] Run focused interaction tests, type checks, full tests, and build. Record exact outcomes.
- [ ] Obtain independent review. Return defects to the implementation owner. Do not ship a named defect as a summary caveat.
- [ ] Assess actual rendered panels at the required widths and zoom levels. Record screenshots, measurements, interactions, and limitations.
- [ ] Deploy only accepted build artifacts. Refresh and assess the existing live GUI. Report the actual result.

The two implementation boundaries are independent if current session rules permit parallel dispatch. Coordinate shared classes first. Existing shared classes include dsh-agy-card, dsh-agy-row, dsh-agy-input, dsh-agy-select, dsh-agy-segmented, and dsh-agy-radio-card. Proposed stack, field, actions, muted, and feedback helpers do not exist yet. Do not edit files owned by a running sibling.

Use native subagents, not a pure-text workflow that cannot inspect or run tools. Each brief needs Goal, Boundary, Constraints, Limits, Acceptance Criteria, and Required Evidence. State quantitative caps explicitly. Follow current session routing rules. Preserve the two blocked runs per brief rather than resetting history.

## Required behavior

Accounts retain Add, Refresh, switch, Remove, authentication completion, reopen, retry, active identity, quota values, and errors. Use fixtures for destructive interactions. Do not remove real accounts for a test. Preserve notice dismissal and restoration.

Advanced retains low/medium/high effort and context values 131072/262144/524288/1048576. Preserve strategy values failover_429, proactive_threshold, round_robin, and manual. Threshold minimum is 10, maximum is 40, and step is 5. Preserve Save and loading states. Backend consumption of these values remains unproved and outside scope.

Web2API retains enable/disable, Save while disabled, base URL, password key, image toggle, presets, Test, feedback, and disabled/loading states. Preserve Docker command copy, detection, guide dismissal, and restoration. Never expose secret values in evidence.

Network retains auto/direct/proxy modes, URL for proxy mode, effective route, Save, loading, and errors.

## Evidence gates

Run these commands from the repository. Inspect every exit code. Investigate failures before continuing.

```bash
pnpm run typecheck
pnpm test --run
pnpm build
```

Historical results were 101 tests across 20 suites. They predate the redesign and prove no new UI result. Read vitest.config.ts. Focused tests belong under tests/**/*.spec.ts. Test rendered interactions, not only source-string presence.

Assess container widths 320, 360, 390, 480, and 720 CSS pixels. Assess zoom 100%, 125%, 150%, and 200%. Record the actual method. Viewport emulation alone does not prove operating-system DPI coverage.

Make sure that wide quota columns align and narrow panels stack without clipping or horizontal overflow. Compare normal and compact font sizes. Test long emails, missing quota, loading, errors, disabled controls, keyboard focus, guide recovery, and Save while Web2API is disabled. Use fixtures or controlled tests for persistence and account mutations.

A build pass is not visual evidence. Bundle text does not prove component mounting. Repeating a quota algorithm is not independent validation. Screenshots do not prove callbacks. If browser access fails, leave visual acceptance pending. Never invent a pass.

## Live environment and release boundaries

Installed artifacts: /root/.dsh/profiles/web/node_modules/dsh-antigravity-oauth/lib/. This differs from the source repository. Do not copy source directly over installed artifacts. Preserve a recoverable prior build before deployment.

Existing GUI: http://127.0.0.1:3080. Private http://100.115.191.114:3088/ previously opened an authenticated GUI. Loopback previously required authentication. Reuse the default browser space. Read the current page before clicks. A stale Antigravity locator already failed once.

Do not start a replacement server. Do not promise automatic reload without evidence of the relevant watcher. Adding a host configuration comment does not prove reload. Build and deploy through the supported plugin process. Refresh the existing URL and assess it.

Do not restart DSH, alter authentication, install dependencies, force-push, or merge main without authorization. No new main merge is approved. Before commits or pushes, satisfy active project review gates. Inspect Git Forge policy before pushing. Never expose credentials.

## Reporting and next action

Update this checklist after each phase. Record files changed, exact test outcomes, review findings and resolutions, browser coverage, and gaps. Never replace missing evidence with confidence or a percentage score.

Earlier Brooks completion claims were overstated. AccountsTab was unused, the external quota script was not unified, and Advanced backend wiring remained unproved. Do not inherit those claims as facts or expand scope to repair them.

Next action: make sure that the session and children can write to the repository, then implement the approved two-part UI plan. Completion requires implementation, independent review, browser acceptance, and live assessment. All remain pending.
