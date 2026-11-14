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

/* Tabs: as many columns as fit, so adding a tab never breaks the row. */
.dsh-agy-tabs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(78px, 1fr));
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
  gap: 6px;
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

/* The account panel owns the breakpoint, not the viewport or its scroller. */
.dsh-agy-account-panel {
  container-type: inline-size;
  container-name: agy-accounts;
  width: 100%;
  min-width: 0;
}
.dsh-agy-account-list {
  max-height: 480px;
  overflow-y: auto;
  scrollbar-gutter: stable;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}
.dsh-agy-account {
  --quota-track-gap: 4px;
  --quota-cell-gap: 12px;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 8px;
  background: transparent;
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
}
.dsh-agy-account + .dsh-agy-account {
  border-top: 2px solid var(--dsw-alias-border-l3, GrayText);
}
.dsh-agy-account.is-compact {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content 28px;
  align-items: center;
  padding: 6px 12px;
  gap: 8px;
  white-space: nowrap;
}
.dsh-agy-account-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 28px;
  gap: 8px;
  align-items: start;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.dsh-agy-account-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-width: 0;
}
.dsh-agy-account-mail {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: inherit;
  font-size: 13px;
  line-height: 20px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary, CanvasText);
  text-align: left;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  min-width: 0;
  max-width: 100%;
}
.dsh-agy-account-mail:disabled { cursor: default; }
.dsh-agy-account-email-text {
  min-width: 0;
  white-space: normal;
  overflow-wrap: anywhere;
}
.dsh-agy-account-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  min-width: 16px;
  height: 16px;
  color: var(--dsw-alias-button-primary-fill, Highlight);
  flex-shrink: 0;
}
.dsh-agy-account-check.is-placeholder { visibility: hidden; }
.dsh-agy-account-action {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 28px;
  min-width: 28px;
  height: 28px;
  flex-shrink: 0;
}
.dsh-agy-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 4px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary, GrayText);
  cursor: pointer;
  box-sizing: border-box;
}
.dsh-agy-btn-icon.is-remove-btn:is(:hover, :focus-visible):not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  color: var(--dsw-alias-state-error-primary, CanvasText);
  border-color: var(--dsw-alias-state-error-primary, CanvasText);
}
.dsh-agy-btn-icon:disabled { opacity: 0.5; cursor: not-allowed; }
.dsh-agy-remove-control {
  position: relative;
  display: inline-flex;
  width: 28px;
  height: 28px;
}
.dsh-agy-remove-tooltip {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 2;
  width: max-content;
  max-width: 200px;
  padding-top: 4px;
  cursor: default;
  pointer-events: auto;
  visibility: hidden;
}
.dsh-agy-remove-tooltip.is-visible { visibility: visible; }
.dsh-agy-remove-tooltip-text {
  display: block;
  padding: 4px 8px;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  border-radius: 4px;
  background: var(--dsw-alias-bg-layer-2, Canvas);
  color: var(--dsw-alias-label-primary, CanvasText);
  font-size: 11px;
  line-height: 14px;
  font-weight: 400;
  white-space: normal;
  overflow-wrap: anywhere;
}
.dsh-agy-account-quota-state {
  font-size: 11px;
  line-height: 14px;
  color: var(--dsw-alias-label-secondary, GrayText);
  overflow-wrap: anywhere;
}
/* Columns contribute to shared label, track, and reset rows. */
.dsh-agy-account-metrics {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto 4px auto auto 4px auto;
  row-gap: var(--quota-track-gap);
  column-gap: 16px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.dsh-agy-quota-col {
  display: contents;
  --quota-column: 1;
  --quota-label-row: 1;
  --quota-track-row: 2;
  --quota-reset-row: 3;
}
.dsh-agy-quota-col:nth-child(2) {
  --quota-label-row: 4;
  --quota-track-row: 5;
  --quota-reset-row: 6;
}
.dsh-agy-quota-row-label {
  grid-column: var(--quota-column);
  grid-row: var(--quota-label-row);
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.dsh-agy-quota-col:nth-child(2) .dsh-agy-quota-row-label {
  margin-top: calc(var(--quota-cell-gap) - var(--quota-track-gap));
}
.dsh-agy-quota-period {
  min-width: 0;
  font-size: 12px;
  line-height: 16px;
  font-weight: 400;
  color: var(--dsw-alias-label-primary, CanvasText);
  overflow-wrap: anywhere;
}
.dsh-agy-quota-pct {
  font-size: 12px;
  line-height: 16px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary, CanvasText);
  white-space: nowrap;
}
.dsh-agy-quota-track {
  grid-column: var(--quota-column);
  grid-row: var(--quota-track-row);
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: var(--dsw-alias-border-l3, GrayText);
  overflow: hidden;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: none;
}
.dsh-agy-capsule-fill { height: 100%; border-radius: 2px; transition: width 0.3s ease; }
.dsh-agy-capsule-fill.is-high { background: var(--dsw-alias-state-success-primary, CanvasText); }
.dsh-agy-capsule-fill.is-med { background: var(--dsw-alias-state-warn-primary, CanvasText); }
.dsh-agy-capsule-fill.is-low { background: var(--dsw-alias-state-error-primary, CanvasText); }
.dsh-agy-quota-reset {
  grid-column: var(--quota-column);
  grid-row: var(--quota-reset-row);
  min-width: 0;
  min-height: 14px;
  font-size: 11px;
  line-height: 14px;
  color: var(--dsw-alias-label-secondary, GrayText);
  white-space: normal;
  overflow-wrap: anywhere;
}
@container agy-accounts (min-width: 440px) {
  .dsh-agy-account-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: auto 4px auto;
  }
  .dsh-agy-quota-col:nth-child(2) {
    --quota-column: 2;
    --quota-label-row: 1;
    --quota-track-row: 2;
    --quota-reset-row: 3;
  }
  .dsh-agy-quota-col:nth-child(2) .dsh-agy-quota-row-label { margin-top: 0; }
}

