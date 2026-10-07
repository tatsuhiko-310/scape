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

  // 袖なしのベスト
  function vest(c, W, H, fill) {
    const m = W / 2;
    shape(c, fill, [[m - 6, 3], [m - 3, 3], [m, 7], [m + 3, 3], [m + 6, 3], [W - 3, 9],
      [W - 3, H - 3], [3, H - 3], [3, 9]]);
    c.fillStyle = g(.1);
    c.fillRect(5, 3, 3, 6); c.fillRect(W - 8, 3, 3, 6); // 肩紐
  }

  function bag(c, W, H, light) {
    shape(c, grad(c, 0, 0, W, H, light, light - .35), [[4, 7], [W - 4, 7], [W - 2, H - 3], [2, H - 3]]);
    shape(c, g(light - .15), [[4, 7], [W - 4, 7], [W - 5, H * .5], [5, H * .5]]); // ふた
    rect(c, W / 2 - 2, H * .45, 4, 4, g(.2));
    c.strokeStyle = g(0);
    c.beginPath(); c.arc(W / 2, 7, W * .22, Math.PI, 0); c.stroke(); // 持ち手
  }

  const DRAW = {
    // ---- 武器（銃は右向き） ----
    knife(c, W, H) {
      shape(c, grad(c, 0, 0, W, 0, .95, .5), [[8, 1], [11, 5], [10, 18], [6, 18], [6, 5]]);
      c.fillStyle = g(.35); c.fillRect(8, 4, 1, 13);
      rect(c, 3, 18, 10, 3, g(.2));
      rect(c, 5, 21, 6, 8, g(.3));
      c.fillStyle = g(.7); for (const y of [23, 26]) c.fillRect(6, y, 4, 1);
      rect(c, 5, 29, 6, 2, g(.15));
    },
    pistol(c, W, H) {
      rect(c, 3, 3, 25, 5, grad(c, 0, 3, 0, 8, .85, .35));                    // スライド
      c.fillStyle = g(.15); for (let x = 20; x < 26; x += 2) c.fillRect(x, 4, 1, 3);
      shape(c, grad(c, 0, 0, W, 0, .35, .15), [[17, 8], [26, 8], [24, 15], [17, 15]]); // グリップ
      c.strokeStyle = g(0); c.beginPath(); c.arc(14, 9, 3, 0, Math.PI); c.stroke(); // 用心金
    },
    shotgun(c, W, H) {
      shape(c, grad(c, 0, 4, 0, 13, .6, .3), [[1, 6], [12, 5], [15, 8], [12, 12], [2, 12]]); // 銃床
      rect(c, 14, 4, 9, 6, g(.2));
      rect(c, 23, 4, 24, 3, grad(c, 0, 4, 0, 7, .85, .4));                       // 銃身
      rect(c, 23, 7, 20, 2, g(.35));
      rect(c, 27, 7, 9, 4, grad(c, 0, 7, 0, 11, .65, .35));                      // ポンプ
    },
    smg(c, W, H) {
      rect(c, 0, 9, 9, 3, g(.3));                                                // ストック
      rect(c, 1, 9, 2, 8, g(.3));
      rect(c, 8, 7, 28, 8, grad(c, 0, 7, 0, 15, .7, .2));                        // 機関部
      c.fillStyle = g(.05); for (let x = 26; x < 35; x += 3) c.fillRect(x, 9, 2, 4); // 放熱孔
      rect(c, 36, 9, 11, 3, g(.4));                                              // 銃身
      rect(c, 18, 15, 5, 15, grad(c, 0, 0, W, 0, .45, .15));                     // 弾倉
      shape(c, g(.25), [[27, 15], [33, 15], [32, 24], [27, 24]]);                // グリップ
    },
    rifle(c, W, H) {
      shape(c, grad(c, 0, 4, 0, 13, .7, .35), [[1, 6], [16, 5], [19, 8], [17, 13], [2, 13]]); // 銃床
      rect(c, 18, 5, 14, 5, g(.2));                                              // 機関部
      rect(c, 28, 5, 20, 4, grad(c, 0, 5, 0, 9, .7, .35));                       // 被筒
      rect(c, 46, 6, 17, 2, g(.3));                                              // 銃身
      c.strokeStyle = g(0); c.beginPath(); c.moveTo(25, 5); c.lineTo(27, 2); c.stroke(); // ボルト
      circle(c, 27.5, 2, 1, g(.2), false);
      rect(c, 22, 10, 4, 3, g(.25));
      c.strokeStyle = g(.3); c.beginPath(); c.moveTo(12, 13); c.quadraticCurveTo(30, 16, 50, 9); c.stroke(); // スリング
    },

    // ---- 防具 ----
    helmet(c, W, H) {
      c.beginPath(); c.ellipse(16, 24, 15, 4, 0, 0, Math.PI * 2);
      c.fillStyle = g(.25); c.fill(); c.strokeStyle = g(0); c.stroke();          // つば
      c.beginPath(); c.arc(16, 23, 12, Math.PI, 0); c.closePath();
      c.fillStyle = grad(c, 6, 8, 26, 24, .85, .3); c.fill(); c.stroke();        // 鉢
      c.fillStyle = g(.15);
      for (let y = 13; y < 22; y += 3) for (let x = 7 + (y % 2) * 2; x < 26; x += 4) c.fillRect(x, y, 1, 1); // 網
      rect(c, 13, 26, 6, 3, g(.4));                                              // あご紐
    },
    flak(c, W, H) {
      vest(c, W, H, grad(c, 0, 0, W, H, .6, .3));
      c.strokeStyle = g(.1);
      for (let y = 16; y < H - 6; y += 6) { c.beginPath(); c.moveTo(8, y); c.lineTo(W - 8, y); c.stroke(); } // キルト
    },
    carrier(c, W, H) {
      vest(c, W, H, g(.35));
      rect(c, 8, 12, W - 16, 14, grad(c, 0, 12, 0, 26, .8, .45));                // プレート
      for (const x of [7, 13, 19]) rect(c, x, 30, 6, 9, g(.55));                 // ポーチ
    },
    shield(c, W, H) {
      shape(c, grad(c, 0, 0, W, H, .8, .25), [[4, 2], [W - 4, 2], [W - 2, 6], [W - 2, H - 4], [W / 2, H - 1], [2, H - 4], [2, 6]]);
      rect(c, 8, 9, W - 16, 4, g(.95));                                          // のぞき窓
      c.fillStyle = g(.95);
      c.fillRect(8, 22, W - 16, 2); c.fillRect(W / 2 - 1, 18, 2, 10);             // 帯
    },

    // ---- 背嚢 ----
    haversack(c, W, H) { bag(c, W, H, .7); },
    fieldpack(c, W, H) {
      bag(c, W, H, .6);
      rect(c, 6, H * .62, W - 12, 7, g(.45));
      rect(c, 5, H - 9, 4, 6, g(.3)); rect(c, W - 9, H - 9, 4, 6, g(.3));
    },
    bergen(c, W, H) {
      bag(c, W, H, .55);
      rect(c, 7, H * .58, W - 14, 8, g(.4));
      c.beginPath(); c.ellipse(W / 2, 6, W * .38, 3.5, 0, 0, Math.PI * 2);
      c.fillStyle = g(.75); c.fill(); c.strokeStyle = g(0); c.stroke();          // 丸めた毛布
      rect(c, 3, H * .3, 4, H * .5, g(.35)); rect(c, W - 7, H * .3, 4, H * .5, g(.35));
    },

    // ---- 補給品 ----
    ration(c, W, H) {
      rect(c, 2, 3, W - 4, H - 5, grad(c, 0, 3, 0, H, .85, .55));
      c.fillStyle = g(.1);
      c.fillRect(5, 6, W - 10, 1); c.fillRect(5, 9, 12, 1); c.fillRect(5, 11, 8, 1);
      rect(c, W - 11, 7, 6, 5, g(.25));                                          // 印
    },
    canteen(c, W, H) {
      rect(c, 6, 1, 4, 4, g(.2));
      c.beginPath(); c.roundRect(2, 5, 12, H - 7, 4);
      c.fillStyle = grad(c, 0, 0, W, 0, .75, .3); c.fill(); c.strokeStyle = g(0); c.stroke();
      rect(c, 2, 13, 12, 3, g(.2));                                              // ベルト
    },
    medkit(c, W, H) {
      rect(c, 1, 3, W - 2, H - 4, grad(c, 0, 3, 0, H, .55, .3));
      rect(c, 11, 1, 10, 3, g(.2));                                              // 取っ手
      c.fillStyle = g(1);
      c.fillRect(13, 6, 6, 8); c.fillRect(11, 8, 10, 4);                         // 十字
    },
    bandage(c, W, H) {
      circle(c, 8, 8, 6.5, grad(c, 0, 0, W, H, 1, .7));
      c.strokeStyle = g(.4); c.beginPath(); c.arc(8, 8, 4, 0, Math.PI * 1.6); c.stroke();
      circle(c, 8, 8, 1.5, g(.3), false);
      shape(c, g(.95), [[13, 9], [15, 14], [11, 13]]);
    },
    morphine(c, W, H) {
      c.save(); c.translate(8, 8); c.rotate(-Math.PI / 4);
      rect(c, -2, -6, 4, 9, grad(c, -2, 0, 2, 0, .95, .55));
      c.fillStyle = g(0); c.fillRect(-.5, 3, 1, 4);                               // 針
      rect(c, -3, -8, 6, 2, g(.2));
      c.restore();
    },
    ammo(c, W, H) {
      rect(c, 1, 4, W - 2, H - 5, grad(c, 0, 4, 0, H, .55, .25));
      rect(c, 1, 4, W - 2, 3, g(.35));                                           // ふた
      rect(c, 12, 1, 8, 3, g(.15));
      c.fillStyle = g(.95); c.fillRect(5, 10, 8, 1); c.fillRect(5, 12, 5, 1);
    },
    grenade(c, W, H) {
      c.beginPath(); c.ellipse(7, 10, 5, 5.5, 0, 0, Math.PI * 2);
      c.fillStyle = grad(c, 2, 5, 12, 15, .7, .2); c.fill(); c.strokeStyle = g(0); c.stroke();
      c.fillStyle = g(.05); c.fillRect(2, 9, 10, 1); c.fillRect(6, 5, 1, 10);    // 溝
      rect(c, 5, 2, 5, 3, g(.4));
      c.strokeStyle = g(0); c.beginPath(); c.moveTo(10, 3); c.lineTo(14, 8); c.stroke(); // レバー
      c.beginPath(); c.arc(12, 3, 2, 0, Math.PI * 2); c.stroke();                // ピン
    },
    gasmask(c, W, H) {
      c.beginPath(); c.ellipse(16, 14, 11, 12, 0, 0, Math.PI * 2);
      c.fillStyle = grad(c, 0, 2, 0, 26, .6, .3); c.fill(); c.strokeStyle = g(0); c.stroke();
      circle(c, 11, 11, 3.5, g(.95)); circle(c, 21, 11, 3.5, g(.95));           // 目
      rect(c, 12, 21, 8, 9, grad(c, 0, 0, W, 0, .5, .15));                       // 吸収缶
      c.fillStyle = g(.9); for (let y = 23; y < 29; y += 2) c.fillRect(13, y, 6, 1);
    },
    radio(c, W, H) {
      c.strokeStyle = g(0); c.beginPath(); c.moveTo(25, 8); c.lineTo(29, 1); c.stroke(); // アンテナ
      rect(c, 2, 8, W - 4, H - 10, grad(c, 0, 8, 0, H, .55, .25));
      circle(c, 10, 17, 4, g(.85)); c.fillStyle = g(0); c.fillRect(10, 14, 1, 3); // ダイヤル
      rect(c, 17, 12, 10, 5, g(.9));                                             // 目盛り
      c.fillStyle = g(.95); for (let x = 18; x < 27; x += 2) c.fillRect(x, 21, 1, 4); // スピーカー
    },
    binoculars(c, W, H) {
      for (const x of [3, 18]) {
        rect(c, x, 4, 11, 10, grad(c, 0, 0, 0, H, .55, .2));
        rect(c, x + 1, 1, 9, 4, g(.35));
      }
      rect(c, 13, 6, 6, 4, g(.3));
      c.fillStyle = g(.95); c.fillRect(6, 8, 4, 1); c.fillRect(21, 8, 4, 1);
    },
    flashlight(c, W, H) {
      shape(c, grad(c, 0, 0, W, 0, .9, .45), [[2, 2], [14, 2], [11, 11], [5, 11]]); // 頭
      c.fillStyle = g(1); c.fillRect(4, 3, 8, 2);
      rect(c, 5, 11, 6, H - 13, grad(c, 0, 0, W, 0, .55, .2));
      rect(c, 4, 16, 8, 3, g(.3));                                               // スイッチ
    },
    compass(c, W, H) {
      circle(c, 8, 9, 6.5, g(.35));
      circle(c, 8, 9, 5, g(.95));
      shape(c, g(0), [[8, 4], [9.5, 9], [6.5, 9]], false);
      shape(c, g(.6), [[8, 14], [9.5, 9], [6.5, 9]], false);
      rect(c, 6, 0, 4, 3, g(.3));
    },
    map(c, W, H) {
      shape(c, g(.9), [[2, 2], [W - 2, 3], [W - 3, H - 2], [3, H - 3]]);
      c.strokeStyle = g(.4);
      c.beginPath(); c.moveTo(W / 3, 2); c.lineTo(W / 3, H - 2); c.moveTo(W * 2 / 3, 3); c.lineTo(W * 2 / 3, H - 3); c.stroke();
      c.strokeStyle = g(0);
      c.beginPath(); c.moveTo(5, 11); c.lineTo(12, 7); c.lineTo(18, 10); c.stroke(); // 進路
      c.beginPath(); c.moveTo(20, 5); c.lineTo(25, 10); c.moveTo(25, 5); c.lineTo(20, 10); c.stroke();
    },
    dogtags(c, W, H) {
      c.strokeStyle = g(.3); c.beginPath(); c.moveTo(2, 1); c.lineTo(7, 6); c.moveTo(14, 1); c.lineTo(10, 5); c.stroke(); // 鎖
      c.save(); c.translate(7, 10); c.rotate(-.2);
      c.beginPath(); c.roundRect(-4, -4, 8, 6, 2); c.fillStyle = g(.85); c.fill(); c.strokeStyle = g(0); c.stroke();
      c.restore();
      c.save(); c.translate(10, 11); c.rotate(.25);
      c.beginPath(); c.roundRect(-4, -3, 8, 6, 2); c.fillStyle = grad(c, -4, 0, 4, 0, .95, .55); c.fill(); c.stroke();
      c.fillStyle = g(.2); c.fillRect(-2, -1, 4, 1); c.fillRect(-2, 1, 3, 1);
      c.restore();
    },
    cigarettes(c, W, H) {
      rect(c, 3, 4, 10, 11, grad(c, 0, 0, W, 0, .9, .5));
      circle(c, 8, 10, 2.5, g(.2));                                              // 印
      for (const x of [4, 7, 10]) rect(c, x, 1, 2, 4, g(.97));
      c.fillStyle = g(.45); c.fillRect(4, 1, 2, 1);
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
    (DRAW[id] || DRAW.compass)(c, W, H);
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

  return { url, BAYER, INK, PAPER };
})();
