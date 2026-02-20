// ─── Constants ───────────────────────────────────────────────────────────────
const TODAY       = new Date();
const MONTHS      = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DAYS_SHORT  = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

// ─── State ───────────────────────────────────────────────────────────────────
let S = {
  employees: [
    { id: 'e1', name: 'Shankar',  role: 'Worker' },
    { id: 'e2', name: 'Santosh',  role: 'Worker' },
    { id: 'e3', name: 'Gopal',    role: 'Worker' },
    { id: 'e4', name: 'Maya',     role: 'Maid'   },
    { id: 'e5', name: 'Jaspal',   role: 'Worker' },
  ],
  attendance: {},   // key: `${empId}|YYYY-MM-DD`  → hours (number, 0 = absent)
  viewYear:   TODAY.getFullYear(),
  viewMonth:  TODAY.getMonth(),
  selDay:     TODAY.getDate(),     // selected day in month view
  selEmpId:   null,
  empViewYear:  TODAY.getFullYear(),
  empViewMonth: TODAY.getMonth(),
  curView:    'month',             // 'month' | 'employee'
};

// Transient (not saved)
let popupEmpId = null;
let popupDay   = null;
let popupView  = 'month';         // which view opened the popup
let ctxEmpId   = null;

// ─── Persistence ─────────────────────────────────────────────────────────────
function save() {
  localStorage.setItem('orchard_v2', JSON.stringify({
    e: S.employees,
    a: S.attendance,
  }));
}

function load() {
  try {
    const raw = localStorage.getItem('orchard_v2');
    if (!raw) return;
    const d = JSON.parse(raw);
    if (Array.isArray(d.e) && d.e.length) S.employees  = d.e;
    if (d.a && typeof d.a === 'object')   S.attendance = d.a;
  } catch { /* ignore */ }
}

// ─── Key Helpers ──────────────────────────────────────────────────────────────
function dk(y, m, d) {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function ak(empId, dateStr) { return `${empId}|${dateStr}`; }

function getHrs(empId, dateStr) {
  const v = S.attendance[ak(empId, dateStr)];
  return v === undefined ? null : v;
}

function setHrs(empId, dateStr, hours) {
  if (hours === null) delete S.attendance[ak(empId, dateStr)];
  else S.attendance[ak(empId, dateStr)] = Number(hours);
  save();
}

// ─── Date Helpers ─────────────────────────────────────────────────────────────
function dim(y, m)   { return new Date(y, m + 1, 0).getDate(); }
function dow(y, m, d){ return new Date(y, m, d).getDay(); }   // 0=Sun

function dayStatus(y, m, d) {
  const td = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  const cd = new Date(y, m, d);
  if (cd.getTime() === td.getTime()) return 'today';
  if (cd < td) return 'past';
  return 'future';
}

// ─── Status / Labels ──────────────────────────────────────────────────────────
function statusOf(hrs) {
  if (hrs === null)  return 'unmarked';
  if (hrs === 0)     return 'absent';
  if (hrs < 8)       return 'partial';
  if (hrs === 8)     return 'present';
  return 'overtime';
}

function hrsLabel(hrs) {
  if (hrs === null) return '—';
  if (hrs === 0)    return 'Abs';
  return `${hrs}h`;
}

function initials(name) {
  return name.split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase();
}

// ─── Toast ────────────────────────────────────────────────────────────────────
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}


// ════════════════════════════════════════════════════════════
// MONTH GRID VIEW
// ════════════════════════════════════════════════════════════

