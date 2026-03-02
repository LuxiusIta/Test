async function loadInventoryData() {
    // Fetch explicit standard warehouses
    const { data: whData, error: whErr } = await dbClient.from('warehouses').select('*').order('name');
    if (!whErr && whData) {
        DB.warehouses = whData; // Now storing objects: {id, name, main_number}
    } else {
        DB.warehouses = [
            { name: 'M1', main_number: 1 }, { name: 'M2', main_number: 2 },
            { name: 'M3', main_number: 3 }, { name: 'M4', main_number: 4 },
            { name: 'M5', main_number: 5 }, { name: 'M6', main_number: 6 }
        ];
    }

    // Fetch actual inventory quantities
    const { data: inv, error } = await dbClient.from('inventory').select('*');
    if (error) { console.error(error); return; }
    DB.inventory = {};
    inv.forEach(row => {
        if (!DB.inventory[row.product_id]) DB.inventory[row.product_id] = {};
        DB.inventory[row.product_id][row.warehouse_name] = row.quantity;
    });
}

// --- ADMIN WAREHOUSES LOGIC ---
function renderAdminWarehouses() {
    const container = document.getElementById('admin-warehouses-list');
    container.innerHTML = '';

    DB.warehouses.forEach(w => {
        const wName = w.name;
        const card = document.createElement('div');
        card.className = 'cart-item-row';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        card.style.padding = '15px';

        card.innerHTML = `
                    <div style="font-size:18px; font-weight:bold; letter-spacing:1px; flex:1; color:white;">${wName}</div>
                    <button class="icon-btn" style="background:#111; border:1px solid #333; border-radius:4px; padding:5px 15px; font-size:12px; font-weight:bold;" onclick="promptRenameWarehouse('${wName}')">
                        <i class="bi bi-pencil-square"></i> RINOMINA
                    </button>
                `;
        container.appendChild(card);
    });
}

async function promptRenameWarehouse(oldName) {
    const { value: newName } = await Swal.fire({
        title: 'Rinomina Magazzino',
        input: 'text',
        inputValue: oldName,
        inputLabel: 'Nuovo Nome Magazzino',
        showCancelButton: true,
        confirmButtonText: 'Modifica',
        cancelButtonText: 'Annulla'
    });

    if (newName && newName.trim() !== '' && newName.trim() !== oldName) {
        showLoader(true);
        try {
            const cleanName = newName.trim();
            const { data, error } = await dbClient.rpc('admin_rename_warehouse', {
                p_old_name: oldName,
                p_new_name: cleanName
            });
            if (error) throw error;
            if (data && data.status === 'error') throw new Error(data.message);

            await loadInventoryData();
            renderAdminWarehouses();
            showLoader(false);
            Swal.fire('Aggiornato!', 'Magazzino rinominato con successo.', 'success');
        } catch (e) {
            showLoader(false);
            Swal.fire('Errore', e.message, 'error');
        }
    }
}

// --- LOGIN & AUTH ---
function renderDashboard() {
    const q = document.getElementById('dash-search').value.toLowerCase();
    const wh = document.getElementById('dash-wh-filter').value;
    const cat = document.getElementById('dash-cat-filter').value;
    const supp = (USER.role === 'Admin') ? document.getElementById('dash-supp-filter').value : 'ALL';
    const grid = document.getElementById('dashboard-grid');
    grid.innerHTML = '';

    let visibleIndex = 0;

    DB.products.forEach(p => {
        if (q && !p.Nome.toLowerCase().includes(q)) return;
        if (cat !== 'ALL' && p.Categoria !== cat) return;
        if (supp !== 'ALL' && p.Fornitore !== supp) return;

        const inv = DB.inventory[p.ID_Prodotto] || {};

        // Filtro visibilità selettiva per magazzino
        if (wh !== 'ALL' && !inv.hasOwnProperty(wh)) return;
        // Se guardiamo 'ALL', mostriamo solo i prodotti che hanno almeno un magazzino assegnato
        if (wh === 'ALL' && Object.keys(inv).length === 0) return;

        let total = 0;
        let whLabels = '';

        if (wh === 'ALL') {
            let whArr = [];
            // Trova mapping per emoji numerici: 1 -> 1️⃣
            const numToEmoji = { 1: '1️⃣', 2: '2️⃣', 3: '3️⃣', 4: '4️⃣', 5: '5️⃣', 6: '6️⃣', 7: '7️⃣', 8: '8️⃣', 9: '9️⃣', 0: '0️⃣' };

            DB.warehouses.forEach(w => {
                if (w.name !== 'Cucina' && inv.hasOwnProperty(w.name)) {
                    // Conta sempre le quantità per il magazzino se presenti
                    total += Number(inv[w.name] || 0);

                    // Mostra l'emoji numerica, se disponibile. Altrimenti le prime 2 lettere.
                    let displayStr = w.name.substring(0, 2);
                    if (w.main_number && numToEmoji[w.main_number]) {
                        displayStr = numToEmoji[w.main_number];
                    }
                    whArr.push(displayStr);
                }
            });

            if (whArr.length > 0) {
                whLabels = `<div style="font-size:14px; margin-top:-2px; margin-bottom:5px;"><span style="color:#aaa; font-size:12px; margin-right:4px;">Mag:</span>${whArr.join(' ')}</div>`;
            }
        } else {
            total = Number(inv[wh] || 0);
        }

        // Applica un ritardo a cascata per l'animazione d'ingresso
        const animDelay = Math.min(visibleIndex * 0.03, 0.5); // max ritardo 0.5s per evitare attese
        visibleIndex++;

        grid.innerHTML += `
                <div class="card-item animate-pop" style="animation-delay: ${animDelay}s">
                    ${p.URL_Immagine ? `<img src="${p.URL_Immagine}">` : ''}
                    <h4>${p.Nome}</h4>
                    ${wh === 'ALL' ? whLabels : ''}
                    <div class="stock-grid">${renderQtyBadges(total, p)}</div>
                    <div class="total-row ${total === 0 ? 'zero' : ''}">${total} <span style="font-size:12px; color:#888">pz</span></div>
                </div>`;
    });
    updateFiltersPreview();
}

function updateFiltersPreview() {
    try {
        const preview = document.getElementById('filters-preview');
        if (!preview) return;

        const q = document.getElementById('dash-search');
        const wh = document.getElementById('dash-wh-filter');
        const cat = document.getElementById('dash-cat-filter');
        const supp = document.getElementById('dash-supp-filter');

        let badges = [];

        if (q && q.value && q.value.trim() !== '') {
            badges.push(`<span class="filter-badge"><i class="bi bi-search"></i> ${q.value.trim()}</span>`);
        }

        if (wh && wh.value !== 'ALL' && wh.options && wh.options.length > 0 && wh.selectedIndex >= 0) {
            badges.push(`<span class="filter-badge" style="border-color:#4a90e2; color:#4a90e2">Mag: ${wh.options[wh.selectedIndex].text}</span>`);
        }
        if (cat && cat.value !== 'ALL' && cat.options && cat.options.length > 0 && cat.selectedIndex >= 0) {
            badges.push(`<span class="filter-badge" style="border-color:#50c878; color:#50c878">Cat: ${cat.options[cat.selectedIndex].text}</span>`);
        }
        if (supp && typeof USER !== 'undefined' && USER && USER.role === 'Admin' && supp.value !== 'ALL' && supp.options && supp.options.length > 0 && supp.selectedIndex >= 0) {
            badges.push(`<span class="filter-badge" style="border-color:#d4af37; color:#d4af37">Forn: ${supp.options[supp.selectedIndex].text}</span>`);
        }

        if (badges.length > 0) {
            preview.innerHTML = badges.join('');
        } else {
            preview.innerHTML = '<span style="font-size:11px; color:#666; font-style:italic">Tutti i prodotti</span>';
        }
    } catch (err) {
        console.error("Filter preview error:", err);
    }
}

function getQtyDisplay(qty, p) {
    let parts = []; let rem = qty;
    const pCrt = p.Pezzi_per_Cartone || 1; const pPck = p.Pezzi_per_Pacco || 1;
    if (pCrt > 1 && rem >= pCrt) { const c = Math.floor(rem / pCrt); rem %= pCrt; parts.push(`<div class="unit-box"><i class="bi bi-box-seam-fill i-box"></i> ${c} Ct</div>`); }
    if (pPck > 1 && rem >= pPck) { const pk = Math.floor(rem / pPck); rem %= pPck; parts.push(`<div class="unit-box"><i class="bi bi-archive-fill i-pack"></i> ${pk} Pk</div>`); }
    if (rem > 0 || parts.length === 0) { parts.push(`<div class="unit-box"><i class="bi bi-gear-wide-connected i-piece"></i> ${rem} Pz</div>`); }
    return parts.join(' ');
}


