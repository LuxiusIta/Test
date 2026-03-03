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
            userBadge.onclick = () => { if (typeof openUserProfile === 'function') openUserProfile(); };
        }
    } else {
        // Desktop behavior: cursor pointer for profile
        if (pageTitle) {
            pageTitle.style.cursor = 'default';
            pageTitle.onclick = null;
        }
        if (userBadge) {
            userBadge.style.cursor = 'pointer';
            userBadge.onclick = () => { if (typeof openUserProfile === 'function') openUserProfile(); };
        }
    }

    setupRealtime();
    nav('dashboard');
    // OneSignal Push Notifications Init
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    OneSignalDeferred.push(function (OneSignal) {
        OneSignal.init({
            appId: "f30c0e52-8b70-44e1-8d2b-7a263e272bc8",
            safari_web_id: "",
            notifyButton: { enable: false },
            allowLocalhostAsSecureOrigin: true,
            allow_message_focus: true,
            // PATH ASSOLUTO FONDAMENTALE PER GITHUB PAGES SOTTOCARTELLE
            // Se il service worker non viene trovato dal browser, l'iscrizione fallisce e rimane a (0) 
            path: "/Test/",
            serviceWorkerParam: { scope: "/Test/" },
            serviceWorkerPath: "OneSignalSDKWorker.js"
        });

        if (USER && USER.username) {
            OneSignal.login(USER.username);
        }
    });

    // Mostra avvisi attivi dopo il login
    setTimeout(() => checkAndShowNotices(), 800);
}

// --- USER PROFILE & LOGOUT ---
async function openUserProfile() {
    if (!USER) return;

    // Controlla lo stato attuale delle notifiche OneSignal
    let isSubscribed = false;
    if (window.OneSignal) {
        isSubscribed = window.OneSignal.User.PushSubscription.optedIn;
    }

    const toggleHtml = `
        <div style="background:#111; padding:15px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-top:20px; border:1px solid #333;">
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="bi bi-bell-fill" style="color:var(--accent); font-size:24px;"></i>
                <div style="text-align:left;">
                    <div style="font-family:'Teko'; font-size:20px; color:#fff; letter-spacing:1px; line-height:1;">NOTIFICHE PUSH</div>
                    <div style="font-size:12px; color:#888;">Avvisi e Messaggi Chat</div>
                </div>
            </div>
            
            <label class="switch" style="position:relative; display:inline-block; width:60px; height:34px;">
                <input type="checkbox" id="push-toggle" ${isSubscribed ? 'checked' : ''} onchange="togglePushNotifications(this.checked)" style="opacity:0; width:0; height:0;">
                <span class="slider round" style="position:absolute; cursor:pointer; top:0; left:0; right:0; bottom:0; background-color:#ccc; transition:.4s; border-radius:34px;"></span>
            </label>
        </div>
        
        <style>
            .switch input:checked + .slider { background-color: var(--accent); }
            .switch input:focus + .slider { box-shadow: 0 0 1px var(--accent); }
            .switch input:checked + .slider:before { transform: translateX(26px); }
            .slider:before { position:absolute; content:""; height:26px; width:26px; left:4px; bottom:4px; background-color:black; transition:.4s; border-radius:50%; }
        </style>
    `;

    Swal.fire({
        title: `<span style="font-family:'Teko'; font-size:28px; letter-spacing:1px;">PROFILO UTENTE</span>`,
        html: `
            <div style="margin-bottom:20px;">
                <div style="font-size:24px; font-weight:bold; color:#fff;">${USER.username.toUpperCase()}</div>
                <div style="font-size:14px; color:var(--accent); text-transform:uppercase; letter-spacing:2px; font-weight:bold;">RUOLO: ${USER.role}</div>
            </div>
            ${toggleHtml}
        `,
        background: '#1a1a1a',
        color: '#ccc',
        showCancelButton: true,
        showConfirmButton: true,
        confirmButtonColor: 'var(--danger)',
        cancelButtonColor: '#333',
        confirmButtonText: '<i class="bi bi-box-arrow-right"></i> DISCONNETTI',
        cancelButtonText: 'CHIUDI',
        reverseButtons: true
    }).then((result) => {
        if (result.isConfirmed) {
            logoutConfirm();
        }
    });
}

async function togglePushNotifications(enable) {
    if (!window.OneSignal) return;

    try {
        if (enable) {
            // Su iOS PWA (16.4+) la chiamata deve essere diretta e asincrona legata al click
            // Se la mettiamo dentro "OneSignalDeferred" il browser la scarta.
            await window.OneSignal.Notifications.requestPermission();

            if (USER && USER.username) {
                window.OneSignal.login(USER.username);
            }
        } else {
            window.OneSignal.User.PushSubscription.optOut();
        }
    } catch (e) {
        console.error("Errore iOS Push:", e);
    }
}

async function logoutConfirm() {
    // Il logout effettivo rimane identico a prima
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
window.openUserProfile = openUserProfile;
window.logoutConfirm = logoutConfirm;
window.checkActiveSession = checkActiveSession;
window.logout = logout;
window.renderUsers = renderUsers;
window.openUserModal = openUserModal;
window.saveUser = saveUser;
window.deleteUser = deleteUser;

