// ==========================================
// 1. STATE & INITIALIZATION
// ==========================================
let activeUser = sessionStorage.getItem('sms_user');
let allStudentsList = [];
let filteredStudentsList = [];

window.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  loadSchoolProfile();

  // Set default today's date for attendance
  const attDate = document.getElementById('attDateInput');
  if (attDate && !attDate.value) {
    attDate.value = new Date().toISOString().split('T')[0];
  }

  setupEventListeners();
});

// ==========================================
// 2. TAB SWITCHING
// ==========================================
function switchTab(panelId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');

  const btnMap = {
    'admission-panel': 'btn-tab-admission',
    'students-panel': 'btn-tab-students',
    'attendance-panel': 'btn-tab-attendance',
    'results-panel': 'btn-tab-results',
    'settings-panel': 'btn-tab-settings'
  };

  const btn = document.getElementById(btnMap[panelId]);
  if (btn) btn.classList.add('active');

  if (panelId === 'students-panel') fetchStudents();
  if (panelId === 'attendance-panel') loadAttendanceList();
  if (panelId === 'results-panel') loadResultsMatrix();
}

// ==========================================
// 3. AUTHENTICATION (LOGIN & LOGOUT)
// ==========================================
function checkAuth() {
  const overlay = document.getElementById('loginOverlay');
  if (!overlay) return;
  overlay.style.display = activeUser ? 'none' : 'flex';
}

function logoutApp() {
  sessionStorage.removeItem('sms_user');
  activeUser = null;
  const pass = document.getElementById('loginPassword');
  if (pass) pass.value = '';
  checkAuth();
}

function confirmExit() {
  if (confirm("Kya aap software band (Exit) karna chahte hain?")) {
    window.close();
  }
}

