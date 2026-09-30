// ==================== 纹理系统：程序化兜底 + CDN真实纹理异步替换 ====================
const TextureGen = (() => {
  function makeProcedural(type, size = 256) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const palettes = {
      grass: { base: [74, 124, 57], var: [40, 50, 30], dots: 0.15 },
      rock:  { base: [107, 101, 96], var: [35, 30, 28], dots: 0.25 },
      snow:  { base: [232, 238, 245], var: [20, 18, 15], dots: 0.08 },
      sand:  { base: [212, 169, 106], var: [30, 25, 22], dots: 0.2 },
      bark:  { base: [92, 64, 40], var: [35, 25, 18], dots: 0.35 },
      leaves:{ base: [61, 124, 71], var: [30, 50, 30], dots: 0.2 },
      wood:  { base: [139, 105, 20], var: [30, 22, 10], dots: 0.3 },
      water: { base: [40, 90, 140], var: [15, 20, 25], dots: 0.05 },
    };
    const p = palettes[type] || palettes.grass;
    const img = ctx.createImageData(size, size);
    const data = img.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const noise = Math.random() * 2 - 1;
        const patch = (Math.sin(x * 0.07) * Math.cos(y * 0.05) + Math.sin(x * 0.03 + y * 0.04)) * 0.5;
        data[i]     = Math.max(0, Math.min(255, p.base[0] + noise * p.var[0] + patch * p.var[0] * 0.5));
        data[i + 1] = Math.max(0, Math.min(255, p.base[1] + noise * p.var[1] + patch * p.var[1] * 0.4));
        data[i + 2] = Math.max(0, Math.min(255, p.base[2] + noise * p.var[2] + patch * p.var[2] * 0.6));
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    if (type === 'wood' || type === 'bark') {
      ctx.globalAlpha = 0.25;
      for (let x = 0; x < size; x += 3 + Math.random() * 5) {
        ctx.strokeStyle = `rgba(${p.base[0]*0.6|0},${p.base[1]*0.6|0},${p.base[2]*0.6|0},0.5)`;
        ctx.lineWidth = 1 + Math.random();
        ctx.beginPath();
        ctx.moveTo(x, 0);
        let cx = x;
        for (let y = 0; y < size; y += 10) { cx += (Math.random() - 0.5) * 3; ctx.lineTo(cx, y); }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }
  function getAll() {
    return {
      grass: makeProcedural('grass'), rock: makeProcedural('rock'),
      snow: makeProcedural('snow'), sand: makeProcedural('sand'),
      bark: makeProcedural('bark'), leaves: makeProcedural('leaves'),
      wood: makeProcedural('wood'), water: makeProcedural('water'),
    };
  }
  const CDN_URLS = {
    grass: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/grass_ground/grass_ground_diff_1k.jpg',
    rock: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/dark_rock/dark_rock_diff_1k.jpg',
    snow: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/snow_01/snow_01_diff_1k.jpg',
    sand: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/coast_sand_01/coast_sand_01_diff_1k.jpg',
    bark: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/bark_brown_01/bark_brown_01_diff_1k.jpg',
    leaves: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/forest_leaves_03/forest_leaves_03_diff_1k.jpg',
    wood: 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_plank_01/wood_plank_01_diff_1k.jpg',
  };
  function loadCDNTextures(textures, onProgress) {
    const keys = Object.keys(CDN_URLS);
    let loaded = 0;
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    keys.forEach((key) => {
      const repeatMap = { grass: 200, rock: 120, snow: 150, sand: 180, bark: 6, leaves: 10, wood: 8 };
      loader.load(CDN_URLS[key], (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.repeat.set(repeatMap[key] || 10, repeatMap[key] || 10);
        tex.anisotropy = 4; tex.needsUpdate = true;
        if (textures[key]) textures[key].dispose();
        textures[key] = tex; loaded++;
        if (onProgress) onProgress(loaded / keys.length);
      }, undefined, () => { loaded++; if (onProgress) onProgress(loaded / keys.length); });
    });
  }
  return { getAll, loadCDNTextures, makeProcedural };
})();

const SimplexNoise = (() => {
  const grad3 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[1,0],[-1,0],[0,1],[0,-1],[0,1],[0,-1]];
  const F2 = 0.5 * (Math.sqrt(3) - 1);
  const G2 = (3 - Math.sqrt(3)) / 6;
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  function init(seed = 1337) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed;
    function rand() { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }
    for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const tmp = p[i]; p[i] = p[j]; p[j] = tmp; }
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; permMod12[i] = perm[i] % 12; }
  }
  init();
  function noise2D(xin, yin) {
    let n0, n1, n2;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t), y0 = yin - (j - t);
    let i1, j1;
    if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    const gi0 = permMod12[ii + perm[jj]];
    const gi1 = permMod12[ii + i1 + perm[jj + j1]];
    const gi2 = permMod12[ii + 1 + perm[jj + 1]];
    let t0 = 0.5 - x0*x0 - y0*y0;
    if (t0 < 0) n0 = 0; else { t0 *= t0; n0 = t0 * t0 * (grad3[gi0][0]*x0 + grad3[gi0][1]*y0); }
    let t1 = 0.5 - x1*x1 - y1*y1;
    if (t1 < 0) n1 = 0; else { t1 *= t1; n1 = t1 * t1 * (grad3[gi1][0]*x1 + grad3[gi1][1]*y1); }
    let t2 = 0.5 - x2*x2 - y2*y2;
    if (t2 < 0) n2 = 0; else { t2 *= t2; n2 = t2 * t2 * (grad3[gi2][0]*x2 + grad3[gi2][1]*y2); }
    return 70 * (n0 + n1 + n2);
  }
  function fbm(x, y, octaves = 6, lacunarity = 2, gain = 0.5) {
    let value = 0, amp = 1, freq = 1, max = 0;
    for (let i = 0; i < octaves; i++) { value += amp * noise2D(x*freq, y*freq); max += amp; amp *= gain; freq *= lacunarity; }
    return value / max;
  }
  return { noise2D, fbm, init };
})();