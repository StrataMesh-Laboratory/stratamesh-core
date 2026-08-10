# StrataMesh Fog Node — Status Endpoint Specification v0.1

**Node:** FOG-NODE-PT-CM-001 (Calhegas Morais)  
**Purpose:** Provide a machine-readable and human-readable view of node health and network contribution.

## Recommended Endpoints

### 1. `GET /status` (or `/v1/status`)
Returns overall node health.

```json
{
  "node_id": "FOG-NODE-PT-CM-001",
  "name": "Calhegas Morais",
  "location": {
    "lat": 38.7169,
    "lon": -9.1427,
    "label": "Lisbon, Portugal"
  },
  "version": "0.1.0-dev",
  "uptime_seconds": 0,
  "status": "initializing",
  "timestamp": "2026-08-10T16:47:00Z"
}
```

### 2. `GET /status/dag`
```json
{
  "height_approx": 0,
  "tip_count": 0,
  "transaction_count": 0,
  "last_tip_timestamp": null,
  "avg_attachment_latency_ms": null
}
```

### 3. `GET /status/ipfs`
```json
{
  "pins_total": 0,
  "pins_active": 0,
  "last_pin_success": null,
  "gateway_reachable": true
}
```

### 4. `GET /status/spa`
```json
{
  "active_spas": 0,
  "roles": ["fog"],
  "proof_of_contribution_epoch": null
}
```

### 5. `GET /status/metrics` (Prometheus-compatible optional)
Expose key counters and gauges for the Orchestrator and external observers.

## Implementation Notes
- All endpoints should be unauthenticated for public read access during early phases.
- Rate limiting and Cloudflare protection remain in place.
- Values should be updated by the node process or a lightweight sidecar.
- The Orchestrator will consume these endpoints for automated health checks and task prioritisation.

## Phase 0 Target
A minimal static or semi-static version of `/status` can be served immediately from the existing origin while the full node software is brought online.
