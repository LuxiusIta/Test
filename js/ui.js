function openPagePicker() {
    const pages = [
        { id: 'dashboard', name: 'MAGAZZINO', icon: 'bi-box-seam' },
        { id: 'dailylist', name: 'LISTA GIORNALIERA', icon: 'bi-list-check' },
        { id: 'operations', name: 'OPERAZIONI', icon: 'bi-plus-circle' }
    ];

    // Add admin-only pages
    if (USER && USER.role === 'Admin') {
        pages.push({ id: 'admin-products', name: 'GESTIONE PRODOTTI', icon: 'bi-box-seam' });
        pages.push({ id: 'admin-warehouses', name: 'GESTIONE MAGAZZINO', icon: 'bi-houses' });
        pages.push({ id: 'admin-reports', name: 'GESTIONE REPORT', icon: 'bi-file-earmark-bar-graph' });
        pages.push({ id: 'admin-notices', name: 'GESTIONE AVVISI', icon: 'bi-megaphone' });
        pages.push({ id: 'admin-users', name: 'GESTIONE UTENTI', icon: 'bi-people' });
        pages.push({ id: 'admin-movements-log', name: 'GESTIONE MOVIMENTI', icon: 'bi-journal-text' });
    }

    let html = '<div style="display:flex; flex-direction:column; gap:10px; padding:10px;">';
    pages.forEach(p => {
        html += `
            <button onclick="Swal.clickConfirm(); nav('${p.id}')" 
                    style="display:flex; align-items:center; gap:15px; background:#222; border:1px solid #333; border-radius:10px; padding:15px; color:#fff; text-align:left; font-family:'Teko'; font-size:18px; width:100%;">
                <i class="${p.icon}" style="color:#FFD700; font-size:20px;"></i>
                <span>${p.name}</span>
            </button>
        `;
    });
    html += '</div>';

    Swal.fire({
        title: '<span style="font-family:\'Teko\'; font-size:24px;">NAVIGAZIONE</span>',
        html: html,
        showConfirmButton: false,
        background: '#1a1a1a',
        color: '#fff',
        showCloseButton: true,
        customClass: {
            container: 'page-picker-container'
        }
    });
}

function toggleMenu() {
    document.getElementById('sidebar').classList.toggle('active');
    document.getElementById('sidebar-overlay').classList.toggle('active');
    document.body.classList.toggle('no-scroll');
}

function toggleCartDrawer() {
    const container = document.getElementById('op-cart-container');
    const overlay = document.getElementById('cart-overlay');
    const icon = document.getElementById('cart-handle-icon');

    container.classList.toggle('active');
    overlay.classList.toggle('active');
    document.body.classList.toggle('no-scroll');

    if (container.classList.contains('active')) {
        icon.classList.replace('bi-chevron-up', 'bi-chevron-down');
    } else {
        icon.classList.replace('bi-chevron-down', 'bi-chevron-up');
    }
}

