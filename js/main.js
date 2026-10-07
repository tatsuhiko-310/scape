(() => {
  const N = CONFIG.squareCount;
  const COLS = 9;
  const ROWS = 8; // 外周 = 9*2 + (8-2)*2 = 30
  const STORAGE_KEY = 'scape.squares.v1';

  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const boardEl = $('board');
  const piecesEl = $('pieces');

  const state = {
    squares: [],
    players: [],
    current: 0,
    dice: [],
    busy: false,
  };

  // ---------- マス ----------

  // マス番号 → グリッド座標（左上がスタート、時計回り）
  function gridPos(i) {
    if (i < COLS) return { col: i + 1, row: 1 };                       // 上辺 →
    i -= COLS;
    if (i < ROWS - 1) return { col: COLS, row: i + 2 };                // 右辺 ↓
    i -= ROWS - 1;
    if (i < COLS - 1) return { col: COLS - 1 - i, row: ROWS };         // 下辺 ←
    i -= COLS - 1;
    return { col: 1, row: ROWS - 1 - i };                              // 左辺 ↑
  }

  // 進行方向（矢印表示用）
  function direction(i) {
    const a = gridPos(i), b = gridPos((i + 1) % N);
    if (b.col > a.col) return '→';
    if (b.col < a.col) return '←';
    if (b.row > a.row) return '↓';
    return '↑';
  }

  function defaultSquares() {
    return Array.from({ length: N }, (_, i) => ({
      name: '', icon: '', color: 'none', type: 'normal',
      ...(CONFIG.defaultSquares[i] || {}),
    }));
  }

  function loadSquares() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(saved) && saved.length === N) return saved;
    } catch (_) { /* 保存なし or 読めない */ }
    return defaultSquares();
  }

  function saveSquares() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.squares)); } catch (_) {}
  }

  function renderBoard() {
    boardEl.querySelectorAll('.cell').forEach((c) => c.remove());
    state.squares.forEach((sq, i) => {
      const { col, row } = gridPos(i);
      const cell = document.createElement('button');
      cell.className = `cell type-${sq.type || 'normal'}`;
      cell.dataset.index = i;
      cell.style.gridColumn = col;
      cell.style.gridRow = row;
      cell.style.setProperty('--sq', (CONFIG.palette[sq.color] || CONFIG.palette.none).color);
      cell.innerHTML = `
        <span class="no">${i}</span>
        <span class="dir">${direction(i)}</span>
        <span class="icon">${escapeHtml(sq.icon || '')}</span>
        <span class="name">${escapeHtml(sq.name || '')}</span>`;
      cell.addEventListener('click', () => openSquareEditor(i));
      boardEl.insertBefore(cell, piecesEl);
    });
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- マス編集 ----------

  const dialog = $('squareDialog');
  let editing = -1;
  let editingColor = 'none';

  function openSquareEditor(i) {
    if (dragJustEnded) return;
    editing = i;
    const sq = state.squares[i];
    $('sqTitle').textContent = `マス ${i}`;
    $('sqName').value = sq.name;
    $('sqIcon').value = sq.icon;
    editingColor = sq.color;
    renderSwatches();
    dialog.showModal();
  }

  function renderSwatches() {
    const wrap = $('sqSwatches');
    wrap.innerHTML = '';
    for (const [key, p] of Object.entries(CONFIG.palette)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (key === editingColor ? ' on' : '');
      b.style.background = p.color;
      b.title = p.label;
      b.addEventListener('click', () => { editingColor = key; renderSwatches(); });
      wrap.appendChild(b);
    }
  }

  dialog.addEventListener('close', () => {
    if (dialog.returnValue !== 'ok' || editing < 0) return;
    Object.assign(state.squares[editing], {
      name: $('sqName').value.trim(),
      icon: $('sqIcon').value.trim(),
      color: editingColor,
    });
    saveSquares();
    renderBoard();
    placePieces();
  });

  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.squares, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'scape-squares.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('clearSquaresBtn').addEventListener('click', () => {
    if (!confirm('マスの編集内容を初期状態に戻しますか？')) return;
    state.squares = defaultSquares();
    saveSquares();
    renderBoard();
    placePieces();
  });

  // ---------- プレイヤー / コマ ----------

  function setupPlayers(count) {
    piecesEl.innerHTML = '';
    state.players = CONFIG.players.slice(0, count).map((p, id) => {
      const el = document.createElement('div');
      el.className = 'piece';
      el.style.setProperty('--pc', p.color);
      el.title = p.name;
      el.innerHTML = `<span>${id + 1}</span>`;
      piecesEl.appendChild(el);
      const player = { id, ...p, pos: 0, laps: 0, el };
      enableDrag(player);
      return player;
    });
    state.current = 0;
    placePieces();
    renderPlayers();
  }

  // 同じマスにいるコマは少しずらして並べる
  const OFFSETS = [[-0.2, -0.16], [0.2, -0.16], [-0.2, 0.2], [0.2, 0.2]];

  function placePieces() {
    const boardRect = boardEl.getBoundingClientRect();
    const byPos = {};
    for (const p of state.players) (byPos[p.pos] ||= []).push(p);

    for (const [pos, group] of Object.entries(byPos)) {
      const cell = boardEl.querySelector(`.cell[data-index="${pos}"]`);
      if (!cell) continue;
      const r = cell.getBoundingClientRect();
      group.forEach((p, k) => {
        if (p.dragging) return;
        const [ox, oy] = group.length === 1 ? [0, 0.08] : OFFSETS[k % OFFSETS.length];
        const x = r.left - boardRect.left + r.width * (0.5 + ox);
        const y = r.top - boardRect.top + r.height * (0.5 + oy);
        p.el.style.transform = `translate(${x}px, ${y}px)`;
      });
    }
    for (const p of state.players) p.el.classList.toggle('active', p.id === state.current);
  }

  function renderPlayers() {
    const ul = $('players');
    ul.innerHTML = '';
    for (const p of state.players) {
      const li = document.createElement('li');
      li.className = p.id === state.current ? 'current' : '';
      li.innerHTML = `
        <span class="chip" style="--pc:${p.color}">${p.id + 1}</span>
        <span class="pname">${p.name}</span>
        <span class="meta">マス ${p.pos} ・ ${p.laps}周</span>`;
      ul.appendChild(li);
    }
    const cur = state.players[state.current];
    $('turn').innerHTML = cur
      ? `<span class="chip" style="--pc:${cur.color}">${cur.id + 1}</span> ${cur.name} の番`
      : '';
  }

  // ---------- ドラッグで自由に移動 ----------

  let dragJustEnded = false;

  function enableDrag(player) {
    const el = player.el;
    el.addEventListener('pointerdown', (e) => {
      if (state.busy) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      player.dragging = true;
      el.classList.add('dragging');
      const boardRect = boardEl.getBoundingClientRect();
      const move = (ev) => {
        el.style.transform = `translate(${ev.clientX - boardRect.left}px, ${ev.clientY - boardRect.top}px)`;
      };
      const up = (ev) => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        player.dragging = false;
        el.classList.remove('dragging');
        const cell = document.elementsFromPoint(ev.clientX, ev.clientY).find((n) => n.classList?.contains('cell'));
        if (cell) {
          const to = Number(cell.dataset.index);
          if (to !== player.pos) log(`${player.name} を マス${to} へ移動`);
          player.pos = to;
        }
        dragJustEnded = true;
        setTimeout(() => (dragJustEnded = false), 0);
        placePieces();
        renderPlayers();
      };
      move(e);
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  }

  // ---------- サイコロ ----------

  function setupDice(count) {
    $('diceTray').innerHTML = '';
    state.dice = Array.from({ length: count }, () => new Die($('diceTray')));
    $('diceTotal').innerHTML = '&nbsp;';
  }

  // ---------- ターン進行 ----------

  async function takeTurn() {
    if (state.busy || !state.players.length) return;
    state.busy = true;
    $('rollBtn').disabled = true;

    const player = state.players[state.current];
    const values = await Promise.all(state.dice.map((d) => d.roll()));
    const total = values.reduce((a, b) => a + b, 0);
    $('diceTotal').textContent = values.length > 1 ? `${values.join(' + ')} = ${total}` : `${total}`;
    log(`${player.name} が ${total} を出した`);

    await movePlayer(player, total);
    RULES.onLand(player, state.squares[player.pos], ruleApi);

    state.current = (state.current + 1) % state.players.length;
    placePieces();
    renderPlayers();
    state.busy = false;
    $('rollBtn').disabled = false;
  }

  async function movePlayer(player, steps) {
    const stepwise = $('stepMove').checked;
    if (!stepwise) {
      const before = player.pos;
      player.pos = (player.pos + steps) % N;
      if (before + steps >= N) passStart(player);
      placePieces();
      await sleep(400);
      return;
    }
    for (let s = 0; s < steps; s++) {
      player.pos = (player.pos + 1) % N;
      if (player.pos === 0) passStart(player);
      player.el.classList.remove('hop');
      void player.el.offsetWidth;
      player.el.classList.add('hop');
      placePieces();
      renderPlayers();
      await sleep(230);
    }
  }

  function passStart(player) {
    player.laps++;
    RULES.onPassStart(player, ruleApi);
  }

  // ---------- ログ ----------

  function log(text) {
    const li = document.createElement('li');
    li.textContent = text;
    $('log').prepend(li);
    while ($('log').children.length > 30) $('log').lastChild.remove();
  }

  const ruleApi = { log, state };

  // ---------- 起動 ----------

  function reset() {
    $('log').innerHTML = '';
    setupDice(Number($('diceCount').value));
    setupPlayers(Number($('playerCount').value));
    log('ゲーム開始！');
  }

  $('rollBtn').addEventListener('click', takeTurn);
  $('resetBtn').addEventListener('click', () => !state.busy && reset());
  $('playerCount').addEventListener('change', () => !state.busy && reset());
  $('diceCount').addEventListener('change', () => !state.busy && setupDice(Number($('diceCount').value)));
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !dialog.open && document.activeElement?.tagName !== 'INPUT') {
      e.preventDefault();
      takeTurn();
    }
  });
  new ResizeObserver(placePieces).observe(boardEl);

  state.squares = loadSquares();
  renderBoard();
  reset();
})();
