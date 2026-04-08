/**

 * PS4 Core - Professional Remote Manager (500-Error-Tolerant Build)

 */



const GITHUB_URL = './games.json';

function toggleInputVisibility(id, btn) {

    const input = document.getElementById(id);

    if (!input) return;

    const isHidden = input.type === 'password';

    input.type = isHidden ? 'text' : 'password';

    const icon = btn.querySelector('i');

    if (icon) icon.className = isHidden ? 'ri-eye-line' : 'ri-eye-off-line';

}



let allGames = [];

let connectionTimeout;

let heartbeatInterval;



let ipInput;

let connectionBox;



// --- 1. THE RELENTLESS HEARTBEAT (500-ERROR-TOLERANT) ---



function initConnectionManager() {

    ipInput = document.getElementById('ps4-ip');

    connectionBox = document.getElementById('ps4-box');

    

    if (!ipInput || !connectionBox) return;

    

    const savedIp = localStorage.getItem('ps4-last-ip');

    if (savedIp) {

        ipInput.value = savedIp;

        startHeartbeat(savedIp);

    }



    const rdInput = document.getElementById('rd-token');

    if (rdInput) {

        const savedToken = localStorage.getItem('rd-api-token');

        if (savedToken) {

            rdInput.value = savedToken;

            validateRdToken(savedToken);

        }

        rdInput.addEventListener('input', (e) => {

            localStorage.setItem('rd-api-token', e.target.value.trim());

        });

        rdInput.addEventListener('keydown', (e) => {

            if (e.key !== 'Enter') return;

            localStorage.setItem('rd-api-token', rdInput.value.trim());

            rdInput.blur();

            validateRdToken(rdInput.value.trim());

        });

        rdInput.addEventListener('blur', () => {

            const token = rdInput.value.trim();

            localStorage.setItem('rd-api-token', token);

            if (token) validateRdToken(token);

            else setRdBoxState('idle');

        });

    }



    ipInput.addEventListener('input', (e) => {

        const ip = e.target.value.trim();

        localStorage.setItem('ps4-last-ip', ip);

        clearTimeout(connectionTimeout);

        clearInterval(heartbeatInterval);

        

        if (ip.length < 7) {

            connectionBox.className = 'connection-box';

            connectionBox.style.borderColor = '';

            connectionBox.style.boxShadow = '';

            return;

        }



        connectionBox.className = 'connection-box waiting';

        connectionBox.style.borderColor = '';

        connectionBox.style.boxShadow = '';

        connectionTimeout = setTimeout(() => {

            startHeartbeat(ip);

        }, 1200);

    });



    ipInput.addEventListener('keydown', (e) => {

        if (e.key !== 'Enter') return;

        const ip = ipInput.value.trim();

        localStorage.setItem('ps4-last-ip', ip);

        ipInput.blur();

        clearTimeout(connectionTimeout);

        clearInterval(heartbeatInterval);

        if (ip.length >= 7) {

            connectionBox.className = 'connection-box waiting';

            connectionBox.style.borderColor = '';

            connectionBox.style.boxShadow = '';

            startHeartbeat(ip);

        } else {

            connectionBox.className = 'connection-box';

            connectionBox.style.borderColor = '';

            connectionBox.style.boxShadow = '';

        }

    });



    ipInput.addEventListener('blur', () => {

        const ip = ipInput.value.trim();

        localStorage.setItem('ps4-last-ip', ip);

        clearTimeout(connectionTimeout);

        clearInterval(heartbeatInterval);

        if (ip.length >= 7) {

            connectionBox.className = 'connection-box waiting';

            connectionBox.style.borderColor = '';

            connectionBox.style.boxShadow = '';

            startHeartbeat(ip);

        } else {

            connectionBox.className = 'connection-box';

            connectionBox.style.borderColor = '';

            connectionBox.style.boxShadow = '';

        }

    });

}



function setRdBoxState(state) {

    const box = document.getElementById('rd-box');

    if (!box) return;

    if (state === 'valid') {

        box.style.borderColor = '#00ff88';

        box.style.boxShadow = '0 0 18px rgba(0,255,136,0.45)';

    } else if (state === 'invalid') {

        box.style.borderColor = '#ff3c3c';

        box.style.boxShadow = '0 0 18px rgba(255,60,60,0.45)';

    } else {

        box.style.borderColor = '';

        box.style.boxShadow = '';

    }

}



async function validateRdToken(token) {

    if (!token) { setRdBoxState('idle'); return; }

    setRdBoxState('idle');

    try {

        const res = await fetch(`https://clinquant-queijadas-57cd07.netlify.app/api/rd/user?auth_token=${encodeURIComponent(token)}`);

        setRdBoxState(res.ok ? 'valid' : 'invalid');

    } catch {

        setRdBoxState('invalid');

    }

}



function startHeartbeat(ip) {

    clearInterval(heartbeatInterval);

    checkPS4Status(ip); // Instant check

    heartbeatInterval = setInterval(() => {

        checkPS4Status(ip);

    }, 1000); // 5-second polling

}



async function checkPS4Status(ip) {

    if (!ip) return;



    const controller = new AbortController();

    const timeout = setTimeout(() => controller.abort(), 5000);



    try {

        await fetch(`http://${ip}:12800/`, {

            method: 'HEAD',

            signal: controller.signal

        });

        // Any response (including error status) means the port is alive.

        connectionBox.className = 'connection-box connected';

        connectionBox.style.borderColor = '#00ff88';

        connectionBox.style.boxShadow = '0 0 18px rgba(0,255,136,0.45)';

    } catch (err) {

        // Network error or timeout means the port is unreachable.

        connectionBox.className = 'connection-box failed';

        connectionBox.style.borderColor = '#ff3c3c';

        connectionBox.style.boxShadow = '0 0 18px rgba(255,60,60,0.45)';

    } finally {

        clearTimeout(timeout);

    }

}



// --- 2. DATABASE & RENDERING ---



function normalizePlatform(platform) {

    const p = (platform || '').toLowerCase();

    if (p.includes('playstation 4') || p.includes('ps4')) return 'PS4';

    if (p.includes('playstation 2') || p.includes('ps2')) return 'PS2';

    if (p.includes('playstation 1') || p.includes('ps1') || (p.includes('playstation') && !p.includes('2') && !p.includes('4'))) return 'PS1';

    return 'PS4';

}



function formatGameSize(size) {

    // Handle various size formats and clean them up

    if (!size || size === "N/A" || size === "" || size === null) return "N/A";

    

    const sizeStr = String(size).trim().toLowerCase();

    

    // If already has GB/MB, return as is

    if (sizeStr.includes('gb') || sizeStr.includes('mb') || sizeStr.includes('tb')) {

        return sizeStr.replace(/\s+/g, ' ').replace(/(gb|mb|tb)/i, ' $1').trim().toUpperCase();

    }

    

    // Try to parse as number

    const num = parseFloat(sizeStr);

    if (!isNaN(num) && num > 0) {

        if (num > 1024) {

            return (num / 1024).toFixed(1) + ' GB';

        } else if (num < 1) {

            return (num * 1024).toFixed(0) + ' MB';

        } else {

            return num.toFixed(1) + ' GB';

        }

    }

    

    return "N/A";

}



async function fetchGames() {

    const loaderText = document.querySelector('#loader p');

    const loader = document.getElementById('loader');

    const mainUI = document.getElementById('main-ui');

    try {

        const response = await fetch(GITHUB_URL);

        const data = await response.json();

        

        allGames = data.map(game => ({

            name: game["Game Name"] || game["Title"] || game["Name"] || "Unknown",

            genre: game["Genre"] || "Unknown",

            platform: normalizePlatform(game["Platform"] || game["Console"] || ""),

            size: formatGameSize(game["Game Size"] || game["Size"] || "N/A"),

            rawSize: parseFloat(game["Game Size"] || game["Size"] || "0") || 0,

            image: game["Image"] || "",

            update: game["Update"] || "v1.00",

            description: game["Description"] || "",

            links: Array.isArray(game["PKG_Links"]) ? game["PKG_Links"] : []

        }));



        window.allGames = allGames;

        applyFilters();

    } catch (error) {

        console.error('Fetch error:', error);

        if (loaderText) loaderText.innerText = "Sync Error: Check Internet";

    } finally {

        if (loader) loader.style.display = 'none';

        if (mainUI) mainUI.style.display = 'flex';

    }

}



function handleImageError(img, name) {

    if (!img.dataset.httpsRetried && img.src.startsWith('http://')) {

        img.dataset.httpsRetried = '1';

        img.src = img.src.replace('http://', 'https://');

        return;

    }

    img.onerror = null;

    const label = encodeURIComponent((name || 'No Art').substring(0, 22)).replace(/%20/g, '+');

    img.src = `https://placehold.co/400x250/1d143a/9d50ff?text=${label}`;

}



let _selectMode = false;

let _selectedKeys = new Set();



