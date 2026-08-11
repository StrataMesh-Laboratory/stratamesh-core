# PoC: resource ≠ function

## Rule
**Resource** is measurable capacity (storage, compute, bandwidth, availability).  
**Function** is what that capacity is used for (which app, CID, SPA, user).

Pricing uses **only**:
1. billable quantity of a **resource class**
2. exogenous **market average** for that resource
3. **quality** premium/discount *within* that resource
4. Agora FX into STRATA

Function never creates a separate price line. Disk is disk whether it holds realm assets or gossip CIDs.

## Resource classes
| Class | Unit | Not priced by |
|-------|------|----------------|
| `storage` | MB-month | which object / app |
| `compute` | work-unit | which task type |
| `bandwidth` | propagation-unit | which message |
| `availability` | uptime-slice | which service name |

Legacy aliases (`ipfs_pin`→storage, `validate`→compute, `gossip`→bandwidth, `fog_uptime`→availability) remain for compat only.

## Quality
Only lever inside a resource class (reliability, usefulness, availability, verifiability of the *capacity*, not its social purpose).
