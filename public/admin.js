// admin.js - Mengelola Fitur Dashboard Guru & CRUD Soal dengan Autentikasi JWT

async function fetchAdminQuestions() {
    const lang = document.getElementById('filter-lang').value;
    const lvl = document.getElementById('filter-lvl').value;
    if(!lang || !lvl) { 
        showToast("Silakan pilih Bahasa dan Level terlebih dahulu!", "info"); 
        return; 
    }

    const listContainer = document.getElementById('admin-soal-list');
    listContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #58a6ff;"><span class="spinner"></span> Memuat bank soal...</div>';

    try {
        const res = await fetchWithAuth(`/api/admin/questions?lang=${lang}&level=${lvl}`);
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            showToast(errData.message || "Gagal memuat daftar soal", "error");
            listContainer.innerHTML = `<p style="color: #f85149; text-align: center; margin-top: 30px;">${errData.message || "Akses ditolak atau sesi habis."}</p>`;
            return;
        }

        const data = await res.json();
        
        if (!data || data.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 50px 20px; background: rgba(22, 27, 34, 0.6); border-radius: 12px; border: 1px dashed #30363d;">
                    <div style="font-size: 40px; margin-bottom: 10px;">📂</div>
                    <h3 style="color: #c9d1d9; margin-bottom: 8px;">Belum ada soal untuk kategori ini</h3>
                    <p style="color: #8b949e; font-size: 14px; margin-bottom: 20px;">Bahasa: <b>${lang.toUpperCase()}</b> | Level: <b>${lvl.toUpperCase()}</b></p>
                    <button class="action-btn" onclick="playSFX(); openSoalModal()">+ Tambah Soal Pertama</button>
                </div>
            `;
            return;
        }

        let html = '';
        data.forEach((q, idx) => {
            let codeLines = [];
            try { 
                codeLines = typeof q.code_lines === 'string' ? JSON.parse(q.code_lines) : q.code_lines; 
            } catch(e) {
                codeLines = [q.code_lines];
            }

            let codeHtml = codeLines.map((line, i) => {
                let isBug = (i === q.bug_index);
                let lineClass = isBug ? 'code-line-bug' : 'code-line-normal';
                let bugMarker = isBug ? '<span class="bug-tag">BUG</span>' : '';
                return `
                    <div class="soal-preview-line ${lineClass}">
                        <span class="line-num">${i + 1}</span>
                        <span class="line-text">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
                        ${bugMarker}
                    </div>
                `;
            }).join('');

            let badgeColor = q.error_type === 'Syntax Error' ? '#ff7b72' : (q.error_type === 'Logic Error' ? '#e3b341' : '#d2a8ff');

            html += `
            <div class="soal-card">
                <div class="soal-card-header">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="badge-num">#${idx + 1}</span>
                        <span class="badge-id">ID: ${q.id}</span>
                        <span class="error-chip" style="border-color: ${badgeColor}; color: ${badgeColor};">${q.error_type}</span>
                    </div>
                    <div class="card-actions">
                        <button class="btn-sm btn-edit" onclick="playSFX(); editSoal(${q.id}, '${lang}', '${lvl}')">✏️ EDIT</button>
                        <button class="btn-sm btn-delete" onclick="playSFX(); deleteSoal(${q.id})">🗑️ HAPUS</button>
                    </div>
                </div>
                <div class="soal-card-grid">
                    <div class="soal-code-container">
                        <div class="code-box-title">💻 Cuplikan Kode Program:</div>
                        <div class="soal-code-wrapper">${codeHtml}</div>
                    </div>
                    <div class="soal-details-col">
                        <div class="detail-box box-wrong-detail">
                            <span class="detail-label text-danger">❌ Baris Salah (Index ${q.bug_index}):</span>
                            <code>${(q.wrong_snippet || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>
                        </div>
                        <div class="detail-box box-right-detail">
                            <span class="detail-label text-success">✅ Pembetulan Kode:</span>
                            <code>${(q.right_snippet || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>
                        </div>
                        <div class="detail-box box-hint-detail">
                            <span class="detail-label text-warning">💡 Hint Bantuan:</span>
                            <span>${q.hint_text || '-'}</span>
                        </div>
                        <div class="detail-box box-exp-detail">
                            <span class="detail-label">📖 Penjelasan Review:</span>
                            <p style="margin: 4px 0 0; color: #c9d1d9; font-size: 13px;">${q.explanation || '-'}</p>
                        </div>
                    </div>
                </div>
            </div>`;
        });
        listContainer.innerHTML = html;
    } catch (e) { 
        console.error("fetchAdminQuestions Error:", e); 
        showToast("Error sistem saat mengambil soal: " + e.message, "error"); 
    }
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

function closeSoalModal() { 
    document.getElementById('overlay-guru-form').style.display = 'none'; 
}

async function saveSoal() {
    playSFX();
    const id = document.getElementById('soal-id').value;
    const rawCode = document.getElementById('soal-code').value.trim();
    
    if (!rawCode) {
        showToast("Kode program tidak boleh kosong!", "error");
        return;
    }

    const lines = rawCode.split('\n');
    const bugIdx = parseInt(document.getElementById('soal-idx').value);
    
    if (isNaN(bugIdx) || bugIdx < 0 || bugIdx >= lines.length) {
        showToast(`Index bug harus antara 0 dan ${lines.length - 1} (total ${lines.length} baris)!`, "error");
        return;
    }

    const payload = {
        language: document.getElementById('soal-lang').value,
        level: document.getElementById('soal-lvl').value,
        error_type: document.getElementById('soal-err').value,
        code_lines: lines,
        bug_index: bugIdx,
        wrong_snippet: document.getElementById('soal-wrong').value.trim(),
        right_snippet: document.getElementById('soal-right').value.trim(),
        explanation: document.getElementById('soal-exp').value.trim(),
        hint_text: document.getElementById('soal-hint').value.trim(),
        created_by: currentUser.id
    };

    const url = id ? `/api/admin/questions/${id}` : '/api/admin/questions';
    try {
        const res = await fetchWithAuth(url, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if(res.ok) { 
            showToast(id ? "Soal berhasil diperbarui!" : "Soal berhasil ditambahkan!", "success"); 
            closeSoalModal(); 
            fetchAdminQuestions(); 
        } else { 
            showToast("Gagal: " + (data.message || "Terjadi kesalahan"), "error"); 
        }
    } catch(e) { 
        showToast("Server error saat menyimpan soal.", "error"); 
    }
}

async function editSoal(id, lang, lvl) {
    try {
        const res = await fetchWithAuth(`/api/admin/questions?lang=${lang}&level=${lvl}`);
        if (!res.ok) throw new Error("Gagal mengambil data soal");
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
            try { 
                parsedLines = typeof soal.code_lines === 'string' ? JSON.parse(soal.code_lines) : soal.code_lines; 
            } catch(e){
                parsedLines = [soal.code_lines];
            }
            document.getElementById('soal-code').value = parsedLines.join('\n');
            document.getElementById('modal-soal-title').innerText = "EDIT SOAL (ID: #" + id + ")";
            document.getElementById('overlay-guru-form').style.display = 'flex';
        }
    } catch(e) { 
        showToast("Gagal fetch data soal: " + e.message, "error"); 
    }
}

async function deleteSoal(id) {
    if(confirm("Apakah Anda yakin ingin menghapus soal ID #" + id + "?")) {
        try {
            const res = await fetchWithAuth(`/api/admin/questions/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if(res.ok) { 
                showToast("Soal berhasil dihapus!", "success"); 
                fetchAdminQuestions(); 
            } else {
                showToast("Gagal menghapus: " + (data.message || ""), "error");
            }
        } catch(e) { 
            showToast("Gagal menghapus soal.", "error"); 
        }
    }
}

async function exportSoal() {
    const lang = document.getElementById('filter-lang').value;
    const lvl = document.getElementById('filter-lvl').value;
    let url = '/api/admin/questions';
    if (lang && lvl) url += `?lang=${lang}&level=${lvl}`;

    try {
        const res = await fetchWithAuth(url);
        if (!res.ok) throw new Error("Gagal mengambil data soal untuk backup");
        const data = await res.json();
        if (data.length === 0) { 
            showToast("Tidak ada data soal untuk di-backup!", "info"); 
            return; 
        }
        const cleanData = data.map(q => {
            let parsedLines = [];
            try { 
                parsedLines = typeof q.code_lines === 'string' ? JSON.parse(q.code_lines) : q.code_lines; 
            } catch(e) { 
                parsedLines = [q.code_lines]; 
            }
            return {
                language: q.language, 
                level: q.level, 
                error_type: q.error_type, 
                code_lines: parsedLines,
                bug_index: q.bug_index, 
                wrong_snippet: q.wrong_snippet, 
                right_snippet: q.right_snippet,
                explanation: q.explanation, 
                hint_text: q.hint_text, 
                created_by: currentUser.id
            };
        });
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", `Backup_Soal_${lang || 'Semua'}_${lvl || 'Semua'}_${Date.now()}.json`);
        document.body.appendChild(downloadAnchorNode); 
        downloadAnchorNode.click(); 
        downloadAnchorNode.remove();
        showToast("Backup soal berhasil diunduh!", "success");
    } catch(e) { 
        showToast("Gagal memproses file backup: " + e.message, "error"); 
    }
}

function importSoal(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const questions = JSON.parse(e.target.result);
            if (!Array.isArray(questions)) throw new Error("Format JSON harus berupa Array soal!");
            const res = await fetchWithAuth('/api/admin/questions/bulk', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(questions)
            });
            const resData = await res.json();
            if(res.ok) { 
                showToast(resData.message || "Impor berhasil!", "success"); 
                fetchAdminQuestions(); 
            } else { 
                showToast("Gagal Import: " + (resData.message || ""), "error"); 
            }
        } catch (error) { 
            showToast("Gagal membaca file JSON: " + error.message, "error"); 
        }
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

        const res = await fetchWithAuth(url);
        if (!res.ok) throw new Error("Gagal memuat analitik");
        const data = await res.json();
        const tbody = document.getElementById('analytics-body');
        tbody.innerHTML = '';
        
        if(!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:#8b949e; padding: 25px;">Belum ada riwayat pengerjaan siswa pada kategori ini.</td></tr>';
        } else {
            data.forEach(row => {
                const totalDijawab = row.total_dijawab;
                const akurasi = totalDijawab > 0 ? Math.round((row.total_benar / totalDijawab) * 100) : 0;
                let akurasiColor = akurasi >= 80 ? '#3fb950' : (akurasi >= 50 ? '#e3b341' : '#f85149');
                
                let tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="font-weight: bold; color: #58a6ff;">#${row.id}</td>
                    <td style="text-transform: uppercase; font-weight: 600;">${row.language}</td>
                    <td><span class="badge-level level-${row.level}">${row.level}</span></td>
                    <td><span class="error-pill">${row.error_type}</span></td>
                    <td><b>${totalDijawab}</b> sesi</td>
                    <td style="color:#f85149; font-weight:bold;">${row.total_gagal} kali</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="progress-mini"><div class="progress-mini-bar" style="width: ${akurasi}%; background: ${akurasiColor};"></div></div>
                            <span style="color:${akurasiColor}; font-weight:bold; min-width: 38px;">${akurasi}%</span>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
        document.getElementById('overlay-analytics').style.display = 'flex';
    } catch(e) { 
        showToast("Gagal memuat analitik: " + e.message, "error"); 
    }
}