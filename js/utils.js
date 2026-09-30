// ==================== 噪声函数 ====================
// 2D Value Noise 用于地形生成
const Noise = (() => {
  const PERM = new Uint8Array(512);
  const GRAD = [];

  function init() {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    // Fisher-Yates shuffle with seed
    let seed = 1337;
    function rand() {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    }
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
    for (let i = 0; i < 256; i++) {
      const angle = rand() * Math.PI * 2;
      GRAD[i] = [Math.cos(angle), Math.sin(angle)];
    }
  }
  init();

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + t * (b - a); }

  function noise2D(x, y) {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = PERM[PERM[xi] + yi];
    const ab = PERM[PERM[xi] + yi + 1];
    const ba = PERM[PERM[xi + 1] + yi];
    const bb = PERM[PERM[xi + 1] + yi + 1];

    function dot(g, x, y) { return g[0] * x + g[1] * y; }

    const x1 = lerp(dot(GRAD[aa], xf, yf), dot(GRAD[ba], xf - 1, yf), u);
    const x2 = lerp(dot(GRAD[ab], xf, yf - 1), dot(GRAD[bb], xf - 1, yf - 1), u);
    return lerp(x1, x2, v);
  }

  function fbm(x, y, octaves = 6, lacunarity = 2, gain = 0.5) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      value += amplitude * noise2D(x * frequency, y * frequency);
      maxValue += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return value / maxValue;
  }

  return { noise2D, fbm };
})();