// ==========================================
// 4. STUDENT ADMISSION & INSTANT LOCAL EDIT
// ==========================================
// 1. Reset / New Admission Mode
function resetAdmissionForm() {
  const form = document.getElementById('studentRegistrationForm');
  if (form) form.reset();

  document.getElementById('studentDbId').value = '';
  document.getElementById('formCardTitle').textContent = "Student Admission / Registration Form";
  document.getElementById('saveSubmitBtn').textContent = "💾 Save Student";

  // Lock status to Active during new registration
  const statusSelect = document.getElementById('studentStatus');
  if (statusSelect) {
    statusSelect.value = 'Active';
    statusSelect.disabled = true;
    statusSelect.style.backgroundColor = '#f1f5f9';
    statusSelect.style.cursor = 'not-allowed';
  }
  
  const cancelBtn = document.getElementById('cancelEditBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';

  const msg = document.getElementById('statusMsg');
  if (msg) msg.textContent = '';
}

// 2. Edit Mode (Unlock Status)
function editStudentById(studentId) {
  const s = allStudentsList.find(item => item.id === studentId);
  if (!s) {
    alert("Record nahi mila!");
    return;
  }

  switchTab('admission-panel');

  document.getElementById('studentDbId').value = s.id;
  document.getElementById('srNo').value = s.sr_no || '';
  document.getElementById('studentClass').value = s.class || '';
  document.getElementById('section').value = s.section || 'A';
  document.getElementById('rollNo').value = s.roll_no || '';
  document.getElementById('firstName').value = s.first_name || '';
  document.getElementById('lastName').value = s.last_name || '';
  document.getElementById('dob').value = s.dob || '';
  document.getElementById('gender').value = s.gender || 'Male';
  document.getElementById('category').value = s.category || 'General';
  document.getElementById('fatherName').value = s.father_name || '';
  document.getElementById('motherName').value = s.mother_name || '';
  document.getElementById('mobileNo').value = s.mobile_no || '';
  document.getElementById('aadhaarNo').value = s.aadhaar_no || '';
  document.getElementById('admissionDate').value = s.admission_date || '';
  document.getElementById('address').value = s.address || '';

  // Enable status dropdown during edit
  const statusSelect = document.getElementById('studentStatus');
  if (statusSelect) {
    statusSelect.value = s.status || 'Active';
    statusSelect.disabled = false;
    statusSelect.style.backgroundColor = '#ffffff';
    statusSelect.style.cursor = 'default';
  }

  document.getElementById('formCardTitle').textContent = `Update Record: ${s.first_name} (ID: ${s.id})`;
  document.getElementById('saveSubmitBtn').textContent = "💾 Update Student";
  
  const cancelBtn = document.getElementById('cancelEditBtn');
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// 5. STUDENT DIRECTORY (LOAD, SEARCH, DELETE)
// ==========================================
async function fetchStudents() {
  try {
    const res = await fetch('/api/students');
    const data = await res.json();
    if (data.status === 'success') {
      allStudentsList = data.students;
      applyFilters();
    }
  } catch (err) {
    console.error("Fetch students error:", err);
  }
}

function renderStudentsTable() {
  const tbody = document.getElementById('studentsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (filteredStudentsList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 20px;">Koi student record nahi mila.</td></tr>`;
    return;
  }

  filteredStudentsList.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${s.sr_no || '<span style="color:#94a3b8;">Not Allotted</span>'}</strong></td>
      <td>${s.roll_no || '-'}</td>
      <td>${s.class} (${s.section || 'A'})</td>
      <td><strong>${s.first_name} ${s.last_name || ''}</strong></td>
      <td>${s.father_name || '-'}</td>
      <td>${s.mobile_no || '-'}</td>
      <td>${s.category || 'General'}</td>
      <td><span class="badge ${s.status === 'Active' ? 'badge-active' : 'badge-inactive'}">${s.status || 'Active'}</span></td>
      <td>
        <button class="btn-sm btn-edit" onclick="editStudentById(${s.id})">✏️ Edit</button>
        <button class="btn-sm btn-delete" onclick="deleteStudent(${s.id})">🗑️ Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function applyFilters() {
  const query = (document.getElementById('studentSearchInput')?.value || '').toLowerCase();
  const selectedClass = document.getElementById('classFilterSelect')?.value || '';

  filteredStudentsList = allStudentsList.filter(s => {
    const fullName = `${s.first_name} ${s.last_name || ''}`.toLowerCase();
    const matchQuery = fullName.includes(query) ||
      (s.sr_no && s.sr_no.toLowerCase().includes(query)) ||
      (s.roll_no && s.roll_no.toLowerCase().includes(query)) ||
      (s.mobile_no && s.mobile_no.includes(query));
    const matchClass = selectedClass === '' || s.class === selectedClass;
    return matchQuery && matchClass;
  });

  renderStudentsTable();
}

async function deleteStudent(studentId) {
  if (!confirm("Kya aap sach me ye student delete karna chahte hain?")) return;

  try {
    const res = await fetch(`/api/students/${studentId}`, { method: 'DELETE' });
    const result = await res.json();
    alert(result.message);
    if (res.ok) fetchStudents();
  } catch (err) {
    alert("Delete operation failed!");
  }
}

// ==========================================
// 6. ATTENDANCE FUNCTIONS
// ==========================================
async function loadAttendanceList() {
  const cls = document.getElementById('attClassSelect')?.value || '10th';
  const sec = document.getElementById('attSectionSelect')?.value || 'A';
  const dt = document.getElementById('attDateInput')?.value;

  try {
    const res = await fetch(`/api/attendance?class=${encodeURIComponent(cls)}&section=${encodeURIComponent(sec)}&date=${dt}`);
    const result = await res.json();

    const tbody = document.getElementById('attendanceTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!result.data || result.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 20px;">Is class/section me koi active student nahi mila.</td></tr>`;
      return;
    }

    result.data.forEach(s => {
      const tr = document.createElement('tr');
      tr.dataset.studentId = s.student_id;
      tr.innerHTML = `
        <td>${s.roll_no || '-'}</td>
        <td><strong>${s.first_name} ${s.last_name || ''}</strong></td>
        <td>
          <label><input type="radio" name="att_${s.student_id}" value="Present" ${s.status === 'Present' ? 'checked' : ''}> Present</label>&nbsp;&nbsp;
          <label><input type="radio" name="att_${s.student_id}" value="Absent" ${s.status === 'Absent' ? 'checked' : ''}> Absent</label>&nbsp;&nbsp;
          <label><input type="radio" name="att_${s.student_id}" value="Leave" ${s.status === 'Leave' ? 'checked' : ''}> Leave</label>
        </td>
        <td>
          <input type="text" class="att-remark" value="${s.remarks || ''}" placeholder="Remarks" style="padding: 4px; border: 1px solid #cbd5e1; border-radius: 4px; width: 100%;">
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error("Attendance load error:", err);
  }
}

// ==========================================
// 7. RESULTS FUNCTIONS (Subject-wise Entry & Auto-Load)
// ==========================================
async function loadResultsMatrix() {
  const cls = document.getElementById('resClassSelect')?.value || '10th';
  const subSelect = document.getElementById('resSubjectSelect');
  let selectedSub = subSelect?.value || '';
  const exam = document.getElementById('resExamSelect')?.value || 'Half Yearly';
  const year = document.getElementById('resYearSelect')?.value || '2026-2027';

  try {
    const res = await fetch(`/api/results-matrix?class=${encodeURIComponent(cls)}&exam=${encodeURIComponent(exam)}&year=${encodeURIComponent(year)}&subject=${encodeURIComponent(selectedSub)}`);
    const data = await res.json();

    if (data.status === 'success') {
      // Sync dynamic subject dropdown
      if (subSelect) {
        const currentSelection = subSelect.value;
        subSelect.innerHTML = '';
        data.available_subjects.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s;
          opt.textContent = s;
          subSelect.appendChild(opt);
        });

        // Agar purani choice list mein hai toh wahi rakhein, nahi toh pehla subject
        if (data.available_subjects.includes(currentSelection)) {
          subSelect.value = currentSelection;
        } else {
          subSelect.value = data.available_subjects[0] || '';
          // Agar subject default pehla set hua hai, toh uske saved marks fetch karna
          if (!selectedSub && subSelect.value) {
            return loadResultsMatrix();
          }
        }
      }

      renderResultsRows(data.students);
    }
  } catch (err) {
    console.error("Results load error:", err);
  }
}

function renderResultsRows(students) {
  const tbody = document.getElementById('resultsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!students || students.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">Is class me koi student nahi mila.</td></tr>`;
    return;
  }

  students.forEach(s => {
    const tr = document.createElement('tr');
    tr.dataset.studentId = s.student_id;
    tr.innerHTML = `
      <td>${s.roll_no}</td>
      <td><strong>${s.name}</strong></td>
      <td><input type="number" step="0.5" class="input-project" value="${s.project !== '' ? s.project : ''}" placeholder="0" style="width:80px; padding:4px;" oninput="recalcRowTotal(this)"></td>
      <td><input type="number" step="0.5" class="input-practical" value="${s.practical !== '' ? s.practical : ''}" placeholder="0" style="width:80px; padding:4px;" oninput="recalcRowTotal(this)"></td>
      <td><input type="number" step="0.5" class="input-theory" value="${s.theory !== '' ? s.theory : ''}" placeholder="0" style="width:80px; padding:4px;" oninput="recalcRowTotal(this)"></td>
      <td><strong class="row-total" style="color:#1e3a8a; font-size:15px;">${s.total || 0}</strong></td>
      <td>
        <button type="button" class="btn-sm" style="background:#0284c7; color:#fff;" onclick="openReportCard(${s.student_id})">📄 Marksheet</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function recalcRowTotal(input) {
  const row = input.closest('tr');
  const p = parseFloat(row.querySelector('.input-project')?.value) || 0;
  const pr = parseFloat(row.querySelector('.input-practical')?.value) || 0;
  const t = parseFloat(row.querySelector('.input-theory')?.value) || 0;
  row.querySelector('.row-total').textContent = (p + pr + t).toFixed(1).replace(/\.0$/, '');
}

// ==========================================
// 8. SCHOOL PROFILE SYNC
// ==========================================
async function loadSchoolProfile() {
  try {
    const res = await fetch('/api/school-profile');
    const data = await res.json();
    if (data.status === 'success' && data.profile) {
      const p = data.profile;
      document.getElementById('headerSchoolName').textContent = p.school_name || 'GOVERNMENT INTER COLLEGE';
      document.getElementById('headerAffiliation').textContent = `${p.affiliation_info || ''} • Code: ${p.school_code || 'N/A'}`;
      document.getElementById('headerSession').textContent = `📅 Session: ${p.academic_session || '2026-2027'}`;

      document.getElementById('settingSchoolName').value = p.school_name || '';
      document.getElementById('settingSchoolCode').value = p.school_code || '';
      document.getElementById('settingAffiliation').value = p.affiliation_info || '';
      document.getElementById('settingSession').value = p.academic_session || '';
      document.getElementById('settingContact').value = p.contact_no || '';
      document.getElementById('settingEmail').value = p.email || '';
      document.getElementById('settingAddress').value = p.address || '';
    }
  } catch (err) {
    console.error("Profile load error:", err);
  }
}

// ==========================================
// 9. FORM SUBMIT & EVENT LISTENERS SETUP
// ==========================================
function setupEventListeners() {
  // Login Form
  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const u = document.getElementById('loginUsername').value.trim();
    const p = document.getElementById('loginPassword').value.trim();
    const msg = document.getElementById('loginMsg');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p })
      });
      const data = await res.json();

      if (res.ok && data.status === 'success') {
        sessionStorage.setItem('sms_user', data.user.username);
        activeUser = data.user.username;
        if (msg) msg.textContent = '';
        checkAuth();
      } else {
        if (msg) {
          msg.style.color = '#dc2626';
          msg.textContent = data.message || 'Login failed!';
        }
      }
    } catch (err) {
      if (msg) {
        msg.style.color = '#dc2626';
        msg.textContent = 'Server se connection fail hua!';
      }
    }
  });

// ==========================================
// 10. REPORT CARD MODAL & PRINT (Global Scope)
// ==========================================
window.openReportCard = async function(studentId) {
  const year = document.getElementById('resYearSelect')?.value || '2026-2027';

  try {
    const res = await fetch(`/api/student-report-card?student_id=${studentId}&year=${encodeURIComponent(year)}`);
    const data = await res.json();

    if (data.status !== 'success') {
      alert(data.message);
      return;
    }

    const st = data.student;
    const sc = data.school;
    document.getElementById('rcSchoolName').textContent = sc.school_name || 'SCHOOL NAME';
    document.getElementById('rcSchoolDetails').textContent = `${sc.affiliation_info || ''} • Code: ${sc.school_code || 'N/A'}`;
    document.getElementById('rcExamTitle').textContent = `ANNUAL COMPOSITE REPORT CARD • SESSION ${data.year}`;

    document.getElementById('rcName').textContent = `${st.first_name} ${st.last_name || ''}`;
    document.getElementById('rcRoll').textContent = st.roll_no || '-';
    document.getElementById('rcClass').textContent = `${st.class} (${st.section || 'A'})`;
    document.getElementById('rcFather').textContent = st.father_name || '-';
    document.getElementById('rcSr').textContent = st.sr_no || '-';
    document.getElementById('rcDob').textContent = st.dob || '-';

    const tbody = document.getElementById('rcMarksBody');
    tbody.innerHTML = '';

    if (!data.subjects || data.subjects.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="border:1px solid #334155; padding:15px; color:#64748b;">Is session ke liye marks record nahi mile.</td></tr>`;
    } else {
      data.subjects.forEach(m => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td style="border:1px solid #334155; padding:5px 8px; text-align:left;"><strong>${m.subject}</strong></td>
          <td style="border:1px solid #334155; padding:5px;">${m.hy_project !== null ? m.hy_project : '-'}</td>
          <td style="border:1px solid #334155; padding:5px;">${m.hy_practical !== null ? m.hy_practical : '-'}</td>
          <td style="border:1px solid #334155; padding:5px;">${m.hy_theory !== null ? m.hy_theory : '-'}</td>
          <td style="border:1px solid #334155; padding:5px; font-weight:bold; background:#eef2ff;">${m.hy_total !== null ? m.hy_total : '-'}</td>
          
          <td style="border:1px solid #334155; padding:5px;">${m.ann_project !== null ? m.ann_project : '-'}</td>
          <td style="border:1px solid #334155; padding:5px;">${m.ann_practical !== null ? m.ann_practical : '-'}</td>
          <td style="border:1px solid #334155; padding:5px;">${m.ann_theory !== null ? m.ann_theory : '-'}</td>
          <td style="border:1px solid #334155; padding:5px; font-weight:bold; background:#fefce8;">${m.ann_total !== null ? m.ann_total : '-'}</td>
          
          <td style="border:1px solid #334155; padding:5px; font-weight:bold; background:#f8fafc; color:#1e3a8a;">${m.final_aggregate}</td>
        `;
        tbody.appendChild(row);
      });
    }

    document.getElementById('rcGrandHY').textContent = data.grand_hy;
    document.getElementById('rcGrandANN').textContent = data.grand_ann;
    document.getElementById('rcGrandFinal').textContent = data.grand_final;
    document.getElementById('rcMaxMarks').textContent = data.max_possible;
    document.getElementById('rcPercentage').textContent = data.percentage;

    const modal = document.getElementById('reportCardModal');
    if (modal) modal.style.display = 'flex';
  } catch (err) {
    alert("Report card load karne me error aaya!");
  }
};

window.closeReportCard = function() {
  const modal = document.getElementById('reportCardModal');
  if (modal) modal.style.display = 'none';
};

window.printReportCard = function() {
  const printContents = document.getElementById('printableReportArea').innerHTML;
  const originalContents = document.body.innerHTML;

  document.body.innerHTML = `<div style="padding:20px;">${printContents}</div>`;
  window.print();
  document.body.innerHTML = originalContents;
  window.location.reload();
};

// Student Registration Form Submit
  document.getElementById('studentRegistrationForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    // Disabled status field explicit attach
    const statusSelect = document.getElementById('studentStatus');
    payload.status = statusSelect ? statusSelect.value : 'Active';

    const msgEl = document.getElementById('statusMsg');

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if (res.ok) {
        // Pehle form reset karein taaki msg khali na ho
        resetAdmissionForm();
        fetchStudents();

        // Ab success message display karein
        if (msgEl) {
          msgEl.style.color = '#16a34a';
          msgEl.style.fontWeight = 'bold';
          msgEl.style.padding = '8px 12px';
          msgEl.style.background = '#dcfce7';
          msgEl.style.borderRadius = '6px';
          msgEl.style.marginTop = '12px';
          msgEl.textContent = '✅ ' + result.message;

          // 4 second baad message softly hide ho jaye
          setTimeout(() => {
            msgEl.textContent = '';
            msgEl.style.background = 'transparent';
            msgEl.style.padding = '0';
          }, 4000);
        }
      } else {
        if (msgEl) {
          msgEl.style.color = '#dc2626';
          msgEl.style.fontWeight = 'bold';
          msgEl.style.padding = '8px 12px';
          msgEl.style.background = '#fee2e2';
          msgEl.style.borderRadius = '6px';
          msgEl.style.marginTop = '12px';
          msgEl.textContent = '⚠️ ' + result.message;
        }
      }
    } catch (err) {
      if (msgEl) {
        msgEl.style.color = '#dc2626';
        msgEl.textContent = '⚠️ Server connection error!';
      }
    }
  });

  // Search & Filters
  document.getElementById('studentSearchInput')?.addEventListener('keyup', applyFilters);
  document.getElementById('classFilterSelect')?.addEventListener('change', applyFilters);

  // Attendance Controls
  document.getElementById('attClassSelect')?.addEventListener('change', loadAttendanceList);
  document.getElementById('attSectionSelect')?.addEventListener('change', loadAttendanceList);
  document.getElementById('attDateInput')?.addEventListener('change', loadAttendanceList);
  
  document.getElementById('markAllPresentBtn')?.addEventListener('click', () => {
    document.querySelectorAll('#attendanceTableBody input[value="Present"]').forEach(r => r.checked = true);
  });

  document.getElementById('saveAttendanceBtn')?.addEventListener('click', async () => {
    const rows = document.querySelectorAll('#attendanceTableBody tr');
    const records = [];

    rows.forEach(tr => {
      const sid = tr.dataset.studentId;
      if (sid) {
        const checked = tr.querySelector(`input[name="att_${sid}"]:checked`);
        const rem = tr.querySelector('.att-remark')?.value || '';
        records.push({
          student_id: parseInt(sid),
          status: checked ? checked.value : 'Present',
          remarks: rem
        });
      }
    });

    if (records.length === 0) return alert("Save karne ke liye koi record nahi mila!");

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: document.getElementById('attDateInput').value,
          records: records
        })
      });
      const d = await res.json();
      alert(d.message);
    } catch (err) {
      alert("Attendance save karne me issue aaya!");
    }
  });

// Results Filter Triggers
  document.getElementById('resClassSelect')?.addEventListener('change', loadResultsMatrix);
  document.getElementById('resSubjectSelect')?.addEventListener('change', loadResultsMatrix);
  document.getElementById('resExamSelect')?.addEventListener('change', loadResultsMatrix);
  document.getElementById('resYearSelect')?.addEventListener('change', loadResultsMatrix);

  // Save Subject Marks
  document.getElementById('saveResultsBtn')?.addEventListener('click', async () => {
    const rows = document.querySelectorAll('#resultsTableBody tr');
    const marksData = [];

    rows.forEach(tr => {
      const sid = tr.dataset.studentId;
      if (sid) {
        marksData.push({
          student_id: parseInt(sid),
          project: tr.querySelector('.input-project')?.value.trim(),
          practical: tr.querySelector('.input-practical')?.value.trim(),
          theory: tr.querySelector('.input-theory')?.value.trim()
        });
      }
    });

    try {
      const res = await fetch('/api/results-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: document.getElementById('resYearSelect').value,
          exam: document.getElementById('resExamSelect').value,
          subject: document.getElementById('resSubjectSelect').value,
          marks_data: marksData
        })
      });
      const d = await res.json();
      alert(d.message);
    } catch (err) {
      alert("Marks save karne me dikkat aayi!");
    }
  });

  // School Profile Form
  document.getElementById('schoolProfileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    const msg = document.getElementById('settingsStatusMsg');

    try {
      const res = await fetch('/api/school-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (msg) {
        msg.style.color = res.ok ? 'green' : 'red';
        msg.textContent = result.message;
      }
      if (res.ok) loadSchoolProfile();
    } catch (err) {
      alert("Profile update failed!");
    }
  });

  // Change Password Form
  document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldP = document.getElementById('oldPass').value;
    const newP = document.getElementById('newPass').value;
    const confP = document.getElementById('confirmPass').value;
    const pMsg = document.getElementById('passMsg');

    if (newP !== confP) {
      if (pMsg) {
        pMsg.style.color = 'red';
        pMsg.textContent = 'Naya password aur confirm password match nahi ho rahe!';
      }
      return;
    }

    try {
      const res = await fetch('/api/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: activeUser || 'admin',
          old_password: oldP,
          new_password: newP
        })
      });
      const data = await res.json();
      if (pMsg) {
        pMsg.style.color = res.ok ? 'green' : 'red';
        pMsg.textContent = data.message;
      }
      if (res.ok) e.target.reset();
    } catch (err) {
      alert("Password change failed!");
    }
  });

  // Export Excel
  document.getElementById('exportExcelBtn')?.addEventListener('click', () => {
    window.location.href = '/api/export-students-excel';
  });
}