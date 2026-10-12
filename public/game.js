// game.js - Logika Gameplay, Editor Interaktif, HUD Arcade, & Generator Sertifikat Resmi (Tanpa Emoticon)

let selectedLang = ''; 
let selectedLevel = '';
let questionsList = []; 
let currentQIndex = 0;
let hp = 3; 
let score = 0; 
let attempts = 0; 
let hintUsed = false;
let timerInterval; 
let timeLeft = 60;
const MAX_TIME = 60;
let globalLeaderboardData = [];

// Memulai Game
async function fetchQuestionsAndStart() {
    if (!selectedLang || !selectedLevel) {
        showToast("Pilih bahasa pemrograman dan tingkat kesulitan terlebih dahulu!", "warning");
        return;
    }

    const startBtn = document.getElementById('btn-lanjut');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.innerText = "MEMUAT SOAL...";
    }

    try {
        const res = await fetchWithAuth(`/api/questions?lang=${selectedLang}&level=${selectedLevel}`);
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            showToast(errData.message || "Gagal mengambil soal dari server.", "error");
            return;
        }

        const data = await res.json();
        if (!data || data.length === 0) { 
            showToast("Belum ada soal untuk kategori ini di database.", "info"); 
            return; 
        }
        
        questionsList = data; 
        currentQIndex = 0; 
        hp = 3; 
        score = 0;

        if (bgm && !isBgmMuted) { 
            bgm.volume = 0.25; 
            bgm.play().catch(() => {}); 
        }

        goToFrame('frame-04');
        loadCurrentQuestion(); 
    } catch (e) { 
        showToast("Gagal mengambil soal. Pastikan koneksi aktif.", "error"); 
    } finally {
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerText = "LANJUT KE EDITOR";
        }
    }
}

function selectLang(lang) {
    selectedLang = lang;
    document.querySelectorAll('[id^="lang-"]').forEach(btn => btn.classList.remove('selected'));
    const btn = document.getElementById('lang-' + lang);
    if (btn) btn.classList.add('selected');
    checkReadyToPlay();
}

function selectLevel(level) {
    selectedLevel = level;
    document.querySelectorAll('[id^="lvl-"]').forEach(btn => btn.classList.remove('selected'));
    const btn = document.getElementById('lvl-' + level);
    if (btn) btn.classList.add('selected');
    checkReadyToPlay();
}

function checkReadyToPlay() {
    const btnLanjut = document.getElementById('btn-lanjut');
    if (selectedLang !== '' && selectedLevel !== '') {
        if (btnLanjut) {
            btnLanjut.style.display = 'inline-flex';
            btnLanjut.classList.add('pulse-btn');
        }
    }
}

// Timer Engine
function startTimer() {
    clearInterval(timerInterval); 
    timeLeft = MAX_TIME;
    updateTimerUI();

    timerInterval = setInterval(() => {
        timeLeft--; 
        updateTimerUI();
        if (timeLeft <= 0) {
            handleTimeOut();
        }
    }, 1000);
}

function stopTimer() { 
    clearInterval(timerInterval); 
}

function updateTimerUI() {
    const timerDisplay = document.getElementById('timer-display');
    const timerBar = document.getElementById('timer-progress-fill');
    
    if (timerDisplay) timerDisplay.innerText = timeLeft;
    
    const percent = Math.max(0, (timeLeft / MAX_TIME) * 100);
    if (timerBar) {
        timerBar.style.width = percent + '%';
        if (timeLeft <= 10) {
            timerBar.style.background = '#f85149';
        } else if (timeLeft <= 25) {
            timerBar.style.background = '#e3b341';
        } else {
            timerBar.style.background = '#3fb950';
        }
    }
}

function handleTimeOut() {
    stopTimer(); 
    playWrong(); 
    attempts++; 
    updateHUD();
    flashScreenRed();

    if (attempts >= 5) {
        hp--; 
        if (hp <= 0) {
            triggerAppreciation(); 
        } else { 
            showToast("Waktu habis dan gagal 5x berturut-turut! (-1 HP)", "error"); 
            showReviewFrameFallback(); 
        }
    } else {
        showToast(`Waktu Habis! Terhitung 1x gagal.\nSisa kesempatan: ${5 - attempts}x lagi.`, "error"); 
        startTimer();
    }
}

function flashScreenRed() {
    const container = document.getElementById('app-main-viewport') || document.body;
    container.classList.add('flash-red');
    setTimeout(() => container.classList.remove('flash-red'), 450);
}