/* Compact rows reserve quota and action space. Only the identity can shrink. */
.dsh-agy-account.is-compact .dsh-agy-account-header { display: contents; }
.dsh-agy-account.is-compact .dsh-agy-account-info {
  grid-column: 1;
  grid-row: 1;
  flex-wrap: nowrap;
  gap: 4px;
}
.dsh-agy-account.is-compact .dsh-agy-account-mail { flex: 1; }
.dsh-agy-account.is-compact .dsh-agy-account-email-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow-wrap: normal;
}
.dsh-agy-account.is-compact .dsh-agy-status-badge {
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  padding: 0;
}
.dsh-agy-account.is-compact .dsh-agy-account-action { grid-column: 3; grid-row: 1; }
.dsh-agy-account.is-compact .dsh-agy-account-metrics {
  grid-column: 2;
  grid-row: 1;
  grid-template-columns: repeat(2, max-content);
  grid-template-rows: auto;
  column-gap: 12px;
  row-gap: 0;
  width: auto;
}
.dsh-agy-account.is-compact .dsh-agy-quota-col { display: block; }
.dsh-agy-account.is-compact .dsh-agy-quota-row-label {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  white-space: nowrap;
}
.dsh-agy-account.is-compact .dsh-agy-quota-col:nth-child(2) .dsh-agy-quota-row-label { margin-top: 0; }
.dsh-agy-account.is-compact .dsh-agy-quota-track,
.dsh-agy-account.is-compact .dsh-agy-quota-reset,
.dsh-agy-account.is-compact .dsh-agy-account-quota-state { display: none; }

/* Reserve three tabular digits plus one em for '%' in both compact layouts. */
.dsh-agy-account.is-compact .dsh-agy-quota-pct { min-width: calc(3ch + 1em); text-align: right; }
.dsh-agy-account.is-compact .dsh-agy-quota-pct.is-high { color: var(--dsw-alias-state-success-primary, CanvasText); }
.dsh-agy-account.is-compact .dsh-agy-quota-pct.is-med { color: var(--dsw-alias-state-warn-primary, CanvasText); }
.dsh-agy-account.is-compact .dsh-agy-quota-pct.is-low { color: var(--dsw-alias-state-error-primary, CanvasText); }
.dsh-agy-account.is-compact .dsh-agy-quota-pct.is-unknown { color: var(--dsw-alias-label-secondary, GrayText); }

