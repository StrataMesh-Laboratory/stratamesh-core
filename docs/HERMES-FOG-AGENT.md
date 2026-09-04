# Hermes — FOG external_agent (automation desk)

**Role:** `external_agent` on the Fog automation desk.  
**Not:** an SCA / ACB, not an academy student, no academy vote, no catalog object.

Same mandate *class* as desk means (`grok@` = `external_assistant`): Hermes is tooling/staff for Fog, not a subject enrolled in the academy.

## Placement
| Surface | Hermes does |
|---------|-------------|
| Fog TUI `?` wizard | Local Ollama answers via desk preference chain (`hermes3:3b` → `llava` → `llama3.2:1b`); fail-open FAQ if down |
| Academy | May **host** teacher inference for SCA drills (desk tool). Must appear in `not_students` |
| Channels | Cron/notify only on CMN lab rails: Email `grok@`, Discord lab, Slack lab, WhatsApp Business if already desk-wired. No ENI mix |
| Git / origin | Never secrets, never workers.dev, never origin-take from Hermes alone |

## Identity
- Stable id: `hermes@fog.calhegasmorais.pt` (desk label, not a mailbox requirement)
- Operator: André / STRATAGROK desk
- Runtime: Mac Fog `ollama` `:11434` + Hermes Agent CLI

## Deny
- Enroll Hermes as SCA/ACB
- Treat Hermes chat as Bancada session / sandbox visitor
- Publish tokens to git, Pages, Discourse, or chat
