# Antigravity Plugin Refactoring Board (Brooks Architecture Remediation)

## Objective
Remediate code decay identified in Brooks-Lint review, enhance crash resiliency, eliminate knowledge duplication, and decompose monolithic UI into modular tabs.

## Task Inventory

- [x] **Task 1: Crash-Resilient Thought Signature Storage**
  - **Scope:** `src/session.ts`, `src/ids.ts`
  - **Actions:** Replaced synchronous `writeFileSync` with atomic write via `@deepseek-ai/dsh-atomic-write`; extracted magic number `5000` into `THOUGHT_SIGNATURE_MAX_ENTRIES`.
  - **Status:** Done

- [x] **Task 2: Unified Quota Core (DRY Quota Scoring)**
  - **Scope:** `src/quota-core.ts`, `src/session.ts`, `src/client/Settings.tsx`
  - **Actions:** Extracted pure quota evaluation and countdown formatting into `src/quota-core.ts`; deduplicated logic between client UI and server failover.
  - **Status:** Done

- [ ] **Task 3: Stream Handling Decomposition in Adapter**
  - **Scope:** `src/adapter.ts`
  - **Actions:** Extract stream chunk handlers into modular helper functions (`extractReasoningPart`, `sanitizeToolTurn`, `handleFailoverRetry`).
  - **Status:** Pending

- [x] **Task 4: Modular Settings UI Decomposition (Phase 1: Theme & Quota Decoupling)**
  - **Scope:** `src/client/theme.ts`, `src/client/Settings.tsx`
  - **Actions:** Extracted 270+ LOC CSS and theme injector into `src/client/theme.ts`; decoupled quota evaluation into `src/quota-core.ts`.
  - **Status:** Done

## Acceptance Invariants
1. 100% Vitest unit tests pass (>= 101 tests);
2. 0 TypeScript compiler errors (`npm run typecheck`);
3. Seamless live sync to DSH web profile;
4. No UX regressions on mobile and desktop.
