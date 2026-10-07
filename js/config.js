// ゲームの「データ」はここにまとめる。ルールが決まってきたらここを育てていく。

const CONFIG = {
  squareCount: 30,

  // マスの色パレット（編集ダイアログの選択肢にもなる）
  palette: {
    none:   { label: 'なし',  color: '#f4efe6' },
    red:    { label: '赤',    color: '#f3b6a8' },
    orange: { label: '橙',    color: '#f6d29a' },
    green:  { label: '緑',    color: '#b9dfb0' },
    blue:   { label: '青',    color: '#a9cdea' },
    purple: { label: '紫',    color: '#cdb8e6' },
    gray:   { label: '灰',    color: '#cfcac2' },
  },

  // 初期のマス。index 0 がスタート。足りない分は空白マスになる。
  // type は将来ルールを書くときのフック用（今は見た目だけ）。
  defaultSquares: {
    0:  { name: 'START', icon: '🚩', color: 'orange', type: 'start' },
    5:  { name: '',      icon: '★',  color: 'blue' },
    8:  { name: '',      icon: '',   color: 'gray',  type: 'corner' },
    10: { name: '',      icon: '?',  color: 'green' },
    15: { name: '',      icon: '★',  color: 'red',   type: 'corner' },
    20: { name: '',      icon: '?',  color: 'green' },
    23: { name: '',      icon: '',   color: 'gray',  type: 'corner' },
    25: { name: '',      icon: '★',  color: 'purple' },
  },

  players: [
    { name: 'あか',   color: '#e2504c' },
    { name: 'あお',   color: '#3d7fd9' },
    { name: 'みどり', color: '#3aa564' },
    { name: 'きいろ', color: '#e6b422' },
  ],
};

// ルールのフック。ルールが決まったらここに処理を書く。
// main.js から呼ばれる。log(text) で中央のログに出せる。
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
