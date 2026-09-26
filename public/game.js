// game.js - Secure Game Logic

let selectedLang = ''; let selectedLevel = '';
let questionsList = []; let currentQIndex = 0;
let hp = 3; let score = 0; let attempts = 0; let hintUsed = false;
let timerInterval; let timeLeft = 60;
let globalLeaderboardData = [];

// Fungsi helper: catat history
async function recordStudentHistory(isCorrect) {
    if (!currentUser.id || currentUser.role !== 'siswa') return;
    const currentQ = questionsList[currentQIndex];
    if (!currentQ || !currentQ.id) return;
    // Sudah ditangani di backend saat panggil /api/answer, tapi fungsi ini dipertahankan jika butuh
}

async function fetchQuestionsAndStart() {
    try {
        const res = await fetchWithAuth(`/api/questions?lang=${selectedLang}&level=${selectedLevel}`);
        const data = await res.json();
        if(data.length === 0) { showToast("Soal belum tersedia."); return; }
        
        questionsList = data; currentQIndex = 0; hp = 3; score = 0;
        if(bgm) { bgm.volume = 0.3; bgm.play().catch(()=>{}); }
        loadCurrentQuestion(); goToFrame('frame-04');
    } catch (e) { showToast("Gagal mengambil soal.", "error"); }
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

function startTimer() {
    clearInterval(timerInterval); timeLeft = 60;
    document.getElementById('timer-display').innerText = timeLeft;
    timerInterval = setInterval(() => {
        timeLeft--; document.getElementById('timer-display').innerText = timeLeft;
        if (timeLeft <= 0) handleTimeOut();
    }, 1000);
}
function stopTimer() { clearInterval(timerInterval); }

function handleTimeOut() {
    stopTimer(); playWrong(); attempts++; updateHUD();
    document.getElementById('game-container').classList.add('flash-red');
    setTimeout(() => document.getElementById('game-container').classList.remove('flash-red'), 500);

    if (attempts >= 5) {
        hp--; 
        if (hp <= 0) triggerAppreciation(); 
        else { showToast("Waktu habis dan gagal 5x!", "error"); showReviewFrameFallback(); }
    } else {
        showToast(`Waktu Habis! Terhitung 1x gagal.\nSisa kesempatan: ${5 - attempts}x lagi.`, "error"); startTimer();
    }
}

function loadCurrentQuestion() {
    attempts = 0; hintUsed = false; updateHUD();
    document.getElementById('hint-display').style.display = 'none'; document.getElementById('btn-hint').disabled = false;
    const editor = document.getElementById('code-editor'); editor.innerHTML = '';
    const currentQ = questionsList[currentQIndex];
    currentQ.code_lines.forEach((line, index) => {
        let div = document.createElement('div'); div.className = 'code-line';
        // HTML highlight-js friendly
        div.innerHTML = `<span style="color:#8b949e; margin-right:15px; user-select:none;">${index + 1}</span><code class="language-${selectedLang}">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`;
        div.onclick = () => handleLineClick(index);
        editor.appendChild(div);
    });
    
    // Terapkan Prism.js highlight jika diload
    if (window.Prism) {
        Prism.highlightAllUnder(editor);
    }
    
    startTimer();
}

function updateHUD() {
    let hearts = ''; for(let i=0; i<hp; i++) hearts += '♥';
    document.getElementById('hp-display').innerText = hearts;
    document.getElementById('score-display').innerText = score;
    document.getElementById('q-counter').innerText = `${currentQIndex + 1} / ${questionsList.length}`;
    document.getElementById('attempt-display').innerText = `${attempts} / 5`;
    document.getElementById('timer-display').innerText = timeLeft;
}

function useHint() {
    if(!hintUsed) {
        hintUsed = true; hp -= 1; playWrong(); 
        if (hp <= 0) { stopTimer(); triggerAppreciation(); return; }
        updateHUD();
        document.getElementById('hint-display').innerText = "💡 Hint: " + questionsList[currentQIndex].hint_text;
        document.getElementById('hint-display').style.display = 'block';
        document.getElementById('btn-hint').disabled = true;
    }
}

async function handleLineClick(index) {
    const currentQ = questionsList[currentQIndex];
    attempts++; 
    
    try {
        const res = await fetchWithAuth('/api/answer', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question_id: currentQ.id, guessed_line: index, guessed_error_type: null, 
                time_left: timeLeft, hint_used: hintUsed, attempt_count: attempts
            })
        });
        const data = await res.json();
        
        if (data.is_correct_line) {
            playCorrect(); stopTimer(); 
            currentQ.temp_guessed_line = index; 
            document.getElementById('overlay-popup').style.display = 'flex';
        } else {
            playWrong(); updateHUD();
            document.getElementById('game-container').classList.add('flash-red');
            setTimeout(() => document.getElementById('game-container').classList.remove('flash-red'), 500);
            if (attempts >= 5) {
                hp--; stopTimer(); 
                if (hp <= 0) triggerAppreciation(); 
                else { showToast("Kesempatan habis (5x Gagal)!", "error"); showReviewFrameFallback(); }
            }
        }
    } catch (e) { console.error("Gagal verifikasi baris"); }
}

