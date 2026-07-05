export interface ResourceBundle {
  gold: number;
  recruits: number;
  veterans: number;
  ammunition: number;
  supplies: number;
  materials: number;
  engineerLabor: number;
  reputation: number;
  weapons: Record<string, number>;
}

export type ResourceKey = Exclude<keyof ResourceBundle, "weapons">;

export const createInitialResources = (): ResourceBundle => ({
  gold: 1250,
  recruits: 920,
  veterans: 180,
  ammunition: 780,
  supplies: 430,
  materials: 360,
  engineerLabor: 95,
  reputation: 52,
  weapons: {
    reserveRifle: 900,
    dreyse: 2400,
    mauser71: 620,
    jaegerRifle: 420,
    fieldGun: 28,
    tools: 180,
  },
});
