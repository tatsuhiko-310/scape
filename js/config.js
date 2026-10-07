// ゲームの「データ」はここにまとめる。ルールが決まってきたらここを育てていく。

const CONFIG = {
  // 一周のコース。START から一歩ずつの向き（E/W/S/N）と歩数。
  // 合計 30 歩で START に戻ってくる形にしておくこと。
  path: [['E', 6], ['S', 2], ['E', 2], ['S', 5], ['W', 4], ['N', 1], ['W', 4], ['N', 6]],

  // 地形（マスの見た目）。base = 地面の色, side = 側面の色
  terrains: {
    grass: { label: '草原', base: '#58b947', side: '#3c7d2f' },
    sand:  { label: '砂漠', base: '#dcb54a', side: '#9c7a26' },
    water: { label: '水辺', base: '#3d8fe0', side: '#245e9e' },
    lava:  { label: '溶岩', base: '#d9472b', side: '#8a2716' },
    stone: { label: '石畳', base: '#b9b3a8', side: '#7a7368' },
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

  players: [
    { name: 'あか',   color: '#e2504c' },
    { name: 'あお',   color: '#3d7fd9' },
    { name: 'みどり', color: '#3aa564' },
    { name: 'きいろ', color: '#e6b422' },
  ],
};

// ルールのフック。ルールが決まったらここに処理を書く。
// main.js から呼ばれる。log(text) でログに出せる。
const RULES = {
  // スタートを通過/到着したとき
  onPassStart(player, { log }) {
    log(`${player.name} が一周しました（${player.laps}周目）`);
  },

  // 止まったマスで
  onLand(player, square, { log }) {
    if (square.name || square.icon) {
      log(`${player.name} は「${square.icon} ${square.name}」に止まった`);
    }
  },
};
