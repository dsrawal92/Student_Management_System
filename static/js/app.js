function syncClassDropdowns(category) {
  const classMap = {
    'primary': ['1st','2nd','3rd','4th','5th'],
    'junior': ['6th','7th','8th'],
    'highschool': ['9th','10th'],
    'inter_6_12': ['6th','7th','8th','9th','10th','11th','12th'],
    'inter_9_12': ['9th','10th','11th','12th'],
    'all': ['1st','2nd','3rd','4th','5th','6th','7th','8th','9th','10th','11th','12th']
  };
  const classes = classMap[category] || classMap['all'];
  // Sabhi class dropdowns (Admission, Filter, Attendance, Results) me yahi options render honge
}

// Modal Show/Hide Helpers
window.openForgotPasswordModal = function() {
  const modal = document.getElementById('forgotPasswordModal');
  if (modal) modal.style.display = 'flex';
};

window.closeForgotPasswordModal = function() {
  const modal = document.getElementById('forgotPasswordModal');
  if (modal) modal.style.display = 'none';
  const pinInput = document.getElementById('resetRecoveryPin');
  const passInput = document.getElementById('resetNewPassword');
  if (pinInput) pinInput.value = '';
  if (passInput) passInput.value = '';
};

// API Call to Reset Password
window.submitPasswordReset = async function() {
  const pin = (document.getElementById('resetRecoveryPin')?.value || '').trim();
  const newPass = (document.getElementById('resetNewPassword')?.value || '').trim();

  if (!pin || !newPass) {
    alert("Kripya PIN aur Naya Password dono darj karein!");
    return;
  }

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recovery_pin: pin, new_password: newPass })
    });

    const data = await res.json();
    if (res.ok && data.status === 'success') {
      alert("✅ " + data.message);
      closeForgotPasswordModal();
      const loginMsg = document.getElementById('loginMsg');
      if (loginMsg) loginMsg.innerHTML = '';
    } else {
      alert("❌ " + (data.message || "Reset request fail ho gayi!"));
    }
  } catch (err) {
    alert("Server error: Password reset request complete nahi ho saki!");
  }
};

window.selectGlobalSession = function(sessionStr) {
  sessionStorage.setItem('sms_selected_session', sessionStr);
  
  // Card se active year check karein
  const cardCur = document.getElementById('cardCurrentSession');
  const currentActiveYear = cardCur ? cardCur.dataset.session : '';
  const isSnapshot = (sessionStr !== currentActiveYear);

  // Top header label update
  const topLbl = document.getElementById('topActiveSessionLabel');
  if (topLbl) {
    topLbl.innerHTML = isSnapshot 
      ? `${sessionStr} <span style="background: #f59e0b; color: #000; font-size: 11px; padding: 2px 6px; border-radius: 4px; margin-left: 5px;">Snapshot</span>` 
      : `${sessionStr}`;
  }

  // Exact Button IDs from your index.html
  const tabAdmission = document.getElementById('btn-tab-admission');
  const tabAttendance = document.getElementById('btn-tab-attendance');

  if (isSnapshot) {
    // Snapshot (Purane saal) me Admissions aur Attendance ko HIDE karein
    if (tabAdmission) tabAdmission.style.display = 'none';
    if (tabAttendance) tabAttendance.style.display = 'none';

    // Auto navigate to Student Directory
    if (typeof switchTab === 'function') {
      switchTab('students-panel');
    }
  } else {
    // Current Active Year me SHOW karein
    if (tabAdmission) tabAdmission.style.display = 'inline-block';
    if (tabAttendance) tabAttendance.style.display = 'inline-block';
  }

  // Session screen band karein
  const screen = document.getElementById('academicChoiceScreen');
  if (screen) screen.style.display = 'none';

  // Data reload
  if (typeof fetchStudents === 'function') fetchStudents();
  if (typeof loadResultsMatrix === 'function' && typeof currentActiveExam !== 'undefined' && currentActiveExam) {
    loadResultsMatrix();
  }
};

