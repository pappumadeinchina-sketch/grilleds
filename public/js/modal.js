/**
 * GrilledS Custom In-Website Dialog System
 * Replaces ugly browser alerts, confirms, and prompts with modern glassmorphism dialogs.
 */
(function(window) {
  'use strict';

  // Inject styles if not already injected
  function ensureStyles() {
    if (document.getElementById('grilleds-dialog-styles')) return;
    const style = document.createElement('style');
    style.id = 'grilleds-dialog-styles';
    style.textContent = `
      .grilleds-dialog-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.72);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        animation: grDialogFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes grDialogFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      .grilleds-dialog-card {
        background: rgba(24, 24, 27, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 20px;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(249, 115, 22, 0.2);
        width: 100%;
        max-width: 440px;
        overflow: hidden;
        animation: grDialogPop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
        display: flex;
        flex-direction: column;
        color: #f4f4f5;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      @keyframes grDialogPop {
        from { opacity: 0; transform: scale(0.9) translateY(12px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      .grilleds-dialog-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 18px 20px 12px;
      }
      .grilleds-dialog-icon {
        width: 38px;
        height: 38px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }
      .grilleds-dialog-icon.info {
        background: rgba(59, 130, 246, 0.18);
        color: #60a5fa;
        border: 1px solid rgba(59, 130, 246, 0.3);
      }
      .grilleds-dialog-icon.success {
        background: rgba(16, 185, 129, 0.18);
        color: #34d399;
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
      .grilleds-dialog-icon.warning {
        background: rgba(245, 158, 11, 0.18);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.3);
      }
      .grilleds-dialog-icon.danger {
        background: rgba(239, 68, 68, 0.18);
        color: #f87171;
        border: 1px solid rgba(239, 68, 68, 0.3);
      }
      .grilleds-dialog-icon.prompt {
        background: rgba(249, 115, 22, 0.18);
        color: #fb923c;
        border: 1px solid rgba(249, 115, 22, 0.3);
      }
      .grilleds-dialog-title {
        font-size: 16px;
        font-weight: 700;
        color: #ffffff;
        margin: 0;
        flex: 1;
        letter-spacing: -0.2px;
      }
      .grilleds-dialog-close {
        background: transparent;
        border: none;
        color: #a1a1aa;
        font-size: 18px;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s;
      }
      .grilleds-dialog-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }
      .grilleds-dialog-body {
        padding: 4px 20px 18px;
        font-size: 14px;
        line-height: 1.55;
        color: #d4d4d8;
        word-break: break-word;
      }
      .grilleds-dialog-input-wrapper {
        margin-top: 14px;
      }
      .grilleds-dialog-input {
        width: 100%;
        padding: 10px 14px;
        background: rgba(9, 9, 11, 0.8);
        border: 1.5px solid rgba(255, 255, 255, 0.16);
        border-radius: 12px;
        color: #ffffff;
        font-size: 14px;
        outline: none;
        box-sizing: border-box;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .grilleds-dialog-input:focus {
        border-color: #f97316;
        box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.25);
      }
      .grilleds-dialog-footer {
        padding: 12px 20px 18px;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        background: rgba(18, 18, 20, 0.5);
        border-top: 1px solid rgba(255, 255, 255, 0.06);
      }
      .grilleds-dialog-btn {
        padding: 9px 18px;
        border-radius: 10px;
        font-size: 13.5px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.15s ease;
      }
      .grilleds-dialog-btn.cancel {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #e4e4e7;
      }
      .grilleds-dialog-btn.cancel:hover {
        background: rgba(255, 255, 255, 0.14);
        color: #ffffff;
      }
      .grilleds-dialog-btn.primary {
        background: linear-gradient(135deg, #f97316, #ef4444);
        color: #ffffff;
        box-shadow: 0 4px 14px rgba(249, 115, 22, 0.35);
      }
      .grilleds-dialog-btn.primary:hover {
        opacity: 0.93;
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(249, 115, 22, 0.45);
      }
      .grilleds-dialog-btn.danger {
        background: linear-gradient(135deg, #ef4444, #dc2626);
        color: #ffffff;
        box-shadow: 0 4px 14px rgba(239, 68, 68, 0.35);
      }
      .grilleds-dialog-btn.danger:hover {
        opacity: 0.93;
        transform: translateY(-1px);
      }

      /* In-Website Toast Notifications */
      .grilleds-toast-container {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 100001;
        display: flex;
        flex-direction: column;
        gap: 10px;
        pointer-events: none;
      }
      .grilleds-toast {
        pointer-events: auto;
        min-width: 280px;
        max-width: 400px;
        background: rgba(24, 24, 27, 0.95);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 14px;
        padding: 12px 16px;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(249, 115, 22, 0.2);
        display: flex;
        align-items: center;
        gap: 12px;
        color: #ffffff;
        font-size: 13.5px;
        font-weight: 500;
        animation: grToastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        transition: all 0.25s ease;
      }
      .grilleds-toast.closing {
        opacity: 0;
        transform: translateY(-12px) scale(0.95);
      }
      @keyframes grToastSlideIn {
        from { opacity: 0; transform: translateY(-16px) scale(0.9); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .grilleds-toast i {
        font-size: 16px;
      }
      .grilleds-toast.success i { color: #10b981; }
      .grilleds-toast.error i { color: #ef4444; }
      .grilleds-toast.info i { color: #3b82f6; }
      .grilleds-toast.warning i { color: #f59e0b; }
    `;
    document.head.appendChild(style);
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str || '');
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }

  const GrilledSModal = {
    /**
     * Show custom in-website alert modal
     */
    alert(message, title = 'Notice', type = 'info') {
      ensureStyles();
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'grilleds-dialog-overlay';

        const iconClass = type === 'danger' ? 'danger' : (type === 'success' ? 'success' : (type === 'warning' ? 'warning' : 'info'));
        const iconFa = type === 'danger' ? 'fa-triangle-exclamation' : (type === 'success' ? 'fa-circle-check' : (type === 'warning' ? 'fa-bell' : 'fa-circle-info'));

        overlay.innerHTML = `
          <div class="grilleds-dialog-card" role="dialog" aria-modal="true">
            <div class="grilleds-dialog-header">
              <div class="grilleds-dialog-icon ${iconClass}">
                <i class="fa-solid ${iconFa}"></i>
              </div>
              <h3 class="grilleds-dialog-title">${escapeHtml(title)}</h3>
              <button class="grilleds-dialog-close" title="Close">&times;</button>
            </div>
            <div class="grilleds-dialog-body">
              ${escapeHtml(message)}
            </div>
            <div class="grilleds-dialog-footer">
              <button class="grilleds-dialog-btn primary gr-btn-ok">Got It</button>
            </div>
          </div>
        `;

        document.body.appendChild(overlay);

        const okBtn = overlay.querySelector('.gr-btn-ok');
        const closeBtn = overlay.querySelector('.grilleds-dialog-close');

        const cleanup = () => {
          window.removeEventListener('keydown', onKeyDown);
          overlay.remove();
          resolve();
        };

        const onKeyDown = (e) => {
          if (e.key === 'Escape' || e.key === 'Enter') {
            e.preventDefault();
            cleanup();
          }
        };

        okBtn.onclick = cleanup;
        closeBtn.onclick = cleanup;
        overlay.onclick = (e) => {
          if (e.target === overlay) cleanup();
        };

        window.addEventListener('keydown', onKeyDown);
        setTimeout(() => okBtn.focus(), 50);
      });
    },

    /**
     * Show custom in-website confirmation modal
     */
    confirm(message, title = 'Please Confirm', { confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
      ensureStyles();
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'grilleds-dialog-overlay';

        const iconClass = danger ? 'danger' : 'warning';
        const iconFa = danger ? 'fa-triangle-exclamation' : 'fa-circle-question';

        overlay.innerHTML = `
          <div class="grilleds-dialog-card" role="dialog" aria-modal="true">
            <div class="grilleds-dialog-header">
              <div class="grilleds-dialog-icon ${iconClass}">
                <i class="fa-solid ${iconFa}"></i>
              </div>
              <h3 class="grilleds-dialog-title">${escapeHtml(title)}</h3>
              <button class="grilleds-dialog-close" title="Cancel">&times;</button>
            </div>
            <div class="grilleds-dialog-body">
              ${escapeHtml(message)}
            </div>
            <div class="grilleds-dialog-footer">
              <button class="grilleds-dialog-btn cancel gr-btn-cancel">${escapeHtml(cancelText)}</button>
              <button class="grilleds-dialog-btn ${danger ? 'danger' : 'primary'} gr-btn-confirm">${escapeHtml(confirmText)}</button>
            </div>
          </div>
        `;

        document.body.appendChild(overlay);

        const confirmBtn = overlay.querySelector('.gr-btn-confirm');
        const cancelBtn = overlay.querySelector('.gr-btn-cancel');
        const closeBtn = overlay.querySelector('.grilleds-dialog-close');

        const finish = (result) => {
          window.removeEventListener('keydown', onKeyDown);
          overlay.remove();
          resolve(result);
        };

        const onKeyDown = (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            finish(false);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            finish(true);
          }
        };

        confirmBtn.onclick = () => finish(true);
        cancelBtn.onclick = () => finish(false);
        closeBtn.onclick = () => finish(false);
        overlay.onclick = (e) => {
          if (e.target === overlay) finish(false);
        };

        window.addEventListener('keydown', onKeyDown);
        setTimeout(() => confirmBtn.focus(), 50);
      });
    },

    /**
     * Show custom in-website prompt modal
     */
    prompt(message, defaultValue = '', title = 'Input Required', { placeholder = '', confirmText = 'Save', cancelText = 'Cancel' } = {}) {
      ensureStyles();
      return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'grilleds-dialog-overlay';

        overlay.innerHTML = `
          <div class="grilleds-dialog-card" role="dialog" aria-modal="true">
            <div class="grilleds-dialog-header">
              <div class="grilleds-dialog-icon prompt">
                <i class="fa-solid fa-pen-to-square"></i>
              </div>
              <h3 class="grilleds-dialog-title">${escapeHtml(title)}</h3>
              <button class="grilleds-dialog-close" title="Cancel">&times;</button>
            </div>
            <div class="grilleds-dialog-body">
              <div>${escapeHtml(message)}</div>
              <div class="grilleds-dialog-input-wrapper">
                <input type="text" class="grilleds-dialog-input" value="${escapeHtml(defaultValue)}" placeholder="${escapeHtml(placeholder)}">
              </div>
            </div>
            <div class="grilleds-dialog-footer">
              <button class="grilleds-dialog-btn cancel gr-btn-cancel">${escapeHtml(cancelText)}</button>
              <button class="grilleds-dialog-btn primary gr-btn-confirm">${escapeHtml(confirmText)}</button>
            </div>
          </div>
        `;

        document.body.appendChild(overlay);

        const input = overlay.querySelector('.grilleds-dialog-input');
        const confirmBtn = overlay.querySelector('.gr-btn-confirm');
        const cancelBtn = overlay.querySelector('.gr-btn-cancel');
        const closeBtn = overlay.querySelector('.grilleds-dialog-close');

        const finish = (result) => {
          window.removeEventListener('keydown', onKeyDown);
          overlay.remove();
          resolve(result);
        };

        const onKeyDown = (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            finish(null);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            finish(input.value);
          }
        };

        confirmBtn.onclick = () => finish(input.value);
        cancelBtn.onclick = () => finish(null);
        closeBtn.onclick = () => finish(null);
        overlay.onclick = (e) => {
          if (e.target === overlay) finish(null);
        };

        window.addEventListener('keydown', onKeyDown);
        setTimeout(() => {
          input.focus();
          input.select();
        }, 60);
      });
    },

    /**
     * Show sleek in-website toast notification
     */
    toast(message, type = 'info', duration = 3000) {
      ensureStyles();
      let container = document.getElementById('grilleds-toast-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'grilleds-toast-container';
        container.className = 'grilleds-toast-container';
        document.body.appendChild(container);
      }

      const toast = document.createElement('div');
      toast.className = `grilleds-toast ${type}`;

      const iconFa = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-xmark' : (type === 'warning' ? 'fa-triangle-exclamation' : 'fa-bell'));

      toast.innerHTML = `
        <i class="fa-solid ${iconFa}"></i>
        <span>${escapeHtml(message)}</span>
      `;

      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('closing');
        setTimeout(() => toast.remove(), 260);
      }, duration);
    }
  };

  // Replace default browser dialogs with our website dialogs!
  window.alert = function(msg) {
    GrilledSModal.alert(String(msg || ''));
  };

  window.confirm = function(msg) {
    // If called synchronously without await, pop custom modal and log warning
    console.warn('[GrilledSModal] Please use await GrilledSModal.confirm() for full asynchronous custom modal experience.');
    return GrilledSModal.confirm(String(msg || ''));
  };

  window.prompt = function(msg, def = '') {
    console.warn('[GrilledSModal] Please use await GrilledSModal.prompt() for full asynchronous custom modal experience.');
    return GrilledSModal.prompt(String(msg || ''), def);
  };

  window.GrilledSModal = GrilledSModal;
  window.showInAppAlert = (msg, title, type) => GrilledSModal.alert(msg, title, type);
  window.showInAppConfirm = (msg, title, opts) => GrilledSModal.confirm(msg, title, opts);
  window.showInAppPrompt = (msg, def, title, opts) => GrilledSModal.prompt(msg, def, title, opts);
  window.showInAppToast = (msg, type, duration) => GrilledSModal.toast(msg, type, duration);

})(window);