function renderGames(games) {

    const grid = document.getElementById('game-grid');

    if(!grid) return;

    grid.innerHTML = '';



    if (games.length === 0) {

        grid.innerHTML = '<p style="color:var(--text-dim);font-size:0.95rem;grid-column:1/-1;padding:40px 0;">No titles match your filters.</p>';

        return;

    }



    const favs  = JSON.parse(localStorage.getItem('ps4-favs') || '{}');

    const inst  = JSON.parse(localStorage.getItem('ps4-installed') || '{}');

    const notes = JSON.parse(localStorage.getItem('ps4-notes') || '{}');

    const isListView = grid.classList.contains('list-view');



    games.forEach((game) => {

        const card = document.createElement('div');

        card.className = 'game-card' + (isListView ? ' game-card-list' : '');

        const masterIndex = allGames.indexOf(game);

        const gkey = encodeURIComponent(game.name);

        const isFav  = !!favs[gkey];

        const isInst = !!inst[gkey];

        const hasNote = !!notes[gkey];

        const isSelected = _selectedKeys.has(gkey);



        if (isListView) {

            card.innerHTML = `

                <div class="list-card-select" style="display:${_selectMode ? 'flex' : 'none'}">

                    <input type="checkbox" class="list-card-checkbox" ${isSelected ? 'checked' : ''} onchange="selectGame('${gkey}')">

                </div>

                <img class="list-card-art" src="${game.image || 'data:,'}" referrerpolicy="no-referrer" onerror="handleImageError(this,${JSON.stringify(game.name)})" onclick="openDownloadModal(${masterIndex})">

                <div class="list-card-body" onclick="openDownloadModal(${masterIndex})">

                    <div class="list-card-title">${game.name}</div>

                    <div class="list-card-meta">

                        <span class="list-platform-badge">${game.platform}</span>

                        <span>${game.genre}</span>

                        <span><i class="ri-hard-drive-2-line"></i> ${game.size}</span>

                        ${hasNote ? '<span class="list-note-dot" title="Has note"><i class="ri-sticky-note-fill"></i></span>' : ''}

                    </div>

                </div>

                <div class="list-card-actions">

                    <button class="card-action-btn fav-btn${isFav ? ' active' : ''}" onclick="event.stopPropagation();toggleFavourite(${masterIndex},this)" title="Favourite"><i class="${isFav ? 'ri-heart-fill' : 'ri-heart-line'}"></i></button>

                    <button class="card-action-btn inst-btn${isInst ? ' active' : ''}" onclick="event.stopPropagation();toggleInstalled(${masterIndex},this)" title="Installed"><i class="${isInst ? 'ri-checkbox-circle-fill' : 'ri-checkbox-circle-line'}"></i></button>

                    <button class="download-btn list-dl-btn" onclick="openDownloadModal(${masterIndex})"><i class="ri-download-cloud-line"></i></button>

                </div>

            `;

        } else {

            card.innerHTML = `

                <div class="card-select-overlay" style="display:${_selectMode ? 'flex' : 'none'}" onclick="event.stopPropagation();selectGame('${gkey}')">

                    <div class="card-select-check ${isSelected ? 'checked' : ''}"><i class="ri-check-line"></i></div>

                </div>

                <div class="card-art" onclick="${_selectMode ? `selectGame('${gkey}')` : `openDownloadModal(${masterIndex})`}">

                    <img src="${game.image || 'data:,'}" referrerpolicy="no-referrer" onerror="handleImageError(this, ${JSON.stringify(game.name)})">

                    <div class="card-overlay">

                        <span class="genre-tag">${game.genre}</span>

                        <p class="game-title">${game.name}</p>

                        <div class="meta">

                            <span><i class="ri-hard-drive-2-line"></i> ${game.size}</span>

                            <span><i class="ri-gamepad-line"></i> ${game.platform}</span>

                            <span><i class="ri-refresh-line"></i> ${game.update}</span>

                        </div>

                    </div>

                    <div class="card-action-btns">

                        <button class="card-action-btn fav-btn${isFav ? ' active' : ''}" onclick="event.stopPropagation();toggleFavourite(${masterIndex},this)" title="Favourite">

                            <i class="${isFav ? 'ri-heart-fill' : 'ri-heart-line'}"></i>

                        </button>

                        <button class="card-action-btn inst-btn${isInst ? ' active' : ''}" onclick="event.stopPropagation();toggleInstalled(${masterIndex},this)" title="Installed">

                            <i class="${isInst ? 'ri-checkbox-circle-fill' : 'ri-checkbox-circle-line'}"></i>

                        </button>

                    </div>

                    ${isInst ? '<div class="installed-badge"><i class="ri-checkbox-circle-fill"></i> Installed</div>' : ''}

                    ${hasNote ? '<div class="note-badge" title="Has note"><i class="ri-sticky-note-fill"></i></div>' : ''}

                </div>

                <button class="download-btn" onclick="openDownloadModal(${masterIndex})">

                    <i class="ri-download-cloud-line"></i> View Details

                </button>

            `;

        }

        if (isSelected) card.classList.add('selected');

        grid.appendChild(card);

    });

}



function toggleFavourite(index, btn) {

    const game = allGames[index];

    if (!game) return;

    const gkey = encodeURIComponent(game.name);

    const favs = JSON.parse(localStorage.getItem('ps4-favs') || '{}');

    const nowFav = !favs[gkey];

    if (nowFav) favs[gkey] = 1; else delete favs[gkey];

    localStorage.setItem('ps4-favs', JSON.stringify(favs));

    btn.classList.toggle('active', nowFav);

    btn.querySelector('i').className = nowFav ? 'ri-heart-fill' : 'ri-heart-line';

    if (typeof showToast === 'function') showToast(nowFav ? '♥ Added to Favourites' : 'Removed from Favourites', nowFav ? 'success' : 'info');

    if (activeFilters.library === 'fav') applyFilters();

}



function toggleInstalled(index, btn) {

    const game = allGames[index];

    if (!game) return;

    const gkey = encodeURIComponent(game.name);

    const inst = JSON.parse(localStorage.getItem('ps4-installed') || '{}');

    const nowInst = !inst[gkey];

    if (nowInst) inst[gkey] = 1; else delete inst[gkey];

    localStorage.setItem('ps4-installed', JSON.stringify(inst));

    btn.classList.toggle('active', nowInst);

    btn.querySelector('i').className = nowInst ? 'ri-checkbox-circle-fill' : 'ri-checkbox-circle-line';

    const art = btn.closest('.card-art');

    if (art) {

        let badge = art.querySelector('.installed-badge');

        if (nowInst && !badge) {

            badge = document.createElement('div');

            badge.className = 'installed-badge';

            badge.innerHTML = '<i class="ri-checkbox-circle-fill"></i> Installed';

            art.appendChild(badge);

        } else if (!nowInst && badge) {

            badge.remove();

        }

    }

    if (typeof showToast === 'function') showToast(nowInst ? '✓ Marked as Installed' : 'Removed from Installed', nowInst ? 'success' : 'info');

    if (activeFilters.library === 'installed') applyFilters();

}



function trackRecentlyViewed(index) {

    let recent = JSON.parse(localStorage.getItem('ps4-recent') || '[]');

    recent = recent.filter(i => i !== index);

    recent.unshift(index);

    if (recent.length > 8) recent = recent.slice(0, 8);

    localStorage.setItem('ps4-recent', JSON.stringify(recent));

    if (typeof renderRecentlyViewed === 'function') renderRecentlyViewed();

}



function renderRecentlyViewed() {

    const section = document.getElementById('recently-viewed-section');

    const row = document.getElementById('recently-viewed-row');

    if (!section || !row) return;

    const recent = JSON.parse(localStorage.getItem('ps4-recent') || '[]');

    const valid = recent.filter(i => allGames[i]);

    if (valid.length === 0) { section.style.display = 'none'; return; }

    section.style.display = '';

    row.innerHTML = valid.map(i => {

        const g = allGames[i];

        return `<div class="rv-card" onclick="openDownloadModal(${i})">

            <img src="${g.image || 'data:,'}" referrerpolicy="no-referrer" onerror="handleImageError(this,${JSON.stringify(g.name)})">

            <div class="rv-info">

                <span class="rv-name">${g.name}</span>

                <span class="rv-meta">${g.platform} &middot; ${g.size}</span>

            </div>

        </div>`;

    }).join('');

}



// --- 3. INSTALLATION FLOW ---



let _consoleHideTimer = null;

function logToScreen(msg) {

    let consoleBox = document.getElementById('debug-console');

    if (!consoleBox) {

        consoleBox = document.createElement('div');

        consoleBox.id = 'debug-console';

        consoleBox.style.cssText = `

            position: fixed; bottom: 20px; left: 10px; right: 10px;

            background: rgba(0,0,0,0.88); color: #00ff88;

            font-family: monospace; font-size: 11px;

            border-radius: 8px; z-index: 10000;

            border: 1px solid #333;

        `;

        const header = document.createElement('div');

        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 10px;border-bottom:1px solid #333;';

        header.innerHTML = '<span style="opacity:0.5;font-size:10px">INSTALL LOG</span><button onclick="document.getElementById(\"debug-console\").remove()" style="background:none;border:none;color:#fff;cursor:pointer;font-size:14px;line-height:1;">✕</button>';

        const log = document.createElement('div');

        log.id = 'debug-console-log';

        log.style.cssText = 'padding:8px 10px;max-height:100px;overflow-y:auto;';

        consoleBox.appendChild(header);

        consoleBox.appendChild(log);

        document.body.appendChild(consoleBox);

    }

    const log = document.getElementById('debug-console-log');

    const time = new Date().toLocaleTimeString().split(' ')[0];

    log.innerHTML += `<div>[${time}] ${msg}</div>`;

    log.scrollTop = log.scrollHeight;

    clearTimeout(_consoleHideTimer);

    _consoleHideTimer = setTimeout(() => {

        const box = document.getElementById('debug-console');

        if (box) box.remove();

    }, 8000);

}



async function handleInstall(remoteLink) {

    // 1. Move the token to the URL to avoid the 'Authorization' header (which triggers CORS)

    const token = document.getElementById('rd-token')?.value.trim() || '';

    const rdUrl = `https://api.real-debrid.com/rest/1.0/unrestrict/link?auth_token=${token}`;



    try {

        logToScreen("Local Server: Sending Simple Request to RD...");

        

        const response = await fetch(rdUrl, {

            method: "POST",

            // 2. Use 'text/plain'. This is a "Simple" type that Safari won't block.

            headers: { "Content-Type": "text/plain" }, 

            body: `link=${encodeURIComponent(remoteLink)}`

        });



        const rdData = await response.json();

        if (rdData.download) {

            logToScreen("Link Unrestricted!");

            await pushToPS4(rdData.download);

        } else {

            alert("RD Error: " + rdData.error);

        }

    } catch (e) {

        logToScreen("Safari blocked the RD call. Try Private Browsing mode.");

    }

}