async function nav(page) {
    if (USER.role !== 'Admin' && page.startsWith('admin-')) return;
    closeAllModals();

    // Only fetch data if we haven't loaded it yet
    if (!DB.products || DB.products.length === 0) {
        showLoader(true);
        try {
            const { data: prods } = await dbClient.from('products').select('*');
            if (prods) {
                DB.products = prods.map(p => ({
                    ID_Prodotto: p.id,
                    Nome: p.nome,
                    Categoria: p.categoria,
                    Fornitore: p.fornitore,
                    Reparto: p.reparto,
                    Pezzi_per_Cartone: p.pezzi_per_cartone,
                    Pezzi_per_Pacco: p.pezzi_per_pacco,
                    URL_Immagine: p.url_immagine
                }));
            }
            await loadInventoryData();

            if (USER.role === 'Admin') {
                const { data: usersData } = await dbClient.from('user_roles').select('*');
                if (usersData) DB.users = usersData.map(u => ({ user: u.username, role: u.role, id: u.id }));
            }
            showLoader(false);
        } catch (err) {
            showLoader(false);
            Swal.fire('Errore Caricamento', err.message, 'error');
            return;
        }
    }
    performPageSwitch(page);
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    if (Swal.isVisible()) Swal.close();
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

function performPageSwitch(page) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(el => {
        el.style.display = 'none';
        el.classList.remove('page-transition');
    });

    document.querySelectorAll('.nav-links a').forEach(el => el.classList.remove('active'));

    const pageId = 'page-' + page;
    const pageEl = document.getElementById(pageId);
    if (pageEl) {
        pageEl.style.display = 'block';
        if (window.innerWidth <= 768) {
            pageEl.classList.add('page-transition');
        }
    }

    const navLink = document.getElementById('nav-' + page);
    if (navLink) navLink.classList.add('active');

    const dw = document.querySelector('.desktop-wrapper');
    if (dw) {
        if (page === 'operations' || page === 'dashboard' || page === 'admin-notices') {
            dw.classList.add('no-bg');
        } else {
            dw.classList.remove('no-bg');
        }
    }

    // GESTIONE VISIBILITA' DEL CARRELLO ROOT
    const rootCart = document.getElementById('op-cart-container');
    if (rootCart) {
        if (page === 'operations') {
            rootCart.classList.remove('global-hidden');
        } else {
            rootCart.classList.add('global-hidden');
        }
    }

    const labels = {
        'dashboard': 'MAGAZZINO',
        'operations': 'OPERAZIONI',
        'dailylist': 'GIORNALIERO',
        'admin-warehouses': 'MAGAZZINI',
        'admin-products': 'PRODOTTI',
        'admin-movements-log': 'MOVIMENTI',
        'admin-reports': 'REPORT',
        'admin-users': 'UTENTI',
        'admin-notices': 'AVVISI'
    };

    const titleEl = document.getElementById('header-page-title');
    if (titleEl) {
        let label = labels[page] || page.toUpperCase();
        const iconLabels = {
            'dashboard': '<i class="bi bi-box-seam" style="margin-right: 8px;"></i> MAGAZZINO',
            'operations': '<i class="bi bi-arrow-left-right" style="margin-right: 8px;"></i> OPERAZIONI',
            'dailylist': '<i class="bi bi-list-ul" style="margin-right: 8px;"></i> GIORNALIERO',
            'admin-warehouses': '<i class="bi bi-gear-fill" style="margin-right: 8px;"></i> MAGAZZINI',
            'admin-products': '<i class="bi bi-gear-fill" style="margin-right: 8px;"></i> PRODOTTI',
            'admin-movements-log': '<i class="bi bi-journal-text" style="margin-right: 8px;"></i> MOVIMENTI',
            'admin-reports': '<i class="bi bi-list-ul" style="margin-right: 8px;"></i> GIORNALIERO',
            'admin-users': '<i class="bi bi-gear-fill" style="margin-right: 8px;"></i> UTENTI',
            'admin-notices': '<i class="bi bi-megaphone-fill" style="margin-right: 8px;"></i> AVVISI'
        };
        titleEl.innerHTML = iconLabels[page] || label;
    }

    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('sidebar-overlay').classList.remove('active');
    document.body.classList.remove('no-scroll');

    if (page === 'dashboard') renderDashboard();
    if (page === 'operations') renderOperationsUI();
    if (page === 'dailylist') { checkInitialDailyState(); renderDailyList('LAVAGGIO'); }
    if (page === 'admin-warehouses') renderAdminWarehouses();
    if (page === 'admin-products') renderAdminProds();
    if (page === 'admin-movements-log') loadMovementsLog();
    if (page === 'admin-reports') loadReports();
    if (page === 'admin-users') renderUsers();
    if (page === 'admin-notices') loadNotices();

    initSelects();
}

