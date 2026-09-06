/* InstancedMesh helper for repeated procedural props. */
(function (global) {
  'use strict';
  function makeInstanced(geometry, material, matrices) {
    if (typeof THREE === 'undefined' || !matrices || !matrices.length) return null;
    var mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    var m = new THREE.Matrix4();
    for (var i = 0; i < matrices.length; i++) {
      if (matrices[i].isMatrix4) mesh.setMatrixAt(i, matrices[i]);
      else {
        m.identity();
        var p = matrices[i].position || matrices[i];
        m.setPosition(p.x || 0, p.y || 0, p.z || 0);
        mesh.setMatrixAt(i, m);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = true;
    return mesh;
  }
  function disposeObject3D(obj) {
    if (!obj) return;
    obj.traverse(function (ch) {
      if (ch.geometry && ch.geometry.dispose) ch.geometry.dispose();
      if (ch.material) {
        var mats = Array.isArray(ch.material) ? ch.material : [ch.material];
        mats.forEach(function (mat) {
          if (!mat) return;
          if (mat.map && mat.map.dispose) mat.map.dispose();
          if (mat.dispose) mat.dispose();
        });
      }
    });
  }
  global.AtelierInstances = { makeInstanced: makeInstanced, disposeObject3D: disposeObject3D };
})(typeof window !== 'undefined' ? window : this);
