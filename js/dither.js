// モノクロ・ディザリングのポストエフェクト（このプロジェクトの表現の核。外さないこと）。
// シーンを低解像度で描いてから、明るさを Bayer 行列で 白/黒 の 2 値に落とす。
// 深度の段差から輪郭線も引く。

class Dither {
  constructor(renderer) {
    this.renderer = renderer;
    this.options = {
      pixelSize: 2,     // 1ドットの大きさ（CSS px）
      contrast: 1.35,
      brightness: -0.02,
      edges: true,
    };

    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthTexture: new THREE.DepthTexture(1, 1),
    });

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.target.texture },
        tDepth: { value: this.target.depthTexture },
        tBayer: { value: Dither.bayerTexture(8) },
        res: { value: new THREE.Vector2(1, 1) },
        contrast: { value: 1 },
        brightness: { value: 0 },
        edges: { value: 1 },
        edgeThreshold: { value: 0.003 },
        vignette: { value: 0.55 },
        ink: { value: new THREE.Color(0x1c / 255, 0x1b / 255, 0x1a / 255) },
        paper: { value: new THREE.Color(0xf2 / 255, 0xf0 / 255, 0xea / 255) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor, tDepth, tBayer;
        uniform vec2 res;
        uniform float contrast, brightness, edges, edgeThreshold, vignette;
        uniform vec3 ink, paper;
        varying vec2 vUv;

        void main() {
          vec2 px = floor(vUv * res);
          vec2 uv = (px + 0.5) / res;
          vec4 c = texture2D(tColor, uv);

          // 何も描かれていない所は、中心が明るいビネットの背景
          vec2 q = (uv - vec2(0.5, 0.55)) * vec2(res.x / res.y, 1.0);
          float bg = 1.0 - vignette * pow(clamp(length(q) * 1.1, 0.0, 1.0), 1.8);
          vec3 rgb = pow(max(c.rgb, 0.0), vec3(1.0 / 2.2)) + vec3(bg) * (1.0 - c.a);

          float l = dot(rgb, vec3(0.299, 0.587, 0.114));
          l = (l - 0.5) * contrast + 0.5 + brightness;

          float threshold = texture2D(tBayer, (px + 0.5) / 8.0).r;
          float on = step(threshold, l);

          if (edges > 0.5) {
            float d = texture2D(tDepth, uv).r;
            float m = 0.0;
            m = max(m, texture2D(tDepth, uv + vec2( 1.0, 0.0) / res).r - d);
            m = max(m, texture2D(tDepth, uv + vec2(-1.0, 0.0) / res).r - d);
            m = max(m, texture2D(tDepth, uv + vec2(0.0,  1.0) / res).r - d);
            m = max(m, texture2D(tDepth, uv + vec2(0.0, -1.0) / res).r - d);
            // 線は下地と逆の色にする（黒い物の縁は白、明るい物の縁は黒）
            if (m > edgeThreshold) on = l < 0.3 ? 1.0 : 0.0;
          }

          gl_FragColor = vec4(mix(ink, paper, on), 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });

    this.quadScene = new THREE.Scene();
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.cssSize = [1, 1];
    this.vignette = 0.55; // 背景の周辺の暗さ
  }

  // n×n の Bayer 行列（しきい値 0〜1）をテクスチャにする
  static bayerTexture(n) {
    let m = [[0]];
    while (m.length < n) {
      const s = m.length, next = [];
      for (let y = 0; y < s * 2; y++) {
        next.push([]);
        for (let x = 0; x < s * 2; x++) {
          const v = 4 * m[y % s][x % s];
          next[y].push(v + [[0, 2], [3, 1]][Math.floor(y / s)][Math.floor(x / s)]);
        }
      }
      m = next;
    }
    const data = new Uint8Array(n * n * 4);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = Math.round(((m[y][x] + 0.5) / (n * n)) * 255);
        data.set([v, v, v, 255], (y * n + x) * 4);
      }
    }
    const tex = new THREE.DataTexture(data, n, n);
    tex.minFilter = tex.magFilter = THREE.NearestFilter;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  setSize(cssW, cssH) {
    this.cssSize = [cssW, cssH];
    const w = Math.max(1, Math.floor(cssW / this.options.pixelSize));
    const h = Math.max(1, Math.floor(cssH / this.options.pixelSize));
    this.target.setSize(w, h);
    this.material.uniforms.res.value.set(w, h);
  }

  render(scene, camera) {
    const r = this.renderer;
    const u = this.material.uniforms;
    u.contrast.value = this.options.contrast;
    u.brightness.value = this.options.brightness;
    u.edges.value = this.options.edges ? 1 : 0;
    u.vignette.value = this.vignette;
    // 深度 0.15 ワールド単位ぶんの段差で線を引く（正投影なので深度は線形）
    u.edgeThreshold.value = 0.15 / (camera.far - camera.near);

    r.setRenderTarget(this.target);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(scene, camera);
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCamera);
  }
}