function initSelects() {
    const whs = DB.warehouses.filter(w => w.name !== 'Cucina');
    const opts = whs.map(w => `<option value="${w.name}">${w.name}</option>`).join('');

    const dWh = document.getElementById('dash-wh-filter');
    if (dWh) {
        dWh.innerHTML = '<option value="ALL">TUTTI I MAGAZZINI</option>' + opts;
    }

    const dCat = document.getElementById('dash-cat-filter');
    if (dCat && dCat.options.length <= 1) {
        const cats = [...new Set(DB.products.map(p => p.Categoria))].filter(Boolean).sort();
        dCat.innerHTML = '<option value="ALL">TUTTE LE CATEGORIE</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    if (USER.role === 'Admin') {
        const dSupp = document.getElementById('dash-supp-filter');
        const rSupp = document.getElementById('report-supp-filter');
        const supps = [...new Set(DB.products.map(p => p.Fornitore))].filter(Boolean).sort();
        const sOpts = '<option value="ALL">TUTTI I FORNITORI</option>' + supps.map(s => `<option value="${s}">${s}</option>`).join('');
        if (dSupp && dSupp.options.length <= 1) dSupp.innerHTML = sOpts;
        if (rSupp && rSupp.options.length <= 1) rSupp.innerHTML = sOpts;
    }
}

function toggleDashboardFilters() {
    const area = document.getElementById('filters-collapse-area');
    const icon = document.getElementById('filters-toggle-icon');
    const preview = document.getElementById('filters-preview');
    if (area.classList.contains('collapsed')) {
        area.classList.remove('collapsed');
        icon.classList.remove('bi-chevron-down');
        icon.classList.add('bi-chevron-up');
        if (preview) preview.classList.add('hidden');
    } else {
        area.classList.add('collapsed');
        icon.classList.remove('bi-chevron-up');
        icon.classList.add('bi-chevron-down');
        if (preview) preview.classList.remove('hidden');
    }
}

function showInstallHelp() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => { deferredPrompt = null; });
    } else {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isAndroid = /android/i.test(navigator.userAgent);

        let htmlContent = `Usa il menu del browser per "Creare una scorciatoia" o "Aggiungere ai preferiti" per installarla sui dispositivi mobili.`;

        if (isIOS) {
            htmlContent = `
                        <div style="text-align: left; font-size: 16px; line-height: 1.6;">
                            <p style="margin-bottom: 10px; text-align: center;">Per installare l'app su <b style="color:white">iPhone/iPad</b>:</p>
                            <ol style="padding-left: 20px; margin: 0;">
                                <li style="margin-bottom: 8px;">Tocca l'icona <b style="color:var(--accent)"><i class="bi bi-box-arrow-up"></i> Condividi</b> nella barra inferiore di Safari.</li>
                                <li style="margin-bottom: 8px;">Scorri il menu e seleziona <b>"Aggiungi alla schermata Home" <i class="bi bi-plus-square"></i></b>.</li>
                                <li>Tocca <b>"Aggiungi"</b> in alto a destra.</li>
                            </ol>
                        </div>
                    `;
        } else if (isAndroid) {
            htmlContent = `
                        <div style="text-align: left; font-size: 16px; line-height: 1.6;">
                            <p style="margin-bottom: 10px; text-align: center;">Per installare l'app su <b style="color:white">Android</b>:</p>
                            <ol style="padding-left: 20px; margin: 0;">
                                <li style="margin-bottom: 8px;">Tocca l'icona <b style="color:var(--accent)"><i class="bi bi-three-dots-vertical"></i> Menu</b> del browser in alto a destra.</li>
                                <li style="margin-bottom: 8px;">Seleziona <b>"Installa app"</b> o <b>"Aggiungi a schermata Home"</b>.</li>
                                <li>Conferma toccando <b>"Installa"</b> o <b>"Aggiungi"</b>.</li>
                            </ol>
                        </div>
                    `;
        }

        Swal.fire({
            title: `INSTALLA WEB APP`,
            html: htmlContent,
            background: '#1a1a1a',
            color: '#ccc',
            confirmButtonColor: '#FFD700',
            confirmButtonText: '<span style="color:black; font-weight:bold;">HO CAPITO</span>'
        });
    }
}