// ==========================================
// DYNAMIC SESSION CALCULATOR & UDISE CHOICE
// ==========================================
function calculateDynamicSessions() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // Indian Academic Session starts in April (Month >= 4)
  let startYear = (currentMonth >= 4) ? currentYear : currentYear - 1;

  const currentSessionStr = `${startYear}-${startYear + 1}`;
  const previousSessionStr = `${startYear - 1}-${startYear}`;

  // Session Cards update
  const cardCur = document.getElementById('cardCurrentSession');
  const cardPrev = document.getElementById('cardPreviousSession');
  const lblCur = document.getElementById('lblCurrentSession');
  const lblPrev = document.getElementById('lblPreviousSession');

  if (cardCur && lblCur) {
    cardCur.dataset.session = currentSessionStr;
    lblCur.textContent = currentSessionStr;
  }
  if (cardPrev && lblPrev) {
    cardPrev.dataset.session = previousSessionStr;
    lblPrev.textContent = previousSessionStr;
  }
}

// Session Screen Display Handlers
function showAcademicChoiceScreen() {
  const screen = document.getElementById('academicChoiceScreen');
  if (screen) {
    calculateDynamicSessions();
    const user = sessionStorage.getItem('sms_user') || 'School Admin';
    const greet = document.getElementById('sessionUserGreeting');
    if (greet) greet.textContent = user;
    screen.style.display = 'block';
  }
}

// ==========================================
// 1. STATE & INITIALIZATION
// ==========================================
let activeUser = sessionStorage.getItem('sms_user');
let allStudentsList = [];
let filteredStudentsList = [];
let currentActiveExam = null;

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
  if (panelId === 'results-panel' && currentActiveExam) loadResultsMatrix();
}

// ==========================================
// 3. AUTHENTICATION (LOGIN & LOGOUT)
// ==========================================
function checkAuth() {
  const overlay = document.getElementById('loginOverlay');
  if (!overlay) return;

  if (activeUser) {
    overlay.style.display = 'none';
    const savedSession = sessionStorage.getItem('sms_selected_session');
    if (!savedSession) {
      showAcademicChoiceScreen();
    } else {
      const topLbl = document.getElementById('topActiveSessionLabel');
      if (topLbl) topLbl.textContent = savedSession;
    }
  } else {
    overlay.style.display = 'flex';
  }
}

function logoutApp() {
  sessionStorage.removeItem('sms_user');
  sessionStorage.removeItem('sms_selected_session');
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
// 4. STUDENT ADMISSION & EDIT FLOW
// ==========================================
function editStudentById(studentId) {
  const s = allStudentsList.find(item => item.id === studentId);
  if (!s) {
    alert("Record nahi mila!");
    return;
  }

  // Switch Tab and reveal form container
  switchTab('admission-panel');
  const formContainer = document.getElementById('admissionFormContainer');
  const toggleBtn = document.getElementById('toggleAdmissionBtn');
  if (formContainer) formContainer.style.display = 'block';
  if (toggleBtn) {
    toggleBtn.innerHTML = '✖ Close Form';
    toggleBtn.style.background = '#dc2626';
  }

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val !== undefined && val !== null ? val : '';
  };

  setVal('studentDbId', s.id);
  setVal('srNo', s.sr_no);
  setVal('studentClass', s.class);
  if (document.getElementById('studentSection')) setVal('studentSection', s.section || 'Section A');
  else setVal('section', s.section || 'Section A');

  setVal('rollNo', s.roll_no);
  setVal('firstName', s.first_name);
  setVal('lastName', s.last_name);
  setVal('dob', s.dob);
  setVal('gender', s.gender || 'Male');
  setVal('fatherName', s.father_name);
  setVal('motherName', s.mother_name);
  setVal('category', s.category || 'General');
  setVal('mobileNo', s.mobile_no);
  setVal('aadhaarNo', s.aadhaar_no);
  setVal('admissionDate', s.admission_date);

  const statusEl = document.getElementById('studentStatus');
  if (statusEl) {
    statusEl.value = s.status || 'Active';
    statusEl.disabled = false;
  }
  setVal('address', s.address);

  // Switch Buttons to Edit Mode
  const btnClear = document.getElementById('btnClearForm');
  const btnSave = document.getElementById('btnSaveStudent');
  const btnCancel = document.getElementById('btnCancelEdit');
  const btnUpdate = document.getElementById('btnUpdateStudent');

  if (btnClear) btnClear.style.display = 'none';
  if (btnSave) btnSave.style.display = 'none';
  if (btnCancel) btnCancel.style.display = 'inline-block';
  if (btnUpdate) btnUpdate.style.display = 'inline-block';
}