function printStock() {
    const q = document.getElementById('dash-search').value.toLowerCase();
    const wh = document.getElementById('dash-wh-filter').value;
    const cat = document.getElementById('dash-cat-filter').value;
    const supp = (USER.role === 'Admin') ? document.getElementById('dash-supp-filter').value : 'ALL';
    const dateStr = new Date().toLocaleDateString();

    let html = `<html><head><title>Giacenza ${wh}</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 30px; color: #1a1a1a; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            h1 { margin: 0; font-size: 28px; text-transform: uppercase; letter-spacing: 1px; }
            .info { text-align: right; color: #666; font-size: 14px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; border: 1px solid #000; }
            th { background: #f2f2f2; border: 1px solid #000; padding: 12px 8px; text-align: center; font-size: 11px; text-transform: uppercase; }
            td { border: 1px solid #ddd; padding: 8px; font-size: 13px; text-align: center; overflow-wrap: break-word; }
            tr:nth-child(even) { background: #f9f9f9; }
            .qty-box { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; }
            .unit-box { display: inline-flex; align-items: center; gap: 4px; border: 1px solid #ddd; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; background: #fff; white-space: nowrap; }
            .i-box { color: #D2691E; } .i-pack { color: #00BFFF; } .i-piece { color: #888; }
            .tot-pz { font-weight: bold; text-align: center; }
            @media print {
                body { padding: 0; }
                .no-print { display: none; }
                th { background: #eee !important; -webkit-print-color-adjust: exact; }
            }
        </style></head><body>
        <div class="header">
            <div><h1>GIACENZA</h1><div style="font-weight:bold; color:#555">${wh === 'ALL' ? 'TOTALE TUTTI I MAGAZZINI' : wh.toUpperCase()}</div></div>
            <div class="info">FILTRI: ${cat !== 'ALL' ? cat : 'Tutte le categorie'}${q ? ' | Cerca: ' + q : ''}<br>DATA: ${dateStr}</div>
        </div>
        <table><thead><tr>
            <th style="width:16%">Fornitore</th>
            <th style="width:14%">Magazzino</th>
            <th style="width:30%">Prodotto</th>
            <th style="width:30%">QuantitÃ </th>
            <th style="width:10%">Tot Pz</th>
        </tr></thead><tbody>`;


    DB.products.forEach(p => {
        if (q && !p.Nome.toLowerCase().includes(q)) return;
        if (cat !== 'ALL' && p.Categoria !== cat) return;
        if (supp !== 'ALL' && p.Fornitore !== supp) return;

        const inv = DB.inventory[p.ID_Prodotto] || {};

        // Filtro visibilità selettiva per magazzino
        if (wh !== 'ALL' && !inv.hasOwnProperty(wh)) return;
        if (wh === 'ALL' && Object.keys(inv).length === 0) return;

        if (wh === 'ALL') {
            let totalQty = 0; let presentIn = [];
            DB.warehouses.forEach(w => {
                if (w.name === 'Cucina') return;
                const qty = Number(inv[w.name] || 0);
                if (qty > 0) { totalQty += qty; presentIn.push(w.name); }
            });

            html += `<tr>
                    <td style="font-size:11px; color:#666">${p.Fornitore || '-'}</td>
                    <td style="font-weight:500; font-size:11px; color:var(--accent)">${presentIn.length > 0 ? presentIn.join(', ') : '-'}</td>
                    <td style="text-align:center"><b style="font-size:14px">${p.Nome}</b></td>
                    <td><div class="qty-box">${getQtyDisplay(totalQty, p)}</div></td>
                    <td class="tot-pz">${totalQty}</td>
                </tr>`;
        } else {
            const qty = Number(inv[wh] || 0);
            html += `<tr>
                    <td style="font-size:11px; color:#666">${p.Fornitore || '-'}</td>
                    <td style="font-weight:500">${wh}</td>
                    <td style="text-align:center"><b style="font-size:14px">${p.Nome}</b></td>
                    <td><div class="qty-box">${getQtyDisplay(qty, p)}</div></td>
                    <td class="tot-pz">${qty}</td>
                </tr>`;
        }
    });

    html += `</tbody></table></body></html>`;

    let frame = document.getElementById('print-frame');
    if (!frame) {
        frame = document.createElement('iframe');
        frame.id = 'print-frame';
        frame.style.display = 'none';
        document.body.appendChild(frame);
    }
    const doc = frame.contentWindow.document; doc.open(); doc.write(html); doc.close();
    frame.contentWindow.focus();
    setTimeout(() => frame.contentWindow.print(), 100);
}

// --- OPERAZIONI ---
let OP_CART = [];
let OP_ACTIVE_CAT = 'ALL';

function renderOperationsUI() {
    const sel = document.getElementById('op-type-select');
    sel.innerHTML = (USER.role === 'Admin') ?
        `<option value="ARRIVO_MERCE">🟩 ARRIVO MERCE (Carico)</option>
             <option value="TRASFERIMENTO">🔀 SPOSTAMENTO INTERNO</option>
             <option value="CARICO_CUCINA">🟥 CARICHI (Cucina)</option>
             <option value="CORREZIONE_ADMIN">⚙️ CORREZIONE INVENTARIO</option>` :
        `<option value="CARICO_CUCINA">🟥 CARICHI</option>`;

    updateOpTypeUI();
    renderOpCategoryChips();
    renderOpSearch();
    renderOpCart();
}

function updateOpTypeUI() {
    const type = document.getElementById('op-type-select').value;
    const sFrom = document.getElementById('op-from-wh');
    const sTo = document.getElementById('op-to-wh');

    const whOpts = DB.warehouses.filter(w => w.name !== 'Cucina').map(w => `<option value="${w.name}">${w.name}</option>`).join('');
    if (sFrom) sFrom.innerHTML = whOpts;
    if (sTo) sTo.innerHTML = whOpts;
}

function renderOpCategoryChips() {
    const div = document.getElementById('op-cat-chips');
    if (!div) return;
    let cats = ['ALL', ...new Set(DB.products.map(p => p.Categoria))].filter(Boolean);

    // Renderiza i bottoni solo la prima volta o se cambiano le categorie
    if (div.children.length !== cats.length) {
        div.innerHTML = cats.map(c => `
        <div class="tab-chip" data-cat="${c}" style="flex-shrink:0; font-size:12px; padding:4px 10px; min-width:auto; white-space:nowrap;"
             onclick="OP_ACTIVE_CAT='${c.replace(/'/g, "\\'")}'  ; renderOpCategoryChips(); renderOpSearch()">
                    ${c === 'ALL' ? 'TUTTI' : c}
        </div>`).join('');
    }

    // Aggiorna solo la classe active
    Array.from(div.children).forEach(chip => {
        const cat = chip.getAttribute('data-cat');
        if (cat === OP_ACTIVE_CAT) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });

    // Aggiorna label filtro attivo
    const lbl = document.getElementById('op-active-filter-label');
    if (lbl) {
        const name = OP_ACTIVE_CAT === 'ALL' ? 'TUTTI' : OP_ACTIVE_CAT;
        lbl.innerHTML = `FILTRO ATTIVO: <span style="color:var(--accent)">${name}</span>`;
    }
}

function renderOpSearch() {
    const q = document.getElementById('op-search').value.toLowerCase();
    const div = document.getElementById('op-prod-list');
    if (!div) return;
    div.innerHTML = '';
    const prods = DB.products.filter(p => {
        const matchesQuery = !q || p.Nome.toLowerCase().includes(q);
        const matchesCat = OP_ACTIVE_CAT === 'ALL' || p.Categoria === OP_ACTIVE_CAT;
        return matchesQuery && matchesCat;
    });

    if (prods.length === 0) {
        div.innerHTML = '<div style="text-align:center; padding:15px; color:#444; font-size:14px">Nessun prodotto trovato</div>';
        return;
    }

    let htmlStr = '';
    prods.forEach((p, idx) => {
        const delay = Math.min(idx * 0.03, 0.3); // Cap delay at 0.3s
        htmlStr += `
            <div class="prod-tile fade-in-list" style="animation-delay: ${delay}s; opacity: 0;" onclick='openQtyPopup(${JSON.stringify(p).replace(/'/g, "&#39;")}, "OP")'>
                <span><b>${p.Nome}</b></span>
                <i class="bi bi-chevron-right"></i>
            </div>`;
    });
    div.innerHTML = htmlStr;
}

