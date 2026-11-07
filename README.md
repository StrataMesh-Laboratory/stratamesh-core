## Introduction to the StrataMesh Core

Welcome to the StrataMesh Core documentation. This section covers the release details, mesh configuration, and initial setup instructions.

### Release Information

- **Release Version:** v0.6.0-lab
- **Status:** Adversarial learning phase P1
- **Reference Fog Node:** FOG-NODE-PT-CM-001
- **Access Note:** Public access via `https://fog.calhegasmorais.pt/health` is denoted as `n=1` `origin=session` `mac_live=false`. Please do not treat it as `mac_live=true`.
- **Further Documentation:** For detailed instructions and setup, please refer to the [Fog Node kit](deploy/fog-node/README.md).

### Mesh Configuration

- Fog Mesh `n=2`: Comprising a Mac Fog node `FOG-NODE-PT-CM-001` and an Edge-Grok node `EDGE-GROK-CMN-001`
- **Not Main Network:**
- **Access Mode:** Public access controlled by `mac_live=false` flag on the JSON.

### Foundation Tokens and Economic Model

Intelligentia · Vigilantia · Veritas

#### Monetary Poles

- **Role of #mint:** Emission source for the token exclusively. It is created via Proof of Concept (PoC) and never transferred out.
- **Role of Wallets:** Holding the primary circulating supply of STRATA tokens.
- **Role of #0:** Burn sink for resource usage, never transferring any balance off-chain.

### API Endpoint Reference

- `https://calhegasmorais.pt/api/v1/token/monetary` for emission source operations.
- `POST /api/v1/token/burn` for usage and resource management.
