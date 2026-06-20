/* ============================================================
   TASKFLOW — app.js  (light professional theme)
   ============================================================ */

// ── Storage ──────────────────────────────────────────────────
const S = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

// ── State ────────────────────────────────────────────────────
let tasks   = S.get('tf_tasks') || [];
let logs    = S.get('tf_logs')  || {};
let note    = S.get('tf_note')  || '';
let currentPage = 'home';

const TODAY     = () => new Date().toISOString().slice(0,10);
const DAY_NAMES  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const COLORS = [
  '#5B4CF5','#FF5C72','#00C896','#FFB020','#0099FF','#9B59FF',
  '#FF7043','#26C6DA','#66BB6A','#EC407A',
];
const EMOJIS = ['⚡','🔥','💎','🎯','📚','💪','🧠','🌱','✍️','🏃','🎵','💻','🍎','🧘','💰','🚀','❤️','⭐'];

// ── Colour → tag class map ───────────────────────────────────
function colorToTag(hex) {
  const map = {
    '#5B4CF5':'tag-indigo','#FF5C72':'tag-coral','#00C896':'tag-jade',
    '#FFB020':'tag-amber','#0099FF':'tag-sky','#9B59FF':'tag-violet',
    '#FF7043':'tag-coral','#26C6DA':'tag-sky','#66BB6A':'tag-jade','#EC407A':'tag-coral',
  };
  return map[hex] || 'tag-indigo';
}

// ── Interval helpers ─────────────────────────────────────────
function isDueToday(task) {
  const d = new Date(TODAY());
  if (task.interval === 'daily')    return true;
  if (task.interval === 'weekdays') return d.getDay() >= 1 && d.getDay() <= 5;
  if (task.interval === 'weekends') return d.getDay() === 0 || d.getDay() === 6;
  if (task.interval === 'weekly') {
    const s = new Date(task.startDate);
    return Math.floor((d - s) / 86400000) % 7 === 0;
  }
  if (task.interval === 'custom' && task.customDays) {
    const s = new Date(task.startDate);
    const diff = Math.floor((d - s) / 86400000);
    return diff >= 0 && diff % task.customDays === 0;
  }
  return false;
}

function intervalLabel(task) {
  const m = { daily:'Every day', weekdays:'Mon–Fri', weekends:'Weekends', weekly:'Weekly' };
  if (task.interval === 'custom') return `Every ${task.customDays}d`;
  return m[task.interval] || task.interval;
}

// ── Log helpers ──────────────────────────────────────────────
function getLog(date, id) { return (logs[date] || {})[id] || null; }
function setLog(date, id, s) {
  if (!logs[date]) logs[date] = {};
  logs[date][id] = s;
  S.set('tf_logs', logs);
}
function clearLog(date, id) {
  if (logs[date]) { delete logs[date][id]; S.set('tf_logs', logs); }
}

