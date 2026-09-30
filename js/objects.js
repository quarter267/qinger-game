// ==================== 场景对象 ====================
const WorldObjects = (() => {

  // ========== 树：真实树干+树冠 ==========
  function createTree(textures, type = 'broadleaf', scale = 1) {
    const group = new THREE.Group();

    // 树干（圆柱+树皮贴图）
    const trunkH = 4 * scale;
    const trunkGeo = new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, trunkH, 8);
    const trunkMat = new THREE.MeshStandardMaterial({
      map: textures.bark,
      roughness: 0.95,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = trunkH / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // 树叶材质
    const leavesMat = new THREE.MeshStandardMaterial({
      map: textures.leaves,
      roughness: 0.9,
      side: THREE.DoubleSide,
    });

    if (type === 'pine') {
      // 松树：多层圆锥
      const layers = 5;
      for (let i = 0; i < layers; i++) {
        const r = (2.0 - i * 0.35) * scale;
        const h = 1.6 * scale;
        const leafGeo = new THREE.ConeGeometry(r, h, 8);
        const pineMat = new THREE.MeshStandardMaterial({
          color: 0x2a5a3a,
          map: textures.leaves,
          roughness: 0.9,
        });
        const leaf = new THREE.Mesh(leafGeo, pineMat);
        leaf.position.y = (trunkH + i * 1.1) * scale;
        leaf.castShadow = true;
        group.add(leaf);
      }
    } else if (type === 'cactus') {
      // 仙人掌
      group.remove(trunk); // 移除树皮树干
      const cactusMat = new THREE.MeshStandardMaterial({
        color: 0x3d8c4a,
        roughness: 0.9,
      });
      const mainGeo = new THREE.CylinderGeometry(0.5 * scale, 0.65 * scale, 4 * scale, 8);
      const main = new THREE.Mesh(mainGeo, cactusMat);
      main.position.y = 2 * scale;
      main.castShadow = true;
      group.add(main);
      // 侧臂
      for (let i = 0; i < 2; i++) {
        const armGeo = new THREE.CylinderGeometry(0.2 * scale, 0.25 * scale, 1.8 * scale, 6);
        const arm = new THREE.Mesh(armGeo, cactusMat);
        arm.position.set((i === 0 ? 0.7 : -0.7) * scale, 2.5 * scale, 0);
        arm.rotation.z = (i === 0 ? -0.4 : 0.4);
        arm.castShadow = true;
        group.add(arm);
      }
    } else {
      // 阔叶树：多个球体组合成不规则树冠
      const leafPositions = [
        [0, 5.5, 0, 1.8],
        [1.1, 4.8, 0.4, 1.3],
        [-0.9, 4.5, -0.5, 1.2],
        [0.4, 6.2, 0.3, 1.1],
        [-0.5, 5.7, 0.9, 1.0],
        [0.6, 4.2, -1.0, 1.1],
        [-1.2, 5.0, 0.2, 0.9],
        [1.0, 5.8, -0.6, 0.9],
      ];
      for (const [x, y, z, r] of leafPositions) {
        const leafGeo = new THREE.SphereGeometry(r * scale, 8, 6);
        const leaf = new THREE.Mesh(leafGeo, leavesMat);
        leaf.position.set(x * scale, y * scale, z * scale);
        leaf.castShadow = true;
        group.add(leaf);
      }
    }

    group.userData.type = 'tree';
    // 注册碰撞（树干碰撞）
    if (typeof CollisionSystem !== 'undefined') {
      const trunkRadius = (type === 'cactus' ? 0.6 : 0.35) * scale;
      CollisionSystem.addBox(
        0, 0,
        trunkRadius, trunkRadius,
        'tree'
      );
      // 由于addBox用世界坐标，树在添加到scene后再更新位置
      // 这里用group的userData记录碰撞参数，由Game统一处理
      group.userData.colliderRadius = trunkRadius;
    }
    return group;
  }

  // ========== 房屋 ==========
  function createHouse(textures, opts = {}) {
    const w = opts.w || 10;
    const h = opts.h || 6;
    const d = opts.d || 8;
    const color = opts.color || 0xffffff;
    const type = opts.type || 'house';

    const group = new THREE.Group();
    const wallThickness = 0.5;

    // 石基座（确保房子不直接接触可能不平的地面）
    const foundMat = new THREE.MeshStandardMaterial({ color: 0x6b6560, roughness: 0.95 });
    const foundGeo = new THREE.BoxGeometry(w + 0.8, 0.6, d + 0.8);
    const found = new THREE.Mesh(foundGeo, foundMat);
    found.position.y = 0.3;
    found.receiveShadow = true;
    group.add(found);

    // 墙体材质
    const wallMat = new THREE.MeshStandardMaterial({
      map: textures.wood,
      roughness: 0.85,
      color: color,
    });

    // ===== 四面墙（带门洞） =====
    // 前墙（正面，有门）：分成左右两部分
    const doorW = 1.5;
    const doorH = 2.8;
    const doorY = 0.6 + doorH / 2; // 门中心y

    // 前墙左半
    const frontLeftW = (w - doorW) / 2;
    const frontLeft = new THREE.Mesh(
      new THREE.BoxGeometry(frontLeftW, h, wallThickness),
      wallMat
    );
    frontLeft.position.set(-w/2 + frontLeftW/2, 0.6 + h/2, d/2);
    frontLeft.castShadow = true;
    frontLeft.receiveShadow = true;
    group.add(frontLeft);

    // 前墙右半
    const frontRight = new THREE.Mesh(
      new THREE.BoxGeometry(frontLeftW, h, wallThickness),
      wallMat
    );
    frontRight.position.set(w/2 - frontLeftW/2, 0.6 + h/2, d/2);
    frontRight.castShadow = true;
    frontRight.receiveShadow = true;
    group.add(frontRight);

    // 前门上方的墙（门楣）
    const lintelH = h - doorH;
    if (lintelH > 0.1) {
      const lintel = new THREE.Mesh(
        new THREE.BoxGeometry(doorW + 0.05, lintelH, wallThickness),
        wallMat
      );
      lintel.position.set(0, 0.6 + doorH + lintelH/2, d/2);
      lintel.castShadow = true;
      lintel.receiveShadow = true;
      group.add(lintel);
    }

    // 后墙（完整）
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, wallThickness),
      wallMat
    );
    backWall.position.set(0, 0.6 + h/2, -d/2);
    backWall.castShadow = true;
    backWall.receiveShadow = true;
    group.add(backWall);

    // 左墙
    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, h, d),
      wallMat
    );
    leftWall.position.set(-w/2, 0.6 + h/2, 0);
    leftWall.castShadow = true;
    leftWall.receiveShadow = true;
    group.add(leftWall);

    // 右墙
    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(wallThickness, h, d),
      wallMat
    );
    rightWall.position.set(w/2, 0.6 + h/2, 0);
    rightWall.castShadow = true;
    rightWall.receiveShadow = true;
    group.add(rightWall);

    // 门
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.9 });
    const doorGeo = new THREE.BoxGeometry(doorW - 0.1, doorH, 0.12);
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, doorY, d/2 + 0.1);
    door.userData.noCollision = true; // 门不阻挡（玩家能走到门口）
    group.add(door);
    // 门把手
    const handleGeo = new THREE.SphereGeometry(0.08, 6, 6);
    const handle = new THREE.Mesh(handleGeo, new THREE.MeshStandardMaterial({ color: 0xd4a040, metalness: 0.8, roughness: 0.3 }));
    handle.position.set(0.45, doorY, d/2 + 0.18);
    handle.userData.noCollision = true;
    group.add(handle);

    // 窗户（在前墙）
    const windowMat = new THREE.MeshStandardMaterial({
      color: 0xffeedd,
      emissive: 0xffcc66,
      emissiveIntensity: 0.2,
    });
    const windowY = 0.6 + h * 0.6;
    const windowZ = d/2 - wallThickness/2 + 0.05;
    for (let i = 0; i < 2; i++) {
      const wx = i === 0 ? -w * 0.35 : w * 0.35;
      const wGeo = new THREE.BoxGeometry(1.2, 1.2, 0.1);
      const wi = new THREE.Mesh(wGeo, windowMat);
      wi.position.set(wx, windowY, windowZ);
      wi.userData.noCollision = true;
      group.add(wi);
      // 窗框
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.8 });
      // 上下横条
      const topFrame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.12), frameMat);
      topFrame.position.set(wx, windowY + 0.6, windowZ + 0.02);
      topFrame.userData.noCollision = true;
      group.add(topFrame);
      const botFrame = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 0.12), frameMat);
      botFrame.position.set(wx, windowY - 0.6, windowZ + 0.02);
      botFrame.userData.noCollision = true;
      group.add(botFrame);
      // 左右竖条
      const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 0.12), frameMat);
      leftFrame.position.set(wx - 0.6, windowY, windowZ + 0.02);
      leftFrame.userData.noCollision = true;
      group.add(leftFrame);
      const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 0.12), frameMat);
      rightFrame.position.set(wx + 0.6, windowY, windowZ + 0.02);
      rightFrame.userData.noCollision = true;
      group.add(rightFrame);
      // 中间十字
      const midH = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.06, 0.1), frameMat);
      midH.position.set(wx, windowY, windowZ + 0.03);
      midH.userData.noCollision = true;
      group.add(midH);
      const midV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.1), frameMat);
      midV.position.set(wx, windowY, windowZ + 0.03);
      midV.userData.noCollision = true;
      group.add(midV);
    }

    // 双坡屋顶
    const roofH = h * 0.5;
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x5a3a20,
      roughness: 0.8,
    });
    // 用三棱柱式：两个倾斜面 + 两个三角端面
    const roofShape = new THREE.Shape();
    roofShape.moveTo(-w / 2 - 0.3, 0);
    roofShape.lineTo(w / 2 + 0.3, 0);
    roofShape.lineTo(0, roofH);
    roofShape.lineTo(-w / 2 - 0.3, 0);

    const extrudeSettings = { depth: d + 0.4, bevelEnabled: false };
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, extrudeSettings);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.rotation.x = Math.PI / 2;
    roof.position.set(0, 0.6 + h, -d / 2 - 0.2);
    roof.castShadow = true;
    group.add(roof);

    group.userData = { type: 'house', height: 0.6 + h + roofH, houseWidth: w, houseDepth: d, houseType: type };

    // 注册四面墙的碰撞盒（局部坐标：门在+z方向）
    if (typeof CollisionSystem !== 'undefined') {
      // 用group世界坐标下的碰撞盒
      // 先计算每个墙的局部AABB，再转换到世界空间
      const walls = [
        // 前墙左
        { lx: -w/2 + frontLeftW/2, lz: d/2, hw: frontLeftW/2, hd: wallThickness/2 },
        // 前墙右
        { lx: w/2 - frontLeftW/2, lz: d/2, hw: frontLeftW/2, hd: wallThickness/2 },
        // 后墙
        { lx: 0, lz: -d/2, hw: w/2, hd: wallThickness/2 },
        // 左墙
        { lx: -w/2, lz: 0, hw: wallThickness/2, hd: d/2 },
        // 右墙
        { lx: w/2, lz: 0, hw: wallThickness/2, hd: d/2 },
      ];
      // 将每个墙从局部空间转换到世界空间（考虑group的y轴旋转和位置）
      // 由于在createHouse阶段group还没被加到场景，位置和旋转都是0
      // 但房子在populateWorld里会设置position和rotation
      // 所以碰撞盒需要在房子添加到场景后再注册
      // 这里先把墙的局部参数存到userData里
      group.userData.wallColliders = walls;
    }

    return group;
  }

  // ========== 告示牌 ==========
  function createSignpost(textures, text = '') {
    const group = new THREE.Group();

    // 立柱
    const postMat = new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.9 });
    const postGeo = new THREE.CylinderGeometry(0.15, 0.2, 4, 6);
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.y = 2;
    post.castShadow = true;
    group.add(post);

    // 木牌
    const boardMat = new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.85, color: 0xddbb88 });
    const boardGeo = new THREE.BoxGeometry(3, 1.5, 0.15);
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.position.y = 3.3;
    board.castShadow = true;
    group.add(board);

    group.userData.type = 'signpost';
    return group;
  }

  // ========== 农田 ==========
  function createFarmField(textures, rows = 4, cols = 3) {
    const group = new THREE.Group();
    const fieldW = 8;
    const fieldD = 6;

    // 田埂（土色）
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x6b5030, roughness: 1 });
    const soilGeo = new THREE.BoxGeometry(fieldW, 0.2, fieldD);
    const soil = new THREE.Mesh(soilGeo, soilMat);
    soil.position.y = 0.1;
    soil.receiveShadow = true;
    group.add(soil);

    // 垄
    for (let r = 0; r < rows; r++) {
      const ridgeGeo = new THREE.BoxGeometry(fieldW - 0.5, 0.15, 0.5);
      const ridge = new THREE.Mesh(ridgeGeo, soilMat);
      const z = -fieldD / 2 + 0.5 + r * (fieldD - 1) / (rows - 1 || 1);
      ridge.position.set(0, 0.25, z);
      ridge.receiveShadow = true;
      group.add(ridge);

      // 作物（小方块表示）
      const cropMat = new THREE.MeshStandardMaterial({ color: 0x4a8c3a, roughness: 0.8 });
      for (let c = 0; c < cols; c++) {
        const cx = -fieldW / 2 + 1 + c * (fieldW - 2) / (cols || 1);
        const cropGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.5, 4);
        const crop = new THREE.Mesh(cropGeo, cropMat);
        crop.position.set(cx, 0.55, z);
        group.add(crop);
      }
    }

    group.userData.type = 'farm';
    return group;
  }

  // ========== 石头柱（雅丹）==========
  function createSandPillar(textures, scale = 1) {
    const group = new THREE.Group();
    const h = (8 + Math.random() * 12) * scale;
    const r = (1.5 + Math.random() * 1.5) * scale;
    const geo = new THREE.CylinderGeometry(r * 0.8, r, h, 7);
    const mat = new THREE.MeshStandardMaterial({ map: textures.sand, roughness: 0.95, color: 0xccaa66 });
    const pillar = new THREE.Mesh(geo, mat);
    pillar.position.y = h / 2;
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);
    // 顶部略平
    const topGeo = new THREE.CylinderGeometry(r * 0.9, r * 0.85, 0.8, 7);
    const top = new THREE.Mesh(topGeo, mat);
    top.position.y = h - 0.4;
    group.add(top);

    group.userData.type = 'pillar';
    return group;
  }

  // ========== 岩浆池 ==========
  function createLavaPool(radius = 8) {
    const group = new THREE.Group();
    const geo = new THREE.CircleGeometry(radius, 16);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff4400,
      emissive: 0xff2200,
      emissiveIntensity: 0.8,
      roughness: 0.2,
    });
    const pool = new THREE.Mesh(geo, mat);
    pool.receiveShadow = false;
    group.add(pool);

    // 发光动画
    let t = 0;
    group.userData.update = (dt) => {
      t += dt;
      mat.emissiveIntensity = 0.7 + Math.sin(t * 2) * 0.15;
    };

    group.userData.type = 'lavapool';
    return group;
  }

  // ========== NPC ==========
  function createNPC(textures, role = 'villager') {
    const group = new THREE.Group();

    const colors = {
      elder:   { robe: 0x4a3a6b, accent: 0xd4b070 },
      smith:   { robe: 0x6b3a1a, accent: 0x888888 },
      healer:  { robe: 0x2a6b5a, accent: 0xff99aa },
      merchant:{ robe: 0x6b5a2a, accent: 0xd4a040 },
      fisher:  { robe: 0x2a4a6b, accent: 0x6699cc },
      villager:{ robe: 0x6b6b4a, accent: 0xaa9966 },
    };
    const c = colors[role] || colors.villager;

    // 长袍身体
    const robeMat = new THREE.MeshStandardMaterial({ color: c.robe, roughness: 0.85 });
    const bodyGeo = new THREE.CylinderGeometry(0.45, 0.6, 1.3, 8);
    const body = new THREE.Mesh(bodyGeo, robeMat);
    body.position.y = 0.85;
    body.castShadow = true;
    group.add(body);

    // 头
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xe8c4a0, roughness: 0.7 });
    const headGeo = new THREE.SphereGeometry(0.3, 8, 6);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.y = 1.85;
    head.castShadow = true;
    group.add(head);

    // 头发
    const hairColor = role === 'elder' ? 0xdcdcdc : 0x1a1020;
    const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.9 });
    const hairGeo = new THREE.SphereGeometry(0.31, 8, 5, 0, Math.PI * 2, 0, Math.PI * 1.8 / 2.5);
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.y = 1.88;
    group.add(hair);

    // 角色装饰
    if (role === 'elder') {
      const hatGeo = new THREE.ConeGeometry(0.35, 0.4, 6);
      const hat = new THREE.Mesh(hatGeo, hairMat);
      hat.position.y = 2.35;
      group.add(hat);
    } else if (role === 'smith') {
      // 围裙
      const apronMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.9 });
      const apronGeo = new THREE.BoxGeometry(0.7, 0.9, 0.05);
      const apron = new THREE.Mesh(apronGeo, apronMat);
      apron.position.set(0, 0.85, 0.58);
      group.add(apron);
      // 锤子
      const hammerHandle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.8, 4),
        new THREE.MeshStandardMaterial({ color: 0x5c4028 })
      );
      hammerHandle.position.set(0.6, 0.8, 0.3);
      hammerHandle.rotation.z = -0.5;
      group.add(hammerHandle);
      const hammerHead = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.25, 0.3),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.4 })
      );
      hammerHead.position.set(0.85, 1.05, 0.3);
      group.add(hammerHead);
    } else if (role === 'healer') {
      // 花冠
      const flowerMat = new THREE.MeshStandardMaterial({ color: c.accent, roughness: 0.6 });
      for (let i = 0; i < 6; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.07, 4, 4), flowerMat);
        const a = (i / 6) * Math.PI * 2;
        f.position.set(Math.cos(a) * 0.28, 2.1, Math.sin(a) * 0.28);
        group.add(f);
      }
    } else if (role === 'merchant') {
      // 帽子（圆帽）
      const hatGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.08, 8);
      const hat = new THREE.Mesh(hatGeo, new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 }));
      hat.position.y = 2.15;
      group.add(hat);
      const topGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.3, 8);
      const top = new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 }));
      top.position.y = 2.34;
      group.add(top);
    } else if (role === 'fisher') {
      // 斗笠
      const hatGeo = new THREE.ConeGeometry(0.5, 0.2, 8);
      const hat = new THREE.Mesh(hatGeo, new THREE.MeshStandardMaterial({ color: 0x7a6040, roughness: 0.9 }));
      hat.position.y = 2.1;
      group.add(hat);
    }

    group.userData = { type: 'npc', role, height: 2.3 };
    return group;
  }

  // ========== 敌人 ==========
  function createEnemy(type = 'slime') {
    const group = new THREE.Group();
    let attackDamage, speed, maxHealth, exp, isBoss = false;

    if (type === 'slime') {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x55bb66, transparent: true, opacity: 0.85,
        roughness: 0.3, emissive: 0x225533, emissiveIntensity: 0.2,
      });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), mat);
      body.position.y = 0.7;
      body.castShadow = true;
      group.add(body);
      // 眼睛
      for (let i = 0; i < 2; i++) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6),
          new THREE.MeshStandardMaterial({ color: 0xffffff }));
        eye.position.set((i ? 0.22 : -0.22), 0.85, 0.55);
        group.add(eye);
        const pup = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4),
          new THREE.MeshStandardMaterial({ color: 0x000000 }));
        pup.position.set((i ? 0.22 : -0.22), 0.85, 0.64);
        group.add(pup);
      }
      attackDamage = 5; speed = 1.8; maxHealth = 25; exp = 10;
    } else if (type === 'wolf') {
      const furMat = new THREE.MeshStandardMaterial({ color: 0x6b5a4a, roughness: 0.95 });
      // 身体
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 1.1, 8), furMat);
      body.rotation.z = Math.PI / 2;
      body.position.y = 0.6;
      body.castShadow = true;
      group.add(body);
      // 两端半球
      for (let i = 0; i < 2; i++) {
        const end = new THREE.Mesh(new THREE.SphereGeometry(0.37, 8, 6), furMat);
        end.position.set((i ? 0.55 : -0.55), 0.6, 0);
        end.castShadow = true;
        group.add(end);
      }
      // 头
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), furMat);
      head.position.set(0.7, 0.72, 0);
      head.castShadow = true;
      group.add(head);
      // 耳朵
      for (let i = 0; i < 2; i++) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 4), furMat);
        ear.position.set(0.78, 0.95, (i ? 0.12 : -0.12));
        ear.rotation.z = -0.3;
        group.add(ear);
      }
      // 腿
      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 6), furMat);
        leg.position.set((i < 2 ? 0.4 : -0.4), 0.25, (i % 2 ? 0.18 : -0.18));
        group.add(leg);
      }
      // 红眼
      for (let i = 0; i < 2; i++) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4),
          new THREE.MeshStandardMaterial({ color: 0xff3300, emissive: 0xff2200, emissiveIntensity: 1 }));
        eye.position.set(0.9, 0.78, (i ? 0.08 : -0.08));
        group.add(eye);
      }
      // 尾巴
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.5, 4), furMat);
      tail.position.set(-0.8, 0.7, 0);
      tail.rotation.z = 0.5;
      group.add(tail);
      attackDamage = 10; speed = 3.2; maxHealth = 40; exp = 25;
    } else if (type === 'golem') {
      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x4a2520, roughness: 0.95,
        emissive: 0xff3300, emissiveIntensity: 0.15,
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(2, 2.8, 1.6), stoneMat);
      body.position.y = 2.6;
      body.castShadow = true;
      group.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.0), stoneMat);
      head.position.y = 4.5;
      group.add(head);
      // 眼
      for (let i = 0; i < 2; i++) {
        const eye = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.05),
          new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 1 }));
        eye.position.set((i ? 0.25 : -0.25), 4.6, 0.5);
        group.add(eye);
      }
      for (let i = 0; i < 2; i++) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.2, 0.6), stoneMat);
        arm.position.set((i ? 1.3 : -1.3), 2.8, 0);
        arm.castShadow = true;
        group.add(arm);
      }
      for (let i = 0; i < 2; i++) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.7), stoneMat);
        leg.position.set((i ? 0.45 : -0.45), 0.7, 0);
        group.add(leg);
      }
      attackDamage = 25; speed = 1.3; maxHealth = 180; exp = 250; isBoss = true;
    } else if (type === 'ice_wraith') {
      const iceMat = new THREE.MeshStandardMaterial({
        color: 0xbbddee, transparent: true, opacity: 0.75,
        roughness: 0.1, metalness: 0.3,
        emissive: 0x66aadd, emissiveIntensity: 0.4,
      });
      const body = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 8), iceMat);
      body.position.y = 1.6;
      body.castShadow = true;
      group.add(body);
      const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), iceMat);
      head.position.y = 3.4;
      group.add(head);
      for (let i = 0; i < 2; i++) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 4, 4),
          new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x88ccff, emissiveIntensity: 1 }));
        eye.position.set((i ? 0.15 : -0.15), 3.4, 0.4);
        group.add(eye);
      }
      // 飘带/冰棱
      for (let i = 0; i < 4; i++) {
        const shard = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.8, 4), iceMat);
        const a = (i / 4) * Math.PI * 2;
        shard.position.set(Math.cos(a) * 0.5, 2 + Math.random() * 0.5, Math.sin(a) * 0.5);
        shard.rotation.z = 0.3;
        shard.rotation.y = a;
        group.add(shard);
      }
      attackDamage = 20; speed = 2.2; maxHealth = 140; exp = 200; isBoss = true;
    }

    group.userData = {
      type: 'enemy', enemyType: type,
      health: maxHealth, maxHealth,
      attackDamage, speed, exp, isBoss,
      attackCooldown: 0, state: 'idle',
      idleTimer: 0, idleTarget: null,
    };
    return group;
  }

  // ========== 玩家 ==========
  function createPlayer() {
    const group = new THREE.Group();

    // 身体
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.75 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.35, 0.95, 8), bodyMat);
    body.position.y = 1.05;
    body.castShadow = true;
    group.add(body);

    // 头
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xe8c4a0, roughness: 0.7 })
    );
    head.position.y = 2.0;
    head.castShadow = true;
    group.add(head);

    // 头发
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1020, roughness: 0.85 });
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.31, 8, 5, 0, Math.PI * 2, 0, Math.PI * 1.8 / 2.5),
      hairMat
    );
    hair.position.y = 2.03;
    group.add(hair);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), hairMat);
    bun.position.y = 2.4;
    group.add(bun);

    // 手臂
    const armMat = new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 0.75 });
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6), armMat);
    leftArm.position.set(-0.48, 1.3, 0);
    leftArm.rotation.z = 0.3;
    leftArm.castShadow = true;
    group.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 6), armMat);
    rightArm.position.set(0.48, 1.3, 0);
    rightArm.rotation.z = -0.3;
    rightArm.castShadow = true;
    group.add(rightArm);

    // 剑
    const swordGroup = new THREE.Group();
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 1.2, 0.02),
      new THREE.MeshStandardMaterial({
        color: 0xd0d0e0, metalness: 0.9, roughness: 0.2,
        emissive: 0x334477, emissiveIntensity: 0.1,
      })
    );
    blade.position.y = 0.6;
    blade.castShadow = true;
    swordGroup.add(blade);
    const hilt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.2, 6),
      new THREE.MeshStandardMaterial({ color: 0x6b3a1a, roughness: 0.85 })
    );
    hilt.position.y = -0.1;
    swordGroup.add(hilt);
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.04, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xddbb44, metalness: 0.7, roughness: 0.3 })
    );
    swordGroup.add(guard);

    swordGroup.position.set(0.55, 1.1, 0.3);
    swordGroup.userData.baseRot = { x: -0.2, y: 0, z: -0.5 };
    swordGroup.rotation.x = -0.2;
    swordGroup.rotation.z = -0.5;
    group.add(swordGroup);

    // 腿
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1a2535, roughness: 0.8 });
    for (let i = 0; i < 2; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.55, 6), legMat);
      leg.position.set((i ? 0.16 : -0.16), 0.3, 0);
      leg.castShadow = true;
      group.add(leg);
    }

    group.userData = {
      type: 'player', height: 2.35,
      sword: swordGroup, rightArm,
      isAttacking: false, attackTimer: 0,
    };
    return group;
  }

  // ========== 掉落物 ==========
  function createDropItem(type) {
    const group = new THREE.Group();
    const colors = {
      wolf_fang:   [0xeeeecc, 0x333322],
      slime_gel:   [0x66dd66, 0x226622],
      lava_core:   [0xff5500, 0xff3300],
      ice_crystal: [0xaaddff, 0x4488cc],
      iron_ore:    [0x9999aa, 0x333344],
      wood:        [0x8b6914, 0x221100],
      herb:        [0x66cc66, 0x226622],
    };
    const [col, em] = colors[type] || [0xffffff, 0x333333];

    const mat = new THREE.MeshStandardMaterial({
      color: col, emissive: em, emissiveIntensity: 0.4,
      roughness: 0.4, metalness: 0.4,
    });
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), mat);
    mesh.castShadow = true;
    group.add(mesh);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 8, 8),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.2 })
    );
    group.add(glow);

    group.userData = { type: 'dropItem', itemType: type, bobOffset: Math.random() * Math.PI * 2 };
    return group;
  }

  // 别名函数（保持向后兼容）
  function createSign(textures) { return createSignpost(textures); }
  function createFarm(textures) { return createFarmField(textures, 4, 3); }
  function createRockPillar(textures, scale) { return createSandPillar(textures, scale); }

  return {
    createTree, createHouse, createSignpost, createFarmField,
    createSandPillar, createLavaPool,
    createNPC, createEnemy, createPlayer, createDropItem,
    createSign, createFarm, createRockPillar,
  };
})();