// Load Current Question into VS Code-style Editor
function loadCurrentQuestion() {
    attempts = 0; 
    hintUsed = false; 
    updateHUD();
    
    const hintDisplay = document.getElementById('hint-display');
    const btnHint = document.getElementById('btn-hint');
    if (hintDisplay) hintDisplay.style.display = 'none'; 
    if (btnHint) btnHint.disabled = false;

    // Update Tab Filename
    const tabNameEl = document.getElementById('editor-tab-filename');
    if (tabNameEl) {
        const extMap = { python: 'main.py', javascript: 'app.js', java: 'Main.java', php: 'index.php', cpp: 'solution.cpp', css: 'style.css' };
        tabNameEl.innerText = extMap[selectedLang] || `code.${selectedLang}`;
    }

    const editor = document.getElementById('code-editor'); 
    editor.innerHTML = '';
    const currentQ = questionsList[currentQIndex];

    let codeLines = [];
    try {
        codeLines = typeof currentQ.code_lines === 'string' ? JSON.parse(currentQ.code_lines) : currentQ.code_lines;
    } catch(e) {
        codeLines = [currentQ.code_lines];
    }

    codeLines.forEach((line, index) => {
        let div = document.createElement('div'); 
        div.className = 'editor-line';
        div.id = `code-line-${index}`;
        
        div.innerHTML = `
            <span class="editor-gutter">${index + 1}</span>
            <span class="editor-code-content"><code class="language-${selectedLang}">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></span>
            <span class="line-select-indicator">CARI BUG</span>
        `;
        div.onclick = () => handleLineClick(index);
        editor.appendChild(div);
    });
    
    if (window.Prism) {
        Prism.highlightAllUnder(editor);
    }
    
    startTimer();
}

function updateHUD() {
    let heartsHtml = '<div class="hp-display-container">';
    for(let i = 0; i < hp; i++) heartsHtml += '<span class="hp-point filled"></span>';
    for(let i = hp; i < 3; i++) heartsHtml += '<span class="hp-point empty"></span>';
    heartsHtml += '</div>';

    const hpEl = document.getElementById('hp-display');
    if (hpEl) hpEl.innerHTML = heartsHtml;

    const scoreEl = document.getElementById('score-display');
    if (scoreEl) scoreEl.innerText = score.toLocaleString();

    const qCounter = document.getElementById('q-counter');
    if (qCounter) qCounter.innerText = `${currentQIndex + 1} / ${questionsList.length}`;

    const attemptEl = document.getElementById('attempt-display');
    if (attemptEl) attemptEl.innerText = `${attempts}/5`;

    const qProgress = document.getElementById('q-progress-bar');
    if (qProgress) {
        const percent = ((currentQIndex + 1) / questionsList.length) * 100;
        qProgress.style.width = percent + '%';
    }
}

function useHint() {
    if (!hintUsed) {
        hintUsed = true; 
        hp -= 1; 
        playWrong(); 
        
        if (hp <= 0) { 
            stopTimer(); 
            triggerAppreciation(); 
            return; 
        }

        updateHUD();
        const hintDisplay = document.getElementById('hint-display');
        if (hintDisplay) {
            hintDisplay.innerHTML = `<strong>Petunjuk Bantuan:</strong> ${questionsList[currentQIndex].hint_text}`;
            hintDisplay.style.display = 'block';
        }
        
        const btnHint = document.getElementById('btn-hint');
        if (btnHint) btnHint.disabled = true;
        showToast("Bantuan aktif! (-1 HP, skor dasar berkurang 50%)", "warning");
    }
}

async function handleLineClick(index) {
    const currentQ = questionsList[currentQIndex];
    attempts++; 

    const lineEl = document.getElementById(`code-line-${index}`);
    if (lineEl) lineEl.classList.add('line-clicked');
    
    try {
        const res = await fetchWithAuth('/api/answer', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question_id: currentQ.id, 
                guessed_line: index, 
                guessed_error_type: null, 
                time_left: timeLeft, 
                hint_used: hintUsed, 
                attempt_count: attempts
            })
        });
        const data = await res.json();
        
        if (data.is_correct_line) {
            playCorrect(); 
            stopTimer(); 
            currentQ.temp_guessed_line = index; 
            
            const overlayPopup = document.getElementById('overlay-popup');
            if (overlayPopup) {
                overlayPopup.style.display = 'flex';
                const lineInfo = document.getElementById('popup-line-info');
                if (lineInfo) lineInfo.innerText = `Baris #${index + 1}`;
            }
        } else {
            playWrong(); 
            updateHUD();
            flashScreenRed();

            if (lineEl) {
                lineEl.classList.add('line-wrong');
                setTimeout(() => lineEl.classList.remove('line-wrong'), 600);
            }

            if (attempts >= 5) {
                hp--; 
                stopTimer(); 
                if (hp <= 0) {
                    triggerAppreciation(); 
                } else { 
                    showToast("Kesempatan habis untuk baris ini (5x Gagal)! (-1 HP)", "error"); 
                    showReviewFrameFallback(); 
                }
            } else {
                showToast(`Bukan baris ini! Sisa kesempatan: ${5 - attempts}x lagi.`, "error");
            }
        }
    } catch (e) { 
        console.error("Gagal verifikasi baris:", e);
        showToast("Koneksi gagal saat mengecek baris", "error");
    }
}

