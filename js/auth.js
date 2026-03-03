async function attemptLogin() {
    const u = document.getElementById('username').value;
    const p = document.getElementById('password').value;
    if (!u || !p) return Swal.fire('Errore', 'Inserisci dati', 'error');

    showLoader(true);
    try {
        const fakeEmail = u.toLowerCase() + '@cantiere.local';
        const { data, error } = await dbClient.auth.signInWithPassword({
            email: fakeEmail,
            password: p
        });

        if (error) throw error;

        // Fetch user role
        const { data: roleData, error: roleError } = await dbClient.from('user_roles').select('*').eq('id', data.user.id).single();
        if (roleError) throw roleError;

        showLoader(false);
        initUserSession(roleData);

    } catch (err) {
        showLoader(false);
        const msg = err.message || '';
        let msgIT = msg;
        if (msg.toLowerCase().includes('invalid login credentials') || msg.toLowerCase().includes('invalid email or password')) {
            msgIT = 'Identificativo o password errati. Riprova.';
        } else if (msg.toLowerCase().includes('email not confirmed')) {
            msgIT = 'Email non confermata. Contatta l\'amministratore.';
        } else if (msg.toLowerCase().includes('too many requests')) {
            msgIT = 'Troppi tentativi. Attendi qualche minuto e riprova.';
        } else if (msg.toLowerCase().includes('user not found')) {
            msgIT = 'Utente non trovato.';
        }
        Swal.fire('Accesso Negato', msgIT, 'error');
    }
}

function initUserSession(roleData) {
    USER = { id: roleData.id, username: roleData.username, role: roleData.role };
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    document.getElementById('user-display').innerHTML = USER.username.toUpperCase() + ' <i class="bi bi-power" style="margin-left: 5px; font-weight: bold;"></i>';

    // RESTORE ADMIN UI LOGIC
    if (USER.role === 'Admin') {
        document.getElementById('admin-menu').classList.remove('hidden');
        document.getElementById('admin-filters').classList.remove('hidden');
        document.querySelectorAll('.admin-only').forEach(e => e.classList.remove('hidden'));
        document.querySelectorAll('.user-only').forEach(e => e.classList.add('hidden'));
        document.getElementById('user-display').style.color = 'var(--accent)';
        document.getElementById('menu-title').innerHTML = 'MENU ADMIN';
        checkNotifications();
    } else {
        document.getElementById('admin-menu').classList.add('hidden');
        document.getElementById('admin-filters').classList.add('hidden');
        document.querySelectorAll('.admin-only').forEach(e => e.classList.add('hidden'));
        document.querySelectorAll('.user-only').forEach(e => e.classList.remove('hidden'));
        document.getElementById('menu-title').innerHTML = 'MENU OFFICINA';
    }

    // Setup Mobile Interactivity (For both Admin and User)
    const pageTitle = document.getElementById('header-page-title');
    const userBadge = document.querySelector('.user-badge');

    if (window.innerWidth <= 768) {
        if (pageTitle) {
            pageTitle.style.cursor = 'pointer';
            pageTitle.onclick = () => { if (typeof openPagePicker === 'function') openPagePicker(); };
        }
        if (userBadge) {
            userBadge.style.cursor = 'pointer';
            userBadge.onclick = () => { if (typeof logoutConfirm === 'function') logoutConfirm(); };
        }
    } else {
        // Desktop behavior: ensure no accidental clicks
        if (pageTitle) {
            pageTitle.style.cursor = 'default';
            pageTitle.onclick = null;
        }
        if (userBadge) {
            userBadge.style.cursor = 'default';
            userBadge.onclick = null;
        }
    }

    setupRealtime();
    nav('dashboard');
    // Mostra avvisi attivi dopo il login
    setTimeout(() => checkAndShowNotices(), 800);
}

async function logoutConfirm() {
    if (window.innerWidth > 768) {
        logout();
        return;
    }

    const { isConfirmed } = await Swal.fire({
        title: 'DISCONNESSIONE',
        text: "Vuoi uscire dal sistema?",
        icon: 'warning',
        showCancelButton: true,
        background: '#1a1a1a',
        color: '#fff',
        confirmButtonColor: '#FFD700',
        cancelButtonColor: '#444',
        confirmButtonText: '<span style="color:black; font-weight:bold;">SÌ, ESCI</span>',
        cancelButtonText: 'ANNULLA'
    });

    if (isConfirmed) {
        logout();
    }
}
async function checkActiveSession() {
    const { data: { session } } = await dbClient.auth.getSession();
    if (session) {
        showLoader(true);
        const { data: roleData, error } = await dbClient.from('user_roles').select('*').eq('id', session.user.id).single();
        showLoader(false);
        if (roleData) {
            initUserSession(roleData);
        } else {
            logout();
        }
    } else {
        showLoader(false);
    }
}

