// ==================== 敌人AI系统 ====================
const EnemyAI = (() => {
  let scene, player;

  function init(sc, pl) {
    scene = sc;
    player = pl;
  }

  function spawnEnemy(type, x, z) {
    const enemy = WorldObjects.createEnemy(type);
    const y = Terrain.getHeight(x, z);
    enemy.position.set(x, y, z);
    scene.add(enemy);
    return enemy;
  }

  function update(dt) {
    const enemies = scene.children.filter(c => c.userData && c.userData.type === 'enemy');

    for (const enemy of enemies) {
      if (enemy.userData.health <= 0) continue;

      const px = player.position.x;
      const pz = player.position.z;
      const ex = enemy.position.x;
      const ez = enemy.position.z;
      const dx = px - ex;
      const dz = pz - ez;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // 攻击冷却
      enemy.userData.attackCooldown = Math.max(0, enemy.userData.attackCooldown - dt);

      // 受伤闪烁
      if (enemy.userData.hitFlash > 0) {
        enemy.userData.hitFlash -= dt;
        // 闪红
        enemy.traverse((ch) => {
          if (ch.isMesh && ch.material && ch.material.emissive) {
            ch.material.emissive.setHex(0xff0000);
            ch.material.emissiveIntensity = 0.5;
          }
        });
      } else {
        // 恢复
        enemy.traverse((ch) => {
          if (ch.isMesh && ch.material && ch.material.emissive) {
            // 根据敌人类型恢复
            if (enemy.userData.enemyType === 'golem') {
              ch.material.emissive.setHex(0xff3300);
              ch.material.emissiveIntensity = 0.15;
            } else if (enemy.userData.enemyType === 'ice_wraith') {
              ch.material.emissive.setHex(0x66aaff);
              ch.material.emissiveIntensity = 0.5;
            } else if (enemy.userData.enemyType === 'slime') {
              ch.material.emissive.setHex(0x113311);
              ch.material.emissiveIntensity = 0.3;
            } else if (enemy.userData.enemyType === 'wolf') {
              ch.material.emissive.setHex(0xff3300);
              ch.material.emissiveIntensity = 0.8;
            }
          }
        });
      }

      // 状态机
      const aggroRange = enemy.userData.isBoss ? 30 : 12;
      const attackRange = enemy.userData.isBoss ? 3.5 : 2;

      if (dist < attackRange && enemy.userData.attackCooldown <= 0) {
        // 攻击
        enemy.userData.state = 'attack';
        enemy.userData.attackCooldown = enemy.userData.isBoss ? 2.0 : 1.2;
        PlayerController.takeDamage(enemy.userData.attackDamage);
      } else if (dist < aggroRange) {
        // 追击
        enemy.userData.state = 'chase';
        const speed = enemy.userData.speed;
        const moveX = (dx / dist) * speed * dt;
        const moveZ = (dz / dist) * speed * dt;
        enemy.position.x += moveX;
        enemy.position.z += moveZ;

        // 地面贴合
        const groundY = Terrain.getHeight(enemy.position.x, enemy.position.z);
        enemy.position.y = groundY;

        // 朝向玩家
        enemy.rotation.y = Math.atan2(dx, dz);
      } else {
        // 游荡
        enemy.userData.state = 'idle';
        enemy.userData.idleTimer -= dt;
        if (enemy.userData.idleTimer <= 0) {
          enemy.userData.idleTimer = 2 + Math.random() * 3;
          const angle = Math.random() * Math.PI * 2;
          const r = 3 + Math.random() * 5;
          enemy.userData.idleTarget = {
            x: enemy.position.x + Math.cos(angle) * r,
            z: enemy.position.z + Math.sin(angle) * r,
          };
        }
        if (enemy.userData.idleTarget) {
          const tdx = enemy.userData.idleTarget.x - enemy.position.x;
          const tdz = enemy.userData.idleTarget.z - enemy.position.z;
          const td = Math.sqrt(tdx * tdx + tdz * tdz);
          if (td > 0.5) {
            const speed = enemy.userData.speed * 0.3;
            enemy.position.x += (tdx / td) * speed * dt;
            enemy.position.z += (tdz / td) * speed * dt;
            enemy.rotation.y = Math.atan2(tdx, tdz);
          }
          const groundY = Terrain.getHeight(enemy.position.x, enemy.position.z);
          enemy.position.y = groundY;
        }
      }

      // 检查死亡
      if (enemy.userData.health <= 0 && !enemy.userData.dead) {
        enemy.userData.dead = true;
        onEnemyDeath(enemy);
      }
    }

    // 清理死亡敌人（淡出后移除）
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (enemy.userData.dead) {
        enemy.userData.deathTimer = (enemy.userData.deathTimer || 0) + dt;
        const alpha = Math.max(0, 1 - enemy.userData.deathTimer * 2);
        enemy.traverse((ch) => {
          if (ch.isMesh && ch.material) {
            ch.material.transparent = true;
            ch.material.opacity = alpha;
          }
        });
        enemy.position.y -= dt * 2; // 下沉
        if (enemy.userData.deathTimer > 0.5) {
          scene.remove(enemy);
        }
      }
    }
  }

  function onEnemyDeath(enemy) {
    // 掉落物
    const type = enemy.userData.enemyType;
    let drops = [];
    if (type === 'slime') {
      drops = [{ type: 'slime_gel', count: 1 + Math.floor(Math.random() * 2) }];
    } else if (type === 'wolf') {
      drops = [
        { type: 'wolf_fang', count: 1 + Math.floor(Math.random() * 2) },
        { type: 'iron_ore', count: Math.random() > 0.5 ? 1 : 0 },
      ];
    } else if (type === 'golem') {
      drops = [
        { type: 'lava_core', count: 3 },
        { type: 'iron_ore', count: 5 },
      ];
    } else if (type === 'ice_wraith') {
      drops = [
        { type: 'ice_crystal', count: 3 },
        { type: 'iron_ore', count: 3 },
      ];
    }

    for (const drop of drops) {
      for (let i = 0; i < drop.count; i++) {
        const item = WorldObjects.createDropItem(drop.type);
        const angle = Math.random() * Math.PI * 2;
        const r = Math.random() * 1.5;
        item.position.set(
          enemy.position.x + Math.cos(angle) * r,
          enemy.position.y + 1,
          enemy.position.z + Math.sin(angle) * r
        );
        scene.add(item);
      }
    }
  }

  // 初始化所有区域敌人
  function spawnAllEnemies() {
    const W = Terrain.WORLD_SIZE;
    const half = W / 2;

    // 青耳原野：史莱姆
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 80 + Math.random() * 150;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      spawnEnemy('slime', x, z);
    }

    // 赤沙雅丹：狼
    for (let i = 0; i < 6; i++) {
      const x = half * 0.6 + (Math.random() - 0.5) * 300;
      const z = (Math.random() - 0.5) * 300;
      spawnEnemy('wolf', x, z);
    }

    // 幽暗古林：狼+史莱姆
    for (let i = 0; i < 5; i++) {
      const x = -half * 0.6 + (Math.random() - 0.5) * 300;
      const z = (Math.random() - 0.5) * 300;
      spawnEnemy('wolf', x, z);
    }
    for (let i = 0; i < 4; i++) {
      const x = -half * 0.5 + (Math.random() - 0.5) * 250;
      const z = (Math.random() - 0.5) * 250;
      spawnEnemy('slime', x, z);
    }

    // 寒渊雪原BOSS：冰幽灵
    spawnEnemy('ice_wraith', 0, -half * 0.65);

    // 熔岩裂谷BOSS：石巨人
    spawnEnemy('golem', 0, half * 0.65);

    // 熔岩区小怪
    for (let i = 0; i < 4; i++) {
      const x = (Math.random() - 0.5) * 200;
      const z = half * 0.55 + (Math.random() - 0.5) * 150;
      spawnEnemy('wolf', x, z);
    }
  }

  return {
    init,
    update,
    spawnEnemy,
    spawnAllEnemies,
  };
})();

