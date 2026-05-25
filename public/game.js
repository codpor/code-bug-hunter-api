// game.js - Mengelola Logika Permainan Siswa, Skor, dan Sertifikat PDF

let selectedLang = ''; let selectedLevel = '';
let questionsList = []; let currentQIndex = 0;
let hp = 3; let score = 0; let attempts = 0; let hintUsed = false;
let timerInterval; let timeLeft = 60;

async function recordStudentHistory(isCorrect) {
    if (!currentUser.id || currentUser.role !== 'siswa') return;
    const currentQ = questionsList[currentQIndex];
    if (!currentQ || !currentQ.id) return;

    try {
        await fetch('/api/save-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                question_id: currentQ.id,
                is_correct: isCorrect ? 1 : 0,
                attempts_used: attempts
            })
        });
    } catch (e) { console.error("Gagal catat riwayat diam-diam", e); }
}

async function fetchQuestionsAndStart() {
    try {
        const res = await fetch(`/api/questions?lang=${selectedLang}&level=${selectedLevel}`);
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
        hp--; recordStudentHistory(false); // Catat Gagal
        if (hp <= 0) triggerAppreciation(); 
        else { showToast("Waktu habis dan gagal 5x!", "error"); showReviewFrame(); }
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
        div.innerHTML = `<span style="color:#8b949e; margin-right:15px;">${index + 1}</span>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}`;
        div.onclick = () => handleLineClick(index);
        editor.appendChild(div);
    });
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

function handleLineClick(index) {
    const currentQ = questionsList[currentQIndex];
    if (index === currentQ.bug_index) {
        playCorrect(); stopTimer(); document.getElementById('overlay-popup').style.display = 'flex';
    } else {
        playWrong(); attempts++; updateHUD();
        document.getElementById('game-container').classList.add('flash-red');
        setTimeout(() => document.getElementById('game-container').classList.remove('flash-red'), 500);
        if (attempts >= 5) {
            hp--; stopTimer(); recordStudentHistory(false); // Catat Gagal
            if (hp <= 0) triggerAppreciation(); 
            else { showToast("Kesempatan habis (5x Gagal)!", "error"); showReviewFrame(); }
        }
    }
}

function checkErrorType(answerType) {
    const currentQ = questionsList[currentQIndex];
    if (answerType === currentQ.error_type) {
        playCorrect(); 
        
        // --- SKOR DASAR BARU ---
        let baseScore = 0;
        if (selectedLevel === 'mudah') baseScore = 100;
        else if (selectedLevel === 'sedang') baseScore = 200;
        else if (selectedLevel === 'sulit') baseScore = 300;
        
        // Penalti 50% jika memakai Hint
        if (hintUsed) baseScore = Math.floor(baseScore / 2);
        
        // --- BONUS WAKTU (Maksimal 60 poin) ---
        let speedBonus = 0;
        // Hanya dapat bonus waktu jika langsung benar di percobaan pertama
        if (attempts === 0) {
            speedBonus = timeLeft; 
        }
        
        const earnedPoints = baseScore + speedBonus;
        score += earnedPoints; 
        
        recordStudentHistory(true); 
        document.getElementById('overlay-popup').style.display = 'none'; showReviewFrame();
    } else {
        playWrong(); attempts++; updateHUD(); document.getElementById('overlay-popup').style.display = 'none';
        if (attempts >= 5) {
            hp--; recordStudentHistory(false); 
            if (hp <= 0) triggerAppreciation(); else { showToast("Kesempatan habis!", "error"); showReviewFrame(); }
        } else {
            showToast(`Salah menebak jenis error! Sisa kesempatan: ${5 - attempts}x.`, "error"); startTimer();
        }
    }
}