function cancelEditMode() {
  resetAdmissionForm();
  const formContainer = document.getElementById('admissionFormContainer');
  const toggleBtn = document.getElementById('toggleAdmissionBtn');
  if (formContainer) formContainer.style.display = 'none';
  if (toggleBtn) {
    toggleBtn.innerHTML = '➕ New Student';
    toggleBtn.style.background = '#16a34a';
  }
  switchTab('students-panel');
}

function resetAdmissionForm() {
  const form = document.getElementById('studentRegistrationForm');
  if (form) form.reset();

  const idField = document.getElementById('studentDbId');
  if (idField) idField.value = '';

  const statusEl = document.getElementById('studentStatus');
  if (statusEl) {
    statusEl.value = 'Active';
    statusEl.disabled = true;
  }

  // Restore Default Add Mode Buttons
  const btnClear = document.getElementById('btnClearForm');
  const btnSave = document.getElementById('btnSaveStudent');
  const btnCancel = document.getElementById('btnCancelEdit');
  const btnUpdate = document.getElementById('btnUpdateStudent');

  if (btnClear) btnClear.style.display = 'inline-block';
  if (btnSave) btnSave.style.display = 'inline-block';
  if (btnCancel) btnCancel.style.display = 'none';
  if (btnUpdate) btnUpdate.style.display = 'none';
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

  const selectAll = document.getElementById('selectAllStudents');
  if (selectAll) selectAll.checked = false;
  updateSelectedCount();

  if (filteredStudentsList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 20px;">Koi student record nahi mila.</td></tr>`;
    return;
  }

  filteredStudentsList.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align: center;">
        <input type="checkbox" class="student-select-cb" value="${s.id}" onchange="updateSelectedCount()" style="cursor: pointer;">
      </td>
      <td><strong>${s.sr_no || '<span style="color:#94a3b8;">Not Allotted</span>'}</strong></td>
      <td>${s.roll_no || '-'}</td>
      <td>${s.class} (${s.section || 'A'})</td>
      <td><strong>${s.first_name} ${s.last_name || ''}</strong></td>
      <td>${s.father_name || '-'}</td>
      <td>${s.mobile_no || '-'}</td>
      <td>${s.category || 'General'}</td>
      <td><span class="badge ${s.status === 'Active' ? 'badge-active' : 'badge-inactive'}">${s.status || 'Active'}</span></td>
      <td style="text-align: center;">
        <button type="button" class="btn-sm btn-edit" onclick="editStudentById(${s.id})">✏️ Edit</button>
        <button type="button" class="btn-sm btn-delete" onclick="deleteStudent(${s.id})">🗑️ Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Checkbox selection counter
function updateSelectedCount() {
  const checkedBoxes = document.querySelectorAll('.student-select-cb:checked');
  const countBadge = document.getElementById('selectedCountBadge');
  if (countBadge) countBadge.textContent = checkedBoxes.length;
}

// Select / Deselect All Handlers
document.getElementById('selectAllStudents')?.addEventListener('change', (e) => {
  const isChecked = e.target.checked;
  document.querySelectorAll('.student-select-cb').forEach(cb => {
    cb.checked = isChecked;
  });
  updateSelectedCount();
});

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
// 7. RESULTS FUNCTIONS
// ==========================================
window.selectExamType = function(examType) {
  currentActiveExam = examType;

  const btnHalf = document.getElementById('btnExamHalfYearly');
  const btnAnn = document.getElementById('btnExamAnnual');
  const badge = document.getElementById('activeExamBadge');
  const workspace = document.getElementById('resultsWorkspace');

  if (examType === 'Half Yearly') {
    if (btnHalf) {
      btnHalf.style.background = '#2563eb';
      btnHalf.style.color = '#ffffff';
    }
    if (btnAnn) {
      btnAnn.style.background = '#f0fdf4';
      btnAnn.style.color = '#166534';
    }
    if (badge) {
      badge.style.background = '#eff6ff';
      badge.style.color = '#1e40af';
      badge.style.border = '1px solid #93c5fd';
      badge.textContent = 'Active: HALF YEARLY';
    }
  } else {
    if (btnAnn) {
      btnAnn.style.background = '#16a34a';
      btnAnn.style.color = '#ffffff';
    }
    if (btnHalf) {
      btnHalf.style.background = '#eff6ff';
      btnHalf.style.color = '#1e40af';
    }
    if (badge) {
      badge.style.background = '#f0fdf4';
      badge.style.color = '#166534';
      badge.style.border = '1px solid #86efac';
      badge.textContent = 'Active: ANNUAL EXAM';
    }
  }

  if (workspace) workspace.style.display = 'block';
  loadResultsMatrix();
};

async function loadResultsMatrix() {
  const cls = document.getElementById('resClassSelect')?.value || '10th';
  const subSelect = document.getElementById('resSubjectSelect');
  let selectedSub = subSelect?.value || '';
  const exam = currentActiveExam || 'Half Yearly';
  const year = document.getElementById('globalSessionSelect')?.value || '2026-2027';

  try {
    const res = await fetch(`/api/results-matrix?class=${encodeURIComponent(cls)}&exam=${encodeURIComponent(exam)}&year=${encodeURIComponent(year)}&subject=${encodeURIComponent(selectedSub)}`);
    const data = await res.json();

    if (data.status === 'success') {
      if (subSelect) {
        const currentSelection = subSelect.value;
        subSelect.innerHTML = '';
        data.available_subjects.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s;
          opt.textContent = s;
          subSelect.appendChild(opt);
        });

        if (data.available_subjects.includes(currentSelection)) {
          subSelect.value = currentSelection;
        } else {
          subSelect.value = data.available_subjects[0] || '';
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
      
      const headerName = document.getElementById('headerSchoolName');
      if (headerName) headerName.textContent = p.school_name || 'GOVERNMENT INTER COLLEGE';
      
      const headerAff = document.getElementById('headerAffiliation');
      if (headerAff) headerAff.textContent = `${p.affiliation_info || ''} • Code: ${p.school_code || 'N/A'}`;
      
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
      };

      setVal('settingSchoolName', p.school_name);
      setVal('settingSchoolCode', p.school_code);
      setVal('settingAffiliation', p.affiliation_info);
      setVal('settingSession', p.academic_session);
      setVal('settingContact', p.contact_no);
      setVal('settingEmail', p.email);
      setVal('settingAddress', p.address);
    }
  } catch (err) {
    console.error("Profile load error:", err);
  }
}

