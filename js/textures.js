// ドット絵風のテクスチャを canvas で描く。

const Textures = (() => {
  const PX = 16;     // ドット絵の解像度
  const SIZE = 128;  // 最終テクスチャの解像度（文字を綺麗に書くため）

  function rng(seed) {
    let s = (seed * 9301 + 49297) % 233280 || 1;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const f = (c) => Math.max(0, Math.min(255, Math.round(c + 255 * amt)));
    const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255);
    return `rgb(${r},${g},${b})`;
  }

  const patterns = {
    grass(g, base, rand) {
      for (let i = 0; i < 40; i++) dot(g, rand, shade(base, rand() < .5 ? -.07 : .07));
      for (let i = 0; i < 5; i++) {               // 草の房
        const x = 1 + Math.floor(rand() * 13), y = 2 + Math.floor(rand() * 12);
        g.fillStyle = shade(base, -.16);
        g.fillRect(x, y, 1, 1); g.fillRect(x + 2, y, 1, 1); g.fillRect(x + 1, y + 1, 1, 1);
      }
    },
    sand(g, base, rand) {
      for (let i = 0; i < 30; i++) dot(g, rand, shade(base, rand() < .5 ? -.08 : .06));
      g.fillStyle = shade(base, .1);               // 風紋
      for (let y = 3; y < PX; y += 5) {
        const off = Math.floor(rand() * 4);
        for (let x = off; x < PX; x += 1) if ((x + y) % 7 < 4) g.fillRect(x, y + ((x >> 2) & 1), 1, 1);
      }
    },
    water(g, base) {
      g.fillStyle = shade(base, .14);              // 波紋
      for (const r of [2, 5, 7.5]) {
        for (let a = 0; a < Math.PI * 2; a += 0.12) {
          g.fillRect(Math.round(7.5 + Math.cos(a) * r), Math.round(7.5 + Math.sin(a) * r), 1, 1);
        }
      }
    },
    lava(g, base, rand) {
      for (let i = 0; i < 20; i++) dot(g, rand, '#f08a2c');
      g.fillStyle = shade(base, -.22);             // ひび割れ
      for (let k = 0; k < 3; k++) {
        let x = Math.floor(rand() * PX), y = Math.floor(rand() * PX);
        for (let s = 0; s < 9; s++) {
          g.fillRect(x, y, 1, 1);
          x += rand() < .5 ? 1 : 0; y += rand() < .6 ? 1 : -1;
        }
      }
    },
    stone(g, base) {
      g.fillStyle = shade(base, -.14);             // レンガ目地
      for (let y = 0; y < PX; y += 4) {
        g.fillRect(0, y, PX, 1);
        for (let x = (y / 4) % 2 ? 2 : 6; x < PX; x += 8) g.fillRect(x, y, 1, 4);
      }
    },
  };

  function dot(g, rand, color) {
    g.fillStyle = color;
    g.fillRect(Math.floor(rand() * PX), Math.floor(rand() * PX), 1, 1);
  }

  function toTexture(canvas) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.anisotropy = 4;
    return tex;
  }

  // マス上面のテクスチャ
  function tile(terrainKey, index, sq) {
    const terrain = CONFIG.terrains[terrainKey] || CONFIG.terrains.grass;
    const small = document.createElement('canvas');
    small.width = small.height = PX;
    const g = small.getContext('2d');
    g.fillStyle = terrain.base;
    g.fillRect(0, 0, PX, PX);
    (patterns[terrainKey] || patterns.grass)(g, terrain.base, rng(index + 7));
    g.fillStyle = shade(terrain.base, .12);        // 縁のハイライト
    g.fillRect(0, 0, PX, 1); g.fillRect(0, 0, 1, PX);

    const big = document.createElement('canvas');
    big.width = big.height = SIZE;
    const c = big.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(small, 0, 0, SIZE, SIZE);

    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    const label = (text, x, y, font, lw) => {
      c.font = font;
      c.lineWidth = lw;
      c.strokeStyle = 'rgba(0,0,0,.55)';
      c.strokeText(text, x, y);
      c.fillStyle = '#fff';
      c.fillText(text, x, y);
    };
    label(String(index), 20, 18, 'bold 24px sans-serif', 5);
    if (sq.icon) label(sq.icon, SIZE / 2, sq.name ? 56 : SIZE / 2, 'bold 60px sans-serif', 6);
    if (sq.name) label(sq.name, SIZE / 2, sq.icon ? 104 : SIZE / 2, 'bold 24px sans-serif', 5);
    const tex = toTexture(big);
    // 上面の UV は奥行きが逆向きなので、文字が正しく読めるよう 180° 回す
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI;
    return tex;
  }

  // サイコロの目
  const PIPS = {
    1: [[.5, .5]],
    2: [[.27, .27], [.73, .73]],
    3: [[.25, .25], [.5, .5], [.75, .75]],
    4: [[.27, .27], [.73, .27], [.27, .73], [.73, .73]],
    5: [[.25, .25], [.75, .25], [.5, .5], [.25, .75], [.75, .75]],
    6: [[.27, .23], [.73, .23], [.27, .5], [.73, .5], [.27, .77], [.73, .77]],
  };

  function dieFace(n) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = SIZE;
    const c = cv.getContext('2d');
    c.fillStyle = '#fffdf6';
    c.fillRect(0, 0, SIZE, SIZE);
    c.strokeStyle = '#e4dccb';
    c.lineWidth = 8;
    c.strokeRect(0, 0, SIZE, SIZE);
    c.fillStyle = n === 1 ? '#d9473b' : '#3a3128';
    const r = n === 1 ? 20 : 11;
    for (const [x, y] of PIPS[n]) {
      c.beginPath();
      c.arc(x * SIZE, y * SIZE, r, 0, Math.PI * 2);
      c.fill();
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  return { tile, dieFace, shade };
})();
