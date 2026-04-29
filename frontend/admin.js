// ============================================================
//  admin.js – Page d'administration des services
// ============================================================

let adminPassword = '';

// --- DOM ---
const loginSection = document.getElementById('login-section');
const mainSection = document.getElementById('main-section');
const loginError = document.getElementById('login-error');
const loginBtn = document.getElementById('login-btn');
const adminPasswordInput = document.getElementById('admin-password');

const formTitle = document.getElementById('form-title');
const editIdInput = document.getElementById('edit-id');
const svcNameInput = document.getElementById('svc-name');
const svcCodeInput = document.getElementById('svc-code');
const saveBtn = document.getElementById('save-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const formMsg = document.getElementById('form-msg');

const servicesContainer = document.getElementById('services-table-container');

const confirmOverlay = document.getElementById('confirm-overlay');
const confirmText = document.getElementById('confirm-text');
const confirmYes = document.getElementById('confirm-yes');
const confirmNo = document.getElementById('confirm-no');

// --- Login ---
async function login() {
    const pwd = adminPasswordInput.value.trim();
    if (!pwd) { loginError.textContent = 'Mot de passe requis.'; return; }
    loginBtn.disabled = true;

    // Test the password with a real API call
    try {
        const res = await fetch('/api/admin/services', {
            headers: { 'X-Admin-Password': pwd },
        });
        if (res.status === 401 || res.status === 403) {
            loginError.textContent = 'Mot de passe incorrect.';
            loginBtn.disabled = false;
            return;
        }
        if (!res.ok && res.status !== 200) {
            loginError.textContent = `Erreur serveur (${res.status}).`;
            loginBtn.disabled = false;
            return;
        }
        adminPassword = pwd;
        // Store in sessionStorage (cleared when tab closes)
        sessionStorage.setItem('adminPwd', pwd);
        showMainPanel();
    } catch {
        loginError.textContent = 'Impossible de contacter le serveur.';
        loginBtn.disabled = false;
    }
}

function showMainPanel() {
    loginSection.style.display = 'none';
    mainSection.style.display = 'block';
    loadServices();
}

loginBtn.addEventListener('click', login);
adminPasswordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });

// --- API helpers ---
async function apiRequest(method, path, body) {
    const opts = {
        method,
        headers: { 'X-Admin-Password': adminPassword },
    };
    if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    return fetch('/api/admin' + path, opts);
}

// --- Load Services ---
async function loadServices() {
    servicesContainer.innerHTML = '<p class="loading">Chargement…</p>';
    try {
        const res = await apiRequest('GET', '/services');
        const data = await res.json();

        if (!res.ok) {
            servicesContainer.innerHTML = `<p style="color:#d13438">${data.error || 'Erreur'}</p>`;
            return;
        }

        if (!data.services || data.services.length === 0) {
            servicesContainer.innerHTML = '<p style="color:#888;text-align:center;padding:20px;">Aucun service créé. Utilisez le formulaire ci-dessus.</p>';
            return;
        }

        servicesContainer.innerHTML = `
            <table>
                <thead><tr>
                    <th>Nom</th><th>Code</th><th>Créé le</th><th>Actions</th>
                </tr></thead>
                <tbody>
                ${data.services.map((s) => `
                    <tr>
                        <td>${escHtml(s.name)}</td>
                        <td><code>${escHtml(s.code)}</code></td>
                        <td>${new Date(s.created_at).toLocaleDateString('fr-FR')}</td>
                        <td class="actions">
                            <button class="btn btn-secondary" onclick="startEdit(${s.id},'${escAttr(s.name)}','${escAttr(s.code)}')">✏️ Modifier</button>
                            <button class="btn btn-danger" onclick="confirmDelete(${s.id},'${escAttr(s.name)}')">🗑️ Supprimer</button>
                        </td>
                    </tr>
                `).join('')}
                </tbody>
            </table>
        `;
    } catch {
        servicesContainer.innerHTML = '<p style="color:#d13438">Erreur de connexion.</p>';
    }
}

