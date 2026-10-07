// プレイヤーボード（The Players' Ledger）。
// 各プレイヤーは 武器・防具・バックパック の装備枠と、バックパックの中身（マス目）を持つ。
// 持ち物はドラッグで 装備 / 収納 / 他のプレイヤーへ渡す / 補給所へ戻す ができる。

const Ledger = (() => {
  const ITEMS = CONFIG.items;
  const SLOTS = [
    { key: 'weapon', label: 'Weapon', type: 'weapon', box: [4, 2] },
    { key: 'armor',  label: 'Armour', type: 'armor',  box: [2, 3] },
    { key: 'pack',   label: 'Pack',   type: 'pack',   box: [3, 3] },
  ];

  let players = [];
  let onChange = () => {};
  let uidSeq = 1;
  const $ = (sel, root = document) => root.querySelector(sel);
  const cellPx = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cell')) || 30;

  // ---------- 持ち物のデータ ----------

  const newItem = (id) => ({ uid: uidSeq++, id });

  function size(id, rot) {
    const it = ITEMS[id];
    return rot ? [it.h, it.w] : [it.w, it.h];
  }

  function dims(inv) {
    const pack = inv.equip.pack && ITEMS[inv.equip.pack.id];
    return pack ? [pack.cols, pack.rows] : [CONFIG.pockets.cols, CONFIG.pockets.rows];
  }

  function fits(inv, [cols, rows], id, x, y, rot, ignoreUid) {
    const [w, h] = size(id, rot);
    if (x < 0 || y < 0 || x + w > cols || y + h > rows) return false;
    return inv.bag.every((e) => {
      if (e.uid === ignoreUid) return true;
      const [ew, eh] = size(e.id, e.rot);
      return x + w <= e.x || e.x + ew <= x || y + h <= e.y || e.y + eh <= y;
    });
  }

  function firstFit(inv, d, id) {
    for (const rot of [false, true]) {
      for (let y = 0; y < d[1]; y++) {
        for (let x = 0; x < d[0]; x++) {
          if (fits(inv, d, id, x, y, rot)) return { x, y, rot };
        }
      }
    }
    return null;
  }

  // 大きい物から順に詰め直す。入りきらなければ null
  function autopack(entries, d) {
    const sorted = [...entries].sort((a, b) => {
      const [aw, ah] = size(a.id), [bw, bh] = size(b.id);
      return bw * bh - aw * ah || Math.max(bw, bh) - Math.max(aw, ah) || a.uid - b.uid;
    });
    const work = { bag: [] };
    for (const e of sorted) {
      const spot = firstFit(work, d, e.id);
      if (!spot) return null;
      work.bag.push({ ...e, ...spot });
    }
    return work.bag;
  }

  function setup(list) {
    players = list;
    for (const p of players) {
      const kit = CONFIG.starterKit;
      p.inv = { equip: {}, bag: [] };
      for (const s of SLOTS) p.inv.equip[s.key] = kit.equip[s.key] ? newItem(kit.equip[s.key]) : null;
      for (const id of kit.bag) stow(p, id);
    }
    render();
  }

  function stow(player, id) {
    if (!ITEMS[id]) return false;
    const spot = firstFit(player.inv, dims(player.inv), id);
    if (!spot) return false;
    player.inv.bag.push({ ...newItem(id), ...spot });
    return true;
  }

  function give(player, id) {
    if (!stow(player, id)) return false;
    render();
    onChange();
    return true;
  }

  function stats(player) {
    const { weapon, armor } = player.inv.equip;
    return { atk: weapon ? ITEMS[weapon.id].atk || 0 : 0, def: armor ? ITEMS[armor.id].def || 0 : 0 };
  }

  // ---------- 移動（成功したら true） ----------
  // src: {kind:'bag', pid, uid} | {kind:'slot', pid, slot} | {kind:'depot', id}
  // dst: {kind:'bag', pid, x, y, rot} | {kind:'slot', pid, slot} | {kind:'depot'}

  function move(src, dst) {
    const invs = players.map((p) => structuredClone(p.inv));
    const fail = (msg) => { notice(msg); return false; };

    // 1. 取り出す
    let item, from = null;
    if (src.kind === 'depot') item = newItem(src.id);
    if (src.kind === 'bag') {
      const inv = invs[src.pid];
      const i = inv.bag.findIndex((e) => e.uid === src.uid);
      from = inv.bag[i];
      inv.bag.splice(i, 1);
      item = { uid: from.uid, id: from.id };
    }
    if (src.kind === 'slot') {
      if (dst.kind === 'slot' && dst.pid === src.pid && dst.slot === src.slot) return false;
      const inv = invs[src.pid];
      item = inv.equip[src.slot];
      inv.equip[src.slot] = null;
      if (src.slot === 'pack') {
        if (dst.kind === 'bag' && dst.pid === src.pid) return fail('A pack cannot be packed inside itself.');
        const packed = autopack(inv.bag, dims(inv));
        if (!packed) return fail('Empty the pack before taking it off.');
        inv.bag = packed;
      }
    }

    // 2. 置く
    if (dst.kind === 'depot') {
      if (src.kind !== 'depot') notice(`${ITEMS[item.id].name} returned to the depot.`);
    } else if (dst.kind === 'bag') {
      const inv = invs[dst.pid];
      if (!fits(inv, dims(inv), item.id, dst.x, dst.y, dst.rot)) return fail('There is no room there.');
      inv.bag.push({ ...item, x: dst.x, y: dst.y, rot: dst.rot });
    } else if (dst.kind === 'slot') {
      const slot = SLOTS.find((s) => s.key === dst.slot);
      if (ITEMS[item.id].type !== slot.type) return fail(`That is not a ${slot.label.toLowerCase()}.`);
      const inv = invs[dst.pid];
      const old = inv.equip[dst.slot];
      inv.equip[dst.slot] = item;
      if (dst.slot === 'pack') {
        const d = dims(inv);
        if (!inv.bag.every((e) => fits(inv, d, e.id, e.x, e.y, e.rot, e.uid))) {
          const packed = autopack(inv.bag, d);
          if (!packed) return fail('Too much to carry in that pack.');
          inv.bag = packed;
        }
      }
      // 外した装備は、元の場所 → このプレイヤーの鞄 → 元の持ち主の鞄 → 補給所 の順に収める
      if (old) {
        const tries = [];
        if (from) tries.push([invs[src.pid], from.x, from.y]);
        tries.push([inv], src.pid !== undefined ? [invs[src.pid]] : null);
        let placed = false;
        for (const t of tries) {
          if (!t) continue;
          const [tinv, x, y] = t;
          const d = dims(tinv);
          let spot = null;
          if (x !== undefined) {
            for (const rot of [false, true]) if (!spot && fits(tinv, d, old.id, x, y, rot)) spot = { x, y, rot };
          } else spot = firstFit(tinv, d, old.id);
          if (spot) { tinv.bag.push({ ...old, ...spot }); placed = true; break; }
        }
        if (!placed) notice(`No room for the ${ITEMS[old.id].name}; it went back to the depot.`);
      }
    }

    players.forEach((p, i) => { p.inv = invs[i]; });
    render();
    onChange();
    return true;
  }

  function rotateInPlace(pid, uid) {
    const inv = players[pid].inv;
    const e = inv.bag.find((b) => b.uid === uid);
    if (!e) return;
    if (!fits(inv, dims(inv), e.id, e.x, e.y, !e.rot, e.uid)) return notice('No room to turn it.');
    e.rot = !e.rot;
    render();
  }

  function tidy(pid) {
    const inv = players[pid].inv;
    const packed = autopack(inv.bag, dims(inv));
    if (!packed) return notice('Could not tidy this pack.');
    inv.bag = packed;
    render();
  }

  // ---------- 描画 ----------

  let noticeTimer = 0;
  function notice(text) {
    const el = $('#ledgerNotice');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function itemEl(entry, { rot = false, src }) {
    const [w, h] = size(entry.id, rot);
    const el = document.createElement('div');
    el.className = 'item';
    el.dataset.uid = entry.uid ?? '';
    el.style.setProperty('--w', w);
    el.style.setProperty('--h', h);
    el.title = ITEMS[entry.id].name;
    const img = new Image();
    img.src = ItemArt.url(entry.id, rot);
    img.alt = ITEMS[entry.id].name;
    img.draggable = false;
    el.appendChild(img);
    el.addEventListener('pointerdown', (e) => startDrag(e, el, entry, rot, src));
    return el;
  }

  const chip = (p) => `<span class="chip ${p.tone}">${{ sphere: '●', cube: '■', cone: '▲', gem: '◆' }[p.shape]}</span>`;

  function describe(id) {
    const it = ITEMS[id];
    if (it.type === 'weapon') return `Weapon · Attack ${it.atk}`;
    if (it.type === 'armor') return `Armour · Defence ${it.def}`;
    if (it.type === 'pack') return `Pack · holds ${it.cols} × ${it.rows}`;
    return `Supplies · ${it.w} × ${it.h}`;
  }

  function render() {
    const root = $('#boards');
    if (!root) return;
    root.innerHTML = '';
    for (const p of players) root.appendChild(renderBoard(p));
    // 空いている席（最大 4 人）
    for (let i = players.length; i < CONFIG.players.length; i++) {
      const art = document.createElement('article');
      art.className = 'board vacant';
      art.dataset.seat = i;
      art.innerHTML = `<h3><span class="nameplate">Player ${i + 1}</span></h3><p class="stats"><i>Seat vacant.</i> Raise the number of players to fill it.</p><div class="portrait-space"></div>`;
      root.appendChild(art);
    }
    renderDepot();
    paintPortraits();
  }

  // 各ボードの背景にプレイヤーの写真（ディザ）を敷く
  function paintPortraits() {
    const root = $('#boards');
    if (!root) return;
    for (const art of root.children) {
      const seat = Number(art.dataset.seat);
      const vacant = art.classList.contains('vacant');
      // 頭頂部は名札の上端、顎は写真用の空き（武器枠のすぐ上）の下端にそろえる
      const plate = $('.nameplate', art), space = $('.portrait-space', art);
      const top = plate ? plate.offsetTop : 8;
      const chin = space ? space.offsetTop + space.offsetHeight - 6 : 200;
      Portraits.apply(art, vacant ? CONFIG.players[seat] : players[seat], { wash: vacant ? 0.35 : 0, top, chin });
    }
  }
  if (window.ResizeObserver) {
    let t = 0;
    new ResizeObserver(() => { clearTimeout(t); t = setTimeout(paintPortraits, 120); })
      .observe(document.documentElement);
  }

  function renderBoard(p) {
    const inv = p.inv;
    const [cols, rows] = dims(inv);
    const st = stats(p);
    const used = inv.bag.reduce((n, e) => n + ITEMS[e.id].w * ITEMS[e.id].h, 0);
    const art = document.createElement('article');
    art.className = 'board' + (p.current ? ' current' : '');
    art.dataset.seat = p.id;
    art.innerHTML = `
      <h3><span class="nameplate">${chip(p)} ${p.name}</span>${p.current ? ' <i>— to play</i>' : ''}</h3>
      <p class="stats">Square <b>${p.pos}</b> · Lap <b>${p.laps}</b> · Attack <b>${st.atk}</b> · Defence <b>${st.def}</b> · Load <b>${used}/${cols * rows}</b></p>
      <div class="portrait-space"></div>
      <div class="slots"></div>
      <div class="bag-head">
        <span>${inv.equip.pack ? ITEMS[inv.equip.pack.id].name : 'Pockets'}, ${cols} × ${rows}</span>
        <button class="link tidy">Tidy up</button>
      </div>
      <div class="bag" style="--cols:${cols};--rows:${rows}"></div>`;

    const slotsEl = $('.slots', art);
    for (const s of SLOTS) {
      const fig = document.createElement('figure');
      fig.className = `slot slot-${s.key}`;
      fig.dataset.pid = p.id;
      fig.dataset.slot = s.key;
      fig.innerHTML = `<div class="slot-box" style="--bw:${s.box[0]};--bh:${s.box[1]}"></div>
        <figcaption>${s.label}${inv.equip[s.key] ? `<br><span>${ITEMS[inv.equip[s.key].id].name}</span>` : '<br><span>—</span>'}</figcaption>`;
      const eq = inv.equip[s.key];
      if (eq) $('.slot-box', fig).appendChild(itemEl(eq, { src: { kind: 'slot', pid: p.id, slot: s.key } }));
      slotsEl.appendChild(fig);
    }

    const bag = $('.bag', art);
    bag.dataset.pid = p.id;
    for (const e of inv.bag) {
      const el = itemEl(e, { rot: e.rot, src: { kind: 'bag', pid: p.id, uid: e.uid } });
      el.style.setProperty('--x', e.x);
      el.style.setProperty('--y', e.y);
      el.addEventListener('dblclick', () => rotateInPlace(p.id, e.uid));
      bag.appendChild(el);
    }
    $('.tidy', art).addEventListener('click', () => tidy(p.id));
    return art;
  }

  function renderDepot() {
    const list = $('#depotItems');
    if (!list || list.childElementCount) return;
    for (const id of Object.keys(ITEMS)) {
      const ad = document.createElement('div');
      ad.className = 'ad';
      const pic = document.createElement('div');
      pic.className = 'ad-pic';
      pic.appendChild(itemEl({ id }, { src: { kind: 'depot', id } }));
      ad.appendChild(pic);
      ad.insertAdjacentHTML('beforeend', `<div><b>${ITEMS[id].name}</b><br><span>${describe(id)}</span></div>`);
      list.appendChild(ad);
    }
  }

  // ---------- ドラッグ ----------

  let drag = null;

  function startDrag(e, el, entry, rot, src) {
    if (e.button > 0) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    const c = r.width / size(entry.id, rot)[0];
    drag = {
      el, entry, src, rot,
      gx: Math.floor((e.clientX - r.left) / c),
      gy: Math.floor((e.clientY - r.top) / c),
      startX: e.clientX, startY: e.clientY, moved: false,
      ghost: null, preview: null, target: null,
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }

  function makeGhost() {
    const [w, h] = size(drag.entry.id, drag.rot);
    if (!drag.ghost) {
      drag.ghost = document.createElement('div');
      drag.ghost.className = 'item ghost';
      drag.ghost.appendChild(new Image());
      document.body.appendChild(drag.ghost);
      drag.el.classList.add('lifted');
    }
    drag.ghost.style.setProperty('--w', w);
    drag.ghost.style.setProperty('--h', h);
    drag.ghost.firstChild.src = ItemArt.url(drag.entry.id, drag.rot);
  }

  function rotateDrag() {
    const [, h] = size(drag.entry.id, drag.rot);
    // 掴んでいるマスが回転後も指の下に来るように
    [drag.gx, drag.gy] = [h - 1 - drag.gy, drag.gx];
    drag.rot = !drag.rot;
    makeGhost();
  }

  function onMove(e) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 4) return;
    if (!drag.moved) { drag.moved = true; makeGhost(); }
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    updateDrag();
  }

  function updateDrag() {
    const c = cellPx();
    const px = drag.lastX, py = drag.lastY;
    drag.ghost.style.transform = `translate(${px - (drag.gx + 0.5) * c}px, ${py - (drag.gy + 0.5) * c}px)`;
    clearPreview();
    const under = document.elementFromPoint(px, py);
    const bag = under?.closest('.bag');
    const slot = under?.closest('.slot');
    const depot = under?.closest('.depot');
    drag.target = null;
    if (bag) {
      const pid = Number(bag.dataset.pid);
      const r = bag.getBoundingClientRect();
      const inv = players[pid].inv;
      const d = dims(inv);
      const cw = r.width / d[0];
      const x = Math.floor((px - r.left) / cw) - drag.gx;
      const y = Math.floor((py - r.top) / cw) - drag.gy;
      const ignore = drag.src.kind === 'bag' && drag.src.pid === pid ? drag.entry.uid : undefined;
      const ok = fits(inv, d, drag.entry.id, x, y, drag.rot, ignore);
      const [w, h] = size(drag.entry.id, drag.rot);
      const pv = document.createElement('div');
      pv.className = 'preview ' + (ok ? 'ok' : 'bad');
      pv.style.cssText = `--x:${x};--y:${y};--w:${w};--h:${h}`;
      bag.appendChild(pv);
      drag.preview = pv;
      drag.target = { kind: 'bag', pid, x, y, rot: drag.rot };
    } else if (slot) {
      const ok = ITEMS[drag.entry.id].type === SLOTS.find((s) => s.key === slot.dataset.slot).type;
      slot.classList.add(ok ? 'ok' : 'bad');
      drag.preview = slot;
      drag.target = { kind: 'slot', pid: Number(slot.dataset.pid), slot: slot.dataset.slot };
    } else if (depot) {
      depot.classList.add('ok');
      drag.preview = depot;
      drag.target = { kind: 'depot' };
    }
  }

  function clearPreview() {
    if (!drag.preview) return;
    if (drag.preview.classList.contains('preview')) drag.preview.remove();
    else drag.preview.classList.remove('ok', 'bad');
    drag.preview = null;
  }

  function endDrag() {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
    if (drag.ghost) drag.ghost.remove();
    drag.el.classList.remove('lifted');
    clearPreview();
    drag = null;
  }

  function onUp() {
    if (!drag) return;
    const { moved, target, src } = drag;
    endDrag();
    if (moved && target) move(src, target);
  }

  function onCancel() { if (drag) endDrag(); }

  // ドラッグ中は R キー / 右クリックで回す
  window.addEventListener('keydown', (e) => {
    if (drag?.moved && e.code === 'KeyR') { e.preventDefault(); e.stopPropagation(); rotateDrag(); updateDrag(); }
  }, true);
  window.addEventListener('contextmenu', (e) => {
    if (drag?.moved) { e.preventDefault(); rotateDrag(); updateDrag(); }
  });

  // 補給所の差し込み（右から出てくる）
  function toggleDepot(open) {
    const el = $('#depot');
    if (!el) return;
    open = open ?? !el.classList.contains('open');
    el.classList.toggle('open', open);
    el.setAttribute('aria-hidden', String(!open));
    $('#depotToggle')?.setAttribute('aria-expanded', String(open));
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('#depotToggle')) toggleDepot();
    if (e.target.closest('#depotClose')) toggleDepot(false);
  });

  return {
    init(opts) { onChange = opts.onChange || onChange; },
    setup, render, give, stats, repaint: paintPortraits,
    isDragging: () => !!drag,
  };
})();
