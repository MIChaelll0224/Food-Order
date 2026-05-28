// modal.js
// Reusable custom modal system for PBA-themed notifications and confirmations.

(function () {
    const modalRootId = 'pba-modal-root';
    let modalRoot = null;
    let resolveModal = null;
    let currentOptions = null;

    function createModalRoot() {
        if (modalRoot) return modalRoot;

        modalRoot = document.createElement('div');
        modalRoot.id = modalRootId;
        modalRoot.className = 'pba-modal-root';
        modalRoot.innerHTML = `
            <div class="pba-modal-overlay"></div>
            <div class="pba-modal-panel" role="dialog" aria-modal="true" aria-labelledby="pba-modal-title" aria-describedby="pba-modal-message" tabindex="-1">
                <div class="pba-modal-header">
                    <div class="pba-modal-icon" id="pba-modal-icon">?</div>
                    <div>
                        <h2 class="pba-modal-title" id="pba-modal-title"></h2>
                        <p class="pba-modal-text" id="pba-modal-message"></p>
                    </div>
                </div>
                <div class="pba-modal-actions">
                    <button type="button" class="pba-modal-button cancel" id="pba-modal-cancel"></button>
                    <button type="button" class="pba-modal-button confirm" id="pba-modal-confirm"></button>
                </div>
            </div>
        `;

        document.body.appendChild(modalRoot);

        modalRoot.querySelector('.pba-modal-overlay').addEventListener('click', (event) => {
            if (!currentOptions || !currentOptions.closeOnOutsideClick) return;
            if (event.target === event.currentTarget) {
                closeModal(false);
            }
        });

        modalRoot.addEventListener('click', (event) => {
            if (event.target === modalRoot) {
                if (currentOptions && currentOptions.closeOnOutsideClick) {
                    closeModal(false);
                }
            }
        });

        window.addEventListener('keydown', (event) => {
            if (!modalRoot.classList.contains('active')) return;
            if (event.key === 'Escape') {
                if (!currentOptions || !currentOptions.closeOnEscape) return;
                closeModal(false);
            }
        });

        const cancelButton = modalRoot.querySelector('#pba-modal-cancel');
        const confirmButton = modalRoot.querySelector('#pba-modal-confirm');

        cancelButton.addEventListener('click', () => closeModal(false));
        confirmButton.addEventListener('click', () => closeModal(true));

        return modalRoot;
    }

    function getIcon(type) {
        switch (type) {
            case 'success': return { label: '✓', style: 'success' };
            case 'error': return { label: '⚠', style: 'error' };
            case 'confirm': return { label: '?', style: 'confirm' };
            default: return { label: 'ℹ', style: 'info' };
        }
    }

    function openModal(options) {
        const root = createModalRoot();
        const titleEl = root.querySelector('#pba-modal-title');
        const messageEl = root.querySelector('#pba-modal-message');
        const iconEl = root.querySelector('#pba-modal-icon');
        const cancelButton = root.querySelector('#pba-modal-cancel');
        const confirmButton = root.querySelector('#pba-modal-confirm');
        const panel = root.querySelector('.pba-modal-panel');

        const type = options.type || 'info';
        const icon = getIcon(type);

        titleEl.textContent = options.title || (type === 'error' ? 'Error' : type === 'success' ? 'Success' : type === 'confirm' ? 'Confirm' : 'Notice');
        messageEl.textContent = options.message || '';
        iconEl.textContent = '';
        iconEl.dataset.symbol = icon.label || '';
        iconEl.className = `pba-modal-icon ${icon.style} logo`;

        confirmButton.textContent = options.confirmText || 'OK';
        confirmButton.className = `pba-modal-button confirm`;
        cancelButton.textContent = options.cancelText || 'Cancel';
        cancelButton.className = `pba-modal-button cancel`;

        if (options.showCancel) {
            cancelButton.style.display = 'inline-flex';
        } else {
            cancelButton.style.display = 'none';
        }

        currentOptions = {
            closeOnOutsideClick: options.closeOnOutsideClick !== false,
            closeOnEscape: options.closeOnEscape !== false,
            showCancel: Boolean(options.showCancel)
        };

        root.classList.add('active');
        document.body.classList.add('pba-modal-open');
        panel.focus();
    }

    function closeModal(result) {
        if (!modalRoot) return;
        modalRoot.classList.remove('active');
        document.body.classList.remove('pba-modal-open');

        if (typeof resolveModal === 'function') {
            resolveModal(result);
            resolveModal = null;
        }

        currentOptions = null;
    }

    // Lightweight non-blocking toast notification
    function showToast(message, opts = {}) {
        const duration = typeof opts.duration === 'number' ? opts.duration : 2200;
        const type = opts.type === 'error' ? 'error' : 'success';
        const toast = document.createElement('div');
        toast.className = `pba-toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        // force reflow
        void toast.offsetWidth;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => { try { document.body.removeChild(toast); } catch (e) {} }, 220);
        }, duration);
    }

    window.showModal = function (options) {
        return new Promise((resolve) => {
            resolveModal = resolve;
            openModal(options || {});
        });
    };

    window.showToast = showToast;

    window.closeModal = closeModal;

    document.addEventListener('DOMContentLoaded', createModalRoot);
})();
