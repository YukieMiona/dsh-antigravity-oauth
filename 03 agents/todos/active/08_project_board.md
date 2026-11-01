# dsh-antigravity-oauth Project Board

Maintainer: @YukieMiona · Last reviewed: 2026-11-01

This board says what is open, who owns it, and how we accept it. Evidence for each item is in the **Reasons** section.

> **Route (2026-11-01):** One owner for each item. Write the owner on the row before work starts. Claude writes code and reviews it. A person does the live tests, because they need real accounts. The maintainer merges.

## Image input

- [x] Send user photos to Gemini on the `agy-google-antigravity` route. (`bdab7d7`)
- [x] **I1 (P1) Send photos on the Web2API route.** (#4)
- [ ] **I2 (P1) Live test of photos on `dev`.** Offered to @YiLianqaq.
- [ ] **I3 (P1) Image request budget.** Owner: unassigned.
- [ ] **I4 (P2) Use the standard placeholder for offloaded images.** Owner: unassigned.
- [ ] **I5 (P2) Test with the real attachment store.** Owner: unassigned.
- [ ] **I6 (P3) Log when an image cannot be read.** Owner: @YiLianqaq. #3

- [ ] **W1 (P2) Check for the system prompt on the Web2API route.** Owner: unassigned.
- [ ] **W2 (P2) Send tool calls and tool results on the Web2API route.** Owner: unassigned.
- [ ] **W3 (P3) Use `timeoutMs` on the Web2API route.** Owner: unassigned.

## Project process

- [x] **P1 Turn on GitHub Issues and move this board to an issue.** (#2)
- [ ] **P2 Run tests on each pull request.** Owner: Claude.
- [ ] **P3 Add `CONTRIBUTING.md`.** Good first issue. Owner: unassigned.
- [ ] **P4 Test against the DSH version that users run.** Owner: unassigned.

## Open pull requests

| PR | Decision | Reason |
|---|---|---|
| #1 | Close with thanks. Keep the root-cause notes and test photos for I2. | `bdab7d7` already fixes the same bug, and the PR conflicts with `dev`. |

## Reasons and acceptance

### I1 Send photos on the Web2API route

- **Problem:** `src/web2api/adapter.ts` declares `inputModalities: ['text', 'image']`, but `convertMessagesToOpenAi` uses `textOf`, which keeps only text. A photo is lost with no error. A photo with no text sends an empty user message. This is the bug that we fixed on the other route.
- **Finding:** The `gemini-web2api-go` README says it accepts `image_url` with `data:` URLs when cookies are set, up to 12 MB for each image. Without cookies it returns 400.
- **Action:** Send images as content parts. Share the read and placeholder logic with the main route.
- **Limit:** Only the newest user message carries image bytes. An older photo becomes a text placeholder, so a follow-up question on `agy-web` cannot see it.
- **Acceptance:** A photo on `agy-web` gets a correct answer with cookies set. Tests cover both a photo with text and a photo without text.

### I2 Live test of photos on `dev`

- **Problem:** Tests for `bdab7d7` use a fake store and a fake Gemini. The PR #1 live test ran on a different code path.
- **Action:** Install `dev` and send the PR #1 test items: a camera photo, an order screenshot, and a photo with no text.
- **Acceptance:** All three get correct answers with no 400 error, on the package build (`lib/index.js`).

### I3 Image request budget

- **Problem:** Each image in the history is sent again on each turn. DSH normalizes an image to at most 4 MiB, which is about 5.6 MB in base64. Google documents a 20 MB limit for one inline request. If the Antigravity endpoint has the same limit, four images of the largest size are too many. After that, each later turn in the session can fail.
- **Do first:** Measure the real request limit of the Antigravity endpoint. The 20 MB value is not confirmed for this endpoint.
- **Action:** Follow `dsh-llm-deepseek`. Read images with `readImageRequest`. Calculate the overflow with `requiredImageOffload`. Throw `LlmError` with `IMAGE_OFFLOAD_REQUIRED_CODE` and `offloadImages`. Then `dsh-compaction-image-offload` removes the oldest images and retries.
- **Acceptance:** A session over the budget continues after an automatic offload. A session under the budget has no change. Tests cover both. Cancel during image reads still stops the request.

### I4 Use the standard placeholder for offloaded images

- **Problem:** `userPartsOf` writes `[Image: name (offloaded)]`. The `ImageBlock` contract requires text that names the image and its read-only path. Without the path, the model cannot open the image again.
- **Action:** Use `projectOffloadedImages` and `offloadedImageText`, with `resolveImageAttachmentAccess` for the path. Do this together with I3.
- **Acceptance:** An offloaded image sends the standard text, with the path when one is available.

### I5 Test with the real attachment store

- **Problem:** The image tests mock `readImage`. A mock cannot show a change in the real store behavior.
- **Action:** Add a test with `LocalAttachmentStore` for: valid, missing, corrupt, zero-byte, and offloaded images, and a bad attachment ID. Use a temporary `DSH_HOME`. Note: `dsh-attachment-local` is not a dependency of this repo today.
- **Acceptance:** Each case passes in the normal test run and uses no user data.

### I6 Log when an image cannot be read

- **Problem:** The `catch` in `resolveImageBlock` hides the reason. The model gets a placeholder, and the user does not know that the photo failed.
- **Action:** Log the attachment ID and error code once for each failure. Do not log image bytes.
- **Acceptance:** A corrupt image writes one log line and the request continues.

### P1 Turn on GitHub Issues

- **Problem:** Issues are turned off, so a contributor cannot see or claim work. Two people fixed the same bug on the same day because of this.
- **Action:** Turn on Issues. Publish this board as a pinned issue. Remove any private notes first.
- **Acceptance:** The board is public, and each open item shows an owner or is free to claim.

### P2 Run tests on each pull request

- **Problem:** `publish.yml` runs tests only for a publish. PR #1 had no automatic checks.
- **Action:** Add a workflow for pull requests that runs `pnpm run check`, and fail it if `lib/index.js` does not match the source.
- **Acceptance:** A pull request shows test, type-check, and build results.

### P3 Add `CONTRIBUTING.md`

- **Problem:** Nothing tells a contributor that `lib/index.js` must be rebuilt, or that a fix needs tests. PR #1 did neither.
- **Action:** Write the rules: claim an item first, rebuild `lib/`, add tests, and test on the current `dev`.
- **Acceptance:** The file exists and the README links to it.

### P4 Test against the DSH version that users run

- **Problem:** The repo develops against DSH `0.2.0-rc.2`, but the local host runs `0.2.2-alpha.2`. Commit `6230d6d` already fixed a bug specific to DSH 0.2.2.
- **Action:** Add the newest supported DSH version to the test run, or update the development version.
- **Acceptance:** Tests run on the oldest and the newest supported DSH version.

### W1 Check for the system prompt on the Web2API route

- **Problem:** `convertMessagesToOpenAi` drops `system` role messages. The `GenerateOptions` docs say that a loop-built history carries the prompt that way. Not confirmed at runtime.
- **Acceptance:** A real agent turn on `agy-web` reaches the gateway with its system prompt.

### W2 Send tool calls and tool results on the Web2API route

- **Problem:** Assistant tool calls become empty text, tool results are dropped, and `options.tools` is not sent. The model never sees a tool result.
- **Acceptance:** A tool call and its result reach the gateway on the next request.

### W3 Use `timeoutMs` on the Web2API route

- **Problem:** `settings.timeoutMs` is stored but not read. A stalled gateway holds the turn until the user cancels.
- **Acceptance:** A stalled gateway ends the turn with an `LlmError` of code `TIMEOUT`.

## Order of work

1. P1, so that everyone can see this board.
2. I2, because it can show new bugs. It needs no code.
3. I1, then I6, then I3 with I4.
4. W1, W2, W3.
5. I5, P2, P3, P4.

## Rules

- Claim an item before you start. One owner for each item.
- Use Conventional Commits. Put the item ID in the body.
- Each change must pass `npm run check` and include the rebuilt `lib/index.js`.
- When an item is done, mark it and add the commit or PR. Put evidence in the PR, not on this board.