function renderMonthView() {
  const { viewYear: y, viewMonth: m, selDay } = S;
  const totalDays = dim(y, m);

  document.getElementById('mv-month-label').textContent = `${MONTHS[m]} ${y}`;

  // ── Build header row ──────────────────────────────────────
  const headRow = document.getElementById('grid-head-row');
  headRow.innerHTML = '';

  // Employee th
  const empTh = document.createElement('th');
  empTh.className = 'th-emp';
  empTh.textContent = 'EMPLOYEE';
  headRow.appendChild(empTh);

  // Day ths
  for (let d = 1; d <= totalDays; d++) {
    const th   = document.createElement('th');
    th.className = 'th-day';
    const ds   = dayStatus(y, m, d);
    const isSel = d === selDay;

    if (ds === 'today')  th.classList.add('col-today');
    if (ds === 'future') th.classList.add('col-future');
    if (isSel)           th.classList.add('col-selected');

    th.innerHTML =
      `<span class="th-dnum">${d}</span>` +
      `<span class="th-dname">${DAYS_SHORT[dow(y, m, d)]}</span>` +
      (ds === 'today' ? '<span class="today-bullet">•</span>' : '');

    th.dataset.day = d;
    th.addEventListener('click', () => { S.selDay = d; renderMonthView(); });
    headRow.appendChild(th);
  }

  // Total th
  const totTh = document.createElement('th');
  totTh.className = 'th-total';
  totTh.textContent = 'TOTAL';
  headRow.appendChild(totTh);

  // ── Build body rows ───────────────────────────────────────
  const tbody = document.getElementById('grid-body');
  tbody.innerHTML = '';

  for (const emp of S.employees) {
    const tr = document.createElement('tr');

    // Employee name cell
    const nameTd = document.createElement('td');
    nameTd.className = 'td-emp';
    nameTd.innerHTML =
      `<div class="emp-row-cell">` +
        `<span class="emp-av">${initials(emp.name)}</span>` +
        `<span class="emp-nm" data-id="${emp.id}">${emp.name}</span>` +
        `<button class="emp-menu" data-id="${emp.id}" title="Options">&#8943;</button>` +
      `</div>`;

    nameTd.querySelector('.emp-nm').addEventListener('click', () => openEmployeeView(emp.id));
    nameTd.querySelector('.emp-menu').addEventListener('click', e => showCtxMenu(emp.id, e));
    tr.appendChild(nameTd);

    // Day cells
    let monthTotal = 0;
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = dk(y, m, d);
      const hrs     = getHrs(emp.id, dateStr);
      const status  = statusOf(hrs);
      const ds      = dayStatus(y, m, d);
      const isSel   = d === selDay;

      if (hrs !== null) monthTotal += hrs;

      const td = document.createElement('td');
      td.className = `td-day cell-${status}`;
      if (ds === 'today')  td.classList.add('cell-today-col');
      if (ds === 'future') td.classList.add('cell-future');
      if (isSel)           td.classList.add('cell-sel-col');

      td.textContent   = hrsLabel(hrs);
      td.dataset.empId = emp.id;
      td.dataset.day   = d;

      if (ds !== 'future') {
        td.addEventListener('click', e => openCellPopup(emp.id, d, td, e));
      }
      tr.appendChild(td);
    }

    // Total cell
    const totTd = document.createElement('td');
    totTd.className = 'td-total';
    totTd.textContent = monthTotal > 0 ? `${monthTotal}h` : '—';
    tr.appendChild(totTd);

    tbody.appendChild(tr);
  }

  renderQuickPanel();

  // Scroll selected / today column into view
  requestAnimationFrame(() => {
    const selTh = headRow.querySelector('.col-selected') ||
                  headRow.querySelector('.col-today');
    if (selTh) selTh.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  });
}

