(() => {
  const STORAGE_KEY = 'scape.squares.v3';
  const TILE_H = 0.3;            // マスの厚み
  const TOP = TILE_H / 2;        // マス上面の高さ
  const GROUND = -TILE_H / 2;    // 影を落とす地面の高さ

  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- コース形状 ----------

  // マスの配置は js/map.js（マップエディタから書き出したもの）。n の順に並べる
  const cells = [...MAP.tiles].sort((a, b) => a.n - b.n).map((t) => ({ x: t.x, z: t.y, area: t.area }));
  const N = cells.length;

  // 隣り合うマス（上下左右）。駒はこのつながりに沿って歩く
  const neighbors = cells.map((c) => cells
    .map((o, j) => (Math.abs(o.x - c.x) + Math.abs(o.z - c.z) === 1 ? j : -1))
    .filter((j) => j >= 0));
  const areaOf = (i) => MAP.areas.find((a) => a.id === cells[i].area);

  const minX = Math.min(...cells.map((c) => c.x)), maxX = Math.max(...cells.map((c) => c.x));
  const minZ = Math.min(...cells.map((c) => c.z)), maxZ = Math.max(...cells.map((c) => c.z));
  const center = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);

  const state = {
    squares: [],
    players: [],
    current: 0,
    dice: [],
    busy: false,
  };

  // ---------- Three.js 基本 ----------

  const stage = $('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  stage.prepend(renderer.domElement);
  const dither = new Dither(renderer);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 70);

  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x4a5a6c, 0.9));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(center.x - 6, 12, center.z - 3);
  sun.target.position.copy(center);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10 });
  sun.shadow.bias = -0.0005;
  scene.add(sun, sun.target);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.ShadowMaterial({ opacity: 0.35, depthWrite: false }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(center.x, GROUND, center.z);
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- サイコロ専用の小さな舞台（これもディザを通す） ----------

  const diceStage = $('diceStage');
  const diceRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  diceRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  diceRenderer.shadowMap.enabled = true;
  diceRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  diceStage.prepend(diceRenderer.domElement);
  const diceDither = new Dither(diceRenderer);
  diceDither.options = dither.options; // ドットの大きさなどはボードと共通
  diceDither.vignette = 0.2;

  const diceScene = new THREE.Scene();
  const diceCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 40);
  {
    const a = Math.PI / 4, e = Math.PI * 0.24, R = 12;
    diceCamera.position.set(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R);
    diceCamera.lookAt(0, 0.2, 0);
    diceScene.add(new THREE.HemisphereLight(0xfff6e8, 0x4a5a6c, 0.9));
    const lamp = new THREE.DirectionalLight(0xffffff, 2.0);
    lamp.position.set(-3, 6, 1);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(512, 512);
    Object.assign(lamp.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3 });
    diceScene.add(lamp);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.35, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    diceScene.add(floor);
  }

  function resizeDice() {
    const w = diceStage.clientWidth, h = diceStage.clientHeight;
    if (!w || !h) return;
    diceRenderer.setSize(w, h);
    diceDither.setSize(w, h);
    const aspect = w / h;
    const halfH = Math.max(0.72, 1.3 / aspect);
    Object.assign(diceCamera, { left: -halfH * aspect, right: halfH * aspect, top: halfH, bottom: -halfH });
    diceCamera.updateProjectionMatrix();
  }
  new ResizeObserver(resizeDice).observe(diceStage);

  // ---------- カメラ（アイソメトリック） ----------

  const DEFAULT_VIEW = { angle: Math.PI * 1.25, elev: Math.PI / 6, zoom: 1.25 }; // 30° 見下ろし（2:1 アイソメ）
  const view = { ...DEFAULT_VIEW };
  const ELEV_MIN = Math.PI / 18, ELEV_MAX = Math.PI / 2 - 0.01; // 10°〜ほぼ真上
  const ZOOM_MIN = 0.5, ZOOM_MAX = 4;

  function updateCamera() {
    const R = 30;
    const flat = Math.cos(view.elev) * R;
    camera.position.set(
      center.x + Math.cos(view.angle) * flat,
      Math.sin(view.elev) * R,
      center.z + Math.sin(view.angle) * flat,
    );
    camera.lookAt(center);
  }

  function updateProjection() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const aspect = w / h;
    const span = (maxX - minX + maxZ - minZ + 6) / Math.SQRT2; // 斜めから見たときの幅
    const halfH = Math.max(span * 0.36, (span / 2 + 0.6) / aspect) / view.zoom;
    Object.assign(camera, { left: -halfH * aspect, right: halfH * aspect, top: halfH, bottom: -halfH });
    camera.updateProjectionMatrix();
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    renderer.setSize(w, h);
    dither.setSize(w, h);
    updateProjection();
  }
  new ResizeObserver(resize).observe(stage);

  function orbit(dx, dy) {
    view.angle += dx * 0.008;
    view.elev = Math.min(ELEV_MAX, Math.max(ELEV_MIN, view.elev + dy * 0.006));
    updateCamera();
  }

  function setZoom(z) {
    view.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
    updateProjection();
  }

  // ボタン・キー用：なめらかに視点を動かす
  function animateView(to, dur = 400) {
    const from = { ...view };
    return tween(dur, (t) => {
      const k = ease(t);
      for (const key of Object.keys(to)) view[key] = from[key] + (to[key] - from[key]) * k;
      updateCamera();
      updateProjection();
    });
  }

  function resetView() {
    // 今の向きから一番近い回り方で初期位置へ戻す
    const turn = Math.PI * 2;
    const angle = DEFAULT_VIEW.angle + Math.round((view.angle - DEFAULT_VIEW.angle) / turn) * turn;
    return animateView({ ...DEFAULT_VIEW, angle });
  }

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    setZoom(view.zoom * Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });

  // ---------- アニメーション ----------

  const tweens = new Set();
  const tween = (dur, fn) => new Promise((res) => tweens.add({ t0: performance.now(), dur, fn, res }));
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const frameHooks = [];

  renderer.setAnimationLoop((now) => {
    for (const tw of [...tweens]) {
      const t = Math.min(1, (now - tw.t0) / tw.dur);
      tw.fn(t);
      if (t >= 1) { tweens.delete(tw); tw.res(); }
    }
    for (const f of frameHooks) f(now / 1000);
    dither.render(scene, camera);
    diceDither.render(diceScene, diceCamera);
  });

  // ---------- マス ----------

  function terrainOf(i) {
    return areaOf(i)?.terrain || 'road';
  }

  function defaultSquares() {
    return Array.from({ length: N }, (_, i) => ({
      name: '', icon: '', terrain: terrainOf(i), type: 'normal',
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

  const tileGeo = new THREE.BoxGeometry(0.94, TILE_H, 0.94);
  const tiles = [];
  const sideMats = Object.fromEntries(Object.entries(CONFIG.terrains).map(([k, t]) =>
    [k, new THREE.MeshLambertMaterial({ color: t.side })]));
  const bottomMat = new THREE.MeshLambertMaterial({ color: 0x4a3f33 });

  function buildTile(i) {
    const sq = state.squares[i];
    const old = tiles[i];
    if (old) {
      scene.remove(old);
      old.userData.top.map.dispose();
      old.userData.top.dispose();
    }
    const top = new THREE.MeshLambertMaterial({ map: Textures.tile(sq.terrain, i, sq) });
    const side = sideMats[sq.terrain] || sideMats.road;
    const mesh = new THREE.Mesh(tileGeo, [side, side, top, bottomMat, side, side]);
    mesh.position.set(cells[i].x, 0, cells[i].z);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData = { index: i, top, terrain: sq.terrain };
    scene.add(mesh);
    tiles[i] = mesh;
  }

  function buildBoard() {
    for (let i = 0; i < N; i++) buildTile(i);
  }

  // 溶岩はゆらゆら光る、水はゆっくり揺れる
  frameHooks.push((t) => {
    for (const m of tiles) {
      const { terrain, top, index } = m.userData;
      if (m === hovered) continue;
      if (terrain === 'lava') top.emissive.setRGB(0.25 + 0.15 * Math.sin(t * 2 + index), 0.05, 0);
      else top.emissive.setRGB(0, 0, 0);
      m.position.y = terrain === 'water' ? Math.sin(t * 1.5 + index * 0.7) * 0.025 : 0;
    }
  });

  // ---------- 建物 ----------

  const mat = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts });
  const STONE = mat(0xc9c2b6), STONE_D = mat(0x9a9286), ROOF_R = mat(0xc8402e), ROOF_B = mat(0x3b6fc4);
  const DARK = mat(0x3a2f26), FLAG = mat(0xe8463a, { side: THREE.DoubleSide });

  function part(geo, material, x, y, z) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  function flag(x, y, z) {
    const g = new THREE.Group();
    g.add(part(new THREE.CylinderGeometry(0.015, 0.015, 0.4), DARK, 0, 0.2, 0));
    const f = part(new THREE.PlaneGeometry(0.22, 0.13), FLAG, 0.11, 0.33, 0);
    g.add(f);
    g.position.set(x, y, z);
    frameHooks.push((t) => { f.rotation.y = Math.sin(t * 3 + x) * 0.35; });
    return g;
  }

  function crenels(g, w, y, material) {
    const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    for (let k = -2; k <= 2; k += 2) {
      for (const [x, z] of [[k * w / 4, -w / 2], [k * w / 4, w / 2], [-w / 2, k * w / 4], [w / 2, k * w / 4]]) {
        g.add(part(geo, material, x, y, z));
      }
    }
  }

  const LOT = mat(0x8a8780), LOT_SIDE = mat(0x4a4843);
  const CONCRETE = mat(0xb5b1a8), CONCRETE_D = mat(0x7d7a73), METAL = mat(0x6d7176), GLASS = mat(0x2e3236);
  const CANVAS = mat(0xa39563), SANDBAG = mat(0xc2b48a), WHITE = mat(0xf0efea);

  // エリアの真ん中に建てる建物（1 マスに収まる大きさ）
  const BUILDERS = {
    factory() {
      const g = new THREE.Group();
      g.add(part(new THREE.BoxGeometry(0.8, 0.45, 0.62), CONCRETE, 0, 0.225, 0.05));
      for (let i = 0; i < 3; i++) {                                   // のこぎり屋根
        const roof = part(new THREE.BoxGeometry(0.26, 0.04, 0.66), METAL, -0.27 + i * 0.27, 0.5, 0.05);
        roof.rotation.z = 0.5;
        g.add(roof);
      }
      g.add(part(new THREE.CylinderGeometry(0.06, 0.08, 0.95, 8), CONCRETE_D, 0.28, 0.48, -0.3));   // 煙突
      g.add(part(new THREE.CylinderGeometry(0.05, 0.07, 0.75, 8), CONCRETE_D, 0.1, 0.38, -0.32));
      g.add(part(new THREE.BoxGeometry(0.22, 0.24, 0.02), DARK, -0.15, 0.12, 0.37));                // 搬入口
      return g;
    },
    mall() {
      const g = new THREE.Group();
      g.add(part(new THREE.BoxGeometry(0.86, 0.36, 0.7), CONCRETE, 0, 0.18, 0));
      g.add(part(new THREE.BoxGeometry(0.87, 0.1, 0.71), GLASS, 0, 0.22, 0));                        // ガラスの帯
      g.add(part(new THREE.BoxGeometry(0.5, 0.16, 0.04), WHITE, 0, 0.46, 0.33));                    // 看板
      g.add(part(new THREE.BoxGeometry(0.3, 0.12, 0.3), CONCRETE_D, 0.18, 0.42, -0.12));             // 屋上の設備
      return g;
    },
    outpost() {
      const g = new THREE.Group();
      const bag = new THREE.BoxGeometry(0.16, 0.08, 0.1);
      for (let i = 0; i < 12; i++) {                                  // 土嚢の輪
        const a = (i / 12) * Math.PI * 2;
        for (let h = 0; h < 2; h++) {
          const b = part(bag, SANDBAG, Math.cos(a + h * 0.26) * 0.36, 0.04 + h * 0.08, Math.sin(a + h * 0.26) * 0.36);
          b.rotation.y = -a;
          g.add(b);
        }
      }
      const tent = part(new THREE.ConeGeometry(0.22, 0.32, 4), CANVAS, -0.05, 0.16, 0.02);           // テント
      tent.rotation.y = Math.PI / 4;
      g.add(tent);
      g.add(flag(0.18, 0, -0.14));
      return g;
    },
    hospital() {
      const g = new THREE.Group();
      g.add(part(new THREE.BoxGeometry(0.78, 0.6, 0.6), WHITE, 0, 0.3, 0));
      g.add(part(new THREE.BoxGeometry(0.79, 0.04, 0.61), CONCRETE_D, 0, 0.42, 0));                   // 階の線
      g.add(part(new THREE.BoxGeometry(0.34, 0.02, 0.1), DARK, 0, 0.61, 0));                          // 屋上の十字
      g.add(part(new THREE.BoxGeometry(0.1, 0.02, 0.34), DARK, 0, 0.61, 0));
      g.add(part(new THREE.BoxGeometry(0.18, 0.22, 0.02), GLASS, 0, 0.11, 0.31));                     // 入口
      return g;
    },
  };


  function buildLandmarks() {
    for (const { x, y, kind } of CONFIG.landmarks) {
      if (!BUILDERS[kind]) continue;
      const holder = new THREE.Group();
      holder.add(part(new THREE.BoxGeometry(0.94, TILE_H, 0.94), [LOT_SIDE, LOT_SIDE, LOT, bottomMat, LOT_SIDE, LOT_SIDE], 0, 0, 0));
      const g = BUILDERS[kind]();
      g.position.y = TOP;
      g.scale.set(1.05, 1.7, 1.05); // 遠目にも分かるよう背を高く
      holder.add(g);
      holder.position.set(x, 0, y);
      scene.add(holder);
    }
  }


  // ---------- コマ ----------

  const pawnGeo = new THREE.LatheGeometry([
    [0, 0], [0.2, 0], [0.21, 0.04], [0.17, 0.08], [0.11, 0.14], [0.08, 0.3],
    [0.07, 0.4], [0.13, 0.43], [0.13, 0.46], [0.05, 0.48], [0, 0.48],
  ].map(([x, y]) => new THREE.Vector2(x, y)), 24);
  // プレイヤーごとに頭の形を変えて、白黒でも見分けられるようにする
  const HEADS = {
    sphere: () => new THREE.SphereGeometry(0.12, 20, 14),
    cube:   () => new THREE.BoxGeometry(0.2, 0.2, 0.2).rotateY(Math.PI / 4),
    cone:   () => new THREE.ConeGeometry(0.14, 0.26, 16),
    gem:    () => new THREE.OctahedronGeometry(0.15),
  };
  const TONES = { light: '#f2f2f2', dark: '#262626' };
  const SHAPE_GLYPH = { sphere: '●', cube: '■', cone: '▲', gem: '◆' };
  const ringGeo = new THREE.TorusGeometry(0.27, 0.025, 8, 32).rotateX(Math.PI / 2);
  const piecesGroup = new THREE.Group();
  scene.add(piecesGroup);

  function makePiece(player) {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.05 });
    const g = new THREE.Group();
    const body = new THREE.Mesh(pawnGeo, m);
    const head = new THREE.Mesh(HEADS[player.shape](), m);
    head.position.y = 0.6;
    body.castShadow = head.castShadow = true;
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial());
    ring.position.y = 0.02;
    g.add(body, head, ring);
    g.scale.setScalar(1.3);
    g.userData = { player, ring, material: m };
    piecesGroup.add(g);
    paintPiece(player, g);
    return g;
  }

  function paintPiece(player, g = player.obj) {
    g.userData.material.color.set(TONES[player.tone]);
  }

  // 手番のコマの足元の輪を脈動させる
  frameHooks.push((t) => {
    for (const p of state.players) {
      const { ring } = p.obj.userData;
      ring.visible = p.id === state.current;
      ring.scale.setScalar(1 + 0.12 * Math.sin(t * 5));
      // どんな地面の上でも見えるよう白黒に点滅させる
      ring.material.color.setScalar(Math.sin(t * 6) > 0 ? 1 : 0);
    }
  });

  const SLOTS = [[-0.2, -0.2], [0.2, 0.2], [0.2, -0.2], [-0.2, 0.2]];

  function slotOf(player) {
    const group = state.players.filter((p) => p.pos === player.pos);
    const k = group.indexOf(player);
    const [ox, oz] = group.length === 1 ? [0, 0] : SLOTS[k % 4];
    const c = cells[player.pos];
    return new THREE.Vector3(c.x + ox, TOP, c.z + oz);
  }

  // 自分以外のコマを、いるべき位置へ滑らせる
  function settlePieces(except) {
    for (const p of state.players) {
      if (p === except || p.dragging) continue;
      const from = p.obj.position.clone(), to = slotOf(p);
      if (from.distanceTo(to) < 1e-3) continue;
      tween(200, (t) => p.obj.position.lerpVectors(from, to, ease(t)));
    }
  }

  function hop(player, height = 0.45, dur = 240) {
    const from = player.obj.position.clone(), to = slotOf(player);
    return tween(dur, (t) => {
      player.obj.position.lerpVectors(from, to, t);
      player.obj.position.y += Math.sin(Math.PI * t) * height;
    });
  }

  function setupPlayers(count) {
    piecesGroup.clear();
    state.players = CONFIG.players.slice(0, count).map((p, id) => ({ id, ...p, pos: 0, prev: null, laps: 0 }));
    for (const p of state.players) {
      p.obj = makePiece(p);
      p.obj.position.copy(slotOf(p));
    }
    state.current = 0;
    Ledger.setup(state.players);
    renderPlayers();
  }

  const chip = (p) => `<span class="chip ${p.tone}">${SHAPE_GLYPH[p.shape]}</span>`;

  function renderPlayers() {
    for (const p of state.players) p.current = p.id === state.current;
    Ledger.render();
    renderLocation();
    const cur = state.players[state.current];
    $('onMove').innerHTML = cur ? `Now on the move: ${chip(cur)} ${cur.name}` : '';
  }

  // 手番のプレイヤーが今いる場所
  function renderLocation() {
    const cur = state.players[state.current];
    if (!cur) return;
    const sq = state.squares[cur.pos];
    const others = state.players.filter((p) => p !== cur && p.pos === cur.pos);
    $('locWho').innerHTML = `Location · ${chip(cur)} ${cur.name}`;
    $('locTitle').textContent = Press.placeTitle(cur.pos, sq);
    $('locBody').textContent = Press.locationNote(cur, sq, others, neighbors[cur.pos].length, areaOf(cur.pos));
  }



  // ---------- サイコロ（3D） ----------

  const dieGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
  // BoxGeometry の面順: +x, -x, +y, -y, +z, -z
  const FACE_ORDER = [3, 4, 2, 5, 1, 6];
  const dieMats = FACE_ORDER.map((n) => new THREE.MeshLambertMaterial({ map: Textures.dieFace(n) }));
  const FACE_NORMAL = {
    3: new THREE.Vector3(1, 0, 0), 4: new THREE.Vector3(-1, 0, 0),
    2: new THREE.Vector3(0, 1, 0), 5: new THREE.Vector3(0, -1, 0),
    1: new THREE.Vector3(0, 0, 1), 6: new THREE.Vector3(0, 0, -1),
  };
  const UP = new THREE.Vector3(0, 1, 0);

  function setupDice(count) {
    for (const d of state.dice) diceScene.remove(d);
    state.dice = Array.from({ length: count }, (_, i) => {
      const d = new THREE.Mesh(dieGeo, dieMats);
      d.castShadow = true;
      d.position.copy(diceSpot(i, count));
      d.quaternion.setFromUnitVectors(FACE_NORMAL[1], UP);
      diceScene.add(d);
      return d;
    });
    $('diceTotal').textContent = '—';
  }

  function diceSpot(i, count) {
    const off = (i - (count - 1) / 2) * 0.85;
    return new THREE.Vector3(off * 0.7, 0.3, -off * 0.7 + (i % 2) * 0.25);
  }

  function rollDie(die, i, count) {
    const value = 1 + Math.floor(Math.random() * 6);
    const end = diceSpot(i, count);
    end.x += (Math.random() - 0.5) * 0.3;
    end.z += (Math.random() - 0.5) * 0.3;
    // 手前側から投げ込む
    const start = end.clone().add(new THREE.Vector3(1.8, 0, 1.8));
    const qEnd = new THREE.Quaternion().setFromUnitVectors(FACE_NORMAL[value], UP)
      .premultiply(new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * Math.PI * 2));
    const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    const spin = Math.PI * (6 + Math.random() * 4);
    const qSpin = new THREE.Quaternion();
    return tween(1100 + i * 120, (t) => {
      die.position.lerpVectors(start, end, ease(t));
      die.position.y = end.y + 1.1 * Math.pow(1 - t, 2) * Math.abs(Math.cos(Math.PI * 2.5 * t));
      qSpin.setFromAxisAngle(axis, Math.pow(1 - t, 2) * spin);
      die.quaternion.copy(qEnd).multiply(qSpin);
    }).then(() => value);
  }

  // ---------- ターン進行 ----------

  async function takeTurn() {
    if (state.busy || !state.players.length) return;
    state.busy = true;
    $('rollBtn').disabled = true;

    const player = state.players[state.current];
    const values = await Promise.all(state.dice.map((d, i) => rollDie(d, i, state.dice.length)));
    const total = values.reduce((a, b) => a + b, 0);
    $('diceTotal').textContent = values.length > 1 ? `${values.join(' + ')} = ${word(total)}` : word(total);

    story = [];
    const from = player.pos;
    await movePlayer(player, total);
    const sq = state.squares[player.pos];
    RULES.onLand(player, sq, ruleApi);
    const notes = story;
    story = null;
    publish(Press.turnHeadline(player, total, sq), Press.turnBody(player, total, from, sq, notes));

    state.current = (state.current + 1) % state.players.length;
    renderPlayers();
    state.busy = false;
    $('rollBtn').disabled = false;
  }

  // つながっているマスを 1 歩ずつ進む。来た道には戻らず、分かれ道ではプレイヤーが選ぶ
  async function movePlayer(player, steps) {
    const quick = !$('stepMove').checked;
    for (let s = 0; s < steps; s++) {
      let options = neighbors[player.pos].filter((j) => j !== player.prev);
      if (!options.length) options = neighbors[player.pos];   // 行き止まりでは引き返す
      if (!options.length) return;
      const next = options.length === 1 ? options[0] : await chooseWay(player, options, steps - s);
      player.prev = player.pos;
      player.pos = next;
      if (player.pos === 0) passStart(player);
      settlePieces(player);
      await hop(player, quick ? 0.25 : 0.45, quick ? 120 : 240);
      renderPlayers();
    }
  }

  // 分かれ道：候補のマスに印を出して、クリックされるのを待つ
  const markerGeo = new THREE.ConeGeometry(0.22, 0.45, 4).rotateX(Math.PI);
  const markerMat = new THREE.MeshLambertMaterial({ color: 0xf2f0ea, emissive: 0x333333 });
  function chooseWay(player, options, left) {
    return new Promise((resolve) => {
      const markers = options.map((j) => {
        const m = new THREE.Mesh(markerGeo, markerMat);
        m.castShadow = true;
        m.position.set(cells[j].x, TOP + 0.6, cells[j].z);
        scene.add(m);
        return m;
      });
      const bob = (t) => markers.forEach((m, k) => { m.position.y = TOP + 0.75 + Math.sin(t * 4 + k) * 0.12; m.rotation.y = t; });
      frameHooks.push(bob);
      $('locBody').textContent = `A crossroads. ${player.name} has ${word(left).toLowerCase()} square${left > 1 ? 's' : ''} left to walk — click one of the marked squares to choose the way.`;
      state.choosing = {
        options,
        pick(j) {
          markers.forEach((m) => scene.remove(m));
          frameHooks.splice(frameHooks.indexOf(bob), 1);
          state.choosing = null;
          renderLocation();
          resolve(j);
        },
      };
    });
  }

  function passStart(player) {
    player.laps++;
    RULES.onPassStart(player, ruleApi);
  }

  // ---------- マウス操作（ドラッグ / クリック / ホバー） ----------

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const dragPlane = new THREE.Plane(UP, -TOP);
  let hovered = null;
  let drag = null;
  let press = null;

  function setPointer(e) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
  }

  const tileAt = () => raycaster.intersectObjects(tiles, false)[0]?.object || null;

  function pieceAt() {
    let o = raycaster.intersectObjects(piecesGroup.children, true)[0]?.object;
    while (o && !o.userData.player) o = o.parent;
    return o?.userData.player || null;
  }

  function setHover(tile) {
    if (hovered === tile) return;
    if (hovered) hovered.userData.top.emissive.setRGB(0, 0, 0);
    hovered = tile;
    if (hovered) hovered.userData.top.emissive.setRGB(0.18, 0.18, 0.14);
  }

  const canvas = renderer.domElement;

  // 指（ポインタ）の位置。2本ならピンチで拡大縮小
  const touches = new Map();
  let pinch = null;
  let orbiting = null;

  canvas.addEventListener('pointerdown', (e) => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);

    if (touches.size === 2 && !drag) {
      const [a, b] = [...touches.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom };
      orbiting = null;
      press = null;
      return;
    }
    if (touches.size > 1) return;

    setPointer(e);
    const player = state.busy ? null : pieceAt();
    if (player) {
      drag = player;
      player.dragging = true;
      canvas.style.cursor = 'grabbing';
      return;
    }
    // コマ以外を掴んだら視点を回す（ほとんど動かさずに離したらマスのクリック）
    const tile = tileAt();
    press = { tile, x: e.clientX, y: e.clientY };
    orbiting = { x: e.clientX, y: e.clientY, moved: false };
  });

  canvas.addEventListener('pointermove', (e) => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch && touches.size >= 2) {
      const [a, b] = [...touches.values()];
      setZoom(pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist);
      return;
    }

    setPointer(e);
    if (drag) {
      const p = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(dragPlane, p)) drag.obj.position.set(p.x, TOP + 0.35, p.z);
      setHover(tileAt());
      return;
    }

    if (orbiting) {
      const dx = e.clientX - orbiting.x, dy = e.clientY - orbiting.y;
      if (!orbiting.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6) return;
      orbiting.moved = true;
      orbiting.x = e.clientX;
      orbiting.y = e.clientY;
      orbit(dx, dy);
      setHover(null);
      canvas.style.cursor = 'move';
      return;
    }

    setHover(tileAt());
    canvas.style.cursor = pieceAt() && !state.busy ? 'grab' : hovered ? 'pointer' : 'move';
  });

  function endPointer(e) {
    touches.delete(e.pointerId);
    if (pinch) {
      if (touches.size < 2) pinch = null;
      return;
    }
    setPointer(e);
    if (drag) {
      const player = drag;
      drag = null;
      player.dragging = false;
      canvas.style.cursor = '';
      const tile = tileAt();
      if (tile && tile.userData.index !== player.pos) {
        player.pos = tile.userData.index;
        player.prev = null;
        publish(`${player.name} Relocated to Square ${player.pos}`,
          `By order of an unseen hand, ${player.name} was lifted from the board and set down on square ${player.pos}. No dice were consulted.`);
      }
      hop(player, 0.15, 160);
      settlePieces(player);
      renderPlayers();
      return;
    }
    const clicked = e.type === 'pointerup' && orbiting && !orbiting.moved && press?.tile && tileAt() === press.tile;
    orbiting = null;
    canvas.style.cursor = '';
    if (clicked && state.choosing) {
      const j = press.tile.userData.index;
      if (state.choosing.options.includes(j)) state.choosing.pick(j);
    } else if (clicked) openSquareEditor(press.tile.userData.index);
    press = null;
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.addEventListener('pointerleave', () => !drag && !orbiting && setHover(null));

  // ---------- マス編集 ----------

  const dialog = $('squareDialog');
  let editing = -1;
  let editingTerrain = 'road';

  function openSquareEditor(i) {
    editing = i;
    const sq = state.squares[i];
    $('sqTitle').textContent = `Square No. ${i}`;
    $('sqName').value = sq.name;
    $('sqIcon').value = sq.icon;
    editingTerrain = sq.terrain;
    renderSwatches();
    dialog.showModal();
  }

  function renderSwatches() {
    const wrap = $('sqSwatches');
    wrap.innerHTML = '';
    for (const [key, t] of Object.entries(CONFIG.terrains)) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (key === editingTerrain ? ' on' : '');
      b.style.setProperty('--tone', Textures.gray(t.base));
      b.textContent = t.label;
      b.addEventListener('click', () => { editingTerrain = key; renderSwatches(); });
      wrap.appendChild(b);
    }
  }

  dialog.addEventListener('close', () => {
    if (dialog.returnValue !== 'ok' || editing < 0) return;
    Object.assign(state.squares[editing], {
      name: $('sqName').value.trim(),
      icon: $('sqIcon').value.trim(),
      terrain: editingTerrain,
    });
    saveSquares();
    if (hovered === tiles[editing]) hovered = null;
    buildTile(editing);
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
    if (!confirm('Restore every square to its original edition?')) return;
    state.squares = defaultSquares();
    saveSquares();
    hovered = null;
    buildBoard();
  });

  // ---------- 紙面（ログ） ----------

  let story = null;   // ターン中に RULES から届いた文。記事の本文に混ぜる
  let edition = 0;
  let typing = 0;

  // ルールからの一言。ターン中なら記事本文に、それ以外は短信として載せる
  function log(text) {
    if (story) story.push(text);
    else publish(text, '');
  }

  // トップ記事を差し替える。前のトップ記事は「Earlier Reports」へ
  function publish(headline, body) {
    const prev = { head: $('leadHead').dataset.text, body: $('leadBody').textContent };
    if (prev.head) {
      const a = document.createElement('article');
      a.className = 'new';
      a.innerHTML = `<h4></h4><p></p>`;
      a.querySelector('h4').textContent = prev.head;
      a.querySelector('p').textContent = prev.body;
      $('archive').prepend(a);
      while ($('archive').children.length > 40) $('archive').lastChild.remove();
    }
    edition++;
    $('edition').textContent = `Vol. I — No. ${edition}`;

    // 見出しはタイプライターのように一文字ずつ
    const h = $('leadHead');
    const p = $('leadBody');
    h.dataset.text = headline;
    p.textContent = '';
    p.classList.remove('in');
    const run = ++typing;
    let n = 0;
    const tick = () => {
      if (run !== typing) return;
      h.innerHTML = '';
      h.append(headline.slice(0, n));
      if (n < headline.length) {
        const caret = document.createElement('span');
        caret.className = 'caret';
        h.append(caret);
        n++;
        setTimeout(tick, 28);
      } else {
        p.textContent = body;
        void p.offsetWidth;
        p.classList.add('in');
      }
    };
    tick();
  }

  const word = (n) => Press.word(n);
  const ruleApi = { log, state, give: Ledger.give, stats: Ledger.stats };
  Ledger.init({ onChange: () => renderPlayers() });

  // ---------- ビジュアル設定（モノクロ・ディザは固定） ----------

  function applyVisual() {
    const o = dither.options;
    o.pixelSize = Number($('vPixel').value);
    o.contrast = Number($('vContrast').value);
    o.edges = $('vEdges').checked;
    Portraits.setLook(o);
    Ledger.repaint();
    resize();
  }
  for (const id of ['vPixel', 'vContrast', 'vEdges']) $(id).addEventListener('input', applyVisual);

  // ---------- 起動 ----------

  function reset() {
    $('archive').innerHTML = '';
    $('leadHead').dataset.text = '';
    edition = 0;
    setupDice(Number($('diceCount').value));
    setupPlayers(Number($('playerCount').value));
    publish(Press.openingHeadline(state.players), Press.openingBody(state.players));
  }

  $('rollBtn').addEventListener('click', takeTurn);
  $('zoomIn').addEventListener('click', () => animateView({ zoom: Math.min(ZOOM_MAX, view.zoom * 1.4) }, 200));
  $('zoomOut').addEventListener('click', () => animateView({ zoom: Math.max(ZOOM_MIN, view.zoom / 1.4) }, 200));
  $('viewReset').addEventListener('click', resetView);
  $('resetBtn').addEventListener('click', () => !state.busy && reset());
  $('playerCount').addEventListener('change', () => !state.busy && reset());
  $('diceCount').addEventListener('change', () => !state.busy && setupDice(Number($('diceCount').value)));
  document.addEventListener('keydown', (e) => {
    if (dialog.open || ['INPUT', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); takeTurn(); }
    if (e.code === 'KeyQ') animateView({ angle: view.angle - Math.PI / 2 });
    if (e.code === 'KeyE') animateView({ angle: view.angle + Math.PI / 2 });
    if (e.key === '+' || e.key === '=') $('zoomIn').click();
    if (e.key === '-') $('zoomOut').click();
    if (e.code === 'KeyR') resetView();
  });

  $('today').textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  state.squares = loadSquares();
  updateCamera();
  resize();
  buildBoard();
  buildLandmarks();
  reset();
  if (stage.clientWidth < 600) $('vPixel').value = 1; // 小さい画面ではドットを細かく
  applyVisual();

  window.scape = { state, view, camera, cells }; // デバッグ用
})();