// ==========================================
// 9. REPORT CARD MODAL & PRINT
// ==========================================
window.openReportCard = async function(studentId) {
  const year = document.getElementById('globalSessionSelect')?.value || '2026-2027';

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

// ==========================================
// 10. SETUP EVENT LISTENERS
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
        msg.innerHTML = `${data.message || 'Login failed!'} <a href="javascript:void(0)" onclick="openForgotPasswordModal()" style="color: #2563eb; text-decoration: underline; font-weight: 600; margin-left: 6px;">Forgot Password?</a>`;
      }
    }
    } catch (err) {
      if (msg) {
        msg.style.color = '#dc2626';
        msg.textContent = 'Server se connection fail hua!';
      }
    }
  });

  // Toggle Admission Form Show / Hide
  const toggleBtn = document.getElementById('toggleAdmissionBtn');
  const formContainer = document.getElementById('admissionFormContainer');

  toggleBtn?.addEventListener('click', () => {
    if (formContainer.style.display === 'none' || formContainer.style.display === '') {
      formContainer.style.display = 'block';
      toggleBtn.innerHTML = '✖ Close Form';
      toggleBtn.style.background = '#dc2626';
    } else {
      formContainer.style.display = 'none';
      toggleBtn.innerHTML = '➕ New Student';
      toggleBtn.style.background = '#16a34a';
    }
  });

  // Global Session Selector change trigger
  document.getElementById('globalSessionSelect')?.addEventListener('change', () => {
    if (currentActiveExam) {
      loadResultsMatrix();
    }
    fetchStudents();
  });

  // Student Registration Form Submit (Handles both Add & Edit)
  document.getElementById('studentRegistrationForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

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
        resetAdmissionForm();
        fetchStudents();

        if (msgEl) {
          msgEl.style.color = '#16a34a';
          msgEl.style.fontWeight = 'bold';
          msgEl.style.padding = '8px 12px';
          msgEl.style.background = '#dcfce7';
          msgEl.style.borderRadius = '6px';
          msgEl.style.marginTop = '12px';
          msgEl.textContent = '✅ ' + result.message;

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

  const classOrder = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'];

// 1. Filter Badalne par sirf (+1) aur (-1) Options Dikhana
document.getElementById('classFilterSelect')?.addEventListener('change', (e) => {
  applyFilters();
  rebuildTargetClassOptions(e.target.value);
});

function rebuildTargetClassOptions(currentClass) {
  const targetSelect = document.getElementById('targetClassSelect');
  const actionBtn = document.getElementById('btnBatchAction');
  if (!targetSelect || !actionBtn) return;

  targetSelect.innerHTML = '';

  // Agar "All Classes" chuni hai toh action block disable rakhein
  if (!currentClass) {
    targetSelect.innerHTML = '<option value="">-- Class Filter Chunein --</option>';
    targetSelect.disabled = true;
    actionBtn.disabled = true;
    actionBtn.style.opacity = '0.5';
    actionBtn.style.cursor = 'not-allowed';
    return;
  }

  targetSelect.disabled = false;
  actionBtn.disabled = false;
  actionBtn.style.opacity = '1';
  actionBtn.style.cursor = 'pointer';

  const idx = classOrder.indexOf(currentClass);

  // Next Class (+1)
  if (idx !== -1 && idx + 1 < classOrder.length) {
    const nextCls = classOrder[idx + 1];
    const optNext = document.createElement('option');
    optNext.value = nextCls;
    optNext.textContent = `Next: Class ${nextCls}`;
    targetSelect.appendChild(optNext);
  } else if (idx === classOrder.length - 1) {
    // 12th class ke liye Alumni
    const optPass = document.createElement('option');
    optPass.value = 'Passed Out';
    optPass.textContent = `🎓 Passed Out (Alumni)`;
    targetSelect.appendChild(optPass);
  }

  // Previous Class (-1) - Revert / Demote option
  if (idx > 0) {
    const prevCls = classOrder[idx - 1];
    const optPrev = document.createElement('option');
    optPrev.value = prevCls;
    optPrev.textContent = `Previous: Class ${prevCls}`;
    targetSelect.appendChild(optPrev);
  }

  // Button ka name aur color pehle option ke hisab se set karein
  syncBulkActionButton();
}

// 2. Dropdown Change hone par Button ka Name aur Color Auto-Switch hona
window.syncBulkActionButton = function() {
  const currentClass = document.getElementById('classFilterSelect')?.value;
  const targetClass = document.getElementById('targetClassSelect')?.value;
  const btn = document.getElementById('btnBatchAction');
  if (!btn || !currentClass || !targetClass) return;

  const curIdx = classOrder.indexOf(currentClass);
  const tarIdx = classOrder.indexOf(targetClass);

  if (targetClass === 'Passed Out' || tarIdx > curIdx) {
    // Promote Mode (+1)
    btn.innerHTML = '🚀 Promote';
    btn.style.background = '#2563eb'; // Blue
    btn.dataset.actionType = 'promote';
  } else {
    // Demote Mode (-1)
    btn.innerHTML = '🔻 Demote / Revert';
    btn.style.background = '#dc2626'; // Red
    btn.dataset.actionType = 'demote';
  }
};
let currentDirectoryTab = 'Active'; // 'Active' or 'Inactive'

window.switchDirectorySubTab = function(tabStatus) {
  currentDirectoryTab = tabStatus;

  const btnActive = document.getElementById('subTabActive');
  const btnDrop = document.getElementById('subTabDropbox');
  const activeControls = document.getElementById('activeActionControls');
  const dropboxControls = document.getElementById('dropboxActionControls');

  if (tabStatus === 'Active') {
    btnActive.style.background = '#1e3a8a';
    btnActive.style.color = '#ffffff';
    btnDrop.style.background = '#e2e8f0';
    btnDrop.style.color = '#475569';
    if (activeControls) activeControls.style.display = 'flex';
    if (dropboxControls) dropboxControls.style.display = 'none';
  } else {
    btnDrop.style.background = '#475569';
    btnDrop.style.color = '#ffffff';
    btnActive.style.background = '#e2e8f0';
    btnActive.style.color = '#475569';
    if (activeControls) activeControls.style.display = 'none';
    if (dropboxControls) dropboxControls.style.display = 'flex';
  }

  applyFilters();
};

// Filter function me status separation + count update
function applyFilters() {
  const query = (document.getElementById('studentSearchInput')?.value || '').toLowerCase();
  const selectedClass = document.getElementById('classFilterSelect')?.value || '';

  // Tab Badge counts update
  const activeTotal = allStudentsList.filter(s => (s.status || 'Active') === 'Active').length;
  const dropTotal = allStudentsList.filter(s => s.status === 'Inactive').length;
  
  if (document.getElementById('activeCountBadge')) document.getElementById('activeCountBadge').textContent = activeTotal;
  if (document.getElementById('dropboxCountBadge')) document.getElementById('dropboxCountBadge').textContent = dropTotal;

  filteredStudentsList = allStudentsList.filter(s => {
    const sStatus = s.status || 'Active';
    const matchStatus = (sStatus === currentDirectoryTab);
    const fullName = `${s.first_name} ${s.last_name || ''}`.toLowerCase();
    const matchQuery = fullName.includes(query) ||
      (s.sr_no && s.sr_no.toLowerCase().includes(query)) ||
      (s.roll_no && s.roll_no.toLowerCase().includes(query)) ||
      (s.mobile_no && s.mobile_no.includes(query));
    const matchClass = selectedClass === '' || s.class === selectedClass;

    return matchStatus && matchQuery && matchClass;
  });

  renderStudentsTable();
}

// Bulk Move to Dropbox / Restore Action
window.executeStatusChange = async function(targetStatus) {
  const checkboxes = document.querySelectorAll('.student-select-cb:checked');
  const studentIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

  if (studentIds.length === 0) {
    alert("Kripya kam se kam ek student select karein!");
    return;
  }

  const promptText = (targetStatus === 'Inactive')
    ? `Kya aap selected ${studentIds.length} students ko Dropbox (Inactive) me bhejna chahte hain?`
    : `Kya aap selected ${studentIds.length} students ko wapas Active Directory me lana chahte hain?`;

  if (!confirm(promptText)) return;

  try {
    const res = await fetch('/api/students/bulk-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_ids: studentIds, status: targetStatus })
    });
    const result = await res.json();
    if (res.ok && result.status === 'success') {
      alert("✅ " + result.message);
      fetchStudents();
    } else {
      alert("Error: " + result.message);
    }
  } catch (err) {
    alert("Server error: Status change nahi ho saka!");
  }
};

// 3. Unified Batch Execution Function
window.executeBatchClassChange = async function() {
  const checkboxes = document.querySelectorAll('.student-select-cb:checked');
  const studentIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
  const currentClass = document.getElementById('classFilterSelect')?.value;
  const targetClass = document.getElementById('targetClassSelect')?.value;
  const sessionYear = document.getElementById('globalSessionSelect')?.value || '2026-2027';
  const btn = document.getElementById('btnBatchAction');
  const actionType = btn?.dataset.actionType || 'promote';

  if (!currentClass) {
    alert("Kripya pehle Class filter select karein!");
    return;
  }

  if (studentIds.length === 0) {
    alert("Kripya kam se kam ek student select karein!");
    return;
  }

  if (!targetClass) {
    alert("Target class select nahi hai!");
    return;
  }

  const confirmMsg = actionType === 'promote'
    ? `🚀 Kya aap selected ${studentIds.length} students ko promote karke Class ${targetClass} me bhejna chahte hain?`
    : `🔻 Kya aap selected ${studentIds.length} students ko wapas pichli Class ${targetClass} me demote karna chahte hain?`;

  if (!confirm(confirmMsg)) return;

  try {
    const res = await fetch('/api/students/bulk-promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_ids: studentIds,
        target_class: targetClass,
        session_year: sessionYear,
        action: actionType
      })
    });

    const result = await res.json();
    if (res.ok && result.status === 'success') {
      alert("✅ " + result.message);
      fetchStudents(); // Table auto reload
    } else {
      alert("Error: " + (result.message || "Operation fail ho gaya!"));
    }
  } catch (err) {
    console.error("Bulk action error:", err);
    alert("Server error: Request complete nahi ho saki!");
  }
};

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

  // Results Controls
  document.getElementById('resClassSelect')?.addEventListener('change', loadResultsMatrix);
  document.getElementById('resSubjectSelect')?.addEventListener('change', loadResultsMatrix);

  // Save Subject Marks (Reads globalSession & currentActiveExam)
  document.getElementById('saveResultsBtn')?.addEventListener('click', async () => {
    const rows = document.querySelectorAll('#resultsTableBody tr');
    const marksData = [];

    rows.forEach(tr => {
      const sid = tr.dataset.studentId;
      if (sid) {
        marksData.push({
          student_id: parseInt(sid),
          project: tr.querySelector('.input-project')?.value.trim() || '0',
          practical: tr.querySelector('.input-practical')?.value.trim() || '0',
          theory: tr.querySelector('.input-theory')?.value.trim() || '0'
        });
      }
    });

    const selectedYear = document.getElementById('globalSessionSelect')?.value || '2026-2027';
    const selectedExam = currentActiveExam || 'Half Yearly';
    const selectedSub = document.getElementById('resSubjectSelect')?.value;

    if (!selectedSub) {
      alert("Kripya subject select karein!");
      return;
    }

    try {
      const res = await fetch('/api/results-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: selectedYear,
          exam: selectedExam,
          subject: selectedSub,
          marks_data: marksData
        })
      });

      const data = await res.json();
      if (data.status === 'success') {
        alert("✅ Marks successfully save ho gaye!");
        loadResultsMatrix();
      } else {
        alert("Error: " + (data.message || "Save nahi ho sake!"));
      }
    } catch (err) {
      console.error("Save marks error:", err);
      alert("Server error: Marks save nahi hue!");
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

// Global scope bindings for inline HTML handlers
window.loadResultsMatrix = loadResultsMatrix;
window.editStudentById = editStudentById;
window.cancelEditMode = cancelEditMode;
window.resetAdmissionForm = resetAdmissionForm;