/**
 * Utility functions for BAIS Pariaman Admin Panel
 * Extracted reusable patterns for form submission, confirmation dialogs, table loading, and toasts.
 */

/**
 * Handles button loading state around an asynchronous action.
 * Restores original content and disabled state on completion.
 * @param {HTMLElement|string} btn - Button element or element ID
 * @param {string} loadingHtml - HTML/Text to display during loading
 * @param {Function} action - Async function to execute
 */
async function withButtonLoading(btn, loadingHtml, action) {
    const el = typeof btn === 'string' ? document.getElementById(btn) : btn;
    if (!el) {
        return await action();
    }
    const originalContent = el.innerHTML;
    el.disabled = true;
    if (loadingHtml) {
        el.innerHTML = loadingHtml;
    }
    try {
        return await action();
    } finally {
        el.disabled = false;
        el.innerHTML = originalContent;
    }
}

/**
 * Standard confirmation dialog using SweetAlert2 before performing an async action.
 * @param {Object} options - Configuration object
 * @param {string} [options.title='Anda Yakin?'] - Dialog title
 * @param {string} [options.html='Aksi ini tidak dapat dibatalkan!'] - HTML message
 * @param {string} [options.icon='warning'] - Swal icon ('warning', 'info', 'question', etc)
 * @param {string} [options.confirmButtonText='Ya, Lanjutkan!'] - Confirm button text
 * @param {string} [options.cancelButtonText='Batal'] - Cancel button text
 * @param {string} [options.confirmButtonColor='#d33'] - Confirm button color
 * @param {string} [options.cancelButtonColor='#6c757d'] - Cancel button color
 * @param {Function} options.onConfirm - Async callback when user confirms
 */
async function confirmActionSwal({
    title = 'Anda Yakin?',
    html = 'Aksi ini tidak dapat dibatalkan!',
    icon = 'warning',
    confirmButtonText = 'Ya, Lanjutkan!',
    cancelButtonText = 'Batal',
    confirmButtonColor = '#d33',
    cancelButtonColor = '#6c757d',
    onConfirm
}) {
    const confirmation = await Swal.fire({
        title,
        html,
        icon,
        showCancelButton: true,
        confirmButtonColor,
        cancelButtonColor,
        confirmButtonText,
        cancelButtonText
    });

    if (confirmation.isConfirmed && typeof onConfirm === 'function') {
        return await onConfirm();
    }
    return null;
}

/**
 * Sets a standardized loading state row for a table body.
 * @param {HTMLElement|string} tbody - Table body element or element ID
 * @param {number} colspan - Number of columns in table
 * @param {string} [text='Memuat data...'] - Loading text
 * @param {string} [spinnerClass=''] - Additional class for spinner (e.g. 'text-danger')
 */
function setTableLoading(tbody, colspan, text = 'Memuat data...', spinnerClass = '') {
    const el = typeof tbody === 'string' ? document.getElementById(tbody) : tbody;
    if (!el) return;
    const color = spinnerClass ? ` ${spinnerClass}` : '';
    el.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted py-4"><div class="spinner-border spinner-border-sm${color}"></div> ${text}</td></tr>`;
}

/**
 * Sets an empty state row for a table body.
 * @param {HTMLElement|string} tbody - Table body element or element ID
 * @param {number} colspan - Number of columns in table
 * @param {string} [text='Data tidak ditemukan.'] - Empty state text
 */
function setTableEmpty(tbody, colspan, text = 'Data tidak ditemukan.') {
    const el = typeof tbody === 'string' ? document.getElementById(tbody) : tbody;
    if (!el) return;
    el.innerHTML = `<tr><td colspan="${colspan}" class="text-center text-muted py-4">${text}</td></tr>`;
}

/**
 * Executes an asynchronous action after confirmation dialog with optional loading and unified error handling.
 * @param {Object} options
 * @param {string} [options.title='Anda Yakin?'] - Dialog title
 * @param {string} [options.html='Aksi ini tidak dapat dibatalkan!'] - Dialog message/HTML
 * @param {string} [options.icon='warning'] - Dialog icon
 * @param {string} [options.confirmButtonText='Ya, Lanjutkan!'] - Confirm button text
 * @param {string} [options.cancelButtonText='Batal'] - Cancel button text
 * @param {string} [options.confirmButtonColor='#d33'] - Confirm button color
 * @param {string} [options.cancelButtonColor='#6c757d'] - Cancel button color
 * @param {string} [options.loadingTitle] - Title for loading overlay during execution
 * @param {Function} options.action - Async callback performing the request/action
 * @param {Function} [options.onSuccess] - Callback on successful result: (result) => void
 * @param {Function} [options.onError] - Callback on error: (error) => void
 */
async function confirmAndExecute({
    title = 'Anda Yakin?',
    html = 'Aksi ini tidak dapat dibatalkan!',
    icon = 'warning',
    confirmButtonText = 'Ya, Lanjutkan!',
    cancelButtonText = 'Batal',
    confirmButtonColor = '#d33',
    cancelButtonColor = '#6c757d',
    loadingTitle = null,
    action,
    onSuccess,
    onError
}) {
    const confirmation = await Swal.fire({
        title,
        html,
        icon,
        showCancelButton: true,
        confirmButtonColor,
        cancelButtonColor,
        confirmButtonText,
        cancelButtonText
    });

    if (!confirmation.isConfirmed || typeof action !== 'function') {
        return null;
    }

    if (loadingTitle && typeof Swal !== 'undefined') {
        Swal.fire({
            title: loadingTitle,
            text: 'Mohon tunggu sebentar...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    }

    try {
        const result = await action();
        if (loadingTitle && typeof Swal !== 'undefined') {
            Swal.close();
        }
        if (typeof onSuccess === 'function') {
            await onSuccess(result);
        }
        return result;
    } catch (error) {
        if (loadingTitle && typeof Swal !== 'undefined') {
            Swal.close();
        }
        if (typeof onError === 'function') {
            await onError(error);
        } else {
            console.error('Error in confirmAndExecute:', error);
            Swal.fire('Gagal', 'Terjadi kesalahan pada sistem.', 'error');
        }
        return null;
    }
}

/**
 * Displays a toast notification in the top right.
 * @param {string} message - Notification text
 * @param {'success'|'error'|'info'|'warning'} [icon='success'] - Toast icon
 */
function showAdminToast(message, icon = 'success') {
    Swal.fire({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500,
        icon: icon,
        title: message
    });
}

const showToast = showAdminToast;
