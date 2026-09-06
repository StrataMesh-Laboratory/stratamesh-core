/* AtelierCatalog — bridge private account catalog → GNU Atelier stage.
 * Code: international English (aspects, contracts, object_id).
 * Catalog may still store PT keys (aspectos, contrato) from PT-PT UI.
 * Classic script; no ESM; no R3F.
 */
(function (global) {
  "use strict";

  function catalogKey(who) {
    return "sm_catalog_" + String(who || "").toLowerCase();
  }

  function loadCatalog(who) {
    try {
      var raw = localStorage.getItem(catalogKey(who));
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function aspectsOf(it) {
    if (!it || typeof it !== "object") return [];
    var a = it.aspects || it.aspectos || it.contains || [];
    if (!Array.isArray(a)) return [];
    return a.map(function (x) {
      return typeof x === "string" ? x : x && x.id ? String(x.id) : "";
    }).filter(Boolean);
  }

  function contractOf(it) {
    if (!it || typeof it !== "object") return null;
    return it.contract || it.contrato || null;
  }

  function collateralOf(it) {
    if (!it || typeof it !== "object") return 0;
    var c = it.collateral;
    if (c == null && it.contrato && it.contrato.floor_strata != null) c = it.contrato.floor_strata;
    if (c == null && contractOf(it) && contractOf(it).floor_strata != null) c = contractOf(it).floor_strata;
    var n = Number(c);
    return isFinite(n) ? n : 0;
  }

  function moodOf(it) {
    var c = contractOf(it);
    if (!c) return "still";
    var st = String(c.state || c.mode || "").toLowerCase();
    if (st === "dynamic" || st === "live" || st === "running") return "live";
    if (st === "terminated" || st === "ended") return "ended";
    return "still";
  }

  function zoneFor(it) {
    if (!it) return "bancada";
    var d = String(it.dest || "").toLowerCase();
    if (d === "room" || d === "bancada" || d === "workbench") return "bancada";
    if (d === "world" || d === "open" || d === "rua") return "rua";
    if (d && d.length < 24) return d;
    if (it.kind === "parcel" || it.kind === "bundle") return "rua";
    if (it.kind === "room") return "bancada";
    return "bancada";
  }

  function roleFor(it) {
    if (!it) return "creation";
    if (it.kind === "bundle") return "building";
    if (it.kind === "parcel") return "creation";
    if (it.kind === "room") return "building";
    if (it.kind === "lot") return "creation"; // lots are not NFTs — skip in merge
    if (it.role === "spa" || it.template === "exec_contract") return "spa";
    if (it.deed || (it.template && String(it.template).indexOf("deed_") === 0)) return "deed";
    return "creation";
  }

  /** Map catalog row → atelier nft record (object_id is the NFT). */
  function toAtelierNft(it, owner) {
    if (!it || !it.id) return null;
    if (it.kind === "lot") return null; // not an NFT
    var aspects = aspectsOf(it);
    var contract = contractOf(it);
    return {
      id: String(it.id),
      object_id: String(it.id),
      name: it.name || it.name_en || it.id,
      role: roleFor(it),
      kind: it.kind || "object",
      template: it.template || "",
      zone: zoneFor(it),
      owner: owner || "",
      dest: it.dest || "",
      unmovable: !!it.unmovable,
      deployed: !!it.deployed,
      aspects: aspects,
      contract: contract,
      deed: it.deed || null,
      collateral: collateralOf(it),
      mood: moodOf(it),
      containedBy: it.containedBy || it.parent_object_id || "",
      catalog: true
    };
  }

  /**
   * Deployed catalog NFTs for a zone.
   * Children listed only as aspects of a deployed parent are not duplicated
   * as top-level stage rows (they render as child meshes).
   */
  function deployedForZone(who, zone) {
    var cat = loadCatalog(who);
    var childOfDeployedParent = {};
    cat.forEach(function (it) {
      if (!it || !it.deployed) return;
      aspectsOf(it).forEach(function (cid) {
        childOfDeployedParent[cid] = it.id;
      });
    });
    var out = [];
    cat.forEach(function (it) {
      if (!it || !it.deployed) return;
      if (it.kind === "lot") return;
      // Parcels under a land-bundle: title/world only — not free-standing stage props
      if (it.kind === "parcel" && (it.containedBy || childOfDeployedParent[it.id])) return;
      // Aspect-children of a deployed parent render under the parent mesh, not as duplicates
      if (childOfDeployedParent[it.id] && it.kind === "object" && !it.forceStage) return;
      var nft = toAtelierNft(it, who);
      if (!nft) return;
      if (zone && nft.zone !== zone) return;
      out.push(nft);
    });
    return out;
  }

  function mergeDeployed(nftsArr, who, zone) {
    if (!Array.isArray(nftsArr)) return nftsArr;
    var add = deployedForZone(who, zone || null);
    add.forEach(function (n) {
      if (!nftsArr.find(function (x) { return x && x.id === n.id; })) nftsArr.push(n);
    });
    return nftsArr;
  }

  function resolveAspectNfts(parentNft, who) {
    var cat = loadCatalog(who);
    var byId = {};
    cat.forEach(function (it) {
      if (it && it.id) byId[it.id] = it;
    });
    var ids = (parentNft && parentNft.aspects) || [];
    return ids.map(function (id) {
      var it = byId[id];
      return it ? toAtelierNft(it, who) : { id: id, object_id: id, name: id, role: "creation", aspects: [], catalog: true };
    }).filter(Boolean);
  }

  function focusPayload(it, who) {
    var nft = typeof it === "string"
      ? toAtelierNft(loadCatalog(who).find(function (x) { return x && x.id === it; }) || { id: it }, who)
      : (it && it.object_id ? it : toAtelierNft(it, who));
    if (!nft) {
      return { object_id: "", aspects: [], collateral: 0, mood: "still", contract: null, name: "" };
    }
    return {
      object_id: nft.object_id || nft.id,
      name: nft.name || "",
      aspects: resolveAspectNfts(nft, who).map(function (c) {
        return { id: c.id, name: c.name };
      }),
      collateral: nft.collateral || 0,
      mood: nft.mood || "still",
      contract: nft.contract || null
    };
  }

  global.AtelierCatalog = {
    catalogKey: catalogKey,
    loadCatalog: loadCatalog,
    aspectsOf: aspectsOf,
    contractOf: contractOf,
    collateralOf: collateralOf,
    toAtelierNft: toAtelierNft,
    deployedForZone: deployedForZone,
    mergeDeployed: mergeDeployed,
    resolveAspectNfts: resolveAspectNfts,
    focusPayload: focusPayload,
    zoneFor: zoneFor
  };
})(typeof window !== "undefined" ? window : this);
