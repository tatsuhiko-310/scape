// 3D サイコロ。new Die(parentEl) で生成し、await die.roll() で 1〜6 を返す。

class Die {
  // 各目を手前に向けるための回転（面の配置は向かい合う目の和が7）
  static FACE_ROTATION = {
    1: { x: 0,   y: 0 },
    2: { x: -90, y: 0 },
    3: { x: 0,   y: -90 },
    4: { x: 0,   y: 90 },
    5: { x: 90,  y: 0 },
    6: { x: 0,   y: 180 },
  };

  // 3×3 グリッド上の目の位置
  static PIPS = {
    1: [5],
    2: [3, 7],
    3: [3, 5, 7],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9],
  };

  constructor(parent) {
    this.value = 1;
    this.turns = 0;

    this.scene = document.createElement('div');
    this.scene.className = 'die-scene';
    this.cube = document.createElement('div');
    this.cube.className = 'die';

    const faces = { 1: 'front', 6: 'back', 3: 'right', 4: 'left', 2: 'top', 5: 'bottom' };
    for (const [n, side] of Object.entries(faces)) {
      const face = document.createElement('div');
      face.className = `face face-${side}` + (n === '1' ? ' one' : '');
      for (let i = 1; i <= 9; i++) {
        const cell = document.createElement('span');
        if (Die.PIPS[n].includes(i)) cell.className = 'pip';
        face.appendChild(cell);
      }
      this.cube.appendChild(face);
    }
    this.scene.appendChild(this.cube);
    parent.appendChild(this.scene);
    this.show(1, false);
  }

  show(value, animate = true) {
    const r = Die.FACE_ROTATION[value];
    // 毎回 2 回転ずつ足して、常に同じ向きに勢いよく転がるように見せる
    if (animate) this.turns += 2;
    const extra = this.turns * 360;
    this.cube.style.transition = animate ? '' : 'none';
    this.cube.style.transform = `rotateX(${r.x + extra}deg) rotateY(${r.y + extra}deg)`;
    this.value = value;
  }

  roll() {
    const value = 1 + Math.floor(Math.random() * 6);
    this.scene.classList.remove('bounce');
    void this.scene.offsetWidth; // アニメーション再始動
    this.scene.classList.add('bounce');
    this.show(value);
    return new Promise((resolve) => setTimeout(() => resolve(value), 900));
  }
}