async function pushToPS4(directLink) {

    const ip = ipInput.value;

    const cleanUrl = directLink.replace("https://", "http://");

    

    // THE BARE MINIMUM REQUEST

    fetch(`http://${ip}:12800/api/install`, {

        method: "POST",

        mode: 'no-cors', // This is the "secret sauce" to bypass some security

        body: JSON.stringify({

            type: "direct",

            packages: [cleanUrl]

        })

    }).then(() => {

        if (typeof showToast === 'function') showToast('Install sent to PS4!', 'success');

        else alert('Request Sent!');

        if (typeof startTaskPolling === 'function') startTaskPolling();

    }).catch(err => {

        if (typeof showToast === 'function') showToast('Failed to reach PS4', 'error');

        else alert('Mobile Blocked it: ' + err.message);

    });

}



// --- 4. UI HELPERS ---



function toggleDlSection(el) {

    const section = el.parentElement;

    const container = section.parentElement;

    const isOpen = section.classList.contains('open');

    container.querySelectorAll('.dl-section').forEach(s => {

        s.classList.add('instant-close');

        s.classList.remove('open');

    });

    if (!isOpen) section.classList.add('open');

    setTimeout(() => {

        container.querySelectorAll('.dl-section').forEach(s => {

            s.classList.remove('instant-close');

        });

    }, 0);

}



function decodeHTML(str) {

    const el = document.createElement('textarea');

    el.innerHTML = str;

    return el.value;

}



function categorizeLinks(links) {

    const game = [], updates = [], dlc = [];

    links.forEach(link => {

        const t = (link.Title || '').toLowerCase().trim();

        if (t.includes('dlc')) {

            dlc.push(link);

        } else if (t.startsWith('update') || t.startsWith('patch') || /^v\d/.test(t)) {

            updates.push(link);

        } else {

            game.push(link);

        }

    });

    return [

        { label: 'Game', icon: 'ri-gamepad-line', items: game },

        { label: 'Updates', icon: 'ri-loop-left-line', items: updates },

        { label: 'DLC', icon: 'ri-add-box-line', items: dlc },

    ].filter(c => c.items.length > 0);

}



function openDownloadModal(index) {

    const game = allGames[index];

    const modal = document.getElementById('download-modal');

    const container = document.getElementById('link-container');

    

    // Populate game details - decode HTML entities

    document.getElementById('modal-art-title').innerText = decodeHTML(game.name);

    document.getElementById('modal-game-image').src = game.image || 'data:,';

    document.getElementById('modal-game-genre').innerText = game.genre;

    document.getElementById('modal-game-platform').innerText = game.platform;

    document.getElementById('modal-game-size').innerText = game.size;

    document.getElementById('modal-game-update').innerText = game.update;

    

    // Populate categorized downloads

    container.innerHTML = '';

    

    if (game.links.length === 0) {

        container.innerHTML = '<p style="color:var(--text-dim);text-align:center;padding:20px;">No download links available.</p>';

    } else {

        const categories = categorizeLinks(game.links);

        categories.forEach((cat, idx) => {

            const section = document.createElement('div');

            section.className = 'dl-section';

            section.innerHTML = `

                <button class="dl-section-header" onclick="toggleDlSection(this)">

                    <span class="dl-section-label"><i class="${cat.icon}"></i>${cat.label}</span>

                    <span class="dl-count">${cat.items.length}</span>

                    <i class="ri-arrow-down-s-line dl-arrow"></i>

                </button>

                <div class="dl-section-body">

                    ${cat.items.map(link => `

                        <div class="pkg-link-item">

                            <span>${decodeHTML(link.Title)}</span>

                            <div class="pkg-link-actions">

                                <button onclick="handleInstall('${link.Link}')" class="install-btn">

                                    <i class="ri-download-line"></i> Install

                                </button>

                                <button onclick="if(typeof addToQueue==='function')addToQueue(${JSON.stringify(decodeHTML(link.Title))},'${link.Link}')" class="queue-btn" title="Add to Queue">

                                    <i class="ri-list-ordered"></i>

                                </button>

                            </div>

                        </div>

                    `).join('')}

                </div>

            `;

            container.appendChild(section);

        });

    }

    

    trackRecentlyViewed(index);

    window._currentModalIndex = index;



    // Update note button state

    const noteBtn = document.getElementById('modal-note-btn');

    if (noteBtn) {

        const notes = JSON.parse(localStorage.getItem('ps4-notes') || '{}');

        const gkey = encodeURIComponent(game.name);

        noteBtn.classList.toggle('has-note', !!notes[gkey]);

    }



    modal.style.display = 'flex';

}



function closeModal() {

    document.getElementById('download-modal').style.display = 'none';

}



// --- 5. BOOT ---



function getSizeGB(game) {

    const s = String(game.size).toLowerCase();

    if (s === 'n/a' || s === '') return null;

    const num = parseFloat(s);

    if (isNaN(num)) return null;

    if (s.includes('mb')) return num / 1024;

    return num;

}



const activeFilters = { platform: 'all', genre: 'all', size: 'all', sort: 'default', search: '', library: 'all' };

let filteredResults = [];

let currentPage = 1;

const ITEMS_PER_PAGE = 50;



function renderPage() {

    const totalPages = Math.max(1, Math.ceil(filteredResults.length / ITEMS_PER_PAGE));

    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage - 1) * ITEMS_PER_PAGE;

    renderGames(filteredResults.slice(start, start + ITEMS_PER_PAGE));

    const indicator = document.getElementById('page-indicator');

    if (indicator) indicator.textContent = `${currentPage} / ${totalPages}`;

    const prevBtn = document.getElementById('page-prev');

    const nextBtn = document.getElementById('page-next');

    if (prevBtn) prevBtn.disabled = currentPage === 1;

    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

}



function applyFilters() {

    let results = allGames;



    if (activeFilters.search) {

        results = results.filter(g => g.name.toLowerCase().includes(activeFilters.search));

    }

    if (activeFilters.platform !== 'all') {

        results = results.filter(g => (g.platform || '').toUpperCase() === activeFilters.platform.toUpperCase());

    }

    if (activeFilters.genre !== 'all') {

        const genreKeywords = {

            'fps':         ['shooter', 'first-person', 'fps'],

            'fighting':    ['fight', 'beat', 'versus', 'vs.'],

            'jrpg':        ['jrpg', 'japanese rpg', 'j-rpg', 'japanese role'],

            'open world':  ['open world', 'open-world', 'sandbox'],

            'simulation':  ['simulat', 'sim'],

        };

        const terms = genreKeywords[activeFilters.genre] || [activeFilters.genre];

        results = results.filter(g => {

            const genre = (g.genre || '').toLowerCase();

            return terms.some(t => genre.includes(t));

        });

    }

    if (activeFilters.size !== 'all') {

        results = results.filter(g => {

            const gb = getSizeGB(g);

            if (gb === null) return false;

            if (activeFilters.size === 'small') return gb < 5;

            if (activeFilters.size === 'medium') return gb >= 5 && gb <= 20;

            if (activeFilters.size === 'large') return gb > 20;

            return true;

        });

    }



    if (activeFilters.library === 'fav') {

        const favs = JSON.parse(localStorage.getItem('ps4-favs') || '{}');

        results = results.filter(g => !!favs[encodeURIComponent(g.name)]);

    } else if (activeFilters.library === 'installed') {

        const inst = JSON.parse(localStorage.getItem('ps4-installed') || '{}');

        results = results.filter(g => !!inst[encodeURIComponent(g.name)]);

    }



    if (activeFilters.sort === 'size-asc') {

        results = [...results].sort((a, b) => (getSizeGB(a) ?? 0) - (getSizeGB(b) ?? 0));

    } else if (activeFilters.sort === 'size-desc') {

        results = [...results].sort((a, b) => (getSizeGB(b) ?? 0) - (getSizeGB(a) ?? 0));

    } else if (activeFilters.sort === 'az') {

        results = [...results].sort((a, b) => a.name.localeCompare(b.name));

    } else if (activeFilters.sort === 'za') {

        results = [...results].sort((a, b) => b.name.localeCompare(a.name));

    }



    const countEl = document.getElementById('filter-count');

    if (countEl) countEl.textContent = `${results.length} title${results.length !== 1 ? 's' : ''}`;



    // Update platform pill badge counts

    if (allGames.length) {

        document.querySelectorAll('#platform-filters .filter-pill[data-platform]').forEach(pill => {

            const p = pill.dataset.platform;

            const n = p === 'all' ? allGames.length : allGames.filter(g => (g.platform||'').toUpperCase() === p.toUpperCase()).length;

            const existing = pill.querySelector('.pill-count');

            if (existing) existing.textContent = n;

            else if (p !== 'all') { const s = document.createElement('span'); s.className = 'pill-count'; s.textContent = n; pill.appendChild(s); }

        });

    }



    filteredResults = results;

    currentPage = 1;

    renderPage();

}



