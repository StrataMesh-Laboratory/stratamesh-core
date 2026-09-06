/* Atelier InstancedMesh helpers — classic script, no ESM, no R3F.
 * Street lane dashes are the first repeated prop migrated off Mesh-per-dash.
 */
(function (root) {
  "use strict";

  function disposeTree(obj) {
    if (!obj) return;
    var walk = obj.traverse ? [obj] : [];
    if (obj.traverse) {
      obj.traverse(function (n) { walk.push(n); });
    }
    var seen = {};
    walk.forEach(function (n) {
      if (n.geometry && n.geometry.dispose && !seen[n.geometry.uuid]) {
        seen[n.geometry.uuid] = 1;
        try { n.geometry.dispose(); } catch (e) {}
      }
      var mats = n.material;
      if (!mats) return;
      (Array.isArray(mats) ? mats : [mats]).forEach(function (mat) {
        if (!mat) return;
        ["map", "emissiveMap", "normalMap"].forEach(function (k) {
          if (mat[k] && mat[k].dispose) {
            try { mat[k].dispose(); } catch (e2) {}
          }
        });
        if (mat.dispose && !seen[mat.uuid || mat]) {
          seen[mat.uuid || String(mat)] = 1;
          try { mat.dispose(); } catch (e3) {}
        }
      });
    });
  }

  function streetDashes(scene, opts) {
    opts = opts || {};
    var THREE = root.THREE;
    if (!THREE || !scene || !THREE.InstancedMesh) return null;
    var from = opts.from != null ? opts.from : -8;
    var to = opts.to != null ? opts.to : 8;
    var step = opts.step || 1.05;
    var count = 0;
    for (var z = from; z <= to; z++) count++;
    if (count < 1) return null;
    var geo = new THREE.PlaneGeometry(opts.w || 0.12, opts.h || 0.55);
    var mat = opts.material || new THREE.MeshLambertMaterial({ color: 0xd4a017 });
    var mesh = new THREE.InstancedMesh(geo, mat, count);
    var dummy = new THREE.Object3D();
    dummy.rotation.x = -Math.PI / 2;
    var i = 0;
    for (var zz = from; zz <= to; zz++) {
      dummy.position.set(opts.x || 0, opts.y != null ? opts.y : 0.02, zz * step);
      dummy.updateMatrix();
      mesh.setMatrixAt(i++, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.name = "atelier-street-dashes";
    scene.add(mesh);
    return mesh;
  }

  root.AtelierInstances = {
    disposeTree: disposeTree,
    streetDashes: streetDashes,
  };
})(typeof window !== "undefined" ? window : this);
