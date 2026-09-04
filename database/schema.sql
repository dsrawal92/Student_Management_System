-- 1. Students Table
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sr_no TEXT,
    roll_no TEXT,
    class TEXT NOT NULL,
    section TEXT DEFAULT 'A',
    first_name TEXT NOT NULL,
    last_name TEXT,
    dob TEXT NOT NULL,
    gender TEXT,
    father_name TEXT,
    mother_name TEXT,
    category TEXT DEFAULT 'General',
    mobile_no TEXT,
    aadhaar_no TEXT,
    address TEXT,
    admission_date TEXT,
    status TEXT DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique SR No (Only when provided)
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_sr_no 
ON students(sr_no) 
WHERE sr_no IS NOT NULL AND sr_no != '';

-- 2. Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    att_date TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Present', 'Absent', 'Leave')),
    remarks TEXT,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(student_id, att_date)
);

-- 3. Results / Marks Table
CREATE TABLE IF NOT EXISTS results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    academic_year TEXT NOT NULL,
    exam_type TEXT NOT NULL,
    subject TEXT NOT NULL,
    project_marks REAL DEFAULT 0,
    practical_marks REAL DEFAULT 0,
    theory_marks REAL DEFAULT 0,
    total_marks REAL DEFAULT 0,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE(student_id, academic_year, exam_type, subject)
);
-- 4. School Profile Settings Table
CREATE TABLE IF NOT EXISTS school_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    school_name TEXT NOT NULL DEFAULT 'GOVERNMENT INTER COLLEGE',
    school_code TEXT DEFAULT 'SCH-240801',
    affiliation_info TEXT DEFAULT 'Affiliated to State Board',
    academic_session TEXT DEFAULT '2026-2027',
    contact_no TEXT DEFAULT '9876543210',
    email TEXT DEFAULT 'principal@school.org',
    address TEXT DEFAULT 'Main Campus, Uttarakhand',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO school_profile (id, school_name, school_code, affiliation_info, academic_session)
VALUES (1, 'GOVERNMENT INTER COLLEGE', 'SCH-240801', 'Affiliated to State Board', '2026-2027');

-- 5. System Users (Auth)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'Admin',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO users (id, username, password, role)
VALUES (1, 'admin', 'admin123', 'Admin');