document.addEventListener('DOMContentLoaded', () => {

    const gameSearch = document.getElementById('gameSearch');

    if (gameSearch) {

        gameSearch.addEventListener('input', (e) => {

            activeFilters.search = e.target.value.toLowerCase().trim();

            applyFilters();

        });

    }



    document.getElementById('platform-filters')?.addEventListener('click', (e) => {

        const pill = e.target.closest('.filter-pill');

        if (!pill) return;

        document.querySelectorAll('#platform-filters .filter-pill').forEach(p => p.classList.remove('active'));

        pill.classList.add('active');

        activeFilters.platform = pill.dataset.platform;

        applyFilters();

    });



    document.getElementById('genre-filter')?.addEventListener('change', (e) => {

        activeFilters.genre = e.target.value;

        applyFilters();

    });



    document.getElementById('size-filter')?.addEventListener('change', (e) => {

        activeFilters.size = e.target.value;

        applyFilters();

    });



    document.getElementById('sort-filter')?.addEventListener('change', (e) => {

        activeFilters.sort = e.target.value;

        applyFilters();

    });



    document.getElementById('library-filters')?.addEventListener('click', (e) => {

        const pill = e.target.closest('.filter-pill');

        if (!pill) return;

        document.querySelectorAll('#library-filters .filter-pill').forEach(p => p.classList.remove('active'));

        pill.classList.add('active');

        activeFilters.library = pill.dataset.library;

        applyFilters();

    });



    document.getElementById('page-prev')?.addEventListener('click', () => {

        if (currentPage > 1) { currentPage--; renderPage(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

    });



    document.getElementById('page-next')?.addEventListener('click', () => {

        const total = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);

        if (currentPage < total) { currentPage++; renderPage(); window.scrollTo({ top: 0, behavior: 'smooth' }); }

    });

});



window.onload = () => {

    loadSavedTheme();

    initConnectionManager(); 

    fetchGames();

    if (typeof renderRecentlyViewed === 'function') renderRecentlyViewed();

};



window.onclick = (e) => {

    const modal = document.getElementById('download-modal');

    if (e.target === modal) closeModal();

    

    const themesModal = document.getElementById('themes-modal');

    if (e.target === themesModal) closeThemesModal();



    const customColorModal = document.getElementById('custom-color-picker-modal');

    if (e.target === customColorModal) closeCustomColorPicker();

};



// --- THEME SYSTEM ---



function setTheme(themeName) {

    // Add transition class for smooth color transitions

    document.documentElement.classList.add('theme-transitioning');

    

    // Clear all inline styles to prevent conflicts

    document.documentElement.style.cssText = '';

    document.documentElement.setAttribute('data-theme', themeName);

    localStorage.setItem('preferred-theme', themeName);

    

    // Remove transition class after animation completes

    setTimeout(() => {

        document.documentElement.classList.remove('theme-transitioning');

    }, 600);

    

    updateThemeButtons(themeName);

    renderThemePresets();

    renderCustomThemes();

}



function updateThemeButtons(activeTheme) {

    const buttons = document.querySelectorAll('.theme-btn');

    if (buttons.length === 0) return; // No theme buttons in current DOM

    

    buttons.forEach(btn => btn.classList.remove('active'));

    

    const themeMap = {

        'vaporwave': 0,

        'midnight': 1,

        'crimson': 2,

        'cybergreen': 3,

        'sunset': 4,

        'ocean': 5,

        'forest': 6,

        'gold': 7,

        'violet': 8,

        'plasma': 9

    };

    

    if (themeMap[activeTheme] !== undefined) {

        buttons[themeMap[activeTheme]].classList.add('active');

    }

}



function loadSavedTheme() {

    const saved = localStorage.getItem('preferred-theme') || 'vaporwave';

    setTheme(saved);

}



// --- THEME STUDIO ---



const PRESET_THEMES = {

    vaporwave: { name: 'Vaporwave', accent: '#9d50ff', bg: '#0f0a1e', sidebar: '#160e2c', card: '#1d143a' },

    midnight: { name: 'Midnight', accent: '#0072ce', bg: '#00040a', sidebar: '#000a1a', card: '#001229' },

    crimson: { name: 'Crimson', accent: '#ff3c3c', bg: '#0a0000', sidebar: '#140000', card: '#1f0505' },

    cybergreen: { name: 'Cybergreen', accent: '#00ff3e', bg: '#0a1a0a', sidebar: '#0d2410', card: '#132018' },

    sunset: { name: 'Sunset', accent: '#ff9500', bg: '#1a0f08', sidebar: '#2a1810', card: '#3a2415' },

    ocean: { name: 'Ocean', accent: '#00d4ff', bg: '#080f18', sidebar: '#0a1428', card: '#0f2238' },

    forest: { name: 'Forest', accent: '#2ecc71', bg: '#0a140a', sidebar: '#0f1f0f', card: '#152915' },

    gold: { name: 'Gold', accent: '#ffc107', bg: '#1a1410', sidebar: '#24190f', card: '#2a2015' },

    violet: { name: 'Violet', accent: '#b366ff', bg: '#0f0a18', sidebar: '#16102a', card: '#1f1838' },

    plasma: { name: 'Plasma', accent: '#ff1493', bg: '#1a0614', sidebar: '#2a0a1f', card: '#3a1428' },

    abyss:  { name: 'Abyss',  accent: '#00ffe7', bg: '#060d14', sidebar: '#091520', card: '#0d2030' },

    sakura: { name: 'Sakura', accent: '#ff6eb4', bg: '#140a10', sidebar: '#1f1018', card: '#281520' },

    ember:  { name: 'Ember',  accent: '#ff5e00', bg: '#120800', sidebar: '#1f0e00', card: '#2a1500' },

    arctic: { name: 'Arctic', accent: '#a8d8ff', bg: '#060e14', sidebar: '#0a1622', card: '#0e1e30' },

    matrix: { name: 'Matrix', accent: '#39ff14', bg: '#000800', sidebar: '#001200', card: '#001a00' },

    rose:   { name: 'Rose',   accent: '#ff8fab', bg: '#130d0d', sidebar: '#1f1515', card: '#261818' },

    aurora: { name: 'Aurora', accent: '#00ffa3', bg: '#060f0d', sidebar: '#0a1a18', card: '#0d2025' },

    galaxy: { name: 'Galaxy', accent: '#7c6fff', bg: '#080612', sidebar: '#0d0a20', card: '#12103a' }

};



function openRdHelpModal() {

    document.getElementById('rd-help-modal').style.display = 'flex';

}



function closeRdHelpModal() {

    document.getElementById('rd-help-modal').style.display = 'none';

}



function openThemesModal() {

    const modal = document.getElementById('themes-modal');

    modal.style.display = 'flex';

    renderThemePresets();

    renderCustomThemes();

    enhanceThemeColorInputs();

    setupLivePreview();

}



function closeThemesModal() {

    const modal = document.getElementById('themes-modal');

    modal.style.display = 'none';

    // Revert any unsaved live preview changes

    const currentTheme = localStorage.getItem('preferred-theme') || 'vaporwave';

    if (currentTheme.startsWith('custom-')) {

        setCustomTheme(currentTheme);

    } else {

        setTheme(currentTheme);

    }

}



function setupLivePreview() {

    const inputs = ['custom', 'edit-custom'].flatMap(prefix => [

        `${prefix}-accent`,

        `${prefix}-bg`,

        `${prefix}-sidebar`,

        `${prefix}-card`,

        `${prefix}-text`,

        `${prefix}-glow`

    ]);



    inputs.forEach(id => {

        const el = document.getElementById(id);

        if (el) {

            if (!el.dataset.livePreviewBound) {

                el.addEventListener('input', applyLivePreview);

                el.dataset.livePreviewBound = 'true';

            }

        }

    });

}



let activeColorInput = null;

let colorPickerState = { h: 0, s: 1, v: 1 };



function ensureCustomColorPicker() {

    if (document.getElementById('custom-color-picker-modal')) return;



    const modal = document.createElement('div');

    modal.id = 'custom-color-picker-modal';

    modal.className = 'modal-overlay';

    modal.style.display = 'none';

    modal.innerHTML = `

        <div class="custom-color-picker-panel">

            <div class="custom-picker-header">

                <div>

                    <span class="custom-picker-kicker">Theme Studio</span>

                    <h3 id="custom-picker-title">Pick Color</h3>

                </div>

                <button class="custom-picker-close" type="button" onclick="closeCustomColorPicker()"><i class="ri-close-line"></i></button>

            </div>

            <div class="custom-picker-body">

                <div id="custom-picker-surface" class="custom-picker-surface">

                    <div class="surface-hue" id="custom-picker-surface-hue"></div>

                    <div class="surface-white"></div>

                    <div class="surface-black"></div>

                    <div id="custom-picker-surface-knob" class="custom-picker-surface-knob"></div>

                </div>

                <div class="custom-picker-controls">

                    <div class="custom-picker-row compact">

                        <button id="custom-picker-eyedropper" class="custom-picker-icon-btn" type="button" title="Use eyedropper"><i class="ri-eyedropper-line"></i></button>

                        <div id="custom-picker-preview" class="custom-picker-preview"></div>

                        <div id="custom-picker-hue" class="custom-picker-hue">

                            <div id="custom-picker-hue-knob" class="custom-picker-hue-knob"></div>

                        </div>

                    </div>

                    <div class="custom-picker-row values">

                        <label class="custom-picker-field hex-field">

                            <span>Hex</span>

                            <input id="custom-picker-hex" type="text" maxlength="7" spellcheck="false">

                        </label>

                        <label class="custom-picker-field small">

                            <span>R</span>

                            <input id="custom-picker-r" type="number" min="0" max="255">

                        </label>

                        <label class="custom-picker-field small">

                            <span>G</span>

                            <input id="custom-picker-g" type="number" min="0" max="255">

                        </label>

                        <label class="custom-picker-field small">

                            <span>B</span>

                            <input id="custom-picker-b" type="number" min="0" max="255">

                        </label>

                    </div>

                </div>

            </div>

        </div>

    `;



    document.body.appendChild(modal);



    bindColorDrag(document.getElementById('custom-picker-surface'), 'surface');

    bindColorDrag(document.getElementById('custom-picker-hue'), 'hue');



    const hexInput = document.getElementById('custom-picker-hex');

    const rInput = document.getElementById('custom-picker-r');

    const gInput = document.getElementById('custom-picker-g');

    const bInput = document.getElementById('custom-picker-b');

    const eyedropper = document.getElementById('custom-picker-eyedropper');



    hexInput.addEventListener('change', () => {

        const normalized = normalizeHex(hexInput.value);

        if (!normalized) return;

        applyColorToPicker(normalized);

        commitActiveColor(normalized);

    });



    [rInput, gInput, bInput].forEach(input => {

        input.addEventListener('input', () => {

            const nextHex = rgbToHex(rInput.value, gInput.value, bInput.value);

            applyColorToPicker(nextHex);

            commitActiveColor(nextHex);

        });

    });



    if ('EyeDropper' in window) {

        eyedropper.addEventListener('click', async () => {

            try {

                const eyeDropper = new EyeDropper();

                const result = await eyeDropper.open();

                applyColorToPicker(result.sRGBHex);

                commitActiveColor(result.sRGBHex);

            } catch (error) {

                console.error(error);

            }

        });

    } else {

        eyedropper.style.display = 'none';

    }

}



function enhanceThemeColorInputs() {

    const colorInputs = document.querySelectorAll('.theme-color-input');



    ensureCustomColorPicker();



    colorInputs.forEach(input => {

        const group = input.closest('.color-group');

        if (!group) return;



        let shell = group.querySelector('.theme-color-shell');

        let value = group.querySelector('.theme-color-value');



        if (!shell) {

            shell = document.createElement('div');

            shell.className = 'theme-color-shell';

            input.parentNode.insertBefore(shell, input);

            shell.appendChild(input);

        }



        if (!input.id) {

            input.id = `theme-color-${Math.random().toString(36).slice(2, 10)}`;

        }

        shell.dataset.targetInputId = input.id;



        if (!value) {

            value = document.createElement('div');

            value.className = 'theme-color-value';

            group.appendChild(value);

        }



        const syncInput = () => {

            const safeColor = normalizeHex(input.value) || '#9d50ff';

            input.dataset.currentColor = safeColor;

            shell.dataset.currentColor = safeColor;

            group.style.setProperty('--picker-color', safeColor);

            value.textContent = safeColor.toUpperCase();

        };



        syncInput();



        if (!input.dataset.themeInputEnhanced) {

            input.addEventListener('input', syncInput);

            input.classList.add('theme-color-input-hidden');

            shell.tabIndex = 0;

            shell.setAttribute('role', 'button');

            shell.setAttribute('aria-label', `${group.querySelector('label')?.textContent || 'Theme'} color picker`);

            shell.addEventListener('click', () => {

                const targetInput = document.getElementById(shell.dataset.targetInputId);

                if (!targetInput) return;

                document.querySelectorAll('.color-group.picker-active').forEach(activeGroup => {

                    if (activeGroup !== group) activeGroup.classList.remove('picker-active');

                });

                group.classList.add('picker-active');

                openCustomColorPicker(targetInput, group.querySelector('label')?.textContent || 'Color');

            });



            shell.addEventListener('keydown', (e) => {

                if (e.key === 'Enter' || e.key === ' ') {

                    e.preventDefault();

                    shell.click();

                }

            });

            input.dataset.themeInputEnhanced = 'true';

        }

    });

}



function openCustomColorPicker(input, label) {

    activeColorInput = input;

    ensureCustomColorPicker();

    const modal = document.getElementById('custom-color-picker-modal');

    const title = document.getElementById('custom-picker-title');

    if (title) title.textContent = `${label} Color`;

    modal.style.display = 'flex';

    const safeColor = normalizeHex(input?.value)

        || normalizeHex(input?.dataset.currentColor)

        || '#9d50ff';

    input.dataset.currentColor = safeColor;

    applyColorToPicker(safeColor);

}



function closeCustomColorPicker() {

    const modal = document.getElementById('custom-color-picker-modal');

    if (modal) modal.style.display = 'none';

}



function bindColorDrag(element, mode) {

    if (!element) return;



    element.addEventListener('pointerdown', (e) => {

        e.preventDefault();

        element.setPointerCapture(e.pointerId);

        updateColorFromPointer(e, mode, element);

    });



    element.addEventListener('pointermove', (e) => {

        if (!element.hasPointerCapture(e.pointerId)) return;

        e.preventDefault();

        updateColorFromPointer(e, mode, element);

    });



    element.addEventListener('pointerup', (e) => {

        element.releasePointerCapture(e.pointerId);

    });



    element.addEventListener('pointercancel', (e) => {

        element.releasePointerCapture(e.pointerId);

    });

}



function updateColorFromPointer(event, mode, element) {

    const rect = element.getBoundingClientRect();

    const x = clamp((event.clientX - rect.left) / rect.width, 0, 1);

    const y = clamp((event.clientY - rect.top) / rect.height, 0, 1);



    if (mode === 'surface') {

        colorPickerState.s = x;

        colorPickerState.v = 1 - y;

    } else {

        colorPickerState.h = x * 360;

    }



    const nextHex = hsvToHex(colorPickerState.h, colorPickerState.s, colorPickerState.v);

    renderColorPicker(nextHex);

    commitActiveColor(nextHex);

}



function applyColorToPicker(hex) {

    const safeColor = normalizeHex(hex) || '#9d50ff';

    colorPickerState = hexToHsv(safeColor);

    renderColorPicker(safeColor);

}



function renderColorPicker(hex) {

    const safeColor = normalizeHex(hex) || '#9d50ff';

    const preview = document.getElementById('custom-picker-preview');

    const hueLayer = document.getElementById('custom-picker-surface-hue');

    const surfaceKnob = document.getElementById('custom-picker-surface-knob');

    const hueKnob = document.getElementById('custom-picker-hue-knob');

    const hexInput = document.getElementById('custom-picker-hex');

    const rInput = document.getElementById('custom-picker-r');

    const gInput = document.getElementById('custom-picker-g');

    const bInput = document.getElementById('custom-picker-b');

    const pureHue = hsvToHex(colorPickerState.h, 1, 1);

    const rgb = hexToRgb(safeColor);



    if (preview) preview.style.background = safeColor;

    if (hueLayer) hueLayer.style.background = pureHue;



    if (surfaceKnob) {

        surfaceKnob.style.left = `${colorPickerState.s * 100}%`;

        surfaceKnob.style.top = `${(1 - colorPickerState.v) * 100}%`;

    }

    if (hueKnob) hueKnob.style.left = `${(colorPickerState.h / 360) * 100}%`;

    if (hexInput) hexInput.value = safeColor.toUpperCase();

    if (rInput) rInput.value = rgb.r;

    if (gInput) gInput.value = rgb.g;

    if (bInput) bInput.value = rgb.b;

}



function commitActiveColor(hex) {

    if (!activeColorInput) return;

    const safeColor = normalizeHex(hex) || '#9d50ff';

    activeColorInput.value = safeColor;

    activeColorInput.dataset.currentColor = safeColor;

    const shell = activeColorInput.closest('.theme-color-shell');

    if (shell) shell.dataset.currentColor = safeColor;

    activeColorInput.dispatchEvent(new Event('input', { bubbles: true }));

}



function getInputColorValue(input) {

    return normalizeHex(input?.dataset.currentColor)

        || normalizeHex(input?.value)

        || normalizeHex(input?.defaultValue)

        || normalizeHex(input?.getAttribute('value'))

        || '#9d50ff';

}



function clamp(value, min, max) {

    return Math.min(Math.max(Number(value) || 0, min), max);

}



function normalizeHex(value) {

    if (!value) return null;

    let hex = value.trim().replace('#', '');

    if (hex.length === 3) {

        hex = hex.split('').map(char => char + char).join('');

    }

    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;

    return `#${hex.toLowerCase()}`;

}



function hexToRgb(hex) {

    const normalized = normalizeHex(hex) || '#000000';

    return {

        r: parseInt(normalized.slice(1, 3), 16),

        g: parseInt(normalized.slice(3, 5), 16),

        b: parseInt(normalized.slice(5, 7), 16)

    };

}



function rgbToHex(r, g, b) {

    return `#${[r, g, b].map(value => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')).join('')}`;

}



function hexToHsv(hex) {

    const { r, g, b } = hexToRgb(hex);

    const red = r / 255;

    const green = g / 255;

    const blue = b / 255;

    const max = Math.max(red, green, blue);

    const min = Math.min(red, green, blue);

    const delta = max - min;

    let h = 0;



    if (delta !== 0) {

        if (max === red) h = 60 * (((green - blue) / delta) % 6);

        else if (max === green) h = 60 * (((blue - red) / delta) + 2);

        else h = 60 * (((red - green) / delta) + 4);

    }



    if (h < 0) h += 360;



    return {

        h,

        s: max === 0 ? 0 : delta / max,

        v: max

    };

}



function hsvToHex(h, s, v) {

    const c = v * s;

    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));

    const m = v - c;

    let r = 0;

    let g = 0;

    let b = 0;



    if (h >= 0 && h < 60) {

        r = c; g = x; b = 0;

    } else if (h < 120) {

        r = x; g = c; b = 0;

    } else if (h < 180) {

        r = 0; g = c; b = x;

    } else if (h < 240) {

        r = 0; g = x; b = c;

    } else if (h < 300) {

        r = x; g = 0; b = c;

    } else {

        r = c; g = 0; b = x;

    }



    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);

}