// ==================== 程序化纹理生成 ====================
const _OldTextureGen_Utils = (() => {

  function createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function makeThreeTexture(canvas, repeat = 1) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 8;
    return tex;
  }

  // 草地纹理
  function grassTexture() {
    const size = 256;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');
    // 基底
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#4a7c39');
    grad.addColorStop(0.5, '#5a8f42');
    grad.addColorStop(1, '#3d6b2f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    // 噪点
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 40;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n * 0.8));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.5));
    }
    ctx.putImageData(img, 0, 0);
    // 草叶细节
    for (let i = 0; i < 800; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const len = 3 + Math.random() * 6;
      const hue = 80 + Math.random() * 40;
      ctx.strokeStyle = `hsla(${hue}, 50%, ${25 + Math.random() * 20}%, 0.6)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (Math.random() - 0.5) * 2, y - len);
      ctx.stroke();
    }
    return makeThreeTexture(c, 200);
  }

  // 岩石纹理
  function rockTexture() {
    const size = 256;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');
    // 基底
    ctx.fillStyle = '#6b6560';
    ctx.fillRect(0, 0, size, size);
    // 噪点
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 80;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n * 0.95));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n * 0.9));
    }
    ctx.putImageData(img, 0, 0);
    // 裂缝
    ctx.strokeStyle = 'rgba(40, 38, 35, 0.5)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 30; i++) {
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 5; j++) {
        x += (Math.random() - 0.5) * 40;
        y += (Math.random() - 0.5) * 40;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return makeThreeTexture(c, 100);
  }

  // 雪地纹理
  function snowTexture() {
    const size = 256;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8eef5';
    ctx.fillRect(0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 25;
      img.data[i] = Math.max(200, Math.min(255, img.data[i] + n));
      img.data[i + 1] = Math.max(205, Math.min(255, img.data[i + 1] + n * 1.1));
      img.data[i + 2] = Math.max(220, Math.min(255, img.data[i + 2] + n * 1.2));
    }
    ctx.putImageData(img, 0, 0);
    // 轻微起伏感
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 2 + Math.random() * 5;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    return makeThreeTexture(c, 100);
  }

  // 沙地纹理
  function sandTexture() {
    const size = 256;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#d4a96a');
    grad.addColorStop(1, '#c49856');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 35;
      img.data[i] = Math.max(150, Math.min(230, img.data[i] + n));
      img.data[i + 1] = Math.max(130, Math.min(210, img.data[i + 1] + n * 0.9));
      img.data[i + 2] = Math.max(80, Math.min(160, img.data[i + 2] + n * 0.7));
    }
    ctx.putImageData(img, 0, 0);
    // 沙波纹
    ctx.strokeStyle = 'rgba(180, 140, 80, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 15; i++) {
      ctx.beginPath();
      const yBase = i * 18 + Math.random() * 10;
      for (let x = 0; x <= size; x += 5) {
        const y = yBase + Math.sin(x * 0.08 + i) * 3;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    return makeThreeTexture(c, 150);
  }

  // 熔岩纹理
  function lavaTexture() {
    const size = 256;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2a1510';
    ctx.fillRect(0, 0, size, size);
    // 熔岩脉络
    for (let i = 0; i < 40; i++) {
      let x = Math.random() * size;
      let y = Math.random() * size;
      const hue = 15 + Math.random() * 25;
      ctx.strokeStyle = `hsla(${hue}, 100%, 55%, 0.8)`;
      ctx.lineWidth = 3 + Math.random() * 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 0; j < 8; j++) {
        x += (Math.random() - 0.3) * 30;
        y += (Math.random() - 0.5) * 25;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // 发光点
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      ctx.fillStyle = `hsla(${20 + Math.random() * 20}, 100%, 65%, 0.7)`;
      ctx.beginPath();
      ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    return makeThreeTexture(c, 80);
  }

  // 深色森林地表
  function darkForestTexture() {
    const size = 256;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#2d3d22');
    grad.addColorStop(1, '#1f2e18');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const img = ctx.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 30;
      img.data[i] = Math.max(20, Math.min(80, img.data[i] + n));
      img.data[i + 1] = Math.max(30, Math.min(90, img.data[i + 1] + n * 1.1));
      img.data[i + 2] = Math.max(10, Math.min(50, img.data[i + 2] + n * 0.6));
    }
    ctx.putImageData(img, 0, 0);
    // 落叶
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      ctx.fillStyle = `rgba(${80 + Math.random() * 60}, ${50 + Math.random() * 30}, 20, 0.4)`;
      ctx.beginPath();
      ctx.ellipse(x, y, 2 + Math.random() * 2, 1 + Math.random(), Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    return makeThreeTexture(c, 120);
  }

  // 树皮纹理
  function barkTexture() {
    const size = 128;
    const c = createCanvas(size, size * 2);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#5c4028';
    ctx.fillRect(0, 0, c.width, c.height);
    // 垂直纹理
    for (let x = 0; x < c.width; x += 2) {
      const darkness = 0.7 + Math.random() * 0.3;
      ctx.strokeStyle = `rgba(${Math.floor(60 * darkness)}, ${Math.floor(40 * darkness)}, ${Math.floor(25 * darkness)}, 0.6)`;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      let offset = 0;
      for (let y = 0; y < c.height; y += 10) {
        offset += (Math.random() - 0.5) * 3;
        ctx.lineTo(x + offset, y);
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 2);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // 树叶纹理
  function leavesTexture() {
    const size = 128;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');
    // 透明底
    ctx.clearRect(0, 0, size, size);
    // 叶团
    for (let i = 0; i < 200; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 5 + Math.random() * 12;
      const g = 80 + Math.random() * 80;
      ctx.fillStyle = `rgba(${30 + Math.random() * 30}, ${g}, ${30 + Math.random() * 30}, 0.85)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // 松木树叶（深绿带针叶感）
  function pineLeavesTexture() {
    const size = 128;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    for (let i = 0; i < 250; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const r = 4 + Math.random() * 10;
      const dark = Math.random() > 0.5;
      ctx.fillStyle = dark ? 'rgba(20, 50, 30, 0.9)' : 'rgba(40, 90, 50, 0.85)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // 木纹（房屋墙面）
  function woodPlankTexture() {
    const size = 256;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');
    // 木板底色
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(0, 0, size, size);
    // 水平木板分隔
    const plankH = 32;
    for (let y = 0; y < size; y += plankH) {
      // 每块木板颜色略有不同
      const shade = 0.85 + Math.random() * 0.3;
      ctx.fillStyle = `rgba(${Math.floor(139 * shade)}, ${Math.floor(105 * shade)}, ${Math.floor(20 * shade)}, 1)`;
      ctx.fillRect(0, y, size, plankH - 1);
      // 木纹
      ctx.strokeStyle = `rgba(60, 40, 10, 0.3)`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const yy = y + Math.random() * plankH;
        ctx.beginPath();
        let offset = 0;
        for (let x = 0; x <= size; x += 8) {
          offset += (Math.random() - 0.5) * 2;
          if (x === 0) ctx.moveTo(x, yy + offset);
          else ctx.lineTo(x, yy + offset);
        }
        ctx.stroke();
      }
      // 木板缝隙
      ctx.fillStyle = 'rgba(40, 25, 5, 0.8)';
      ctx.fillRect(0, y + plankH - 1, size, 1);
    }
    return makeThreeTexture(c, 2);
  }

  // 屋顶瓦片
  function roofTileTexture() {
    const size = 128;
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4a3728';
    ctx.fillRect(0, 0, size, size);
    // 瓦片行
    const rowH = 16;
    for (let y = 0; y < size; y += rowH) {
      const shade = 0.8 + Math.random() * 0.4;
      ctx.fillStyle = `rgba(${Math.floor(90 * shade)}, ${Math.floor(55 * shade)}, ${Math.floor(35 * shade)}, 1)`;
      ctx.fillRect(0, y, size, rowH - 2);
      // 瓦片弧
      ctx.strokeStyle = `rgba(30, 20, 10, 0.6)`;
      ctx.lineWidth = 1;
      for (let x = 0; x < size; x += 16) {
        ctx.beginPath();
        ctx.arc(x + 8, y + rowH - 2, 6, Math.PI, 0);
        ctx.stroke();
      }
    }
    return makeThreeTexture(c, 4);
  }

  // 仙人掌纹理
  function cactusTexture() {
    const size = 64;
    const c = createCanvas(size, size * 2);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#3d7c47';
    ctx.fillRect(0, 0, c.width, c.height);
    // 垂直棱
    for (let x = 0; x < c.width; x += 12) {
      ctx.fillStyle = 'rgba(50, 110, 60, 0.7)';
      ctx.fillRect(x, 0, 6, c.height);
      ctx.fillStyle = 'rgba(30, 70, 35, 0.5)';
      ctx.fillRect(x + 6, 0, 2, c.height);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 2);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // 预生成所有纹理
  let cache = null;
  function getAll() {
    if (cache) return cache;
    cache = {
      grass: grassTexture(),
      rock: rockTexture(),
      snow: snowTexture(),
      sand: sandTexture(),
      lava: lavaTexture(),
      darkForest: darkForestTexture(),
      bark: barkTexture(),
      leaves: leavesTexture(),
      pineLeaves: pineLeavesTexture(),
      wood: woodPlankTexture(),
      roof: roofTileTexture(),
      cactus: cactusTexture(),
    };
    return cache;
  }

  return { getAll };
})();