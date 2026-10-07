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
};

// ルールのフック。ルールが決まったらここに処理を書く。
// main.js から呼ばれる。log(text) で書いた文は、その手番の記事の本文に載る（英文推奨）。
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
  },
};