// ── Streak ───────────────────────────────────────────────────
function getStreak(task) {
  let streak = 0;
  const d = new Date(TODAY());
  for (let i = 0; i < 365; i++) {
    const ds  = d.toISOString().slice(0,10);
    const dow = d.getDay();
    let due = false;
    if (task.interval === 'daily')    due = true;
    else if (task.interval === 'weekdays') due = dow >= 1 && dow <= 5;
    else if (task.interval === 'weekends') due = dow === 0 || dow === 6;
    else if (task.interval === 'weekly') {
      const s = new Date(task.startDate);
      due = Math.floor((d - s) / 86400000) % 7 === 0;
    } else if (task.interval === 'custom') {
      const s = new Date(task.startDate);
      const diff = Math.floor((d - s) / 86400000);
      due = diff >= 0 && diff % task.customDays === 0;
    }
    if (due) {
      if (getLog(ds, task.id) === 'done') streak++;
      else break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function getLast7(taskId) {
  const r = [];
  const d = new Date(TODAY());
  for (let i = 6; i >= 0; i--) {
    const dd = new Date(d); dd.setDate(dd.getDate() - i);
    const ds = dd.toISOString().slice(0,10);
    r.push({ date: ds, status: getLog(ds, taskId) });
  }
  return r;
}

// ── Today stats ───────────────────────────────────────────────
function getTodayTasks()   { return tasks.filter(t => t.active !== false && isDueToday(t)); }
function getTodayStats() {
  const today = TODAY(), due = getTodayTasks();
  const done  = due.filter(t => getLog(today, t.id) === 'done').length;
  const skip  = due.filter(t => getLog(today, t.id) === 'skip').length;
  const fail  = due.filter(t => getLog(today, t.id) === 'fail').length;
  const pct   = due.length ? Math.round((done / due.length) * 100) : 0;
  return { total: due.length, done, skip, fail, pending: due.length - done - skip - fail, pct };
}

// ── Donut SVG ─────────────────────────────────────────────────
function buildDonut(pct, size=96, stroke=9) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="${stroke}"/>
    <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="white" stroke-width="${stroke}"
      stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
      stroke-linecap="round"/>
  </svg>`;
}

// ── Quotes ────────────────────────────────────────────────────
const QUOTES = [
  { text: "Small daily improvements are the key to staggering long-term results.", icon:"🚀" },
  { text: "You don't rise to your goals — you fall to your systems.", icon:"⚙️" },
  { text: "Motivation gets you started. Habit keeps you going.", icon:"🔥" },
  { text: "Every expert was once a beginner. Keep showing up.", icon:"💪" },
  { text: "Progress, not perfection.", icon:"🎯" },
  { text: "The secret of getting ahead is getting started.", icon:"⚡" },
];
function getQuote() { return QUOTES[new Date().getDate() % QUOTES.length]; }

// ── RENDER: HOME ──────────────────────────────────────────────
function renderHome() {
  const today = TODAY();
  const d     = new Date(today);
  const stats = getTodayStats();
  const due   = getTodayTasks();
  const q     = getQuote();
  const dateStr = `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;

  let html = `
  <div class="header">
    <div class="header-row">
      <h1>Today's <em>Flow</em></h1>
      <span class="date-chip">${dateStr}</span>
    </div>
  </div>
  <div class="scroll-area">

    <div class="summary-card">
      <div class="summary-grid">
        <div class="ring-wrap">
          ${buildDonut(stats.pct)}
          <div class="ring-center">
            <span class="ring-pct">${stats.pct}%</span>
            <span class="ring-lbl">DONE</span>
          </div>
        </div>
        <div class="summary-stats">
          <div class="stat-chip">
            <div class="stat-chip-val">${stats.done}</div>
            <div class="stat-chip-lbl">DONE</div>
          </div>
          <div class="stat-chip">
            <div class="stat-chip-val">${stats.pending}</div>
            <div class="stat-chip-lbl">PENDING</div>
          </div>
          <div class="stat-chip">
            <div class="stat-chip-val">${stats.skip}</div>
            <div class="stat-chip-lbl">SKIPPED</div>
          </div>
          <div class="stat-chip">
            <div class="stat-chip-val">${stats.fail}</div>
            <div class="stat-chip-lbl">MISSED</div>
          </div>
        </div>
      </div>
      <div class="summary-progress">
        <div class="summary-progress-fill" style="width:${stats.pct}%"></div>
      </div>
    </div>

    <div class="motivation-card">
      <div class="motivation-icon">${q.icon}</div>
      <div>
        <p>${q.text}</p>
        <small>Daily reminder</small>
      </div>
    </div>`;

  if (due.length === 0) {
    html += `<div class="empty-state">
      <div class="icon">🌟</div>
      <p>No tasks today.<br><strong>Add tasks in Admin</strong> to get started.</p>
    </div>`;
  } else {
    const pending  = due.filter(t => !getLog(today, t.id));
    const finished = due.filter(t =>  getLog(today, t.id));
    if (pending.length)  html += `<div class="section-label">Pending · ${pending.length}</div>` + pending.map(t => taskCardHTML(t, today)).join('');
    if (finished.length) html += `<div class="section-label" style="margin-top:18px">Logged · ${finished.length}</div>` + finished.map(t => taskCardHTML(t, today)).join('');
  }

  html += `
    <div class="section-label" style="margin-top:18px">Quick Note</div>
    <div class="card" style="padding:14px">
      <textarea class="note-input" id="note-input" placeholder="Jot something for today…" oninput="saveNote(this.value)">${note}</textarea>
    </div>
    <div class="spacer"></div>
  </div>`;

  document.getElementById('page-home').innerHTML = html;
}

function taskCardHTML(task, today) {
  const status = getLog(today, task.id);
  const isDone = status === 'done', isSkip = status === 'skip', isFail = status === 'fail';
  const streak = getStreak(task);
  const last7  = getLast7(task.id);

  const dotHTML = last7.map(({ date, status: s }) => {
    const isToday = date === today;
    let cls = 'streak-dot' + (isToday ? ' today' : s === 'done' ? ' done' : s === 'skip' ? ' skip' : s === 'fail' ? ' fail' : '');
    return `<div class="${cls}"></div>`;
  }).join('');

  const cardCls  = `card task-card ${isDone ? 'done' : isSkip ? 'skipped' : isFail ? 'failed' : ''}`;
  const checkCls = `task-check ${isDone ? 'checked' : isSkip ? 'skipped' : isFail ? 'failed' : ''}`;
  const checkIcon = isDone ? '✓' : isSkip ? '↗' : isFail ? '✕' : '';
  const accentStyle = task.color ? `border-left-color:${task.color}` : '';

  return `<div class="${cardCls}">
    <div class="task-card-inner" style="${accentStyle}">
      <div class="${checkCls}">${checkIcon}</div>
      <div class="task-info">
        <div class="task-name">${task.emoji || '⚡'} ${task.name}</div>
        <div class="task-meta">
          <span class="tag ${colorToTag(task.color || '#5B4CF5')}">${intervalLabel(task)}</span>
          ${streak > 0 ? `<span class="tag tag-amber">🔥 ${streak}-day streak</span>` : ''}
        </div>
        <div class="streak-dots">${dotHTML}</div>
        <div class="task-actions">
          <button class="btn-sm ${isDone ? 'active-done' : ''}" onclick="logTask('${task.id}','done')">✓ Done</button>
          <button class="btn-sm ${isSkip ? 'active-skip' : ''}" onclick="logTask('${task.id}','skip')">↗ Skip</button>
          <button class="btn-sm ${isFail ? 'active-fail' : ''}" onclick="logTask('${task.id}','fail')">✕ Miss</button>
        </div>
      </div>
    </div>
  </div>`;
}

function logTask(id, status) {
  const today = TODAY();
  if (getLog(today, id) === status) clearLog(today, id);
  else setLog(today, id, status);
  renderHome();
  const msgs = { done:'✅ Marked done!', skip:'↗ Skipped for today', fail:'✕ Logged as missed' };
  showToast(msgs[status]);
}

function saveNote(v) { note = v; S.set('tf_note', v); }

// ── RENDER: ADMIN ─────────────────────────────────────────────
let selectedColor    = '#5B4CF5';
let selectedEmoji    = '⚡';
let selectedInterval = 'daily';
let editingId        = null;

function renderAdmin() {
  const colorBtns = COLORS.map(c =>
    `<button class="color-btn ${c===selectedColor?'selected':''}" style="background:${c}" onclick="selectColor('${c}')"></button>`
  ).join('');

  const emojiBtns = EMOJIS.map(e =>
    `<button class="emoji-btn ${e===selectedEmoji?'selected':''}" onclick="selectEmoji('${e}')">${e}</button>`
  ).join('');

  const intervals = [
    {val:'daily',lbl:'Daily'},{val:'weekdays',lbl:'Mon–Fri'},
    {val:'weekends',lbl:'Weekends'},{val:'weekly',lbl:'Weekly'},{val:'custom',lbl:'Custom'},
  ];
  const intBtns = intervals.map(i =>
    `<button class="interval-btn ${i.val===selectedInterval?'selected':''}" onclick="selectInterval('${i.val}')">${i.lbl}</button>`
  ).join('');

  const taskList = tasks.length === 0
    ? `<div class="empty-state" style="padding:28px 0"><div class="icon">📋</div><p>No tasks yet — add one above!</p></div>`
    : tasks.map(t => `
      <div class="admin-task-item" id="ati-${t.id}">
        <div style="width:4px;height:40px;border-radius:4px;background:${t.color||'#5B4CF5'};flex-shrink:0"></div>
        <span class="admin-task-emoji">${t.emoji||'⚡'}</span>
        <div class="admin-task-info">
          <div class="admin-task-name">${t.name}</div>
          <div class="admin-task-sub">${intervalLabel(t)} · from ${t.startDate} ${t.active===false?'· <em style="color:#FFB020">Paused</em>':''}</div>
        </div>
        <button class="btn-del" onclick="toggleTaskActive('${t.id}')" title="${t.active!==false?'Pause':'Resume'}" style="font-size:16px;margin-right:2px">${t.active!==false?'⏸':'▶️'}</button>
        <button class="btn-del" onclick="deleteTask('${t.id}')" title="Delete">🗑</button>
      </div>`
    ).join('');

  document.getElementById('page-admin').innerHTML = `
  <div class="admin-header">
    <h1>Admin ⚙️</h1>
    <p>Add and manage recurring tasks</p>
  </div>
  <div class="scroll-area">
    <div class="card">
      <div class="form-group">
        <label class="form-label">Task Name</label>
        <input class="form-input" id="task-name" placeholder="e.g. Morning meditation" maxlength="50"/>
      </div>
      <div class="form-group">
        <label class="form-label">Icon</label>
        <div class="emoji-row">${emojiBtns}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Colour</label>
        <div class="color-row">${colorBtns}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Repeat</label>
        <div class="interval-row">${intBtns}</div>
        <div class="custom-interval ${selectedInterval==='custom'?'show':''}" id="custom-interval-wrap">
          <input class="form-input" id="custom-days" type="number" placeholder="Every N days (e.g. 3)" min="2" max="365" style="margin-top:10px"/>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Start Date</label>
        <input class="form-input" id="task-start" type="date" value="${TODAY()}"/>
      </div>
      <button class="btn-primary" onclick="saveTask()">+ Add Task</button>
    </div>

    <div class="section-label" style="margin-top:20px">Your Tasks (${tasks.length})</div>
    <div class="task-list-admin">${taskList}</div>
    <div class="spacer"></div>
  </div>`;
}

function selectColor(c)    { selectedColor    = c; renderAdmin(); }
function selectEmoji(e)    { selectedEmoji    = e; renderAdmin(); }
function selectInterval(v) { selectedInterval = v; renderAdmin(); }

function saveTask() {
  const name       = (document.getElementById('task-name').value || '').trim();
  const start      = document.getElementById('task-start').value;
  const customDays = selectedInterval === 'custom' ? parseInt(document.getElementById('custom-days')?.value) : null;
  if (!name)  { showToast('⚠️ Enter a task name'); return; }
  if (selectedInterval === 'custom' && (!customDays || customDays < 2)) { showToast('⚠️ Enter interval ≥ 2 days'); return; }

  tasks.push({
    id: Date.now().toString(),
    name, emoji: selectedEmoji, color: selectedColor,
    interval: selectedInterval, customDays,
    startDate: start, active: true, createdAt: TODAY(),
  });
  S.set('tf_tasks', tasks);
  showToast('🎉 Task added!');
  document.getElementById('task-name').value = '';
  renderAdmin();
}

function deleteTask(id) {
  if (!confirm('Delete this task and all its history?')) return;
  tasks = tasks.filter(t => t.id !== id);
  S.set('tf_tasks', tasks);
  renderAdmin();
  showToast('Deleted');
}

function toggleTaskActive(id) {
  tasks = tasks.map(t => t.id === id ? { ...t, active: t.active === false } : t);
  S.set('tf_tasks', tasks);
  renderAdmin();
  showToast('Updated');
}

// ── RENDER: STATS ─────────────────────────────────────────────
function renderStats() {
  const today    = TODAY();
  const allDates = Object.keys(logs).sort();

  // Last 7 days bar data
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds  = d.toISOString().slice(0,10);
    const dow = d.getDay();
    const due = tasks.filter(t => {
      if (t.interval === 'daily')    return true;
      if (t.interval === 'weekdays') return dow >= 1 && dow <= 5;
      if (t.interval === 'weekends') return dow === 0 || dow === 6;
      if (t.interval === 'weekly')   { const s = new Date(t.startDate); return Math.floor((d-s)/86400000) % 7 === 0; }
      if (t.interval === 'custom')   { const s = new Date(t.startDate); const diff = Math.floor((d-s)/86400000); return diff >= 0 && diff % t.customDays === 0; }
      return false;
    });
    const done = due.filter(t => getLog(ds, t.id) === 'done').length;
    const pct  = due.length ? Math.round((done / due.length) * 100) : 0;
    last7.push({ day: DAY_NAMES[dow].slice(0,1), pct, done, total: due.length });
  }

  // Bar chart
  const maxPct = Math.max(...last7.map(d => d.pct), 1);
  const barCols = last7.map(d => {
    const bg = d.pct > 79 ? '#00C896' : d.pct > 49 ? '#5B4CF5' : d.pct > 0 ? '#FFB020' : '#EEF0F8';
    return `<div class="bar-col">
      <div class="bar" style="height:${Math.max((d.pct/maxPct)*90,d.pct?4:0)}%;background:${bg}"></div>
      <div class="bar-day">${d.day}</div>
    </div>`;
  }).join('');

  // Overall
  let totalDone = 0, totalSkip = 0, totalFail = 0, totalSched = 0;
  allDates.forEach(ds => Object.values(logs[ds] || {}).forEach(s => {
    totalSched++;
    if (s === 'done') totalDone++;
    else if (s === 'skip') totalSkip++;
    else if (s === 'fail') totalFail++;
  }));
  const overallPct = totalSched ? Math.round((totalDone / totalSched) * 100) : 0;

  // Best streak
  const bestStreak = tasks.length ? Math.max(...tasks.map(t => getStreak(t)), 0) : 0;

  // Heatmap – 56 days
  const heatCells = [];
  for (let i = 55; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0,10);
    const done = Object.values(logs[ds] || {}).filter(v => v === 'done').length;
    const lv = done >= 4 ? 4 : done >= 3 ? 3 : done >= 2 ? 2 : done >= 1 ? 1 : 0;
    heatCells.push(`<div class="heat-cell" data-v="${lv}" title="${ds}: ${done} done"></div>`);
  }

  // Line chart – 14 days
  const lineData = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0,10);
    lineData.push(Object.values(logs[ds] || {}).filter(v => v === 'done').length);
  }
  const lineMax = Math.max(...lineData, 1);
  const W = 300, H = 80;
  const pts = lineData.map((v,i) => `${(i/(lineData.length-1))*W},${H-(v/lineMax)*(H-14)-7}`);
  const linePath  = `M ${pts.join(' L ')}`;
  const areaPath  = `M0,${H} L${pts.join(' L')} L${W},${H} Z`;

  // Pie data
  const donutTotal = totalDone + totalSkip + totalFail;
  const donutData  = [
    { label:'Done',    val: totalDone, color:'#00C896' },
    { label:'Skipped', val: totalSkip, color:'#FFB020' },
    { label:'Missed',  val: totalFail, color:'#FF5C72' },
  ];
  let cAng = 0;
  const pieSlices = donutTotal ? donutData.map(d => {
    if (!d.val) return '';
    const pct = d.val / donutTotal;
    const s = cAng; cAng += pct * 2 * Math.PI; const e = cAng;
    const x1 = 50 + 40 * Math.cos(s - Math.PI/2), y1 = 50 + 40 * Math.sin(s - Math.PI/2);
    const x2 = 50 + 40 * Math.cos(e - Math.PI/2), y2 = 50 + 40 * Math.sin(e - Math.PI/2);
    return `<path d="M50,50 L${x1.toFixed(1)},${y1.toFixed(1)} A40,40,0,${pct>.5?1:0},1,${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${d.color}"/>`;
  }).join('') : `<circle cx="50" cy="50" r="40" fill="#EEF0F8"/>`;

  const legendHTML = donutData.map(d =>
    `<div class="legend-item"><div class="legend-dot" style="background:${d.color}"></div>${d.label}: <strong style="margin-left:auto;font-family:var(--mono);color:var(--text)">${d.val}</strong></div>`
  ).join('');

  // Per-task rates
  const taskStats = tasks.map(t => {
    let done = 0, total = 0;
    allDates.forEach(ds => { const s = getLog(ds, t.id); if (s) { total++; if (s==='done') done++; } });
    return { ...t, done, total, rate: total ? Math.round((done/total)*100) : 0 };
  }).sort((a,b) => b.rate - a.rate);

  const taskStatsHTML = taskStats.length ? taskStats.map(t => {
    const barColor = t.rate > 79 ? '#00C896' : t.rate > 49 ? '#5B4CF5' : '#FF5C72';
    return `<div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:14px;font-weight:600">${t.emoji||'⚡'} ${t.name}</span>
        <span style="font-family:var(--mono);font-size:13px;font-weight:700;color:${barColor}">${t.rate}%</span>
      </div>
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width:${t.rate}%;background:${barColor}"></div>
      </div>
      <div style="font-size:11px;color:var(--text-3);margin-top:4px">${t.done} done · ${t.total} total logged</div>
    </div>`;
  }).join('') : `<div class="empty-state" style="padding:20px 0"><p>No data yet</p></div>`;

  document.getElementById('page-stats').innerHTML = `
  <div class="stats-header">
    <h1>Stats 📊</h1>
    <p>Your habit insights</p>
  </div>
  <div class="scroll-area">

    <div class="chart-card" style="text-align:center;background:linear-gradient(145deg,#FFF8EE,#FFF3DC);border-color:#FFE49A">
      <div class="streak-fire">🔥</div>
      <div class="streak-num">${bestStreak}</div>
      <div class="streak-sub">day streak · keep it going</div>
    </div>

    <div class="chart-card">
      <div class="chart-title">This Week <span>completion by day</span></div>
      <div class="bar-chart">${barCols}</div>
    </div>

    <div class="chart-card">
      <div class="chart-title">14-Day Trend <span>tasks completed per day</span></div>
      <div class="line-chart-wrap">
        <svg viewBox="0 0 300 90" width="100%" style="overflow:visible;display:block">
          <defs>
            <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#5B4CF5" stop-opacity="0.15"/>
              <stop offset="100%" stop-color="#5B4CF5" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <path d="${areaPath}" fill="url(#lg1)"/>
          <path d="${linePath}" fill="none" stroke="#5B4CF5" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${lineData.map((v,i)=>`<circle cx="${(i/(lineData.length-1))*W}" cy="${H-(v/lineMax)*(H-14)-7}" r="${v>0?3.5:2}" fill="${v>0?'#5B4CF5':'#EEF0F8'}" stroke="#5B4CF5" stroke-width="1.5"/>`).join('')}
        </svg>
      </div>
    </div>

    <div class="chart-card">
      <div class="chart-title">Activity Heatmap <span>last 8 weeks</span></div>
      <div class="heatmap-grid">${heatCells.join('')}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:12px;font-size:11px;color:var(--text-3)">
        Less
        <div style="width:10px;height:10px;border-radius:3px;background:#EEF0F8;border:1px solid #E3E6F0"></div>
        <div style="width:10px;height:10px;border-radius:3px;background:rgba(91,76,245,0.2)"></div>
        <div style="width:10px;height:10px;border-radius:3px;background:rgba(91,76,245,0.5)"></div>
        <div style="width:10px;height:10px;border-radius:3px;background:#5B4CF5"></div>
        More
      </div>
    </div>

    <div class="chart-card">
      <div class="chart-title">All-Time Split <span>${totalSched} entries logged</span></div>
      <div class="donut-wrap">
        <svg viewBox="0 0 100 100" width="110" height="110" style="flex-shrink:0">
          ${pieSlices}
          <circle cx="50" cy="50" r="24" fill="white"/>
          <text x="50" y="54" text-anchor="middle" font-size="13" font-weight="700" fill="#1A1D2E" font-family="JetBrains Mono,monospace">${overallPct}%</text>
        </svg>
        <div class="donut-legend">${legendHTML}</div>
      </div>
    </div>

    <div class="chart-card">
      <div class="chart-title">Numbers</div>
      <div class="stat-row"><span class="stat-row-label">Tasks created</span><span class="stat-row-val">${tasks.length}</span></div>
      <div class="stat-row"><span class="stat-row-label">Days tracked</span><span class="stat-row-val">${allDates.length}</span></div>
      <div class="stat-row"><span class="stat-row-label">Overall rate</span><span class="stat-row-val" style="color:#5B4CF5">${overallPct}%</span></div>
      <div class="stat-row"><span class="stat-row-label">Total done</span><span class="stat-row-val" style="color:#00C896">${totalDone}</span></div>
      <div class="stat-row"><span class="stat-row-label">Total skipped</span><span class="stat-row-val" style="color:#FFB020">${totalSkip}</span></div>
      <div class="stat-row"><span class="stat-row-label">Total missed</span><span class="stat-row-val" style="color:#FF5C72">${totalFail}</span></div>
    </div>

    <div class="chart-card">
      <div class="chart-title">Per-Task Performance</div>
      ${taskStatsHTML}
    </div>

    <div class="spacer"></div>
  </div>`;
}

// ── Navigation ────────────────────────────────────────────────
function goTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.getElementById('nav-'  + page).classList.add('active');
  currentPage = page;
  if (page === 'home')  renderHome();
  if (page === 'admin') renderAdmin();
  if (page === 'stats') renderStats();
}

// ── Toast ─────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ── Notifications ─────────────────────────────────────────────
function requestNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'default') return;
  Notification.requestPermission().then(p => { if (p === 'granted') showToast('🔔 Reminders enabled!'); });
}

function scheduleReminder() {
  if (Notification.permission !== 'granted') return;
  const now = new Date(), r = new Date();
  r.setHours(9, 0, 0, 0);
  if (r <= now) r.setDate(r.getDate() + 1);
  setTimeout(() => {
    const n = getTodayTasks().length;
    if (n) new Notification('TaskFlow ⚡', { body: `${n} task${n>1?'s':''} waiting today. Let's go!`, tag: 'tf-daily' });
    scheduleReminder();
  }, r - now);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  goTo('home');
  setTimeout(requestNotifications, 2000);
  scheduleReminder();
});
