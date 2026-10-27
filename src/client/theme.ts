export const STYLE_ID = 'dsh-antigravity-oauth-settings-theme'

export const SETTINGS_CSS = `
.dsh-agy-page { display:flex; flex-direction:column; gap:12px; width:100%; max-width:720px; color:var(--dsw-alias-label-primary, #e0e0e0); font-family:inherit; position:relative; }

/* Top Header */
.dsh-agy-header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
.dsh-agy-title-row { display:flex; align-items:center; gap:10px; }
.dsh-agy-title { margin:0; font-size:18px; line-height:24px; font-weight:600; color:var(--dsw-alias-label-primary, #ffffff); }
.dsh-agy-header-active-badge {
  display:inline-flex; align-items:center; gap:6px; padding:3px 10px; border-radius:12px;
  font-size:12px; font-weight:500; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
  color:#f0f0f0; max-width:320px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
}
.dsh-agy-body { margin:0; font-size:12px; line-height:18px; color:var(--dsw-alias-label-secondary, #9aa0a6); }
.dsh-agy-error { margin:0; font-size:12px; line-height:18px; color:#f25a5a; padding:6px 12px; border-radius:6px; background:rgba(242,90,90,0.12); border:1px solid rgba(242,90,90,0.25); }

/* Floating Top-Right Toast Notification (Zero Layout Shift) */
.dsh-agy-toast-float {
  position:fixed; top:24px; right:24px; z-index:9999;
  display:flex; align-items:center; gap:8px;
  padding:10px 16px; border-radius:8px;
  background:#1a231e; border:1px solid #41c977;
  color:#41c977; font-size:13px; font-weight:500;
  box-shadow:0 8px 24px rgba(0,0,0,0.45);
  animation:dsh-agy-fadein 0.2s ease-out;
}
@keyframes dsh-agy-fadein { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }

/* One-time dismissible notice banner */
.dsh-agy-notice-banner {
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:8px 12px; border-radius:8px;
  background:var(--dsw-alias-bg-module-platform, rgba(128,128,128,0.08));
  border:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.2));
}
.dsh-agy-notice-close {
  background:none; border:none; color:var(--dsw-alias-label-secondary, #9aa0a6); cursor:pointer;
  font-size:16px; line-height:1; padding:2px 6px; border-radius:4px;
}
.dsh-agy-notice-close:hover { color:#ffffff; background:rgba(255,255,255,0.08); }

/* Navigation Tabs */
.dsh-agy-tabs {
  display:grid; grid-template-columns:repeat(4, 1fr); gap:3px; padding:2px;
  background:#1a1c1e !important;
  border:1px solid rgba(255,255,255,0.12) !important;
  border-radius:9px; width:100%; max-width:100%; box-sizing:border-box; margin-bottom:2px;
}
.dsh-agy-tab-btn {
  display:inline-flex; align-items:center; justify-content:center; gap:4px; padding:6px 2px;
  border:none !important; border-radius:7px !important;
  background:transparent !important;
  color:#9a9ea5 !important; font:inherit; font-size:12px; font-weight:500;
  cursor:pointer; transition:all 0.15s ease; user-select:none;
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;
}
.dsh-agy-tab-btn:hover { color:#ffffff !important; background:rgba(255,255,255,0.06) !important; }
.dsh-agy-tab-btn.is-active {
  color:#ffffff !important; background:#1677ff !important;
  box-shadow:0 1px 4px rgba(22, 119, 255, 0.4) !important; font-weight:600 !important;
}

/* Cards */
.dsh-agy-card {
  display:flex; flex-direction:column; gap:10px; padding:12px 14px;
  border:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.2));
  border-radius:10px; background:var(--dsw-alias-bg-module-platform, rgba(128,128,128,0.04));
  box-sizing:border-box; width:100%;
}
.dsh-agy-row { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; }
.dsh-agy-card-title { margin:0; font-size:14px; font-weight:600; color:var(--dsw-alias-label-primary, #ffffff); display:flex; align-items:center; gap:8px; }

/* Status Badges */
.dsh-agy-status-badge {
  display:inline-flex; align-items:center; justify-content:center; gap:4px;
  padding:2px 8px; border-radius:6px; min-width:54px;
  font-size:11px; font-weight:500; background:rgba(128,128,128,0.1); color:var(--dsw-alias-label-secondary, #9aa0a6);
}
.dsh-agy-status-badge.is-success { background:rgba(34,160,107,0.2); color:#41c977; font-weight:600; }
.dsh-agy-status-badge.is-error { background:rgba(217,45,32,0.2); color:#f25a5a; }
.dsh-agy-status-badge.is-switching { background:rgba(250,140,22,0.2); color:#fa8c16; font-weight:600; }
.dsh-agy-dot { width:8px; height:8px; border-radius:50%; flex:0 0 auto; background:#6b7280; }
.dsh-agy-dot.is-signed-in, .dsh-agy-dot.is-active { background:#41c977; }
.dsh-agy-dot.is-error { background:#f25a5a; }
.dsh-agy-dot.is-signing-in { background:#1677ff; }

/* Buttons */
.dsh-agy-btn {
  box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center;
  min-height:28px; padding:3px 12px; border-radius:6px; font:inherit; font-size:12px; line-height:18px;
  cursor:pointer; transition:all 0.15s ease; text-decoration:none;
}
.dsh-agy-btn:disabled { opacity:0.45; cursor:not-allowed; }
.dsh-agy-btn-primary {
  background:#1677ff !important; color:#ffffff !important;
  border:1px solid #1677ff !important; box-shadow:0 1px 2px rgba(0,0,0,0.15); font-weight:500;
}
.dsh-agy-btn-primary:hover:not(:disabled) { background:#0958d9 !important; border-color:#0958d9 !important; }
.dsh-agy-btn-secondary {
  border:1px solid rgba(255,255,255,0.15) !important;
  background:#2b2d30 !important; color:#f0f0f0 !important;
}
.dsh-agy-btn-secondary:hover:not(:disabled) {
  background:#3c3f41 !important; border-color:#1677ff !important; color:#ffffff !important;
}
.dsh-agy-btn-compact { min-height:22px; padding:1px 8px; font-size:11px; border-radius:4px; min-width:54px; }

/* Inputs */
.dsh-agy-input {
  box-sizing:border-box; width:100%; min-height:30px; padding:4px 8px; border-radius:6px;
  border:1px solid rgba(255,255,255,0.15);
  background:var(--dsw-alias-bg-page-primary, #1e1e1e); color:#f0f0f0;
  font:inherit; font-size:12px; outline:none; transition:border-color 0.15s ease;
}
.dsh-agy-input:focus { border-color:#1677ff; }
.dsh-agy-select {
  box-sizing:border-box; min-height:26px; padding:2px 6px; border-radius:6px;
  border:1px solid rgba(255,255,255,0.15);
  background:var(--dsw-alias-bg-page-primary, #1e1e1e); color:#f0f0f0;
  font:inherit; font-size:11px; cursor:pointer; outline:none;
}

/* Filter Chips */
.dsh-agy-chips { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
.dsh-agy-chip {
  padding:2px 8px; border-radius:10px; font-size:11px; cursor:pointer;
  border:1px solid rgba(255,255,255,0.12);
  background:rgba(255,255,255,0.05); color:#9a9ea5;
  transition:all 0.15s ease;
}
.dsh-agy-chip:hover { border-color:#1677ff; color:#ffffff; }
.dsh-agy-chip.is-active {
  border-color:#1677ff; background:rgba(22, 119, 255, 0.18); color:#1677ff; font-weight:600;
}

/* Accounts List & Items */
.dsh-agy-account-list {
  max-height:480px; overflow-y:scroll; padding-right:4px; display:flex; flex-direction:column; gap:5px;
  box-sizing:border-box; width:100%;
}
.dsh-agy-account-list.is-compact-mode {
  gap:3px;
}
.dsh-agy-account {
  display:flex !important; flex-direction:column !important; align-items:stretch !important; gap:7px !important;
  padding:9px 12px !important; border-radius:10px !important;
  border:1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.2)) !important;
  background:var(--dsw-alias-bg-module-platform, rgba(128,128,128,0.03)) !important;
  box-sizing:border-box !important; width:100% !important; cursor:pointer !important;
  transition:background 0.15s ease, border-color 0.15s ease !important;
}
.dsh-agy-account:hover {
  background:rgba(255,255,255,0.05) !important; border-color:rgba(255,255,255,0.2) !important;
}
.dsh-agy-account.is-active {
  border-color:#1677ff !important; background:rgba(22, 119, 255, 0.08) !important;
}
.dsh-agy-account.is-compact {
  padding:5px 10px !important; gap:4px !important;
}

.dsh-agy-account-header {
  display:flex !important; align-items:center !important; justify-content:space-between !important;
  gap:10px !important; width:100% !important; box-sizing:border-box !important;
}
.dsh-agy-account-info {
  display:flex !important; align-items:center !important; gap:8px !important;
  flex:1 1 auto !important; min-width:0 !important; overflow:hidden !important;
}
.dsh-agy-account-mail {
  font-size:13px !important; font-weight:600 !important; color:#ffffff !important;
  overflow:hidden !important; text-overflow:ellipsis !important; white-space:nowrap !important;
}
.dsh-agy-account.is-compact .dsh-agy-account-mail {
  font-size:12px !important;
}
.dsh-agy-link { color:#1677ff; text-decoration:none; }
.dsh-agy-link:hover { text-decoration:underline; }

.dsh-agy-account-metrics {
  display:flex !important; align-items:center !important; gap:8px !important;
  width:100% !important; box-sizing:border-box !important;
}

/* Quota Capsule Bars */
.dsh-agy-capsule-bar {
  flex:1 1 0 !important; min-width:0 !important; box-sizing:border-box !important;
  display:inline-flex !important; flex-direction:column !important; justify-content:center !important;
  gap:2px !important; font-size:11px !important; padding:4px 8px !important; border-radius:6px !important;
  background:rgba(128,128,128,0.08) !important; border:1px solid rgba(255,255,255,0.06) !important;
  color:#9aa0a6 !important; cursor:help !important; user-select:none !important;
}
.dsh-agy-capsule-main {
  display:flex !important; align-items:center !important; justify-content:space-between !important;
  width:100% !important; gap:6px !important;
}
.dsh-agy-capsule-progress {
  flex:1 1 30px !important; max-width:85px !important; min-width:25px !important;
  height:6px !important; border-radius:3px !important; background:rgba(128,128,128,0.25) !important; overflow:hidden !important;
}
.dsh-agy-capsule-reset {
  font-size:10px !important; line-height:12px !important; color:#8c9199 !important; white-space:nowrap !important; font-weight:500 !important;
}
.dsh-agy-account.is-compact .dsh-agy-capsule-bar {
  flex-direction:row !important; align-items:center !important; justify-content:space-between !important;
  padding:2px 8px !important; height:22px !important;
}
.dsh-agy-account.is-compact .dsh-agy-capsule-reset {
  display:none !important;
}
.dsh-agy-capsule-fill { height:100%; border-radius:3px; transition:width 0.3s ease; }
.dsh-agy-capsule-fill.is-high { background:#41c977; }
.dsh-agy-capsule-fill.is-med { background:#fa8c16; }
.dsh-agy-capsule-fill.is-low { background:#f25a5a; }

/* Rightmost Action Cell: Aligns Active badge and Remove button */
.dsh-agy-account-action {
  width:64px; display:flex; align-items:center; justify-content:flex-end; flex-shrink:0;
}
.dsh-agy-action-pill {
  box-sizing:border-box !important; width:58px !important; height:22px !important;
  min-height:22px !important; max-height:22px !important; padding:0 !important;
  font-size:11px !important; font-weight:500 !important; line-height:20px !important;
  border-radius:5px !important; display:inline-flex !important; align-items:center !important;
  justify-content:center !important; text-align:center !important; user-select:none;
}
.dsh-agy-action-pill.is-active-badge {
  background:rgba(34,160,107,0.2) !important; color:#41c977 !important;
  border:1px solid rgba(34,160,107,0.4) !important; font-weight:600 !important;
}
.dsh-agy-action-pill.is-remove-btn {
  border:1px solid rgba(255,255,255,0.15) !important; background:#2b2d30 !important;
  color:#f0f0f0 !important; cursor:pointer !important;
}
.dsh-agy-action-pill.is-remove-btn:hover:not(:disabled) {
  background:#3c3f41 !important; border-color:#1677ff !important; color:#ffffff !important;
}

/* Quick Setup Card (Plan C) */
.dsh-agy-guide-card {
  display:flex; flex-direction:column; gap:12px; padding:16px 18px;
  border-radius:12px;
  background:linear-gradient(145deg, #1e222b 0%, #171920 100%);
  border:1px solid rgba(22, 119, 255, 0.25);
  box-shadow:0 4px 12px rgba(0,0,0,0.2);
}
.dsh-agy-guide-header {
  display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;
}
.dsh-agy-step {
  display:flex; gap:12px; align-items:flex-start; margin-top:2px;
}
.dsh-agy-step-num {
  width:22px; height:22px; border-radius:50%; background:#1677ff; color:#fff;
  display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700;
  flex:0 0 22px; margin-top:1px;
}
.dsh-agy-step-content {
  display:flex; flex-direction:column; gap:6px; flex:1; min-width:0;
}
.dsh-agy-code-terminal {
  display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 12px;
  border-radius:8px; background:#0e1013; border:1px solid rgba(255,255,255,0.08);
  font-family:ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size:12px; color:#58a6ff;
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