// ─── Quick Mark Panel ────────────────────────────────────────────────────────
function renderQuickPanel() {
  const { selDay, viewYear: y, viewMonth: m } = S;
  const dateStr  = selDay ? dk(y, m, selDay) : null;
  const ds       = selDay ? dayStatus(y, m, selDay) : null;
  const isFuture = ds === 'future';

  const labelEl     = document.getElementById('quick-date-label');
  const bulkActions = document.getElementById('bulk-actions');
  const listEl      = document.getElementById('quick-emp-list');
  const prevBtn     = document.getElementById('qd-prev');
  const nextBtn     = document.getElementById('qd-next');

  if (!selDay) {
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
    bulkActions.style.display = 'none';
    listEl.innerHTML = '<p class="quick-hint">&#8593; Click any day column above to mark attendance</p>';
    return;
  }

  // Show nav arrows; disable next if already on today
  prevBtn.style.display = '';
  nextBtn.style.display = '';
  const todayDate = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  const selDate   = new Date(y, m, selDay);
  nextBtn.disabled = selDate >= todayDate;

  const dayLabel = `${DAYS_SHORT[dow(y, m, selDay)]}, ${selDay} ${MONTHS[m].slice(0,3)} ${y}`;
  labelEl.textContent = dayLabel;

  bulkActions.style.display = isFuture ? 'none' : 'flex';
  listEl.innerHTML = '';

  S.employees.forEach(emp => {
    const hrs    = getHrs(emp.id, dateStr);
    const status = statusOf(hrs);

    const card = document.createElement('div');
    card.className = 'qcard';

    if (isFuture) {
      card.innerHTML =
        `<span class="qcard-name">${emp.name}</span>` +
        `<span class="qcard-future">Future date – cannot mark</span>`;
    } else {
      const defHrs = (hrs !== null && hrs !== 0 && hrs !== 8) ? hrs : 8;
      card.innerHTML =
        `<span class="qcard-name">${emp.name}</span>` +
        `<span class="qcard-badge badge-${status}">${hrsLabel(hrs)}</span>` +
        `<button class="qbtn qbtn-present" data-emp="${emp.id}">Present</button>` +
        `<button class="qbtn qbtn-absent"  data-emp="${emp.id}">Absent</button>` +
        `<input  class="qhrs-input" type="number" min="0" max="24" step="0.5" value="${defHrs}" />` +
        `<button class="qbtn qbtn-set"     data-emp="${emp.id}">Set</button>`;

      const inp = card.querySelector('.qhrs-input');
      card.querySelector('.qbtn-present').addEventListener('click', () => {
        setHrs(emp.id, dateStr, 8);
        renderMonthView();
        toast(`${emp.name}: Present (8h)`);
      });
      card.querySelector('.qbtn-absent').addEventListener('click', () => {
        setHrs(emp.id, dateStr, 0);
        renderMonthView();
        toast(`${emp.name}: Absent`);
      });
      card.querySelector('.qbtn-set').addEventListener('click', () => {
        const v = parseFloat(inp.value);
        if (isNaN(v) || v < 0 || v > 24) { toast('Enter hours between 0 and 24'); return; }
        setHrs(emp.id, dateStr, v);
        renderMonthView();
        toast(`${emp.name}: ${v}h`);
      });
    }

    listEl.appendChild(card);
  });
}

// ─── Day navigation (prev / next) ────────────────────────────────────────────
function changeSelDay(dir) {
  if (!S.selDay) return;
  let y = S.viewYear, m = S.viewMonth, d = S.selDay + dir;

  if (d < 1) {
    m--;
    if (m < 0) { m = 11; y--; }
    d = dim(y, m);
  } else if (d > dim(y, m)) {
    m++;
    if (m > 11) { m = 0; y++; }
    d = 1;
  }

  // Never step into the future
  const target    = new Date(y, m, d);
  const todayDate = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  if (target > todayDate) return;

  S.viewYear  = y;
  S.viewMonth = m;
  S.selDay    = d;
  closeCellPopup();
  renderMonthView();
}

// ─── Mark All for selected day ────────────────────────────────────────────────
function markAllForDay(type) {
  if (!S.selDay) return;
  const dateStr = dk(S.viewYear, S.viewMonth, S.selDay);
  const hrs     = type === 'present' ? 8 : 0;
  S.employees.forEach(emp => setHrs(emp.id, dateStr, hrs));
  renderMonthView();
  toast(type === 'present' ? 'All marked Present (8h)' : 'All marked Absent');
}

// ─── Month navigation (month view) ───────────────────────────────────────────
function changeMonthView(dir) {
  S.viewMonth += dir;
  if (S.viewMonth > 11) { S.viewMonth = 0;  S.viewYear++;  }
  if (S.viewMonth < 0)  { S.viewMonth = 11; S.viewYear--;  }
  // Keep selDay within valid range
  S.selDay = Math.min(S.selDay, dim(S.viewYear, S.viewMonth));
  closeCellPopup();
  renderMonthView();
}


// ════════════════════════════════════════════════════════════
// CELL EDIT POPUP
// ════════════════════════════════════════════════════════════

