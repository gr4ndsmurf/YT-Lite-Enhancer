// --- 1. SETTINGS AND VARIABLES ---
let settings = {
    keySlow: 's', valSlow: 0.1,
    keyFast: 'd', valFast: 0.1,
    keyReset: 'r',
    keyWindowed: 'w'
};

let currentVideo = null;
let hideTimer = null;
let isWindowed = false;
let savedPlaylistSpeed = 1.0;
let savedListId = null;
let saveTimer = null;

// UI Elements (Lazy Loaded)
let controller = null;
let shadow = null;
let display = null;
let screenshotCanvas = null; // Singleton Canvas

// --- 2. INITIALIZATION & LAZY LOADING ---

function getListId() {
    return new URLSearchParams(window.location.search).get('list');
}

// Optimization: Use sessionStorage + Strict Cleanup
function initializeSpeed() {
    const currentListId = getListId();
    const storedListId = sessionStorage.getItem('yt-lite-list-id');
    const storedSpeed = sessionStorage.getItem('yt-lite-speed');

    if (currentListId && storedListId === currentListId && storedSpeed) {
        savedListId = currentListId;
        savedPlaylistSpeed = parseFloat(storedSpeed);
        // Apply immediately if videos exist (unlikely on strict lazy load, but good safety)
        const videos = document.getElementsByTagName('video');
        for (let v of videos) v.playbackRate = savedPlaylistSpeed;
    } else {
        sessionStorage.removeItem('yt-lite-list-id');
        sessionStorage.removeItem('yt-lite-speed');
        savedListId = null;
        savedPlaylistSpeed = 1.0;
    }
}

// Optimization: Retrieve settings once
chrome.storage.sync.get(settings, (items) => {
    settings = items;
    if (controller) updateButtonTitles();
});
chrome.storage.onChanged.addListener((changes) => {
    for (let key in changes) settings[key] = changes[key].newValue;
    if (controller) updateButtonTitles();
});

// Run logic initialization
initializeSpeed();


// --- 3. UI GENERATION (LAZY) ---

function ensureGlobalStyles() {
    if (document.getElementById('yt-lite-global-style')) return;
    const globalStyle = document.createElement('style');
    globalStyle.id = 'yt-lite-global-style';
    globalStyle.textContent = `
        body.lwf-active { overflow: hidden !important; }
        body.lwf-active #masthead-container,
        body.lwf-active #secondary,
        body.lwf-active #guide,
        body.lwf-active #below,
        body.lwf-active #chat-container,
        body.lwf-active ytd-playlist-panel-renderer 
        { display: none !important; }
        body.lwf-active .html5-video-player {
            position: fixed !important; top: 0 !important; left: 0 !important;
            width: 100vw !important; height: 100vh !important;
            z-index: 2147483647 !important; background-color: #000 !important;
        }
        body.lwf-active .html5-video-container { width: 100% !important; height: 100% !important; }
        body.lwf-active video {
            width: 100% !important; height: 100% !important;
            top: 0 !important; left: 0 !important; object-fit: contain !important;
        }
        body.lwf-active .ytp-chrome-bottom {
            width: 100% !important; left: 0 !important; bottom: 0 !important;
            z-index: 2147483648 !important;
        }
        body.lwf-active .ytp-chrome-top { display: none !important; }
    `;
    document.head.appendChild(globalStyle);
}

function ensureUI() {
    if (controller) return; // Already initialized

    // Generate Icons
    const icons = {
        minus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
        plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
        reset: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        windowed: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`,
        camera: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`
    };

    controller = document.createElement('div');
    controller.id = 'lite-unified-ui';
    shadow = controller.attachShadow({mode: 'open'});

    const style = document.createElement('style');
    style.textContent = `
        :host {
            position: absolute; z-index: 2147483647;
            display: flex; align-items: center;
            background: rgba(20, 20, 20, 0.9); backdrop-filter: blur(4px);
            border-radius: 8px; padding: 4px 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: -apple-system, sans-serif;
            opacity: 0; transition: opacity 0.2s, transform 0.2s;
            pointer-events: none; transform: scale(0.95);
        }
        :host(.visible) { opacity: 1; pointer-events: auto; transform: scale(1); }
        button {
            background: transparent; border: none; color: #fff; cursor: pointer;
            padding: 4px; border-radius: 4px; display: flex;
            align-items: center; justify-content: center; transition: background 0.2s;
        }
        button:hover { background: rgba(255,255,255,0.2); color: #4db8ff; }
        #win-btn:hover { color: #55efc4; } 
        span { color: #fff; font-weight: 600; font-size: 13px; min-width: 36px; text-align: center; margin: 0 4px; user-select: none; }
        .separator { width: 1px; height: 16px; background: rgba(255,255,255,0.2); margin: 0 4px; }
    `;

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.innerHTML = `
        <button id="minus">${icons.minus}</button>
        <span id="display">1.00</span>
        <button id="plus">${icons.plus}</button>
        <button id="reset">${icons.reset}</button>
        <div class="separator"></div>
        <button id="screenshot" title="Ekran Görüntüsü">${icons.camera}</button>
        <button id="win-btn">${icons.windowed}</button>
    `;

    shadow.appendChild(style);
    shadow.appendChild(wrapper);
    document.body.appendChild(controller);

    // References
    display = shadow.getElementById('display');
    const btnMinus = shadow.getElementById('minus');
    const btnPlus = shadow.getElementById('plus');
    const btnReset = shadow.getElementById('reset');
    const btnScreenshot = shadow.getElementById('screenshot');
    const btnWin = shadow.getElementById('win-btn');

    // Event Listeners (Attached once)
    controller.addEventListener('mouseenter', () => clearTimeout(hideTimer));
    controller.addEventListener('mouseleave', hideController);
    
    btnMinus.addEventListener('click', (e) => { e.stopPropagation(); if(currentVideo) setSpeed(currentVideo, currentVideo.playbackRate - settings.valSlow); });
    btnPlus.addEventListener('click', (e) => { e.stopPropagation(); if(currentVideo) setSpeed(currentVideo, currentVideo.playbackRate + settings.valFast); });
    btnReset.addEventListener('click', (e) => { e.stopPropagation(); if(currentVideo) setSpeed(currentVideo, 1.0); });
    btnScreenshot.addEventListener('click', (e) => { e.stopPropagation(); if(currentVideo) takeScreenshot(currentVideo); });
    btnWin.addEventListener('click', (e) => { e.stopPropagation(); toggleWindowed(); });

    updateButtonTitles();
    ensureGlobalStyles(); // Also ensure CSS is present
}