// --- MISMATCH / INCONGRUENZE LOGIC ---
async function checkNotifications() {
    if (!USER || USER.role !== 'Admin') return;
    const { data, error } = await dbClient.from('inventory_discrepancies').select('id');
    if (!error && data) {
        const badge = document.getElementById('notif-badge');
        if (data.length > 0) {
            badge.innerText = data.length;
            badge.style.display = 'block';
        } else {
            badge.style.display = 'none';
        }
    }
}

async function openNotifications() {
    document.getElementById('modal-notifications').style.display = 'flex';
    const list = document.getElementById('notif-list');
    list.innerHTML = '<div style="text-align:center; padding:20px"><i class="bi bi-arrow-repeat spin"></i> Caricamento...</div>';

    const { data, error } = await dbClient.from('inventory_discrepancies').select('*').order('created_at', { ascending: false });
    if (error) { list.innerHTML = 'Errore caricamento.'; return; }

    if (data.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#888; padding:20px">Nessuna segnalazione presente.</div>';
        return;
    }

    list.innerHTML = data.map(n => `
                <div style="background:#1a1a1a; padding:15px; border-radius:8px; border-left:4px solid var(--danger)">
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px">
                        <b style="color:var(--accent); font-size:16px">${n.product_name}</b>
                        <span style="font-size:12px; color:#888">${new Date(n.created_at).toLocaleString()}</span>
                    </div>
                    <div style="font-size:13px; margin-bottom:5px"><b>Magazzino:</b> ${n.warehouse_name}</div>
                    <div style="font-size:13px; margin-bottom:5px; color:#ccc"><b>Da:</b> ${n.reported_by}</div>
                    <div style="font-size:14px; background:#000; padding:10px; border-radius:4px; margin-top:10px; font-style:italic">"${n.notes}"</div>
                    <button class="icon-btn" style="color:var(--danger); font-size:14px; margin-top:10px" onclick="deleteNotification('${n.id}')">
                        <i class="bi bi-trash"></i> Segna come risolto
                    </button>
                </div>
            `).join('');
}

async function deleteNotification(id) {
    if (!confirm("Eliminare questa segnalazione?")) return;
    showLoader(true);
    const { data, error } = await dbClient.from('inventory_discrepancies').delete().eq('id', id).select();
    showLoader(false);

    if (error) {
        Swal.fire('Errore server', error.message, 'error');
    } else if (!data || data.length === 0) {
        Swal.fire('Errore permessi', "Il database ha bloccato l'eliminazione. Esegui la policy RLS per il DELETE in Supabase.", 'error');
    } else {
        openNotifications();
        checkNotifications();
    }
}

// --- LIVE CHAT ---
function toggleChat() {
    const drawer = document.getElementById('chat-drawer');
    const isActive = drawer.classList.contains('active');

    if (!isActive) {
        drawer.classList.add('active');
        if (USER && USER.role === 'Admin') {
            drawer.classList.add('admin-view');
        } else {
            drawer.classList.remove('admin-view');
        }
        const badge = document.getElementById('chat-badge');
        badge.style.display = 'none';
        badge.innerText = '0';
        fetchChat();
    } else {
        drawer.classList.remove('active');
    }
}

function addEmoji(emoji) {
    const input = document.getElementById('chat-input');
    input.value += emoji;
    input.focus();
}

let chatUserRoles = {};