async function checkErrorType(answerType) {
    const currentQ = questionsList[currentQIndex];
    try {
        const res = await fetchWithAuth('/api/answer', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question_id: currentQ.id, guessed_line: currentQ.temp_guessed_line, guessed_error_type: answerType, 
                time_left: timeLeft, hint_used: hintUsed, attempt_count: attempts
            })
        });
        const data = await res.json();
        
        if (data.is_correct) {
            playCorrect(); 
            score += data.earned_points; 
            document.getElementById('overlay-popup').style.display = 'none'; 
            
            document.getElementById('review-wrong').innerText = data.wrong_snippet;
            document.getElementById('review-right').innerText = data.right_snippet;
            document.getElementById('review-explanation').innerText = data.explanation;
            
            if (window.Prism) {
                document.getElementById('review-wrong').className = `language-${selectedLang}`;
                document.getElementById('review-right').className = `language-${selectedLang}`;
                Prism.highlightElement(document.getElementById('review-wrong'));
                Prism.highlightElement(document.getElementById('review-right'));
            }
            
            showReviewFrame(true);
        } else {
            playWrong(); attempts++; updateHUD(); document.getElementById('overlay-popup').style.display = 'none';
            if (attempts >= 5) {
                hp--; 
                if (hp <= 0) triggerAppreciation(); else { showToast("Kesempatan habis!", "error"); showReviewFrameFallback(); }
            } else {
                showToast(`Salah menebak jenis error! Sisa kesempatan: ${5 - attempts}x.`, "error"); startTimer();
            }
        }
    } catch (e) { console.error("Gagal periksa tipe error"); }
}

function showReviewFrameFallback() {
    // Karena kita tidak mendownload jawaban di awal, kalau gagal ya gagal saja.
    document.getElementById('review-wrong').innerText = "Gagal menebak.";
    document.getElementById('review-right').innerText = "Belajar lagi ya!";
    document.getElementById('review-explanation').innerText = "Kesempatanmu habis untuk soal ini.";
    showReviewFrame(false);
}

function showReviewFrame(isCorrect) {
    stopTimer(); const currentQ = questionsList[currentQIndex];
    updateHUD(); document.getElementById('review-score').innerText = score; goToFrame('frame-06');
    if (currentQIndex < questionsList.length - 1) {
        document.getElementById('btn-next-q').style.display = 'inline-block'; document.getElementById('btn-finish-q').style.display = 'none';
    } else {
        document.getElementById('btn-next-q').style.display = 'none'; document.getElementById('btn-finish-q').style.display = 'inline-block';
    }
}

function nextQuestion() { currentQIndex++; loadCurrentQuestion(); goToFrame('frame-04'); }

async function triggerAppreciation() { stopTimer(); if(bgm) bgm.pause(); document.getElementById('overlay-popup').style.display = 'none'; showAppreciation(); }

