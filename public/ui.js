// ui.js - Audio Manager, Navigasi Layar & Toast Notification Interaktif

let currentUser = { id: null, username: '', role: '' };

const bgm = document.getElementById('bgm');
const sfxClick = document.getElementById('sfx-click');
const sfxWrong = document.getElementById('sfx-wrong');
const sfxCorrect = document.getElementById('sfx-correct');

let isBgmMuted = localStorage.getItem('bgm_muted') === 'true';
let isSfxMuted = localStorage.getItem('sfx_muted') === 'true';

// Inisialisasi Audio State
function initAudio() {
    if (bgm) {
        bgm.volume = 0.25;
        bgm.muted = isBgmMuted;
    }
    updateAudioIcons();
}

function updateAudioIcons() {
    const bgmBtn = document.getElementById('btn-toggle-bgm');
    const sfxBtn = document.getElementById('btn-toggle-sfx');
    if (bgmBtn) {
        bgmBtn.innerHTML = isBgmMuted ? '🔇 <span class="audio-label">BGM Off</span>' : '🎵 <span class="audio-label">BGM On</span>';
        bgmBtn.classList.toggle('muted', isBgmMuted);
    }
    if (sfxBtn) {
        sfxBtn.innerHTML = isSfxMuted ? '🔕 <span class="audio-label">SFX Off</span>' : '🔔 <span class="audio-label">SFX On</span>';
        sfxBtn.classList.toggle('muted', isSfxMuted);
    }
}

function toggleBGM() {
    isBgmMuted = !isBgmMuted;
    localStorage.setItem('bgm_muted', isBgmMuted);
    if (bgm) {
        bgm.muted = isBgmMuted;
        if (!isBgmMuted && bgm.paused && currentUser.id) {
            bgm.play().catch(() => {});
        }
    }
    updateAudioIcons();
    showToast(isBgmMuted ? "Musik latar dinonaktifkan" : "Musik latar diaktifkan", "info");
}

function toggleSFX() {
    isSfxMuted = !isSfxMuted;
    localStorage.setItem('sfx_muted', isSfxMuted);
    updateAudioIcons();
    showToast(isSfxMuted ? "Efek suara dinonaktifkan" : "Efek suara diaktifkan", "info");
}

function playSFX() { 
    if (isSfxMuted || !sfxClick) return;
    try {
        sfxClick.currentTime = 0; 
        sfxClick.play().catch(() => {}); 
    } catch(e) {}
}

function playWrong() { 
    if (isSfxMuted || !sfxWrong) return;
    try {
        sfxWrong.currentTime = 0; 
        sfxWrong.play().catch(() => {}); 
    } catch(e) {}
}

function playCorrect() { 
    if (isSfxMuted || !sfxCorrect) return;
    try {
        sfxCorrect.currentTime = 0; 
        sfxCorrect.play().catch(() => {}); 
    } catch(e) {}
}

// Navigasi Antar Frame
function goToFrame(frameId) {
    const allFrames = document.querySelectorAll('.frame');
    allFrames.forEach(f => {
        f.classList.remove('active');
    });

    const target = document.getElementById(frameId);
    if (target) {
        target.classList.add('active');
        // Scroll container to top smoothly
        const container = document.getElementById('app-main-viewport') || window;
        if (container.scrollTo) container.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Update Header Status
    updateHeaderUI(frameId);
}

function updateHeaderUI(activeFrameId) {
    const userBadge = document.getElementById('nav-user-badge');
    const navUsername = document.getElementById('nav-username');
    const navRole = document.getElementById('nav-role');
    const navLogout = document.getElementById('nav-btn-logout');

    if (currentUser && currentUser.id) {
        if (userBadge) userBadge.style.display = 'flex';
        if (navUsername) navUsername.innerText = currentUser.username;
        if (navRole) {
            navRole.innerText = currentUser.role === 'guru' ? 'GURU / DOSEN' : 'HUNTER';
            navRole.className = `role-chip role-${currentUser.role}`;
        }
        if (navLogout) navLogout.style.display = 'inline-flex';
    } else {
        if (userBadge) userBadge.style.display = 'none';
        if (navLogout) navLogout.style.display = 'none';
    }
}

// Toast Notification Interaktif
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    else if (type === 'error') icon = '❌';
    else if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <div class="toast-body">${message.replace(/\n/g, '<br>')}</div>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 400); 
    }, 3500);
}

document.addEventListener('DOMContentLoaded', () => {
    initAudio();
});