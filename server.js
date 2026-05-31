const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs'); // Menggunakan bcryptjs yang aman untuk Windows

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 4000,
    ssl: {
        rejectUnauthorized: true
    }
});

db.connect((err) => {
    if (err) throw err;
    console.log('✅ Terhubung ke Database MySQL Code Bug Hunter!');
});

// --- API AUTHENTICATION (UPDATED DENGAN BCRYPTJS) ---
app.post('/api/register', (req, res) => {
    const { username, email, password, role } = req.body;
    const checkQuery = 'SELECT * FROM users WHERE username = ? OR email = ?';
    
    db.query(checkQuery, [username, email], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (results.length > 0) return res.status(400).json({ message: 'Username/Email sudah terdaftar!' });
        
        try {
            // Enkripsi password sebelum disimpan ke database
            const hashedPassword = await bcrypt.hash(password, 10);
            
            const insertQuery = 'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)';
            db.query(insertQuery, [username, email, hashedPassword, role], (err, result) => {
                if (err) return res.status(500).json({ message: 'Gagal mendaftar' });
                res.status(201).json({ message: 'Registrasi Berhasil! Silakan login.' });
            });
        } catch (error) {
            res.status(500).json({ message: 'Gagal memproses pengamanan password.' });
        }
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM users WHERE username = ?';
    
    db.query(sql, [username], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        
        if (results.length > 0) {
            const user = results[0];
            
            // Bandingkan password mentah dari input dengan password terenkripsi di DB
            const isPasswordMatch = await bcrypt.compare(password, user.password);
            
            if (isPasswordMatch) {
                res.status(200).json({ message: 'Login sukses', id: user.id, username: user.username, role: user.role });
            } else {
                res.status(401).json({ message: 'Username atau Password salah!' });
            }
        } else {
            res.status(401).json({ message: 'Username atau Password salah!' });
        }
    });
});

// --- API GAMEPLAY (SISWA) ---
app.get('/api/questions', (req, res) => {
    const { lang, level } = req.query;
    const sql = 'SELECT * FROM questions WHERE language = ? AND level = ? ORDER BY RAND() LIMIT 10';
    db.query(sql, [lang, level], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        const questions = results.map(q => {
            try { q.code_lines = JSON.parse(q.code_lines); } catch(e) { q.code_lines = []; }
            return q;
        });
        res.status(200).json(questions);
    });
});

app.post('/api/save-score', (req, res) => {
    const { user_id, score, badge } = req.body;
    const sql = 'INSERT INTO leaderboard (user_id, total_score, badge_title) VALUES (?, ?, ?)';
    db.query(sql, [user_id, score, badge], (err, result) => {
        if (err) return res.status(500).json({ message: 'Gagal menyimpan skor' });
        res.status(200).json({ message: 'Skor berhasil disimpan!' });
    });
});

app.get('/api/leaderboard', (req, res) => {
    // Menggunakan fungsi ROW_NUMBER() untuk mengambil skor tertinggi tiap user
    const sql = `
        SELECT username, total_score, badge_title FROM (
            SELECT u.username, l.total_score, l.badge_title,
                   ROW_NUMBER() OVER(PARTITION BY u.id ORDER BY l.total_score DESC, l.id DESC) as rn
            FROM leaderboard l
            JOIN users u ON l.user_id = u.id
        ) t WHERE rn = 1
        ORDER BY total_score DESC
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.status(200).json(results);
    });
});

app.get('/api/leaderboard', (req, res) => {
    const sql = `SELECT u.username, l.total_score, l.badge_title FROM leaderboard l JOIN users u ON l.user_id = u.id ORDER BY l.total_score DESC LIMIT 10`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.status(200).json(results);
    });
});

// --- API CRUD GURU (MANAJEMEN SOAL) ---
app.get('/api/admin/questions', (req, res) => {
    const { lang, level } = req.query;
    let sql = 'SELECT * FROM questions';
    let params = [];
    if (lang && level) { sql += ' WHERE language = ? AND level = ?'; params = [lang, level]; }
    sql += ' ORDER BY id ASC';
    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.status(200).json(results);
    });
});

// --- API CRUD GURU (MANAJEMEN SOAL) ---

// ... (GET route biarkan seperti aslinya)

app.post('/api/admin/questions', (req, res) => {
    const { language, level, code_lines, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text, created_by } = req.body;
    
    // 1. VALIDASI DATA KOSONG
    if (!language || !level || !error_type || !code_lines || code_lines.length === 0) {
        return res.status(400).json({ message: 'Gagal: Data soal tidak lengkap!' });
    }

    // 2. VALIDASI LOGIKA INDEX (Tidak boleh minus & tidak boleh melebihi jumlah baris)
    if (bug_index < 0 || bug_index >= code_lines.length) {
        return res.status(400).json({ message: 'Gagal: Index bug tidak sesuai dengan jumlah baris kode!' });
    }

    const code_lines_json = JSON.stringify(code_lines);
    const sql = `INSERT INTO questions (language, level, code_lines, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [language, level, code_lines_json, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text, created_by], (err, result) => {
        if (err) return res.status(500).json({ message: 'Gagal menambah soal di database' });
        res.status(201).json({ message: 'Soal berhasil ditambahkan!' });
    });
});

