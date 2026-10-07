// プレイヤーボードの背景写真。グレーの写真を読み込み、ボードの大きさに合わせて
// Bayer ディザで ink / paper の 2 値にする（ドットの大きさ・コントラストはボードと共通）。

const Portraits = (() => {
  const { BAYER, INK, PAPER } = ItemArt;
  const look = { pixelSize: 2, contrast: 1.35 };
  const images = new Map();
  const cache = new Map();

  function load(src) {
    if (!images.has(src)) {
      images.set(src, new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
      }));
    }
    return images.get(src);
  }

  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // 頭頂部を topY、顎を chinY（どちらもドット単位）に合わせて写真を置く。
  // 写真は下に向かって紙の色へ溶かす（持ち物のマス目を読みやすくするため）
  function draw(img, W, H, { head = { top: 0.05, chin: 0.4, x: 0.5 }, exposure = 0 }, wash, topY, chinY) {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const c = cv.getContext('2d');
    const PH = Math.min(H, chinY * 1.9);
    const s = (chinY - topY) / ((head.chin - head.top) * img.height);
    const iw = img.width * s, ih = img.height * s;
    const dx = W / 2 - head.x * iw;
    const dy = topY - head.top * ih;
    c.fillStyle = '#fff';
    c.fillRect(0, 0, W, H);
    c.drawImage(img, dx, dy, iw, ih);

    const data = c.getImageData(0, 0, W, H);
    const d = data.data;
    for (let y = 0; y < H; y++) {
      const fade = Math.max(smooth(PH * 0.55, PH, y), y >= ih + dy ? 1 : 0);
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        let l = d[i] / 255;
        // 写真は少し柔らかめ・明るめに（顔が潰れないように）
        l = Math.pow(l, 0.8);
        l = (l - 0.5) * (1 + (look.contrast - 1) * 0.5) + 0.5 + 0.04 + exposure;
        l = l + (1 - l) * Math.max(fade, wash);
        const col = l > BAYER[y % 8][x % 8] ? PAPER : INK;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    }
    c.putImageData(data, 0, 0);
    return cv.toDataURL();
  }

  // el の背景（CSS 変数 --portrait）に敷く
  // top / chin: 頭頂部と顎を置く高さ（el の上端からの CSS px）
  async function apply(el, player, { wash = 0, top = 8, chin = 200 } = {}) {
    if (!player?.portrait) return;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    const px = look.pixelSize;
    const W = Math.ceil(w / px), H = Math.ceil(h / px);
    const topY = top / px, chinY = chin / px;
    const key = [player.portrait, W, H, look.contrast, wash, Math.round(topY), Math.round(chinY), JSON.stringify(player.head), player.exposure].join(':');
    let url = cache.get(key);
    if (!url) {
      try {
        url = draw(await load(player.portrait), W, H, player, wash, topY, chinY);
      } catch (_) {
        return; // 画像が読めないときは背景なし
      }
      if (cache.size > 64) cache.clear();
      cache.set(key, url);
    }
    el.style.setProperty('--portrait', `url(${url})`);
    el.classList.add('has-portrait');
  }

  function setLook({ pixelSize, contrast }) {
    look.pixelSize = pixelSize;
    look.contrast = contrast;
  }

  return { apply, setLook };
})();
