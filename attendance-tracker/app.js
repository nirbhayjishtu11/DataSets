// ── State ──────────────────────────────────────────────────────────────────
const today = new Date();
let currentYear  = today.getFullYear();
let currentMonth = today.getMonth(); // 0-indexed

// Attendance data: keyed by "YYYY-MM-DD" → 'present' | 'absent' | 'half' | null
let attendance = loadAttendance();

// Currently selected day cell (for marking)
let selectedDate = null;

// ── Persistence ────────────────────────────────────────────────────────────
function loadAttendance() {
  try {
    return JSON.parse(localStorage.getItem('attendance_data') || '{}');
  } catch { return {}; }
}

function saveAttendance() {
  localStorage.setItem('attendance_data', JSON.stringify(attendance));
}

// ── Helpers ────────────────────────────────────────────────────────────────
function dateKey(year, month, day) {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function isToday(year, month, day) {
  return year === today.getFullYear() &&
         month === today.getMonth() &&
         day === today.getDate();
}

function isFuture(year, month, day) {
  const d = new Date(year, month, day);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return d > t;
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// ── Calendar Render ────────────────────────────────────────────────────────
function renderCalendar() {
  document.getElementById('month-label').textContent =
    `${MONTH_NAMES[currentMonth]} ${currentYear}`;

  const grid = document.getElementById('calendar-grid');
  grid.innerHTML = '';

  // First weekday of month (Monday = 0 in our grid)
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const offset = (firstDay === 0) ? 6 : firstDay - 1; // Mon-based
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Empty cells
  for (let i = 0; i < offset; i++) {
    const blank = document.createElement('div');
    blank.className = 'cal-day empty';
    grid.appendChild(blank);
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const key    = dateKey(currentYear, currentMonth, day);
    const status = attendance[key] || null;
    const future = isFuture(currentYear, currentMonth, day);
    const todayF = isToday(currentYear, currentMonth, day);

    const cell = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = day;

    if (future) {
      cell.classList.add('future');
    } else {
      if (todayF) cell.classList.add('today');
      if (status) cell.classList.add(status);
      if (selectedDate === key) cell.classList.add('selected');

      cell.addEventListener('click', () => selectDay(key, day, cell));
    }

    grid.appendChild(cell);
  }

  updateStats();
}

// ── Day Selection ──────────────────────────────────────────────────────────
function selectDay(key, day, cell) {
  // Deselect previous
  document.querySelectorAll('.cal-day.selected').forEach(c => c.classList.remove('selected'));

  if (selectedDate === key) {
    // Toggle off
    selectedDate = null;
    document.getElementById('mark-panel').style.display = 'none';
    return;
  }

  selectedDate = key;
  cell.classList.add('selected');

  // Show mark panel
  const panel = document.getElementById('mark-panel');
  const label = document.getElementById('mark-date-label');
  label.textContent = `${day} ${MONTH_NAMES[currentMonth]} ${currentYear}`;
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Mark Attendance ────────────────────────────────────────────────────────
function markAttendance(status) {
  if (!selectedDate) return;

  if (status === null) {
    delete attendance[selectedDate];
  } else {
    attendance[selectedDate] = status;
  }

  saveAttendance();
  selectedDate = null;
  document.getElementById('mark-panel').style.display = 'none';
  renderCalendar();

  const msgs = {
    present: 'Marked as Present',
    absent:  'Marked as Absent',
    half:    'Marked as Half Day',
    null:    'Attendance cleared',
  };
  showToast(msgs[status] || 'Attendance cleared');
}

// ── Stats ──────────────────────────────────────────────────────────────────
function updateStats() {
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  let present = 0, absent = 0, half = 0, total = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    if (isFuture(currentYear, currentMonth, day)) continue;
    const key = dateKey(currentYear, currentMonth, day);
    const s   = attendance[key];
    if (s === 'present') { present++; total++; }
    else if (s === 'absent')  { absent++;  total++; }
    else if (s === 'half')    { half++;    total++; }
  }

  document.getElementById('stat-present').textContent = present;
  document.getElementById('stat-absent').textContent  = absent;
  document.getElementById('stat-half').textContent    = half;
  document.getElementById('stat-total').textContent   = total;
}

// ── Month Navigation ───────────────────────────────────────────────────────
function changeMonth(dir) {
  currentMonth += dir;
  if (currentMonth > 11) { currentMonth = 0;  currentYear++;  }
  if (currentMonth < 0)  { currentMonth = 11; currentYear--;  }
  selectedDate = null;
  document.getElementById('mark-panel').style.display = 'none';
  renderCalendar();
}

// ── Tabs ───────────────────────────────────────────────────────────────────
function switchTab(tabName, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');
}

// ── Action Handlers ────────────────────────────────────────────────────────
function handlePay() {
  showToast('Pay feature coming soon!');
}

function handleCall() {
  showToast('Calling Usha 2...');
}

function showTransactions() {
  showToast('Transactions coming soon!');
}

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

// ── Seed demo data for the current month ──────────────────────────────────
function seedDemoData() {
  if (localStorage.getItem('attendance_seeded')) return;

  const year  = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();
  const statuses = ['present', 'present', 'present', 'absent', 'present', 'half', 'present'];

  for (let day = 1; day < todayDate; day++) {
    const key = dateKey(year, month, day);
    attendance[key] = statuses[day % statuses.length];
  }

  saveAttendance();
  localStorage.setItem('attendance_seeded', '1');
}

// ── Init ───────────────────────────────────────────────────────────────────
seedDemoData();
renderCalendar();
