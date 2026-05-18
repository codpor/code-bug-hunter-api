let currentUser = { id: null, username: '', role: '' };

// Audio Elements
const bgm = document.getElementById('bgm');
const sfxClick = document.getElementById('sfx-click');
const sfxWrong = document.getElementById('sfx-wrong');
const sfxCorrect = document.getElementById('sfx-correct');

function playSFX() { if(sfxClick) { sfxClick.currentTime = 0; sfxClick.play().catch(()=>{}); } }
function playWrong() { if(sfxWrong) { sfxWrong.currentTime = 0; sfxWrong.play().catch(()=>{}); } }
function playCorrect() { if(sfxCorrect) { sfxCorrect.currentTime = 0; sfxCorrect.play().catch(()=>{}); } }

function goToFrame(frameId) {
    document.querySelectorAll('.frame').forEach(f => f.classList.remove('active'));
    document.getElementById(frameId).classList.add('active');
}

// --- AUTHENTICATION ---
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
            
            // CEK ROLE GURU ATAU SISWA
            if(currentUser.role === 'guru') {
                document.getElementById('guru-name').innerText = currentUser.username.toUpperCase();
                goToFrame('frame-guru');
                // Mengosongkan list saat pertama login agar guru milih filter dulu
                document.getElementById('admin-soal-list').innerHTML = '<p style="color: #8b949e; text-align: center; margin-top: 50px;">Silakan pilih bahasa dan tingkatan di atas untuk memuat daftar soal.</p>';
                document.getElementById('filter-lang').value = "";
                document.getElementById('filter-lvl').value = "";
            } else {
                document.getElementById('display-username').innerText = currentUser.username.toUpperCase();
                goToFrame('frame-01');
            }
        } else { alert("Gagal: " + data.message); }
    } catch (e) { alert("Server error. Pastikan Node.js menyala."); }
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
        if (res.ok) { alert(data.message); document.getElementById('register-form').reset(); goToFrame('frame-login'); }
        else { alert("Gagal: " + data.message); }
    } catch (e) { alert("Server error."); }
}

function logOut() {
    if(bgm) bgm.pause();
    currentUser = { id: null, username: '', role: '' };
    goToFrame('frame-landing');
}

// ==========================================
// CRUD GURU (MANAJEMEN SOAL DETIL)
// ==========================================

