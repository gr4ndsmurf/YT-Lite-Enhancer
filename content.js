// --- 1. SETTINGS AND VARIABLES ---
let settings = {
    keySlow: 's', valSlow: 0.1,
    keyFast: 'd', valFast: 0.1,
    keyReset: 'r',
    keyWindowed: 'w' // Default
};

// Fetch settings
chrome.storage.sync.get(settings, (items) => {
    settings = items;
    updateButtonTitles(); // Update button titles when settings are loaded
});

// Listen for setting changes
chrome.storage.onChanged.addListener((changes) => {
    for (let key in changes) settings[key] = changes[key].newValue;
    updateButtonTitles(); // Update button titles when settings change
});

// --- 2. GLOBAL CSS INJECTION (Windowed Mode) ---
const globalStyle = document.createElement('style');
globalStyle.textContent = `
    body.lwf-active { overflow: hidden !important; }

    /* HIDING RULES */
    body.lwf-active #masthead-container,
    body.lwf-active #secondary,
    body.lwf-active #guide,
    body.lwf-active #below,
    body.lwf-active #chat-container,
    body.lwf-active ytd-playlist-panel-renderer 
    { display: none !important; }

    /* VIDEO PLAYER RULES */
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

// --- 3. ICONS (SVG) ---
const icons = {
    minus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    plus: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    reset: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
    windowed: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>`
};

// --- 4. CONTROL UI (Shadow DOM) ---
const controller = document.createElement('div');
controller.id = 'lite-unified-ui';
const shadow = controller.attachShadow({mode: 'open'});

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
    <button id="minus" title="Yavaşlat">${icons.minus}</button>
    <span id="display">1.00</span>
    <button id="plus" title="Hızlandır">${icons.plus}</button>
    <button id="reset" title="Sıfırla">${icons.reset}</button>
    <div class="separator"></div>
    <button id="win-btn">${icons.windowed}</button>
`;

shadow.appendChild(style);
shadow.appendChild(wrapper);

if (!document.getElementById('lite-unified-ui')) {
    document.body.appendChild(controller);
}

// References
const btnMinus = shadow.getElementById('minus');
const btnPlus = shadow.getElementById('plus');
const btnReset = shadow.getElementById('reset');
const btnWin = shadow.getElementById('win-btn');
const display = shadow.getElementById('display');

let currentVideo = null;
let hideTimer = null;
let isWindowed = false;

// --- 5. HELPER FUNCTIONS ---

function updateButtonTitles() {
    // Shows which key is assigned when hovering over buttons
    if(btnWin) btnWin.title = `Windowed Mode (${settings.keyWindowed.toUpperCase()})`;
    if(btnMinus) btnMinus.title = `Yavaşlat (${settings.keySlow.toUpperCase()})`;
    if(btnPlus) btnPlus.title = `Hızlandır (${settings.keyFast.toUpperCase()})`;
    if(btnReset) btnReset.title = `Sıfırla (${settings.keyReset.toUpperCase()})`;
}

function updateDisplay(speed) { 
    display.textContent = speed.toFixed(2); 
}

function setSpeed(video, speed) {
    const newSpeed = Math.max(0.1, Math.min(16, speed));
    video.playbackRate = newSpeed;
    updateDisplay(newSpeed);
}

function toggleWindowed() {
    isWindowed = !isWindowed;
    const body = document.body;
    
    if (isWindowed) {
        body.classList.add('lwf-active');
    } else {
        body.classList.remove('lwf-active');
    }

    window.dispatchEvent(new Event('resize'));
    if(currentVideo) {
        setTimeout(() => positionController(currentVideo), 100);
    }
}

function positionController(video) {
    // Performance: Synchronize DOM updates with render loop (CPU saving)
    window.requestAnimationFrame(() => {
        if (!video) return;
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
    // Optimization: Do not recalculate if already visible and on the same video
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
        controller.classList.remove('visible');
    }, 600);
}

// --- 6. EVENT LISTENERS ---

document.addEventListener('mouseover', (e) => {
    if (e.target.tagName === 'VIDEO') showController(e.target);
}, true);

controller.addEventListener('mouseenter', () => clearTimeout(hideTimer));
controller.addEventListener('mouseleave', hideController);
document.addEventListener('mouseout', (e) => {
    if (e.target.tagName === 'VIDEO') hideController();
});

// Button Clicks
btnMinus.addEventListener('click', (e) => { e.stopPropagation(); if(currentVideo) setSpeed(currentVideo, currentVideo.playbackRate - settings.valSlow); });
btnPlus.addEventListener('click', (e) => { e.stopPropagation(); if(currentVideo) setSpeed(currentVideo, currentVideo.playbackRate + settings.valFast); });
btnReset.addEventListener('click', (e) => { e.stopPropagation(); if(currentVideo) setSpeed(currentVideo, 1.0); });
btnWin.addEventListener('click', (e) => { e.stopPropagation(); toggleWindowed(); });

// Keyboard Control (Dynamic)
document.addEventListener('keydown', (e) => {
    const target = e.target;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

    const key = e.key.toLowerCase();

    // Windowed Mode Shortcut (Before video check to work globally)
    if (key === settings.keyWindowed) {
        if(document.querySelector('video')) toggleWindowed();
        return;
    }

    const video = currentVideo || document.querySelector('video');
    if (!video) return;

    if (key === settings.keyFast) {
        setSpeed(video, video.playbackRate + settings.valFast);
        showController(video); hideController();
    } else if (key === settings.keySlow) {
        setSpeed(video, video.playbackRate - settings.valSlow);
        showController(video); hideController();
    } else if (key === settings.keyReset) {
        setSpeed(video, 1.0);
        showController(video); hideController();
    }
});