// Check session on startup
document.addEventListener('DOMContentLoaded', checkActiveSession);

async function logout() {
    showLoader(true);
    await dbClient.auth.signOut();
    showLoader(false);

    USER = null; DAILY_DATA = {}; OP_CART = [];
    if (inventorySubscription) { dbClient.removeChannel(inventorySubscription); inventorySubscription = null; }

    // Forze clear Operations Cart UI
    const cartContainer = document.getElementById('op-cart-container');
    const cartOverlay = document.getElementById('cart-overlay');
    if (cartContainer) {
        cartContainer.classList.remove('active');
        cartContainer.classList.add('global-hidden'); // Nasconde completamente dalla vista Login
    }
    if (cartOverlay) cartOverlay.classList.remove('active');
    document.body.classList.remove('no-scroll');
    if (typeof updateCartUI === 'function') updateCartUI(); // Reset badge and list

    document.getElementById('app-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

// --- NAVIGATION ---
function renderUsers() {
    const div = document.getElementById('admin-users-list'); div.innerHTML = '';
    DB.users.forEach(u => {
        div.innerHTML += `<div class="prod-btn" style="cursor:default; margin-bottom:5px">
                    <b>${u.user} <small style="color:var(--accent)">[${u.role}]</small></b>
                    <div>
                        <button class="icon-btn" style="font-size:18px" onclick="openUserModal('${u.user}')"><i class="bi bi-pencil"></i></button>
                        ${u.user !== USER.username ? `<button class="icon-btn" style="font-size:18px; color:var(--danger)" onclick="deleteUser('${u.user}')"><i class="bi bi-trash"></i></button>` : ''}
                    </div>
                </div>`;
    });
}

function openUserModal(username) {
    document.getElementById('modal-user').querySelector('.modal-header span').innerText = username ? 'MODIFICA UTENTE' : 'NUOVO UTENTE';
    const u = DB.users.find(x => x.user === username) || { user: '', pass: '', role: 'User' };
    document.getElementById('user-old-name').value = u.user;
    document.getElementById('user-name').value = u.user;
    document.getElementById('user-pass').value = ''; // Don't show password
    document.getElementById('user-pass').placeholder = username ? 'Lascia vuoto per non cambiare' : 'Password (Obbligatoria)';
    document.getElementById('user-role').value = u.role;
    document.getElementById('modal-user').style.display = 'flex';
}

async function saveUser() {
    const oldU = document.getElementById('user-old-name').value;
    const newU = document.getElementById('user-name').value;
    const newP = document.getElementById('user-pass').value;
    const newR = document.getElementById('user-role').value;

    if (!newU) return Swal.fire('Errore', 'Inserisci username', 'error');
    if (!oldU && !newP) return Swal.fire('Errore', 'Password obbligatoria per nuovi utenti', 'error');

    showLoader(true);
    try {
        let error;
        if (oldU) {
            const res = await dbClient.rpc('admin_update_user', { p_old_username: oldU, p_new_username: newU, p_new_password: newP, p_new_role: newR });
            error = res.error || (res.data?.status === 'error' ? new Error(res.data.message) : null);
        } else {
            const res = await dbClient.rpc('admin_create_user', { p_username: newU, p_password: newP, p_role: newR });
            error = res.error || (res.data?.status === 'error' ? new Error(res.data.message) : null);
        }
        if (error) throw error;

        // Aggiorna l'elenco locale DB.users in tempo reale dopo aver aggiunto/modificato
        const { data: usersData } = await dbClient.from('user_roles').select('*');
        if (usersData) DB.users = usersData.map(u => ({ user: u.username, role: u.role, id: u.id }));

        showLoader(false); closeModal('modal-user'); nav('admin-users');
    } catch (err) { showLoader(false); Swal.fire('Errore', err.message, 'error'); }
}

async function deleteUser(u) {
    if (confirm('Eliminare utente ' + u + '?')) {
        showLoader(true);
        try {
            const { data, error } = await dbClient.rpc('admin_delete_user', { p_username: u });
            if (error || data?.status === 'error') throw error || new Error(data?.message);

            // Update local cache
            DB.users = DB.users.filter(x => x.user !== u);

            showLoader(false);
            nav('admin-users');
        } catch (err) {
            showLoader(false);
            Swal.fire('Errore', err.message, 'error');
        }
    }
}


// --- ESPOSIZIONE GLOBALE (Per chiamate HTML onclick) ---
window.attemptLogin = attemptLogin;
window.initUserSession = initUserSession;
window.logoutConfirm = logoutConfirm;
window.checkActiveSession = checkActiveSession;
window.logout = logout;
window.renderUsers = renderUsers;
window.openUserModal = openUserModal;
window.saveUser = saveUser;
window.deleteUser = deleteUser;