async function fetchAdminQuestions() {
    const lang = document.getElementById('filter-lang').value;
    const lvl = document.getElementById('filter-lvl').value;
    
    if(!lang || !lvl) {
        alert("Silakan pilih Bahasa dan Level terlebih dahulu!");
        return;
    }

    try {
        const res = await fetch(`/api/admin/questions?lang=${lang}&level=${lvl}`);
        const data = await res.json();
        const listContainer = document.getElementById('admin-soal-list');
        
        if (data.length === 0) {
            listContainer.innerHTML = '<p style="color: #f85149; text-align: center; margin-top: 50px;">Belum ada soal untuk kategori ini.</p>';
            return;
        }

        let html = '';
        data.forEach((q, idx) => {
            // Parsing Array Code Lines
            let codeLines = [];
            try { codeLines = JSON.parse(q.code_lines); } catch(e){}
            
            // Format kode dan highlight baris bug
            let codeHtml = codeLines.map((line, i) => {
                let isBug = (i === q.bug_index);
                let color = isBug ? '#f85149' : '#c9d1d9';
                let bg = isBug ? 'rgba(248, 81, 73, 0.1)' : 'transparent';
                return `<div style="color:${color}; background:${bg}; padding: 2px 5px;">${i+1}. ${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`;
            }).join('');

            html += `
            <div class="soal-card">
                <div class="soal-card-header">
                    <h3 style="margin: 0; color: #e3b341;">Soal #${idx+1} (ID DB: ${q.id}) - <span style="color:#58a6ff;">${q.error_type}</span></h3>
                    <div>
                        <button class="btn-sm" style="background: #58a6ff; color: #000; border:none; border-radius:3px; cursor:pointer;" onclick="editSoal(${q.id}, '${lang}', '${lvl}')">EDIT</button>
                        <button class="btn-sm" style="background: #f85149; color: #000; border:none; border-radius:3px; cursor:pointer;" onclick="deleteSoal(${q.id})">HAPUS</button>
                    </div>
                </div>
                
                <div style="display: flex; gap: 20px;">
                    <div style="flex: 1; background: #161b22; padding: 10px; border-radius: 5px; font-family: monospace; font-size:14px; overflow-x:auto;">
                        <strong style="color:#58a6ff;">Kode Program (Bug di baris merah):</strong><br>
                        ${codeHtml}
                    </div>
                    
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 10px; font-size:14px;">
                        <div style="background: #161b22; padding: 10px; border-radius: 5px;">
                            <strong style="color:#f85149;">Potongan Salah:</strong> <br><code>${q.wrong_snippet}</code>
                        </div>
                        <div style="background: #161b22; padding: 10px; border-radius: 5px;">
                            <strong style="color:#3fb950;">Potongan Benar:</strong> <br><code>${q.right_snippet}</code>
                        </div>
                        <div style="background: #161b22; padding: 10px; border-radius: 5px;">
                            <strong style="color:#c9d1d9;">Penjelasan:</strong> <br>${q.explanation}
                        </div>
                        <div style="background: rgba(227, 179, 65, 0.1); border: 1px dashed #e3b341; padding: 10px; border-radius: 5px; color:#e3b341;">
                            <strong>Hint:</strong> ${q.hint_text}
                        </div>
                    </div>
                </div>
            </div>
            `;
        });
        
        listContainer.innerHTML = html;
        
    } catch (e) { console.error("Gagal load daftar soal guru"); }
}

function openSoalModal() {
    document.getElementById('form-soal').reset();
    document.getElementById('soal-id').value = '';
    
    // Setel default dropdown sama dengan filter yang sedang aktif (jika ada)
    const activeLang = document.getElementById('filter-lang').value;
    const activeLvl = document.getElementById('filter-lvl').value;
    if(activeLang) document.getElementById('soal-lang').value = activeLang;
    if(activeLvl) document.getElementById('soal-lvl').value = activeLvl;

    document.getElementById('modal-soal-title').innerText = "TAMBAH SOAL BARU";
    document.getElementById('overlay-guru-form').style.display = 'flex';
}

function closeSoalModal() {
    document.getElementById('overlay-guru-form').style.display = 'none';
}

async function saveSoal() {
    const id = document.getElementById('soal-id').value;
    
    const rawCode = document.getElementById('soal-code').value;
    const codeLinesArr = rawCode.split('\n');

    const payload = {
        language: document.getElementById('soal-lang').value,
        level: document.getElementById('soal-lvl').value,
        error_type: document.getElementById('soal-err').value,
        code_lines: codeLinesArr,
        bug_index: parseInt(document.getElementById('soal-idx').value),
        wrong_snippet: document.getElementById('soal-wrong').value,
        right_snippet: document.getElementById('soal-right').value,
        explanation: document.getElementById('soal-exp').value,
        hint_text: document.getElementById('soal-hint').value,
        created_by: currentUser.id
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `http://localhost:3000/api/admin/questions/${id}` : 'http://localhost:3000/api/admin/questions';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if(res.ok) {
            alert(id ? "Soal berhasil diupdate!" : "Soal berhasil ditambahkan!");
            closeSoalModal();
            // Refresh tampilan soal sesuai filter yang aktif
            fetchAdminQuestions(); 
        } else { alert("Gagal menyimpan soal."); }
    } catch(e) { alert("Server error"); }
}

