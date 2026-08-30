using Workerd = import "/workerd/workerd.capnp";

# EDGE hop on THIS host only (not the Mac Fog).
# tunnel → 127.0.0.1:8788 workerd ORIGIN=edge → 127.0.0.1:8789 edge-grok-local
const config :Workerd.Config = (
  services = [
    (name = "main", worker = .worker),
    (name = "fog", external = (address = "127.0.0.1:8789", http = ())),
  ],
  sockets = [
    (name = "http", address = "127.0.0.1:8788", http = (), service = "main"),
  ],
);

const worker :Workerd.Worker = (
  modules = [
    (name = "worker.js", esModule = embed "worker.js"),
  ],
  compatibilityDate = "2024-12-01",
  bindings = [
    (name = "FOG", service = "fog"),
    (name = "ORIGIN", text = "edge"),
  ],
);
