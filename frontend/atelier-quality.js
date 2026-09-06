/* GNU Atelier quality gate — lean WebGL/Safari tier (vendor-local; no CDN). */
(function (global) {
  'use strict';
  function tierFromGl() {
    var tier = 2;
    try {
      var c = document.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return 0;
      var dbg = gl.getExtension('WEBGL_debug_renderer_info');
      var renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
      var touch = false;
      try { touch = document.documentElement.dataset.screenTouch === 'yes'; } catch (_) {}
      var cores = (navigator.hardwareConcurrency || 4) | 0;
      var mem = navigator.deviceMemory || 0;
      var low = /SwiftShader|llvmpipe|Software/i.test(renderer);
      if (low) tier = 0;
      else if (touch || (mem && mem <= 2) || cores <= 4) tier = 1;
      else if (mem && mem >= 8 && cores >= 8) tier = 3;
      try {
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      } catch (_) {}
    } catch (_) { tier = 1; }
    return tier;
  }
  var tier = tierFromGl();
  var touch = false;
  try { touch = document.documentElement.dataset.screenTouch === 'yes'; } catch (_) {}
  var pixelRatioCap = touch ? 1.35 : (tier <= 1 ? 1.25 : 2);
  global.AtelierQuality = {
    tier: tier,
    pixelRatio: Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, pixelRatioCap),
    fogDensity: tier <= 1 ? 0.028 : tier === 2 ? 0.046 : 0.055,
    outlines: tier >= 2
  };
})(typeof window !== 'undefined' ? window : this);