async function editSoal(id, lang, lvl) {
    try {
        // Ambil data spesifik dari filter yang sama
        const res = await fetch(`/api/admin/questions?lang=${lang}&level=${lvl}`);
        const data = await res.json();
        const soal = data.find(q => q.id === id);
        
        if(soal) {
            document.getElementById('soal-id').value = soal.id;
            document.getElementById('soal-lang').value = soal.language;
            document.getElementById('soal-lvl').value = soal.level;
            document.getElementById('soal-err').value = soal.error_type;
            document.getElementById('soal-idx').value = soal.bug_index;
            document.getElementById('soal-wrong').value = soal.wrong_snippet;
            document.getElementById('soal-right').value = soal.right_snippet;
            document.getElementById('soal-exp').value = soal.explanation;
            document.getElementById('soal-hint').value = soal.hint_text;
            
            let parsedLines = [];
            try { parsedLines = JSON.parse(soal.code_lines); } catch(e){}
            document.getElementById('soal-code').value = parsedLines.join('\n');

            document.getElementById('modal-soal-title').innerText = "EDIT SOAL (ID: " + id + ")";
            document.getElementById('overlay-guru-form').style.display = 'flex';
        }
    } catch(e) { alert("Gagal fetch data soal"); }
}

async function deleteSoal(id) {
    if(confirm("Yakin ingin menghapus soal ID " + id + "?")) {
        try {
            const res = await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
            if(res.ok) {
                alert("Soal berhasil dihapus!");
                fetchAdminQuestions(); // Refresh list
            }
        } catch(e) { alert("Gagal menghapus"); }
    }
}


// ==========================================
// GAMEPLAY SISWA & LEADERBOARD
// ==========================================
let selectedLang = ''; let selectedLevel = '';
let questionsList = []; let currentQIndex = 0;
let hp = 3; let score = 0; let attempts = 0; let hintUsed = false;

async function loadLeaderboard() {
    try {
        const res = await fetch('/api/leaderboard');
        const data = await res.json();
        const tbody = document.getElementById('leaderboard-body');
        tbody.innerHTML = '';
        data.forEach((row, index) => {
            let tr = document.createElement('tr');
            tr.innerHTML = `<td>${index+1}</td><td>${row.username}</td><td>${row.total_score}</td><td>${row.badge_title}</td>`;
            tbody.appendChild(tr);
        });
        goToFrame('frame-leaderboard');
    } catch (e) { alert("Gagal memuat leaderboard"); }
}

function selectLang(lang) {
    selectedLang = lang;
    document.querySelectorAll('[id^="lang-"]').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('lang-' + lang).classList.add('selected');
    checkReadyToPlay();
}
function selectLevel(level) {
    selectedLevel = level;
    document.querySelectorAll('[id^="lvl-"]').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('lvl-' + level).classList.add('selected');
    checkReadyToPlay();
}
function checkReadyToPlay() {
    if (selectedLang !== '' && selectedLevel !== '') document.getElementById('btn-lanjut').style.display = 'inline-block';
}

async function fetchQuestionsAndStart() {
    try {
        const res = await fetch(`/api/questions?lang=${selectedLang}&level=${selectedLevel}`);
        const data = await res.json();
        if(data.length === 0) { alert("Soal untuk kategori ini belum tersedia di database."); return; }
        
        questionsList = data; currentQIndex = 0; hp = 3; score = 0;
        if(bgm) { bgm.volume = 0.3; bgm.play().catch(()=>{}); }
        loadCurrentQuestion();
        goToFrame('frame-04');
    } catch (e) { alert("Gagal mengambil soal dari server."); }
}

