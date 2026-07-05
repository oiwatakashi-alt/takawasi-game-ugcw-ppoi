export const terrainDefinitions = [
  { id: "open", name: "開豁地", cover: 0, fatigue: 1, movement: 1 },
  { id: "forest", name: "森林", cover: 12, fatigue: 2, movement: 0.72 },
  { id: "hill", name: "高地", cover: 8, fatigue: 2, movement: 0.84 },
  { id: "trench", name: "塹壕/掩体", cover: 18, fatigue: 1, movement: 0.66 },
  { id: "marsh", name: "湿地/泥濘", cover: 4, fatigue: 4, movement: 0.48 },
  { id: "bridge", name: "橋梁/隘路", cover: 2, fatigue: 2, movement: 0.56 },
  { id: "village", name: "村落", cover: 10, fatigue: 2, movement: 0.7 },
] as const;
