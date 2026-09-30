// ==================== 碰撞系统 ====================
const CollisionSystem = (() => {
  const colliders = [];
  function addBox(centerX, centerZ, halfW, halfD, tag = 'wall') {
    colliders.push({ minX: centerX-halfW, maxX: centerX+halfW, minZ: centerZ-halfD, maxZ: centerZ+halfD, tag });
  }
  function addFromMeshGroup(group, opts = {}) {
    const shrinkX = opts.shrinkX||0, shrinkZ = opts.shrinkZ||0;
    const ignoreDoor = opts.ignoreDoor !== undefined ? opts.ignoreDoor : true;
    let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
    group.traverse((child) => {
      if (!child.isMesh) return;
      if (child.userData && child.userData.noCollision) return;
      if (child.geometry && child.geometry.parameters) {
        const p = child.geometry.parameters;
        let hw=0,hd=0;
        if (p.width!==undefined && p.depth!==undefined) { hw=p.width/2; hd=p.depth/2; }
        else if (p.radius!==undefined) { hw=p.radius; hd=p.radius; }
        else if (p.radiusTop!==undefined) { hw=Math.max(p.radiusTop,p.radiusBottom||0); hd=hw; }
        else return;
        const localX=child.position.x, localZ=child.position.z;
        const cosY=Math.cos(group.rotation.y), sinY=Math.sin(group.rotation.y);
        const worldOffsetX=localX*cosY-localZ*sinY;
        const worldOffsetZ=localX*sinY+localZ*cosY;
        const rotHW=Math.abs(hw*cosY)+Math.abs(hd*sinY);
        const rotHD=Math.abs(hw*sinY)+Math.abs(hd*cosY);
        const wx=group.position.x+worldOffsetX, wz=group.position.z+worldOffsetZ;
        minX=Math.min(minX,wx-rotHW); maxX=Math.max(maxX,wx+rotHW);
        minZ=Math.min(minZ,wz-rotHD); maxZ=Math.max(maxZ,wz+rotHD);
      }
    });
    if (minX===Infinity) return null;
    if (shrinkX>0) { minX+=shrinkX; maxX-=shrinkX; }
    if (shrinkZ>0) { minZ+=shrinkZ; maxZ-=shrinkZ; }
    if (ignoreDoor && opts.isHouse) {
      const doorWidth = opts.doorWidth||1.8, wallThickness = 0.5;
      const leftBox = { minX, maxX: minX+(maxX-minX)/2-doorWidth/2, minZ: maxZ-wallThickness, maxZ, tag:'wall_left' };
      const rightBox = { minX: minX+(maxX-minX)/2+doorWidth/2, maxX, minZ: maxZ-wallThickness, maxZ, tag:'wall_right' };
      const backBox = { minX, maxX, minZ, maxZ: minZ+wallThickness, tag:'wall_back' };
      const leftSideBox = { minX, maxX: minX+wallThickness, minZ, maxZ, tag:'wall_side_left' };
      const rightSideBox = { minX: maxX-wallThickness, maxX, minZ, maxZ, tag:'wall_side_right' };
      colliders.push(leftBox,rightBox,backBox,leftSideBox,rightSideBox);
      return [leftBox,rightBox,backBox,leftSideBox,rightSideBox];
    }
    const box = { minX, maxX, minZ, maxZ, tag: opts.tag||'obstacle' };
    colliders.push(box);
    return box;
  }
  function addCollider(minX, maxX, minZ, maxZ, tag='obstacle') {
    colliders.push({ minX, maxX, minZ, maxZ, tag });
  }
  function clear() { colliders.length = 0; }
  function resolveCollision(px, pz, radius) {
    let x = px, z = pz;
    for (let iter=0; iter<5; iter++) {
      let resolved = true;
      for (const box of colliders) {
        const insideX = x>box.minX && x<box.maxX;
        const insideZ = z>box.minZ && z<box.maxZ;
        if (insideX && insideZ) {
          const dL=x-box.minX, dR=box.maxX-x, dB=z-box.minZ, dT=box.maxZ-z;
          const minD=Math.min(dL,dR,dB,dT);
          const push=minD+radius+0.001;
          if (minD===dL) x=box.minX-push;
          else if (minD===dR) x=box.maxX+push;
          else if (minD===dB) z=box.minZ-push;
          else z=box.maxZ+push;
          resolved = false;
        } else {
          const cX=Math.max(box.minX,Math.min(x,box.maxX));
          const cZ=Math.max(box.minZ,Math.min(z,box.maxZ));
          const dx=x-cX, dz=z-cZ, dSq=dx*dx+dz*dz;
          if (dSq<radius*radius && dSq>0.000001) {
            const d=Math.sqrt(dSq), overlap=radius-d;
            x += (dx/d)*overlap; z += (dz/d)*overlap;
            resolved = false;
          }
        }
      }
      if (resolved) break;
    }
    return { x, z };
  }
  function checkCollision(px, pz, radius) {
    for (const box of colliders) {
      const cX=Math.max(box.minX,Math.min(px,box.maxX));
      const cZ=Math.max(box.minZ,Math.min(pz,box.maxZ));
      const dx=px-cX, dz=pz-cZ;
      if (dx*dx+dz*dz < radius*radius) return true;
    }
    return false;
  }
  function getAllColliders() { return colliders; }
  return { addBox, addFromMeshGroup, addCollider, clear, resolveCollision, checkCollision, getAllColliders };
})();