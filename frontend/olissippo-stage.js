/* Olissippo lore stage — Phase 6.
 * Realm lore-olissippo-lusitanian (NOT main Bancada/open world).
 * People = Subjects (ACB); objects = objects. Never paint ACB as NFT.
 * UI chrome: plain words only (no object_id / subject_id jargon).
 */
(function () {
  'use strict';

  var CACHE = '20260907c';
  var lang = (function () {
    try {
      var q = new URLSearchParams(location.search).get('lang');
      if (q) return q;
    } catch (e) {}
    return (navigator.language || '').toLowerCase().indexOf('pt') === 0 ? 'pt-PT' : 'en-GB';
  })();
  var isPt = String(lang).toLowerCase().indexOf('pt') === 0;

  function L(pt, en) { return isPt ? pt : en; }

  var stage = document.getElementById('stage');
  var hud = document.getElementById('hud');
  var placeEl = document.getElementById('place');
  var peopleEl = document.getElementById('peopleHere');
  var thingsEl = document.getElementById('thingsHere');
  var exitsEl = document.getElementById('exits');
  var noteEl = document.getElementById('realmNote');
  var titleEl = document.getElementById('villageTitle');

  var state = {
    world: null,
    here: 'hill_enclosure',
    meshes: {},
    edgeLines: [],
  };

  function locLabel(loc) {
    if (!loc) return '';
    return isPt ? (loc.label_pt || loc.label_en) : (loc.label_en || loc.label_pt);
  }

  function byId(id) {
    var locs = (state.world && state.world.locations) || [];
    for (var i = 0; i < locs.length; i++) if (locs[i].id === id) return locs[i];
    return null;
  }

  function peopleAt(id) {
    return ((state.world && state.world.people) || []).filter(function (p) {
      return p.home === id;
    });
  }

  function thingsAt(id) {
    return ((state.world && state.world.objects) || []).filter(function (o) {
      return o.at === id;
    });
  }

  function exitsFrom(id) {
    var out = [];
    ((state.world && state.world.edges) || []).forEach(function (e) {
      if (e[0] === id) out.push(e[1]);
      else if (e[1] === id) out.push(e[0]);
    });
    return out;
  }

  function paintHud() {
    var loc = byId(state.here);
    placeEl.textContent = locLabel(loc);
    peopleEl.innerHTML = '';
    thingsEl.innerHTML = '';
    exitsEl.innerHTML = '';

    var people = peopleAt(state.here);
    if (!people.length) {
      peopleEl.textContent = L('Ninguém da aldeia vive aqui (neste momento).', 'No village folk live here (right now).');
    } else {
      people.forEach(function (p) {
        var li = document.createElement('li');
        var role = isPt ? p.role_pt : p.role_en;
        // Person / ACB Subject — never "NFT"
        li.textContent = p.name + ' · ' + role + ' · ' + L('pessoa (identidade StrataMesh)', 'person (StrataMesh identity)');
        peopleEl.appendChild(li);
      });
    }

    var things = thingsAt(state.here);
    if (!things.length) {
      thingsEl.textContent = L('Nenhum objecto à vista.', 'No objects in sight.');
    } else {
      things.forEach(function (o) {
        var li = document.createElement('li');
        li.textContent = isPt ? (o.name_pt || o.name_en) : (o.name_en || o.name_pt);
        thingsEl.appendChild(li);
      });
    }

    exitsFrom(state.here).forEach(function (dest) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = locLabel(byId(dest));
      btn.addEventListener('click', function () { go(dest); });
      exitsEl.appendChild(btn);
    });

    // highlight meshes
    Object.keys(state.meshes).forEach(function (id) {
      var m = state.meshes[id];
      if (!m || !m.material) return;
      m.material.color.setHex(id === state.here ? 0xc4a574 : 0x6b8f71);
      m.scale.setScalar(id === state.here ? 1.35 : 1);
    });
  }

  function go(dest) {
    var ok = exitsFrom(state.here).indexOf(dest) >= 0;
    if (!ok) return;
    state.here = dest;
    paintHud();
    var loc = byId(dest);
    if (loc && window._oliCam) {
      window._oliCam.position.set(loc.x * 1.1, 6.5, loc.z * 1.1 + 8);
      window._oliCam.lookAt(loc.x, 0.4, loc.z);
    }
  }

  function bootThree(world) {
    if (typeof THREE === 'undefined') {
      noteEl.textContent = L('Visual 3D indisponível — mapa em texto abaixo.', '3D unavailable — text map below.');
      paintHud();
      return;
    }
    var w = Math.max(64, stage.clientWidth || innerWidth || 320);
    var h = Math.max(64, stage.clientHeight || innerHeight || 240);
    var renderer = new THREE.WebGLRenderer({ canvas: stage, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0xf4e4c1, 1);

    var scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xc9a06a, 12, 42);

    var camera = new THREE.PerspectiveCamera(50, w / Math.max(h, 1), 0.1, 100);
    camera.position.set(0, 7, 10);
    camera.lookAt(0, 0.3, 0);
    window._oliCam = camera;

    var hemi = new THREE.HemisphereLight(0xfff2d6, 0x5a4630, 0.95);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(0xffe6b0, 0.55);
    sun.position.set(4, 10, 2);
    scene.add(sun);

    // ground disk (hill)
    var ground = new THREE.Mesh(
      new THREE.CircleGeometry(9.5, 48),
      new THREE.MeshLambertMaterial({ color: 0x8a9a5b })
    );
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);

    // Tagus hint
    var water = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 2.2),
      new THREE.MeshLambertMaterial({ color: 0x4a6d8c })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0.4, 0.02, -5.6);
    scene.add(water);

    // edge lines
    var lineMat = new THREE.LineBasicMaterial({ color: 0x5c564c, transparent: true, opacity: 0.45 });
    (world.edges || []).forEach(function (e) {
      var a = byId(e[0]), b = byId(e[1]);
      if (!a || !b) return;
      var geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a.x, 0.08, a.z),
        new THREE.Vector3(b.x, 0.08, b.z),
      ]);
      scene.add(new THREE.Line(geo, lineMat));
    });

    // location markers
    (world.locations || []).forEach(function (loc) {
      var mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.35, 0.55, 10),
        new THREE.MeshLambertMaterial({ color: 0x6b8f71 })
      );
      mesh.position.set(loc.x, 0.28, loc.z);
      mesh.userData = { id: loc.id };
      scene.add(mesh);
      state.meshes[loc.id] = mesh;

      // person pin (small cone) if someone homes here
      if (peopleAt(loc.id).length) {
        var pin = new THREE.Mesh(
          new THREE.ConeGeometry(0.12, 0.35, 8),
          new THREE.MeshLambertMaterial({ color: 0x3d5a80 })
        );
        pin.position.set(loc.x + 0.35, 0.55, loc.z);
        scene.add(pin);
      }
    });

    function resize() {
      var ww = Math.max(64, stage.clientWidth || innerWidth || 320);
      var hh = Math.max(64, stage.clientHeight || innerHeight || 240);
      renderer.setSize(ww, hh, false);
      camera.aspect = ww / Math.max(hh, 1);
      camera.updateProjectionMatrix();
    }
    addEventListener('resize', resize);

    // click to go
    var ray = new THREE.Raycaster();
    var mouse = new THREE.Vector2();
    stage.addEventListener('pointerdown', function (ev) {
      var rect = stage.getBoundingClientRect();
      mouse.x = ((ev.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
      mouse.y = -((ev.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
      ray.setFromCamera(mouse, camera);
      var hits = ray.intersectObjects(Object.keys(state.meshes).map(function (k) { return state.meshes[k]; }));
      if (!hits.length) return;
      var id = hits[0].object.userData.id;
      if (id === state.here) return;
      if (exitsFrom(state.here).indexOf(id) >= 0) go(id);
    });

    function frame() {
      requestAnimationFrame(frame);
      renderer.render(scene, camera);
    }
    frame();
    paintHud();
  }

  function fail(msg) {
    if (noteEl) noteEl.textContent = msg;
    if (hud) hud.style.display = 'block';
  }

  fetch('/olissippo-world.json?v=' + CACHE, { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error('world'); return r.json(); })
    .then(function (world) {
      if (!world.not_main) throw new Error('realm_must_not_be_main');
      if (world.hosts_sandboxes) throw new Error('lore_must_not_host_sandboxes');
      if (world.realm_class && world.realm_class !== 'lore') throw new Error('expected_lore_realm');
      state.world = world;
      state.here = (world.spawn && world.spawn.location_id) || 'hill_enclosure';
      if (titleEl) titleEl.textContent = isPt ? world.label_pt : world.label_en;
      if (noteEl) {
        noteEl.textContent = (isPt ? world.subtitle_pt : world.subtitle_en) +
          ' · ' + L('Pessoas ≠ objectos NFT · papel CMN ≠ identidade', 'People ≠ NFT objects · CMN role ≠ identity');
      }
      bootThree(world);
    })
    .catch(function () {
      fail(L('Não foi possível carregar a aldeia.', 'Could not load the village.'));
    });
})();