function openCellPopup(empId, day, cellEl, evt) {
  evt.stopPropagation();
  popupEmpId = empId;
  popupDay   = day;
  popupView  = S.curView;

  const y  = S.curView === 'month' ? S.viewYear  : S.empViewYear;
  const m  = S.curView === 'month' ? S.viewMonth : S.empViewMonth;
  const dateStr = dk(y, m, day);
  const hrs     = getHrs(empId, dateStr);
  const emp     = S.employees.find(e => e.id === empId);
  const dayName = DAYS_SHORT[dow(y, m, day)];

  document.getElementById('cp-title').textContent =
    `${emp.name} – ${dayName} ${day} ${MONTHS[m].slice(0,3)} ${y}`;
  document.getElementById('cp-hours').value = hrs !== null ? hrs : 8;

  const popup   = document.getElementById('cell-popup');
  const overlay = document.getElementById('popup-overlay');
  popup.style.display   = 'block';
  overlay.style.display = 'block';

  // Position near cell
  const rect = cellEl.getBoundingClientRect();
  let top  = rect.bottom + 6;
  let left = rect.left;
  popup.style.top  = `${top}px`;
  popup.style.left = `${left}px`;

  requestAnimationFrame(() => {
    const pw = popup.offsetWidth;
    const ph = popup.offsetHeight;
    if (left + pw > window.innerWidth - 8)  left = window.innerWidth  - pw - 8;
    if (top  + ph > window.innerHeight - 8) top  = rect.top - ph - 6;
    popup.style.top  = `${top}px`;
    popup.style.left = `${left}px`;
  });
}

function closeCellPopup() {
  document.getElementById('cell-popup').style.display   = 'none';
  document.getElementById('popup-overlay').style.display = 'none';
  popupEmpId = null;
  popupDay   = null;
}

function applyPopup(hrs) {
  if (popupEmpId === null || popupDay === null) return;
  const y = popupView === 'month' ? S.viewYear  : S.empViewYear;
  const m = popupView === 'month' ? S.viewMonth : S.empViewMonth;
  const dateStr = dk(y, m, popupDay);
  const emp = S.employees.find(e => e.id === popupEmpId);

  setHrs(popupEmpId, dateStr, hrs);
  closeCellPopup();

  const label = hrs === null ? 'Cleared' : hrs === 0 ? 'Absent' : `${hrs}h`;
  toast(`${emp.name}: ${label}`);

  if (popupView === 'month')    renderMonthView();
  else                          renderEmployeeView();
}


// ════════════════════════════════════════════════════════════
// EMPLOYEE VIEW
// ════════════════════════════════════════════════════════════

function openEmployeeView(empId) {
  S.curView     = 'employee';
  S.selEmpId    = empId;
  S.empViewYear  = S.viewYear;
  S.empViewMonth = S.viewMonth;
  closeCtxMenu();
  document.getElementById('month-view').style.display    = 'none';
  document.getElementById('employee-view').style.display = '';
  renderEmployeeView();
}

function closeEmployeeView() {
  S.curView  = 'month';
  S.selEmpId = null;
  closeCellPopup();
  document.getElementById('employee-view').style.display = 'none';
  document.getElementById('month-view').style.display    = '';
  renderMonthView();
}

