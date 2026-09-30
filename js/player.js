// ==================== 玩家控制器 ====================
const PlayerController = (() => {

  let player, camera, scene, terrain;
  let controlMode = 'pc'; // pc, mobile, gamepad

  // 相机参数
  let camDistance = 8;
  let camYaw = 0;      // 水平角
  let camPitch = 0.25; // 俯仰角
  let camMode = 'third'; // third, first, front
  const PITCH_MIN = -1.3; // 约75度向下
  const PITCH_MAX = 1.3;  // 约75度向上

  // 玩家碰撞半径
  const PLAYER_RADIUS = 0.5;

  // 移动
  const moveSpeed = 6;
  const sprintSpeed = 10;
  const jumpForce = 8;
  const gravity = 20;
  let velocityY = 0;
  let isGrounded = false;
  let isSprinting = false;

  // 输入状态
  const keys = {};
  let mouseDown = false;
  let pointerLocked = false;

  // 攻击
  let attackCooldown = 0;
  const ATTACK_COOLDOWN = 0.6;
  const ATTACK_RANGE = 2.5;
  const ATTACK_DAMAGE = 15;

  // 玩家属性
  let maxHealth = 100;
  let health = 100;
  let maxStamina = 100;
  let stamina = 100;
  let staminaRegen = 15;
  let sprintStaminaCost = 20;
  let attackStaminaCost = 15;

  // 材料背包
  const inventory = {
    wolf_fang: 0,
    slime_gel: 0,
    lava_core: 0,
    ice_crystal: 0,
    iron_ore: 0,
    wood: 0,
  };

  // 武器等级
  let weaponLevel = 1;
  let armorLevel = 1;

  // 伤害冷却
  let damageCooldown = 0;

  function init(playerMesh, cam, scn, terr) {
    player = playerMesh;
    camera = cam;
    scene = scn;
    terrain = terr;

    // 初始位置：青耳村
    player.position.set(0, 30, 0);
  }

  function setControlMode(mode) {
    controlMode = mode;
  }

  function getControlMode() {
    return controlMode;
  }

  function cycleCameraMode() {
    const modes = ['third', 'first', 'front'];
    const idx = modes.indexOf(camMode);
    camMode = modes[(idx + 1) % modes.length];
    return camMode;
  }

  function setCameraMode(mode) {
    camMode = mode;
  }

  function getCameraMode() {
    return camMode;
  }

  // 键盘事件
  function onKeyDown(e) {
    keys[e.code] = true;
    if (e.code === 'KeyV') {
      cycleCameraMode();
    }
    if (e.code === 'Space') {
      tryAttack();
    }
  }

  function onKeyUp(e) {
    keys[e.code] = false;
  }

  // 鼠标事件
  function onMouseMove(e) {
    // PC模式必须pointer locked才响应
    if (controlMode === 'pc' && !pointerLocked) return;
    // mobile模式下由touch事件控制，mousemove不处理
    if (controlMode === 'mobile') return;
    // gamepad/PC 响应鼠标移动
    const sensitivity = 0.0022;
    camYaw -= e.movementX * sensitivity;
    camPitch -= e.movementY * sensitivity;
    camPitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, camPitch));
  }

  function onMouseDown(e) {
    if (e.button === 0) {
      mouseDown = true;
      tryAttack();
    }
  }

  function onMouseUp(e) {
    if (e.button === 0) mouseDown = false;
  }

  function setPointerLocked(v) {
    pointerLocked = v;
  }

  // 移动端视角控制
  function addYawPitch(dy, dp) {
    const sensitivity = 0.006;
    camYaw -= dy * sensitivity;
    camPitch -= dp * sensitivity;
    camPitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, camPitch));
  }

  // 移动端输入 (-1 ~ 1)
  let mobileMove = { x: 0, y: 0 };
  let mobileJump = false;
  let mobileSprint = false;
  function setMobileMove(x, y) {
    mobileMove.x = x;
    mobileMove.y = y;
  }
  function tryJump() {
    if (isGrounded) {
      velocityY = jumpForce;
      isGrounded = false;
    }
  }
  function setSprinting(v) {
    mobileSprint = v;
  }

  // 尝试攻击
  function tryAttack() {
    if (attackCooldown > 0) return;
    if (stamina < attackStaminaCost) return;
    attackCooldown = ATTACK_COOLDOWN;
    stamina -= attackStaminaCost;
    player.userData.isAttacking = true;
    player.userData.attackTimer = 0;

    // 检测命中敌人
    const enemies = scene.children.filter(c => c.userData && c.userData.type === 'enemy' && c.userData.health > 0);
    for (const enemy of enemies) {
      const dx = enemy.position.x - player.position.x;
      const dz = enemy.position.z - player.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < ATTACK_RANGE + (enemy.userData.isBoss ? 1.5 : 0.5)) {
        // 检查朝向
        const forward = new THREE.Vector3(
          -Math.sin(camYaw), 0, -Math.cos(camYaw)
        );
        const toEnemy = new THREE.Vector3(dx, 0, dz).normalize();
        const dot = forward.dot(toEnemy);
        if (dot > 0.3) {
          const dmg = ATTACK_DAMAGE + (weaponLevel - 1) * 8;
          enemy.userData.health -= dmg;
          enemy.userData.hitFlash = 0.2;
          // 击退
          enemy.position.x += toEnemy.x * 0.5;
          enemy.position.z += toEnemy.z * 0.5;
        }
      }
    }
  }

  function update(dt) {
    attackCooldown = Math.max(0, attackCooldown - dt);
    damageCooldown = Math.max(0, damageCooldown - dt);

    // 挥剑动画
    if (player.userData.isAttacking) {
      player.userData.attackTimer += dt;
      const t = player.userData.attackTimer / ATTACK_COOLDOWN;
      if (t >= 1) {
        player.userData.isAttacking = false;
      }
      const swingAngle = Math.sin(t * Math.PI) * 1.5;
      player.userData.sword.rotation.z = player.userData.sword.userData.baseRot.z - swingAngle;
      player.userData.sword.rotation.x = player.userData.sword.userData.baseRot.x + swingAngle * 0.5;
    } else {
      player.userData.sword.rotation.z = player.userData.sword.userData.baseRot.z;
      player.userData.sword.rotation.x = player.userData.sword.userData.baseRot.x;
    }

    // 移动方向计算
    let moveX = 0, moveZ = 0;
    if (controlMode === 'pc' || controlMode === 'gamepad') {
      if (keys['KeyW']) moveZ -= 1;
      if (keys['KeyS']) moveZ += 1;
      if (keys['KeyA']) moveX -= 1;
      if (keys['KeyD']) moveX += 1;
    } else if (controlMode === 'mobile') {
      moveX = mobileMove.x;
      moveZ = mobileMove.y; // 摇杆y是前后
    }

    // 归一化
    const moveLen = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (moveLen > 1) {
      moveX /= moveLen;
      moveZ /= moveLen;
    }

    // 冲刺
    isSprinting = (keys['ShiftLeft'] || keys['ShiftRight'] || mobileSprint) && moveLen > 0 && stamina > 0;
    if (isSprinting) {
      stamina -= sprintStaminaCost * dt;
      if (stamina < 0) { stamina = 0; isSprinting = false; }
    } else {
      stamina = Math.min(maxStamina, stamina + staminaRegen * dt);
    }

    const speed = isSprinting ? sprintSpeed : moveSpeed;

    // 基于相机方向的移动
    const sinYaw = Math.sin(camYaw);
    const cosYaw = Math.cos(camYaw);
    const forwardX = -sinYaw;
    const forwardZ = -cosYaw;
    const rightX = cosYaw;
    const rightZ = -sinYaw;

    const dx = (forwardX * moveZ + rightX * moveX) * speed * dt;
    const dz = (forwardZ * moveZ + rightZ * moveX) * speed * dt;

    player.position.x += dx;
    player.position.z += dz;

    // ===== 碰撞检测：球体 vs AABB =====
    const resolved = CollisionSystem.resolveCollision(
      player.position.x, player.position.z, PLAYER_RADIUS
    );
    player.position.x = resolved.x;
    player.position.z = resolved.z;

    // 世界边界
    const half = Terrain.WORLD_SIZE / 2 - 50;
    player.position.x = Math.max(-half, Math.min(half, player.position.x));
    player.position.z = Math.max(-half, Math.min(half, player.position.z));

    // 玩家朝向（移动方向或相机方向）
    if (moveLen > 0.01) {
      const targetAngle = Math.atan2(dx, dz);
      // 平滑转向
      let diff = targetAngle - player.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      player.rotation.y += diff * Math.min(1, dt * 10);
    }

    // 重力与跳跃
    velocityY -= gravity * dt;
    player.position.y += velocityY * dt;

    // 地面检测
    const groundY = Terrain.getHeight(player.position.x, player.position.z);
    if (player.position.y <= groundY + 0.1) {
      player.position.y = groundY + 0.1;
      velocityY = 0;
      isGrounded = true;
    } else {
      isGrounded = false;
    }

    // 跳跃（F键或移动端跳跃按钮）
    if ((keys['KeyF'] || mobileJump) && isGrounded) {
      velocityY = jumpForce;
      isGrounded = false;
      mobileJump = false;
    }

    // 更新相机
    updateCamera();

    // 受伤闪烁
    if (player.userData.hitFlash > 0) {
      player.userData.hitFlash -= dt;
    }

    // 拾取物品
    const drops = scene.children.filter(c => c.userData && c.userData.type === 'dropItem');
    for (let i = drops.length - 1; i >= 0; i--) {
      const drop = drops[i];
      const d = Math.sqrt(
        Math.pow(drop.position.x - player.position.x, 2) +
        Math.pow(drop.position.z - player.position.z, 2)
      );
      if (d < 2) {
        inventory[drop.userData.itemType] = (inventory[drop.userData.itemType] || 0) + 1;
        scene.remove(drop);
      }
    }
  }

  function updateCamera() {
    const px = player.position.x;
    const py = player.position.y + 1.7; // 眼高
    const pz = player.position.z;

    if (camMode === 'first') {
      camera.position.set(px, py, pz);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = camYaw;
      camera.rotation.x = camPitch;
    } else {
      // 第三人称：相机在玩家后方
      const dist = camMode === 'front' ? -camDistance : camDistance;
      const offsetX = Math.sin(camYaw) * Math.cos(camPitch) * dist;
      const offsetY = Math.sin(camPitch) * dist;
      const offsetZ = Math.cos(camYaw) * Math.cos(camPitch) * dist;

      // 相机目标点
      const targetX = px;
      const targetY = py - 0.3;
      const targetZ = pz;

      camera.position.set(targetX + offsetX, targetY + offsetY, targetZ + offsetZ);

      if (camMode === 'front') {
        // 正面视角：镜头从前方看玩家，镜头朝后看玩家
        camera.lookAt(targetX, targetY, targetZ);
      } else {
        camera.lookAt(targetX, targetY, targetZ);
      }

      // 相机碰撞检测（简单：保持在地面以上）
      const camGroundY = Terrain.getHeight(camera.position.x, camera.position.z);
      if (camera.position.y < camGroundY + 1) {
        camera.position.y = camGroundY + 1;
      }
    }
  }

  function takeDamage(amount) {
    if (damageCooldown > 0) return;
    const actualDamage = Math.max(1, amount - (armorLevel - 1) * 3);
    health -= actualDamage;
    damageCooldown = 0.8;
    player.userData.hitFlash = 0.3;

    // 屏幕受击红边效果
    const vignette = document.getElementById('damage-vignette');
    if (vignette) {
      vignette.style.boxShadow = 'inset 0 0 120px 40px rgba(255, 0, 0, 0.6)';
      setTimeout(() => {
        vignette.style.boxShadow = 'inset 0 0 100px 30px rgba(255, 0, 0, 0)';
      }, 150);
    }

    if (health <= 0) {
      health = 0;
      // 死亡：回到出生点
      player.position.set(0, 50, 0);
      health = maxHealth;
      stamina = maxStamina;
    }
  }

  function heal(amount) {
    health = Math.min(maxHealth, health + amount);
  }

  // 锻造升级
  function upgradeWeapon() {
    const cost = { iron_ore: 3 + weaponLevel * 2, wolf_fang: weaponLevel };
    if (canAfford(cost)) {
      spendItems(cost);
      weaponLevel++;
      return true;
    }
    return false;
  }

  function upgradeArmor() {
    const cost = { iron_ore: 2 + armorLevel * 2, slime_gel: 1 + armorLevel };
    if (canAfford(cost)) {
      spendItems(cost);
      armorLevel++;
      maxHealth += 20;
      health += 20;
      return true;
    }
    return false;
  }

  function canAfford(cost) {
    for (const [item, qty] of Object.entries(cost)) {
      if ((inventory[item] || 0) < qty) return false;
    }
    return true;
  }

  function spendItems(cost) {
    for (const [item, qty] of Object.entries(cost)) {
      inventory[item] -= qty;
    }
  }

  function getPosition() {
    return player.position.clone();
  }

  function getYaw() { return camYaw; }

  function getState() {
    return {
      health, maxHealth,
      stamina, maxStamina,
      weaponLevel, armorLevel,
      inventory: { ...inventory },
      biome: Terrain.getBiomeName(player.position.x, player.position.z),
    };
  }

  return {
    init,
    update,
    onKeyDown,
    onKeyUp,
    onMouseMove,
    onMouseDown,
    onMouseUp,
    setPointerLocked,
    setControlMode,
    getControlMode,
    setMobileMove,
    addYawPitch,
    tryAttack,
    tryJump,
    setSprinting,
    cycleCameraMode,
    setCameraMode,
    getCameraMode,
    takeDamage,
    heal,
    getPosition,
    getYaw,
    getState,
    upgradeWeapon,
    upgradeArmor,
    canAfford,
  };
})();