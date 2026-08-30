using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "main", worker = .worker),
    (name = "fog", external = (address = "127.0.0.1:8787", http = ())),
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
    (name = "ORIGIN", text = "session"),
  ],
);
