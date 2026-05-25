// admin.js - Mengelola Fitur Dashboard Guru & CRUD Soal

async function fetchAdminQuestions() {
    const lang = document.getElementById('filter-lang').value;
    const lvl = document.getElementById('filter-lvl').value;
    if(!lang || !lvl) { showToast("Silakan pilih Bahasa dan Level terlebih dahulu!"); return; }

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
            let codeLines = [];
            try { codeLines = JSON.parse(q.code_lines); } catch(e){}
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
                        <strong style="color:#58a6ff;">Kode Program:</strong><br>${codeHtml}
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
                    </div>
                </div>
            </div>`;
        });
        listContainer.innerHTML = html;
    } catch (e) { console.error(e); showToast("Error Sistem: " + e.message); }
}

function openSoalModal() {
    document.getElementById('form-soal').reset();
    document.getElementById('soal-id').value = '';
    const activeLang = document.getElementById('filter-lang').value;
    const activeLvl = document.getElementById('filter-lvl').value;
    if(activeLang) document.getElementById('soal-lang').value = activeLang;
    if(activeLvl) document.getElementById('soal-lvl').value = activeLvl;
    document.getElementById('modal-soal-title').innerText = "TAMBAH SOAL BARU";
    document.getElementById('overlay-guru-form').style.display = 'flex';
}

function closeSoalModal() { document.getElementById('overlay-guru-form').style.display = 'none'; }

async function saveSoal() {
    const id = document.getElementById('soal-id').value;
    const rawCode = document.getElementById('soal-code').value;
    const payload = {
        language: document.getElementById('soal-lang').value, level: document.getElementById('soal-lvl').value,
        error_type: document.getElementById('soal-err').value, code_lines: rawCode.split('\n'),
        bug_index: parseInt(document.getElementById('soal-idx').value),
        wrong_snippet: document.getElementById('soal-wrong').value, right_snippet: document.getElementById('soal-right').value,
        explanation: document.getElementById('soal-exp').value, hint_text: document.getElementById('soal-hint').value,
        created_by: currentUser.id
    };
    const url = id ? `/api/admin/questions/${id}` : '/api/admin/questions';
    try {
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if(res.ok) { showToast(id ? "Soal berhasil diupdate!" : "Soal berhasil ditambahkan!"); closeSoalModal(); fetchAdminQuestions(); } 
        else { showToast("Gagal menyimpan soal."); }
    } catch(e) { showToast("Server error"); }
}

async function editSoal(id, lang, lvl) {
    try {
        const res = await fetch(`/api/admin/questions?lang=${lang}&level=${lvl}`);
        const data = await res.json();
        const soal = data.find(q => q.id === id);
        if(soal) {
            document.getElementById('soal-id').value = soal.id; document.getElementById('soal-lang').value = soal.language;
            document.getElementById('soal-lvl').value = soal.level; document.getElementById('soal-err').value = soal.error_type;
            document.getElementById('soal-idx').value = soal.bug_index; document.getElementById('soal-wrong').value = soal.wrong_snippet;
            document.getElementById('soal-right').value = soal.right_snippet; document.getElementById('soal-exp').value = soal.explanation;
            document.getElementById('soal-hint').value = soal.hint_text;
            let parsedLines = []; try { parsedLines = JSON.parse(soal.code_lines); } catch(e){}
            document.getElementById('soal-code').value = parsedLines.join('\n');
            document.getElementById('modal-soal-title').innerText = "EDIT SOAL (ID: " + id + ")";
            document.getElementById('overlay-guru-form').style.display = 'flex';
        }
    } catch(e) { showToast("Gagal fetch data soal"); }
}

async function deleteSoal(id) {
    if(confirm("Yakin ingin menghapus soal ID " + id + "?")) {
        try {
            const res = await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' });
            if(res.ok) { showToast("Soal berhasil dihapus!"); fetchAdminQuestions(); }
        } catch(e) { showToast("Gagal menghapus"); }
    }
}

async function exportSoal() {
    const lang = document.getElementById('filter-lang').value;
    const lvl = document.getElementById('filter-lvl').value;
    let url = '/api/admin/questions';
    if (lang && lvl) url += `?lang=${lang}&level=${lvl}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.length === 0) { showToast("Tidak ada data soal untuk di-backup!"); return; }
        const cleanData = data.map(q => {
            let parsedLines = [];
            try { parsedLines = typeof q.code_lines === 'string' ? JSON.parse(q.code_lines) : q.code_lines; } catch(e) { parsedLines = [q.code_lines]; }
            return {
                language: q.language, level: q.level, error_type: q.error_type, code_lines: parsedLines,
                bug_index: q.bug_index, wrong_snippet: q.wrong_snippet, right_snippet: q.right_snippet,
                explanation: q.explanation, hint_text: q.hint_text, created_by: currentUser.id
            };
        });
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `Backup_Soal_${lang || 'Semua_Bahasa'}_${lvl || 'Semua_Level'}.json`);
        document.body.appendChild(downloadAnchorNode); 
        downloadAnchorNode.click(); downloadAnchorNode.remove();
    } catch(e) { showToast("Gagal memproses file backup."); }
}

function importSoal(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const questions = JSON.parse(e.target.result);
            if (!Array.isArray(questions)) throw new Error("Format harus Array");
            const res = await fetch('/api/admin/questions/bulk', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(questions)
            });
            const resData = await res.json();
            if(res.ok) { showToast(resData.message); fetchAdminQuestions(); } else { showToast("Gagal Import: " + resData.message); }
        } catch (error) { showToast("Gagal membaca file JSON."); }
    };
    reader.readAsText(file);
    event.target.value = ''; 
}

async function fetchTeacherAnalytics() {
    try {
        const lang = document.getElementById('analytics-lang') ? document.getElementById('analytics-lang').value : '';
        const lvl = document.getElementById('analytics-lvl') ? document.getElementById('analytics-lvl').value : '';
        
        let url = '/api/admin/analytics';
        if (lang || lvl) url += `?lang=${lang}&level=${lvl}`;

        const res = await fetch(url);
        const data = await res.json();
        const tbody = document.getElementById('analytics-body');
        tbody.innerHTML = '';
        
        if(data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#8b949e;">Belum ada data untuk kategori ini.</td></tr>';
        } else {
            data.forEach(row => {
                const totalDijawab = row.total_dijawab;
                const akurasi = totalDijawab > 0 ? Math.round((row.total_benar / totalDijawab) * 100) : 0;
                let akurasiColor = '#3fb950'; if(akurasi < 50) akurasiColor = '#f85149'; else if(akurasi < 80) akurasiColor = '#e3b341';
                
                let tr = document.createElement('tr');
                tr.innerHTML = `<td>#${row.id}</td><td style="text-transform: capitalize;">${row.language}</td><td style="text-transform: capitalize;">${row.level}</td><td>${row.error_type}</td><td>${totalDijawab} kali</td><td style="color:#f85149; font-weight:bold;">${row.total_gagal} kali</td><td style="color:${akurasiColor}; font-weight:bold;">${akurasi}%</td>`;
                tbody.appendChild(tr);
            });
        }
        document.getElementById('overlay-analytics').style.display = 'flex';
    } catch(e) { showToast("Gagal memuat data analitik."); }
}