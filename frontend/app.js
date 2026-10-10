/**
 * Crossword Client Application
 * Zero-Knowledge Frontend — The answer key is NEVER present in client code.
 * All answers are validated privately on the server.
 */

(function () {
  'use strict';

  if (typeof PUZZLE_CONFIG === 'undefined') {
    console.error('PUZZLE_CONFIG is missing.');
    return;
  }

  const { puzzleId, dimensions, words } = PUZZLE_CONFIG;
  const { rows: ROWS, cols: COLS } = dimensions;

  /* ---------- Mobile Bioluminescent Touch Pulse ---------- */
  function triggerBioTouchRipple(x, y) {
    if (!x || !y) return;
    const ripple = document.createElement('div');
    ripple.className = 'bio-touch-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);
    setTimeout(() => {
      if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
    }, 420);
  }

  /* ---------- Build Sparse Cell Map ---------- */
  const cells = {};
  words.forEach((w, wi) => {
    for (let i = 0; i < w.length; i++) {
      const r = w.dir === 'down' ? w.row + i : w.row;
      const c = w.dir === 'across' ? w.col + i : w.col;
      const key = `${r},${c}`;
      if (!cells[key]) {
        cells[key] = {
          row: r,
          col: c,
          numberLabel: null,
          acrossWordIdx: null,
          downWordIdx: null,
          userValue: ''
        };
      }
      if (w.dir === 'across') cells[key].acrossWordIdx = wi;
      if (w.dir === 'down') cells[key].downWordIdx = wi;
      if (i === 0) cells[key].numberLabel = w.num;
    }
  });

  const TOTAL_CELLS_COUNT = Object.keys(cells).length;

  /* ---------- Render Grid in DOM ---------- */
  const gridWrap = document.getElementById('gridWrap');
  gridWrap.style.gridTemplateColumns = `repeat(${COLS}, var(--cell-size))`;
  gridWrap.style.gridTemplateRows = `repeat(${ROWS}, var(--cell-size))`;

  const cellElements = {};

  Object.values(cells).forEach(cell => {
    const box = document.createElement('div');
    box.className = 'cell-box';
    box.style.gridRow = cell.row + 1;
    box.style.gridColumn = cell.col + 1;
    box.dataset.row = cell.row;
    box.dataset.col = cell.col;

    if (cell.numberLabel) {
      const numSpan = document.createElement('span');
      numSpan.className = 'cell-num-label';
      numSpan.textContent = cell.numberLabel;
      box.appendChild(numSpan);
    }

    const letterSpan = document.createElement('span');
    letterSpan.className = 'cell-letter-text';
    box.appendChild(letterSpan);

    box.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerBioTouchRipple(e.clientX, e.clientY);
      handleCellTap(cell.row, cell.col);
    });

    gridWrap.appendChild(box);
    cellElements[`${cell.row},${cell.col}`] = box;
  });

  /* ---------- Navigation & Selection State ---------- */
  let currentWordIdx = 0; // Default Word 1
  let currentDir = words[0].dir;
  let selectedCellKey = `${words[0].row},${words[0].col}`;
  let puzzleLocked = false;

  function wordCellsList(wIdx) {
    const w = words[wIdx];
    const list = [];
    for (let i = 0; i < w.length; i++) {
      const r = w.dir === 'down' ? w.row + i : w.row;
      const c = w.dir === 'across' ? w.col + i : w.col;
      list.push(`${r},${c}`);
    }
    return list;
  }

  function handleCellTap(row, col) {
    const key = `${row},${col}`;
    const c = cells[key];
    if (!c) return;

    vibrate(8);

    if (key === selectedCellKey) {
      // Tapping already selected cell: toggle direction if on intersection
      if (c.acrossWordIdx !== null && c.downWordIdx !== null) {
        currentDir = (currentDir === 'across') ? 'down' : 'across';
        currentWordIdx = (currentDir === 'across') ? c.acrossWordIdx : c.downWordIdx;
      }
    } else {
      // Tapping a different cell
      selectedCellKey = key;
      if (currentDir === 'across' && c.acrossWordIdx !== null) {
        currentWordIdx = c.acrossWordIdx;
      } else if (currentDir === 'down' && c.downWordIdx !== null) {
        currentWordIdx = c.downWordIdx;
      } else if (c.acrossWordIdx !== null) {
        currentDir = 'across';
        currentWordIdx = c.acrossWordIdx;
      } else {
        currentDir = 'down';
        currentWordIdx = c.downWordIdx;
      }
    }

    updateSelectionUI();
    scrollCellIntoView(key);
  }

  function updateSelectionUI() {
    Object.values(cellElements).forEach(el => {
      el.classList.remove('in-active-word', 'is-selected');
    });

    if (currentWordIdx === null) return;

    // Highlight current active word
    const keys = wordCellsList(currentWordIdx);
    keys.forEach(k => {
      if (cellElements[k]) cellElements[k].classList.add('in-active-word');
    });

    // Highlight current active cell
    if (selectedCellKey && cellElements[selectedCellKey]) {
      cellElements[selectedCellKey].classList.add('is-selected');
    }

    // Update Pinned Active Clue Banner
    const w = words[currentWordIdx];
    const badgeEl = document.getElementById('activeClueBadge');
    if (badgeEl) {
      badgeEl.textContent = `${w.num} ${w.dir.toUpperCase()}`;
    }
    const clueTextEl = document.getElementById('activeClueText');
    if (clueTextEl) {
      clueTextEl.textContent = w.clue.replace(/\n/g, ' ');
    }

    // Highlight active card in modal sheet
    document.querySelectorAll('.clue-item-card').forEach(card => card.classList.remove('is-active-card'));
    const activeCard = document.querySelector(`.clue-item-card[data-idx="${currentWordIdx}"]`);
    if (activeCard) activeCard.classList.add('is-active-card');
  }

  function scrollCellIntoView(key) {
    const el = cellElements[key];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  }

  /* ---------- Local Input & Typing Logic ---------- */
  function enterLetter(letter) {
    if (puzzleLocked || !selectedCellKey) return;
    const cell = cells[selectedCellKey];
    if (!cell) return;

    cell.userValue = letter.toUpperCase();
    const el = cellElements[selectedCellKey];
    const span = el.querySelector('.cell-letter-text');
    if (span) {
      span.textContent = cell.userValue;
      // Retrigger letterPop micro-animation on each keystroke
      span.classList.remove('entered');
      void span.offsetWidth; // force reflow
      span.classList.add('entered');
    }

    vibrate(10);
    updateProgressCounter();
    advanceCursor(1);
    maybeAutoSubmit();
  }

  function backspaceLetter() {
    if (puzzleLocked || !selectedCellKey) return;
    const cell = cells[selectedCellKey];
    if (!cell) return;

    vibrate(12);

    if (cell.userValue) {
      cell.userValue = '';
      const span = cellElements[selectedCellKey].querySelector('.cell-letter-text');
      if (span) span.textContent = '';
      updateProgressCounter();
    } else {
      // Step back and delete previous cell
      advanceCursor(-1);
      const prevCell = cells[selectedCellKey];
      if (prevCell) {
        prevCell.userValue = '';
        const span = cellElements[selectedCellKey].querySelector('.cell-letter-text');
        if (span) span.textContent = '';
          updateProgressCounter();
      }
    }
  }

  function advanceCursor(step) {
    if (currentWordIdx === null || !selectedCellKey) return;
    const w = words[currentWordIdx];
    const [r, c] = selectedCellKey.split(',').map(Number);
    const idx = (currentDir === 'down') ? (r - w.row) : (c - w.col);
    const nextIdx = idx + step;

    if (nextIdx >= 0 && nextIdx < w.length) {
      const nr = (currentDir === 'down') ? w.row + nextIdx : w.row;
      const nc = (currentDir === 'across') ? w.col + nextIdx : w.col;
      selectedCellKey = `${nr},${nc}`;
      updateSelectionUI();
      scrollCellIntoView(selectedCellKey);
    }
  }

  function stepWord(dirStep) {
    vibrate(12);
    const nextIdx = (currentWordIdx + dirStep + words.length) % words.length;
    currentWordIdx = nextIdx;
    currentDir = words[nextIdx].dir;
    const startKey = `${words[nextIdx].row},${words[nextIdx].col}`;
    selectedCellKey = startKey;
    updateSelectionUI();
    scrollCellIntoView(startKey);
  }

  function toggleDirection() {
    vibrate(10);
    if (!selectedCellKey) return;
    const c = cells[selectedCellKey];
    if (c && c.acrossWordIdx !== null && c.downWordIdx !== null) {
      currentDir = (currentDir === 'across') ? 'down' : 'across';
      currentWordIdx = (currentDir === 'across') ? c.acrossWordIdx : c.downWordIdx;
    } else {
      stepWord(1);
    }
    updateSelectionUI();
  }

  /* ---------- Keyboard & Touch Listeners ---------- */
  document.querySelectorAll('.kb-key[data-char]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerBioTouchRipple(e.clientX, e.clientY);
      enterLetter(btn.dataset.char);
    });
  });

  document.getElementById('kbBackspace').addEventListener('click', (e) => {
    e.stopPropagation();
    triggerBioTouchRipple(e.clientX, e.clientY);
    backspaceLetter();
  });

  document.getElementById('kbToggleDir').addEventListener('click', (e) => {
    e.stopPropagation();
    triggerBioTouchRipple(e.clientX, e.clientY);
    toggleDirection();
  });

  document.getElementById('prevWordBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    triggerBioTouchRipple(e.clientX, e.clientY);
    stepWord(-1);
  });

  document.getElementById('nextWordBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    triggerBioTouchRipple(e.clientX, e.clientY);
    stepWord(1);
  });

  document.getElementById('clueBannerContent').addEventListener('click', () => {
    // Open full riddles sheet on tap
    document.getElementById('cluesSheetBackdrop').classList.add('open');
  });

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target;
    if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;

    if (e.key === 'Backspace') {
      backspaceLetter();
      e.preventDefault();
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      stepWord(e.shiftKey ? -1 : 1);
      e.preventDefault();
    } else if (e.key === ' ') {
      toggleDirection();
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      moveArrow(0, 1); e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      moveArrow(0, -1); e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      moveArrow(1, 0); e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      moveArrow(-1, 0); e.preventDefault();
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      enterLetter(e.key);
      e.preventDefault();
    }
  });

  function moveArrow(dr, dc) {
    if (!selectedCellKey) return;
    const [r, c] = selectedCellKey.split(',').map(Number);
    const nextKey = `${r + dr},${c + dc}`;
    if (cells[nextKey]) {
      handleCellTap(r + dr, c + dc);
    }
  }

  // Each official attempt starts with an empty grid. We intentionally do not
  // restore localStorage progress across separate team sessions.
  const LEGACY_STORAGE_KEY = `crossword_progress_${puzzleId}`;
  try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch (_) {}

  function updateProgressCounter() {
    const filled = Object.values(cells).filter(c => c.userValue).length;
    document.getElementById('miniProgressText').textContent = `${filled}/${TOTAL_CELLS_COUNT} cells assembled`;
    document.getElementById('miniProgressFill').style.width = `${(filled / TOTAL_CELLS_COUNT) * 100}%`;
  }

  /* ---------- Automatically fit the crossword to the available screen ---------- */
  const rootElement = document.documentElement;
  const gridViewport = document.getElementById('gridViewport');
  const COMPLETED_STORAGE_KEY = `moleclues_completed_${puzzleId}`;

  function fitGridToScreen() {
    if (!gridViewport || !gridWrap) return;
    const viewportStyle = getComputedStyle(gridViewport);
    const wrapStyle = getComputedStyle(gridWrap);
    const num = (value) => Number.parseFloat(value) || 0;

    // clientWidth/clientHeight include padding, so subtract it once to get the
    // available content area. The specimen labels are absolutely positioned;
    // they do not consume layout height and must not be subtracted here.
    const viewportPadX = num(viewportStyle.paddingLeft) + num(viewportStyle.paddingRight);
    const viewportPadY = num(viewportStyle.paddingTop) + num(viewportStyle.paddingBottom);
    const colGap = num(wrapStyle.columnGap || wrapStyle.gap);
    const rowGap = num(wrapStyle.rowGap || wrapStyle.gap);
    const frameX = num(wrapStyle.paddingLeft) + num(wrapStyle.paddingRight) + num(wrapStyle.borderLeftWidth) + num(wrapStyle.borderRightWidth) + Math.max(0, COLS - 1) * colGap;
    const frameY = num(wrapStyle.paddingTop) + num(wrapStyle.paddingBottom) + num(wrapStyle.borderTopWidth) + num(wrapStyle.borderBottomWidth) + Math.max(0, ROWS - 1) * rowGap;
    const widthForCells = Math.max(0, gridViewport.clientWidth - viewportPadX - frameX);
    const heightForCells = Math.max(0, gridViewport.clientHeight - viewportPadY - frameY);
    const widthFit = widthForCells / COLS;
    const heightFit = heightForCells / ROWS;
    const shortLandscape = window.matchMedia('(max-height: 520px) and (orientation: landscape)').matches;

    // On ordinary screens fit both dimensions, with a larger ceiling than the
    // previous 30px limit. In a very short landscape viewport, prioritize
    // readable cell width and let the grid viewport scroll vertically.
    const fittedSize = shortLandscape
      ? Math.min(48, widthFit)
      : Math.min(48, widthFit, heightFit);
    rootElement.style.setProperty('--cell-size', `${Math.max(8, fittedSize).toFixed(2)}px`);
  }

  window.addEventListener('resize', fitGridToScreen, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(fitGridToScreen, 100), { passive: true });
  if ('ResizeObserver' in window && gridViewport) {
    const viewportObserver = new ResizeObserver(fitGridToScreen);
    viewportObserver.observe(gridViewport);
  }
  requestAnimationFrame(fitGridToScreen);
  setTimeout(fitGridToScreen, 0);

  /* ---------- Reset / Clear Button ---------- */
  document.getElementById('clearBtn').addEventListener('click', () => {
    if (puzzleLocked) return;
    lastCheckedSignature = null;
    vibrate(20);
    if (!confirm('Clear all your entered letters? This will reset your progress.')) return;
    Object.values(cells).forEach(c => {
      c.userValue = '';
      const el = cellElements[`${c.row},${c.col}`];
      if (el) {
        const span = el.querySelector('.cell-letter-text');
        if (span) span.textContent = '';
        el.classList.remove('is-correct', 'is-incorrect');
      }
    });
    updateProgressCounter();
    showToast('Grid cleared.');
  });

  /* ---------- Clues Bottom Sheet ---------- */
  const cluesSheetBackdrop = document.getElementById('cluesSheetBackdrop');
  const modalAcrossList = document.getElementById('modalAcrossList');
  const modalDownList = document.getElementById('modalDownList');

  words.forEach((w, wi) => {
    const card = document.createElement('div');
    card.className = 'clue-item-card';
    card.dataset.idx = wi;

    const chip = document.createElement('div');
    chip.className = 'clue-chip';
    chip.textContent = `${w.num} ${w.dir.toUpperCase()}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'clue-item-content';

    const text = document.createElement('div');
    text.className = 'clue-item-text';
    text.textContent = w.clue;

    contentDiv.appendChild(text);

    card.appendChild(chip);
    card.appendChild(contentDiv);

    card.addEventListener('click', (e) => {
      triggerBioTouchRipple(e.clientX, e.clientY);
      cluesSheetBackdrop.classList.remove('open');
      currentDir = w.dir;
      currentWordIdx = wi;
      const startKey = `${w.row},${w.col}`;
      selectedCellKey = startKey;
      updateSelectionUI();
      scrollCellIntoView(startKey);
    });

    (w.dir === 'across' ? modalAcrossList : modalDownList).appendChild(card);
  });

  document.getElementById('cluesListBtn').addEventListener('click', () => {
    cluesSheetBackdrop.classList.add('open');
  });
  document.getElementById('closeCluesSheetBtn').addEventListener('click', () => {
    cluesSheetBackdrop.classList.remove('open');
  });
  cluesSheetBackdrop.addEventListener('click', (e) => {
    if (e.target === cluesSheetBackdrop) cluesSheetBackdrop.classList.remove('open');
  });

  /* ---------- Server Session & Stopwatch Timer ---------- */
  let sessionToken = null;
  let serverStartTime = null;
  let timerInterval = null;
  let clientElapsedSeconds = 0;
  let isSubmitting = false;
  let lastCheckedSignature = null;

  const participantGate = document.getElementById('participantGateBackdrop');
  const participantForm = document.getElementById('participantForm');
  const participantGateError = document.getElementById('participantGateError');
  const startPuzzleBtn = document.getElementById('startPuzzleBtn');
  let teamName = '';

  function showCompletionRiddle(persist = true) {
    puzzleLocked = true;
    if (timerInterval) clearInterval(timerInterval);
    isSubmitting = false;
    if (persist) {
      try {
        localStorage.setItem(COMPLETED_STORAGE_KEY, JSON.stringify({
          completed: true,
          teamName,
          completedAt: new Date().toISOString()
        }));
      } catch (_) {}
    }
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.hidden = true;
    participantGate.classList.remove('open');
    submissionBackdrop.classList.remove('open');
    cluesSheetBackdrop.classList.remove('open');
    const canvas = document.getElementById('bio-canvas');
    if (canvas) canvas.hidden = true;
    const finalClue = document.getElementById('completionRiddleScreen');
    if (finalClue) finalClue.hidden = false;
    document.body.classList.add('completion-view');
    document.title = 'MoleClues · Final Clue';
  }

  participantForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    teamName = document.getElementById('teamNameInput').value.trim();
    participantGateError.textContent = '';

    if (teamName.length < 2 || teamName.length > 80) {
      participantGateError.textContent = 'Enter a team name between 2 and 80 characters.';
      return;
    }

    startPuzzleBtn.disabled = true;
    startPuzzleBtn.textContent = 'Starting…';
    try {
      clearPuzzleGrid();
      lastCheckedSignature = null;
      await initSession(teamName);
      participantGate.classList.remove('open');
    } catch (err) {
      if (/already completed MoleClues/i.test(err.message || '')) {
        showCompletionRiddle(true);
      } else {
        participantGateError.textContent = err.message || 'Could not start the official session. Check your connection and try again.';
      }
    } finally {
      startPuzzleBtn.disabled = false;
      startPuzzleBtn.textContent = 'Start Crossword';
    }
  });

  async function initSession(name) {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ puzzleId, teamName: name })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.sessionToken || !Number.isFinite(Number(data.startTime))) {
      throw new Error(data.error || 'The server could not start your session. Please try again.');
    }
    sessionToken = data.sessionToken;
    serverStartTime = Number(data.startTime);
    startClientTimer();
  }

  function clearPuzzleGrid() {
    Object.values(cells).forEach(cell => {
      cell.userValue = '';
      const el = cellElements[`${cell.row},${cell.col}`];
      if (!el) return;
      const span = el.querySelector('.cell-letter-text');
      if (span) span.textContent = '';
      el.classList.remove('is-correct', 'is-incorrect');
    });
    try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch (_) {}
    updateProgressCounter();
  }

  function startClientTimer() {
    clearInterval(timerInterval);
    const timerEl = document.getElementById('sessionTimerText');
    const tick = () => {
      clientElapsedSeconds = Math.max(0, Math.floor((Date.now() - serverStartTime) / 1000));
      const mins = String(Math.floor(clientElapsedSeconds / 60)).padStart(2, '0');
      const secs = String(clientElapsedSeconds % 60).padStart(2, '0');
      timerEl.textContent = `⏱️ ${mins}:${secs}`;
    };
    tick();
    timerInterval = setInterval(tick, 1000);
  }

  /* ---------- Official Submission Workflow ---------- */
  const submissionBackdrop = document.getElementById('submissionModalBackdrop');
  const promptView = document.getElementById('submissionPromptView');
  const loadingView = document.getElementById('submissionLoadingView');
  const resultView = document.getElementById('submissionResultView');
  const submitButton = document.getElementById('submitBtn');
  const clearButton = document.getElementById('clearBtn');

  submitButton.addEventListener('click', openSubmissionPrompt);
  document.getElementById('closeSubmissionModalBtn').addEventListener('click', closeSubmissionModal);
  document.getElementById('cancelSubmitBtn').addEventListener('click', closeSubmissionModal);
  document.getElementById('dismissResultBtn').addEventListener('click', closeSubmissionModal);

  function openSubmissionPrompt() {
    if (puzzleLocked || isSubmitting) return;
    vibrate(15);
    const filledCells = Object.values(cells).filter(c => c.userValue).length;
    let filledWords = 0;
    words.forEach((w, wi) => {
      const list = wordCellsList(wi);
      if (list.every(k => cells[k].userValue)) filledWords++;
    });

    const summaryEl = document.getElementById('submissionStatsSummary');
    summaryEl.innerHTML = `
      <div class="stats-row"><span>Cells Filled:</span><span>${filledCells} / ${TOTAL_CELLS_COUNT}</span></div>
      <div class="stats-row"><span>Complete Words:</span><span>${filledWords} / ${words.length}</span></div>
      <div class="stats-row"><span>Timer:</span><span>${document.getElementById('sessionTimerText').textContent}</span></div>
    `;

    if (filledCells < TOTAL_CELLS_COUNT) {
      summaryEl.innerHTML += `
        <div style="color:var(--bad); font-size:0.78rem; margin-top:8px;">
          ⚠️ ${TOTAL_CELLS_COUNT - filledCells} cells are still empty. The answers can be checked after you fill the grid.
        </div>
      `;
    }

    promptView.style.display = 'block';
    loadingView.style.display = 'none';
    resultView.style.display = 'none';
    submissionBackdrop.classList.add('open');
  }

  function closeSubmissionModal() {
    submissionBackdrop.classList.remove('open');
  }

  document.getElementById('confirmSubmitBtn').addEventListener('click', () => submitAnswersToServer({ automatic: false }));

  function currentGridSignature() {
    return Object.keys(cells).sort((a, b) => {
      const [ar, ac] = a.split(',').map(Number);
      const [br, bc] = b.split(',').map(Number);
      return ar - br || ac - bc;
    }).map(key => cells[key].userValue || ' ').join('');
  }

  function maybeAutoSubmit() {
    if (!sessionToken || puzzleLocked || isSubmitting) return;
    const filledCells = Object.values(cells).filter(cell => cell.userValue).length;
    if (filledCells !== TOTAL_CELLS_COUNT) return;
    const signature = currentGridSignature();
    if (signature === lastCheckedSignature) return;
    submitAnswersToServer({ automatic: true, signature });
  }

  async function submitAnswersToServer({ automatic = false, signature = null } = {}) {
    vibrate(20);
    if (!sessionToken) {
      showToast('Start the crossword first to create an official timed session.');
      return;
    }
    if (isSubmitting || puzzleLocked) return;

    isSubmitting = true;
    if (signature) lastCheckedSignature = signature;
    promptView.style.display = 'none';
    loadingView.style.display = 'block';
    resultView.style.display = 'none';
    submissionBackdrop.classList.add('open');

    const answersPayload = {};
    words.forEach(w => {
      let wordString = '';
      for (let i = 0; i < w.length; i++) {
        const r = w.dir === 'down' ? w.row + i : w.row;
        const c = w.dir === 'across' ? w.col + i : w.col;
        wordString += cells[`${r},${c}`].userValue || ' ';
      }
      answersPayload[w.id] = wordString;
    });

    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ puzzleId, sessionToken, answers: answersPayload })
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || result.message || `Server responded with status ${res.status}`);
      lastCheckedSignature = currentGridSignature();
      renderSubmissionResult(result);
    } catch (err) {
      console.error('Submission error:', err);
      if (/already completed MoleClues/i.test(err.message || '')) {
        showCompletionRiddle(true);
        return;
      }
      lastCheckedSignature = null;
      loadingView.style.display = 'none';
      resultView.style.display = 'block';
      document.getElementById('resultBadgeIcon').textContent = '⚠️';
      const heading = document.getElementById('resultHeading');
      heading.textContent = 'Could not check answers';
      heading.style.color = 'var(--bad)';
      document.getElementById('resultSubtext').textContent = 'A network or server error occurred. Your letters are still here and your timer continues. Close this message and try again.';
      document.getElementById('resultScoreBreakdown').replaceChildren();
      document.getElementById('dismissResultBtn').textContent = 'Back to crossword';
      submissionBackdrop.classList.add('open');
      if (!automatic) showToast('Submission failed. Your answers have not been erased.');
    } finally {
      isSubmitting = false;
    }
  }

  function renderSubmissionResult(result) {
    loadingView.style.display = 'none';

    if (result.allCorrect) {
      lastCheckedSignature = currentGridSignature();
      puzzleLocked = true;
      clearInterval(timerInterval);
      submitButton.disabled = true;
      clearButton.disabled = true;
      showCompletionRiddle(true);
      return;
    }

    resultView.style.display = 'block';
    const heading = document.getElementById('resultHeading');
    const subtext = document.getElementById('resultSubtext');
    const badge = document.getElementById('resultBadgeIcon');
    const breakdown = document.getElementById('resultScoreBreakdown');
    const dismissButton = document.getElementById('dismissResultBtn');
    const timeFormatted = Number.isFinite(Number(result.timeSeconds))
      ? `${Math.floor(Number(result.timeSeconds) / 60)}m ${Number(result.timeSeconds) % 60}s`
      : document.getElementById('sessionTimerText').textContent;

    // Incorrect checks remain in progress so the team can correct entries.
    // The official timer continues and a changed full-grid signature is checked again.
    badge.textContent = '❌';
    heading.textContent = 'Not quite — check your answers';
    heading.style.color = 'var(--bad)';
    subtext.textContent = 'Some entries are incorrect. Your timer is still running. Close this message, correct your letters, and the crossword will check again automatically when the grid is full.';
    breakdown.innerHTML = `
      <div class="stats-row"><span>Words Correct:</span><span>${result.score} / ${result.total}</span></div>
      <div class="stats-row"><span>Elapsed Time:</span><span>${timeFormatted}</span></div>
      <div class="stats-row"><span>Status:</span><span style="color:var(--bad);">NEEDS CORRECTION</span></div>
    `;
    dismissButton.textContent = 'Back to crossword';
  }

  /* ---------- Toast Notification Utility ---------- */
  let toastTimer = null;
  function showToast(msg) {
    const toast = document.getElementById('toastBanner');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  function vibrate(ms) {
    if (navigator.vibrate) {
      try { navigator.vibrate(ms); } catch (e) {}
    }
  }

  /* ---------- Initialize Game ---------- */
  clearPuzzleGrid();
  updateSelectionUI();
  scrollCellIntoView(selectedCellKey);
  fitGridToScreen();

  // After a successful completion, refresh/reopening this browser stays on the
  // final riddle screen rather than returning to the crossword or team-entry form.
  try {
    const completedState = JSON.parse(localStorage.getItem(COMPLETED_STORAGE_KEY) || 'null');
    if (completedState && completedState.completed === true) {
      teamName = typeof completedState.teamName === 'string' ? completedState.teamName : '';
      showCompletionRiddle(false);
    }
  } catch (_) {}

})();