async function fetchChat() {
    // Fetch messages
    const { data: messages, error } = await dbClient.from('chat_messages').select('*').order('created_at', { ascending: false }).limit(50);
    if (error) return console.error('Error fetching chat:', error);

    // Otteniamo una lista dei ruoli utenti solo se non l'abbiamo già
    // per non tartassare il DB a ogni minima notifica push in chat
    if (Object.keys(chatUserRoles).length === 0) {
        const { data: roles, error: rolesErr } = await dbClient.from('user_roles').select('username, role');
        if (roles) {
            chatUserRoles = {};
            roles.forEach(r => chatUserRoles[r.username] = r.role);
        }
    }

    renderChat(messages.reverse()); // Show oldest at top, newest at bottom
}

function renderChat(messages) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = messages.map(m => {
        const isMine = m.user_name === USER?.username;
        const time = new Date(m.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

        // Determina in modo più flessibile (case-insensitive) se è Admin
        const rawRole = chatUserRoles[m.user_name] || '';
        const isAuthorAdmin = rawRole.toLowerCase() === 'admin';

        // Usiamo vere EMOJI invece di icone da ufficio! 👷‍♂️ per Capo, 👷 per Lavoratore base
        const roleIcon = isAuthorAdmin ? '<span style="font-size:16px; margin-right:4px">👷‍♂️</span>' : '<span style="font-size:16px; margin-right:4px">👷</span>';
        const adminBadgeHTML = isAuthorAdmin ? `<span style="background:var(--danger); color:white; padding:1px 4px; border-radius:3px; font-size:9px; margin-left:5px; font-weight:bold;">ADMIN</span>` : '';

        // Colore nome utente: I Capi sono sempre Rossi, la TUA chat (se non sei capo) è Gialla, i colleghi base Azzurri
        let nameColor = '#88bcff'; // Colleghi base Azzurri
        if (isAuthorAdmin) nameColor = '#ff4d4d'; // Capi Rossi
        else if (isMine) nameColor = 'var(--accent)'; // Tu Giallo (se sei base)

        return `
                <div class="chat-msg ${isMine ? 'mine' : ''}">
                    <i class="bi bi-trash-fill del-btn" onclick="deleteChatMessage('${m.id}')" title="Elimina: solo Admin"></i>
                    <div class="author" style="color:${nameColor}; font-size:13px; display:flex; align-items:center; margin-bottom:6px;">
                        ${roleIcon} ${m.user_name} ${adminBadgeHTML}
                    </div>
                    <div style="line-height:1.4; color:#eee; font-size:14px;">${highlightMentions(m.message)}</div>
                    <div class="time">${time}</div>
                </div>`;
    }).join('');
    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

async function sendChatMessage() {
    if (!USER) return;
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = ''; // clear immediately for UX
    input.focus();

    const { error } = await dbClient.from('chat_messages').insert({
        user_name: USER.username,
        message: text
    });
    if (error) {
        console.error(error);
        Swal.fire('Errore', 'Impossibile inviare il messaggio', 'error');
    } else {
        fetchChat();

        // --- NATIVE WEB PUSH: CHAT MENTION ---
        const mentionRegex = /@([a-zA-Z0-9_]+)/g;
        let match;
        const mentionedUsers = new Set();
        while ((match = mentionRegex.exec(text)) !== null) {
            mentionedUsers.add(match[1]);
        }

        if (mentionedUsers.size > 0 && typeof sendPushNotification === 'function') {
            for (const targetUser of mentionedUsers) {
                // Non notificare se stessi
                if (targetUser.toLowerCase() !== USER.username.toLowerCase()) {
                    sendPushNotification(`Da Cantiere`, `Ti ha Menzionato: ${USER.username}\n${text}`, targetUser);
                }
            }
        }
    }
}

async function deleteChatMessage(id) {
    if (!USER || USER.role !== 'Admin') return;
    if (!confirm("Sei sicuro di voler eliminare questo messaggio?")) return;

    const { error } = await dbClient.from('chat_messages').delete().eq('id', id);
    if (error) {
        console.error("Delete error:", error);
        Swal.fire('Errore server', 'Impossibile eliminare, assicurati di aver eseguito il comando SQL per i permessi (DELETE policy su chat_messages)', 'error');
    } else {
        fetchChat();
    }
}

async function clearChat() {
    if (!USER || USER.role !== 'Admin') return;
    if (!confirm("ATTENZIONE: Sei sicuro di voler ELIMINARE TUTTA LA CRONOLOGIA DELLA CHAT per tutti gli utenti? Questa azione è irreversibile.")) return;

    showLoader(true);
    // Delete all messages by deleting where id is not null (hacky clear)
    const { error } = await dbClient.from('chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    showLoader(false);

    if (error) {
        console.error("Clear chat error:", error);
        Swal.fire('Errore server', 'Impossibile svuotare la chat, controlla le policy RLS su supbabase', 'error');
    } else {
        fetchChat();
    }
}

// --- MOBILE GESTURES (Simplified) ---
// Global swipe-to-close completely removed as it conflicts with normal scrolling


// ===== @MENTION IN CHAT =====
let mentionActive = false;
let mentionQuery = '';
let mentionHighlightIdx = 0;

function highlightMentions(text) {
    if (!USER) return text;
    const myName = USER.username;
    return text.replace(/@(\S+)/g, (match, name) => {
        const isMeTag = name.toLowerCase() === myName.toLowerCase();
        return `<span class="mention${isMeTag ? ' me' : ''}">${match}</span>`;
    });
}

function getMentionCandidates(query) {
    const all = DB.users && DB.users.length > 0
        ? DB.users.map(u => u.user)
        : Object.keys(chatUserRoles);
    if (!query) return all.slice(0, 8);
    return all.filter(u => u.toLowerCase().startsWith(query.toLowerCase())).slice(0, 8);
}

function handleChatInput(e) {
    // Se l'utente sta cancellando, non far riapparire il popup (fastidioso)
    if (e.inputType && e.inputType.startsWith('delete')) {
        mentionActive = false;
        return;
    }

    const input = document.getElementById('chat-input');
    const val = input.value;
    const pos = input.selectionStart;
    const before = val.slice(0, pos);

    // Triggera solo se l'ultimo carattere digitato è @ o stiamo scrivendo subito dopo un @
    const match = before.match(/@([\w]*)$/);
    if (match) {
        mentionActive = true;
        mentionQuery = match[1];
        openMentionSwal(mentionQuery, pos);
    } else {
        mentionActive = false;
    }
}

function handleChatKeyDown(e) {
    // No inline dropdown anymore — just block Enter if mentionActive is set
    if (mentionActive && e.key === 'Enter') {
        e.preventDefault();
    } else if (e.key === 'Escape') {
        mentionActive = false;
    }
}

function handleChatKeyUp(e) {
    if (!mentionActive && e.key === 'Enter') sendChatMessage();
}

async function openMentionSwal(query, cursorPos) {
    const all = getMentionCandidates('');
    if (all.length === 0) { mentionActive = false; return; }

    const listHTML = all.map(u =>
        `<div onclick="window._swalMentionPick('${u}')" style="cursor:pointer; padding:12px 16px; display:flex; align-items:center; gap:10px;
                    font-family:'Teko'; font-size:18px; letter-spacing:0.5px; color:#ccc;
                    border-bottom:1px solid #222; transition:background 0.15s;"
                    onmouseenter="this.style.background='rgba(255,215,0,0.1)'; this.style.color='var(--accent)'"
                    onmouseleave="this.style.background=''; this.style.color='#ccc'">
                    <i class="bi bi-person-fill" style="color:var(--accent); font-size:14px;"></i>${u}
                </div>`
    ).join('');

    window._swalMentionPick = (name) => {
        Swal.close();
        insertMention(name);
    };

    await Swal.fire({
        title: '<span style="font-family:\'Teko\'; font-size:22px; letter-spacing:1px;">@ TAGA UTENTE</span>',
        html: `<div style="max-height:280px; overflow-y:auto; margin:-10px -10px; border-top:1px solid #333;">${listHTML}</div>`,
        background: '#1a1a1a',
        color: '#ccc',
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'Annulla',
        cancelButtonColor: '#333',
        width: 320,
        didClose: () => { mentionActive = false; }
    });
}

function insertMention(name) {
    const input = document.getElementById('chat-input');
    const val = input.value;
    const pos = input.selectionStart;
    const before = val.slice(0, pos).replace(/@[\w]*$/, `@${name} `);
    const after = val.slice(pos);
    input.value = before + after;
    input.focus();
    input.setSelectionRange(before.length, before.length);
    closeMentionDropdown();
}

function closeMentionDropdown() {
    mentionActive = false;
    mentionQuery = '';
}

// ===== ADMIN NOTICES =====
async function publishNotice() {
    const editor = document.getElementById('notice-editor');
    const content = editor.innerHTML.trim();
    const durationHours = parseInt(document.getElementById('notice-duration').value);

    if (!content || content === '' || content === '<br>') {
        return Swal.fire('Attenzione', 'Scrivi il testo dell\'avviso prima di pubblicare.', 'warning');
    }

    const expires_at = durationHours > 0
        ? new Date(Date.now() + durationHours * 3600 * 1000).toISOString()
        : null;

    showLoader(true);
    const { error } = await dbClient.from('admin_notices').insert({
        created_by: USER.username,
        content: content,
        expires_at: expires_at
    });
    showLoader(false);

    if (error) {
        Swal.fire('Errore', error.message, 'error');
    } else {
        editor.innerHTML = '';
        Swal.fire({ icon: 'success', title: 'Avviso pubblicato!', timer: 1500, showConfirmButton: false });
        loadNotices();

        // --- NATIVE WEB PUSH: ADMIN NOTICE ---
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;
        const plainText = tempDiv.textContent || tempDiv.innerText || "";

        if (typeof sendPushNotification === 'function') {
            sendPushNotification(`Da Cantiere`, `Avviso da: ${USER.username}\n${plainText}`);
        }
    }
}

async function loadNotices() {
    const { data, error } = await dbClient
        .from('admin_notices')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) { console.error(error); return; }
    const now = new Date();
    const active = (data || []).filter(n => !n.expires_at || new Date(n.expires_at) > now);
    renderNoticesList(active);
}

function renderNoticesList(notices) {
    const container = document.getElementById('notices-list');
    if (!container) return;
    if (notices.length === 0) {
        container.innerHTML = '<div style="text-align:center; color:#555; padding:20px; font-style:italic;">Nessun avviso attivo.</div>';
        return;
    }
    container.innerHTML = notices.map(n => {
        const createdAt = new Date(n.created_at).toLocaleString('it-IT');
        const expiresStr = n.expires_at
            ? `Scade: ${new Date(n.expires_at).toLocaleString('it-IT')}`
            : 'Nessuna scadenza';
        return `
                <div class="notice-card">
                    <div class="notice-meta">
                        <span><i class="bi bi-person-fill" style="color:var(--accent)"></i> ${n.created_by} &nbsp;·&nbsp; ${createdAt}</span>
                        <span class="notice-expires"><i class="bi bi-clock"></i> ${expiresStr}</span>
                    </div>
                    <div class="notice-body">${n.content}</div>
                    <button class="icon-btn" style="color:var(--danger); font-size:13px; margin-top:10px;"
                        onclick="deleteNotice('${n.id}')">
                        <i class="bi bi-trash"></i> Elimina avviso
                    </button>
                </div>`;
    }).join('');
}

async function deleteNotice(id) {
    if (!confirm('Eliminare questo avviso?')) return;
    showLoader(true);
    const { error } = await dbClient.from('admin_notices').delete().eq('id', id);
    showLoader(false);
    if (error) Swal.fire('Errore', error.message, 'error');
    else loadNotices();
}


async function checkAndShowNotices() {
    const { data, error } = await dbClient
        .from('admin_notices')
        .select('*')
        .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) return;

    const now = new Date();
    const active = data.filter(n => !n.expires_at || new Date(n.expires_at) > now);
    if (active.length === 0) return;

    // Show notices one by one using SweetAlert
    for (let i = 0; i < active.length; i++) {
        const n = active[i];
        const isLast = i === active.length - 1;
        const expiresStr = n.expires_at
            ? `<div style="font-size:11px; color:#888; margin-top:10px;"><i class="bi bi-clock"></i> Scade: ${new Date(n.expires_at).toLocaleString('it-IT')}</div>`
            : '';

        await Swal.fire({
            icon: 'warning',
            title: `<span style="font-family:'Teko'; font-size:28px; letter-spacing:1px;">📢 AVVISO — ${n.created_by.toUpperCase()}</span>`,
            html: `<div style="text-align:left; font-size:15px; line-height:1.6; color:#ddd;">${n.content}</div>${expiresStr}`,
            background: '#1a1a1a',
            color: '#ccc',
            confirmButtonColor: '#FFD700',
            confirmButtonText: isLast
                ? '<span style="color:black; font-weight:bold;">HO LETTO ✓</span>'
                : '<span style="color:black; font-weight:bold;">AVANTI →</span>',
            allowOutsideClick: false
        });
    }
}