async function checkErrorType(answerType) {
    playSFX();
    const currentQ = questionsList[currentQIndex];
    try {
        const res = await fetchWithAuth('/api/answer', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question_id: currentQ.id, 
                guessed_line: currentQ.temp_guessed_line, 
                guessed_error_type: answerType, 
                time_left: timeLeft, 
                hint_used: hintUsed, 
                attempt_count: attempts
            })
        });
        const data = await res.json();
        
        const overlayPopup = document.getElementById('overlay-popup');
        if (overlayPopup) overlayPopup.style.display = 'none';

        if (data.is_correct) {
            playCorrect(); 
            score += data.earned_points; 
            showToast(`Jawaban Benar! +${data.earned_points} Poin`, "success");
            
            document.getElementById('review-wrong').innerText = data.wrong_snippet || '-';
            document.getElementById('review-right').innerText = data.right_snippet || '-';
            document.getElementById('review-explanation').innerText = data.explanation || 'Pembahasan berhasil dimuat.';
            
            if (window.Prism) {
                document.getElementById('review-wrong').className = `language-${selectedLang}`;
                document.getElementById('review-right').className = `language-${selectedLang}`;
                Prism.highlightElement(document.getElementById('review-wrong'));
                Prism.highlightElement(document.getElementById('review-right'));
            }
            
            showReviewFrame(true);
        } else {
            playWrong(); 
            attempts++; 
            updateHUD(); 
            flashScreenRed();

            if (attempts >= 5) {
                hp--; 
                if (hp <= 0) {
                    triggerAppreciation(); 
                } else { 
                    showToast("Salah jenis error dan kesempatan habis! (-1 HP)", "error"); 
                    showReviewFrameFallback(); 
                }
            } else {
                showToast(`Jenis error salah! Sisa kesempatan: ${5 - attempts}x.`, "error"); 
                startTimer();
            }
        }
    } catch (e) { 
        console.error("Gagal periksa tipe error:", e); 
    }
}

function showReviewFrameFallback() {
    document.getElementById('review-wrong').innerText = "Gagal menemukan bug dalam 5 kesempatan.";
    document.getElementById('review-right').innerText = "Pelajari struktur sintaks dan logika bahasa ini lagi.";
    document.getElementById('review-explanation').innerText = "Kesempatanmu habis untuk soal ini. Evaluasi baris kode dengan teliti di soal berikutnya!";
    showReviewFrame(false);
}

function showReviewFrame(isCorrect) {
    stopTimer(); 
    updateHUD(); 
    document.getElementById('review-score').innerText = score.toLocaleString(); 
    goToFrame('frame-06');

    const btnNext = document.getElementById('btn-next-q');
    const btnFinish = document.getElementById('btn-finish-q');
    
    if (currentQIndex < questionsList.length - 1) {
        if (btnNext) btnNext.style.display = 'inline-flex'; 
        if (btnFinish) btnFinish.style.display = 'none';
    } else {
        if (btnNext) btnNext.style.display = 'none'; 
        if (btnFinish) btnFinish.style.display = 'inline-flex';
    }
}

function nextQuestion() { 
    currentQIndex++; 
    loadCurrentQuestion(); 
    goToFrame('frame-04'); 
}

async function triggerAppreciation() { 
    stopTimer(); 
    if (bgm) bgm.pause(); 
    const overlayPopup = document.getElementById('overlay-popup');
    if (overlayPopup) overlayPopup.style.display = 'none'; 
    showAppreciation(); 
}

