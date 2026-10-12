const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

const JWT_SECRET = process.env.JWT_SECRET || 'super_rahasia_hunter_123';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// FIX Vercel URL stripping: Gunakan parameter query dari vercel.json jika ada
app.use((req, res, next) => {
    if (req.query.api_route) {
        req.url = '/api/' + req.query.api_route;
        delete req.query.api_route;
    }
    next();
});

// TiDB Connection Pool (Serverless-Ready)
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 4000,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    ssl: {
        rejectUnauthorized: true
    }
});

// Auto-seed default Super Admin jika belum ada
async function seedSuperAdmin() {
    const checkSql = "SELECT id, role FROM users WHERE username = 'superadmin' OR role = 'superadmin' LIMIT 1";
    db.query(checkSql, async (err, results) => {
        if (!err && results.length === 0) {
            try {
                const defaultPass = 'AdminHunter#2026';
                const hashedPassword = await bcrypt.hash(defaultPass, 10);
                const insertSql = "INSERT INTO users (username, email, password, role) VALUES ('superadmin', 'admin@codebughunter.com', ?, 'superadmin')";
                db.query(insertSql, [hashedPassword], (insertErr) => {
                    if (!insertErr) {
                        console.log("👑 Akun Default Super Admin berhasil diinisialisasi (username: superadmin, password: AdminHunter#2026)!");
                    }
                });
            } catch (e) {
                console.error("Gagal auto-seed superadmin:", e.message);
            }
        }
    });
}

// Test connection pool & inisialisasi superadmin
db.getConnection((err, conn) => {
    if (err) {
        console.error("⚠️ TiDB Database Connection Warning:", err.message);
    } else {
        console.log('✅ Terhubung ke Database MySQL/TiDB Code Bug Hunter via Connection Pool!');
        conn.release();
        seedSuperAdmin();
    }
});

// Middleware Autentikasi JWT
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ message: 'Akses ditolak. Token tidak ditemukan.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Sesi tidak valid atau kadaluarsa. Silakan login ulang.' });
        req.user = user;
        next();
    });
};

// Helper RBAC (Role-Based Access Control)
const hasTeacherAccess = (role) => role === 'guru' || role === 'superadmin';
const isSuperAdmin = (role) => role === 'superadmin';

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    db.query('SELECT 1', (err) => {
        if (err) return res.status(500).json({ status: 'degraded', database: 'disconnected', error: err.message });
        res.status(200).json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
    });
});