async function showAppreciation() {
    goToFrame('frame-apresiasi'); document.getElementById('final-score').innerText = score;
    let badge = 'Junior Trainee'; let icon = '🎖️';
    if (score >= 3000) { badge = 'Master Bug Hunter'; icon = '🏆'; } 
    else if (score >= 1500) { badge = 'Senior Developer'; icon = '🏅'; }
    document.getElementById('badge-title').innerText = badge; document.getElementById('badge-icon').innerText = icon;
    
    if(currentUser.id && currentUser.role !== 'guru') {
        try { await fetchWithAuth('/api/save-score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score: score, badge: badge }) }); } catch(e) {}
    }
}

function resetGameToDashboard() {
    stopTimer(); selectedLang = ''; selectedLevel = '';
    document.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('btn-lanjut').style.display = 'none'; goToFrame('frame-01');
}

async function loadLeaderboard() {
    try {
        const res = await fetchWithAuth('/api/leaderboard');
        globalLeaderboardData = await res.json();
        const searchInput = document.getElementById('search-leaderboard');
        if(searchInput) searchInput.value = '';
        renderLeaderboardTable(globalLeaderboardData);
        goToFrame('frame-leaderboard');
    } catch (e) { showToast("Gagal memuat leaderboard", "error"); }
}

function renderLeaderboardTable(data, isSearching = false) {
    const tbody = document.getElementById('leaderboard-body'); tbody.innerHTML = '';
    if (data.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#8b949e;">Belum ada data.</td></tr>'; return; }
    data.forEach((row, index) => {
        if (!isSearching && index === 10) {
            let divider = document.createElement('tr');
            divider.innerHTML = `<td colspan="4" style="text-align: center; color: #8b949e; background: #21262d; font-size: 12px; letter-spacing: 2px;">--- PERINGKAT 11 DAN SETERUSNYA ---</td>`;
            tbody.appendChild(divider);
        }
        let tr = document.createElement('tr');
        let rankColor = index < 3 ? '#e3b341' : (index < 10 ? '#3fb950' : '#c9d1d9');
        if (isSearching) { tr.style.background = 'rgba(88, 166, 255, 0.1)'; rankColor = '#58a6ff'; }
        tr.innerHTML = `
            <td style="color: ${rankColor}; font-weight: bold;">${index + 1}</td>
            <td style="color: ${isSearching ? '#58a6ff' : ''}; font-weight: ${isSearching ? 'bold' : 'normal'};">${row.username}</td>
            <td>${row.total_score}</td>
            <td>${row.badge_title}</td>
        `;
        tbody.appendChild(tr);
    });
}

function searchLeaderboard() {
    const keyword = document.getElementById('search-leaderboard').value.toLowerCase();
    if (keyword === "") { renderLeaderboardTable(globalLeaderboardData, false); return; }
    const searchedData = globalLeaderboardData.filter(row => row.username.toLowerCase().includes(keyword));
    const tbody = document.getElementById('leaderboard-body'); tbody.innerHTML = '';
    if (searchedData.length === 0) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#f85149;">Pemain tidak ditemukan.</td></tr>'; return; }
    
    globalLeaderboardData.forEach((row, index) => {
        if (row.username.toLowerCase().includes(keyword)) {
            let tr = document.createElement('tr');
            tr.style.background = 'rgba(88, 166, 255, 0.2)'; 
            tr.innerHTML = `<td style="color: #58a6ff; font-weight: bold;">${index + 1}</td><td style="color: #58a6ff; font-weight: bold;">${row.username}</td><td>${row.total_score}</td><td>${row.badge_title}</td>`;
            tbody.appendChild(tr);
        }
    });
}

async function showStudentStats() {
    if (!currentUser.id) return;
    try {
        const lang = document.getElementById('rapor-lang') ? document.getElementById('rapor-lang').value : '';
        const lvl = document.getElementById('rapor-lvl') ? document.getElementById('rapor-lvl').value : '';
        let url = `/api/student/stats/${currentUser.id}`;
        if (lang || lvl) url += `?lang=${lang}&level=${lvl}`;
        const res = await fetchWithAuth(url);
        const stats = await res.json();
        document.getElementById('stat-total').innerText = stats.total;
        document.getElementById('stat-benar').innerText = stats.benar;
        document.getElementById('stat-gagal').innerText = stats.gagal;
        document.getElementById('stat-akurasi').innerText = stats.akurasi + "%";
        goToFrame('frame-rapor');
    } catch (e) { showToast("Gagal memuat rapor belajar.", "error"); }
}

function downloadCertificate() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFillColor(13, 17, 23); doc.rect(0, 0, 297, 210, 'F');
    doc.setDrawColor(88, 166, 255); doc.setLineWidth(2); doc.rect(10, 10, 277, 190);
    doc.setTextColor(227, 179, 65); doc.setFontSize(30); doc.text("SERTIFIKAT PENCAPAIAN", 148.5, 45, { align: "center" });
    doc.setTextColor(201, 209, 217); doc.setFontSize(16); doc.text("Diberikan dengan penuh rasa bangga kepada:", 148.5, 75, { align: "center" });
    doc.setTextColor(88, 166, 255); doc.setFontSize(36); doc.text(currentUser.username.toUpperCase(), 148.5, 100, { align: "center" });
    doc.setTextColor(201, 209, 217); doc.setFontSize(16);
    const langDisplay = selectedLang ? selectedLang.toUpperCase() : "Semua Bahasa";
    const lvlDisplay = selectedLevel ? selectedLevel.charAt(0).toUpperCase() + selectedLevel.slice(1) : "Semua Level";
    doc.text(`Atas keberhasilannya menyelesaikan simulasi Code Bug Hunter (${langDisplay} - ${lvlDisplay})`, 148.5, 125, { align: "center" });
    const badge = document.getElementById('badge-title').innerText;
    const currentScore = document.getElementById('final-score').innerText;
    doc.text(`dengan Predikat: ${badge} (Skor: ${currentScore})`, 148.5, 140, { align: "center" });
    const today = new Date(); const dateStr = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.setFontSize(12); doc.text(`Diterbitkan pada: ${dateStr}`, 148.5, 175, { align: "center" });
    const fileName = `Sertifikat_${currentUser.username}_CodeBugHunter_${langDisplay}_${lvlDisplay}.pdf`;
    doc.save(fileName);
}