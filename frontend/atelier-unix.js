/* Unix NFT atelier — 3D Web3 workbench (last script wins).
   Cel-shaded dusk lot, dual sticks (move + look), free-place compose.
   Not a homepage iframe. Not a voxel room. */
(function () {
  'use strict';
  var PT = (function () {
    try {
      if (window.__FORCE_LANG === 'en') return false;
      if (window.LANG === 'en') return false;
      if ((document.documentElement.lang || '').toLowerCase().indexOf('en') === 0) return false;
      if (location.pathname.indexOf('/en') === 0) return false;
    } catch (_) {}
    return true;
  })();
  function t(pt, en) { return PT ? pt : en; }

  function removeHomepageIframe() {
    var ifr = document.getElementById('atelierFrame');
    if (ifr && ifr.parentNode) ifr.parentNode.removeChild(ifr);
    var os = document.getElementById('atelierOs');
    if (os) os.style.display = 'none';
    var wrap = document.getElementById('bancadaLegacyWrap');
    if (wrap) wrap.style.display = 'block';
    var stage = document.getElementById('bancadaStage');
    if (stage) {
      stage.style.display = 'block';
      stage.style.touchAction = 'none';
    }
    var title = document.getElementById('bancadaPanelTitle');
    if (title) {
      title.style.display = '';
      title.textContent = t('Atelier Unix · NFT nesta conta', 'Unix Atelier · NFTs of this account');
    }
  }

  function toon(c, e, em) {
    if (typeof THREE === 'undefined') return null;
    if (THREE.MeshToonMaterial) {
      return new THREE.MeshToonMaterial({ color: c, emissive: e || 0x000000, emissiveIntensity: em || 0 });
    }
    return new THREE.MeshLambertMaterial({ color: c, emissive: e || 0x000000, emissiveIntensity: em || 0 });
  }
  function outline(mesh, col) {
    if (!mesh || !mesh.geometry || !THREE.EdgesGeometry) return;
    mesh.add(new THREE.LineSegments(
      new THREE.EdgesGeometry(mesh.geometry),
      new THREE.LineBasicMaterial({ color: col || 0x1a1008, transparent: true, opacity: 0.55 })
    ));
  }

  function Bref() { return window.B; }

  function restyleLot() {
    var B = Bref();
    if (!B || !B.scene || typeof THREE === 'undefined') return false;
    if (B._unixLot) return true;

    /* drop cube-room leftovers */
    var drop = [];
    B.scene.children.forEach(function (ch) {
      if (ch === B.root || ch === B.avatar || ch === B.camera) return;
      drop.push(ch);
    });
    drop.forEach(function (ch) { B.scene.remove(ch); });
    if (B.door) { B.scene.remove(B.door); B.door = null; }

    B.scene.background = new THREE.Color(0x2a140c);
    B.scene.fog = new THREE.FogExp2(0xc45a28, 0.046);
    B.HALF = 9.4;
    B.HEIGHT = 4.2;
    B.scene.add(new THREE.HemisphereLight(0xffc878, 0x3a1810, 0.95));
    var sun = new THREE.DirectionalLight(0xffe0a8, 0.85);
    sun.position.set(4, 9, 3);
    B.scene.add(sun);

    var sky = new THREE.Mesh(
      new THREE.SphereGeometry(38, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0x4a1c10, side: THREE.BackSide, fog: false })
    );
    B.scene.add(sky);

    var street = new THREE.Mesh(new THREE.PlaneGeometry(B.HALF * 2.4, B.HALF * 2.4), toon(0x3a2a22));
    street.rotation.x = -Math.PI / 2;
    street.position.y = 0;
    B.scene.add(street);
    var lane = new THREE.Mesh(new THREE.PlaneGeometry(2.2, B.HALF * 2.2), toon(0x2a1c16));
    lane.rotation.x = -Math.PI / 2;
    lane.position.y = 0.01;
    B.scene.add(lane);
    var dashMat = toon(0xd4a017);
    for (var i = -8; i <= 8; i++) {
      var d = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.55), dashMat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(0, 0.02, i * 1.05);
      B.scene.add(d);
    }

    function shop(x, z, rotY, w, h, col, sign) {
      var g = new THREE.Group();
      var body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.55), toon(col));
      body.position.y = h / 2;
      outline(body, 0x1a1008);
      g.add(body);
      var awn = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.08, 0.7), toon(0x8a2a1a));
      awn.position.set(0, h * 0.62, 0.45);
      g.add(awn);
      var win = new THREE.Mesh(
        new THREE.PlaneGeometry(w * 0.55, h * 0.28),
        toon(0xffc878, 0xff9a2e, 0.7)
      );
      win.position.set(0, h * 0.38, 0.29);
      g.add(win);
      if (sign) {
        var c = document.createElement('canvas');
        c.width = 256; c.height = 64;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#1a1008'; ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = '#ffe6b8';
        ctx.font = '600 22px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(sign, 128, 40);
        var spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
        spr.scale.set(1.6, 0.4, 1);
        spr.position.set(0, h + 0.28, 0.2);
        g.add(spr);
      }
      g.position.set(x, 0, z);
      g.rotation.y = rotY;
      B.scene.add(g);
      return g;
    }
    var palette = [0xf3e2c4, 0xc48a3a, 0x8a4a24, 0xd4a017, 0x6b2e1c, 0xe8c4a0];
    var names = ['NÓ', 'ÁGORA', 'CLP', 'SCA', 'FOG', 'ENI', 'STRATA', 'MESH'];
    if (!PT) names = ['NODE', 'AGORA', 'CLP', 'SCA', 'FOG', 'ENI', 'STRATA', 'MESH'];
    for (var s = 0; s < 8; s++) {
      shop(-8.4, -6.2 + s * 1.7, Math.PI / 2, 1.55, 2.1 + (s % 3) * 0.35, palette[s % palette.length], names[s]);
      shop(8.4, -6.2 + s * 1.7, -Math.PI / 2, 1.55, 2.2 + ((s + 1) % 3) * 0.3, palette[(s + 2) % palette.length], names[(s + 4) % names.length]);
    }
    function lantern(x, z) {
      var g = new THREE.Group();
      var pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.4, 8), toon(0x2a1c14));
      pole.position.y = 1.2; g.add(pole);
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), toon(0xffd27a, 0xff9a2e, 1.15));
      bulb.position.y = 2.35; g.add(bulb);
      g.position.set(x, 0, z);
      B.scene.add(g);
      var light = new THREE.PointLight(0xffb060, 0.55, 6, 2);
      light.position.set(x, 2.3, z);
      B.scene.add(light);
    }
    lantern(-2.2, -4.4); lantern(2.2, -4.4); lantern(-2.2, 4.4); lantern(2.2, 4.4);

    var door = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 2.2, 0.12),
      toon(0xc45c4a, 0x7a2018, 0.4)
    );
    door.position.set(0, 1.1, B.HALF - 0.2);
    outline(door, 0xd4a017);
    B.scene.add(door);
    B.door = door;

    if (B.avatar) {
      try { B.scene.remove(B.avatar); } catch (_) {}
    }
    var av = new THREE.Group();
    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.55, 10), toon(0x1a4a52));
    torso.position.y = 1.05;
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), toon(0xe8c4a0));
    head.position.y = 1.48;
    var hair = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), toon(0x1a1008));
    hair.scale.set(1, 0.55, 1.05);
    hair.position.y = 1.58;
    av.add(torso); av.add(head); av.add(hair);
    outline(torso, 0x0a0806); outline(head, 0x0a0806);
    B.avatar = av;
    B.avatarHips = torso;
    B.scene.add(av);

    if (B.controls) {
      B.controls.minPolarAngle = 0.35;
      B.controls.maxPolarAngle = 1.15;
      B.controls.minDistance = 2.2;
      B.controls.maxDistance = 16;
      B.controls.target.set(0, 1.1, 0);
      B.camera.position.set(5.4, 6.2, 7.6);
      B.controls.update();
    }
    B._unixLot = true;
    return true;
  }

  function propMesh(kind, scale, color) {
    var s = scale || 1;
    var geo;
    if (kind === 'lamp') geo = new THREE.SphereGeometry(0.22 * s, 12, 10);
    else if (kind === 'column') geo = new THREE.CylinderGeometry(0.14 * s, 0.18 * s, 0.7 * s, 10);
    else if (kind === 'vase') geo = new THREE.CylinderGeometry(0.12 * s, 0.2 * s, 0.45 * s, 10);
    else if (kind === 'disc') geo = new THREE.CylinderGeometry(0.32 * s, 0.32 * s, 0.08 * s, 16);
    else if (kind === 'crystal') geo = new THREE.OctahedronGeometry(0.28 * s, 0);
    else geo = new THREE.SphereGeometry(0.24 * s, 10, 8);
    var mesh = new THREE.Mesh(geo, toon(color, color, 0.12));
    outline(mesh, 0x1a1008);
    mesh.userData.pick = true;
    return mesh;
  }

  var _buildPrev = null;
  function wrapBuildTopology() {
    if (typeof window.buildTopology !== 'function' && window.B && !window.B._unixWrap) {
      /* buildTopology is closed in an IIFE; hook after loadSandboxBench paints */
    }
  }

  function dressNodes() {
    var B = Bref();
    if (!B || !B.root || typeof THREE === 'undefined') return;
    var kinds = ['lamp', 'column', 'vase', 'disc', 'crystal'];
    B.root.children.forEach(function (g, i) {
      if (g.userData && g.userData.unixDressed) return;
      g.userData.unixDressed = true;
      g.userData.frozen = false;
      g.userData.vel = { x: 0, y: 0, z: 0 };
      /* hide cubic nested bits — keep core + label */
      var keep = [];
      g.children.forEach(function (ch) {
        if (ch.isSprite || (ch.userData && ch.userData.pick) || ch.type === 'Sprite') keep.push(ch);
        else if (ch.geometry && ch.geometry.type && /Octahedron|Sphere/.test(ch.geometry.type)) keep.push(ch);
      });
      /* replace leftover boxes */
      g.children.slice().forEach(function (ch) {
        if (ch.geometry && /Box|Tetrahedron/.test(ch.geometry.type || '')) {
          g.remove(ch);
          var p = propMesh(kinds[i % kinds.length], 0.85, (g.userData.valuation && 0x34d399) || 0xd4a017);
          p.position.copy(ch.position);
          g.add(p);
        }
      });
      g.position.y = Math.max(0.35, g.position.y * 0.45);
    });
  }

  function mountHud() {
    var stage = document.getElementById('bancadaStage');
    if (!stage || document.getElementById('unixTools')) return;
    var tools = document.createElement('div');
    tools.id = 'unixTools';
    tools.style.cssText = 'position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:7;display:flex;flex-wrap:wrap;gap:.35rem;pointer-events:auto';
    var toolsSpec = [
      ['phys', t('Manipular', 'Manipulate')],
      ['freeze', t('Fixar', 'Freeze')],
      ['dupe', t('Duplicar', 'Duplicate')],
      ['remove', t('Remover', 'Remove')],
      ['rotate', t('Rodar', 'Rotate')]
    ];
    toolsSpec.forEach(function (pair) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.tool = pair[0];
      b.textContent = pair[1];
      b.style.cssText = 'padding:.35rem .65rem;font-size:.72rem;border-radius:4px;cursor:pointer;background:var(--card);border:1px solid var(--line2);color:var(--fg)';
      b.onclick = function () { setTool(pair[0]); };
      tools.appendChild(b);
    });
    stage.appendChild(tools);

    function stickZone(id, side) {
      var z = document.getElementById(id);
      if (z) return z;
      z = document.createElement('div');
      z.id = id;
      z.className = 'unix-stick';
      z.style.cssText = 'position:absolute;' + side + ':10px;bottom:18px;width:128px;height:128px;z-index:8;pointer-events:auto;touch-action:none';
      stage.appendChild(z);
      return z;
    }
    var left = stickZone('unixStickMove', 'left');
    var right = stickZone('unixStickLook', 'right');
    var B = Bref() || (window.B = window.B || {});
    B.stick = B.stick || { x: 0, y: 0 };
    B.lookStick = B.lookStick || { x: 0, y: 0 };
    if (window.nipplejs) {
      try { if (B.nipple && B.nipple.destroy) B.nipple.destroy(); } catch (_) {}
      try {
        B.nippleMove = nipplejs.create({ zone: left, mode: 'static', position: { left: '50%', top: '50%' }, color: '#d4a017', size: 110 });
        B.nippleMove.on('move', function (_, d) { B.stick.x = d.vector.x; B.stick.y = d.vector.y; });
        B.nippleMove.on('end', function () { B.stick.x = 0; B.stick.y = 0; });
        B.nippleLook = nipplejs.create({ zone: right, mode: 'static', position: { left: '50%', top: '50%' }, color: '#c45c4a', size: 110 });
        B.nippleLook.on('move', function (_, d) { B.lookStick.x = d.vector.x; B.lookStick.y = d.vector.y; });
        B.nippleLook.on('end', function () { B.lookStick.x = 0; B.lookStick.y = 0; });
      } catch (_) {}
    }
    setTool('phys');
    var prompt = document.getElementById('bancadaPrompt');
    if (prompt) {
      prompt.textContent = t(
        'Esq. andar · Dir. olhar · arrastar para olhar · WASD · F pegar · 1–5 ferramenta',
        'Left stick walk · Right stick look · drag to look · WASD · F grab · 1–5 tool'
      );
    }
    var hint = document.getElementById('bancadaLockHint');
    if (hint) {
      hint.textContent = t(
        'Toque para habitar · stick direito olha · arraste no ecrã como na órbita',
        'Tap to inhabit · right stick looks · drag the screen as in orbit'
      );
    }
  }

  function setTool(name) {
    var B = Bref() || {};
    B.tool = name;
    document.querySelectorAll('#unixTools button').forEach(function (b) {
      b.style.borderColor = b.dataset.tool === name ? 'var(--accent)' : 'var(--line2)';
      b.style.background = b.dataset.tool === name ? 'var(--accent)' : 'var(--card)';
      b.style.color = b.dataset.tool === name ? '#0a0a0b' : 'var(--fg)';
    });
  }

  function pickGroup(ev) {
    var B = Bref();
    if (!B || !B.renderer || !B.camera || !B.root) return null;
    var rect = B.renderer.domElement.getBoundingClientRect();
    var mx = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    var my = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    B.raycaster.setFromCamera(new THREE.Vector2(mx, my), B.camera);
    var hits = B.raycaster.intersectObjects(B.root.children, true);
    for (var i = 0; i < hits.length; i++) {
      var o = hits[i].object;
      while (o && o.parent !== B.root) o = o.parent;
      if (o && o.parent === B.root) return { group: o, dist: hits[i].distance, point: hits[i].point };
    }
    return null;
  }

  function bindCompose() {
    var B = Bref();
    if (!B || !B.renderer || B._unixBound) return;
    B._unixBound = true;
    var canvas = B.renderer.domElement;
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', function (ev) {
      if (ev.target && ev.target.closest && ev.target.closest('.unix-stick, #unixTools')) return;
      var hit = pickGroup(ev);
      var tool = B.tool || 'phys';
      if (window._bancadaMode === 'fps' && !hit) {
        B._looking = true;
        B._lx = ev.clientX; B._ly = ev.clientY;
        try { canvas.setPointerCapture(ev.pointerId); } catch (_) {}
        return;
      }
      if (!hit) {
        if (window._bancadaMode === 'orbit') {
          B._looking = false;
        }
        return;
      }
      var g = hit.group;
      if (tool === 'remove') {
        B.root.remove(g);
        return;
      }
      if (tool === 'freeze') {
        g.userData.frozen = !g.userData.frozen;
        return;
      }
      if (tool === 'dupe') {
        var c = g.clone();
        c.position.x += 0.55; c.position.z += 0.4;
        c.userData = Object.assign({}, g.userData, { unixDressed: true, frozen: false });
        B.root.add(c);
        return;
      }
      B.hold = g;
      B.holdDist = hit.dist;
      B._lx = ev.clientX; B._ly = ev.clientY;
      try { canvas.setPointerCapture(ev.pointerId); } catch (_) {}
    });
    canvas.addEventListener('pointermove', function (ev) {
      if (B._looking && window._bancadaMode === 'fps') {
        var dx = ev.clientX - B._lx, dy = ev.clientY - B._ly;
        B._lx = ev.clientX; B._ly = ev.clientY;
        B.yaw = (B.yaw || 0) - dx * 0.0055;
        B.pitch = Math.max(-1.15, Math.min(1.15, (B.pitch || 0) - dy * 0.0055));
        return;
      }
      if (!B.hold) return;
      var rect = canvas.getBoundingClientRect();
      var mx = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      var my = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      B.raycaster.setFromCamera(new THREE.Vector2(mx, my), B.camera);
      var dir = B.raycaster.ray.direction.clone();
      var pos = B.camera.position.clone().add(dir.multiplyScalar(B.holdDist || 3));
      if (B.tool === 'rotate') {
        B.hold.rotation.y += (ev.movementX || (ev.clientX - (B._lx || ev.clientX))) * 0.01;
        B._lx = ev.clientX;
        return;
      }
      B.hold.position.x = pos.x;
      B.hold.position.z = pos.z;
      B.hold.position.y = Math.max(0.25, pos.y);
    });
    function up() {
      if (B.hold && !B.hold.userData.frozen) {
        B.hold.userData.vel = B.hold.userData.vel || { x: 0, y: 0, z: 0 };
        B.hold.userData.vel.y = -0.02;
      }
      B.hold = null;
      B._looking = false;
    }
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', function (ev) {
      if (!B.hold) return;
      ev.preventDefault();
      B.holdDist = Math.max(1.1, Math.min(12, (B.holdDist || 3) + (ev.deltaY > 0 ? 0.35 : -0.35)));
    }, { passive: false });
  }

  function tickUnix() {
    requestAnimationFrame(tickUnix);
    var B = Bref();
    if (!B) return;
    if (B.lookStick && (B.lookStick.x || B.lookStick.y)) {
      B.yaw = (B.yaw || 0) - B.lookStick.x * 0.055;
      B.pitch = Math.max(-1.15, Math.min(1.15, (B.pitch || 0) + B.lookStick.y * 0.045));
      if (window._bancadaMode !== 'fps') {
        window._bancadaMode = 'fps';
        if (B.controls) B.controls.enabled = false;
      }
    }
    if (B.root) {
      B.root.children.forEach(function (g) {
        if (g === B.hold) return;
        if (g.userData && g.userData.frozen) return;
        var v = g.userData.vel || { x: 0, y: 0, z: 0 };
        if (g.position.y > 0.28) {
          v.y -= 0.018;
          g.position.y += v.y;
          if (g.position.y < 0.28) { g.position.y = 0.28; v.y = 0; }
          g.userData.vel = v;
        }
      });
    }
    dressNodes();
  }

  window.addEventListener('keydown', function (e) {
    var n = e.code && e.code.replace('Digit', '');
    if (n === '1') setTool('phys');
    if (n === '2') setTool('freeze');
    if (n === '3') setTool('dupe');
    if (n === '4') setTool('remove');
    if (n === '5') setTool('rotate');
    var B = Bref();
    if (!B || !B.hold) return;
    if (e.code === 'KeyQ') B.hold.rotation.y += 0.15;
    if (e.code === 'KeyE' && B.tool === 'rotate') B.hold.rotation.y -= 0.15;
    if (e.code === 'KeyR') {
      var c = B.hold.clone();
      c.position.x += 0.5;
      B.root.add(c);
    }
  });

  function bootUnix() {
    removeHomepageIframe();
    var tries = 0;
    (function wait() {
      tries++;
      var ready = typeof THREE !== 'undefined' && THREE.OrbitControls;
      var stage = document.getElementById('bancadaStage');
      if (!ready || !stage) {
        if (tries < 50) setTimeout(wait, 120);
        return;
      }
      try {
        if (typeof window.initBancada3D === 'function') window.initBancada3D();
      } catch (_) {}
      if (typeof window.loadSandboxBench === 'function') {
        try { window.loadSandboxBench(); } catch (_) {}
      }
      restyleLot();
      mountHud();
      bindCompose();
      dressNodes();
      if (!window._unixTick) { window._unixTick = true; tickUnix(); }
    })();
  }

  window.loadSandbox = function () {
    window._atelierMode = 'unix3d';
    bootUnix();
  };
  var _bench = window.loadSandboxBench;
  window.loadSandboxBench = function () {
    var r;
    if (typeof _bench === 'function') {
      try { r = _bench.apply(this, arguments); } catch (_) {}
    }
    setTimeout(function () { restyleLot(); mountHud(); bindCompose(); dressNodes(); }, 80);
    return r;
  };

  if (document.readyState === 'complete' || document.readyState === 'interactive') setTimeout(bootUnix, 200);
  else document.addEventListener('DOMContentLoaded', function () { setTimeout(bootUnix, 200); });
  window.addEventListener('load', function () { setTimeout(bootUnix, 400); });
})();
