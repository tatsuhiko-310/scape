// ゲームの「データ」はここにまとめる。ルールが決まってきたらここを育てていく。

const CONFIG = {
  // 一周のコース。START から一歩ずつの向き（E/W/S/N）と歩数。
  // 合計 30 歩で START に戻ってくる形にしておくこと。
  path: [['E', 6], ['S', 2], ['E', 2], ['S', 5], ['W', 4], ['N', 1], ['W', 4], ['N', 6]],

  // 地形（マスの見た目）。base = 地面の色, side = 側面の色
  terrains: {
    grass: { label: 'Meadow', base: '#4f9a3c', side: '#2c5a22' },
    sand:  { label: 'Desert', base: '#e3c766', side: '#9c7a26' },
    water: { label: 'Waters', base: '#3a73b8', side: '#1d406e' },
    lava:  { label: 'Lava Fields', base: '#b8361f', side: '#5e1a0e' },
    stone: { label: 'Cobblestone', base: '#cfcac0', side: '#7a7368' },
  },

  // 範囲ごとの地形。[開始, 終了(含む), 地形]
  zones: [
    [0, 0, 'stone'],
    [1, 7, 'grass'],
    [8, 14, 'sand'],
    [15, 15, 'stone'],
    [16, 22, 'water'],
    [23, 29, 'lava'],
  ],

  // 個別のマス（名前・アイコン）。type は将来ルールを書くときのフック用。
  defaultSquares: {
    0:  { name: 'START', icon: '', type: 'start' },
    5:  { icon: '★' },
    10: { icon: '?' },
    15: { name: 'CASTLE', icon: '', type: 'castle' },
    20: { icon: '?' },
    25: { icon: '★' },
  },

  // コースの外に置く建物 { at: そばに置くマス, kind }
  landmarks: [
    { at: 0,  kind: 'tower' },
    { at: 15, kind: 'castle' },
  ],

  // shape: 頭の形 / tone: コマの色（light=白, dark=黒）。表示は常にモノクロ
  // portrait: プレイヤーボードの背景写真（実行時にディザをかける）
  // head: 写真の中の頭の位置（画像の高さ・幅に対する割合）。top = 頭頂部, chin = 顎, x = 顔の中心
  //   → どのボードでも頭頂部は名札の高さ、顎は武器枠のすぐ上にそろう
  // exposure: 明るさの足し引き（暗い写真はプラスに）
  // assets/portraits/p3.jpg は予備
  players: [
    { name: 'Circle',   shape: 'sphere', tone: 'light', portrait: 'assets/portraits/p1.jpg', head: { top: 0.02, chin: 0.41, x: 0.50 } },
    { name: 'Square',   shape: 'cube',   tone: 'dark',  portrait: 'assets/portraits/p2.jpg', head: { top: 0.02, chin: 0.46, x: 0.46 }, exposure: -0.12 },
    { name: 'Triangle', shape: 'cone',   tone: 'light', portrait: 'assets/portraits/p4.jpg', head: { top: 0.03, chin: 0.34, x: 0.50 } },
    { name: 'Diamond',  shape: 'gem',    tone: 'dark',  portrait: 'assets/portraits/p5.jpg', head: { top: 0.04, chin: 0.36, x: 0.46 } },
  ],

  // ---------- 持ち物 ----------
  // type: weapon / armor / pack / misc
  // w×h: バックパックの中で占めるマス数（回転すると入れ替わる）
  // pack は cols×rows が中身のマス数。何も背負っていないときは pockets の大きさ
  pockets: { cols: 2, rows: 2 },

  items: {
    knife:      { name: 'Trench Knife',     type: 'weapon', w: 1, h: 2, atk: 1 },
    pistol:     { name: 'Service Pistol',   type: 'weapon', w: 2, h: 1, atk: 1 },
    shotgun:    { name: 'Trench Shotgun',   type: 'weapon', w: 3, h: 1, atk: 2 },
    smg:        { name: 'Submachine Gun',   type: 'weapon', w: 3, h: 2, atk: 2 },
    rifle:      { name: 'Bolt-Action Rifle', type: 'weapon', w: 4, h: 1, atk: 3 },

    helmet:     { name: 'Steel Helmet',     type: 'armor',  w: 2, h: 2, def: 1 },
    flak:       { name: 'Flak Vest',        type: 'armor',  w: 2, h: 3, def: 2 },
    carrier:    { name: 'Plate Carrier',    type: 'armor',  w: 2, h: 3, def: 3 },
    shield:     { name: 'Ballistic Shield', type: 'armor',  w: 2, h: 3, def: 2 },

    haversack:  { name: 'Haversack',        type: 'pack',   w: 2, h: 2, cols: 4, rows: 3 },
    fieldpack:  { name: 'Field Pack',       type: 'pack',   w: 2, h: 3, cols: 5, rows: 4 },
    bergen:     { name: 'Bergen Rucksack',  type: 'pack',   w: 3, h: 3, cols: 6, rows: 5 },

    ration:     { name: 'Field Ration',     type: 'misc',   w: 2, h: 1 },
    canteen:    { name: 'Canteen',          type: 'misc',   w: 1, h: 2 },
    medkit:     { name: 'First Aid Kit',    type: 'misc',   w: 2, h: 1 },
    bandage:    { name: 'Bandage',          type: 'misc',   w: 1, h: 1 },
    morphine:   { name: 'Morphine Syrette', type: 'misc',   w: 1, h: 1 },
    ammo:       { name: 'Ammunition Box',   type: 'misc',   w: 2, h: 1 },
    grenade:    { name: 'Hand Grenade',     type: 'misc',   w: 1, h: 1 },
    gasmask:    { name: 'Gas Mask',         type: 'misc',   w: 2, h: 2 },
    radio:      { name: 'Field Radio',      type: 'misc',   w: 2, h: 2 },
    binoculars: { name: 'Binoculars',       type: 'misc',   w: 2, h: 1 },
    flashlight: { name: 'Flashlight',       type: 'misc',   w: 1, h: 2 },
    compass:    { name: 'Compass',          type: 'misc',   w: 1, h: 1 },
    map:        { name: 'Field Map',        type: 'misc',   w: 2, h: 1 },
    dogtags:    { name: 'Dog Tags',         type: 'misc',   w: 1, h: 1 },
    cigarettes: { name: 'Cigarettes',       type: 'misc',   w: 1, h: 1 },
  },

  // ゲーム開始時の持ち物
  starterKit: {
    equip: { weapon: 'pistol', armor: 'helmet', pack: 'haversack' },
    bag: ['ration', 'canteen', 'bandage', 'dogtags'],
  },
};

// ルールのフック。ルールが決まったらここに処理を書く。
// main.js から呼ばれる。log(text) で書いた文は、その手番の記事の本文に載る（英文推奨）。
// give(player, itemId) で持ち物を渡せる（入らなければ false）。stats(player) で { atk, def } が取れる。
const RULES = {
  // スタートを通過/到着したとき
  onPassStart(player, { log }) {
    log(`${player.name} passed the starting tower and begins lap ${player.laps + 1}.`);
  },

  // 止まったマスで
  onLand(player, square, { log }) {
    if (square.name || square.icon) {
      log(`Witnesses report the square bore the mark "${[square.icon, square.name].filter(Boolean).join(' ')}".`);
    }
    // 例：「?」のマスで何か拾う
    // if (square.icon === '?') { if (give(player, 'medkit')) log(`${player.name} recovered a first aid kit.`); }
  },
};
