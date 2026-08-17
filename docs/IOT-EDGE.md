# IoT Edge — StrataMesh / Nó Calhegas Morais

**Versão:** 2.1.0-universal  
**Base:** `https://stratamesh-iot.stratamesh.workers.dev` · domínio `https://calhegasmorais.pt/iot`

## Princípios

1. **Identidade por função** — `agent_id` basta; o substrato (MCU, telemóvel, worker, sensor) é metadado opcional.
2. **Sem carga no aparelho** — resposta imediata (ACK); GDA e IPFS correm em background no edge.
3. **Universal** — JSON, SenML, texto, form, GET query, envelopes HA/TTN/shadow.

## Endpoints

| Método | Caminho | Uso |
|--------|---------|-----|
| GET | `/health` | Estado |
| GET | `/compat` | Matriz de compatibilidade |
| GET/POST | `/ingest` `/t` `/telemetry` `/up` `/data` | Telemetria |
| POST | `/batch` | Lote |
| GET | `/agents` | Agentes vistos |
| GET | `/stats` | Contadores |

## Identidade

- Headers: `X-Agent-Id`, `X-Device-Id`, `X-Node-Id`, `X-Client-Id`
- Query: `agent`, `device`, `id`, `node`
- Body: `agent_id`, `device_id`, `entity_id`, …

## Exemplos

### JSON (ESP32 / qualquer HTTP client)
```http
POST /iot/ingest
Content-Type: application/json
X-Agent-Id: sensor-sala-01

{"kind":"temperature","value":21.5,"unit":"C"}
```

### GET mínimo (firmware muito limitado)
```http
GET /iot/ingest?agent=sensor-sala-01&v=21.5&kind=temperature&unit=C&fmt=text
```
Resposta: `OK 1 <batch_id>`

### Sem body de resposta (poupa rádio)
```http
POST /iot/ingest?fmt=empty
```
→ HTTP **204**

### SenML
```json
[{"n":"temperature","u":"Cel","v":22.5},{"n":"humidity","u":"%RH","v":55}]
```

### Texto KV
```text
temp=19.2 unit=C kind=temperature
```

### Home Assistant
```json
{"entity_id":"sensor.living_temp","state":"21.0","attributes":{"unit_of_measurement":"°C"}}
```

## O que o edge faz depois do ACK

1. Grava evento + actualiza `iot_agents` (D1)
2. Em background: vértice GDA `type=iot`, `lightweight=true`
3. Opcional: `?ipfs=1` ou `"seal_ipfs":true` → resumo do lote no IPFS edge

## O que *não* faz

- Não controla o dispositivo (só recebe)
- Não exige classe de hardware
- Não bloqueia o aparelho à espera do GDA

## Ontologia

> Standing by function and agreement, not substrate.