// --- API AUTHENTICATION ---
app.post('/api/register', (req, res) => {
    const { username, email, password, role } = req.body;
    if (!username || !email || !password || !role) {
        return res.status(400).json({ message: 'Semua field wajib diisi!' });
    }

    const checkQuery = 'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1';
    
    db.query(checkQuery, [username.trim(), email.trim().toLowerCase()], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error: ' + err.message });
        if (results.length > 0) return res.status(400).json({ message: 'Username atau Email sudah terdaftar!' });
        
        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            // Pendaftaran publik hanya boleh 'siswa' atau 'guru'. Superadmin hanya lewat admin atau seed.
            const userRole = (role === 'guru') ? 'guru' : 'siswa';
            
            const insertQuery = 'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)';
            db.query(insertQuery, [username.trim(), email.trim().toLowerCase(), hashedPassword, userRole], (err, result) => {
                if (err) return res.status(500).json({ message: 'Gagal mendaftar: ' + err.message });
                res.status(201).json({ message: 'Registrasi Berhasil! Silakan login.' });
            });
        } catch (error) {
            res.status(500).json({ message: 'Gagal memproses pengamanan password.' });
        }
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Username dan Password wajib diisi!' });
    }

    const sql = 'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1';
    
    db.query(sql, [username.trim(), username.trim().toLowerCase()], async (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error: ' + err.message });
        
        if (results.length > 0) {
            const user = results[0];
            const isPasswordMatch = await bcrypt.compare(password, user.password);
            
            if (isPasswordMatch) {
                const tokenPayload = { id: user.id, username: user.username, role: user.role };
                const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '12h' });
                
                res.status(200).json({ 
                    message: 'Login sukses', 
                    token: accessToken,
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
app.get('/api/questions', authenticateToken, (req, res) => {
    const { lang, level } = req.query;
    if (!lang || !level) {
        return res.status(400).json({ message: 'Parameter bahasa dan level wajib dipilih!' });
    }

    const sql = 'SELECT id, language, level, code_lines, hint_text FROM questions WHERE language = ? AND level = ? ORDER BY RAND() LIMIT 10';
    db.query(sql, [lang, level], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error: ' + err.message });
        const questions = results.map(q => {
            try { 
                q.code_lines = typeof q.code_lines === 'string' ? JSON.parse(q.code_lines) : q.code_lines; 
            } catch(e) { 
                q.code_lines = []; 
            }
            return q;
        });
        res.status(200).json(questions);
    });
});

app.post('/api/answer', authenticateToken, (req, res) => {
    const { question_id, guessed_line, guessed_error_type, time_left, hint_used, attempt_count } = req.body;
    const user_id = req.user.id;

    const sql = 'SELECT * FROM questions WHERE id = ? LIMIT 1';
    db.query(sql, [question_id], (err, results) => {
        if (err || results.length === 0) return res.status(404).json({ message: 'Soal tidak ditemukan' });
        
        const question = results[0];
        let isCorrectLine = (guessed_line === question.bug_index);
        
        if (guessed_error_type === null || guessed_error_type === undefined) {
            return res.status(200).json({ is_correct_line: isCorrectLine });
        }

        let isFullyCorrect = isCorrectLine && (guessed_error_type === question.error_type);
        let earnedPoints = 0;
        
        if (isFullyCorrect) {
            let baseScore = 0;
            if (question.level === 'mudah') baseScore = 100;
            else if (question.level === 'sedang') baseScore = 200;
            else if (question.level === 'sulit') baseScore = 300;
            
            if (hint_used) baseScore = Math.floor(baseScore / 2);
            
            let speedBonus = 0;
            if (attempt_count === 1) {
                speedBonus = Math.max(0, Number(time_left) || 0);
            }
            earnedPoints = baseScore + speedBonus;
        }

        const historySql = 'INSERT INTO student_history (user_id, question_id, is_correct, attempts_used) VALUES (?, ?, ?, ?)';
        db.query(historySql, [user_id, question_id, isFullyCorrect ? 1 : 0, attempt_count || 1], () => {
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

app.post('/api/save-score', authenticateToken, (req, res) => {
    const { score, badge } = req.body;
    const user_id = req.user.id; 
    
    const sql = 'INSERT INTO leaderboard (user_id, total_score, badge_title) VALUES (?, ?, ?)';
    db.query(sql, [user_id, score, badge || 'Junior Trainee'], (err) => {
        if (err) return res.status(500).json({ message: 'Gagal menyimpan skor: ' + err.message });
        res.status(200).json({ message: 'Skor berhasil disimpan!' });
    });
});

app.get('/api/leaderboard', (req, res) => {
    const sql = `
        SELECT l.id, u.username, l.total_score, l.badge_title, l.created_at FROM (
            SELECT l.id, l.user_id, l.total_score, l.badge_title, l.created_at,
                   ROW_NUMBER() OVER(PARTITION BY l.user_id ORDER BY l.total_score DESC, l.id DESC) as rn
            FROM leaderboard l
        ) l
        JOIN users u ON l.user_id = u.id
        WHERE l.rn = 1
        ORDER BY l.total_score DESC
        LIMIT 10
    `;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error: ' + err.message });
        res.status(200).json(results);
    });
});

// --- API CRUD GURU & SUPER ADMIN (MANAJEMEN SOAL) ---
app.get('/api/admin/questions', authenticateToken, (req, res) => {
    if (!hasTeacherAccess(req.user.role)) return res.status(403).json({ message: 'Akses ditolak: Khusus akun Guru atau Super Admin' });
    const { lang, level } = req.query;
    let sql = 'SELECT * FROM questions';
    let params = [];
    if (lang && level) { 
        sql += ' WHERE language = ? AND level = ?'; 
        params = [lang, level]; 
    }
    sql += ' ORDER BY id DESC';
    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error: ' + err.message });
        res.status(200).json(results);
    });
});

app.post('/api/admin/questions', authenticateToken, (req, res) => {
    if (!hasTeacherAccess(req.user.role)) return res.status(403).json({ message: 'Akses ditolak: Khusus akun Guru atau Super Admin' });
    const { language, level, code_lines, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text, created_by } = req.body;
    
    if (!language || !level || !error_type || !code_lines || code_lines.length === 0) {
        return res.status(400).json({ message: 'Gagal: Data soal tidak lengkap!' });
    }

    const bugIdx = parseInt(bug_index);
    if (isNaN(bugIdx) || bugIdx < 0 || bugIdx >= code_lines.length) {
        return res.status(400).json({ message: 'Gagal: Index baris bug tidak valid!' });
    }

    const code_lines_json = JSON.stringify(code_lines);
    const sql = `INSERT INTO questions (language, level, code_lines, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [language, level, code_lines_json, bugIdx, error_type, wrong_snippet, right_snippet, explanation, hint_text, created_by || req.user.id], (err) => {
        if (err) return res.status(500).json({ message: 'Gagal menambah soal: ' + err.message });
        res.status(201).json({ message: 'Soal berhasil ditambahkan!' });
    });
});

app.put('/api/admin/questions/:id', authenticateToken, (req, res) => {
    if (!hasTeacherAccess(req.user.role)) return res.status(403).json({ message: 'Akses ditolak: Khusus akun Guru atau Super Admin' });
    const { id } = req.params;
    const { language, level, code_lines, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text } = req.body;
    
    if (!language || !level || !error_type || !code_lines || code_lines.length === 0) {
        return res.status(400).json({ message: 'Gagal: Data soal tidak lengkap!' });
    }

    const bugIdx = parseInt(bug_index);
    if (isNaN(bugIdx) || bugIdx < 0 || bugIdx >= code_lines.length) {
        return res.status(400).json({ message: 'Gagal: Index baris bug tidak valid!' });
    }

    const code_lines_json = JSON.stringify(code_lines);
    const sql = `UPDATE questions SET language=?, level=?, code_lines=?, bug_index=?, error_type=?, wrong_snippet=?, right_snippet=?, explanation=?, hint_text=? WHERE id=?`;
    db.query(sql, [language, level, code_lines_json, bugIdx, error_type, wrong_snippet, right_snippet, explanation, hint_text, id], (err) => {
        if (err) return res.status(500).json({ message: 'Gagal mengedit soal: ' + err.message });
        res.status(200).json({ message: 'Soal berhasil diperbarui!' });
    });
});

app.delete('/api/admin/questions/:id', authenticateToken, (req, res) => {
    if (!hasTeacherAccess(req.user.role)) return res.status(403).json({ message: 'Akses ditolak: Khusus akun Guru atau Super Admin' });
    const { id } = req.params;
    const sql = 'DELETE FROM questions WHERE id=?';
    db.query(sql, [id], (err) => {
        if (err) return res.status(500).json({ message: 'Gagal menghapus soal: ' + err.message });
        res.status(200).json({ message: 'Soal berhasil dihapus!' });
    });
});

app.post('/api/admin/questions/bulk', authenticateToken, (req, res) => {
    if (!hasTeacherAccess(req.user.role)) return res.status(403).json({ message: 'Akses ditolak: Khusus akun Guru atau Super Admin' });
    const questions = req.body;
    if (!Array.isArray(questions) || questions.length === 0) return res.status(400).json({ message: 'Data format array tidak valid!' });
    
    const sql = `INSERT INTO questions (language, level, code_lines, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text, created_by) VALUES ?`;
    const values = questions.map(q => [
        q.language, q.level, typeof q.code_lines === 'string' ? q.code_lines : JSON.stringify(q.code_lines),
        parseInt(q.bug_index) || 0, q.error_type, q.wrong_snippet || '', q.right_snippet || '', q.explanation || '', q.hint_text || '', req.user.id
    ]);
    
    db.query(sql, [values], (err, result) => {
        if (err) return res.status(500).json({ message: 'Gagal mengimpor soal: ' + err.message });
        res.status(201).json({ message: `${result.affectedRows} soal berhasil diimpor!` });
    });
});

// --- API STATISTIK RAPOR SISWA ---
app.get('/api/student/stats/:userId', authenticateToken, (req, res) => {
    const { lang, level } = req.query;
    let sql = `
        SELECT 
            COUNT(sh.id) as total_soal, 
            COALESCE(SUM(sh.is_correct), 0) as total_benar, 
            COALESCE(SUM(sh.attempts_used), 0) as total_gagal 
        FROM student_history sh
        JOIN questions q ON sh.question_id = q.id
        WHERE sh.user_id = ?
    `;
    const params = [req.params.userId];
    if (lang) { sql += ' AND q.language = ?'; params.push(lang); }
    if (level) { sql += ' AND q.level = ?'; params.push(level); }
    
    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error: ' + err.message });
        const stats = results[0] || {};
        const total = stats.total_soal || 0;
        const benar = stats.total_benar || 0;
        const gagal = stats.total_gagal || 0;
        const akurasi = total > 0 ? Math.round((benar / total) * 100) : 0;
        res.status(200).json({ total, benar, gagal, akurasi });
    });
});

// --- API ANALITIK EVALUASI GURU ---
app.get('/api/admin/analytics', authenticateToken, (req, res) => {
    if (!hasTeacherAccess(req.user.role)) return res.status(403).json({ message: 'Akses ditolak: Khusus akun Guru atau Super Admin' });
    const { lang, level } = req.query;
    let sql = `
        SELECT q.id, q.language, q.level, q.error_type, q.bug_index,
               COUNT(sh.id) as total_dijawab,
               COALESCE(SUM(sh.is_correct), 0) as total_benar,
               COALESCE(SUM(sh.attempts_used), 0) as total_gagal
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
        if (err) return res.status(500).json({ message: 'Database error: ' + err.message });
        res.status(200).json(results);
    });
});

// ========================================================
// --- API KHUSUS SUPER ADMIN (MANAJEMEN USER & SISTEM) ---
// ========================================================

// 1. Ambil Semua Daftar Pengguna
app.get('/api/admin/users', authenticateToken, (req, res) => {
    if (!isSuperAdmin(req.user.role)) {
        return res.status(403).json({ message: 'Akses ditolak: Khusus Super Admin' });
    }

    const sql = 'SELECT id, username, email, role, created_at FROM users ORDER BY id DESC';
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error: ' + err.message });
        res.status(200).json(results);
    });
});

// 2. Ubah Role Pengguna
app.put('/api/admin/users/:id/role', authenticateToken, (req, res) => {
    if (!isSuperAdmin(req.user.role)) {
        return res.status(403).json({ message: 'Akses ditolak: Khusus Super Admin' });
    }

    const { id } = req.params;
    const { role } = req.body;
    
    const validRoles = ['siswa', 'guru', 'superadmin'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ message: 'Role tidak valid! Harus: siswa, guru, atau superadmin' });
    }

    if (parseInt(id) === req.user.id && role !== 'superadmin') {
        return res.status(400).json({ message: 'Anda tidak dapat menurunkan role akun Anda sendiri!' });
    }

    const sql = 'UPDATE users SET role = ? WHERE id = ?';
    db.query(sql, [role, id], (err, result) => {
        if (err) return res.status(500).json({ message: 'Gagal mengubah role: ' + err.message });
        res.status(200).json({ message: `Role pengguna berhasil diubah menjadi ${role}!` });
    });
});