function loadCurrentQuestion() {
    attempts = 0; hintUsed = false; updateHUD();
    document.getElementById('hint-display').style.display = 'none'; document.getElementById('btn-hint').disabled = false;
    const editor = document.getElementById('code-editor'); editor.innerHTML = '';
    const currentQ = questionsList[currentQIndex];
    currentQ.code_lines.forEach((line, index) => {
        let div = document.createElement('div'); div.className = 'code-line';
        div.innerHTML = `<span style="color:#8b949e; margin-right:15px;">${index + 1}</span>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;
        div.onclick = () => handleLineClick(index);
        editor.appendChild(div);
    });
}

function updateHUD() {
    let hearts = ''; for(let i=0; i<hp; i++) hearts += '♥';
    document.getElementById('hp-display').innerText = hearts;
    document.getElementById('score-display').innerText = score;
    document.getElementById('q-counter').innerText = `${currentQIndex + 1} / ${questionsList.length}`;
    document.getElementById('attempt-display').innerText = `${attempts} / 5`;
}

function useHint() {
    if(!hintUsed) {
        hintUsed = true; hp -= 1; playWrong(); 
        if (hp <= 0) { triggerAppreciation(); return; }
        updateHUD();
        document.getElementById('hint-display').innerText = "💡 Hint: " + questionsList[currentQIndex].hint_text;
        document.getElementById('hint-display').style.display = 'block';
        document.getElementById('btn-hint').disabled = true;
    }
}

function handleLineClick(index) {
    const currentQ = questionsList[currentQIndex];
    if (index === currentQ.bug_index) {
        playCorrect(); document.getElementById('overlay-popup').style.display = 'flex';
    } else {
        playWrong(); attempts++; updateHUD();
        document.getElementById('game-container').classList.add('flash-red');
        setTimeout(() => document.getElementById('game-container').classList.remove('flash-red'), 500);
        if (attempts >= 5) {
            hp--;
            if (hp <= 0) { triggerAppreciation(); } else {
                alert("Kesempatan habis (5x Gagal)! HP berkurang 1. Mari pelajari pembahasannya."); showReviewFrame();
            }
        }
    }
}

function checkErrorType(answerType) {
    const currentQ = questionsList[currentQIndex];
    if (answerType === currentQ.error_type) {
        playCorrect(); score += 100; document.getElementById('overlay-popup').style.display = 'none'; showReviewFrame();
    } else {
        playWrong(); attempts++; updateHUD(); document.getElementById('overlay-popup').style.display = 'none';
        if (attempts >= 5) {
            hp--;
            if (hp <= 0) triggerAppreciation(); else { alert("Kesempatan habis (5x Gagal)! HP berkurang 1. Mari pelajari pembahasannya."); showReviewFrame(); }
        }
    }
}

function showReviewFrame() {
    const currentQ = questionsList[currentQIndex];
    updateHUD(); document.getElementById('review-score').innerText = score; goToFrame('frame-06');
    document.getElementById('review-wrong').innerText = currentQ.wrong_snippet;
    document.getElementById('review-right').innerText = currentQ.right_snippet;
    document.getElementById('review-explanation').innerText = currentQ.explanation;
    if (currentQIndex < questionsList.length - 1) {
        document.getElementById('btn-next-q').style.display = 'inline-block'; document.getElementById('btn-finish-q').style.display = 'none';
    } else {
        document.getElementById('btn-next-q').style.display = 'none'; document.getElementById('btn-finish-q').style.display = 'inline-block';
    }
}

function nextQuestion() { currentQIndex++; loadCurrentQuestion(); goToFrame('frame-04'); }

async function triggerAppreciation() {
    if(bgm) bgm.pause(); document.getElementById('overlay-popup').style.display = 'none'; showAppreciation();
}

async function showAppreciation() {
    goToFrame('frame-apresiasi'); document.getElementById('final-score').innerText = score;
    let badge = 'Junior Trainee'; let icon = '🎖️';
    if (score === 1000) { badge = 'Master Bug Hunter'; icon = '🏆'; } else if (score >= 600) { badge = 'Senior Developer'; icon = '🏅'; }
    document.getElementById('badge-title').innerText = badge; document.getElementById('badge-icon').innerText = icon;
    if(currentUser.id && currentUser.role !== 'guru') {
        try {
            await fetch('/api/save-score', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser.id, score: score, badge: badge })
            });
        } catch(e) { console.log("Gagal simpan skor ke DB"); }
    }
}

function resetGameToDashboard() {
    selectedLang = ''; selectedLevel = '';
    document.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('btn-lanjut').style.display = 'none';
    goToFrame('frame-01');
}