// --- Create / Update ---
saveBtn.addEventListener('click', async () => {
    const name = svcNameInput.value.trim();
    const code = svcCodeInput.value.trim().toUpperCase();
    const id = editIdInput.value;

    if (!name || !code) { showMsg('Nom et code requis.', false); return; }

    saveBtn.disabled = true;
    try {
        let res;
        if (id) {
            res = await apiRequest('PUT', `/services/${id}`, { name, code });
        } else {
            res = await apiRequest('POST', '/services', { name, code });
        }
        const data = await res.json();
        if (!res.ok) { showMsg(data.error || 'Erreur.', false); return; }

        showMsg(id ? 'Service mis à jour ✓' : 'Service créé ✓', true);
        resetForm();
        loadServices();
    } catch { showMsg('Erreur de connexion.', false); }
    saveBtn.disabled = false;
});

function startEdit(id, name, code) {
    editIdInput.value = id;
    svcNameInput.value = name;
    svcCodeInput.value = code;
    formTitle.textContent = '✏️ Modifier le service';
    saveBtn.textContent = 'Mettre à jour';
    cancelEditBtn.style.display = '';
    svcNameInput.focus();
    formMsg.textContent = '';
}

cancelEditBtn.addEventListener('click', resetForm);

function resetForm() {
    editIdInput.value = '';
    svcNameInput.value = '';
    svcCodeInput.value = '';
    formTitle.textContent = '➕ Nouveau service';
    saveBtn.textContent = 'Enregistrer';
    cancelEditBtn.style.display = 'none';
    formMsg.textContent = '';
}

// --- Delete ---
let pendingDeleteId = null;

function confirmDelete(id, name) {
    pendingDeleteId = id;
    confirmText.textContent = `Supprimer "${name}" ? Les joueurs de ce service n'auront plus de service associé.`;
    confirmOverlay.classList.add('open');
}

confirmYes.addEventListener('click', async () => {
    confirmOverlay.classList.remove('open');
    if (!pendingDeleteId) return;
    try {
        const res = await apiRequest('DELETE', `/services/${pendingDeleteId}`);
        if (!res.ok) {
            const data = await res.json();
            showMsg(data.error || 'Erreur lors de la suppression.', false);
        } else {
            showMsg('Service supprimé ✓', true);
            loadServices();
        }
    } catch { showMsg('Erreur de connexion.', false); }
    pendingDeleteId = null;
});

confirmNo.addEventListener('click', () => {
    confirmOverlay.classList.remove('open');
    pendingDeleteId = null;
});
confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) { confirmOverlay.classList.remove('open'); pendingDeleteId = null; }
});

// --- Helpers ---
function showMsg(msg, ok) {
    formMsg.textContent = msg;
    formMsg.className = `form-msg ${ok ? 'ok' : 'err'}`;
}
function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s) {
    return String(s || '').replace(/'/g,"\\'").replace(/"/g,'&quot;');
}

// --- Auto-code from name ---
svcNameInput.addEventListener('input', () => {
    if (!editIdInput.value) {
        // Auto-generate code from name if code field is empty
        const words = svcNameInput.value.trim().split(/\s+/);
        const suggestion = words.map((w) => w[0] || '').join('').toUpperCase().slice(0, 8);
        if (!svcCodeInput.dataset.manuallyEdited) {
            svcCodeInput.value = suggestion;
        }
    }
});
svcCodeInput.addEventListener('input', () => {
    svcCodeInput.dataset.manuallyEdited = svcCodeInput.value ? '1' : '';
    svcCodeInput.value = svcCodeInput.value.toUpperCase().replace(/[^A-Z0-9_]/g, '');
});

// --- Check sessionStorage on load ---
document.addEventListener('DOMContentLoaded', () => {
    const saved = sessionStorage.getItem('adminPwd');
    if (saved) {
        adminPassword = saved;
        adminPasswordInput.value = saved;
        login();
    }
});
