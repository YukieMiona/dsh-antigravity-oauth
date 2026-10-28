export const STYLE_ID = 'dsh-antigravity-oauth-settings-theme'

export const SETTINGS_CSS = `
.dsh-agy-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 720px;
  color: var(--dsw-alias-label-primary, CanvasText);
  font-family: inherit;
  position: relative;
  container-type: inline-size;
  container-name: agy-settings;
  min-width: 0;
  box-sizing: border-box;
}

/* Header */
.dsh-agy-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.dsh-agy-title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
}
.dsh-agy-title {
  margin: 0;
  font-size: 16px;
  line-height: 22px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, CanvasText);
}
.dsh-agy-header-active-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  color: var(--dsw-alias-label-secondary, GrayText);
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-agy-body {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary, GrayText);
}
.dsh-agy-error {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-state-error-primary, CanvasText);
  padding: 6px 12px;
  border-radius: 6px;
  background: rgba(242, 90, 90, 0.12);
  border: 1px solid rgba(242, 90, 90, 0.25);
}

/* Floating Toast */
.dsh-agy-toast-float {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2, Canvas);
  border: 1px solid var(--dsw-alias-state-success-primary, CanvasText);
  color: var(--dsw-alias-state-success-primary, CanvasText);
  font-size: 12px;
  font-weight: 500;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  animation: dsh-agy-fadein 0.2s ease-out;
}
@keyframes dsh-agy-fadein {
  from { opacity: 0; transform: translateY(-6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Notice banner */
.dsh-agy-notice-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
}
.dsh-agy-notice-close {
  background: none;
  border: none;
  color: var(--dsw-alias-label-secondary, GrayText);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 4px;
}
.dsh-agy-notice-close:hover {
  color: var(--dsw-alias-label-primary, CanvasText);
  background: var(--dsw-alias-border-l3, GrayText);
}

/* Tabs */
.dsh-agy-tabs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
  padding: 3px;
  background: var(--dsw-alias-bg-module-platform, Canvas);
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  border-radius: 8px;
  width: 100%;
  box-sizing: border-box;
}
.dsh-agy-tab-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, GrayText);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.dsh-agy-tab-btn:hover {
  color: var(--dsw-alias-label-primary, CanvasText);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
}
.dsh-agy-tab-btn.is-active {
  color: var(--dsw-alias-label-primary-foreground, HighlightText);
  background: var(--dsw-alias-button-primary-fill, Highlight);
  font-weight: 600;
}

/* Cards */
.dsh-agy-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l3, GrayText));
  border-radius: 8px;
  background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-2, Canvas));
  box-sizing: border-box;
  width: 100%;
}
.dsh-agy-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.dsh-agy-card-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, CanvasText);
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Status Indicators */
.dsh-agy-status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  color: var(--dsw-alias-label-secondary, GrayText);
}
.dsh-agy-status-badge.is-success {
  background: rgba(65, 201, 119, 0.12);
  color: var(--dsw-alias-state-success-primary, CanvasText);
}
.dsh-agy-status-badge.is-error {
  background: rgba(242, 90, 90, 0.12);
  color: var(--dsw-alias-state-error-primary, CanvasText);
}
.dsh-agy-status-badge.is-switching {
  background: rgba(250, 140, 22, 0.12);
  color: var(--dsw-alias-state-warn-primary, CanvasText);
}
.dsh-agy-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: 0 0 auto;
  background: var(--dsw-alias-label-secondary, GrayText);
}
.dsh-agy-dot.is-signed-in,
.dsh-agy-dot.is-active {
  background: var(--dsw-alias-state-success-primary, CanvasText);
}
.dsh-agy-dot.is-error {
  background: var(--dsw-alias-state-error-primary, CanvasText);
}
.dsh-agy-dot.is-signing-in {
  background: var(--dsw-alias-button-primary-fill, Highlight);
}

/* Buttons */
.dsh-agy-btn {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  padding: 3px 12px;
  border-radius: 6px;
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
  transition: all 0.15s ease;
  text-decoration: none;
  border: 1px solid transparent;
  user-select: none;
}
.dsh-agy-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.dsh-agy-btn-primary {
  background: var(--dsw-alias-button-primary-fill, Highlight);
  color: var(--dsw-alias-label-primary-foreground, HighlightText);
  border-color: var(--dsw-alias-button-primary-fill, Highlight);
  font-weight: 500;
}
.dsh-agy-btn-primary:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover, Highlight);
  border-color: var(--dsw-alias-button-primary-hover, Highlight);
}
.dsh-agy-btn-secondary {
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  color: var(--dsw-alias-label-primary, CanvasText);
}
.dsh-agy-btn-secondary:hover:not(:disabled) {
  background: var(--dsw-alias-border-l3, GrayText);
  border-color: var(--dsw-alias-border-l3, GrayText);
  color: var(--dsw-alias-label-primary, CanvasText);
}
.dsh-agy-btn-compact {
  min-height: 24px;
  padding: 2px 8px;
  border-radius: 4px;
}

/* Inputs & Selects */
.dsh-agy-input {
  box-sizing: border-box;
  width: 100%;
  min-height: 28px;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-bg-layer-2, Canvas);
  color: var(--dsw-alias-label-primary, CanvasText);
  font: inherit;
  font-size: 12px;
  outline: none;
  transition: border-color 0.15s ease;
}
.dsh-agy-input:focus {
  border-color: var(--dsw-alias-button-primary-fill, Highlight);
}
.dsh-agy-select {
  box-sizing: border-box;
  min-height: 26px;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-bg-layer-2, Canvas);
  color: var(--dsw-alias-label-primary, CanvasText);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  outline: none;
}

/* Segmented Control */
.dsh-agy-segmented {
  display: inline-flex;
  align-items: center;
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  border-radius: 6px;
  padding: 2px;
  gap: 2px;
}
.dsh-agy-segmented-btn {
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--dsw-alias-label-secondary, GrayText);
  font: inherit;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}
.dsh-agy-segmented-btn:hover {
  color: var(--dsw-alias-label-primary, CanvasText);
}
.dsh-agy-segmented-btn.is-active {
  background: var(--dsw-alias-button-primary-fill, Highlight);
  color: var(--dsw-alias-label-primary-foreground, HighlightText);
  font-weight: 600;
}

/* Accounts List & Items - Fluid & DPI Responsive */
.dsh-agy-account-list {
  max-height: 480px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-sizing: border-box;
  width: 100%;
  padding-right: 2px;
}
.dsh-agy-account-list.is-compact-mode {
  gap: 4px;
}
.dsh-agy-account {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(128, 128, 128, 0.12));
  background: transparent;
  box-sizing: border-box;
  width: 100%;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.dsh-agy-account:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(128, 128, 128, 0.06));
  border-color: var(--dsw-alias-border-l3, GrayText);
}
.dsh-agy-account.is-active {
  border-color: var(--dsw-alias-button-primary-fill, Highlight);
  background: color-mix(in srgb, var(--dsw-alias-button-primary-fill, Highlight) 7%, transparent);
}
.dsh-agy-account.is-active:hover {
  background: color-mix(in srgb, var(--dsw-alias-button-primary-fill, Highlight) 12%, transparent);
}
.dsh-agy-account.is-compact {
  padding: 4px 10px;
  gap: 4px;
  border-radius: 6px;
}

.dsh-agy-account-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  min-width: 0;
}
.dsh-agy-account-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}
.dsh-agy-account-mail {
  font-size: 13px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary, CanvasText);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-agy-account-action {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
  width: 64px;
  min-width: 64px;
}
.dsh-agy-action-pill {
  box-sizing: border-box;
  padding: 2px 8px;
  min-height: 22px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}
.dsh-agy-action-pill.is-active-badge {
  background: rgba(65, 201, 119, 0.12);
  color: var(--dsw-alias-state-success-primary, CanvasText);
  border: 1px solid rgba(65, 201, 119, 0.25);
  font-weight: 600;
}
.dsh-agy-action-pill.is-remove-btn {
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  color: var(--dsw-alias-label-primary, CanvasText);
  cursor: pointer;
}
.dsh-agy-action-pill.is-remove-btn:hover:not(:disabled) {
  background: var(--dsw-alias-border-l3, GrayText);
  border-color: var(--dsw-alias-border-l3, GrayText);
  color: var(--dsw-alias-label-primary, CanvasText);
}

/* Quota Metrics Row - Fluid & DPI Responsive */
.dsh-agy-account-metrics {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-column: 1 / -1;
  gap: 8px;
  min-width: 0;
}


.dsh-agy-capsule-bar {
  flex: 1 1 0;
  min-width: 0;
  flex-wrap: wrap;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 4px;
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  border: 1px solid var(--dsw-alias-interactive-bg-hover, ButtonFace);
  box-sizing: border-box;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary, GrayText);
  user-select: none;
}
.dsh-agy-capsule-main {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0;
}
.dsh-agy-capsule-progress {
  flex: 1 1 40px;
  min-width: 25px;
  height: 4px;
  border-radius: 2px;
  background: var(--dsw-alias-border-l3, GrayText);
  overflow: hidden;
}
.dsh-agy-capsule-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease;
}
.dsh-agy-capsule-fill.is-high { background: var(--dsw-alias-state-success-primary, CanvasText); }
.dsh-agy-capsule-fill.is-med { background: var(--dsw-alias-state-warn-primary, CanvasText); }
.dsh-agy-capsule-fill.is-low { background: var(--dsw-alias-state-error-primary, CanvasText); }

.dsh-agy-capsule-val {
  font-size: 11px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary, CanvasText);
  flex-shrink: 0;
  white-space: nowrap;
}
.dsh-agy-capsule-reset {
  font-size: 10px;
  line-height: 14px;
  color: var(--dsw-alias-label-secondary, GrayText);
  flex-shrink: 0;
  white-space: nowrap;
}

.dsh-agy-account.is-compact .dsh-agy-capsule-bar {
  background: transparent;
  border: none;
  padding: 0;
  gap: 5px;
}
.dsh-agy-account.is-compact .dsh-agy-capsule-progress {
  height: 4px;
}

/* Radio Cards (Advanced) */
.dsh-agy-radio-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  user-select: none;
}
.dsh-agy-radio-card:hover {
  border-color: var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
}
.dsh-agy-radio-card.is-active {
  border-color: var(--dsw-alias-button-primary-fill, Highlight);
  background: rgba(22, 119, 255, 0.06);
}
.dsh-agy-custom-radio {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.dsh-agy-radio-card.is-active .dsh-agy-custom-radio {
  border-color: var(--dsw-alias-button-primary-fill, Highlight);
}
.dsh-agy-custom-radio-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: transparent;
}
.dsh-agy-radio-card.is-active .dsh-agy-custom-radio-dot {
  background: var(--dsw-alias-button-primary-fill, Highlight);
}

/* Quick Setup & Terminal */
.dsh-agy-code-terminal {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2, Canvas);
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  color: var(--dsw-alias-label-primary, CanvasText);
}
.dsh-agy-chip {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  color: var(--dsw-alias-label-secondary, GrayText);
  transition: all 0.15s ease;
}
.dsh-agy-chip:hover {
  border-color: var(--dsw-alias-button-primary-fill, Highlight);
  color: var(--dsw-alias-label-primary, CanvasText);
}
.dsh-agy-link {
  color: var(--dsw-alias-button-primary-fill, Highlight);
  text-decoration: none;
}
.dsh-agy-link:hover {
  text-decoration: underline;
}
.dsh-agy-segmented-btn { display: inline-flex; align-items: center; gap: 6px; }
.dsh-agy-radio-card, .dsh-agy-segmented { min-width: 0; flex-wrap: wrap; }
.dsh-agy-radio-card:has(input:disabled), .dsh-agy-segmented-btn:has(input:disabled) { cursor: not-allowed; opacity: .6; }
.dsh-agy-choice-label { min-width: 0; overflow-wrap: anywhere; }
.dsh-agy-toolbar-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.dsh-agy-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.dsh-agy-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.dsh-agy-muted, .dsh-agy-choice-description { color: var(--dsw-alias-label-secondary, GrayText); }
.dsh-agy-control-label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
.dsh-agy-choice-label { color: var(--dsw-alias-label-primary, CanvasText); }
.dsh-agy-feedback { color: var(--dsw-alias-state-success-primary, CanvasText); overflow-wrap: anywhere; }
.dsh-agy-feedback.is-error { color: var(--dsw-alias-state-error-primary, CanvasText); }
.dsh-agy-proxy-route { overflow-wrap: anywhere; min-width: 0; }
.dsh-agy-account-mail { font-family: inherit; text-align: left; padding: 3px 0; border: none; background: transparent; cursor: pointer; max-width: 100%; }
.dsh-agy-account-mail:disabled { cursor: default; }
.dsh-agy-account-info { flex-wrap: wrap; }
.dsh-agy-page :is(button, input, select, a):focus-visible { outline: 2px solid var(--dsw-alias-label-primary, Highlight); outline-offset: 2px; }
.dsh-agy-input::placeholder { color: var(--dsw-alias-label-secondary, GrayText); opacity: 1; }
.dsh-agy-page :is(input, select):disabled { opacity: .6; cursor: not-allowed; }
@container agy-settings (min-width: 520px) {
  .dsh-agy-account { grid-template-columns: minmax(0, 1.2fr) minmax(0, 2fr) 64px; gap: 10px; }
  .dsh-agy-account-header { grid-column: 1; grid-row: 1; }
  .dsh-agy-account-metrics { grid-column: 2; grid-row: 1; }
  .dsh-agy-account-action { grid-column: 3; grid-row: 1; justify-self: end; width: 64px; }
}
@container agy-settings (min-width: 640px) {
  .dsh-agy-account { grid-template-columns: minmax(0, 1.2fr) minmax(0, 2fr) 64px; gap: 12px; }
  .dsh-agy-account-header { grid-column: 1; grid-row: 1; }
  .dsh-agy-account-metrics { grid-column: 2; grid-row: 1; }
  .dsh-agy-account-action { grid-column: 3; grid-row: 1; justify-self: end; width: 64px; }
}
@container agy-settings (max-width: 439px) {
  .dsh-agy-account-metrics { grid-template-columns: minmax(0, 1fr); }
}

`

export function ensureThemeStyles(): void {
  if (typeof document === 'undefined') return
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = SETTINGS_CSS
}