/* Compact rows share the list's columns, so 5h and 7d line up whatever their values. */
@supports (grid-template-columns: subgrid) {
  .dsh-agy-account-list.is-compact-mode {
    display: grid;
    grid-template-columns: minmax(0, 1fr) max-content max-content max-content;
    column-gap: 12px;
    align-content: start;
  }
  .dsh-agy-account-list.is-compact-mode > * { grid-column: 1 / -1; }
  .dsh-agy-account-list.is-compact-mode > .dsh-agy-account.is-compact {
    grid-template-columns: subgrid;
    column-gap: 12px;
  }
  .dsh-agy-account-list.is-compact-mode .dsh-agy-account-metrics { display: contents; }
  .dsh-agy-account-list.is-compact-mode .dsh-agy-quota-col:nth-child(1) { grid-column: 2; grid-row: 1; }
  .dsh-agy-account-list.is-compact-mode .dsh-agy-quota-col:nth-child(2) { grid-column: 3; grid-row: 1; }
  .dsh-agy-account-list.is-compact-mode .dsh-agy-quota-row-label { justify-content: space-between; }
  .dsh-agy-account-list.is-compact-mode .dsh-agy-account-action { grid-column: 4; }
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
.dsh-agy-link-btn { padding: 0; border: 0; background: none; font: inherit; font-size: inherit; cursor: pointer; }
.dsh-agy-link-btn:disabled { opacity: .5; cursor: not-allowed; }
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
.dsh-agy-page :is(button, input, select, a):focus-visible { outline: 2px solid var(--dsw-alias-label-primary, Highlight); outline-offset: 2px; }
.dsh-agy-input::placeholder { color: var(--dsw-alias-label-secondary, GrayText); opacity: 1; }
.dsh-agy-page :is(input, select):disabled { opacity: .6; cursor: not-allowed; }

/* ---- Shared layout primitives (every tab uses these instead of inline styles) ---- */
.dsh-agy-stack { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.dsh-agy-stack.is-tight { gap: 6px; }
.dsh-agy-fieldset { border: 0; padding: 0; margin: 0; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.dsh-agy-fieldset > legend { padding: 0; margin-bottom: 6px; }

/* Card header: title and one-line description on the left, a trailing control on the right. */
.dsh-agy-section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}
.dsh-agy-section-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dsh-agy-section-title {
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  font-weight: 600;
  color: var(--dsw-alias-label-primary, CanvasText);
}
.dsh-agy-section-desc {
  margin: 0;
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary, GrayText);
  overflow-wrap: anywhere;
}
.dsh-agy-divider { height: 1px; border: 0; margin: 0; background: var(--dsw-alias-border-l3, GrayText); opacity: .7; }

/* Two fields side by side once the page is wide enough. */
.dsh-agy-field-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; min-width: 0; }
@container agy-settings (min-width: 460px) {
  .dsh-agy-field-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.dsh-agy-input-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.dsh-agy-input-row > .dsh-agy-input { flex: 1 1 auto; min-width: 0; }
.dsh-agy-input-row > .dsh-agy-btn { flex: 0 0 auto; }
.dsh-agy-mono, .dsh-agy-input.dsh-agy-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
}
.dsh-agy-hint { margin: 0; font-size: 11px; line-height: 16px; color: var(--dsw-alias-label-secondary, GrayText); }

/* Toggle switch: a native checkbox restyled, so labels, forms and keyboard keep working. */
.dsh-agy-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-primary, CanvasText);
  cursor: pointer;
  user-select: none;
  min-width: 0;
}
.dsh-agy-switch input {
  appearance: none;
  -webkit-appearance: none;
  position: relative;
  flex: 0 0 auto;
  width: 30px;
  height: 18px;
  margin: 0;
  border-radius: 9px;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.dsh-agy-switch input::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--dsw-alias-label-secondary, GrayText);
  transition: transform 0.15s ease, background 0.15s ease;
}
.dsh-agy-switch input:checked {
  background: var(--dsw-alias-button-primary-fill, Highlight);
  border-color: var(--dsw-alias-button-primary-fill, Highlight);
}
.dsh-agy-switch input:checked::after {
  transform: translateX(12px);
  background: var(--dsw-alias-label-primary-foreground, HighlightText);
}
.dsh-agy-switch:has(input:disabled) { cursor: not-allowed; opacity: .6; }

