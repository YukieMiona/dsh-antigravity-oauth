# Contributing to dsh-antigravity-oauth

Thank you for helping improve `dsh-antigravity-oauth`. Please follow these rules so changes merge smoothly.

## Branch Workflow

1. Always branch off `dev`.
2. Name your branch with a prefix matching the change:
   - `feat/<name>` for new features
   - `fix/<name>` for bug fixes
   - `refactor/<name>` for refactoring without behavior changes
3. Open pull requests against `dev`, never directly against `main`.
4. Keep pull requests focused on one item from [Issue 2](https://github.com/YukieMiona/dsh-antigravity-oauth/issues/2).

## Local Testing and Memory Constraints

**Iron Law:** Do not run `vitest` or `npm test` locally on resource-constrained hosts (e.g. VPS or containers with under 1 GB available memory). Running multi-worker test suites locally can cause Out-Of-Memory (OOM) crashes.

Instead, verify changes locally using:
```bash
# 1. Full TypeScript type checking across src and tests
npm run typecheck

# 2. Bundle compilation for both server and web client
npm run build
```

Full automated regression test suites run in GitHub Actions CI on every pull request (`pnpm run check`).

## Rebuilt Distribution Bundles

Because DeepSeek Harness loads plugin bundles from `lib/client.js` and `lib/index.js`, every change to `src/` must include freshly compiled bundles. Always run:
```bash
npm run build
git add lib/
```
Ensure `git status` shows no uncommitted changes before pushing.

## Commit Conventions

Use Conventional Commits for commit messages:
- `feat(scope): description`
- `fix(scope): description`
- `refactor(scope): description`
- `chore(scope): description`

## Code Review and Optimization Gate

Complete a three-step review before each commit:
1. Run `/simplify` to remove dead code, unused branches, and speculative abstractions.
2. Run `dsh.code.review` to diagnose edge cases, cancellation contracts, and concurrency risks.
3. Run `/brook-lint` to prevent architectural decay, coupling, and cognitive overload.

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)
