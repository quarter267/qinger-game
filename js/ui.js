// ==================== UI 系统 ====================
const UISystem = (() => {
  let dialogBox, dialogText, dialogName;
  let dialogQueue = [];
  let currentDialog = '';
  let typewriterIdx = 0;
  let typewriterTimer = 0;
  const TYPEWRITER_SPEED = 40; // ms per char
  let isDialogActive = false;
  let onDialogEnd = null;

  let forgePanel, isForgeOpen = false;
  let startScreen, gameContainer;

  function init() {
    dialogBox = document.getElementById('dialog-box');
    dialogText = document.getElementById('dialog-text');
    dialogName = document.getElementById('dialog-name');
    forgePanel = document.getElementById('forge-panel');
    startScreen = document.getElementById('start-screen');
    gameContainer = document.getElementById('game-container');

    // 对话框点击继续
    dialogBox.addEventListener('click', advanceDialog);
  }

  function showStartScreen() {
    startScreen.style.display = 'flex';
  }

  function hideStartScreen() {
    startScreen.style.display = 'none';
  }

  function startGame(mode) {
    hideStartScreen();
    gameContainer.style.display = 'block';
    PlayerController.setControlMode(mode);

    // 根据模式设置UI
    const mobileControls = document.getElementById('mobile-controls');
    if (mode === 'mobile') {
      mobileControls.style.display = 'block';
    } else {
      mobileControls.style.display = 'none';
    }
  }

  // ===== 对话框系统 =====
  function startDialog(npcName, dialogs, onEnd) {
    dialogQueue = [...dialogs];
    isDialogActive = true;
    onDialogEnd = onEnd;
    dialogName.textContent = npcName;
    dialogBox.style.display = 'block';
    nextDialog();
  }

  function nextDialog() {
    if (dialogQueue.length === 0) {
      endDialog();
      return;
    }
    currentDialog = dialogQueue.shift();
    typewriterIdx = 0;
    typewriterTimer = 0;
    dialogText.textContent = '';
  }

  function advanceDialog() {
    if (!isDialogActive) return;
    if (typewriterIdx < currentDialog.length) {
      // 跳过打字机效果
      typewriterIdx = currentDialog.length;
      dialogText.textContent = currentDialog;
    } else {
      nextDialog();
    }
  }

  function endDialog() {
    isDialogActive = false;
    dialogBox.style.display = 'none';
    if (onDialogEnd) {
      onDialogEnd();
      onDialogEnd = null;
    }
  }

  function update(dt) {
    if (isDialogActive && typewriterIdx < currentDialog.length) {
      typewriterTimer += dt * 1000;
      while (typewriterTimer >= TYPEWRITER_SPEED && typewriterIdx < currentDialog.length) {
        typewriterTimer -= TYPEWRITER_SPEED;
        typewriterIdx++;
        dialogText.textContent = currentDialog.substring(0, typewriterIdx);
      }
    }
  }

  function isDialogOpen() { return isDialogActive; }

  // ===== HUD 更新 =====
  function updateHUD(state) {
    const healthBar = document.querySelector('#hud .health-fill');
    const healthText = document.querySelector('#hud .health-text');
    const staminaBar = document.querySelector('#hud .stamina-fill');
    const staminaText = document.querySelector('#hud .stamina-text');
    const biomeText = document.getElementById('biome-name');
    const materialsDiv = document.getElementById('materials');

    if (healthBar) {
      healthBar.style.width = (state.health / state.maxHealth * 100) + '%';
      healthText.textContent = `${Math.floor(state.health)} / ${state.maxHealth}`;
    }
    if (staminaBar) {
      staminaBar.style.width = (state.stamina / state.maxStamina * 100) + '%';
      staminaText.textContent = `${Math.floor(state.stamina)} / ${state.maxStamina}`;
    }
    if (biomeText) {
      biomeText.textContent = state.biome;
    }
    if (materialsDiv) {
      const items = state.inventory;
      materialsDiv.innerHTML = `
        <div class="mat-item"><span class="mat-icon" style="background:#888899"></span>铁矿 ${items.iron_ore || 0}</div>
        <div class="mat-item"><span class="mat-icon" style="background:#55aa55"></span>凝胶 ${items.slime_gel || 0}</div>
        <div class="mat-item"><span class="mat-icon" style="background:#eeeecc"></span>狼牙 ${items.wolf_fang || 0}</div>
        <div class="mat-item"><span class="mat-icon" style="background:#ff5500"></span>火核 ${items.lava_core || 0}</div>
        <div class="mat-item"><span class="mat-icon" style="background:#aaddff"></span>冰晶 ${items.ice_crystal || 0}</div>
      `;
    }

    // 锻造面板等级显示
    const wepLv = document.getElementById('weapon-level');
    const armLv = document.getElementById('armor-level');
    if (wepLv) wepLv.textContent = `Lv.${state.weaponLevel}`;
    if (armLv) armLv.textContent = `Lv.${state.armorLevel}`;
  }

  // ===== 锻造面板 =====
  function openForge() {
    isForgeOpen = true;
    forgePanel.style.display = 'block';
    updateForgeInfo();
  }

  function closeForge() {
    isForgeOpen = false;
    forgePanel.style.display = 'none';
  }

  function toggleForge() {
    if (isForgeOpen) closeForge();
    else openForge();
  }

  function isForgePanelOpen() { return isForgeOpen; }

  function updateForgeInfo() {
    const state = PlayerController.getState();
    const nextWepLv = state.weaponLevel + 1;
    const nextArmLv = state.armorLevel + 1;
    const wepCost = { iron_ore: 3 + state.weaponLevel * 2, wolf_fang: state.weaponLevel };
    const armCost = { iron_ore: 2 + state.armorLevel * 2, slime_gel: 1 + state.armorLevel };

    document.getElementById('weapon-upgrade-cost').innerHTML =
      `升级到 Lv.${nextWepLv} 需要: 铁矿 ${wepCost.iron_ore}, 狼牙 ${wepCost.wolf_fang}`;
    document.getElementById('armor-upgrade-cost').innerHTML =
      `升级到 Lv.${nextArmLv} 需要: 铁矿 ${armCost.iron_ore}, 凝胶 ${armCost.slime_gel}`;

    // 按钮状态
    const wepBtn = document.getElementById('btn-upgrade-weapon');
    const armBtn = document.getElementById('btn-upgrade-armor');
    const canWep = PlayerController.canAfford(wepCost);
    const canArm = PlayerController.canAfford(armCost);
    wepBtn.disabled = !canWep;
    armBtn.disabled = !canArm;
    wepBtn.style.opacity = canWep ? 1 : 0.5;
    armBtn.style.opacity = canArm ? 1 : 0.5;
  }

  function upgradeWeapon() {
    if (PlayerController.upgradeWeapon()) {
      updateForgeInfo();
      showToast('武器升级成功！');
    }
  }

  function upgradeArmor() {
    if (PlayerController.upgradeArmor()) {
      updateForgeInfo();
      showToast('护甲升级成功！');
    }
  }

  // ===== Toast 提示 =====
  function showToast(msg, duration = 2000) {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.cssText = `
        position: fixed; top: 30%; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.8); color: #fff; padding: 12px 24px;
        border-radius: 8px; font-size: 16px; z-index: 1000;
        pointer-events: none; transition: opacity 0.3s;
        font-family: 'Microsoft YaHei', sans-serif;
      `;
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.opacity = '0';
    }, duration);
  }

  // ===== 互动提示 =====
  function setInteractPrompt(text) {
    const prompt = document.getElementById('interact-prompt');
    if (text) {
      prompt.textContent = text;
      prompt.style.display = 'block';
    } else {
      prompt.style.display = 'none';
    }
  }

  return {
    init,
    showStartScreen,
    hideStartScreen,
    startGame,
    update,
    startDialog,
    advanceDialog,
    isDialogOpen,
    updateHUD,
    openForge,
    closeForge,
    toggleForge,
    isForgePanelOpen,
    upgradeWeapon,
    upgradeArmor,
    updateForgeInfo,
    showToast,
    setInteractPrompt,
  };
})();