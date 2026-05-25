// auth.js - Mengelola Autentikasi Pengguna

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
            currentUser = { id: data.id, username: data.username, role: data.role };
            document.getElementById('login-form').reset();
            
            if(currentUser.role === 'guru') {
                document.getElementById('guru-name').innerText = currentUser.username.toUpperCase();
                goToFrame('frame-guru');
                document.getElementById('admin-soal-list').innerHTML = '<p style="color: #8b949e; text-align: center; margin-top: 50px;">Silakan pilih bahasa dan tingkatan di atas untuk memuat daftar soal.</p>';
                document.getElementById('filter-lang').value = "";
                document.getElementById('filter-lvl').value = "";
            } else {
                document.getElementById('display-username').innerText = currentUser.username.toUpperCase();
                goToFrame('frame-01');
            }
        } else { showToast("Gagal: " + data.message, "error"); }
    } catch (e) { showToast("Server error. Pastikan Node.js menyala.", "error"); }
}

async function simulateRegister() {
    playSFX();
    const user = document.getElementById('reg-user').value;
    const email = document.getElementById('reg-email').value;
    const pass = document.getElementById('reg-pass').value;
    const role = document.getElementById('reg-role').value;
    try {
        const res = await fetch('/api/register', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, email: email, password: pass, role: role })
        });
        const data = await res.json();
        if (res.ok) { 
            showToast(data.message); 
            document.getElementById('register-form').reset(); 
            goToFrame('frame-login'); 
        } else { 
            showToast("Gagal: " + data.message, "error"); 
        }
    } catch (e) { showToast("Server error.", "error"); }
}

function logOut() {
    if(bgm) bgm.pause();
    currentUser = { id: null, username: '', role: '' };
    // Cek apakah fungsi stopTimer dari game.js sudah dimuat
    if (typeof stopTimer === 'function') stopTimer();
    goToFrame('frame-landing');
}