async function showAppreciation() {
    goToFrame('frame-apresiasi'); 
    document.getElementById('final-score').innerText = score.toLocaleString();
    
    let badge = 'Junior Hunter'; 
    let color = '#3fb950';

    if (score >= 3000) { 
        badge = 'Master Bug Hunter'; 
        color = '#e3b341';
    } else if (score >= 1500) { 
        badge = 'Senior Developer'; 
        color = '#58a6ff';
    }

    const badgeTitleEl = document.getElementById('badge-title');
    const badgeIconEl = document.getElementById('badge-icon');
    if (badgeTitleEl) {
        badgeTitleEl.innerText = badge;
        badgeTitleEl.style.color = color;
    }
    if (badgeIconEl) {
        badgeIconEl.innerHTML = '<img src="favicon.png" class="trophy-img" alt="Code Bug Hunter Logo">';
    }
    
    if (currentUser.id && currentUser.role !== 'guru' && currentUser.role !== 'superadmin') {
        try { 
            await fetchWithAuth('/api/save-score', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ score: score, badge: badge }) 
            }); 
            showToast("Skor dan predikat Anda berhasil disimpan ke Leaderboard!", "success");
        } catch(e) {}
    }
}

function resetGameToDashboard() {
    stopTimer(); 
    selectedLang = ''; 
    selectedLevel = '';
    document.querySelectorAll('button').forEach(btn => btn.classList.remove('selected'));
    const btnLanjut = document.getElementById('btn-lanjut');
    if (btnLanjut) btnLanjut.style.display = 'none'; 
    goToFrame('frame-01');
}

// Leaderboard Screen
async function loadLeaderboard() {
    try {
        const tbody = document.getElementById('leaderboard-body');
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 30px; color:#58a6ff;">Memuat papan peringkat...</td></tr>';
        
        const res = await fetchWithAuth('/api/leaderboard');
        globalLeaderboardData = await res.json();
        
        const searchInput = document.getElementById('search-leaderboard');
        if (searchInput) searchInput.value = '';
        renderLeaderboardTable(globalLeaderboardData);
        goToFrame('frame-leaderboard');
    } catch (e) { 
        showToast("Gagal memuat leaderboard.", "error"); 
    }
}

