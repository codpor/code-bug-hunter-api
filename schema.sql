-- ========================================================
-- CODE BUG HUNTER PRO - DATABASE SCHEMA (TiDB / MySQL)
-- ROLE-BASED ACCESS CONTROL (RBAC) + SUPER ADMIN SUPPORT
-- ========================================================

CREATE DATABASE IF NOT EXISTS code_bug_hunter;
USE code_bug_hunter;

-- 1. Tabel Users (Mendukung Siswa, Guru, dan Super Admin)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('siswa', 'guru', 'superadmin') NOT NULL DEFAULT 'siswa',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Tabel Questions (Bank Soal Multi-Bahasa)
CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    language VARCHAR(20) NOT NULL,
    level ENUM('mudah', 'sedang', 'sulit') NOT NULL,
    code_lines JSON NOT NULL,
    bug_index INT NOT NULL,
    error_type VARCHAR(50) NOT NULL,
    wrong_snippet TEXT NOT NULL,
    right_snippet TEXT NOT NULL,
    explanation TEXT NOT NULL,
    hint_text TEXT NOT NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_lang_lvl (language, level),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Tabel Student History (Riwayat Pengerjaan & Analitik)
CREATE TABLE IF NOT EXISTS student_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    question_id INT NOT NULL,
    is_correct TINYINT(1) NOT NULL DEFAULT 0,
    attempts_used INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_history (user_id),
    INDEX idx_question_history (question_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Tabel Leaderboard
CREATE TABLE IF NOT EXISTS leaderboard (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    total_score INT NOT NULL DEFAULT 0,
    badge_title VARCHAR(50) NOT NULL DEFAULT 'Junior Trainee',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_leaderboard_score (total_score DESC),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================================
-- SEED DATA CONTOH SOAL (Bisa langsung diimpor ke TiDB)
-- ========================================================
INSERT INTO questions (language, level, code_lines, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text)
SELECT 'python', 'mudah', '["def hitung_luas(panjang, lebar):", "    luas = panjang * lebar", "    return luas", "", "hasil = hitung_luas(10, 5", "print(\"Luas:\", hasil)"]', 4, 'Syntax Error', 'hasil = hitung_luas(10, 5', 'hasil = hitung_luas(10, 5)', 'Kurung tutup fungsi hitung_luas(10, 5) kurang sehingga memicu SyntaxError.', 'Perhatikan tanda kurung pemanggilan fungsi di baris 5.'
WHERE NOT EXISTS (SELECT 1 FROM questions WHERE language = 'python' AND level = 'mudah' LIMIT 1);

INSERT INTO questions (language, level, code_lines, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text)
SELECT 'javascript', 'mudah', '["function cekKelulusan(nilai) {", "    if (nilai >= 75) {", "        return \"Lulus\";", "    } else {", "        return \"Remedial\"", "    }", "}", "console.log(cekKelulusan(80));"]', 4, 'Syntax Error', 'return \"Remedial\"', 'return \"Remedial\";', 'Pernyataan return pada JavaScript sebaiknya diakhiri semicolon dan penulisan rapi.', 'Cek penutup sintaks di baris 5.'
WHERE NOT EXISTS (SELECT 1 FROM questions WHERE language = 'javascript' AND level = 'mudah' LIMIT 1);

INSERT INTO questions (language, level, code_lines, bug_index, error_type, wrong_snippet, right_snippet, explanation, hint_text)
SELECT 'python', 'sedang', '["angka = [10, 20, 30, 40]", "total = 0", "for i in range(len(angka)):", "    total += angka[i + 1]", "print(\"Rata-rata:\", total / len(angka))"]', 3, 'Runtime Error', 'total += angka[i + 1]', 'total += angka[i]', 'Mengakses indeks i + 1 saat iterasi terakhir akan menyebabkan IndexError: list index out of range.', 'Perhatikan batasan indeks array saat iterasi for loop.'
WHERE NOT EXISTS (SELECT 1 FROM questions WHERE language = 'python' AND level = 'sedang' LIMIT 1);
