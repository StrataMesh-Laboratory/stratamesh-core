# Contributing to StrataMesh Core

Thank you for your interest in contributing.

## Current stage
We are in **Phase 0 — Operational Baseline**. The focus is a correct, readable, and testable core (DAG, tip selection, SPA templates, status surface) before any mainnet claims.

## Principles
- Core consensus-critical code must remain open-source and eventually formally verifiable.
- Prefer small, reviewable changes with clear intent.
- Lightweight transactions and Fog/Edge SPA behaviour are first-class concerns.
- Documentation and executable examples are as valuable as code.

## How to work
1. Open an issue or RFC for non-trivial design changes (especially tip-selection or SPA semantics).
2. Keep tip-selection and validation logic pure and well-tested.
3. Add or update tests for any behavioural change.
4. Update the public roadmap or status artefacts when a Phase exit criterion is met.

## Local development
```bash
cd src
python3 tip_selection.py          # self-test
python3 local_dag_node.py         # single node HTTP API
python3 multi_node_sim.py         # multi-node gossip simulation
```

## Licence
Contributions are accepted under the MIT Licence (see LICENSE).