app.put('/api/admin/questions/:id', (req, res) => {
    const { id } = req.params;
    const { language, level, code_lines, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text } = req.body;
    
    // 1. VALIDASI DATA KOSONG
    if (!language || !level || !error_type || !code_lines || code_lines.length === 0) {
        return res.status(400).json({ message: 'Gagal: Data soal tidak lengkap!' });
    }

    // 2. VALIDASI LOGIKA INDEX
    if (bug_index < 0 || bug_index >= code_lines.length) {
        return res.status(400).json({ message: 'Gagal: Index bug tidak sesuai dengan jumlah baris kode!' });
    }

    const code_lines_json = JSON.stringify(code_lines);
    const sql = `UPDATE questions SET language=?, level=?, code_lines=?, bug_index=?, error_type=?, wrong_snippet=?, right_snippet=?, explanation=?, hint_text=? WHERE id=?`;
    db.query(sql, [language, level, code_lines_json, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text, id], (err, result) => {
        if (err) return res.status(500).json({ message: 'Gagal mengedit soal di database' });
        res.status(200).json({ message: 'Soal berhasil diupdate!' });
    });
});

// ... (Sisa kode ke bawah biarkan seperti aslinya)

app.delete('/api/admin/questions/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM questions WHERE id=?';
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ message: 'Gagal menghapus soal' });
        res.status(200).json({ message: 'Soal berhasil dihapus!' });
    });
});

app.post('/api/admin/questions/bulk', (req, res) => {
    const questions = req.body;
    if (!Array.isArray(questions) || questions.length === 0) return res.status(400).json({ message: 'Data tidak valid' });
    const sql = `INSERT INTO questions (language, level, code_lines, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text, created_by) VALUES ?`;
    const values = questions.map(q => [
        q.language, q.level, typeof q.code_lines === 'string' ? q.code_lines : JSON.stringify(q.code_lines),
        q.bug_index, q.error_type, q.wrong_snippet, q.right_snippet, q.explanation, q.hint_text, q.created_by || null
    ]);
    db.query(sql, [values], (err, result) => {
        if (err) return res.status(500).json({ message: 'Gagal mengimpor soal' });
        res.status(201).json({ message: `${result.affectedRows} soal berhasil diimpor!` });
    });
});

// --- API STATISTIK RAPOR SISWA ---
app.get('/api/student/stats/:userId', (req, res) => {
    const { lang, level } = req.query;
    let sql = `
        SELECT 
            COUNT(sh.id) as total_soal, 
            SUM(sh.is_correct) as total_benar, 
            SUM(sh.attempts_used) as total_gagal 
        FROM student_history sh
        JOIN questions q ON sh.question_id = q.id
        WHERE sh.user_id = ?
    `;
    const params = [req.params.userId];
    if (lang) { sql += ' AND q.language = ?'; params.push(lang); }
    if (level) { sql += ' AND q.level = ?'; params.push(level); }
    
    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        const stats = results[0];
        const akurasi = stats.total_soal > 0 ? Math.round((stats.total_benar / stats.total_soal) * 100) : 0;
        res.status(200).json({ total: stats.total_soal || 0, benar: stats.total_benar || 0, gagal: stats.total_gagal || 0, akurasi });
    });
});

// --- API ANALITIK EVALUASI GURU ---
app.get('/api/admin/analytics', (req, res) => {
    const { lang, level } = req.query;
    let sql = `
        SELECT q.id, q.language, q.level, q.error_type, q.bug_index,
               COUNT(sh.id) as total_dijawab,
               SUM(sh.is_correct) as total_benar,
               SUM(sh.attempts_used) as total_gagal
        FROM questions q
        JOIN student_history sh ON q.id = sh.question_id
    `;
    let whereClauses = [];
    let params = [];
    if (lang) { whereClauses.push('q.language = ?'); params.push(lang); }
    if (level) { whereClauses.push('q.level = ?'); params.push(level); }
    if (whereClauses.length > 0) { sql += ' WHERE ' + whereClauses.join(' AND '); }
    
    sql += ` GROUP BY q.id ORDER BY total_gagal DESC LIMIT 10`;
    
    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.status(200).json(results);
    });
});

module.exports = app;