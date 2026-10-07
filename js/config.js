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
  players: [
    { name: 'Circle',   shape: 'sphere', tone: 'light' },
    { name: 'Square',   shape: 'cube',   tone: 'dark' },
    { name: 'Triangle', shape: 'cone',   tone: 'light' },
    { name: 'Diamond',  shape: 'gem',    tone: 'dark' },
  ],

  // ---------- 持ち物 ----------
  // type: weapon / armor / pack / misc
  // w×h: バックパックの中で占めるマス数（回転すると入れ替わる）
  // pack は cols×rows が中身のマス数。何も背負っていないときは pockets の大きさ
  pockets: { cols: 2, rows: 2 },

  items: {
    dagger:     { name: 'Dagger',          type: 'weapon', w: 1, h: 2, atk: 1 },
    sword:      { name: 'Sword',           type: 'weapon', w: 1, h: 3, atk: 2 },
    spear:      { name: 'Spear',           type: 'weapon', w: 1, h: 4, atk: 2 },
    bow:        { name: 'Bow',             type: 'weapon', w: 1, h: 3, atk: 2 },
    axe:        { name: 'Battle Axe',      type: 'weapon', w: 2, h: 3, atk: 3 },

    jerkin:     { name: 'Leather Jerkin',  type: 'armor',  w: 2, h: 2, def: 1 },
    shield:     { name: 'Round Shield',    type: 'armor',  w: 2, h: 2, def: 1 },
    chainmail:  { name: 'Chain Mail',      type: 'armor',  w: 2, h: 3, def: 2 },
    plate:      { name: 'Plate Armour',    type: 'armor',  w: 2, h: 3, def: 3 },

    satchel:    { name: 'Satchel',         type: 'pack',   w: 2, h: 2, cols: 4, rows: 3 },
    rucksack:   { name: 'Rucksack',        type: 'pack',   w: 2, h: 3, cols: 5, rows: 4 },
    expedition: { name: 'Expedition Pack', type: 'pack',   w: 3, h: 3, cols: 6, rows: 5 },

    potion:     { name: 'Potion',          type: 'misc',   w: 1, h: 1 },
    bread:      { name: 'Bread',           type: 'misc',   w: 1, h: 1 },
    key:        { name: 'Old Key',         type: 'misc',   w: 1, h: 1 },
    pouch:      { name: 'Coin Pouch',      type: 'misc',   w: 1, h: 1 },
    gem:        { name: 'Gem',             type: 'misc',   w: 1, h: 1 },
    rope:       { name: 'Rope',            type: 'misc',   w: 1, h: 2 },
    torch:      { name: 'Torch',           type: 'misc',   w: 1, h: 2 },
    lantern:    { name: 'Lantern',         type: 'misc',   w: 1, h: 2 },
    map:        { name: 'Map',             type: 'misc',   w: 2, h: 1 },
  },

  // ゲーム開始時の持ち物
  starterKit: {
    equip: { weapon: 'dagger', armor: null, pack: 'satchel' },
    bag: ['bread', 'potion', 'torch'],
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
    // if (square.icon === '?') { if (give(player, 'gem')) log(`${player.name} found a gem.`); }
  },
};