function renderEmployeeView() {
  const emp = S.employees.find(e => e.id === S.selEmpId);
  if (!emp) return;

  const y = S.empViewYear, m = S.empViewMonth;
  const totalDays = dim(y, m);

  // ── Calculate stats ───────────────────────────────────────
  let monthHrs = 0, allTimeHrs = 0;
  let presentCount = 0, absentCount = 0;

  for (let d = 1; d <= totalDays; d++) {
    const h = getHrs(emp.id, dk(y, m, d));
    if (h !== null) monthHrs += h;
  }

  for (const [key, val] of Object.entries(S.attendance)) {
    if (key.startsWith(`${emp.id}|`)) {
      allTimeHrs += val;
      if (val  > 0) presentCount++;
      if (val === 0) absentCount++;
    }
  }

  // ── Render ────────────────────────────────────────────────
  const content = document.getElementById('emp-view-content');
  content.innerHTML =
    `<div class="ep-profile-card">
       <div class="ep-avatar">${initials(emp.name)}</div>
       <div class="ep-info">
         <h2 class="ep-name">${emp.name}</h2>
         <p class="ep-role">${emp.role}</p>
       </div>
     </div>

     <div class="ep-stats-row">
       <div class="ep-stat">
         <span class="ep-stat-num">${monthHrs}h</span>
         <span class="ep-stat-lbl">This Month</span>
       </div>
       <div class="ep-stat-divider"></div>
       <div class="ep-stat">
         <span class="ep-stat-num">${allTimeHrs}h</span>
         <span class="ep-stat-lbl">All Time</span>
       </div>
       <div class="ep-stat-divider"></div>
       <div class="ep-stat">
         <span class="ep-stat-num">${presentCount}</span>
         <span class="ep-stat-lbl">Days Present</span>
       </div>
       <div class="ep-stat-divider"></div>
       <div class="ep-stat">
         <span class="ep-stat-num">${absentCount}</span>
         <span class="ep-stat-lbl">Days Absent</span>
       </div>
     </div>

     <div class="ep-cal-nav">
       <button class="ep-nav-btn" id="ep-prev">&#8249;</button>
       <span class="ep-cal-month">${MONTHS[m]} ${y}</span>
       <button class="ep-nav-btn" id="ep-next">&#8250;</button>
     </div>

     <div class="ep-calendar">
       <div class="ep-cal-header">
         <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span>
         <span>Thu</span><span>Fri</span><span>Sat</span>
       </div>
       <div class="ep-cal-grid" id="ep-cal-grid"></div>
     </div>

     <div class="ep-legend">
       <span class="ep-li"><span class="ep-ld present"></span>Present (8h)</span>
       <span class="ep-li"><span class="ep-ld absent"></span>Absent</span>
       <span class="ep-li"><span class="ep-ld partial"></span>Partial (&lt;8h)</span>
       <span class="ep-li"><span class="ep-ld overtime"></span>Overtime (&gt;8h)</span>
     </div>`;

  // Build calendar grid
  const grid      = document.getElementById('ep-cal-grid');
  const firstDow  = dow(y, m, 1); // 0=Sun

  // Blank cells for offset
  for (let i = 0; i < firstDow; i++) {
    const blank = document.createElement('div');
    blank.className = 'ep-day empty';
    grid.appendChild(blank);
  }

  // Day cells
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = dk(y, m, d);
    const hrs     = getHrs(emp.id, dateStr);
    const status  = statusOf(hrs);
    const ds      = dayStatus(y, m, d);

    const cell = document.createElement('div');
    cell.className = `ep-day ep-${status}`;
    if (ds === 'today')  cell.classList.add('ep-today');
    if (ds === 'future') cell.classList.add('ep-future');

    cell.textContent = d;

    // Sub-label showing hours
    if (hrs !== null && hrs !== 8 && hrs !== 0) {
      const sub = document.createElement('span');
      sub.className   = 'ep-hrs-sub';
      sub.textContent = `${hrs}h`;
      cell.appendChild(sub);
    }

    if (ds !== 'future') {
      cell.title = hrs !== null ? `${hrs}h` : 'Not marked';
      cell.addEventListener('click', e => openCellPopup(emp.id, d, cell, e));
    }
    grid.appendChild(cell);
  }

  // Month navigation
  document.getElementById('ep-prev').addEventListener('click', () => {
    S.empViewMonth--;
    if (S.empViewMonth < 0) { S.empViewMonth = 11; S.empViewYear--; }
    closeCellPopup();
    renderEmployeeView();
  });
  document.getElementById('ep-next').addEventListener('click', () => {
    S.empViewMonth++;
    if (S.empViewMonth > 11) { S.empViewMonth = 0; S.empViewYear++; }
    closeCellPopup();
    renderEmployeeView();
  });
}


// ════════════════════════════════════════════════════════════
// ADD EMPLOYEE
// ════════════════════════════════════════════════════════════

function openAddEmployeeModal() {
  document.getElementById('new-emp-name').value = '';
  document.getElementById('new-emp-role').value = '';
  document.getElementById('modal-overlay').style.display = 'flex';
  setTimeout(() => document.getElementById('new-emp-name').focus(), 80);
}

function closeAddEmployeeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

function addEmployee() {
  const name = document.getElementById('new-emp-name').value.trim();
  const role = document.getElementById('new-emp-role').value.trim() || 'Worker';
  if (!name) { toast('Please enter a name'); return; }
  const id = 'e' + Date.now();
  S.employees.push({ id, name, role });
  save();
  closeAddEmployeeModal();
  renderMonthView();
  toast(`${name} added`);
}


