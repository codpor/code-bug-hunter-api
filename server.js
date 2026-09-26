const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken'); // TAMBAHAN: Library JWT

const app = express();
const PORT = 3000;

// Rahasia untuk mengenkripsi JWT (sebaiknya ditaruh di .env)
const JWT_SECRET = process.env.JWT_SECRET || 'super_rahasia_hunter_123';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 4000,
    ssl: { rejectUnauthorized: true } // Konfigurasi TiDB Cloud
});

db.connect((err) => {
    if (err) throw err;
    console.log('✅ Terhubung ke Database TiDB Code Bug Hunter!');
});

// --- MIDDLEWARE AUTENTIKASI ---
// Fungsi ini akan mengecek apakah request memiliki Token yang valid
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"
    
    if (!token) return res.status(401).json({ message: 'Akses ditolak. Token tidak ditemukan.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Sesi tidak valid atau kadaluarsa. Silakan login ulang.' });
        req.user = user; // Menyimpan data user (id, role, dll) ke request
        next();
    });
};

// --- API AUTHENTICATION ---
app.post('/api/register', (req, res) => {
    const { username, email, password, role } = req.body;
    const checkQuery = 'SELECT * FROM users WHERE username = ? OR email = ?';
    
    db.query(checkQuery, [username, email], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (results.length > 0) return res.status(400).json({ message: 'Username/Email sudah terdaftar!' });
        
        try {
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
            const isPasswordMatch = await bcrypt.compare(password, user.password);
            
            if (isPasswordMatch) {
                // MEMBUAT TOKEN JWT
                const tokenPayload = { id: user.id, username: user.username, role: user.role };
                const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '12h' }); // Berlaku 12 Jam
                
                res.status(200).json({ 
                    message: 'Login sukses', 
                    token: accessToken, // Kirim token ke Frontend
                    user: tokenPayload
                });
            } else {
                res.status(401).json({ message: 'Username atau Password salah!' });
            }
        } else {
            res.status(401).json({ message: 'Username atau Password salah!' });
        }
    });
});

// --- API GAMEPLAY (SISWA) ---

// PERUBAHAN: Hanya mengirimkan data yang aman. Kunci jawaban (bug_index, error_type) JANGAN DIKIRIM!
app.get('/api/questions', authenticateToken, (req, res) => {
    const { lang, level } = req.query;
    const sql = 'SELECT id, language, level, code_lines, hint_text FROM questions WHERE language = ? AND level = ? ORDER BY RAND() LIMIT 10';
    db.query(sql, [lang, level], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        const questions = results.map(q => {
            try { q.code_lines = JSON.parse(q.code_lines); } catch(e) { q.code_lines = []; }
            return q; // Tidak ada bug_index atau error_type di sini!
        });
        res.status(200).json(questions);
    });
});

// TAMBAHAN: Endpoint baru untuk mengecek tebakan siswa (Server-Side Validation)
app.post('/api/answer', authenticateToken, (req, res) => {
    const { question_id, guessed_line, guessed_error_type, time_left, hint_used, attempt_count } = req.body;
    const user_id = req.user.id;

    // Ambil kunci jawaban asli dari database
    const sql = 'SELECT * FROM questions WHERE id = ?';
    db.query(sql, [question_id], (err, results) => {
        if (err || results.length === 0) return res.status(500).json({ message: 'Soal tidak ditemukan' });
        
        const question = results[0];
        let isCorrectLine = (guessed_line === question.bug_index);
        
        // Cek jika cuma minta cek baris (langkah 1)
        if (guessed_error_type === null) {
            return res.status(200).json({ is_correct_line: isCorrectLine });
        }

        // Cek jawaban lengkap (langkah 2)
        let isFullyCorrect = isCorrectLine && (guessed_error_type === question.error_type);

        // --- HITUNG SKOR DI SERVER ---
        let earnedPoints = 0;
        if (isFullyCorrect) {
            let baseScore = 0;
            if (question.level === 'mudah') baseScore = 100;
            else if (question.level === 'sedang') baseScore = 200;
            else if (question.level === 'sulit') baseScore = 300;
            
            if (hint_used) baseScore = Math.floor(baseScore / 2);
            
            let speedBonus = 0;
            if (attempt_count === 1) { // Langsung benar di percobaan pertama
                speedBonus = time_left;
            }
            earnedPoints = baseScore + speedBonus;
        }

        // Catat ke riwayat
        const historySql = 'INSERT INTO student_history (user_id, question_id, is_correct, attempts_used) VALUES (?, ?, ?, ?)';
        db.query(historySql, [user_id, question_id, isFullyCorrect ? 1 : 0, attempt_count], () => {
            // Kembalikan hasil dan pembahasan ke frontend
            res.status(200).json({
                is_correct: isFullyCorrect,
                earned_points: earnedPoints,
                wrong_snippet: question.wrong_snippet,
                right_snippet: question.right_snippet,
                explanation: question.explanation
            });
        });
    });
});

// Endpoint Save Score yang sudah dilindungi
app.post('/api/save-score', authenticateToken, (req, res) => {
    const { score, badge } = req.body;
    const user_id = req.user.id; // Menggunakan ID dari token, bukan dari request body (Mencegah pemalsuan user)
    
    // Opsional yang lebih aman: Validasi total skor dari tabel history (Agak kompleks, tapi ini opsi)
    
    const sql = 'INSERT INTO leaderboard (user_id, total_score, badge_title) VALUES (?, ?, ?)';
    db.query(sql, [user_id, score, badge], (err, result) => {
        if (err) return res.status(500).json({ message: 'Gagal menyimpan skor' });
        res.status(200).json({ message: 'Skor berhasil disimpan!' });
    });
});

app.get('/api/leaderboard', authenticateToken, (req, res) => {
    const sql = `SELECT u.username, l.total_score, l.badge_title FROM leaderboard l JOIN users u ON l.user_id = u.id ORDER BY l.total_score DESC LIMIT 10`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.status(200).json(results);
    });
});

// --- API CRUD GURU (MANAJEMEN SOAL) ---
// Terapkan middleware authenticateToken pada semua rute Admin
app.get('/api/admin/questions', authenticateToken, (req, res) => {
    if (req.user.role !== 'guru') return res.status(403).json({ message: 'Hanya Guru yang boleh akses' });
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

app.post('/api/admin/questions', authenticateToken, (req, res) => {
    if (req.user.role !== 'guru') return res.status(403).json({ message: 'Hanya Guru yang boleh akses' });
    // ... Logika Insert sama seperti sebelumnya ...
});
// (Gunakan authenticateToken di semua fungsi PUT, DELETE untuk admin)

module.exports = app;