/* Status strip: one line that says what is running, where, and how healthy. */
.dsh-agy-status-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-width: 0;
}
.dsh-agy-status-main { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dsh-agy-status-label { font-size: 13px; line-height: 18px; font-weight: 600; color: var(--dsw-alias-label-primary, CanvasText); }
.dsh-agy-status-meta { font-size: 11px; color: var(--dsw-alias-label-secondary, GrayText); overflow-wrap: anywhere; }
.dsh-agy-dot.is-warn { background: var(--dsw-alias-state-warn-primary, CanvasText); }
.dsh-agy-dot.is-pulse { animation: dsh-agy-pulse 1.2s ease-in-out infinite; }
@keyframes dsh-agy-pulse { 50% { opacity: .35; } }

/* Health tiles: small independent checks shown side by side. */
.dsh-agy-health {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 6px;
}
.dsh-agy-health-tile {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  min-width: 0;
}
.dsh-agy-health-name { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--dsw-alias-label-primary, CanvasText); }
.dsh-agy-health-detail { font-size: 11px; color: var(--dsw-alias-label-secondary, GrayText); overflow-wrap: anywhere; }

/* Pills: compact facts such as latency or a model count. */
.dsh-agy-pills { display: flex; flex-wrap: wrap; gap: 4px; }
.dsh-agy-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  font-size: 11px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary, GrayText);
  white-space: nowrap;
}
.dsh-agy-pill.is-success { color: var(--dsw-alias-state-success-primary, CanvasText); border-color: rgba(65, 201, 119, 0.4); }
.dsh-agy-pill.is-warn { color: var(--dsw-alias-state-warn-primary, CanvasText); border-color: rgba(250, 140, 22, 0.4); }
.dsh-agy-pill.is-error { color: var(--dsw-alias-state-error-primary, CanvasText); border-color: rgba(242, 90, 90, 0.4); }

/* Callout: one explanatory paragraph that should not look like an error. */
.dsh-agy-callout {
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  border-left: 3px solid var(--dsw-alias-button-primary-fill, Highlight);
  background: var(--dsw-alias-interactive-bg-hover, ButtonFace);
  font-size: 11px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary, GrayText);
}
.dsh-agy-callout.is-warn { border-left-color: var(--dsw-alias-state-warn-primary, CanvasText); }

/* Code block for copyable snippets. */
.dsh-agy-pre {
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  background: var(--dsw-alias-bg-layer-2, Canvas);
  color: var(--dsw-alias-label-primary, CanvasText);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 11px;
  line-height: 16px;
  overflow-x: auto;
  white-space: pre;
}
.dsh-agy-code-terminal > code { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Selectable rows (model list): the account list's divider rhythm with a leading checkbox. */
.dsh-agy-option-list {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--dsw-alias-border-l3, GrayText);
  border-radius: 6px;
  overflow: hidden;
}
.dsh-agy-option {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) max-content;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  cursor: pointer;
  transition: background 0.15s ease;
  min-width: 0;
}
.dsh-agy-option + .dsh-agy-option { border-top: 1px solid var(--dsw-alias-border-l3, GrayText); }
.dsh-agy-option:hover { background: var(--dsw-alias-interactive-bg-hover, ButtonFace); }
.dsh-agy-option.is-active { background: rgba(22, 119, 255, 0.06); }
.dsh-agy-option input { margin: 0; accent-color: var(--dsw-alias-button-primary-fill, Highlight); cursor: pointer; }
.dsh-agy-option-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.dsh-agy-option-name { font-size: 12px; line-height: 18px; font-weight: 500; color: var(--dsw-alias-label-primary, CanvasText); overflow-wrap: anywhere; }
.dsh-agy-option-meta {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px;
  line-height: 14px;
  color: var(--dsw-alias-label-secondary, GrayText);
  overflow-wrap: anywhere;
}
.dsh-agy-option:has(input:disabled) { cursor: not-allowed; opacity: .6; }
.dsh-agy-radio-card input[type="radio"] { margin: 0; accent-color: var(--dsw-alias-button-primary-fill, Highlight); }
.dsh-agy-segmented-btn input[type="radio"] { position: absolute; opacity: 0; width: 1px; height: 1px; pointer-events: none; }
.dsh-agy-segmented-btn { position: relative; }
.dsh-agy-segmented-btn:has(input:focus-visible) { outline: 2px solid var(--dsw-alias-label-primary, Highlight); outline-offset: 1px; }
.dsh-agy-radio-card > .dsh-agy-pill { margin-left: auto; }
.dsh-agy-range { width: 100%; accent-color: var(--dsw-alias-button-primary-fill, Highlight); }

/* Summary bar above the account list. */
.dsh-agy-summary { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.dsh-agy-summary-main { display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }

@media (prefers-reduced-motion: reduce) {
  .dsh-agy-page *, .dsh-agy-toast-float { animation: none !important; transition: none !important; }
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