from flask import Flask, render_template, request, jsonify, send_file
from flask_cors import CORS
import openpyxl
import io
import re
from database.db import get_db_connection, init_db

app = Flask(__name__)
CORS(app)

# Auto-check and initialize tables on launch
init_db()


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/favicon.ico')
def favicon():
    return ('', 204)

# ==========================================
# 1. SCHOOL PROFILE ENDPOINTS
# ==========================================


@app.route('/api/school-profile', methods=['GET'])
def get_school_profile():
    try:
        with get_db_connection() as conn:
            profile = conn.execute(
                "SELECT * FROM school_profile WHERE id = 1").fetchone()
            if profile:
                return jsonify({"status": "success", "profile": dict(profile)}), 200
            return jsonify({"status": "error", "message": "Profile nahi mili!"}), 404
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/school-profile', methods=['POST'])
def update_school_profile():
    try:
        data = request.json
        with get_db_connection() as conn:
            conn.execute('''
                INSERT INTO school_profile (id, school_name, affiliation_info, school_code, academic_session, contact_no, email, address)
                VALUES (1, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    school_name = excluded.school_name,
                    affiliation_info = excluded.affiliation_info,
                    school_code = excluded.school_code,
                    academic_session = excluded.academic_session,
                    contact_no = excluded.contact_no,
                    email = excluded.email,
                    address = excluded.address
            ''', (
                data.get('school_name', '').strip(),
                data.get('affiliation_info', '').strip(),
                data.get('school_code', '').strip(),
                data.get('academic_session', '').strip(),
                data.get('contact_no', '').strip(),
                data.get('email', '').strip(),
                data.get('address', '').strip().upper()
            ))
            conn.commit()
        return jsonify({"status": "success", "message": "School Profile safalta se update ho gayi!"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ==========================================
# 2. STUDENT DIRECTORY (CRUD) ENDPOINTS
# ==========================================


@app.route('/api/students', methods=['GET'])
def get_students():
    try:
        with get_db_connection() as conn:
            students = conn.execute(
                "SELECT * FROM students ORDER BY id DESC").fetchall()
            student_list = [dict(row) for row in students]
        return jsonify({"status": "success", "students": student_list}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/students', methods=['POST'])
def save_student():
    try:
        data = request.json
        student_id = data.get('student_id')
        mobile = str(data.get('mobile_no', '')).strip()
        aadhaar = str(data.get('aadhaar_no', '')).strip()

        # Clean fields
        f_name = data.get('first_name', '').strip().upper()
        l_name = data.get('last_name', '').strip().upper()
        s_class = data.get('class', '').strip()
        s_dob = data.get('dob', '').strip()
        father = data.get('father_name', '').strip().upper()

        # SR No: agar blank ho toh database me None (NULL) store hoga
        raw_sr = data.get('sr_no', '').strip().upper()
        sr_no = raw_sr if raw_sr else None

        # Mandatory fields validation
        if not f_name or not s_class or not s_dob:
            return jsonify({"status": "error", "message": "First Name, Class aur Date of Birth bharna zaroori hai!"}), 400

        if mobile and not re.fullmatch(r'\d{10}', mobile):
            return jsonify({"status": "error", "message": "Mobile number strictly 10 digits ka hona chahiye!"}), 400
        if aadhaar and not re.fullmatch(r'\d{12}', aadhaar):
            return jsonify({"status": "error", "message": "Aadhaar number strictly 12 digits ka hona chahiye!"}), 400

        with get_db_connection() as conn:
            # 1. Identity Duplicate Check: Class + Name + DOB + Father Name
            dup_query = '''
                SELECT id FROM students 
                WHERE class = ? 
                  AND UPPER(first_name) = ? 
                  AND dob = ? 
                  AND COALESCE(UPPER(father_name), '') = ?
            '''
            params = [s_class, f_name, s_dob, father]

            if student_id:
                dup_query += " AND id != ?"
                params.append(student_id)

            existing_student = conn.execute(dup_query, params).fetchone()
            if existing_student:
                return jsonify({
                    "status": "error",
                    "message": f"Student '{f_name}' is Class ({s_class}) me same DOB aur Father Name ke sath pehle se registered hai!"
                }), 400

            # 2. SR No Duplicate Check (sirf tab chalega jab SR No enter kiya ho)
            if sr_no:
                sr_check = "SELECT id FROM students WHERE UPPER(sr_no) = ?"
                sr_params = [sr_no]
                if student_id:
                    sr_check += " AND id != ?"
                    sr_params.append(student_id)

                if conn.execute(sr_check, sr_params).fetchone():
                    return jsonify({"status": "error", "message": f"SR No '{sr_no}' pehle se kisi aur student ko allot ho chuka hai!"}), 400

            # 3. Update Existing Student
            if student_id:
                conn.execute('''
                    UPDATE students SET
                        sr_no = ?, roll_no = ?, class = ?, section = ?,
                        first_name = ?, last_name = ?, dob = ?, gender = ?,
                        father_name = ?, mother_name = ?, category = ?,
                        mobile_no = ?, aadhaar_no = ?, address = ?,
                        admission_date = ?, status = ?
                    WHERE id = ?
                ''', (
                    sr_no,
                    data.get('roll_no', '').strip() or None,
                    s_class,
                    data.get('section', 'A').strip(),
                    f_name,
                    l_name,
                    s_dob,
                    data.get('gender', ''),
                    father,
                    data.get('mother_name', '').strip().upper(),
                    data.get('category', 'General'),
                    mobile,
                    aadhaar,
                    data.get('address', '').strip().upper(),
                    data.get('admission_date', ''),
                    data.get('status', 'Active'),
                    student_id
                ))
                msg = "Student record successfully update ho gaya!"
            # 4. Insert New Student
            else:
                conn.execute('''
                    INSERT INTO students (
                        sr_no, roll_no, class, section, first_name, last_name,
                        dob, gender, father_name, mother_name, category,
                        mobile_no, aadhaar_no, address, admission_date, status
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    sr_no,
                    data.get('roll_no', '').strip() or None,
                    s_class,
                    data.get('section', 'A').strip(),
                    f_name,
                    l_name,
                    s_dob,
                    data.get('gender', ''),
                    father,
                    data.get('mother_name', '').strip().upper(),
                    data.get('category', 'General'),
                    mobile,
                    aadhaar,
                    data.get('address', '').strip().upper(),
                    data.get('admission_date', ''),
                    data.get('status', 'Active')
                ))
                msg = "Naya student registration safalta se save ho gaya!"
            conn.commit()

        return jsonify({"status": "success", "message": msg}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# Single Student GET & DELETE


@app.route('/api/students/<int:student_id>', methods=['GET', 'DELETE'])
def handle_single_student(student_id):
    try:
        with get_db_connection() as conn:
            if request.method == 'GET':
                student = conn.execute(
                    "SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
                if student:
                    return jsonify({"status": "success", "student": dict(student)}), 200
                return jsonify({"status": "error", "message": "Student record nahi mila!"}), 404

            elif request.method == 'DELETE':
                conn.execute(
                    "DELETE FROM students WHERE id = ?", (student_id,))
                conn.commit()
                return jsonify({"status": "success", "message": "Student record delete ho gaya!"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ==========================================
# 3. EXPORT TO EXCEL ENDPOINT
# ==========================================


@app.route('/api/export-students-excel', methods=['GET'])
def export_students_excel():
    try:
        with get_db_connection() as conn:
            students = conn.execute(
                "SELECT * FROM students ORDER BY class, roll_no").fetchall()

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Student Directory"

        headers = [
            "ID", "SR No", "Roll No", "Class", "Section", "First Name",
            "Last Name", "DOB", "Gender", "Father Name", "Mother Name",
            "Category", "Mobile No", "Aadhaar No", "Address", "Admission Date", "Status"
        ]
        ws.append(headers)

        for s in students:
            ws.append([
                s['id'], s['sr_no'], s['roll_no'], s['class'], s['section'],
                s['first_name'], s['last_name'], s['dob'], s['gender'],
                s['father_name'], s['mother_name'], s['category'],
                s['mobile_no'], s['aadhaar_no'], s['address'],
                s['admission_date'], s['status']
            ])

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)

        return send_file(
            output,
            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            as_attachment=True,
            download_name="School_Student_Records.xlsx"
        )
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ==========================================
# 4. ATTENDANCE API ENDPOINTS
# ==========================================


@app.route('/api/attendance', methods=['GET'])
def get_attendance():
    student_class = request.args.get('class', '10th')
    section = request.args.get('section', 'A')
    att_date = request.args.get('date')

    try:
        with get_db_connection() as conn:
            query = '''
                SELECT s.id AS student_id, s.roll_no, s.first_name, s.last_name,
                       COALESCE(a.status, 'Present') AS status,
                       COALESCE(a.remarks, '') AS remarks
                FROM students s
                LEFT JOIN attendance a ON s.id = a.student_id AND a.att_date = ?
                WHERE s.class = ? AND s.section = ? AND s.status = 'Active'
                ORDER BY CAST(s.roll_no AS INTEGER), s.first_name
            '''
            records = conn.execute(
                query, (att_date, student_class, section)).fetchall()
            return jsonify({"status": "success", "data": [dict(r) for r in records]}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/attendance', methods=['POST'])
def save_attendance():
    try:
        data = request.json
        att_date = data.get('date')
        records = data.get('records', [])

        with get_db_connection() as conn:
            for item in records:
                conn.execute('''
                    INSERT INTO attendance (student_id, att_date, status, remarks)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(student_id, att_date) DO UPDATE SET
                        status = excluded.status,
                        remarks = excluded.remarks
                ''', (item['student_id'], att_date, item['status'], item.get('remarks', '').strip()))
            conn.commit()

        return jsonify({"status": "success", "message": "Attendance safalta se save ho gayi!"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ==========================================
# 5. RESULTS & MARKS API ENDPOINTS
# ==========================================
# UBSE Official Subjects Mapping
BOARD_SUBJECTS = {
    "Junior": [
        "HINDI", "ENGLISH", "MATHEMATICS", "SCIENCE",
        "SOCIAL SCIENCE", "SANSKRIT", "HOME SCIENCE", "DRAWING"
    ],
    "HighSchool": [
        "HINDI", "ENGLISH", "MATHEMATICS", "HOME SCIENCE",
        "SCIENCE", "SOCIAL SCIENCE", "SANSKRIT", "COMMERCE",
        "PAINTING", "MUSIC", "INFORMATION TECHNOLOGY (ITES)",
        "AGRICULTURE", "AUTOMOTIVE", "RETAIL", "HEALTHCARE",
        "SECURITY", "TOURISM & HOSPITALITY", "BEAUTY & WELLNESS"
    ],
    "Inter": [
        "GENERAL HINDI", "ENGLISH", "PHYSICS", "CHEMISTRY",
        "BIOLOGY", "MATHEMATICS", "COMPUTER SCIENCE",
        "HISTORY", "POLITICAL SCIENCE", "GEOGRAPHY", "ECONOMICS",
        "SOCIOLOGY", "HOME SCIENCE", "DRAWING & PAINTING",
        "ACCOUNTANCY", "BUSINESS STUDIES", "INFORMATION TECHNOLOGY (ITES)"
    ]
}


@app.route('/api/results-matrix', methods=['GET'])
def get_results_matrix():
    student_class = request.args.get('class', '10th')
    exam_type = request.args.get('exam', 'Half Yearly')
    academic_year = request.args.get('year', '2026-2027')
    selected_subject = request.args.get('subject', 'HINDI')

    # Filter subjects by grade level
    if student_class in ['11th', '12th']:
        subject_list = BOARD_SUBJECTS["Inter"]
    elif student_class in ['9th', '10th']:
        subject_list = BOARD_SUBJECTS["HighSchool"]
    else:
        subject_list = BOARD_SUBJECTS["Junior"]

    try:
        with get_db_connection() as conn:
            students = conn.execute('''
                SELECT id AS student_id, roll_no, first_name, last_name 
                FROM students 
                WHERE class = ? AND status = 'Active'
                ORDER BY CAST(roll_no AS INTEGER), first_name
            ''', (student_class,)).fetchall()

            student_rows = []
            for s in students:
                mark_rec = conn.execute('''
                    SELECT project_marks, practical_marks, theory_marks, total_marks 
                    FROM results 
                    WHERE student_id = ? AND academic_year = ? AND exam_type = ? AND subject = ?
                ''', (s['student_id'], academic_year, exam_type, selected_subject)).fetchone()

                student_rows.append({
                    "student_id": s['student_id'],
                    "roll_no": s['roll_no'] or '-',
                    "name": f"{s['first_name']} {s['last_name'] or ''}".strip(),
                    "project": mark_rec['project_marks'] if mark_rec else '',
                    "practical": mark_rec['practical_marks'] if mark_rec else '',
                    "theory": mark_rec['theory_marks'] if mark_rec else '',
                    "total": mark_rec['total_marks'] if mark_rec else 0
                })

        return jsonify({
            "status": "success",
            "available_subjects": subject_list,
            "students": student_rows
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/results-matrix', methods=['POST'])
def save_results_matrix():
    try:
        data = request.json
        year = data.get('year')
        exam = data.get('exam')
        subject = data.get('subject')
        marks_data = data.get('marks_data', [])

        with get_db_connection() as conn:
            for entry in marks_data:
                proj = float(entry.get('project')) if entry.get(
                    'project') not in ['', None] else 0.0
                pract = float(entry.get('practical')) if entry.get(
                    'practical') not in ['', None] else 0.0
                theor = float(entry.get('theory')) if entry.get(
                    'theory') not in ['', None] else 0.0
                total = proj + pract + theor

                conn.execute('''
                    INSERT INTO results (
                        student_id, academic_year, exam_type, subject, 
                        project_marks, practical_marks, theory_marks, total_marks
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(student_id, academic_year, exam_type, subject) DO UPDATE SET
                        project_marks = excluded.project_marks,
                        practical_marks = excluded.practical_marks,
                        theory_marks = excluded.theory_marks,
                        total_marks = excluded.total_marks
                ''', (entry['student_id'], year, exam, subject, proj, pract, theor, total))
            conn.commit()

        return jsonify({"status": "success", "message": f"{subject} ke marks save ho gaye!"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/student-report-card', methods=['GET'])
def get_student_report_card():
    student_id = request.args.get('student_id')
    academic_year = request.args.get('year', '2026-2027')

    try:
        with get_db_connection() as conn:
            # 1. Fetch Student Details
            student = conn.execute("SELECT * FROM students WHERE id = ?", (student_id,)).fetchone()
            if not student:
                return jsonify({"status": "error", "message": "Student nahi mila!"}), 404

            # 2. School Profile
            school = conn.execute("SELECT * FROM school_profile WHERE id = 1").fetchone()

            # 3. Fetch All Marks for this academic year (Both Half Yearly & Annual)
            all_records = conn.execute('''
                SELECT subject, exam_type, project_marks, practical_marks, theory_marks, total_marks 
                FROM results 
                WHERE student_id = ? AND academic_year = ?
                ORDER BY subject ASC
            ''', (student_id, academic_year)).fetchall()

            # Combine subject records
            subject_map = {}
            for r in all_records:
                sub = r['subject']
                if sub not in subject_map:
                    subject_map[sub] = {
                        'subject': sub,
                        'hy_project': '-', 'hy_practical': '-', 'hy_theory': '-', 'hy_total': '-',
                        'ann_project': '-', 'ann_practical': '-', 'ann_theory': '-', 'ann_total': '-',
                        'final_aggregate': 0
                    }
                
                et = r['exam_type']
                if et == 'Half Yearly':
                    subject_map[sub]['hy_project'] = r['project_marks']
                    subject_map[sub]['hy_practical'] = r['practical_marks']
                    subject_map[sub]['hy_theory'] = r['theory_marks']
                    subject_map[sub]['hy_total'] = r['total_marks']
                elif et == 'Annual':
                    subject_map[sub]['ann_project'] = r['project_marks']
                    subject_map[sub]['ann_practical'] = r['practical_marks']
                    subject_map[sub]['ann_theory'] = r['theory_marks']
                    subject_map[sub]['ann_total'] = r['total_marks']

            # Calculate subject final aggregate & grand totals
            report_rows = []
            grand_hy = 0.0
            grand_ann = 0.0
            grand_final = 0.0

            for sub, val in subject_map.items():
                hy_val = float(val['hy_total']) if val['hy_total'] != '-' else 0.0
                ann_val = float(val['ann_total']) if val['ann_total'] != '-' else 0.0
                
                # Final Aggregate: Half Yearly + Annual
                final_sub_total = hy_val + ann_val
                val['final_aggregate'] = final_sub_total

                grand_hy += hy_val
                grand_ann += ann_val
                grand_final += final_sub_total
                report_rows.append(val)

            # Max possible (100 HY + 100 Annual = 200 per subject)
            max_possible = len(report_rows) * 200
            percentage = round((grand_final / max_possible) * 100, 2) if max_possible > 0 else 0

            return jsonify({
                "status": "success",
                "school": dict(school) if school else {},
                "student": dict(student),
                "year": academic_year,
                "subjects": report_rows,
                "grand_hy": grand_hy,
                "grand_ann": grand_ann,
                "grand_final": grand_final,
                "max_possible": max_possible,
                "percentage": percentage
            }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ==========================================
# 6. AUTHENTICATION & PASSWORD ENDPOINTS
# ==========================================


@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.json
        username = data.get('username', '').strip()
        password = data.get('password', '').strip()

        with get_db_connection() as conn:
            user = conn.execute(
                "SELECT * FROM users WHERE username = ? AND password = ?",
                (username, password)
            ).fetchone()

            if user:
                return jsonify({
                    "status": "success",
                    "message": "Login successful!",
                    "user": {"username": user['username'], "role": user['role']}
                }), 200
            return jsonify({"status": "error", "message": "Galat Username ya Password!"}), 401
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/change-password', methods=['POST'])
def change_password():
    try:
        data = request.json
        username = data.get('username', '').strip()
        old_password = data.get('old_password', '').strip()
        new_password = data.get('new_password', '').strip()

        if len(new_password) < 4:
            return jsonify({"status": "error", "message": "Password kam se kam 4 characters ka hona chahiye!"}), 400

        with get_db_connection() as conn:
            user = conn.execute(
                "SELECT * FROM users WHERE username = ? AND password = ?",
                (username, old_password)
            ).fetchone()

            if not user:
                return jsonify({"status": "error", "message": "Purana password galat hai!"}), 400

            conn.execute(
                "UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (new_password, user['id'])
            )
            conn.commit()

        return jsonify({"status": "success", "message": "Password safalta se badal gaya!"}), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == '__main__':
    app.run(port=5000, debug=True)