function renderThemePresets() {

    const grid = document.getElementById('presets-grid');

    if (!grid) return;

    

    grid.innerHTML = '';

    const currentTheme = localStorage.getItem('preferred-theme') || 'vaporwave';

    const hasDataTheme = document.documentElement.getAttribute('data-theme');

    

    Object.entries(PRESET_THEMES).forEach(([key, theme]) => {

        const preview = document.createElement('div');

        preview.className = 'theme-preview';

        // Active if: using preset theme (hasDataTheme) AND it matches current

        if (hasDataTheme && key === currentTheme) preview.classList.add('active');

        

        const textColor = theme.text || adjustTextColor(theme.bg);

        const glowColor = theme.glow || theme.accent;

        

        preview.innerHTML = `

            <div class="theme-preview-ui" style="background: ${theme.bg};">

                <div class="preview-sidebar" style="background: ${theme.sidebar};">

                    <div class="preview-logo" style="color: ${theme.accent}; text-shadow: 0 0 8px ${adjustOpacity(glowColor, 0.8)};"></div>

                </div>

                <div class="preview-content">

                    <div class="preview-header">

                        <div class="preview-search" style="background: ${adjustOpacity(theme.accent, 0.1)}; border-color: ${adjustOpacity(theme.accent, 0.2)};"></div>

                    </div>

                    <div class="preview-grid">

                        <div class="preview-card" style="background: ${theme.card}; border-color: ${adjustOpacity(theme.accent, 0.1)}; box-shadow: 0 2px 8px ${adjustOpacity(glowColor, 0.2)};">

                            <div class="preview-text-line" style="background: ${textColor};"></div>

                            <div class="preview-text-line short" style="background: ${textColor}; opacity: 0.5;"></div>

                        </div>

                        <div class="preview-card" style="background: ${theme.card}; border-color: ${adjustOpacity(theme.accent, 0.1)}; box-shadow: 0 2px 8px ${adjustOpacity(glowColor, 0.2)};">

                            <div class="preview-text-line" style="background: ${textColor};"></div>

                            <div class="preview-text-line short" style="background: ${textColor}; opacity: 0.5;"></div>

                        </div>

                        <div class="preview-card" style="background: ${theme.card}; border-color: ${adjustOpacity(theme.accent, 0.1)}; box-shadow: 0 2px 8px ${adjustOpacity(glowColor, 0.2)};">

                            <div class="preview-text-line" style="background: ${textColor};"></div>

                            <div class="preview-text-line short" style="background: ${textColor}; opacity: 0.5;"></div>

                        </div>

                    </div>

                </div>

            </div>

            <div class="theme-preview-footer">

                <span class="theme-preview-label">${theme.name}</span>

                <div class="preview-glow-indicator" style="background: ${glowColor}; box-shadow: 0 0 10px ${adjustOpacity(glowColor, 0.8)};"></div>

            </div>

        `;

        

        preview.onclick = () => applyPresetTheme(key);

        grid.appendChild(preview);

    });

}



