# Edge usage — C_mesh = f(1−U)

Fog installs capacity on purpose. Edge keeps its primary job. What the mesh may use is **residual**.

```
U      = utilisation of the primary job (user, thermal, battery, path)
C_mesh = (1−U) × duty × cap     if safety allows
       = 0                      if battery<20% | Low Power | thermal serious/critical | constrained net
duty   = 1.0 foreground | 0.25 background
```

U ↑ ⇒ C_mesh ↓. Lab weights (not mainnet): cpu 0.35, battery-stress 0.25, thermal 0.15, net 0.15, background 0.10.

iOS kit: [`deploy/ios-edge/README.md`](../deploy/ios-edge/README.md).