function selectOpProduct(p, editIdx = -1) {
    const initialVal = (editIdx >= 0) ? OP_CART[editIdx].tot : 0;
    openQtyPopup(p, 'OPERATIONS', initialVal, editIdx);
}

function renderOpCart() {
    const div = document.getElementById('op-cart-list');
    const btn = document.getElementById('btn-confirm-op');
    const container = document.getElementById('op-cart-container');

    div.innerHTML = OP_CART.length ? '' : '<div style="color:#444; padding:20px; text-align:center">Lista vuota</div>';
    btn.style.display = OP_CART.length ? 'block' : 'none';

    if (window.innerWidth >= 769) {
        container.style.display = OP_CART.length ? 'block' : 'none';
    } else {
        container.style.display = '';
    }

    OP_CART.forEach((it, idx) => {
        const config = {
            ARRIVO_MERCE: { label: 'ENTRATA', color: '#2ecc71', icon: 'bi-arrow-down-circle-fill' },
            TRASFERIMENTO: { label: 'TRASF.', color: '#f1c40f', icon: 'bi-arrow-left-right' },
            CARICO_CUCINA: { label: 'USCITA', color: '#e74c3c', icon: 'bi-arrow-up-circle-fill' },
            CORREZIONE_ADMIN: { label: 'CORREZ.', color: '#3498db', icon: 'bi-wrench' }
        };
        const c = config[it.type] || config.TRASFERIMENTO;

        // Path pills
        let pathPills = '';
        if (it.type === 'CORREZIONE_ADMIN') {
            pathPills = `<span style="background:${c.color}22; color:${c.color}; padding:1px 7px; border-radius:3px; font-size:10px; font-family:'Teko'; letter-spacing:0.5px;">${it.to}</span>`;
        } else {
            const dest = it.type === 'CARICO_CUCINA' ? 'CUCINA' : it.to;
            pathPills = `<span style="background:${c.color}22; color:${c.color}; padding:2px 8px; border-radius:3px; font-size:12px; font-family:'Teko'; letter-spacing:0.5px;">${it.from}</span>
                    <i class="bi bi-chevron-right" style="color:${c.color}; font-size:8px;"></i>
                    <span style="background:${c.color}22; color:${c.color}; padding:2px 8px; border-radius:3px; font-size:12px; font-family:'Teko'; letter-spacing:0.5px;">${dest}</span>`;
        }

        // Qty pills
        let qtyPills = [];
        if (it.c > 0) qtyPills.push(`<span style="background:rgba(255,255,255,0.06); padding:2px 7px; border-radius:3px; border:1px solid rgba(255,255,255,0.1); font-size:13px; font-family:'Teko'; color:#aaa; display:inline-flex; align-items:center; gap:3px;"><i class="bi bi-box-seam-fill" style="color:var(--c-box); font-size:12px;"></i>${it.c}</span>`);
        if (it.pk > 0) qtyPills.push(`<span style="background:rgba(255,255,255,0.06); padding:2px 7px; border-radius:3px; border:1px solid rgba(255,255,255,0.1); font-size:13px; font-family:'Teko'; color:#aaa; display:inline-flex; align-items:center; gap:3px;"><i class="bi bi-archive-fill" style="color:var(--c-pack); font-size:12px;"></i>${it.pk}</span>`);
        if (it.ps > 0) qtyPills.push(`<span style="background:rgba(255,255,255,0.06); padding:2px 7px; border-radius:3px; border:1px solid rgba(255,255,255,0.1); font-size:13px; font-family:'Teko'; color:#aaa; display:inline-flex; align-items:center; gap:3px;"><i class="bi bi-gear-wide-connected" style="color:var(--c-piece)"></i>${it.ps}</span>`);

        div.innerHTML += `
        <div onclick='selectOpProduct(${JSON.stringify(it.p).replace(/'/g, "&#39;")}, ${idx})'
             style="cursor:pointer; margin-bottom:6px; border-radius:6px; background:${c.color}0D; border:1px solid ${c.color}30; border-left:3px solid ${c.color}; padding:10px 12px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
                <i class="bi ${c.icon}" style="color:${c.color}; font-size:22px; flex-shrink:0;"></i>
                <div style="flex:1; font-family:'Teko'; font-size:20px; color:white; letter-spacing:0.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${it.p.Nome}</div>
                <i class="bi bi-trash-fill" style="color:var(--danger); cursor:pointer; font-size:18px; flex-shrink:0; padding:3px; margin-right:-2px; opacity:0.8;" onclick="event.stopPropagation(); OP_CART.splice(${idx},1); renderOpCart()"
                   onmouseenter="this.style.opacity='1'" onmouseleave="this.style.opacity='0.8'"></i>
            </div>
            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:4px;">
                ${pathPills}
                <span style="color:#333; margin:0 2px;">|</span>
                ${qtyPills.join('')}
                <span style="background:rgba(255,215,0,0.12); padding:2px 8px; border-radius:3px; border:1px solid rgba(255,215,0,0.25); font-size:13px; font-family:'Teko'; font-weight:bold; color:var(--accent); display:inline-flex; align-items:center; gap:3px;"><i class="bi bi-gear-wide-connected" style="font-size:12px;"></i>TOT: ${it.tot}pz</span>
            </div>
        </div>`;
    });
}

function formatQtyStrHelper(qty, p) {
    if (!qty || qty === 0) return "0 Pz";
    let rem = qty; let det = [];
    const crt = Math.floor(rem / (p.Pezzi_per_Cartone || 1));
    if ((p.Pezzi_per_Cartone || 1) > 1 && crt > 0) { det.push(crt + " Ct"); rem %= (p.Pezzi_per_Cartone || 1); }
    const pck = Math.floor(rem / (p.Pezzi_per_Pacco || 1));
    if ((p.Pezzi_per_Pacco || 1) > 1 && pck > 0) { det.push(pck + " Pk"); rem %= (p.Pezzi_per_Pacco || 1); }
    if (rem > 0 || det.length === 0) det.push(rem + " Pz");
    return `${det.join(' ')} (Tot: ${qty})`;
}

async function submitOpMovements() {
    if (!OP_CART.length) return;

    const confirmResult = await Swal.fire({
        title: 'CONFERMA REGISTRAZIONE',
        text: 'Sei sicuro di aver controllato e inserito tutto bene?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: 'var(--accent)',
        cancelButtonColor: '#444',
        confirmButtonText: '<i class="bi bi-check-lg" style="color:black"></i> Sì, Conferma',
        cancelButtonText: 'No, Annulla',
        customClass: {
            popup: 'cantiere-swal',
            title: 'cantiere-swal-title',
            confirmButton: 'btn-neon',
            cancelButton: 'btn-neon'
        }
    });

    if (!confirmResult.isConfirmed) return;

    showLoader(true);
    const groups = {};
    OP_CART.forEach(x => {
        if (!groups[x.type]) groups[x.type] = [];
        groups[x.type].push({ prodId: x.p.ID_Prodotto, qty: x.tot, fromWh: x.from, toWh: x.to, qtyStr: formatQtyStrHelper(x.tot, x.p) });
    });

    const types = Object.keys(groups);
    try {
        for (let t of types) {
            const { error } = await dbClient.rpc('process_movement', { p_user: USER.username, p_type: t, p_items: groups[t] });
            if (error) throw error;
        }
        showLoader(false);
        OP_CART = [];
        renderOpCart();

        // Toggle back drawer on mobile if open
        if (window.innerWidth <= 768) {
            const cartDrawer = document.getElementById('op-cart-container');
            if (cartDrawer && cartDrawer.classList.contains('active')) {
                toggleCartDrawer();
            }
        }

        Swal.fire('Successo', 'Operazioni registrate', 'success');
    } catch (err) {
        showLoader(false); Swal.fire('Errore', err.message, 'error');
    }
}

