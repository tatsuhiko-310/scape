// 持ち物の挿絵。canvas に灰色で描いてから Bayer ディザで ink / paper の 2 値にする。
// 1 マス = 16 ドット。表示は CSS で拡大（image-rendering: pixelated）。

const ItemArt = (() => {
  const S = 16;
  const INK = [0x1c, 0x1b, 0x1a];
  const PAPER = [0xf2, 0xf0, 0xea];

  const BAYER = (() => {
    let m = [[0]];
    while (m.length < 8) {
      const s = m.length;
      m = Array.from({ length: s * 2 }, (_, y) => Array.from({ length: s * 2 }, (_, x) =>
        4 * m[y % s][x % s] + [[0, 2], [3, 1]][Math.floor(y / s)][Math.floor(x / s)]));
    }
    return m.map((row) => row.map((v) => (v + 0.5) / 64));
  })();

  // 0 = 黒, 1 = 白
  const g = (l) => { const v = Math.round(l * 255); return `rgb(${v},${v},${v})`; };

  function grad(c, x0, y0, x1, y1, a, b) {
    const gr = c.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, g(a));
    gr.addColorStop(1, g(b));
    return gr;
  }

  function shape(c, fill, pts, stroke = true) {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) { c.strokeStyle = g(0); c.lineWidth = 1; c.stroke(); }
  }

  function circle(c, x, y, r, fill, stroke = true) {
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    if (stroke) { c.strokeStyle = g(0); c.lineWidth = 1; c.stroke(); }
  }

  function rect(c, x, y, w, h, fill, stroke = true) {
    c.fillStyle = fill;
    c.fillRect(x, y, w, h);
    if (stroke) { c.strokeStyle = g(0); c.lineWidth = 1; c.strokeRect(x + .5, y + .5, w - 1, h - 1); }
  }

  function tunic(c, W, H, fill) {
    const m = W / 2;
    shape(c, fill, [[m - 5, 2], [m + 5, 2], [W - 3, 7], [W - 2, H * .45], [W - 7, H * .45],
      [W - 7, H - 3], [7, H - 3], [7, H * .45], [2, H * .45], [3, 7]]);
    c.fillStyle = g(0);
    c.fillRect(m - 2, 2, 4, 4); // 襟
  }

  function bag(c, W, H, light) {
    shape(c, grad(c, 0, 0, W, H, light, light - .35), [[4, 7], [W - 4, 7], [W - 2, H - 3], [2, H - 3]]);
    shape(c, g(light - .15), [[4, 7], [W - 4, 7], [W - 5, H * .5], [5, H * .5]]); // ふた
    rect(c, W / 2 - 2, H * .45, 4, 4, g(.2));
    c.strokeStyle = g(0);
    c.beginPath(); c.arc(W / 2, 7, W * .22, Math.PI, 0); c.stroke(); // 持ち手
  }

  const DRAW = {
    dagger(c, W, H) {
      shape(c, grad(c, 0, 0, W, 0, .95, .55), [[8, 1], [11, 6], [10, 20], [6, 20], [5, 6]]);
      rect(c, 2, 20, 12, 3, g(.25));
      rect(c, 6, 23, 4, 6, g(.35));
      circle(c, 8, 30, 1.5, g(.2));
    },
    sword(c, W, H) {
      shape(c, grad(c, 0, 0, W, 0, .98, .5), [[8, 1], [11, 5], [11, 33], [5, 33], [5, 5]]);
      c.fillStyle = g(.4); c.fillRect(8, 5, 1, 27);
      rect(c, 1, 33, 14, 3, g(.2));
      rect(c, 6, 36, 4, 8, g(.3));
      circle(c, 8, 45.5, 2, g(.15));
    },
    spear(c, W, H) {
      rect(c, 7, 12, 3, H - 14, grad(c, 0, 0, W, 0, .7, .35));
      shape(c, grad(c, 0, 0, W, 0, .98, .55), [[8.5, 1], [12, 8], [8.5, 13], [5, 8]]);
      rect(c, 6, 13, 5, 2, g(.2));
    },
    bow(c, W, H) {
      c.strokeStyle = g(.25); c.lineWidth = 3;
      c.beginPath(); c.moveTo(5, 2); c.quadraticCurveTo(17, H / 2, 5, H - 2); c.stroke();
      c.strokeStyle = g(0); c.lineWidth = 1;
      c.beginPath(); c.moveTo(4, 2); c.lineTo(4, H - 2); c.stroke();
      rect(c, 9, H / 2 - 3, 4, 6, g(.5));
    },
    axe(c, W, H) {
      rect(c, 19, 3, 4, H - 5, grad(c, 0, 0, W, 0, .65, .3));
      shape(c, grad(c, 0, 0, W, 0, .95, .5), [[19, 6], [8, 3], [3, 12], [5, 22], [10, 24], [19, 20]]);
      shape(c, g(.75), [[23, 8], [29, 6], [29, 16], [23, 14]]);
    },
    jerkin(c, W, H) {
      tunic(c, W, H, grad(c, 0, 0, W, H, .65, .35));
      c.fillStyle = g(.1);
      for (let y = 10; y < H - 4; y += 4) c.fillRect(W / 2 - .5, y, 1, 2);
    },
    shield(c, W, H) {
      circle(c, W / 2, H / 2, W / 2 - 2, grad(c, 0, 0, W, H, .9, .35));
      circle(c, W / 2, H / 2, W / 2 - 6, grad(c, 0, 0, W, H, .45, .75));
      circle(c, W / 2, H / 2, 3, g(.95));
    },
    chainmail(c, W, H) {
      tunic(c, W, H, g(.75));
      c.fillStyle = g(.35);
      for (let y = 8; y < H - 4; y += 2) for (let x = 3 + (y % 4 ? 1 : 0); x < W - 3; x += 2) c.fillRect(x, y, 1, 1);
      tunic(c, W, H, 'rgba(0,0,0,0)');
    },
    plate(c, W, H) {
      tunic(c, W, H, grad(c, 0, 0, W, 0, .95, .3));
      c.strokeStyle = g(0);
      for (const y of [H * .45, H * .62, H * .79]) { c.beginPath(); c.moveTo(8, y); c.lineTo(W - 8, y); c.stroke(); }
    },
    satchel(c, W, H) { bag(c, W, H, .8); },
    rucksack(c, W, H) {
      bag(c, W, H, .7);
      rect(c, 6, H * .62, W - 12, 6, g(.5));
    },
    expedition(c, W, H) {
      bag(c, W, H, .6);
      rect(c, 7, H * .58, W - 14, 7, g(.4));
      c.strokeStyle = g(0);
      c.beginPath(); c.ellipse(W / 2, 6, W * .35, 3, 0, 0, Math.PI * 2); c.stroke(); // 寝袋
    },
    potion(c, W, H) {
      circle(c, 8, 10, 5.5, grad(c, 0, 4, 0, 16, .9, .15));
      rect(c, 6, 1, 4, 5, g(.85));
      c.fillStyle = g(1); c.fillRect(5, 7, 2, 2);
    },
    bread(c, W, H) {
      c.beginPath(); c.ellipse(8, 9, 7, 5, -.3, 0, Math.PI * 2);
      c.fillStyle = grad(c, 0, 4, 0, 14, .85, .45); c.fill(); c.strokeStyle = g(0); c.stroke();
      c.beginPath(); for (const x of [5, 8, 11]) { c.moveTo(x - 1, 7); c.lineTo(x + 1, 10); } c.stroke();
    },
    key(c, W, H) {
      circle(c, 5, 5, 3.5, g(.6));
      circle(c, 5, 5, 1.2, g(1), false);
      c.strokeStyle = g(.15); c.lineWidth = 2;
      c.beginPath(); c.moveTo(7.5, 7.5); c.lineTo(14, 14); c.stroke();
      c.lineWidth = 1; c.beginPath(); c.moveTo(11, 11); c.lineTo(13, 9); c.moveTo(13, 13); c.lineTo(15, 11); c.stroke();
    },
    pouch(c, W, H) {
      shape(c, grad(c, 0, 4, 0, 16, .7, .3), [[5, 5], [11, 5], [14, 12], [12, 15], [4, 15], [2, 12]]);
      rect(c, 5, 3, 6, 2, g(.2));
      c.fillStyle = g(1); c.fillRect(6, 9, 3, 3);
    },
    gem(c, W, H) {
      shape(c, g(.85), [[4, 4], [12, 4], [15, 7], [8, 15], [1, 7]]);
      shape(c, g(.5), [[1, 7], [15, 7], [8, 15]]);
      shape(c, g(1), [[6, 4], [10, 4], [8, 7]], false);
    },
    rope(c, W, H) {
      for (const y of [9, 17, 25]) {
        c.beginPath(); c.ellipse(8, y, 6, 4, 0, 0, Math.PI * 2);
        c.lineWidth = 3; c.strokeStyle = g(.55); c.stroke();
        c.lineWidth = 1; c.strokeStyle = g(0); c.stroke();
      }
    },
    torch(c, W, H) {
      rect(c, 6, 12, 4, H - 13, grad(c, 0, 0, W, 0, .6, .25));
      shape(c, grad(c, 0, 2, 0, 12, 1, .7), [[8, 1], [12, 7], [11, 12], [5, 12], [4, 7]]);
    },
    lantern(c, W, H) {
      c.strokeStyle = g(0); c.beginPath(); c.arc(8, 6, 4, Math.PI, 0); c.stroke();
      rect(c, 3, 6, 10, 3, g(.25));
      rect(c, 4, 9, 8, 15, grad(c, 0, 9, 0, 24, 1, .7));
      c.fillStyle = g(.2); c.fillRect(7, 9, 2, 15);
      rect(c, 3, 24, 10, 4, g(.25));
    },
    map(c, W, H) {
      shape(c, g(.9), [[2, 2], [W - 2, 3], [W - 3, H - 2], [3, H - 3]]);
      c.strokeStyle = g(.4);
      c.beginPath(); c.moveTo(W / 3, 2); c.lineTo(W / 3, H - 2); c.moveTo(W * 2 / 3, 3); c.lineTo(W * 2 / 3, H - 3); c.stroke();
      c.strokeStyle = g(0);
      c.beginPath(); c.moveTo(20, 5); c.lineTo(25, 10); c.moveTo(25, 5); c.lineTo(20, 10); c.stroke();
    },
  };

  const cache = new Map();

  // id の挿絵を dataURL で返す。rot = true なら 90° 回転した向き
  function url(id, rot = false) {
    const key = `${id}:${rot}`;
    if (cache.has(key)) return cache.get(key);
    const it = CONFIG.items[id];
    const W = it.w * S, H = it.h * S;
    const cv = document.createElement('canvas');
    cv.width = rot ? H : W;
    cv.height = rot ? W : H;
    const c = cv.getContext('2d');
    if (rot) { c.translate(H, 0); c.rotate(Math.PI / 2); }
    (DRAW[id] || DRAW.gem)(c, W, H);
    ditherCanvas(cv);
    const out = cv.toDataURL();
    cache.set(key, out);
    return out;
  }

  function ditherCanvas(cv) {
    const c = cv.getContext('2d');
    const img = c.getImageData(0, 0, cv.width, cv.height);
    const d = img.data;
    for (let y = 0; y < cv.height; y++) {
      for (let x = 0; x < cv.width; x++) {
        const i = (y * cv.width + x) * 4;
        if (d[i + 3] < 110) { d[i + 3] = 0; continue; }
        const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        const col = l > BAYER[y % 8][x % 8] ? PAPER : INK;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
  }

  return { url };
})();