function renderLeaderboardTable(data, isSearching = false) {
    const tbody = document.getElementById('leaderboard-body'); 
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (!data || data.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#8b949e; padding: 30px;">Belum ada catatan skor hunter.</td></tr>'; 
        return; 
    }

    data.forEach((row, index) => {
        let tr = document.createElement('tr');
        
        let rankBadge = `#${index + 1}`;
        let rowClass = '';
        if (index === 0) { rowClass = 'rank-gold'; }
        else if (index === 1) { rowClass = 'rank-silver'; }
        else if (index === 2) { rowClass = 'rank-bronze'; }

        const isCurrent = currentUser.username && row.username.toLowerCase() === currentUser.username.toLowerCase();
        if (isCurrent) rowClass += ' current-user-row';

        tr.className = rowClass;
        tr.innerHTML = `
            <td style="font-weight: bold; font-family: monospace;">${rankBadge}</td>
            <td style="font-weight: 600;">
                <span class="user-cell-name">${row.username}</span>
                ${isCurrent ? '<span class="you-pill">KAMU</span>' : ''}
            </td>
            <td style="font-weight: bold; color: #3fb950; font-family: monospace;">${(row.total_score || 0).toLocaleString()}</td>
            <td><span class="badge-pill">${row.badge_title || 'Junior Hunter'}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

function searchLeaderboard() {
    const keyword = (document.getElementById('search-leaderboard').value || '').trim().toLowerCase();
    if (keyword === "") { 
        renderLeaderboardTable(globalLeaderboardData, false); 
        return; 
    }
    const filtered = globalLeaderboardData.filter(row => row.username.toLowerCase().includes(keyword));
    renderLeaderboardTable(filtered, true);
}

// Student Stats (Rapor Akademik)
async function showStudentStats() {
    if (!currentUser.id) return;
    try {
        const lang = document.getElementById('rapor-lang') ? document.getElementById('rapor-lang').value : '';
        const lvl = document.getElementById('rapor-lvl') ? document.getElementById('rapor-lvl').value : '';
        let url = `/api/student/stats/${currentUser.id}`;
        if (lang || lvl) url += `?lang=${lang}&level=${lvl}`;
        
        const res = await fetchWithAuth(url);
        const stats = await res.json();
        
        document.getElementById('stat-total').innerText = stats.total || 0;
        document.getElementById('stat-benar').innerText = stats.benar || 0;
        document.getElementById('stat-gagal').innerText = stats.gagal || 0;
        document.getElementById('stat-akurasi').innerText = (stats.akurasi || 0) + "%";
        
        const akurasiBar = document.getElementById('stat-akurasi-bar');
        if (akurasiBar) {
            akurasiBar.style.width = (stats.akurasi || 0) + '%';
        }

        goToFrame('frame-rapor');
    } catch (e) { 
        showToast("Gagal memuat rapor belajar.", "error"); 
    }
}

// Unduh Sertifikat Resmi (jsPDF Pro Design Tanpa Emoticon)
function downloadCertificate() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        showToast("Modul cetak PDF sedang dimuat, mohon coba sesaat lagi.", "warning");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ 
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
    });

    const pageWidth = 297;
    const pageHeight = 210;

    doc.setFillColor(10, 15, 29);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    doc.setDrawColor(227, 179, 65);
    doc.setLineWidth(2.5);
    doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

    doc.setDrawColor(56, 189, 248);
    doc.setLineWidth(0.6);
    doc.rect(12, 12, pageWidth - 24, pageHeight - 24);

    doc.setTextColor(56, 189, 248);
    doc.setFontSize(11);
    doc.setFont("courier", "bold");
    doc.text("CODE BUG HUNTER // ADVANCED INTERACTIVE DEBUGGING PLATFORM", pageWidth / 2, 28, { align: 'center' });

    doc.setTextColor(227, 179, 65);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("SERTIFIKAT PENCAPAIAN", pageWidth / 2, 42, { align: 'center' });

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Sertifikat ini secara resmi diberikan atas kelulusan evaluasi debugging interaktif kepada:", pageWidth / 2, 56, { align: 'center' });

    const recipientName = (currentUser.username || "HUNTER DEVELOPER").toUpperCase();
    doc.setTextColor(248, 250, 252);
    doc.setFontSize(32);
    doc.setFont("helvetica", "bold");
    doc.text(recipientName, pageWidth / 2, 74, { align: 'center' });

    doc.setDrawColor(227, 179, 65);
    doc.setLineWidth(1);
    doc.line(75, 78, pageWidth - 75, 78);

    const langDisplay = selectedLang ? selectedLang.toUpperCase() : "MULTI-BAHASA";
    const lvlDisplay = selectedLevel ? selectedLevel.toUpperCase() : "STANDARD";
    const badge = document.getElementById('badge-title') ? document.getElementById('badge-title').innerText : 'Bug Hunter';
    const finalScore = document.getElementById('final-score') ? document.getElementById('final-score').innerText : score;

    doc.setTextColor(203, 213, 225);
    doc.setFontSize(13);
    doc.setFont("helvetica", "normal");
    const desc = `Telah membuktikan kecakapan dalam mendeteksi dan memperbaiki bug logika, sintaksis,\ndan runtime pada simulasi pemrograman ${langDisplay} tingkat ${lvlDisplay}.`;
    doc.text(desc, pageWidth / 2, 92, { align: 'center', lineHeightFactor: 1.4 });

    doc.setFillColor(15, 23, 42);
    doc.roundedRect(60, 110, pageWidth - 120, 26, 3, 3, 'F');
    doc.setDrawColor(56, 189, 248);
    doc.setLineWidth(0.5);
    doc.roundedRect(60, 110, pageWidth - 120, 26, 3, 3, 'S');

    doc.setTextColor(227, 179, 65);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`PREDIKAT PENGHARGAAN: ${badge.toUpperCase()}`, pageWidth / 2, 120, { align: 'center' });

    doc.setTextColor(52, 211, 153);
    doc.setFontSize(11);
    doc.text(`TOTAL SKOR AKHIR: ${finalScore} POIN`, pageWidth / 2, 128, { align: 'center' });

    const today = new Date();
    const dateStr = today.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const certId = `CBH-${today.getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont("courier", "normal");
    doc.text(`KODE VERIFIKASI: ${certId}`, 20, 170);
    doc.text(`STATUS EVALUASI: VERIFIED & RECORDED`, 20, 176);
    doc.text(`TERBIT PADA: ${dateStr}`, 20, 182);

    doc.setTextColor(248, 250, 252);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("DEWAN EVALUATOR", pageWidth - 55, 168, { align: 'center' });
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.5);
    doc.line(pageWidth - 85, 175, pageWidth - 25, 175);
    doc.setTextColor(56, 189, 248);
    doc.setFontSize(9);
    doc.text("Code Bug Hunter Core System", pageWidth - 55, 181, { align: 'center' });

    const filename = `Sertifikat_${recipientName.replace(/\s+/g, '_')}_CodeBugHunter.pdf`;
    doc.save(filename);
    showToast("Sertifikat berhasil diunduh!", "success");
}