// ════════════════════════════════════════════════════════════
// EDIT PREVIOUS DAY
// ════════════════════════════════════════════════════════════

function openEditDayModal() {
  const todayStr = dk(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  const inp = document.getElementById('edit-day-date');
  inp.max   = todayStr;
  // Pre-fill with currently selected day (if past/today), else today
  const curStr = S.selDay ? dk(S.viewYear, S.viewMonth, S.selDay) : todayStr;
  inp.value = curStr <= todayStr ? curStr : todayStr;
  document.getElementById('edit-day-overlay').style.display = 'flex';
  setTimeout(() => inp.focus(), 80);
}

function closeEditDayModal() {
  document.getElementById('edit-day-overlay').style.display = 'none';
}

function applyEditDay() {
  const val = document.getElementById('edit-day-date').value;
  if (!val) { toast('Please select a date'); return; }

  const parts = val.split('-');
  const y = Number(parts[0]), month = Number(parts[1]) - 1, d = Number(parts[2]);

  const selected = new Date(y, month, d);
  const todayDate = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  if (selected > todayDate) { toast('Cannot edit future dates'); return; }

  S.viewYear  = y;
  S.viewMonth = month;
  S.selDay    = d;
  closeEditDayModal();

  // If in employee view, switch back to month view
  if (S.curView !== 'month') {
    S.curView = 'month';
    S.selEmpId = null;
    closeCellPopup();
    document.getElementById('employee-view').style.display = 'none';
    document.getElementById('month-view').style.display    = '';
  }

  renderMonthView();
  toast(`Editing ${DAYS_SHORT[new Date(y, month, d).getDay()]}, ${d} ${MONTHS[month].slice(0,3)} ${y}`);
}


// ════════════════════════════════════════════════════════════
// EDIT EMPLOYEE NAME / ROLE
// ════════════════════════════════════════════════════════════

let editEmpId = null;

function openEditEmpModal(empId) {
  const emp = S.employees.find(e => e.id === empId);
  if (!emp) return;
  editEmpId = empId;
  document.getElementById('edit-emp-name').value = emp.name;
  document.getElementById('edit-emp-role').value = emp.role;
  document.getElementById('edit-emp-overlay').style.display = 'flex';
  setTimeout(() => document.getElementById('edit-emp-name').focus(), 80);
}

function closeEditEmpModal() {
  document.getElementById('edit-emp-overlay').style.display = 'none';
  editEmpId = null;
}

function saveEditEmp() {
  const name = document.getElementById('edit-emp-name').value.trim();
  const role = document.getElementById('edit-emp-role').value.trim() || 'Worker';
  if (!name) { toast('Please enter a name'); return; }
  const emp = S.employees.find(e => e.id === editEmpId);
  if (!emp) return;
  emp.name = name;
  emp.role = role;
  save();
  closeEditEmpModal();
  if (S.curView === 'employee' && S.selEmpId === editEmpId) renderEmployeeView();
  else renderMonthView();
  toast(`Updated: ${name}`);
}


// ════════════════════════════════════════════════════════════
// REMOVE EMPLOYEE  (context menu)
// ════════════════════════════════════════════════════════════

function showCtxMenu(empId, evt) {
  evt.stopPropagation();
  ctxEmpId = empId;
  const menu = document.getElementById('ctx-menu');
  menu.style.display = 'block';

  let top  = evt.clientY;
  let left = evt.clientX;
  menu.style.top  = `${top}px`;
  menu.style.left = `${left}px`;

  requestAnimationFrame(() => {
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    if (left + mw > window.innerWidth  - 8) left = window.innerWidth  - mw - 8;
    if (top  + mh > window.innerHeight - 8) top  = window.innerHeight - mh - 8;
    menu.style.top  = `${top}px`;
    menu.style.left = `${left}px`;
  });
}

function closeCtxMenu() {
  document.getElementById('ctx-menu').style.display = 'none';
  ctxEmpId = null;
}

function removeEmployee(empId) {
  const emp = S.employees.find(e => e.id === empId);
  if (!emp) return;
  if (!confirm(`Remove "${emp.name}" from the list? Their attendance data will also be deleted.`)) return;

  S.employees = S.employees.filter(e => e.id !== empId);
  // Remove attendance records
  for (const key of Object.keys(S.attendance)) {
    if (key.startsWith(`${empId}|`)) delete S.attendance[key];
  }
  save();
  closeCtxMenu();
  renderMonthView();
  toast(`${emp.name} removed`);
}


// ════════════════════════════════════════════════════════════
// GLOBAL EVENT WIRING
// ════════════════════════════════════════════════════════════

function wireEvents() {
  // Month navigation
  document.getElementById('mv-prev').addEventListener('click', () => changeMonthView(-1));
  document.getElementById('mv-next').addEventListener('click', () => changeMonthView(1));

  // Day prev/next
  document.getElementById('qd-prev').addEventListener('click', () => changeSelDay(-1));
  document.getElementById('qd-next').addEventListener('click', () => changeSelDay(1));

  // Edit day
  document.getElementById('edit-day-btn').addEventListener('click', openEditDayModal);
  document.getElementById('edit-day-cancel').addEventListener('click', closeEditDayModal);
  document.getElementById('edit-day-go').addEventListener('click', applyEditDay);
  document.getElementById('edit-day-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('edit-day-overlay')) closeEditDayModal();
  });
  document.getElementById('edit-day-date').addEventListener('keydown', e => {
    if (e.key === 'Enter') applyEditDay();
  });

  // Add employee
  document.getElementById('add-emp-btn').addEventListener('click', openAddEmployeeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeAddEmployeeModal);
  document.getElementById('modal-add').addEventListener('click', addEmployee);
  document.getElementById('new-emp-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('new-emp-role').focus();
  });
  document.getElementById('new-emp-role').addEventListener('keydown', e => {
    if (e.key === 'Enter') addEmployee();
  });

  // Close modal on overlay click
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeAddEmployeeModal();
  });

  // Bulk mark
  document.getElementById('bulk-present').addEventListener('click', () => markAllForDay('present'));
  document.getElementById('bulk-absent').addEventListener('click',  () => markAllForDay('absent'));

  // Cell popup actions
  document.getElementById('cp-close').addEventListener('click', closeCellPopup);
  document.getElementById('popup-overlay').addEventListener('click', closeCellPopup);

  document.getElementById('cp-present').addEventListener('click', () => applyPopup(8));
  document.getElementById('cp-absent').addEventListener('click',  () => applyPopup(0));
  document.getElementById('cp-clear').addEventListener('click',   () => applyPopup(null));
  document.getElementById('cp-set').addEventListener('click', () => {
    const v = parseFloat(document.getElementById('cp-hours').value);
    if (isNaN(v) || v < 0 || v > 24) { toast('Enter hours between 0 and 24'); return; }
    applyPopup(v);
  });
  document.getElementById('cp-hours').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('cp-set').click();
  });

  // Context menu actions
  document.getElementById('ctx-view').addEventListener('click', () => {
    if (ctxEmpId) openEmployeeView(ctxEmpId);
  });
  document.getElementById('ctx-edit').addEventListener('click', () => {
    if (ctxEmpId) { closeCtxMenu(); openEditEmpModal(ctxEmpId); }
  });
  document.getElementById('ctx-remove').addEventListener('click', () => {
    if (ctxEmpId) removeEmployee(ctxEmpId);
  });

  // Edit employee modal
  document.getElementById('edit-emp-cancel').addEventListener('click', closeEditEmpModal);
  document.getElementById('edit-emp-save').addEventListener('click', saveEditEmp);
  document.getElementById('edit-emp-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('edit-emp-overlay')) closeEditEmpModal();
  });
  document.getElementById('edit-emp-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('edit-emp-role').focus();
  });
  document.getElementById('edit-emp-role').addEventListener('keydown', e => {
    if (e.key === 'Enter') saveEditEmp();
  });

  // Close context menu on outside click
  document.addEventListener('click', () => closeCtxMenu());

  // Employee view back button
  document.getElementById('back-btn').addEventListener('click', closeEmployeeView);

  // Keyboard escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeCellPopup();
      closeCtxMenu();
      closeAddEmployeeModal();
      closeEditDayModal();
      closeEditEmpModal();
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
load();
wireEvents();
renderMonthView();