function applyNoticeColor(color) {
    document.execCommand('foreColor', false, color);
    document.getElementById('notice-editor').focus();
    updateNoticeToolbar();
}

function updateNoticeToolbar() {
    const cmds = ['bold', 'italic', 'underline', 'strikeThrough', 'justifyLeft', 'justifyCenter', 'justifyRight'];
    cmds.forEach(cmd => {
        const btn = document.querySelector(`.notice-tool-btn[data-cmd="${cmd}"]`);
        if (!btn) return;
        try {
            btn.classList.toggle('active', document.queryCommandState(cmd));
        } catch (e) { }
    });
}

// Auto-update toolbar when selection changes inside notice editor
document.addEventListener('selectionchange', () => {
    const editor = document.getElementById('notice-editor');
    if (!editor) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        updateNoticeToolbar();
    }
});

// Reload notices list when navigating to notices page
const _origPerformPageSwitch = performPageSwitch;
window._noticesLoaded = false;

// --- ESPOSIZIONE GLOBALE (Per chiamate HTML onclick) ---
window.openPagePicker = openPagePicker;
window.toggleMenu = toggleMenu;
window.toggleCartDrawer = toggleCartDrawer;
window.nav = nav;
window.closeAllModals = closeAllModals;
window.closeModal = closeModal;
window.performPageSwitch = performPageSwitch;
window.initSelects = initSelects;
window.toggleDashboardFilters = toggleDashboardFilters;
window.showInstallHelp = showInstallHelp;
window.checkNotifications = checkNotifications;
window.openNotifications = openNotifications;
window.deleteNotification = deleteNotification;
window.toggleChat = toggleChat;
window.addEmoji = addEmoji;
window.fetchChat = fetchChat;
window.renderChat = renderChat;
window.sendChatMessage = sendChatMessage;
window.deleteChatMessage = deleteChatMessage;
window.clearChat = clearChat;
window.highlightMentions = highlightMentions;
window.getMentionCandidates = getMentionCandidates;
window.handleChatInput = handleChatInput;
window.handleChatKeyDown = handleChatKeyDown;
window.handleChatKeyUp = handleChatKeyUp;
window.openMentionSwal = openMentionSwal;
window.insertMention = insertMention;
window.closeMentionDropdown = closeMentionDropdown;
window.publishNotice = publishNotice;
window.loadNotices = loadNotices;
window.renderNoticesList = renderNoticesList;
window.deleteNotice = deleteNotice;
window.checkAndShowNotices = checkAndShowNotices;
window.applyNoticeColor = applyNoticeColor;
window.updateNoticeToolbar = updateNoticeToolbar;

