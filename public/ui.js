// ui.js - Mengelola Variabel Global, Audio, dan Navigasi Layar

let currentUser = { id: null, username: '', role: '' };

const bgm = document.getElementById('bgm');
const sfxClick = document.getElementById('sfx-click');
const sfxWrong = document.getElementById('sfx-wrong');
const sfxCorrect = document.getElementById('sfx-correct');

function playSFX() { 
    if(sfxClick) { sfxClick.currentTime = 0; sfxClick.play().catch(()=>{}); } 
}
function playWrong() { 
    if(sfxWrong) { sfxWrong.currentTime = 0; sfxWrong.play().catch(()=>{}); } 
}
function playCorrect() { 
    if(sfxCorrect) { sfxCorrect.currentTime = 0; sfxCorrect.play().catch(()=>{}); } 
}

function goToFrame(frameId) {
    document.querySelectorAll('.frame').forEach(f => f.classList.remove('active'));
    document.getElementById(frameId).classList.add('active');
}

// Fungsi Toast Notification Interaktif
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    // Buat elemen div baru untuk toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;

    // Masukkan ke dalam container
    container.appendChild(toast);

    // Otomatis hilang setelah 3 detik
    setTimeout(() => {
        toast.classList.add('fade-out');
        // Hapus elemen dari DOM setelah animasi fadeOut selesai (0.4 detik)
        setTimeout(() => toast.remove(), 400); 
    }, 3000);
}