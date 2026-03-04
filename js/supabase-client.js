const SUPABASE_URL = 'https://jkekmxhrwwidkfoizhde.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprZWtteGhyd3dpZGtmb2l6aGRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjEwMTcsImV4cCI6MjA4NzAzNzAxN30.U_XxfpAR76Y7bhB_DdUu2CMeuIarR4158dgwITFRWAg';
const dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let DB = { products: [], inventory: {}, warehouses: [], users: [] };
let USER = null;
let DAILY_DATA = {};
let ALL_REPORTS = [];
let deferredPrompt;
let inventorySubscription = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

// --- UTILITIES ---
function showLoader(show) {
    const el = document.getElementById('loader-overlay');
    if (el) el.className = show ? '' : 'hidden';
}

function renderQtyBadges(qty, prod) {
    if (!qty || qty === 0) return '<span style="color:#444; font-size:12px; font-style:italic">0 pz</span>';
    let html = '';
    let rem = qty;
    const pCrt = prod.Pezzi_per_Cartone || 1;
    const pPck = prod.Pezzi_per_Pacco || 1;

    if (pCrt > 1 && rem >= pCrt) {
        const c = Math.floor(rem / pCrt);
        rem %= pCrt;
        html += `<span class="unit-pill icon-box"><i class="bi bi-box-seam-fill u-icon"></i><b>${c}</b></span>`;
    }
    if (pPck > 1 && rem >= pPck) {
        const pk = Math.floor(rem / pPck);
        rem %= pPck;
        html += `<span class="unit-pill icon-pack"><i class="bi bi-archive-fill u-icon"></i><b>${pk}</b></span>`;
    }
    if (rem > 0 || html === '') {
        html += `<span class="unit-pill icon-piece"><i class="bi bi-gear-wide-connected u-icon"></i><b>${rem}</b></span>`;
    }
    return html;
}

// --- REALTIME SUBSCRIPTION ---
function setupRealtime() {
    if (inventorySubscription) return;
    inventorySubscription = dbClient
        .channel('public_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, payload => {
            // Ottimizzazione limiti Supabase: non ricaricare l'intero DB ogni volta, aggiorniamo solo i record specifici.
            const r = payload.new || payload.old;
            if (!r || !r.product_id || !r.warehouse_name) return;

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                if (!DB.inventory[r.product_id]) DB.inventory[r.product_id] = {};
                DB.inventory[r.product_id][r.warehouse_name] = r.quantity;
            } else if (payload.eventType === 'DELETE') {
                if (DB.inventory[r.product_id] && DB.inventory[r.product_id][r.warehouse_name] !== undefined) {
                    delete DB.inventory[r.product_id][r.warehouse_name];
                }
            }

            if (document.getElementById('page-dashboard').style.display === 'block') {
                renderDashboard();
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_draft_cucina' }, payload => {
            const r = payload.new || payload.old;
            if (!r || !r.product_id) return;

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                DAILY_DATA[r.product_id] = { tot: r.qty, c: r.c, pk: r.pk, ps: r.ps, lastUser: r.last_modified_by };
            } else if (payload.eventType === 'DELETE') {
                if (r.product_id === '00000000-0000-0000-0000-000000000000') {
                    // Dummy event for FULL flush
                    DAILY_DATA = {};
                } else {
                    delete DAILY_DATA[r.product_id];
                }
            }
            if (document.getElementById('page-dailylist').style.display === 'block') {
                const activeDept = document.querySelector('#dept-tabs .active')?.innerText || 'LAVAGGIO';
                renderDailyList(activeDept);
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_discrepancies' }, payload => {
            if (USER && USER.role === 'Admin') {
                checkNotifications();
                if (document.getElementById('modal-notifications').style.display === 'flex') {
                    openNotifications();
                }
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, payload => {
            if (document.getElementById('chat-drawer').classList.contains('active')) {
                fetchChat(); // Refresh chat list
            }
            if (payload.eventType === 'INSERT' && payload.new.user_name !== USER?.username) {
                const badge = document.getElementById('chat-badge');
                badge.style.display = 'block';
                badge.innerText = parseInt(badge.innerText || 0) + 1;
            }
        })
        .subscribe();
}



// --- ESPOSIZIONE GLOBALE (Per chiamate HTML onclick) ---
window.showLoader = showLoader;
window.renderQtyBadges = renderQtyBadges;
window.setupRealtime = setupRealtime;