function updateButtonTitles() {
    if (!shadow) return;
    const btnWin = shadow.getElementById('win-btn');
    const btnMinus = shadow.getElementById('minus');
    const btnPlus = shadow.getElementById('plus');
    const btnReset = shadow.getElementById('reset');

    if(btnWin) btnWin.title = `Windowed Mode (${settings.keyWindowed.toUpperCase()})`;
    if(btnMinus) btnMinus.title = `Yavaşlat (${settings.keySlow.toUpperCase()})`;
    if(btnPlus) btnPlus.title = `Hızlandır (${settings.keyFast.toUpperCase()})`;
    if(btnReset) btnReset.title = `Sıfırla (${settings.keyReset.toUpperCase()})`;
}

// --- 4. LOGIC & FUNCTIONS ---

function updateDisplay(speed) { 
    if (display) display.textContent = speed.toFixed(2); 
}

function setSpeed(video, speed) {
    const newSpeed = Math.max(0.1, Math.min(16, speed));
    video.playbackRate = newSpeed;
    updateDisplay(newSpeed);

    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        const currentListId = getListId();
        if (currentListId) {
            savedPlaylistSpeed = newSpeed;
            savedListId = currentListId;
            try {
                sessionStorage.setItem('yt-lite-speed', newSpeed);
                sessionStorage.setItem('yt-lite-list-id', currentListId);
            } catch (e) {}
        }
    }, 500);
}

function toggleWindowed() {
    ensureGlobalStyles();
    isWindowed = !isWindowed;
    const body = document.body;
    
    if (isWindowed) body.classList.add('lwf-active');
    else body.classList.remove('lwf-active');

    window.dispatchEvent(new Event('resize'));
    if(currentVideo) setTimeout(() => positionController(currentVideo), 100);
}

function takeScreenshot(video) {
    if (!video) return;

    // Optimization: Singleton Canvas (Reuse)
    if (!screenshotCanvas) {
        screenshotCanvas = document.createElement('canvas');
    }

    screenshotCanvas.width = video.videoWidth;
    screenshotCanvas.height = video.videoHeight;
    
    const ctx = screenshotCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0, screenshotCanvas.width, screenshotCanvas.height);
    
    try {
        screenshotCanvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `yt-frame-${Date.now()}.png`;
            link.href = url;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url); // GC
        }, 'image/png');
    } catch (e) {
        console.error('Screenshot failed:', e);
    }
}

function positionController(video) {
    window.requestAnimationFrame(() => {
        if (!video || !controller) return;
        const rect = video.getBoundingClientRect();
        let top, left;

        if (isWindowed) {
            top = 20;
            left = 20;
        } else {
            top = rect.top + window.scrollY + 10;
            left = rect.left + window.scrollX + 10;
        }
        
        controller.style.top = `${Math.max(0, top)}px`;
        controller.style.left = `${Math.max(0, left)}px`;
    });
}

function showController(video) {
    ensureUI(); // LAZY LOAD TRIGGER
    
    if (currentVideo === video && controller.classList.contains('visible')) {
        clearTimeout(hideTimer);
        return;
    }

    currentVideo = video;
    updateDisplay(video.playbackRate);
    positionController(video);
    controller.classList.add('visible');
    clearTimeout(hideTimer);
}

function hideController() {
    hideTimer = setTimeout(() => {
        if (controller) controller.classList.remove('visible');
    }, 600);
}

// --- 5. GLOBAL LISTENERS (Lightweight) ---

document.addEventListener('mouseover', (e) => {
    if (e.target.tagName === 'VIDEO') showController(e.target);
}, true);

document.addEventListener('mouseout', (e) => {
    if (e.target.tagName === 'VIDEO') hideController();
});

// Persistent Speed: Apply to new videos
document.addEventListener('loadeddata', (e) => {
    const currentListId = getListId();
    if (e.target.tagName === 'VIDEO' && currentListId && currentListId === savedListId) {
        e.target.playbackRate = savedPlaylistSpeed;
    }
}, true);

// Keyboard Control
document.addEventListener('keydown', (e) => {
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

    const key = e.key.toLowerCase();

    // Global Windowed Toggle
    if (key === settings.keyWindowed) {
        if(document.querySelector('video')) toggleWindowed();
        return;
    }

    const video = currentVideo || document.querySelector('video');
    if (!video) return;

    if (key === settings.keyFast) {
        ensureUI();
        setSpeed(video, video.playbackRate + settings.valFast);
        showController(video); hideController();
    } else if (key === settings.keySlow) {
        ensureUI();
        setSpeed(video, video.playbackRate - settings.valSlow);
        showController(video); hideController();
    } else if (key === settings.keyReset) {
        ensureUI();
        setSpeed(video, 1.0);
        showController(video); hideController();
    }
});