function openQtyPopup(p, context, initialVal = 0, editIdx = -1) {
    window.tempP = p;
    const isDaily = (context === 'DAILY');
    const dailyData = isDaily ? DAILY_DATA[p.ID_Prodotto] : null;
    const val = dailyData?.tot || initialVal;

    let c = dailyData?.c || Math.floor(val / (p.Pezzi_per_Cartone || 1));
    let pk = dailyData?.pk || Math.floor((val % (p.Pezzi_per_Cartone || 1)) / (p.Pezzi_per_Pacco || 1));
    let ps = dailyData?.ps || (val % (p.Pezzi_per_Pacco || 1));

    let whEditHtml = '';
    const pCrt = p.Pezzi_per_Cartone || 1;
    const pPck = p.Pezzi_per_Pacco || 1;

    const buildWhRadioGrid = (radioName, selVal, onlyAvailable = false) => {
        let validWhs = DB.warehouses.filter(w => w.name !== 'Cucina');
        if (onlyAvailable) {
            validWhs = validWhs.filter(w => (DB.inventory[p.ID_Prodotto]?.[w.name] || 0) > 0);
        }

        if (validWhs.length === 0 && onlyAvailable) {
            return `<div style="text-align:center; padding:10px; color:#888; font-size:12px; font-style:italic; background:#111; border-radius:6px; border:1px solid #333;">Nessuna giacenza disponibile in nessun magazzino.</div>`;
        }

        return validWhs.map(w => {
            const disp = DB.inventory[p.ID_Prodotto]?.[w.name] || 0;
            let dispHtml = '';
            let rem = disp;
            if (pCrt > 1 && rem >= pCrt) { const c = Math.floor(rem / pCrt); rem %= pCrt; dispHtml += `<span style="color:var(--c-box); font-size:11px; margin-right:4px;"><i class="bi bi-box-seam-fill"></i> ${c}</span>`; }
            if (pPck > 1 && rem >= pPck) { const pk = Math.floor(rem / pPck); rem %= pPck; dispHtml += `<span style="color:var(--c-pack); font-size:11px; margin-right:4px;"><i class="bi bi-archive-fill"></i> ${pk}</span>`; }
            if (rem > 0 || dispHtml === '') { dispHtml += `<span style="color:#888; font-size:11px;"><i class="bi bi-gear-wide-connected"></i> ${rem}</span>`; }

            const isChecked = w.name === selVal ? 'checked' : '';
            const borderColor = isChecked ? 'var(--accent)' : '#333';

            return `
                    <label style="display:flex; justify-content:space-between; align-items:center; background:#1a1a1a; padding:8px 12px; border:1px solid ${borderColor}; border-radius:6px; cursor:pointer; margin-bottom:5px; transition:0.2s;" 
                           onclick="document.querySelectorAll('input[name=\\'${radioName}\\']').forEach(r => r.closest('label').style.borderColor='#333'); this.style.borderColor='var(--accent)'">
                        <div style="display:flex; align-items:center; gap:8px;">
                            <input type="radio" name="${radioName}" value="${w.name}" ${isChecked} style="accent-color:var(--accent); transform:scale(1.2);">
                            <b style="color:#fff; font-size:14px; text-transform:uppercase">${w.name}</b>
                        </div>
                        <div style="display:flex; align-items:center;">
                            <span style="font-size:10px; color:#555; margin-right:6px; text-transform:uppercase">Disp:</span>
                            ${dispHtml}
                            <b style="margin-left:6px; color:#fff; font-size:12px;">(${disp})</b>
                        </div>
                    </label>`;
        }).join('');
    };

    if (!isDaily && editIdx >= 0) {
        const item = OP_CART[editIdx];
        if (item.type === 'TRASFERIMENTO') {
            whEditHtml = `
                    <div style="margin-bottom:15px; text-align:left">
                        <div style="font-size:12px; color:var(--accent); margin-bottom:5px; font-weight:bold;">DA MAGAZZINO:</div>
                        <div style="max-height:140px; overflow-y:auto; margin-bottom:10px;">${buildWhRadioGrid('s-from', item.from, true)}</div>
                        <div style="font-size:12px; color:var(--accent); margin-bottom:5px; font-weight:bold;">A MAGAZZINO:</div>
                        <div style="max-height:140px; overflow-y:auto;">${buildWhRadioGrid('s-to', item.to, false)}</div>
                    </div>`;
        } else if (item.type === 'ARRIVO_MERCE' || item.type === 'CORREZIONE_ADMIN') {
            whEditHtml = `
                    <div style="margin-bottom:15px; text-align:left">
                        <div style="font-size:12px; color:var(--accent); margin-bottom:5px; font-weight:bold;">A MAGAZZINO:</div>
                        <div style="max-height:180px; overflow-y:auto;">${buildWhRadioGrid('s-to', item.to, false)}</div>
                    </div>`;
        } else if (item.type.includes('CUCINA')) {
            whEditHtml = `
                    <div style="margin-bottom:15px; text-align:left">
                        <div style="font-size:12px; color:var(--accent); margin-bottom:5px; font-weight:bold;">DAL MAGAZZINO:</div>
                        <div style="max-height:180px; overflow-y:auto;">${buildWhRadioGrid('s-from', item.from, true)}</div>
                    </div>`;
        }
    } else if (!isDaily && editIdx === -1) {
        const type = document.getElementById('op-type-select').value;

        // Cerca il primo magazzino disponibile per le operazioni di prelievo
        const availWhs = DB.warehouses.filter(w => w.name !== 'Cucina' && (DB.inventory[p.ID_Prodotto]?.[w.name] || 0) > 0);
        const defaultFromWh = availWhs.length > 0 ? availWhs[0].name : '';
        const defaultToWh = DB.warehouses.filter(w => w.name !== 'Cucina')[0]?.name || '';

        if (type === 'TRASFERIMENTO') {
            whEditHtml = `
                    <div style="margin-bottom:15px; text-align:left">
                        <div style="font-size:12px; color:var(--accent); margin-bottom:5px; font-weight:bold;">DA MAGAZZINO:</div>
                        <div style="max-height:140px; overflow-y:auto; margin-bottom:10px;">${buildWhRadioGrid('s-from', defaultFromWh, true)}</div>
                        <div style="font-size:12px; color:var(--accent); margin-bottom:5px; font-weight:bold;">A MAGAZZINO:</div>
                        <div style="max-height:140px; overflow-y:auto;">${buildWhRadioGrid('s-to', defaultToWh, false)}</div>
                    </div>`;
        } else if (type === 'ARRIVO_MERCE' || type === 'CORREZIONE_ADMIN') {
            whEditHtml = `
                    <div style="margin-bottom:15px; text-align:left">
                        <div style="font-size:12px; color:var(--accent); margin-bottom:5px; font-weight:bold;">A MAGAZZINO:</div>
                        <div style="max-height:180px; overflow-y:auto;">${buildWhRadioGrid('s-to', defaultToWh, false)}</div>
                    </div>`;
        } else if (type.includes('CUCINA')) {
            whEditHtml = `
                    <div style="margin-bottom:15px; text-align:left">
                        <div style="font-size:12px; color:var(--accent); margin-bottom:5px; font-weight:bold;">DAL MAGAZZINO:</div>
                        <div style="max-height:180px; overflow-y:auto;">${buildWhRadioGrid('s-from', defaultFromWh, true)}</div>
                    </div>`;
        }
    }

    Swal.fire({
        title: p.Nome,
        html: `${whEditHtml}<div class="swal-grid">
                ${p.Pezzi_per_Cartone > 1 ? `<div class="swal-field"><label><i class="bi bi-box-seam-fill" style="color:var(--c-box)"></i> CARTONI (x${p.Pezzi_per_Cartone})</label>
                    <div style="display:flex; align-items:center; gap:5px">
                        <div class="stepper-btn" onclick="st('s-c',-1)">-</div>
                        <input id="s-c" type="number" inputmode="numeric" pattern="[0-9]*" min="0" value="${c || ''}" oninput="uPT()">
                        <div class="stepper-btn" onclick="st('s-c',1)">+</div>
                    </div>
                </div>` : ''}
                ${p.Pezzi_per_Pacco > 1 ? `<div class="swal-field"><label><i class="bi bi-archive-fill" style="color:var(--c-pack)"></i> PACCHI (x${p.Pezzi_per_Pacco})</label>
                    <div style="display:flex; align-items:center; gap:5px">
                        <div class="stepper-btn" onclick="st('s-pk',-1)">-</div>
                        <input id="s-pk" type="number" inputmode="numeric" pattern="[0-9]*" min="0" value="${pk || ''}" oninput="uPT()">
                        <div class="stepper-btn" onclick="st('s-pk',1)">+</div>
                    </div>
                </div>` : ''}
                <div class="swal-field"><label><i class="bi bi-gear-wide-connected" style="color:var(--c-piece)"></i> SFUSI</label>
                    <div style="display:flex; align-items:center; gap:5px">
                        <div class="stepper-btn" onclick="st('s-ps',-1)">-</div>
                        <input id="s-ps" type="number" inputmode="numeric" pattern="[0-9]*" min="0" value="${ps || ''}" oninput="uPT()">
                        <div class="stepper-btn" onclick="st('s-ps',1)">+</div>
                    </div>
                </div>
            </div>
            <div style="margin-top:15px; font-size:22px; font-family:'Teko'; letter-spacing:1px; text-align:center">Totale: <i class="bi bi-gear-wide-connected" style="color:var(--accent)"></i> <b id="s-t" style="color:var(--accent)">${val}</b> pezzi</div>`,
        showCancelButton: true,
        confirmButtonText: 'CONFERMA',
        cancelButtonText: 'ANNULLA',
        preConfirm: () => {
            const tc = parseInt(document.getElementById('s-c')?.value || 0), tpk = parseInt(document.getElementById('s-pk')?.value || 0), tps = parseInt(document.getElementById('s-ps')?.value || 0);
            const selFrom = document.querySelector('input[name="s-from"]:checked');
            const selTo = document.querySelector('input[name="s-to"]:checked');
            return {
                tot: (tc * (p.Pezzi_per_Cartone || 1)) + (tpk * (p.Pezzi_per_Pacco || 1)) + tps,
                c: tc, pk: tpk, ps: tps,
                from: selFrom ? selFrom.value : null,
                to: selTo ? selTo.value : null
            };
        }
    }).then(async res => {
        if (res.isConfirmed) {
            if (isDaily) {
                // Nuovo Salvataggio Live per Daily Draft
                const val = res.value;
                if (val.tot === 0) {
                    // Rimuovi dalla bozza se a 0
                    await dbClient.from('daily_draft_cucina').delete().eq('product_id', p.ID_Prodotto);
                } else {
                    // Invia Upsert a Supabase
                    await dbClient.from('daily_draft_cucina').upsert({
                        product_id: p.ID_Prodotto,
                        qty: val.tot, c: val.c, pk: val.pk, ps: val.ps,
                        last_modified_by: USER.username,
                        last_modified_at: new Date().toISOString()
                    }, { onConflict: 'product_id' });
                }
            } else {
                if (editIdx >= 0) {
                    OP_CART[editIdx].tot = res.value.tot; OP_CART[editIdx].c = res.value.c;
                    OP_CART[editIdx].pk = res.value.pk; OP_CART[editIdx].ps = res.value.ps;
                    if (res.value.from) OP_CART[editIdx].from = res.value.from;
                    if (res.value.to) OP_CART[editIdx].to = res.value.to;
                } else {
                    const type = document.getElementById('op-type-select').value;
                    // Prendi dal popup. Fallback: primo magazzino valido
                    const fallbackWh = DB.warehouses.filter(w => w.name !== 'Cucina')[0]?.name || 'FORNITORE';
                    const fromWh = res.value.from || (type === 'ARRIVO_MERCE' ? (p.Fornitore || 'FORNITORE') : fallbackWh);
                    const toWh = res.value.to || (type.includes('CUCINA') ? 'CONSUMO' : fallbackWh);

                    const existing = OP_CART.find(it => it.p.ID_Prodotto === p.ID_Prodotto && it.from === fromWh && it.to === toWh && it.type === type);
                    if (existing) {
                        existing.tot += res.value.tot; existing.c += res.value.c;
                        existing.pk += res.value.pk; existing.ps += res.value.ps;
                    } else {
                        OP_CART.push({ p, tot: res.value.tot, c: res.value.c, pk: res.value.pk, ps: res.value.ps, from: fromWh, to: toWh, type });
                    }
                }
                renderOpCart();
            }
        }
    });
}

