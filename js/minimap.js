// ==================== 小地图系统 ====================
const Minimap = (() => {
  let player, scene;
  let miniCanvas, miniCtx;
  const MAP_SIZE = 500; // 世界地图采样范围（以玩家为中心的半径）
  const MAP_RES = 128; // 小地图缓存分辨率

  // 缓存一张俯视渲染图（减少每帧计算）
  let cachedMap = null;
  let cachedCenter = { x: 0, z: 0 };
  let needsRedraw = true;

  function init(p, scn, opts) {
    player = p;
    scene = scn;
    miniCanvas = document.getElementById('minimap');
    miniCtx = miniCanvas.getContext('2d');
    // 立即画一次
    drawMinimap();
  }

  // 生成高度图到颜色映射
  function heightToColor(h, waterLevel, slope) {
    if (h < waterLevel) {
      // 水：深浅
      const depth = waterLevel - h;
      const b = Math.floor(80 + Math.min(80, depth * 4));
      return `rgb(${b*0.4|0}, ${b*0.7|0}, ${b + 60})`;
    } else if (h < waterLevel + 5) {
      // 沙滩
      return `rgb(${200 + (h-waterLevel)*5|0}, ${170 + (h-waterLevel)*3|0}, ${100 + (h-waterLevel)*2|0})`;
    } else if (slope > 0.6) {
      // 岩石
      return `rgb(${120 + h*0.3|0}, ${110 + h*0.25|0}, ${100 + h*0.2|0})`;
    } else if (h > 70) {
      // 雪地
      return `rgb(${220 + Math.min(35, h*0.1)|0}, ${225 + Math.min(30, h*0.08)|0}, ${235})`;
    } else {
      // 草地（根据生物群系微调）
      const greenBase = 100 + Math.min(60, h * 0.5);
      return `rgb(${70 + h*0.2|0}, ${greenBase}, ${50 + h*0.15|0})`;
    }
  }

  // 绘制地形纹理到离屏canvas
  function drawTopography(ctx, cx, cz, size, res) {
    const worldSize = size;
    const half = worldSize / 2;
    const step = worldSize / res;

    ctx.fillStyle = '#3a5a2a';
    ctx.fillRect(0, 0, res, res);

    const waterLevel = Terrain.WATER_LEVEL;

    for (let py = 0; py < res; py++) {
      for (let px = 0; px < res; px++) {
        const wx = cx - half + px * step;
        const wz = cz - half + py * step;
        const h = Terrain.getHeight(wx, wz);
        // 粗略坡度（用四邻域）
        const h1 = Terrain.getHeight(wx + step, wz);
        const h2 = Terrain.getHeight(wx, wz + step);
        const slope = Math.min(1, Math.sqrt((h1-h)**2 + (h2-h)**2) / step);
        ctx.fillStyle = heightToColor(h, waterLevel, slope);
        ctx.fillRect(px, py, 1, 1);
      }
    }

    // 画河流（高亮）
    ctx.strokeStyle = 'rgba(80, 150, 200, 0.8)';
    ctx.lineWidth = Math.max(1, res * 0.01);
    ctx.beginPath();
    const path = Terrain.RIVER_PATH;
    for (let i = 0; i < path.length; i++) {
      const [rx, rz] = path[i];
      const sx = (rx - cx + half) / worldSize * res;
      const sy = (rz - cz + half) / worldSize * res;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // 画村庄标记（中心区域）
    const villageX = (0 - cx + half) / worldSize * res;
    const villageY = (0 - cz + half) / worldSize * res;
    if (villageX > 0 && villageX < res && villageY > 0 && villageY < res) {
      ctx.fillStyle = 'rgba(232, 216, 168, 0.9)';
      ctx.beginPath();
      ctx.arc(villageX, villageY, res * 0.03, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `${res * 0.04}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('青耳村', villageX, villageY - res * 0.04);
    }
  }

  // 收集敌人/树木/NPC等标记
  function getMarkers(cx, cz, size) {
    const half = size / 2;
    const markers = [];

    scene.traverse((obj) => {
      if (!obj.userData) return;
      const dx = obj.position.x - cx;
      const dz = obj.position.z - cz;
      if (Math.abs(dx) > half || Math.abs(dz) > half) return;

      if (obj.userData.type === 'enemy' && obj.userData.health > 0) {
        markers.push({ type: 'enemy', x: dx, z: dz });
      }
      if (obj.userData.type === 'npc') {
        markers.push({ type: 'npc', x: dx, z: dz, name: obj.userData.npcName });
      }
      if (obj.userData.type === 'house') {
        markers.push({ type: 'house', x: dx, z: dz });
      }
    });

    return markers;
  }

  function drawMinimap() {
    if (!player) return;
    const w = miniCanvas.width;
    const h = miniCanvas.height;
    const cx = player.position.x;
    const cz = player.position.z;

    // 离屏画布缓存地形底图
    if (!cachedMap || needsRedraw ||
        Math.abs(cx - cachedCenter.x) > MAP_SIZE * 0.2 ||
        Math.abs(cz - cachedCenter.z) > MAP_SIZE * 0.2) {
      cachedMap = document.createElement('canvas');
      cachedMap.width = MAP_RES;
      cachedMap.height = MAP_RES;
      const cctx = cachedMap.getContext('2d');
      drawTopography(cctx, cx, cz, MAP_SIZE, MAP_RES);
      cachedCenter = { x: cx, z: cz };
      needsRedraw = false;
    }

    miniCtx.clearRect(0, 0, w, h);

    // 圆形裁剪
    miniCtx.save();
    miniCtx.beginPath();
    miniCtx.arc(w/2, h/2, w/2 - 2, 0, Math.PI * 2);
    miniCtx.clip();

    // 地形底图
    miniCtx.drawImage(cachedMap, 0, 0, w, h);

    // 标记
    const markers = getMarkers(cx, cz, MAP_SIZE);
    const scale = w / MAP_SIZE;
    for (const m of markers) {
      const mx = w/2 + m.x * scale;
      const my = h/2 + m.z * scale;
      if (m.type === 'enemy') {
        miniCtx.fillStyle = '#ff4444';
        miniCtx.beginPath();
        miniCtx.arc(mx, my, 3, 0, Math.PI * 2);
        miniCtx.fill();
      } else if (m.type === 'npc') {
        miniCtx.fillStyle = '#44ccff';
        miniCtx.fillRect(mx - 2, my - 2, 4, 4);
      } else if (m.type === 'house') {
        miniCtx.fillStyle = 'rgba(180, 140, 90, 0.9)';
        miniCtx.fillRect(mx - 2, my - 2, 4, 4);
      }
    }

    miniCtx.restore();

    // 玩家箭头（朝向相机前方）
    const yaw = PlayerController.getYaw();
    miniCtx.save();
    miniCtx.translate(w/2, h/2);
    miniCtx.rotate(-yaw + Math.PI); // 箭头指向上方=前方
    miniCtx.fillStyle = '#fff';
    miniCtx.strokeStyle = '#000';
    miniCtx.lineWidth = 1.5;
    miniCtx.beginPath();
    miniCtx.moveTo(0, -8);
    miniCtx.lineTo(5, 6);
    miniCtx.lineTo(0, 3);
    miniCtx.lineTo(-5, 6);
    miniCtx.closePath();
    miniCtx.fill();
    miniCtx.stroke();
    miniCtx.restore();

    // 外圈
    miniCtx.strokeStyle = 'rgba(255,255,255,0.5)';
    miniCtx.lineWidth = 2;
    miniCtx.beginPath();
    miniCtx.arc(w/2, h/2, w/2 - 1, 0, Math.PI * 2);
    miniCtx.stroke();
  }

  function update() {
    drawMinimap();
  }

  // 渲染全屏大地图
  function renderBig(canvas) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const worldSize = Terrain.WORLD_SIZE * 0.9;
    const res = 400;

    // 生成整张地图的地形图
    const topoCanvas = document.createElement('canvas');
    topoCanvas.width = res;
    topoCanvas.height = res;
    const tctx = topoCanvas.getContext('2d');
    drawTopography(tctx, 0, 0, worldSize, res);

    ctx.clearRect(0, 0, w, h);
    // 圆角背景
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(0, 0, w, h);

    // 地形
    ctx.drawImage(topoCanvas, 20, 20, w - 40, h - 40);

    // 地图标题
    ctx.fillStyle = '#e8d8a8';
    ctx.font = 'bold 24px Microsoft YaHei, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('五域全图', w/2, 50);

    // 五域标注
    const labels = [
      { x: w/2, y: h/2, text: '青耳原野', color: '#e8d8a8' },
      { x: w * 0.88, y: h/2, text: '赤沙雅丹', color: '#e8c070' },
      { x: w/2, y: h * 0.12, text: '寒渊雪原', color: '#cce0f5' },
      { x: w * 0.12, y: h/2, text: '幽暗古林', color: '#60a070' },
      { x: w/2, y: h * 0.88, text: '熔岩裂谷', color: '#ff8844' },
    ];
    for (const lb of labels) {
      ctx.fillStyle = lb.color;
      ctx.font = 'bold 16px Microsoft YaHei, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(lb.text, lb.x, lb.y);
    }

    // 玩家位置
    const half = worldSize / 2;
    const px = 20 + (player.position.x + half) / worldSize * (w - 40);
    const py = 20 + (player.position.z + half) / worldSize * (h - 40);
    const yaw = PlayerController.getYaw();

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-yaw + Math.PI);
    ctx.fillStyle = '#ffff44';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(8, 10);
    ctx.lineTo(0, 5);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // 敌人位置
    scene.traverse((obj) => {
      if (obj.userData && obj.userData.type === 'enemy' && obj.userData.health > 0) {
        const ex = 20 + (obj.position.x + half) / worldSize * (w - 40);
        const ey = 20 + (obj.position.z + half) / worldSize * (h - 40);
        ctx.fillStyle = '#ff3333';
        ctx.beginPath();
        ctx.arc(ex, ey, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 村庄
    const vx = 20 + (0 + half) / worldSize * (w - 40);
    const vy = 20 + (0 + half) / worldSize * (h - 40);
    ctx.fillStyle = '#ffcc44';
    ctx.beginPath();
    ctx.moveTo(vx, vy - 10);
    ctx.lineTo(vx + 8, vy + 6);
    ctx.lineTo(vx - 8, vy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  return { init, update, renderBig };
})();