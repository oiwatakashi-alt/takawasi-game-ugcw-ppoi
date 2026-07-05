export const operationDefinitions = [
  { id: "holdSector", name: "戦区防衛", canAutoResolve: false },
  { id: "counterattack", name: "限定反撃", canAutoResolve: true },
  { id: "reconPatrol", name: "偵察任務", canAutoResolve: true },
  { id: "engineerWorks", name: "工兵作業", canAutoResolve: true },
  { id: "raidEnemyNest", name: "敵巣襲撃", canAutoResolve: true },
  { id: "railRepair", name: "鉄道復旧", canAutoResolve: true },
] as const;
