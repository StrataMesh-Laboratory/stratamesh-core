using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "main", worker = .worker),
    (name = "fog", external = (address = "127.0.0.1:8787", http = ())),
    (name = "mwpy", external = (address = "127.0.0.1:8790", http = ())),
    (name = "mwnode", external = (address = "127.0.0.1:8791", http = ())),
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
    (name = "MW_PY", service = "mwpy"),
    (name = "MW_NODE", service = "mwnode"),
    (name = "ORIGIN", text = "session"),
    (name = "FOG_MESH_N", text = "2"),
  ],
);