// 3. Reset Password Pengguna
app.put('/api/admin/users/:id/password', authenticateToken, async (req, res) => {
    if (!isSuperAdmin(req.user.role)) {
        return res.status(403).json({ message: 'Akses ditolak: Khusus Super Admin' });
    }

    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password || new_password.trim().length < 5) {
        return res.status(400).json({ message: 'Password baru minimal 5 karakter!' });
    }

    try {
        const hashedPassword = await bcrypt.hash(new_password.trim(), 10);
        const sql = 'UPDATE users SET password = ? WHERE id = ?';
        db.query(sql, [hashedPassword, id], (err, result) => {
            if (err) return res.status(500).json({ message: 'Gagal mereset password: ' + err.message });
            res.status(200).json({ message: 'Password pengguna berhasil direset!' });
        });
    } catch (e) {
        res.status(500).json({ message: 'Gagal mengenkripsi password baru' });
    }
});

// 4. Hapus Pengguna
app.delete('/api/admin/users/:id', authenticateToken, (req, res) => {
    if (!isSuperAdmin(req.user.role)) {
        return res.status(403).json({ message: 'Akses ditolak: Khusus Super Admin' });
    }

    const { id } = req.params;
    if (parseInt(id) === req.user.id) {
        return res.status(400).json({ message: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif!' });
    }

    const sql = 'DELETE FROM users WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ message: 'Gagal menghapus pengguna: ' + err.message });
        res.status(200).json({ message: 'Pengguna berhasil dihapus dari sistem!' });
    });
});

