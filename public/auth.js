// auth.js - Mengelola Autentikasi Pengguna & JWT Token

// Helper untuk Request API dengan Authorization Token
async function fetchWithAuth(url, options = {}) {
    const token = localStorage.getItem('token');
    
    options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };
    
    try {
        const response = await fetch(url, options);
        
        // Jika token kadaluarsa atau tidak valid, logout paksa
        if (response.status === 401 || response.status === 403) {
            showToast("Sesi Anda telah berakhir. Silakan login kembali.", "error");
            logOut();
            return response;
        }
        
        return response;
    } catch(err) {
        console.error("fetchWithAuth Network Error:", err);
        throw err;
    }
}

async function simulateLogin() {
    playSFX();
    const userField = document.getElementById('login-user');
    const passField = document.getElementById('login-pass');
    const user = userField.value.trim();
    const pass = passField.value;

    if (!user || !pass) {
        showToast("Username dan password wajib diisi!", "warning");
        return;
    }

    const submitBtn = document.querySelector('#login-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "MEMVERIFIKASI...";
    }

    try {
        const res = await fetch('/api/login', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            currentUser = data.user;
            
            showToast(`Selamat datang kembali, ${currentUser.username}!`, "success");
            document.getElementById('login-form').reset();

            // Mulai BGM jika tidak dimute
            if (bgm && !isBgmMuted) {
                bgm.volume = 0.25;
                bgm.play().catch(() => {});
            }
            
            if (currentUser.role === 'guru') {
                const guruNameEl = document.getElementById('guru-name');
                if (guruNameEl) guruNameEl.innerText = currentUser.username.toUpperCase();
                goToFrame('frame-guru');
                // Auto fetch default if filters have values
                const filterLang = document.getElementById('filter-lang');
                const filterLvl = document.getElementById('filter-lvl');
                if (filterLang && filterLvl && filterLang.value && filterLvl.value) {
                    fetchAdminQuestions();
                }
            } else {
                const dispUserEl = document.getElementById('display-username');
                if (dispUserEl) dispUserEl.innerText = currentUser.username.toUpperCase();
                goToFrame('frame-01');
            }
        } else { 
            showToast(data.message || "Username atau password salah!", "error"); 
        }
    } catch (e) { 
        showToast("Tidak dapat terhubung ke server. Periksa koneksi internet.", "error"); 
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "MASUK KE TERMINAL";
        }
    }
}

async function simulateRegister() {
    playSFX();
    const user = document.getElementById('reg-user').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const role = document.getElementById('reg-role').value;

    if (!user || !email || !pass || !role) {
        showToast("Lengkapi semua isian formulir!", "warning");
        return;
    }

    if (pass.length < 5) {
        showToast("Password minimal 5 karakter!", "warning");
        return;
    }

    const submitBtn = document.querySelector('#register-form button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerText = "MENDAFTARKAN...";
    }

    try {
        const res = await fetch('/api/register', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, email: email, password: pass, role: role })
        });
        const data = await res.json();

        if (res.ok) { 
            showToast(data.message || "Pendaftaran berhasil! Silakan login.", "success"); 
            document.getElementById('register-form').reset(); 
            goToFrame('frame-login'); 
        } else { 
            showToast("Registrasi Gagal: " + (data.message || "Terjadi kesalahan"), "error"); 
        }
    } catch (e) { 
        showToast("Gagal menghubungi server pendaftaran.", "error"); 
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerText = "DAFTAR SEKARANG";
        }
    }
}

// Inisialisasi status login saat halaman pertama dibuka
window.addEventListener('load', () => {
    initAudio();
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    
    if (storedUser && storedToken) {
        try {
            currentUser = JSON.parse(storedUser);
            if (currentUser && currentUser.id) {
                if (currentUser.role === 'guru') {
                    const guruNameEl = document.getElementById('guru-name');
                    if (guruNameEl) guruNameEl.innerText = currentUser.username.toUpperCase();
                    goToFrame('frame-guru');
                } else {
                    const dispUserEl = document.getElementById('display-username');
                    if (dispUserEl) dispUserEl.innerText = currentUser.username.toUpperCase();
                    goToFrame('frame-01');
                }
                return;
            }
        } catch(e) {
            localStorage.removeItem('user');
            localStorage.removeItem('token');
        }
    }
    goToFrame('frame-landing');
});

function logOut() {
    if (bgm) bgm.pause();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = { id: null, username: '', role: '' };
    if (typeof stopTimer === 'function') stopTimer();
    updateHeaderUI('frame-landing');
    goToFrame('frame-landing');
    showToast("Anda telah keluar dari sistem.", "info");
}
