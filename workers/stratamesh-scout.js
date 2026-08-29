export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const authed = token === (env.AUTH_TOKEN || "stratamesh-edge-token-2026");
    if (url.pathname === "/") return new Response(JSON.stringify({system:"Stratamesh-Node-2",role:"scout",version:"0.0.1-Alpha",status:"operational",mesh:"stratamesh-fog"}),{headers:{"Content-Type":"application/json"}});
    if (url.pathname === "/ping" && authed) {
      const meshData = await env.FOG.list();
      return new Response(JSON.stringify({node:"scout-2",timestamp:new Date().toISOString(),fog_objects:meshData.objects.length,mesh_status:"connected"}),{headers:{"Content-Type":"application/json"}});
    }
    if (url.pathname === "/scout" && authed) {
      const target = url.searchParams.get("url") || "https://example.com";
      try {
        const br = await fetch("https://browser.cloudflare.com/api/v1/screenshot",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+env.AUTH_TOKEN},body:JSON.stringify({url:target,options:{fullPage:false}})});
        if(br.ok){const buf=await br.arrayBuffer();return new Response(buf,{headers:{"Content-Type":"image/png"}});}
        return new Response(JSON.stringify({error:"Browser API unavailable",status:br.status}),{headers:{"Content-Type":"application/json"}});
      } catch(e){return new Response(JSON.stringify({error:e.message}),{headers:{"Content-Type":"application/json"}});}
    }
    if (url.pathname === "/register" && authed) {
      const reg = {node_id:"scout-2",role:"scout",capabilities:["browser","health-check"],joined:new Date().toISOString(),status:"active"};
      await env.FOG.put("mesh/nodes/scout-2.json",JSON.stringify(reg),{httpMetadata:{contentType:"application/json"}});
      return new Response(JSON.stringify({status:"registered",node:reg}),{headers:{"Content-Type":"application/json"}});
    }
    if (url.pathname === "/mesh" && authed) {
      const nodes = await env.FOG.list({prefix:"mesh/nodes/"});
      const nodeList = [];
      for(const obj of nodes.objects){const data=await env.FOG.get(obj.key);if(data)nodeList.push(JSON.parse(await data.text()));}
      return new Response(JSON.stringify({mesh:"stratamesh",nodes:nodeList,count:nodeList.length}),{headers:{"Content-Type":"application/json"}});
    }
    return new Response("Not Found",{status:404});
  },
  async scheduled(event, env) {
    await env.FOG.put("mesh/heartbeat/scout-2",new Date().toISOString());
  }
};