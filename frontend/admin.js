(function () {
  'use strict';
  const loginForm = document.getElementById('adminLoginForm');
  const passwordInput = document.getElementById('adminPasswordInput');
  const loginButton = document.getElementById('loginButton');
  const loginError = document.getElementById('loginError');
  const loginPanel = document.getElementById('loginPanel');
  const dashboard = document.getElementById('dashboard');
  const refreshButton = document.getElementById('refreshButton');
  const logoutButton = document.getElementById('logoutButton');
  const summaryGrid = document.getElementById('summaryGrid');
  const rankedBody = document.getElementById('rankedBody');
  const attemptsBody = document.getElementById('attemptsBody');
  const rankedEmpty = document.getElementById('rankedEmpty');
  const attemptsEmpty = document.getElementById('attemptsEmpty');
  const attemptCount = document.getElementById('attemptCount');
  const lastUpdated = document.getElementById('lastUpdated');
  let adminPassword = '';

  function escapeText(value) {
    return String(value == null ? '' : value);
  }
  function formatDuration(value) {
    if (!Number.isFinite(Number(value)) || value === null || value === '') return '—';
    let seconds = Math.max(0, Math.floor(Number(value)));
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return hours > 0
      ? `${hours}h ${String(minutes).padStart(2, '0')}m ${String(remaining).padStart(2, '0')}s`
      : `${minutes}m ${String(remaining).padStart(2, '0')}s`;
  }
  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString();
  }
  function elapsedNow(startedAt) {
    const started = new Date(startedAt).getTime();
    return Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 1000)) : null;
  }
  function makeCell(text, className) {
    const cell = document.createElement('td');
    cell.textContent = text;
    if (className) cell.className = className;
    return cell;
  }
  function statusLabel(item) {
    if (item.status === 'in_progress' && item.score !== null && item.score !== undefined && !item.all_correct) return { label: 'Needs correction', className: 'partial' };
    if (item.status === 'in_progress') return { label: 'In progress', className: 'progress' };
    if (item.status === 'submitted' && item.all_correct) return { label: 'All correct', className: 'correct' };
    if (item.status === 'submitted') return { label: 'Submitted', className: 'partial' };
    return { label: 'Unknown', className: 'error' };
  }

  async function fetchAttempts() {
    const response = await fetch('/api/leaderboard', {
      method: 'GET',
      headers: { 'X-Admin-Password': adminPassword, 'Accept': 'application/json' },
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error('Incorrect administrator password.');
    if (!response.ok) throw new Error(data.error || `Could not load data (${response.status}).`);
    return Array.isArray(data.attempts) ? data.attempts : [];
  }

  async function loadDashboard() {
    refreshButton.disabled = true;
    try {
      const attempts = await fetchAttempts();
      renderDashboard(attempts);
      loginPanel.hidden = true;
      dashboard.hidden = false;
      lastUpdated.textContent = `Last refreshed: ${new Date().toLocaleTimeString()}`;
      loginError.textContent = '';
    } catch (error) {
      if (dashboard.hidden) {
        loginError.textContent = error.message;
      } else {
        alert(error.message);
        if (/password/i.test(error.message)) {
          logout();
          loginError.textContent = error.message;
        }
      }
    } finally {
      refreshButton.disabled = false;
      loginButton.disabled = false;
      loginButton.textContent = 'View leaderboard';
    }
  }

  function renderDashboard(attempts) {
    const all = attempts.slice().sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
    const submitted = all.filter(item => item.status === 'submitted');
    const solved = submitted.filter(item => item.all_correct && Number.isFinite(Number(item.time_seconds)))
      .sort((a, b) => Number(a.time_seconds) - Number(b.time_seconds));
    const bestByTeam = new Map();
    for (const item of solved) {
      const key = String(item.team_name || '').trim().toLowerCase();
      if (!bestByTeam.has(key)) bestByTeam.set(key, item);
    }
    const ranked = Array.from(bestByTeam.values()).sort((a, b) => Number(a.time_seconds) - Number(b.time_seconds));
    const uniqueTeams = new Set(all.map(item => String(item.team_name || '').trim().toLowerCase()).filter(Boolean));
    const fastest = ranked[0];
    const summary = [
      ['Teams', String(uniqueTeams.size), ''],
      ['Total attempts', String(all.length), ''],
      ['Submissions', String(submitted.length), ''],
      ['Fastest correct time', fastest ? formatDuration(fastest.time_seconds) : '—', 'highlight']
    ];
    summaryGrid.replaceChildren();
    for (const [label, value, extra] of summary) {
      const card = document.createElement('div');
      card.className = 'summary-card';
      const labelEl = document.createElement('div'); labelEl.className = 'label'; labelEl.textContent = label;
      const valueEl = document.createElement('div'); valueEl.className = `value ${extra}`.trim(); valueEl.textContent = value;
      card.append(labelEl, valueEl);
      summaryGrid.appendChild(card);
    }

    rankedBody.replaceChildren();
    rankedEmpty.hidden = ranked.length > 0;
    ranked.forEach((item, index) => {
      const row = document.createElement('tr');
      row.appendChild(makeCell(`#${index + 1}`, 'rank'));
      row.appendChild(makeCell(item.team_name || 'Unnamed team'));
      row.appendChild(makeCell(formatDuration(item.time_seconds)));
      row.appendChild(makeCell(formatDate(item.submitted_at)));
      rankedBody.appendChild(row);
    });

    attemptsBody.replaceChildren();
    attemptsEmpty.hidden = all.length > 0;
    attemptCount.textContent = `${all.length} attempt${all.length === 1 ? '' : 's'}`;
    all.forEach(item => {
      const row = document.createElement('tr');
      row.appendChild(makeCell(item.team_name || 'Unnamed team'));
      const status = statusLabel(item);
      const statusCell = document.createElement('td');
      const statusBadge = document.createElement('span');
      statusBadge.className = `status ${status.className}`;
      statusBadge.textContent = status.label;
      statusCell.appendChild(statusBadge);
      row.appendChild(statusCell);
      row.appendChild(makeCell(item.score !== null && item.score !== undefined ? `${item.score} / ${item.total}` : '—'));
      const duration = item.status === 'submitted' ? formatDuration(item.time_seconds) : `${formatDuration(elapsedNow(item.started_at))} (live)`;
      row.appendChild(makeCell(duration));
      row.appendChild(makeCell(formatDate(item.started_at)));
      row.appendChild(makeCell(formatDate(item.submitted_at)));
      attemptsBody.appendChild(row);
    });
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    adminPassword = passwordInput.value;
    if (!adminPassword) return;
    loginButton.disabled = true;
    loginButton.textContent = 'Checking…';
    loginError.textContent = '';
    await loadDashboard();
  });
  refreshButton.addEventListener('click', loadDashboard);
  logoutButton.addEventListener('click', logout);
  function logout() {
    adminPassword = '';
    passwordInput.value = '';
    dashboard.hidden = true;
    loginPanel.hidden = false;
    loginError.textContent = '';
  }
}());