function uPT() {
    const p = window.tempP;
    const cc = document.getElementById('s-c')?.value || 0;
    const pp = document.getElementById('s-pk')?.value || 0;
    const ss = document.getElementById('s-ps')?.value || 0;
    const tot = (parseInt(cc || 0) * (p.Pezzi_per_Cartone || 1)) + (parseInt(pp || 0) * (p.Pezzi_per_Pacco || 1)) + parseInt(ss || 0);
    document.getElementById('s-t').innerText = tot;
}

window.st = function (id, d) {
    const el = document.getElementById(id);
    if (!el) return;
    let v = parseInt(el.value || 0) + d;
    if (v < 0) v = 0;
    el.value = v;
    uPT();
}

// --- LISTA GIORNALIERA CUCINA ---

async function checkInitialDailyState() {
    // Scarica lo stato iniziale della bozza
    const { data, error } = await dbClient.from('daily_draft_cucina').select('*');
    if (error) return console.error("Error fetching draft info:", error);

    let needsAutoClose = false;
    if (data && data.length > 0) {
        const oldestRecord = new Date(Math.min(...data.map(d => new Date(d.last_modified_at).getTime())));
        const now = new Date();
        const diffHours = (now - oldestRecord) / (1000 * 60 * 60);

        // Se la bozza è più vecchia di 12 ore, avvia autochiusura
        if (diffHours > 12) {
            needsAutoClose = true;
        } else {
            // Popola localmente se fresca
            DAILY_DATA = {};
            data.forEach(r => {
                DAILY_DATA[r.product_id] = { tot: r.qty, c: r.c, pk: r.pk, ps: r.ps, lastUser: r.last_modified_by };
            });
        }
    } else {
        DAILY_DATA = {};
    }

    if (needsAutoClose) {
        console.log("Auto-closing old draft shift...");
        // Chiamata backend RPC di sicurezza
        await closeDailyShift(true);
    } else {
        const activeDept = document.querySelector('#dept-tabs .active')?.innerText || 'LAVAGGIO';
        renderDailyList(activeDept);
    }
}

function renderDailyList(dept) {
    document.getElementById('dept-tabs').innerHTML = ['LAVAGGIO', 'FRIGGITRICI', 'GRIGLIA', 'PANINI'].map(d => `<div class="tab-chip ${d === dept ? 'active' : ''}" onclick="renderDailyList('${d}')">${d}</div>`).join('');
    const div = document.getElementById('daily-list-body');

    // Animazione Fade-in
    div.classList.remove('fade-in-tab');
    void div.offsetWidth; // Trigger reflow
    div.classList.add('fade-in-tab');

    div.innerHTML = '';

    // Bottone Salva Report solo per Admin
    if (USER && USER.role === 'Admin') {
        div.innerHTML += `<button class="btn-neon" style="width:100%; margin-bottom:15px; background:var(--danger); border-color:var(--danger);" onclick="closeDailyShift()">CHIUDI TURNO (CREA REPORT DEFINITIVO)</button>`;
    }

    const prods = DB.products.filter(p => (p.Reparto || '').toUpperCase() === dept);

    if (!prods.length) { div.innerHTML += '<div style="text-align:center; padding:20px; color:#444">Nessun prodotto in questo reparto</div>'; return; }

    [...new Set(prods.map(p => p.Categoria))].forEach(cat => {
        const catName = (cat || 'ALTRO').toUpperCase();
        div.innerHTML += `<div class="cat-header" style="text-align:center; background:linear-gradient(90deg, transparent, rgba(255,215,0,0.1), transparent); color:var(--accent); border:none; border-bottom:1px solid var(--accent); padding-bottom:8px; margin-top:25px; margin-bottom:15px; font-size:18px; letter-spacing:2px; font-weight:bold;">${catName}</div>`;
        const catProds = prods.filter(p => p.Categoria === cat);
        const container = document.createElement('div');
        container.className = 'prod-btn-list';
        catProds.forEach(p => {
            const data = DAILY_DATA[p.ID_Prodotto];
            const val = (data?.tot !== undefined) ? data.tot : 0;
            let breakdownHTML = '';
            if (data) {
                let parts = [];
                if (data.c > 0) parts.push(`<span class="unit-pill"><i class="bi bi-box-seam-fill" style="color:var(--c-box)"></i> ${data.c}</span>`);
                if (data.pk > 0) parts.push(`<span class="unit-pill"><i class="bi bi-archive-fill" style="color:var(--c-pack)"></i> ${data.pk}</span>`);
                if (data.ps > 0) parts.push(`<span class="unit-pill"><i class="bi bi-gear-wide-connected" style="color:white"></i> ${data.ps}</span>`);

                let userStr = data.lastUser ? `<span style="font-size:11px; color:#aaa; font-style:italic; margin:0 8px; white-space:nowrap;">${data.lastUser}</span>` : '';

                let totPill = `<span class="unit-pill" style="background:#222; border-color:var(--accent); padding:4px 8px; margin-left:8px; white-space:nowrap;"><span style="color:#888; font-size:10px; margin-right:4px">TOT:</span><i class="bi bi-gear-wide-connected" style="color:var(--accent)"></i> <b style="color:var(--accent); font-size:15px;">${val}</b></span>`;

                breakdownHTML = `<div style="display:flex; align-items:center; justify-content:flex-end; flex-wrap:nowrap; overflow-x:auto;">
                                            ${userStr}
                                            <div style="display:flex; gap:4px; flex-wrap:nowrap;">${parts.join(' ')}</div>
                                            ${totPill}
                                        </div>`;
            } else {
                breakdownHTML = '<span style="color:#444; font-size:12px;">Non inserito</span>';
            }

            container.innerHTML += `
                    <div class="prod-btn" onclick='openQtyPopup(${JSON.stringify(p).replace(/'/g, "&#39;")}, "DAILY")' style="display:flex; flex-direction:row; justify-content:space-between; align-items:center; padding:12px; gap:10px;">
                        <span style="font-size:15px; letter-spacing:0.5px; flex-shrink:0;"><b>${p.Nome}</b></span>
                        <div style="display:flex; align-items:center; flex:1; justify-content:flex-end; overflow:hidden;">${breakdownHTML}</div>
                    </div>`;
        });
        div.appendChild(container);
    });
}