async function showAppreciation() {
    goToFrame('frame-apresiasi'); document.getElementById('final-score').innerText = score;
    let badge = 'Junior Trainee'; let icon = '🎖️';
    
    // --- AMBANG BATAS BADGE BARU ---
    if (score >= 3000) { 
        badge = 'Master Bug Hunter'; 
        icon = '🏆'; 
    } 
    else if (score >= 1500) { 
        badge = 'Senior Developer'; 
        icon = '🏅'; 
    }
    
    document.getElementById('badge-title').innerText = badge; document.getElementById('badge-icon').innerText = icon;
    if(currentUser.id && currentUser.role !== 'guru') {
        try {
            await fetch('/api/save-score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: currentUser.id, score: score, badge: badge }) });
        } catch(e) {}
    }
}

function showReviewFrame() {
    stopTimer(); const currentQ = questionsList[currentQIndex];
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

async function triggerAppreciation() { stopTimer(); if(bgm) bgm.pause(); document.getElementById('overlay-popup').style.display = 'none'; showAppreciation(); }


function resetGameToDashboard() {
    stopTimer(); selectedLang = ''; selectedLevel = '';
    document.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('btn-lanjut').style.display = 'none'; goToFrame('frame-01');
}

async function loadLeaderboard() {
    try {
        const res = await fetch('/api/leaderboard');
        const data = await res.json();
        const tbody = document.getElementById('leaderboard-body'); tbody.innerHTML = '';
        data.forEach((row, index) => {
            let tr = document.createElement('tr');
            tr.innerHTML = `<td>${index+1}</td><td>${row.username}</td><td>${row.total_score}</td><td>${row.badge_title}</td>`;
            tbody.appendChild(tr);
        });
        goToFrame('frame-leaderboard');
    } catch (e) { showToast("Gagal memuat leaderboard", "error"); }
}

async function showStudentStats() {
    if (!currentUser.id) return;
    try {
        const lang = document.getElementById('rapor-lang') ? document.getElementById('rapor-lang').value : '';
        const lvl = document.getElementById('rapor-lvl') ? document.getElementById('rapor-lvl').value : '';
        
        let url = `/api/student/stats/${currentUser.id}`;
        if (lang || lvl) url += `?lang=${lang}&level=${lvl}`;

        const res = await fetch(url);
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
    
    doc.setFillColor(13, 17, 23); 
    doc.rect(0, 0, 297, 210, 'F');
    
    doc.setDrawColor(88, 166, 255);
    doc.setLineWidth(2);
    doc.rect(10, 10, 277, 190);
    
    doc.setTextColor(227, 179, 65); 
    doc.setFontSize(30);
    doc.text("SERTIFIKAT PENCAPAIAN", 148.5, 45, { align: "center" });
    
    doc.setTextColor(201, 209, 217); 
    doc.setFontSize(16);
    doc.text("Diberikan dengan penuh rasa bangga kepada:", 148.5, 75, { align: "center" });
    
    doc.setTextColor(88, 166, 255); 
    doc.setFontSize(36);
    doc.text(currentUser.username.toUpperCase(), 148.5, 100, { align: "center" });
    
    doc.setTextColor(201, 209, 217);
    doc.setFontSize(16);
    const langDisplay = selectedLang ? selectedLang.toUpperCase() : "Semua Bahasa";
    const lvlDisplay = selectedLevel ? selectedLevel.charAt(0).toUpperCase() + selectedLevel.slice(1) : "Semua Level";
    doc.text(`Atas keberhasilannya menyelesaikan simulasi Code Bug Hunter (${langDisplay} - ${lvlDisplay})`, 148.5, 125, { align: "center" });
    
    const badge = document.getElementById('badge-title').innerText;
    const currentScore = document.getElementById('final-score').innerText;
    doc.text(`dengan Predikat: ${badge} (Skor: ${currentScore})`, 148.5, 140, { align: "center" });
    
    const today = new Date();
    const dateStr = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.setFontSize(12);
    doc.text(`Diterbitkan pada: ${dateStr}`, 148.5, 175, { align: "center" });
    
    const fileName = `Sertifikat_${currentUser.username}_CodeBugHunter_${langDisplay}_${lvlDisplay}.pdf`;
    doc.save(fileName);
}