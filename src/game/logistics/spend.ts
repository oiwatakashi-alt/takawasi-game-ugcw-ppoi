import type { ResourceBundle, ResourceKey } from "./types";

export type ResourceCost = Partial<Record<ResourceKey, number>>;

export const canAfford = (resources: ResourceBundle, cost: ResourceCost): boolean =>
  Object.entries(cost).every(([key, value]) => resources[key as ResourceKey] >= (value ?? 0));

export const spendResources = (resources: ResourceBundle, cost: ResourceCost): ResourceBundle => {
  if (!canAfford(resources, cost)) {
    return resources;
  }

  const next = { ...resources, weapons: { ...resources.weapons } };
  for (const [key, value] of Object.entries(cost)) {
    next[key as ResourceKey] -= value ?? 0;
  }
  return next;
};

export const addResources = (resources: ResourceBundle, delta: ResourceCost): ResourceBundle => {
  const next = { ...resources, weapons: { ...resources.weapons } };
  for (const [key, value] of Object.entries(delta)) {
    next[key as ResourceKey] += value ?? 0;
  }
  return next;
};