// ==================== NPC 系统 ====================
const NPCSystem = (() => {
  let scene, player, textures;
  const npcs = [];

  function init(sc, pl, tex) {
    scene = sc;
    player = pl;
    textures = tex;

    // NPC位置与村庄建筑对应
    // 村长：村长家门口
    const elderY = Terrain.getHeight(0, 20);
    const elder = WorldObjects.createNPC(textures, 'elder');
    elder.position.set(2, elderY, 22);
    elder.userData.npcName = '村长·石砚';
    elder.userData.dialogs = [
      '欢迎来到青耳村，远方的旅人。',
      '此地名为青耳，乃五域之中枢。',
      '东有赤沙雅丹，黄沙漫天；北有寒渊雪原，冰封千里。',
      '西有幽暗古林，妖兽横行；南有熔岩裂谷，地火焚天。',
      '近年来妖魔四起，五域动荡，民不聊生。',
      '你若有侠义之心，可往五域历练，斩妖除魔。',
      '村中阿锤善锻造，可为你炼制神兵；阿苓通医理，能为你疗伤续命。',
    ];
    elder.userData.role = 'elder';
    elder.userData.interactRange = 3;
    scene.add(elder);
    npcs.push(elder);

    // 铁匠：铁匠铺门口
    const smithY = Terrain.getHeight(-28, 10);
    const smith = WorldObjects.createNPC(textures, 'smith');
    smith.position.set(-24, smithY, 10);
    smith.rotation.y = Math.PI / 2;
    smith.userData.npcName = '铁匠·阿锤';
    smith.userData.dialogs = [
      '嘿！朋友，来打兵器吗？',
      '我这双手，打了三十年的铁，从不失手。',
      '斩妖除魔，得有趁手的家伙事儿。',
      '你带回来的材料，我都能给你熔炼成神兵利器。',
      '狼牙硬，可以增加剑锋的韧性。',
      '铁矿嘛，当然是打造兵刃的根基。',
      '想升级装备，就打开锻造炉看看吧。',
    ];
    smith.userData.role = 'smith';
    smith.userData.interactRange = 3;
    scene.add(smith);
    npcs.push(smith);

    // 药师：药庐门口
    const healerY = Terrain.getHeight(28, -5);
    const healer = WorldObjects.createNPC(textures, 'healer');
    healer.position.set(25, healerY, -3);
    healer.rotation.y = -Math.PI / 2;
    healer.userData.npcName = '药师·阿苓';
    healer.userData.dialogs = [
      '你来了，请坐。让我看看你的伤势。',
      '五域各有灵药，善用之可起死回生。',
      '雪原的冰晶可凝气，熔岩的火核可聚元。',
      '古林深处有千年老参，沙漠中有金色胡杨。',
      '你若受伤，随时可来找我。',
      '……记住，医者仁心，侠者仁剑。',
    ];
    healer.userData.role = 'healer';
    healer.userData.interactRange = 3;
    scene.add(healer);
    npcs.push(healer);

    // 杂货铺老板
    const merchY = Terrain.getHeight(-15, -20);
    const merchant = WorldObjects.createNPC(textures, 'merchant');
    merchant.position.set(-13, merchY, -18);
    merchant.rotation.y = Math.PI / 3;
    merchant.userData.npcName = '杂货商·老王';
    merchant.userData.dialogs = [
      '客官要点什么？我这儿货可全了。',
      '从五域收来的稀奇玩意儿，应有尽有。',
      '沙漠的香料，雪原的皮毛，古林的草药……',
      '唉，就是最近路上不太平，货不好运啊。',
      '那些妖魔要是不除，我们做买卖的也没法安生。',
    ];
    merchant.userData.role = 'merchant';
    merchant.userData.interactRange = 3;
    scene.add(merchant);
    npcs.push(merchant);

    // 渔夫
    const fisherY = Terrain.getHeight(50, 15);
    const fisher = WorldObjects.createNPC(textures, 'fisher');
    fisher.position.set(52, fisherY, 18);
    fisher.rotation.y = -Math.PI / 3;
    fisher.userData.npcName = '渔夫·阿海';
    fisher.userData.dialogs = [
      '今天的收成还行，就是河水越来越怪了。',
      '以前这条青耳河清得能看见底，现在……',
      '听说上游出了妖物，把河水都搅浑了。',
      '少侠要是能去看看，我们全村都感激不尽。',
      '河里的鱼都变少了，再这样下去可怎么活哟。',
    ];
    fisher.userData.role = 'fisher';
    fisher.userData.interactRange = 3;
    scene.add(fisher);
    npcs.push(fisher);
  }

  function getNearbyNPC() {
    for (const npc of npcs) {
      const dx = npc.position.x - player.position.x;
      const dz = npc.position.z - player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < npc.userData.interactRange) {
        return npc;
      }
    }
    return null;
  }

  function update(dt) {
    // NPC面向玩家（当玩家靠近时）
    for (const npc of npcs) {
      const dx = player.position.x - npc.position.x;
      const dz = player.position.z - npc.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 5) {
        const targetAngle = Math.atan2(dx, dz);
        let diff = targetAngle - npc.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        npc.rotation.y += diff * Math.min(1, dt * 3);
      }
    }
  }

  function getNPCs() { return npcs; }

  return {
    init,
    update,
    getNearbyNPC,
    getNPCs,
  };
})();