function renderCustomThemes() {

    const grid = document.getElementById('custom-grid');

    if (!grid) return;

    

    const custom = JSON.parse(localStorage.getItem('custom-themes') || '{}');

    grid.innerHTML = '';

    const currentTheme = localStorage.getItem('preferred-theme') || 'vaporwave';

    const hasDataTheme = document.documentElement.getAttribute('data-theme');

    

    if (Object.keys(custom).length === 0) {

        const emptyMsg = document.createElement('p');

        emptyMsg.style.cssText = 'color: var(--text-dim); font-size: 0.9rem; grid-column: 1/-1; margin: 20px 0;';

        emptyMsg.textContent = 'No custom themes yet. Create one!';

        grid.appendChild(emptyMsg);

        return;

    }

    

    Object.entries(custom).forEach(([key, theme]) => {

        const preview = document.createElement('div');

        preview.className = 'theme-preview';

        // Active if: using custom theme (NO hasDataTheme) AND it matches current

        if (!hasDataTheme && key === currentTheme) preview.classList.add('active');

        

        const textColor = theme.text || adjustTextColor(theme.bg);

        const glowColor = theme.glow || theme.accent;

        

        preview.innerHTML = `

            <div class="theme-preview-ui" style="background: ${theme.bg};">

                <div class="preview-sidebar" style="background: ${theme.sidebar};">

                    <div class="preview-logo" style="color: ${theme.accent}; text-shadow: 0 0 8px ${adjustOpacity(glowColor, 0.8)};"></div>

                </div>

                <div class="preview-content">

                    <div class="preview-header">

                        <div class="preview-search" style="background: ${adjustOpacity(theme.accent, 0.1)}; border-color: ${adjustOpacity(theme.accent, 0.2)};"></div>

                    </div>

                    <div class="preview-grid">

                        <div class="preview-card" style="background: ${theme.card}; border-color: ${adjustOpacity(theme.accent, 0.1)}; box-shadow: 0 2px 8px ${adjustOpacity(glowColor, 0.2)};">

                            <div class="preview-text-line" style="background: ${textColor};"></div>

                            <div class="preview-text-line short" style="background: ${textColor}; opacity: 0.5;"></div>

                        </div>

                        <div class="preview-card" style="background: ${theme.card}; border-color: ${adjustOpacity(theme.accent, 0.1)}; box-shadow: 0 2px 8px ${adjustOpacity(glowColor, 0.2)};">

                            <div class="preview-text-line" style="background: ${textColor};"></div>

                            <div class="preview-text-line short" style="background: ${textColor}; opacity: 0.5;"></div>

                        </div>

                        <div class="preview-card" style="background: ${theme.card}; border-color: ${adjustOpacity(theme.accent, 0.1)}; box-shadow: 0 2px 8px ${adjustOpacity(glowColor, 0.2)};">

                            <div class="preview-text-line" style="background: ${textColor};"></div>

                            <div class="preview-text-line short" style="background: ${textColor}; opacity: 0.5;"></div>

                        </div>

                    </div>

                </div>

            </div>

            <div class="theme-preview-footer">

                <span class="theme-preview-label">${theme.name}</span>

                <div class="theme-actions">

                    <button class="copy-code-btn" title="Copy share code"><i class="ri-clipboard-line"></i></button>

                    <button class="edit-theme-btn" title="Edit this theme"><i class="ri-pencil-line"></i></button>

                    <button class="delete-theme-btn" title="Delete this theme"><i class="ri-delete-bin-line"></i></button>

                </div>

            </div>

        `;

        

        preview.onclick = () => setCustomTheme(key);

        

        // Copy code button handler

        const copyBtn = preview.querySelector('.copy-code-btn');

        copyBtn.onclick = (e) => {

            e.stopPropagation();

            copyThemeCode(key, copyBtn);

        };



        // Edit button handler - stop propagation

        const editBtn = preview.querySelector('.edit-theme-btn');

        editBtn.onclick = (e) => {

            e.stopPropagation();

            openEditThemeModal(key);

        };

        

        // Delete button handler - stop propagation to prevent theme selection

        const deleteBtn = preview.querySelector('.delete-theme-btn');

        deleteBtn.onclick = (e) => {

            e.stopPropagation();

            if (confirm(`Delete "${theme.name}" theme?`)) {

                deleteCustomTheme(key);

            }

        };

        

        grid.appendChild(preview);

    });

}



function saveCustomTheme() {

    const name = document.getElementById('custom-name').value.trim();

    const accent = document.getElementById('custom-accent').value;

    const bg = document.getElementById('custom-bg').value;

    const sidebar = document.getElementById('custom-sidebar').value;

    const card = document.getElementById('custom-card').value;

    const text = document.getElementById('custom-text').value;

    const glow = document.getElementById('custom-glow').value;

    

    if (!name) {

        alert('Please enter a theme name');

        return;

    }

    

    const custom = JSON.parse(localStorage.getItem('custom-themes') || '{}');

    const key = 'custom-' + Date.now();

    

    custom[key] = { name, accent, bg, sidebar, card, text, glow };

    localStorage.setItem('custom-themes', JSON.stringify(custom));

    

    // Clear form

    document.getElementById('custom-name').value = '';

    document.getElementById('custom-accent').value = '#9d50ff';

    document.getElementById('custom-bg').value = '#0f0a1e';

    document.getElementById('custom-sidebar').value = '#160e2c';

    document.getElementById('custom-card').value = '#1d143a';

    document.getElementById('custom-text').value = '#c9b5d9';

    document.getElementById('custom-glow').value = '#b366ff';

    

    // Show success feedback

    const themeForm = document.querySelector('.custom-theme-form');

    const createBtn = themeForm.querySelector('.create-btn');

    const originalText = createBtn.textContent;

    createBtn.textContent = '✓ Theme Created!';

    createBtn.style.background = '#2ecc71';

    setTimeout(() => {

        createBtn.textContent = originalText;

        createBtn.style.background = '';

    }, 2000);

    

    renderCustomThemes();

}



function openEditThemeModal(key) {

    const custom = JSON.parse(localStorage.getItem('custom-themes') || '{}');

    const theme = custom[key];

    

    if (!theme) return;

    

    window.currentEditThemeKey = key;

    

    document.getElementById('edit-theme-title').textContent = `Edit "${theme.name}"`;

    document.getElementById('edit-custom-name').value = theme.name;

    document.getElementById('edit-custom-accent').value = theme.accent;

    document.getElementById('edit-custom-bg').value = theme.bg;

    document.getElementById('edit-custom-sidebar').value = theme.sidebar;

    document.getElementById('edit-custom-card').value = theme.card;

    document.getElementById('edit-custom-text').value = theme.text || '#c9b5d9';

    document.getElementById('edit-custom-glow').value = theme.glow || '#b366ff';

    

    document.getElementById('edit-theme-modal').style.display = 'flex';

    enhanceThemeColorInputs();

}



function closeEditThemeModal() {

    document.getElementById('edit-theme-modal').style.display = 'none';

    window.currentEditThemeKey = null;

}