async function closeDailyShift(isAuto = false) {
    if (!isAuto && (!USER || USER.role !== 'Admin')) return;

    if (!isAuto) {
        if (!confirm("Avviare la chiusura del turno? Verrà generato il Report finale e svuotata la bozza del server.")) return;
        showLoader(true);
    }

    try {
        const operatorName = isAuto ? 'Salvataggio Automatico (Sistema)' : USER.username;
        const { data, error } = await dbClient.rpc('close_daily_shift', { p_user: operatorName });
        if (error) throw error;

        // Force flush local state and tell peers to flush via empty UPSERT hack or similar
        await dbClient.from('daily_draft_cucina').delete().not('product_id', 'is', null); // Triggers delete events for all

        DAILY_DATA = {};

        if (!isAuto) {
            showLoader(false);
            Swal.fire('Turno Chiuso!', 'Report definitivo salvato con successo. La dashboard del turno corrente è stata azzerata.', 'success');
            renderDailyList('LAVAGGIO');
        } else {
            Swal.fire({
                title: 'Avviso di Sistema',
                text: 'Trovato un Turno precedente rimasto in sospeso aperto da più di 12 ore. Salvato Report in automatico per protezione dati. Puoi ricominciare il nuovo turno in tranquillità!',
                icon: 'info'
            });
            renderDailyList('LAVAGGIO');
        }
    } catch (err) {
        if (!isAuto) showLoader(false);
        console.error("Shift Close Error:", err);
        Swal.fire('Errore Server', 'Controllare i log: ' + err.message, 'error');
    }
}

// Mantieni vecchio submitDaily vuoto per non rompere chiamate
function submitDaily() { closeDailyShift(false); }

// --- ADMIN FUNZIONI ---
async function loadMovementsLog() {
    showLoader(true);
    const { data: logs, error } = await dbClient.from('movements').select('*').order('created_at', { ascending: false }).limit(100);
    showLoader(false);
    if (error) return console.error(error);
    const tbody = document.getElementById('mov-log-body'); tbody.innerHTML = '';
    logs.forEach(l => {
        const dt = new Date(l.created_at).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });
        const pInfo = DB.products.find(x => x.Nome === l.product_name) || { Pezzi_per_Cartone: 1, Pezzi_per_Pacco: 1 };
        const tot = l.qty_string.match(/Tot:\s*(\d+)/)?.[1] || 0;
        tbody.innerHTML += `<tr>
                <td style="text-align:left">${dt}</td>
                <td style="text-align:center"><span class="badge-type ${l.type.includes('CUCINA') ? 'badge-red' : 'badge-green'}">${l.type}</span></td>
                <td style="text-align:left"><b style="color:white">${l.product_name}</b></td>
                <td style="text-align:center">${renderQtyBadges(parseInt(tot), pInfo)}</td>
                <td style="text-align:center"><i class="bi bi-gear-wide-connected" style="color:var(--accent)"></i> <b>${tot}</b></td>
                <td style="text-align:center"><span style="color:#888">${l.from_wh}</span> <i class="bi bi-arrow-right-circle-fill" style="color:var(--accent); font-size:12px"></i> <span style="color:#888">${l.to_wh}</span></td>
                <td style="font-size:11px; color:#666; text-align:right">${l.user_name}</td>
            </tr>`;
    });
}

async function loadReports() {
    showLoader(true);
    const supp = document.getElementById('report-supp-filter').value;
    const { data: reports, error } = await dbClient.from('daily_reports').select('*').order('date', { ascending: false }).limit(50);
    showLoader(false);
    if (error) return console.error(error);

    ALL_REPORTS = reports.map(r => ({
        date: new Date(r.date).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }),
        mod: r.last_modified_at ? new Date(r.last_modified_at).toLocaleString('it-IT', { timeStyle: 'short' }) : '',
        user: r.last_modified_by || r.created_by,
        items: r.details || []
    }));

    const div = document.getElementById('report-view-body');
    const filtered = ALL_REPORTS.filter(r => (supp === 'ALL' ? true : r.items.some(it => it.supp === supp)));

    div.innerHTML = '';

    // Add "Filtro applicato" badge if not viewing all
    if (supp !== 'ALL') {
        div.innerHTML += `
                <div style="background: rgba(255, 215, 0, 0.1); border: 1px dashed var(--accent); border-radius: 8px; padding: 10px; margin-bottom: 20px; text-align: center; color: var(--accent); font-size: 14px; font-weight: bold; letter-spacing: 1px; display: flex; justify-content: center; align-items: center; gap: 8px;">
                    <i class="bi bi-funnel-fill"></i> FILTRO APPLICATO: <span style="color: white; font-size:16px;">${supp.toUpperCase()}</span>
                </div>`;
    }

    if (filtered.length === 0) {
        div.innerHTML += `<div style="text-align:center; padding:20px; color:#666; font-style:italic">Nessun report trovato per questo filtro.</div>`;
        return;
    }

    filtered.forEach((r, idx) => {
        div.innerHTML += `
                <div class="prod-btn" style="border-left: 4px solid var(--accent); border-radius: 8px; justify-content:space-between; align-items:center; cursor:pointer; padding: 12px 15px;" onclick="openReportDetail(${ALL_REPORTS.indexOf(r)})">
                    <div style="background:rgba(255, 215, 0, 0.1); padding:8px 10px; border-radius:8px; display:flex; align-items:center; justify-content:center;">
                        <i class="bi bi-file-earmark-bar-graph" style="color:var(--accent); font-size:22px;"></i>
                    </div>
                    
                    <div style="display:flex; flex-direction:column; flex-grow:1; text-align:center; align-items:center;">
                        <b style="font-size:24px; letter-spacing:1.5px; color:white; font-family:'Teko'; line-height:1;">${r.date.split(',')[0]}</b>
                        <span style="font-size:12px; color:#aaa; margin-top:4px; display:flex; align-items:center; gap:8px;">
                            <span><i class="bi bi-clock"></i> ${r.date.split(',')[1] ? r.date.split(',')[1].trim() : ''}</span> 
                            <span style="color:#555;">|</span>
                            <span><i class="bi bi-person"></i> ${r.user.split('@')[0]}</span>
                        </span>
                    </div>

                    <div style="width:24px; display:flex; justify-content:flex-end;">
                        <i class="bi bi-chevron-right" style="color:#555; font-size:20px;"></i>
                    </div>
                </div>`;
    });
}

