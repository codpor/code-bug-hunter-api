const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com',
  user: '4Gkg3KNMCHKXbk4.root',
  password: 'qFDywO42YJLIh2gW',
  database: 'test',
  port: 4000,
  ssl: { 
    rejectUnauthorized: false,
    minVersion: 'TLSv1.2' 
  }
});

db.connect((err) => {
    if (err) throw err;
    console.log('✅ Terhubung ke Database MySQL Code Bug Hunter!');
});

// --- API AUTHENTICATION ---
app.post('/api/register', (req, res) => {
    const { username, email, password, role } = req.body;
    const checkQuery = 'SELECT * FROM users WHERE username = ? OR email = ?';
    db.query(checkQuery, [username, email], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (results.length > 0) return res.status(400).json({ message: 'Username/Email sudah terdaftar!' });
        
        const insertQuery = 'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)';
        db.query(insertQuery, [username, email, password, role], (err, result) => {
            if (err) return res.status(500).json({ message: 'Gagal mendaftar' });
            res.status(201).json({ message: 'Registrasi Berhasil! Silakan login.' });
        });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
    db.query(sql, [username, password], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        if (results.length > 0) {
            const user = results[0];
            res.status(200).json({ message: 'Login sukses', id: user.id, username: user.username, role: user.role });
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
    const sql = `SELECT u.username, l.total_score, l.badge_title FROM leaderboard l JOIN users u ON l.user_id = u.id ORDER BY l.total_score DESC LIMIT 10`;
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.status(200).json(results);
    });
});

// --- API CRUD GURU (MANAJEMEN SOAL) ---

// Get All Questions (With Filter)
app.get('/api/admin/questions', (req, res) => {
    const { lang, level } = req.query;
    let sql = 'SELECT * FROM questions';
    let params = [];
    
    if (lang && level) {
        sql += ' WHERE language = ? AND level = ?';
        params = [lang, level];
    }
    
    sql += ' ORDER BY id ASC';
    
    db.query(sql, params, (err, results) => {
        if (err) return res.status(500).json({ message: 'Database error' });
        res.status(200).json(results);
    });
});

// Add New Question
app.post('/api/admin/questions', (req, res) => {
    const { language, level, code_lines, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text, created_by } = req.body;
    const code_lines_json = JSON.stringify(code_lines);
    
    const sql = `INSERT INTO questions (language, level, code_lines, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text, created_by) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [language, level, code_lines_json, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text, created_by], (err, result) => {
        if (err) { console.error(err); return res.status(500).json({ message: 'Gagal menambah soal' }); }
        res.status(201).json({ message: 'Soal berhasil ditambahkan!' });
    });
});

// Update Question
app.put('/api/admin/questions/:id', (req, res) => {
    const { id } = req.params;
    const { language, level, code_lines, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text } = req.body;
    const code_lines_json = JSON.stringify(code_lines);
    
    const sql = `UPDATE questions SET language=?, level=?, code_lines=?, bug_index=?, error_type=?, wrong_snippet=?, right_snippet=?, explanation=?, hint_text=? WHERE id=?`;
    db.query(sql, [language, level, code_lines_json, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text, id], (err, result) => {
        if (err) return res.status(500).json({ message: 'Gagal mengedit soal' });
        res.status(200).json({ message: 'Soal berhasil diupdate!' });
    });
});

// Delete Question
app.delete('/api/admin/questions/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM questions WHERE id=?';
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ message: 'Gagal menghapus soal' });
        res.status(200).json({ message: 'Soal berhasil dihapus!' });
    });
});

app.listen(3000, () => {
  console.log('Server berjalan di port 3000');
});

module.exports = app;