function updateCustomTheme() {

    const key = window.currentEditThemeKey;

    if (!key) return;

    

    const name = document.getElementById('edit-custom-name').value.trim();

    const accent = document.getElementById('edit-custom-accent').value;

    const bg = document.getElementById('edit-custom-bg').value;

    const sidebar = document.getElementById('edit-custom-sidebar').value;

    const card = document.getElementById('edit-custom-card').value;

    const text = document.getElementById('edit-custom-text').value;

    const glow = document.getElementById('edit-custom-glow').value;

    

    if (!name) {

        alert('Please enter a theme name');

        return;

    }

    

    const custom = JSON.parse(localStorage.getItem('custom-themes') || '{}');

    custom[key] = { name, accent, bg, sidebar, card, text, glow };

    localStorage.setItem('custom-themes', JSON.stringify(custom));

    

    // If this was the active theme, reapply it

    if (localStorage.getItem('preferred-theme') === key) {

        setCustomTheme(key);

    } else {

        renderCustomThemes();

    }

    

    closeEditThemeModal();

}



function applyPresetTheme(key) {

    setTheme(key);

    renderThemePresets();

}



function setCustomTheme(key) {

    const custom = JSON.parse(localStorage.getItem('custom-themes') || '{}');

    const theme = custom[key];

    

    if (!theme) return;

    

    // Add transition class for smooth color transitions

    document.documentElement.classList.add('theme-transitioning');

    

    // Remove data-theme attribute to use inline styles

    document.documentElement.removeAttribute('data-theme');

    

    // Apply custom theme via inline styles

    document.documentElement.style.setProperty('--bg-color', theme.bg);

    document.documentElement.style.setProperty('--sidebar-color', theme.sidebar);

    document.documentElement.style.setProperty('--accent-color', theme.accent);

    document.documentElement.style.setProperty('--card-bg', theme.card);

    document.documentElement.style.setProperty('--accent-glow', theme.glow ? adjustOpacity(theme.glow, 0.6) : adjustOpacity(theme.accent, 0.6));

    document.documentElement.style.setProperty('--glass', adjustOpacity(theme.accent, 0.08));

    document.documentElement.style.setProperty('--text-dim', theme.text || adjustTextColor(theme.bg));

    

    // Remove transition class after animation completes

    setTimeout(() => {

        document.documentElement.classList.remove('theme-transitioning');

    }, 600);

    

    localStorage.setItem('preferred-theme', key);

    renderThemePresets();

    renderCustomThemes();

}



function adjustOpacity(hex, opacity) {

    const r = parseInt(hex.slice(1, 3), 16);

    const g = parseInt(hex.slice(3, 5), 16);

    const b = parseInt(hex.slice(5, 7), 16);

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;

}



function adjustTextColor(bgHex) {

    const r = parseInt(bgHex.slice(1, 3), 16);

    const g = parseInt(bgHex.slice(3, 5), 16);

    const b = parseInt(bgHex.slice(5, 7), 16);

    const brightness = (r * 299 + g * 587 + b * 114) / 1000;

    return brightness > 128 ? '#333333' : '#c9b5d9';

}



function deleteCustomTheme(key) {

    const custom = JSON.parse(localStorage.getItem('custom-themes') || '{}');

    delete custom[key];

    localStorage.setItem('custom-themes', JSON.stringify(custom));

    

    // If deleted theme was active, switch to default preset

    if (localStorage.getItem('preferred-theme') === key) {

        setTheme('vaporwave');

    } else {

        renderCustomThemes();

    }

}



// --- IMPORT / EXPORT THEMES ---

function copyThemeCode(key, btn) {

    const custom = JSON.parse(localStorage.getItem('custom-themes') || '{}');

    const theme = custom[key];

    if (!theme) return;



    const code = btoa(unescape(encodeURIComponent(JSON.stringify(theme))));

    const icon = btn.querySelector('i');



    const showCheck = () => {

        if (icon) { icon.className = 'ri-check-line'; btn.style.background = 'rgba(46,204,113,0.9)'; }

        setTimeout(() => { if (icon) icon.className = 'ri-clipboard-line'; btn.style.background = ''; }, 2000);

    };



    navigator.clipboard.writeText(code).then(showCheck).catch(() => {

        const ta = document.createElement('textarea');

        ta.value = code;

        document.body.appendChild(ta);

        ta.select();

        document.execCommand('copy');

        document.body.removeChild(ta);

        showCheck();

    });

}



function openImportCodeModal() {

    document.getElementById('import-code-modal').style.display = 'flex';

}



function closeImportCodeModal() {

    document.getElementById('import-code-modal').style.display = 'none';

    const inp = document.getElementById('import-code-input');

    if (inp) inp.value = '';

}



function importThemeCode() {

    const inp = document.getElementById('import-code-input');

    const code = inp?.value.trim();

    if (!code) return;



    try {

        const theme = JSON.parse(decodeURIComponent(escape(atob(code))));

        if (!theme.name || !theme.accent || !theme.bg || !theme.sidebar || !theme.card) throw new Error('Invalid');



        const custom = JSON.parse(localStorage.getItem('custom-themes') || '{}');

        custom['custom-' + Date.now()] = theme;

        localStorage.setItem('custom-themes', JSON.stringify(custom));

        closeImportCodeModal();

        renderCustomThemes();

    } catch (e) {

        alert('Invalid theme code. Make sure you copied it correctly.');

    }

}



function exportThemes() {

    const customThemes = localStorage.getItem('custom-themes');

    if (!customThemes || customThemes === '{}') {

        alert("You have no custom themes to export.");

        return;

    }

    

    const blob = new Blob([customThemes], { type: 'application/json' });

    const url = URL.createObjectURL(blob);

    

    const a = document.createElement('a');

    a.href = url;

    a.download = `ps4_themes_${new Date().toISOString().split('T')[0]}.json`;

    document.body.appendChild(a);

    a.click();

    

    setTimeout(() => {

        document.body.removeChild(a);

        URL.revokeObjectURL(url);

    }, 100);

}



