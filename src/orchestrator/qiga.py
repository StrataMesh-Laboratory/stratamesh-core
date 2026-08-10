"""
Quantum-Inspired Genetic Algorithm (QIGA)
=========================================
No physical qubits required. Genotypes are rotation-angle registers.
Measurement collapses to concrete real-valued policy vectors.
Fitness is supplied by the probabilistic lobe; reproduction is gated
by the symbolic lobe (only admissible individuals breed).
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Callable, Optional, Tuple
import math
import random


@dataclass
class Individual:
    # Each gene is a rotation angle θ ∈ [0, π/2]; amplitude cos(θ), sin(θ)
    theta: List[float]
    fitness: float = 0.0
    admissible: bool = True
    generation: int = 0

    def measure(self, rng: random.Random) -> List[float]:
        """Collapse superposition-inspired state to a concrete vector in [0, 1]."""
        out = []
        for th in self.theta:
            # P(|1>) = sin²(θ)
            p1 = math.sin(th) ** 2
            out.append(1.0 if rng.random() < p1 else 0.0)
        return out

    def continuous_phenotype(self) -> List[float]:
        """Soft phenotype: sin²(θ) as real allele in [0, 1]."""
        return [math.sin(th) ** 2 for th in self.theta]


def random_individual(n_genes: int, rng: random.Random, generation: int = 0) -> Individual:
    return Individual(
        theta=[rng.uniform(0, math.pi / 2) for _ in range(n_genes)],
        generation=generation,
    )


class QIGAPopulation:
    def __init__(
        self,
        n_individuals: int = 20,
        n_genes: int = 8,
        seed: int = 42,
        mutation_scale: float = 0.08,
    ):
        self.rng = random.Random(seed)
        self.n_genes = n_genes
        self.mutation_scale = mutation_scale
        self.generation = 0
        self.population: List[Individual] = [
            random_individual(n_genes, self.rng) for _ in range(n_individuals)
        ]

    def evaluate(self, fitness_fn: Callable[[List[float]], float]):
        for ind in self.population:
            phenotype = ind.continuous_phenotype()
            ind.fitness = fitness_fn(phenotype)

    def mark_admissible(self, predicate: Callable[[Individual], bool]):
        for ind in self.population:
            ind.admissible = predicate(ind)

    def _interfere(self, a: Individual, b: Individual) -> Individual:
        """Interference crossover on rotation angles."""
        child_theta = []
        for ta, tb in zip(a.theta, b.theta):
            # Constructive bias toward higher-fitness parent
            w = 0.5 + 0.3 * (a.fitness - b.fitness)
            w = max(0.2, min(0.8, w))
            child_theta.append(w * ta + (1 - w) * tb)
        return Individual(theta=child_theta, generation=self.generation + 1)

    def _mutate(self, ind: Individual):
        for i in range(len(ind.theta)):
            if self.rng.random() < 0.2:
                ind.theta[i] += self.rng.gauss(0, self.mutation_scale)
                ind.theta[i] = max(0.0, min(math.pi / 2, ind.theta[i]))

    def evolve(self) -> Individual:
        """One generation: select admissible, interfere, mutate. Returns best."""
        admissible = [i for i in self.population if i.admissible]
        if len(admissible) < 2:
            admissible = list(self.population)

        admissible.sort(key=lambda x: x.fitness, reverse=True)
        elites = admissible[: max(2, len(admissible) // 4)]
        next_pop: List[Individual] = [Individual(theta=list(e.theta), fitness=e.fitness, generation=self.generation + 1) for e in elites]

        while len(next_pop) < len(self.population):
            p1, p2 = self.rng.sample(admissible, 2)
            child = self._interfere(p1, p2)
            self._mutate(child)
            next_pop.append(child)

        self.population = next_pop
        self.generation += 1
        return max(self.population, key=lambda x: x.fitness)

    def best(self) -> Individual:
        return max(self.population, key=lambda x: x.fitness)