// 5. Statistik Global Sistem (Dashboard Summary)
app.get('/api/admin/system-stats', authenticateToken, (req, res) => {
    if (!isSuperAdmin(req.user.role)) {
        return res.status(403).json({ message: 'Akses ditolak: Khusus Super Admin' });
    }

    const sqlUsers = "SELECT COUNT(*) as total, SUM(role = 'siswa') as total_siswa, SUM(role = 'guru') as total_guru, SUM(role = 'superadmin') as total_admin FROM users";
    const sqlQuestions = "SELECT COUNT(*) as total_questions FROM questions";
    const sqlHistory = "SELECT COUNT(*) as total_attempts, COALESCE(SUM(is_correct), 0) as total_correct FROM student_history";
    const sqlLeaderboard = "SELECT COUNT(*) as total_ranks FROM leaderboard";

    db.query(sqlUsers, (err1, rUsers) => {
        if (err1) return res.status(500).json({ message: 'Database error' });
        db.query(sqlQuestions, (err2, rQuestions) => {
            if (err2) return res.status(500).json({ message: 'Database error' });
            db.query(sqlHistory, (err3, rHistory) => {
                if (err3) return res.status(500).json({ message: 'Database error' });
                db.query(sqlLeaderboard, (err4, rLeaderboard) => {
                    const u = rUsers[0] || {};
                    const q = rQuestions[0] || {};
                    const h = rHistory[0] || {};
                    const l = rLeaderboard[0] || {};

                    res.status(200).json({
                        total_users: u.total || 0,
                        total_siswa: u.total_siswa || 0,
                        total_guru: u.total_guru || 0,
                        total_admin: u.total_admin || 0,
                        total_questions: q.total_questions || 0,
                        total_attempts: h.total_attempts || 0,
                        total_correct: h.total_correct || 0,
                        total_ranks: l.total_ranks || 0
                    });
                });
            });
        });
    });
});

// 6. Moderasi Leaderboard (Hapus Skor Curang)
app.delete('/api/admin/leaderboard/:id', authenticateToken, (req, res) => {
    if (!isSuperAdmin(req.user.role)) {
        return res.status(403).json({ message: 'Akses ditolak: Khusus Super Admin' });
    }

    const { id } = req.params;
    const sql = 'DELETE FROM leaderboard WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ message: 'Gagal menghapus entri leaderboard: ' + err.message });
        res.status(200).json({ message: 'Entri leaderboard berhasil dihapus!' });
    });
});

// Local dev server listener
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`🚀 Code Bug Hunter Server berjalan di port ${PORT}`);
    });
}

module.exports = app;