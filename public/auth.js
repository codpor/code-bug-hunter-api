// auth.js - Mengelola Autentikasi Pengguna & JWT Token

// Fungsi Helper untuk memanggil API dengan Token
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    
    // Menambahkan Header Authorization ke setiap request
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };
    
    const response = await fetch(url, options);
    
    // Jika token kadaluarsa atau tidak valid, logout paksa
    if (response.status === 401 || response.status === 403) {
        showToast("Sesi habis, silakan login kembali.", "error");
        logOut();
    }
    
    return response;
}

async function simulateLogin() {
    playSFX();
    const user = document.getElementById('login-user').value;
    const pass = document.getElementById('login-pass').value;
    try {
        const res = await fetch('/api/login', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();
        if (res.ok) {
            // SIMPAN TOKEN KE LOCALSTORAGE AGAR TIDAK HILANG SAAT REFRESH
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            currentUser = data.user;
            document.getElementById('login-form').reset();
            
            if(currentUser.role === 'guru') {
                document.getElementById('guru-name').innerText = currentUser.username.toUpperCase();
                goToFrame('frame-guru');
                // ... setup guru dashboard ...
            } else {
                document.getElementById('display-username').innerText = currentUser.username.toUpperCase();
                goToFrame('frame-01');
            }
        } else { showToast("Gagal: " + data.message, "error"); }
    } catch (e) { showToast("Server error. Pastikan Node.js menyala.", "error"); }
}

// Cek status login saat halaman pertama dimuat
window.onload = function() {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    
    if (storedUser && storedToken) {
        currentUser = JSON.parse(storedUser);
        if (currentUser.role === 'guru') {
            document.getElementById('guru-name').innerText = currentUser.username.toUpperCase();
            goToFrame('frame-guru');
        } else {
            document.getElementById('display-username').innerText = currentUser.username.toUpperCase();
            goToFrame('frame-01');
        }
    }
}

function logOut() {
    if(bgm) bgm.pause();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = { id: null, username: '', role: '' };
    if (typeof stopTimer === 'function') stopTimer();
    goToFrame('frame-landing');
}
