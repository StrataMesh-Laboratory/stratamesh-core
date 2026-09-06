/* AtelierQuality — lean WebGL tier (classic script, no ESM, no R3F).
 * Optional later: vendor detect-gpu. This file must stay sync + local.
 * Sets window.AtelierQuality before Three boots.
 */
(function (root) {
  "use strict";
  function probe() {
    var canvas = document.createElement("canvas");
    var gl =
      canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }) ||
      canvas.getContext("webgl2") ||
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    var webgl2 = false;
    var renderer = "";
    var vendor = "";
    var maxTex = 0;
    var debug = null;
    if (gl) {
      webgl2 = typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext;
      try {
        debug = gl.getExtension("WEBGL_debug_renderer_info");
        if (debug) {
          renderer = String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) || "");
          vendor = String(gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) || "");
        }
      } catch (e) {}
      try {
        maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 0;
      } catch (e2) {}
    }
    var mem = 0;
    try {
      mem = Number(navigator.deviceMemory) || 0;
    } catch (e3) {}
    var cores = 0;
    try {
      cores = Number(navigator.hardwareConcurrency) || 0;
    } catch (e4) {}
    var dpr = 1;
    try {
      dpr = Number(root.devicePixelRatio) || 1;
    } catch (e5) {}
    var lowHint = false;
    try {
      lowHint = !!(root.matchMedia && root.matchMedia("(pointer: coarse)").matches && mem && mem <= 4);
    } catch (e6) {}
    var gpu = (renderer + " " + vendor).toLowerCase();
    var integrated =
      /intel|uhd|iris|hd graphics|apple m[1-3]|adreno|mali|powervr|llvmpipe|swiftshader/.test(gpu);
    var discrete = /nvidia|geforce|radeon|amd radeon|apple m[2-4] (pro|max|ultra)/.test(gpu);

    var score = 0;
    if (gl) score += 2;
    if (webgl2) score += 2;
    if (maxTex >= 8192) score += 2;
    else if (maxTex >= 4096) score += 1;
    if (mem >= 8) score += 2;
    else if (mem >= 4) score += 1;
    if (cores >= 8) score += 1;
    if (discrete) score += 2;
    if (integrated) score -= 1;
    if (lowHint) score -= 2;
    if (!gl) score = 0;

    var tier = "low";
    if (score >= 8) tier = "high";
    else if (score >= 4) tier = "mid";

    var pixelRatio = 1;
    if (tier === "high") pixelRatio = Math.min(dpr, 2);
    else if (tier === "mid") pixelRatio = Math.min(dpr, 1.5);
    else pixelRatio = 1;

    return {
      schema: "stratamesh.atelier.quality.v1",
      tier: tier,
      score: score,
      webgl: !!gl,
      webgl2: webgl2,
      renderer: renderer.slice(0, 80),
      vendor: vendor.slice(0, 80),
      maxTextureSize: maxTex,
      deviceMemory: mem,
      hardwareConcurrency: cores,
      pixelRatio: pixelRatio,
      antialias: tier === "high",
      shadows: tier === "high",
      maxDpr: pixelRatio,
    };
  }

  var q;
  try {
    q = probe();
  } catch (err) {
    q = {
      schema: "stratamesh.atelier.quality.v1",
      tier: "low",
      score: 0,
      webgl: false,
      webgl2: false,
      pixelRatio: 1,
      antialias: false,
      shadows: false,
      error: String(err && err.message ? err.message : err).slice(0, 120),
    };
  }
  root.AtelierQuality = q;
})(typeof window !== "undefined" ? window : this);
