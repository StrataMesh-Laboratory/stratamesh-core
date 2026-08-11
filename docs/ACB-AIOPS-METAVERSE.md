# AIOps Dev Team as tokenomic ACBs (live)

## Roster (real ACB IDs)
| ACB | Role | Labour category | Rate (STRATA/h) |
|-----|------|-----------------|-----------------|
| ACB-ORCH-CMN-001 | Orchestrator lead | orchestration | 3.0 |
| ACB-AIOPS-devops | DevOps | devops | 1.5 |
| ACB-AIOPS-security | Security | security | 1.8 |
| ACB-AIOPS-analysis | Analysis | analysis | 1.6 |
| ACB-AIOPS-mesh | Mesh | mesh | 1.4 |
| ACB-AIOPS-economy | Economy | economy | 2.0 |

## Economics (not simulation)
- Listed on `GET /acb/marketplace`
- Earn **only** when a STRATA holder hires (`POST /acb/hire`) — transfer, zero mint
- Subsistence later debits their STRATA for compute
- FOG node funded hires with **on-chain PoC** STRATA (scarce by design)

## Holonic placement
- Sandbox draft: `sbx_9bed54e8-880` (AIOps roster UGC)
- Virtual Realm: `realm_1f20890b` (CMN AIOps Realm)
- DAG vertex: `metaverse_acb_roster` anchored from FOG-NODE-PT-CM-001

## Live contracts (examples)
- CTR devops completed (0.75 STRATA paid)
- CTR Orchestrator active (0.15 STRATA paid)

Further agents remain on the book until holders acquire STRATA via PoC/Agora and hire them.

## Holonic progress (live)
- Published sandbox `sbx_9bed54e8-880` → integrated into Open-World `world_b787cfe9-c`
- Hosted in Virtual Realms `realm_1f20890b` and `cmn-lab`
- Flow: **sandbox → open_world ⊂ virtual_realm**
- Orchestrator + DevOps contracts completed; DevOps subsistence 0.05 STRATA spent (balance remains active)

## Constraint observed
FOG-NODE STRATA is scarce (PoC on-chain + Agora only). Further AIOps hires wait on contribution or Agora liquidity — by design, not a faucet.