function openReportDetail(idx) {
    const r = ALL_REPORTS[idx]; if (!r) return;
    window.currentReport = r;
    const suppFilter = document.getElementById('report-supp-filter').value;
    const grouped = {};
    r.items.forEach(it => {
        if (suppFilter !== 'ALL' && it.supp !== suppFilter) return;
        if (!grouped[it.supp]) grouped[it.supp] = [];
        grouped[it.supp].push(it);
    });

    // let modInfo = r.mod ? `<div style="font-size:12px; color:#555; text-align:center; padding-bottom:10px;">Ultima mod: ${r.mod} (da ${r.user})</div>` : '';
    // Rimosso volutamente
    let h = `<div style="text-align:center"><h2 class="hide-print" style="color:var(--accent); font-family:'Teko'; border-bottom:1px solid #333; padding-bottom:5px; margin-bottom:5px;">REPORT ${r.date}</h2></div>`;

    const supps = Object.keys(grouped);
    if (supps.length === 0) h += `<div style="text-align:center; padding:40px; color:#888">Nessun dato</div>`;

    const rowColors = [
        { head: '#bbdefb', prod: '#e3f2fd', break: '#f5faff' },
        { head: '#c8e6c9', prod: '#e8f5e9', break: '#f1f8e9' },
        { head: '#fff9c4', prod: '#fffde7', break: '#fffef0' }
    ];

    supps.forEach((s, sIdx) => {
        const theme = rowColors[sIdx % rowColors.length];
        h += `<div style="width:100%; max-width:500px; margin: 20px auto 0 auto; min-height:36px; display:flex; align-items:center; justify-content:center; background:${theme.head}; color:#000; font-family:'Teko', sans-serif; font-size:22px; font-weight:bold; letter-spacing:8px; text-transform:uppercase; text-align:center;">${s}</div><div style="width:100%; max-width:500px; margin: 0 auto 15px auto; color:#000">`;
        grouped[s].forEach((it, i) => {
            const p = DB.products.find(x => x.ID_Prodotto == it.pid) || { Nome: it.name, Pezzi_per_Cartone: 1, Pezzi_per_Pacco: 1 };
            const isLast = i === grouped[s].length - 1;
            const userBadge = it.lastUser ? `<span style="font-size:10px; color:#666; display:block">(${it.lastUser})</span>` : '';

            // Calcolo Real Scorte: ora include tutto (non c'è più il magazzino finto CUCINA)
            let stockTot = 0;
            if (DB.inventory[it.pid]) {
                Object.keys(DB.inventory[it.pid]).forEach(wName => {
                    if (wName !== 'CONSUMO') stockTot += parseInt(DB.inventory[it.pid][wName] || 0);
                });
            }

            let sumTot = stockTot + it.qty;
            let sumDisplay = `<div style="display:flex; align-items:center; justify-content:center; gap:12px">
                                        <div class="qty-box" style="margin:0">${renderQtyBadges(sumTot, p)}</div>
                                        <b style="font-size:16px; font-family:'Teko'; letter-spacing:1px; background:rgba(0,0,0,0.1); padding:2px 10px; border-radius:10px">${sumTot} pz</b>
                                      </div>`;

            h += `<table style="width:100%; border-collapse:collapse; border:1px solid #000; margin:0; ${isLast ? '' : 'border-bottom:none'}">
                        <tr style="background:${theme.prod}">
                            <td style="padding:4px; font-size:13px; font-weight:bold; border-bottom:1px solid #000; border-right:1px solid #000; text-align:center; width:30%; vertical-align:middle;">${p.Nome}${userBadge}</td>
                            <td style="padding:4px; text-align:center; font-size:12px; border-bottom:1px solid #000; border-right:1px dotted #888; width:35%;">
                               <span style="color:#555; font-size:9px; display:block; line-height:1; margin-bottom:4px; text-transform:uppercase; font-weight:bold">Cucina</span>
                               <div class="qty-box" style="margin:0 0 4px 0; justify-content:center; gap:2px">${renderQtyBadges(it.qty, p)}</div>
                               <b style="font-size:14px; background:rgba(0,0,0,0.1); padding:2px 8px; border-radius:10px">${it.qty} pz</b>
                            </td>
                            <td style="padding:4px; text-align:center; font-size:12px; border-bottom:1px solid #000; width:35%; background:rgba(0,0,0,0.03)">
                               <span style="color:#2277bb; font-size:9px; display:block; line-height:1; margin-bottom:4px; text-transform:uppercase; font-weight:bold">Magazzino</span>
                               <div class="qty-box" style="margin:0 0 4px 0; justify-content:center; gap:2px">${renderQtyBadges(stockTot, p)}</div>
                               <b style="color:#2277bb; font-size:14px; background:rgba(34,119,187,0.1); padding:2px 8px; border-radius:10px">${stockTot} pz</b>
                            </td>
                        </tr>
                        <tr style="background:${theme.break}">
                            <td colspan="3" style="padding:6px; text-align:center; font-size:12px;">
                                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%;">
                                   <span style="font-size:10px; color:#555; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px">Totale Confronto</span>
                                   ${sumDisplay}
                                </div>
                            </td>
                        </tr>
                      </table>`;
        });
        h += `</div>`;
    });
    document.getElementById('report-print-content').innerHTML = h;
    document.getElementById('modal-report-print').style.display = 'flex';
}

function printReportDiv() {
    const r = window.currentReport;
    if (!r) return;
    const content = document.getElementById('report-print-content').innerHTML;

    // Generate full HTML for printing (Monochromatic professional style)
    const html = `<html><head><title>Report ${r.date}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
            <style>
                @page { size: auto; margin: 0; }
                body { font-family: 'Arial', sans-serif; padding: 15mm; color: black; background: white; margin:0; }
                .hide-print { display: none !important; }
                h1 { color: #000; text-align: center; font-size: 20px; font-weight: bold; margin-bottom:25px; text-transform:uppercase; border-bottom:2px solid black; padding-bottom:10px; }
                /* Override UI colors for print */
                div[style*="background"] { background: white !important; color: black !important; border: 1px solid black !important; margin-bottom: 5px !important; }
                div[style*="color:#888"] { color: black !important; font-size: 11px !important; }
                table { margin-bottom: 20px !important; border-collapse: collapse !important; width: 100% !important; border-bottom:1px solid #000 !important; }
                tr, td { border: 1px solid black !important; padding:4px !important; }
                /* Forza larghezze fisse sulle 3 colonne per mantenere l'impaginazione */
                td[style*="width:30%"] { width: 30% !important; }
                td[style*="width:35%"] { width: 35% !important; }
                
                td { vertical-align: middle !important; }
                
                /* Correzioni specifiche per il layout a tre righe su carta */
                .qty-box { width: auto !important; display:inline-flex !important; flex-wrap:nowrap !important; justify-content:center !important; align-items:center !important; border:none !important; text-align:center; padding:0 !important; margin: 0 !important; gap:2px !important; }
                .qty-box span { display: inline-flex !important; align-items:center !important; padding: 2px 4px !important; border: 1px solid #000 !important; font-size: 11px !important; font-weight:bold !important; border-radius:3px !important; margin: 0 !important;}
                .qty-box b { border: none !important; margin:0 !important; padding: 0 !important; }
                
                /* Forza il Total Confronto a non andare a capo */
                td[colspan="3"] div, td[colspan="3"] b { display: inline-block !important; vertical-align: middle !important; white-space: nowrap !important; line-height: 1 !important; margin: 0 !important; padding: 0 !important; }
                td[colspan="3"] b { font-size: 14px !important; margin-left: 6px !important; border-radius: 0 !important; border: none !important; background: transparent !important; }
                
                i { color: black !important; } /* Show icons but color them black for printer */
                
                /* Testo colorato convertito per stampa B/N o chiara */
                span[style*="color:#2ecc71"], span[style*="color:#e74c3c"] { color: #000 !important; font-weight: bold !important; border: 1px solid #000; padding: 2px 5px; }
            </style></head><body>
            <h1>REPORT GIORNALIERO: ${r.date}</h1>
            ${content}
            </body></html>`;

    let frame = document.getElementById('print-frame');
    if (!frame) {
        frame = document.createElement('iframe');
        frame.id = 'print-frame';
        frame.style.display = 'none';
        document.body.appendChild(frame);
    }
    const doc = frame.contentWindow.document; doc.open(); doc.write(html); doc.close();
    frame.contentWindow.focus();
    setTimeout(() => frame.contentWindow.print(), 300);
}

function renderAdminProds() {
    const q = document.getElementById('admin-prod-search').value.toLowerCase();
    const div = document.getElementById('admin-prod-list'); div.innerHTML = '<button class="btn-neon" style="font-size:18px; margin-bottom:20px" onclick="openUserModal()">+ NUOVO PRODOTTO</button>';
    const btn = document.createElement('button');
    btn.innerHTML = "+ NUOVO PRODOTTO";
    btn.className = "btn-neon";
    btn.style.marginBottom = "20px";
    btn.onclick = () => editProduct(null);
    div.innerHTML = '';
    div.appendChild(btn);

    const container = document.createElement('div'); container.className = 'prod-btn-list';
    DB.products.filter(p => p.Nome.toLowerCase().includes(q)).forEach(p => {
        container.innerHTML += `
                <div class="prod-btn" onclick="editProduct('${p.ID_Prodotto}')">
                    <div style="display:flex; flex-direction:column">
                        <b>${p.Nome}</b>
                        <small style="color:#666; font-size:11px">${p.Categoria || 'Senza Categoria'}</small>
                    </div>
                    <i class="bi bi-pencil" style="color:var(--accent)"></i>
                </div>`;
    });
    div.appendChild(container);
}

