// ============================================================
//  admin.js – Page d'administration des services
// ============================================================

let adminSecret = '';

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
    const enteredSecret = adminPasswordInput.value.trim();
    if (!enteredSecret) { loginError.textContent = 'Mot de passe requis.'; return; }
    loginBtn.disabled = true;

    // Test the password with a real API call
    try {
        const res = await fetch('/api/admin/services', {
            headers: { 'X-Admin-Password': enteredSecret },
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
        adminSecret = enteredSecret;
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
        headers: { 'X-Admin-Password': adminSecret },
    };
    if (body) {
        opts.headers['Content-Type'] = 'application/json';
        opts.body = JSON.stringify(body);
    }
    return fetch('/api/admin' + path, opts);
}

// --- Load Services ---
async function loadServices() {
    setContainerMessage('Chargement…', 'loading');
    try {
        const res = await apiRequest('GET', '/services');
        const data = await res.json();

        if (!res.ok) {
            setContainerMessage('Erreur lors du chargement des services.', '', '#d13438');
            return;
        }

        const services = Array.isArray(data.services)
            ? data.services.map(normalizeService).filter(Boolean)
            : [];

        if (services.length === 0) {
            setContainerMessage('Aucun service créé. Utilisez le formulaire ci-dessus.', '', '#888');
            return;
        }

        renderServicesTable(services);
    } catch {
        setContainerMessage('Erreur de connexion.', '', '#d13438');
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
        if (!res.ok) { showMsg('Erreur lors de l’enregistrement.', false); return; }

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
            await res.json().catch(() => null);
            showMsg('Erreur lors de la suppression.', false);
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

function normalizeText(value, fallback = '') {
    return typeof value === 'string' ? value.replace(/[\u0000-\u001F\u007F]/g, '').trim() : fallback;
}

function normalizeService(service) {
    if (!service || typeof service !== 'object') return null;

    const id = Number.parseInt(service.id, 10);
    if (!Number.isInteger(id)) return null;

    return {
        id,
        name: normalizeText(service.name, 'Service'),
        code: normalizeText(service.code, 'N/A'),
        created_at: service.created_at,
    };
}

function setContainerMessage(message, className = '', color = '') {
    const paragraph = document.createElement('p');
    if (className) paragraph.className = className;
    if (color) paragraph.style.color = color;
    if (!className) {
        paragraph.style.textAlign = 'center';
        paragraph.style.padding = '20px';
    }
    paragraph.textContent = normalizeText(message);
    servicesContainer.replaceChildren(paragraph);
}

function createActionButton(label, className, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
}

function renderServicesTable(services) {
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    const headerRow = document.createElement('tr');

    ['Nom', 'Code', 'Créé le', 'Actions'].forEach((label) => {
        const th = document.createElement('th');
        th.textContent = label;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    services.forEach((service) => {
        const row = document.createElement('tr');
        const nameCell = document.createElement('td');
        const codeCell = document.createElement('td');
        const dateCell = document.createElement('td');
        const actionsCell = document.createElement('td');
        const codeTag = document.createElement('code');

        nameCell.textContent = service.name;
        codeTag.textContent = service.code;
        codeCell.appendChild(codeTag);
        dateCell.textContent = new Date(service.created_at).toLocaleDateString('fr-FR');
        actionsCell.className = 'actions';
        actionsCell.appendChild(createActionButton('✏️ Modifier', 'btn btn-secondary', () => {
            startEdit(service.id, service.name, service.code);
        }));
        actionsCell.appendChild(createActionButton('🗑️ Supprimer', 'btn btn-danger', () => {
            confirmDelete(service.id, service.name);
        }));

        row.append(nameCell, codeCell, dateCell, actionsCell);
        tbody.appendChild(row);
    });

    table.append(thead, tbody);
    servicesContainer.replaceChildren(table);
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

