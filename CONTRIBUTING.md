
## Who this is for

We are **not** recruiting “generic crypto developers.”

If you already contribute upstream to **libp2p, KubeEdge, Golem, Akash, IPFS, IOTA, Kubernetes, LangGraph/AG2, EdgeX, Akri, Godot/Bevy** (or similar), there is likely a **track** where your existing expertise maps onto a StrataMesh problem — networking, edge, compute economics, agents, worlds, or identity.

- Outreach map: [`docs/COMMUNITY-OUTREACH-MAP.md`](docs/COMMUNITY-OUTREACH-MAP.md)
- Tracks: [`docs/CONTRIBUTOR-TRACKS.md`](docs/CONTRIBUTOR-TRACKS.md)
- Wanted problems: [`docs/WANTED.md
- Why you fit: [`docs/WHY-YOUR-EXPERTISE-MATTERS.md`](docs/WHY-YOUR-EXPERTISE-MATTERS.md)
- Outreach playbook: [`docs/OUTREACH-PLAYBOOK.md`](docs/OUTREACH-PLAYBOOK.md)`](docs/WANTED.md)
- Funded challenges: [fund.calhegasmorais.pt/challenges](https://fund.calhegasmorais.pt/challenges)
- Sponsors: [github.com/sponsors/amcmorais](https://github.com/sponsors/amcmorais)

Use issue template **Track contribution** and label `track:*`.

# Contributing to StrataMesh Laboratory

**Open contribution is welcome.** Canonical code lives under [`StrataMesh-Laboratory`](https://github.com/StrataMesh-Laboratory).

`@amcmorais` is **one contributor** (and org admin / reference-node operator via AMCM ENI). Reviews and merges are organisation work, not a personal mainline.

## Where to contribute

| Repository | Focus |
|------------|--------|
| [stratamesh-core](https://github.com/StrataMesh-Laboratory/stratamesh-core) | Protocol core, workers, DAG, tip selection, docs |
| [stratamesh-laboratory](https://github.com/StrataMesh-Laboratory/stratamesh-laboratory) | Charter, posture, research ladder |
| [calhegas-morais-node](https://github.com/StrataMesh-Laboratory/calhegas-morais-node) | Reference Fog node registry |
| [stratamesh-impact-fund](https://github.com/StrataMesh-Laboratory/stratamesh-impact-fund) | Impact Fund app · challenges · Sponsors rails |

**Do not** use [`amcmorais/stratamesh-core`](https://github.com/amcmorais/stratamesh-core) — it is **archived** (outdated personal path).

## How (fork → PR)

1. Fork the target repo under your account.
2. Branch from `main` (`feat/…`, `fix/…`, `docs/…`).
3. Open a Pull Request against `StrataMesh-Laboratory/<repo>:main`.
4. Fill the PR template; link issues / impact challenges when relevant.
5. Keep changes reviewable; add tests for behavioural core changes.

Issues and [Impact challenges](https://fund.calhegasmorais.pt/challenges) (`impact-challenge` label) are first-class entry points. Funded work uses the same PR path with metrics on the issue.

## Lab honesty

This is **lab / not mainnet**. Do not claim production finality, aBFT, or live PQ. See the public roadmap in `stratamesh-core`.

## Licence

Unless noted otherwise, contributions are under the repository’s licence (MIT on core).

## Conduct

Be precise, technical, and respectful. No harassment. Security-sensitive reports: prefer private contact to the operator (`geral@eni.calhegasmorais.pt`) before public issues when disclosure could harm the node.


## Core-specific

See also `docs/ROADMAP-PUBLIC-v0.3.md`. Tip-selection and validation changes need tests (`src/`).