function editProduct(pid) {
    const p = DB.products.find(x => x.ID_Prodotto == pid) || { Nome: '', Categoria: '', Fornitore: '', Pezzi_per_Cartone: 1, Pezzi_per_Pacco: 1, Reparto: '' };

    const whCheckboxes = DB.warehouses.filter(w => w.name !== 'Cucina').map(w => {
        const isChecked = (pid && DB.inventory[pid] && DB.inventory[pid].hasOwnProperty(w.name)) ? 'checked' : '';
        return `<label style="display:flex; align-items:center; gap:8px; font-size:14px; text-transform:none; color:#ccc"><input type="checkbox" class="wh-chk" value="${w.name}" ${isChecked} style="width:18px; height:18px"> ${w.name}</label>`;
    }).join('');

    document.getElementById('edit-form-content').innerHTML = `
            <div style="max-height:60vh; overflow-y:auto; padding-right:10px">
                <div class="modal-form-group"><label>NOME PRODOTTO</label><input id="edt-name" class="dark-input" value="${p.Nome}" autocomplete="off"></div>
                <div class="modal-form-group"><label>CATEGORIA</label><input id="edt-cat" class="dark-input" value="${p.Categoria}" autocomplete="off"></div>
                <div class="modal-form-group"><label>FORNITORE</label><input id="edt-supp" class="dark-input" value="${p.Fornitore}" autocomplete="off"></div>
                <div class="modal-form-group"><label>REPARTO (es. LAVAGGIO)</label><input id="edt-rep" class="dark-input" value="${p.Reparto}" autocomplete="off"></div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px">
                    <div class="modal-form-group"><label><i class="bi bi-box-seam-fill"></i> Cartoni</label><input id="edt-pct" type="number" class="dark-input" value="${p.Pezzi_per_Cartone}"></div>
                    <div class="modal-form-group"><label><i class="bi bi-archive-fill"></i> Pacchi</label><input id="edt-ppk" type="number" class="dark-input" value="${p.Pezzi_per_Pacco}"></div>
                </div>
                <div class="modal-form-group" style="margin-top:15px; background:rgba(255,255,255,0.05); padding:15px; border-radius:6px; border:1px solid #333">
                    <label style="color:var(--accent); margin-bottom:10px"><i class="bi bi-eye"></i> VISIBILITÀ MAGAZZINI</label>
                    <div style="font-size:11px; color:#888; font-style:italic; text-transform:none; margin-bottom:10px; line-height:1.2">Seleziona in quali magazzini questo prodotto deve apparire fisso sulla Dashboard (anche a quantità zero).</div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">${whCheckboxes}</div>
                </div>
            </div>`;
    window.editingPid = pid;
    document.getElementById('modal-edit-prod').style.display = 'flex';
}

async function saveProductEdits() {
    showLoader(true);
    const updates = {
        nome: document.getElementById('edt-name').value,
        categoria: document.getElementById('edt-cat').value,
        fornitore: document.getElementById('edt-supp').value,
        reparto: document.getElementById('edt-rep').value.toUpperCase(),
        pezzi_per_cartone: parseInt(document.getElementById('edt-pct').value || 1),
        pezzi_per_pacco: parseInt(document.getElementById('edt-ppk').value || 1)
    };
    try {
        let prodId = window.editingPid;
        if (prodId) {
            await dbClient.from('products').update(updates).eq('id', prodId);
        } else {
            const { data: newP, error: iErr } = await dbClient.from('products').insert(updates).select('id').single();
            if (iErr) throw iErr;
            prodId = newP.id;
        }

        // Assegna esplicitamente magazzini per visibilità
        const selectedWh = Array.from(document.querySelectorAll('.wh-chk:checked')).map(c => c.value);
        const { error: asErr } = await dbClient.rpc('admin_assign_product_warehouses', { p_prod_id: prodId, p_warehouses: selectedWh });
        if (asErr) throw asErr;

        // Ricarica la cache inventario così che gli `0` freschi compaiano sulla dashboard
        await loadInventoryData();

        // Aggiorna la cache dei prodotti dopo la modifica
        const { data: prods } = await dbClient.from('products').select('*');
        if (prods) {
            DB.products = prods.map(p => ({
                ID_Prodotto: p.id, Nome: p.nome, Categoria: p.categoria, Fornitore: p.fornitore,
                Reparto: p.reparto, Pezzi_per_Cartone: p.pezzi_per_cartone, Pezzi_per_Pacco: p.pezzi_per_pacco,
                URL_Immagine: p.url_immagine
            }));
        }

        showLoader(false); closeModal('modal-edit-prod'); nav('admin-products');
    } catch (err) { showLoader(false); Swal.fire('Errore', err.message, 'error'); }
}

let allMismatchProds = [];

function openMismatchModal() {
    const whSelect = document.getElementById('mismatch-warehouse');
    document.getElementById('mismatch-notes').value = '';
    document.getElementById('mismatch-search').value = '';

    // Cache products for search
    allMismatchProds = [...DB.products].sort((a, b) => a.Nome.localeCompare(b.Nome));
    renderMismatchProds(allMismatchProds);

    // Populate warehouses
    const validWh = DB.warehouses.filter(w => w.name !== 'Cucina');
    whSelect.innerHTML = '<option value="">-- Seleziona Magazzino --</option>' +
        validWh.map(w => `<option value="${w.name}">${w.name}</option>`).join('');

    document.getElementById('modal-mismatch').style.display = 'flex';
}

function filterMismatchProds() {
    const q = document.getElementById('mismatch-search').value.toLowerCase();
    const filtered = allMismatchProds.filter(p => p.Nome.toLowerCase().includes(q));
    renderMismatchProds(filtered, q !== '');
}

function renderMismatchProds(list, isSearching = false) {
    const sel = document.getElementById('mismatch-product');
    sel.innerHTML = '<option value="">-- Seleziona Prodotto --</option>' +
        list.map(p => `<option value="${p.ID_Prodotto}">${p.Nome}</option>`).join('');

    if (isSearching && list.length > 0) {
        sel.selectedIndex = 1; // Auto-select the first found product
    }
}

async function submitMismatch() {
    const prodId = document.getElementById('mismatch-product').value;
    const wh = document.getElementById('mismatch-warehouse').value;
    const notes = document.getElementById('mismatch-notes').value.trim();

    if (!prodId || !wh || !notes) {
        return Swal.fire('Errore', 'Compila tutti i campi prima di inviare.', 'error');
    }

    const pInfo = DB.products.find(x => x.ID_Prodotto === prodId);
    const pName = pInfo ? pInfo.Nome : 'Sconosciuto';

    showLoader(true);
    try {
        const { error } = await dbClient.from('inventory_discrepancies').insert({
            product_id: prodId,
            product_name: pName,
            warehouse_name: wh,
            notes: notes,
            reported_by: USER ? USER.username : 'Unknown'
        });

        if (error) throw error;

        showLoader(false);
        closeModal('modal-mismatch');
        Swal.fire('Inviato', 'Segnalazione registrata con successo. Grazie.', 'success');
    } catch (err) {
        showLoader(false);
        console.error(err);
        Swal.fire('Errore', 'Impossibile inviare la segnalazione. Assicurati che l\'admin abbia creato la tabella.', 'error');
    }
}

// --- ADMIN NOTIFICATIONS ---

// --- ESPOSIZIONE GLOBALE (Per chiamate HTML onclick) ---
window.loadInventoryData = loadInventoryData;
window.renderAdminWarehouses = renderAdminWarehouses;
window.promptRenameWarehouse = promptRenameWarehouse;
window.renderDashboard = renderDashboard;
window.updateFiltersPreview = updateFiltersPreview;
window.printStock = printStock;
window.getQtyDisplay = getQtyDisplay;
window.renderOperationsUI = renderOperationsUI;
window.updateOpTypeUI = updateOpTypeUI;
window.renderOpCategoryChips = renderOpCategoryChips;
window.renderOpSearch = renderOpSearch;
window.selectOpProduct = selectOpProduct;
window.renderOpCart = renderOpCart;
window.formatQtyStrHelper = formatQtyStrHelper;
window.submitOpMovements = submitOpMovements;
window.openQtyPopup = openQtyPopup;
window.uPT = uPT;
window.st = st;
window.checkInitialDailyState = checkInitialDailyState;
window.renderDailyList = renderDailyList;
window.closeDailyShift = closeDailyShift;
window.submitDaily = submitDaily;
window.loadMovementsLog = loadMovementsLog;
window.loadReports = loadReports;
window.openReportDetail = openReportDetail;
window.printReportDiv = printReportDiv;
window.renderAdminProds = renderAdminProds;
window.editProduct = editProduct;
window.saveProductEdits = saveProductEdits;
window.openMismatchModal = openMismatchModal;
window.filterMismatchProds = filterMismatchProds;
window.renderMismatchProds = renderMismatchProds;
window.submitMismatch = submitMismatch;