function importThemes(event) {

    const file = event.target.files[0];

    if (!file) return;



    const reader = new FileReader();

    reader.onload = (e) => {

        try {

            const importedThemes = JSON.parse(e.target.result);

            const currentThemes = JSON.parse(localStorage.getItem('custom-themes') || '{}');

            

            // Validate imported structure roughly

            if (typeof importedThemes !== 'object' || Array.isArray(importedThemes)) {

                throw new Error("Invalid format");

            }



            // Merge themes, adding a timestamp to keys to avoid overwriting existing ones with the same exact key

            // unless we want to merge them exactly. Let's merge them directly for simplicity but keep unique IDs.

            let importedCount = 0;

            const newThemes = { ...currentThemes };

            

            for (const [key, theme] of Object.entries(importedThemes)) {

                if (theme.name && theme.accent && theme.bg && theme.sidebar && theme.card) {

                    // Generate new key to prevent conflicts

                    const newKey = `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

                    newThemes[newKey] = theme;

                    importedCount++;

                }

            }



            if (importedCount > 0) {

                localStorage.setItem('custom-themes', JSON.stringify(newThemes));

                renderCustomThemes();

                alert(`Successfully imported ${importedCount} theme(s)!`);

            } else {

                alert("No valid themes found in file.");

            }

        } catch (err) {

            console.error(err);

            alert("Error parsing theme file. Make sure it's a valid JSON exported from this app.");

        }

        

        // Reset file input so same file can be imported again if needed

        event.target.value = '';

    };

    reader.readAsText(file);

}



// ── Surprise Me ────────────────────────────────────────────────────────────

function surpriseMe() {

    if (!allGames || !allGames.length) return;

    const pool = filteredResults.length ? filteredResults : allGames;

    const game = pool[Math.floor(Math.random() * pool.length)];

    if (game) openDownloadModal(allGames.indexOf(game));

}



// ── View Toggle ────────────────────────────────────────────────────────────

function toggleView(force) {

    const grid = document.getElementById('game-grid');

    if (!grid) return;

    const isNowList = force ? force === 'list' : !grid.classList.contains('list-view');

    grid.classList.toggle('list-view', isNowList);

    localStorage.setItem('ps4-view', isNowList ? 'list' : 'grid');

    const gridBtn = document.getElementById('view-toggle-btn');

    const listBtn = document.getElementById('view-toggle-list-btn');

    if (gridBtn) gridBtn.classList.toggle('active', !isNowList);

    if (listBtn) listBtn.classList.toggle('active', isNowList);

    renderPage();

}



// ── Note Modal ─────────────────────────────────────────────────────────────

let _noteGameKey = null;



function openNoteModal(gameNameOrIndex) {

    const game = (typeof gameNameOrIndex === 'number')

        ? allGames[gameNameOrIndex]

        : allGames.find(g => g.name === gameNameOrIndex);

    if (!game) return;

    _noteGameKey = encodeURIComponent(game.name);

    const notes = JSON.parse(localStorage.getItem('ps4-notes') || '{}');

    const titleEl = document.getElementById('note-modal-title');

    const textarea = document.getElementById('note-textarea');

    if (titleEl) titleEl.textContent = game.name;

    if (textarea) textarea.value = notes[_noteGameKey] || '';

    document.getElementById('note-modal').style.display = 'flex';

    if (textarea) setTimeout(() => textarea.focus(), 80);

}



function closeNoteModal() {

    document.getElementById('note-modal').style.display = 'none';

    _noteGameKey = null;

}



function saveNote() {

    if (!_noteGameKey) return;

    const textarea = document.getElementById('note-textarea');

    const text = textarea ? textarea.value.trim() : '';

    const notes = JSON.parse(localStorage.getItem('ps4-notes') || '{}');

    if (text) notes[_noteGameKey] = text;

    else delete notes[_noteGameKey];

    localStorage.setItem('ps4-notes', JSON.stringify(notes));

    closeNoteModal();

    renderPage();

    if (typeof showToast === 'function') showToast(text ? 'Note saved' : 'Note deleted', 'success');

}



function deleteNote() {

    if (!_noteGameKey) return;

    const notes = JSON.parse(localStorage.getItem('ps4-notes') || '{}');

    delete notes[_noteGameKey];

    localStorage.setItem('ps4-notes', JSON.stringify(notes));

    closeNoteModal();

    renderPage();

    if (typeof showToast === 'function') showToast('Note deleted', 'info');

}



// ── Export / Import ─────────────────────────────────────────────────────────

function openExim() {

    document.getElementById('exim-modal').style.display = 'flex';

}

function closeExim() {

    document.getElementById('exim-modal').style.display = 'none';

}



function exportLibrary() {

    const data = {

        favs:      JSON.parse(localStorage.getItem('ps4-favs')      || '{}'),

        installed: JSON.parse(localStorage.getItem('ps4-installed')  || '{}'),

        notes:     JSON.parse(localStorage.getItem('ps4-notes')      || '{}')

    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

    const url  = URL.createObjectURL(blob);

    const a    = document.createElement('a');

    a.href     = url;

    a.download = 'ps4-library-backup.json';

    a.click();

    URL.revokeObjectURL(url);

    if (typeof showToast === 'function') showToast('Library exported', 'success');

}



function importLibrary(inputEl) {

    function _doRead(file) {

        if (!file) return;

        const reader = new FileReader();

        reader.onload = function(ev) {

            try {

                const data = JSON.parse(ev.target.result);

                if (data.favs)      localStorage.setItem('ps4-favs',      JSON.stringify(data.favs));

                if (data.installed) localStorage.setItem('ps4-installed',  JSON.stringify(data.installed));

                if (data.notes)     localStorage.setItem('ps4-notes',      JSON.stringify(data.notes));

                renderPage();

                closeExim();

                if (typeof showToast === 'function') showToast('Library imported', 'success');

            } catch(err) {

                if (typeof showToast === 'function') showToast('Invalid backup file', 'error');

            }

        };

        reader.readAsText(file);

    }

    if (inputEl && inputEl.files) {

        _doRead(inputEl.files[0]);

    } else {

        const input = document.createElement('input');

        input.type = 'file';

        input.accept = '.json,application/json';

        input.onchange = function(e) { _doRead(e.target.files[0]); };

        input.click();

    }

}



// ── Multi-select ────────────────────────────────────────────────────────────

function enterSelectMode() {

    _selectMode = true;

    _selectedKeys.clear();

    renderPage();

    updateSelectBar();

}



function exitSelectMode() {

    _selectMode = false;

    _selectedKeys.clear();

    renderPage();

    const bar = document.getElementById('select-bar');

    if (bar) bar.style.display = 'none';

}



function selectGame(key) {

    if (_selectedKeys.has(key)) _selectedKeys.delete(key);

    else _selectedKeys.add(key);

    updateSelectBar();

    // Update visual state without full re-render

    document.querySelectorAll('[data-select-key]').forEach(el => {

        const isSelected = _selectedKeys.has(el.dataset.selectKey);

        el.classList.toggle('selected', isSelected);

        const check = el.querySelector('.card-select-check, .list-card-checkbox');

        if (check) {

            if (check.tagName === 'INPUT') check.checked = isSelected;

            else check.classList.toggle('checked', isSelected);

        }

    });

}



function updateSelectBar() {

    const bar      = document.getElementById('select-bar');

    const countEl  = document.getElementById('select-bar-count');

    if (!bar) return;

    const n = _selectedKeys.size;

    bar.style.display = _selectMode ? 'flex' : 'none';

    if (countEl) countEl.textContent = n + ' selected';

}



function batchAddToQueue() {

    if (!_selectedKeys.size) return;

    _selectedKeys.forEach(key => {

        const game = allGames.find(g => encodeURIComponent(g.name) === key);

        if (game && game.links && game.links[0]) {

            const link = game.links[0].Link || game.links[0];

            if (typeof addToQueue === 'function') addToQueue(game.name, link);

        }

    });

    if (typeof showToast === 'function') showToast(_selectedKeys.size + ' games added to queue', 'success');

    exitSelectMode();

}



function batchFavourite() {

    if (!_selectedKeys.size) return;

    const favs = JSON.parse(localStorage.getItem('ps4-favs') || '{}');

    _selectedKeys.forEach(key => { favs[key] = true; });

    localStorage.setItem('ps4-favs', JSON.stringify(favs));

    if (typeof showToast === 'function') showToast(_selectedKeys.size + ' games favourited', 'success');

    exitSelectMode();

}



// Expose select-mode state for renderGames

function isSelectMode()   { return _selectMode; }

function isKeySelected(k) { return _selectedKeys.has(k); }



// ── PS4 Install Progress Polling ────────────────────────────────────────────

(function () {

    var _timer        = null;

    var _prevDone     = {};

    var _minimised    = false;



    function _fmtSpeed(bps) {

        if (!bps || bps <= 0) return '';

        if (bps >= 1048576) return (bps / 1048576).toFixed(1) + ' MB/s';

        if (bps >= 1024)    return Math.round(bps / 1024) + ' KB/s';

        return bps + ' B/s';

    }



    function _fmtEta(s) {

        if (!s || s <= 0) return '';

        if (s > 3600) return Math.floor(s / 3600) + 'h ' + Math.floor((s % 3600) / 60) + 'm left';

        if (s > 60)   return Math.floor(s / 60) + 'm ' + (s % 60) + 's left';

        return s + 's left';

    }



    function _render(tasks) {

        var panel = document.getElementById('ps4-dl-panel');

        var body  = document.getElementById('psdl-body');

        if (!panel || !body) return;



        var active = (tasks || []).filter(function (t) {

            var s = (t.status || '').toLowerCase();

            return s !== 'completed' && s !== 'error' && s !== 'failed' && s !== 'success';

        });



        // Fire notifications for newly-completed tasks

        (tasks || []).forEach(function (t) {

            var s   = (t.status || '').toLowerCase();

            var id  = t.id != null ? String(t.id) : (t.title_name || t.title || '');

            var done = s === 'completed' || s === 'success';

            if (done && !_prevDone[id]) {

                _prevDone[id] = true;

                var name = t.title_name || t.titleName || t.title || 'Game';

                if (typeof window._fireNotif === 'function') window._fireNotif('Install Complete', name + ' is ready on your PS4!');

                if (typeof showToast === 'function') showToast(name + ' install complete!', 'success');

            }

        });



        if (!tasks || tasks.length === 0) {

            panel.style.display = 'none';

            return;

        }



        panel.style.display = '';

        body.innerHTML = tasks.map(function (t) {

            var name   = t.title_name || t.titleName || t.title || 'Unknown';

            var pct    = t.progress_rate != null ? t.progress_rate : (t.progress != null ? t.progress : 0);

            var speed  = _fmtSpeed(t.download_speed || t.speed || 0);

            var eta    = _fmtEta(t.remaining_time  || t.remaining || 0);

            var status = (t.status || '').toLowerCase();

            var meta   = '';



            if (status === 'completed' || status === 'success') {

                pct  = 100;

                meta = '<span class="psdl-status-done"><i class="ri-checkbox-circle-fill"></i> Done</span>';

            } else if (status === 'error' || status === 'failed') {

                meta = '<span class="psdl-status-error"><i class="ri-error-warning-line"></i> Error</span>';

            } else if (status === 'waiting') {

                meta = 'Queued';

            } else {

                meta = [speed, eta].filter(Boolean).join(' &middot; ');

            }



            return '<div class="psdl-task">' +

                '<div class="psdl-task-top">' +

                    '<span class="psdl-task-name" title="' + name + '">' + name + '</span>' +

                    '<span class="psdl-task-pct">' + Math.round(pct) + '%</span>' +

                '</div>' +

                '<div class="psdl-bar-track"><div class="psdl-bar-fill" style="width:' + Math.round(pct) + '%"></div></div>' +

                '<div class="psdl-task-meta">' + (meta || '&nbsp;') + '</div>' +

            '</div>';

        }).join('');

    }



    async function _poll() {

        var ipEl = document.getElementById('ps4-ip');

        if (!ipEl) return;

        var ip = (ipEl.value || '').trim();

        if (!ip) return;



        var controller = new AbortController();

        var t = setTimeout(function () { controller.abort(); }, 4000);

        try {

            var res = await fetch('http://' + ip + ':12800/api/tasks', {

                method: 'GET',

                signal: controller.signal

            });

            clearTimeout(t);

            if (!res.ok) return;

            var data  = await res.json();

            var tasks = data.items || data.tasks || data.list || [];

            _render(tasks);



            // Stop polling when no active tasks remain

            var anyActive = tasks.some(function (tk) {

                var s = (tk.status || '').toLowerCase();

                return s !== 'completed' && s !== 'success' && s !== 'error' && s !== 'failed';

            });

            if (!anyActive && _timer) {

                clearInterval(_timer);

                _timer = null;

                // Keep panel visible for 4 s so user can see "Done", then hide

                setTimeout(function () {

                    var panel = document.getElementById('ps4-dl-panel');

                    if (panel) panel.style.display = 'none';

                }, 4000);

            }

        } catch (e) {

            clearTimeout(t);

        }

    }



    window.startTaskPolling = function () {

        if (_timer) return;

        _poll();

        _timer = setInterval(_poll, 2500);

    };



    window.stopTaskPolling = function () {

        if (_timer) { clearInterval(_timer); _timer = null; }

        var panel = document.getElementById('ps4-dl-panel');

        if (panel) panel.style.display = 'none';

    };



    window.togglePsDlPanel = function () {

        var panel = document.getElementById('ps4-dl-panel');

        var btn   = document.getElementById('psdl-toggle-btn');

        if (!panel) return;

        _minimised = !_minimised;

        panel.classList.toggle('minimised', _minimised);

        if (btn) btn.querySelector('i').className = _minimised ? 'ri-add-line' : 'ri-subtract-line';

    };

})();