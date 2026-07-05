import { weaponDefinitions } from "../../content/baseGame/weapons";
import type { ArmyUnit, UnitType } from "./types";
import type { ResourceBundle } from "../logistics/types";

export type WeaponKey = keyof typeof weaponDefinitions;

export const defaultWeaponByUnitType: Record<UnitType, WeaponKey> = {
  infantry: "dreyse",
  jaeger: "jaegerRifle",
  artillery: "fieldGun",
  engineer: "tools",
};

export const weaponByUnitType = defaultWeaponByUnitType;

export const isWeaponKey = (value: string | undefined): value is WeaponKey =>
  !!value && value in weaponDefinitions;

export const getWeaponAssetKey = (weaponKey: WeaponKey): "dreyse" | "jaegerRifle" | "fieldGun" | "tools" =>
  weaponDefinitions[weaponKey].assetKey;

export const canUnitEquipWeapon = (unitType: UnitType, weaponKey: WeaponKey): boolean =>
  (weaponDefinitions[weaponKey].compatibleTypes as readonly UnitType[]).includes(unitType);

export const getUnitWeaponKey = (unit: ArmyUnit): WeaponKey => {
  if (isWeaponKey(unit.weaponKey) && canUnitEquipWeapon(unit.type, unit.weaponKey)) {
    return unit.weaponKey;
  }
  return defaultWeaponByUnitType[unit.type];
};

export const compatibleWeaponsForUnit = (unit: ArmyUnit): WeaponKey[] =>
  (Object.keys(weaponDefinitions) as WeaponKey[]).filter((weaponKey) => canUnitEquipWeapon(unit.type, weaponKey));

export interface RearmEstimate {
  weaponKey: WeaponKey;
  targetQuality: number;
  currentQuality: number;
  neededWeapons: number;
  availableWeapons: number;
  qualityGain: number;
  canImprove: boolean;
}

export interface RearmResult {
  unit: ArmyUnit;
  resources: ResourceBundle;
  message: string;
  issuedWeapons: number;
}

export interface WeaponSwitchEstimate {
  fromKey: WeaponKey;
  toKey: WeaponKey;
  compatible: boolean;
  requiredWeapons: number;
  availableWeapons: number;
  returnedWeapons: number;
  targetQuality: number;
  nextQuality: number;
  canSwitch: boolean;
}

export interface WeaponSwitchResult {
  unit: ArmyUnit;
  resources: ResourceBundle;
  message: string;
  consumedWeapons: number;
  returnedWeapons: number;
}

export const estimateRearm = (unit: ArmyUnit, resources: ResourceBundle): RearmEstimate => {
  const weaponKey = getUnitWeaponKey(unit);
  const targetQuality = weaponDefinitions[weaponKey].quality;
  const qualityGap = Math.max(0, targetQuality - unit.weaponQuality);
  const neededWeapons = qualityGap > 0 ? Math.max(1, Math.ceil(unit.soldiers * (qualityGap / targetQuality))) : 0;
  const availableWeapons = resources.weapons[weaponKey] ?? 0;
  const issuedWeapons = Math.min(neededWeapons, availableWeapons);
  const qualityGain = neededWeapons > 0 ? qualityGap * (issuedWeapons / neededWeapons) : 0;

  return {
    weaponKey,
    targetQuality,
    currentQuality: unit.weaponQuality,
    neededWeapons,
    availableWeapons,
    qualityGain,
    canImprove: neededWeapons > 0 && issuedWeapons > 0,
  };
};

export const rearmUnit = (unit: ArmyUnit, resources: ResourceBundle): RearmResult => {
  const estimate = estimateRearm(unit, resources);
  if (estimate.neededWeapons === 0) {
    return {
      unit,
      resources,
      message: `${unit.name}の装備品質はすでに十分だ。`,
      issuedWeapons: 0,
    };
  }
  if (estimate.availableWeapons <= 0) {
    return {
      unit,
      resources,
      message: `${weaponDefinitions[estimate.weaponKey].name}の予備在庫がない。`,
      issuedWeapons: 0,
    };
  }

  const issuedWeapons = Math.min(estimate.neededWeapons, estimate.availableWeapons);
  const nextQuality = Math.min(estimate.targetQuality, unit.weaponQuality + estimate.qualityGain);
  return {
    unit: {
      ...unit,
      weaponQuality: Number(nextQuality.toFixed(2)),
      battleHistory: [
        `${weaponDefinitions[estimate.weaponKey].name}を${issuedWeapons}挺/門再配備、装備品質${nextQuality.toFixed(2)}`,
        ...unit.battleHistory,
      ].slice(0, 8),
    },
    resources: {
      ...resources,
      weapons: {
        ...resources.weapons,
        [estimate.weaponKey]: Math.max(0, estimate.availableWeapons - issuedWeapons),
      },
    },
    message: `${unit.name}へ${weaponDefinitions[estimate.weaponKey].name}を${issuedWeapons}挺/門再配備した。`,
    issuedWeapons,
  };
};

export const estimateWeaponSwitch = (
  unit: ArmyUnit,
  resources: ResourceBundle,
  toKey: WeaponKey,
): WeaponSwitchEstimate => {
  const fromKey = getUnitWeaponKey(unit);
  const compatible = canUnitEquipWeapon(unit.type, toKey);
  const requiredWeapons = Math.max(1, Math.ceil(unit.soldiers * 0.75));
  const availableWeapons = resources.weapons[toKey] ?? 0;
  const fromQuality = weaponDefinitions[fromKey].quality;
  const returnedWeapons =
    fromKey === toKey ? 0 : Math.max(0, Math.floor(unit.soldiers * 0.62 * Math.min(1, unit.weaponQuality / fromQuality)));
  const targetQuality = weaponDefinitions[toKey].quality;

  return {
    fromKey,
    toKey,
    compatible,
    requiredWeapons,
    availableWeapons,
    returnedWeapons,
    targetQuality,
    nextQuality: targetQuality,
    canSwitch: compatible && fromKey !== toKey && availableWeapons >= requiredWeapons,
  };
};

export const switchUnitWeapon = (
  unit: ArmyUnit,
  resources: ResourceBundle,
  toKey: WeaponKey,
): WeaponSwitchResult => {
  const estimate = estimateWeaponSwitch(unit, resources, toKey);
  if (!estimate.compatible) {
    return {
      unit,
      resources,
      message: `${unit.name}は${weaponDefinitions[toKey].name}を装備できない。`,
      consumedWeapons: 0,
      returnedWeapons: 0,
    };
  }
  if (estimate.fromKey === toKey) {
    return {
      unit,
      resources,
      message: `${unit.name}はすでに${weaponDefinitions[toKey].name}を装備している。`,
      consumedWeapons: 0,
      returnedWeapons: 0,
    };
  }
  if (estimate.availableWeapons < estimate.requiredWeapons) {
    return {
      unit,
      resources,
      message: `${weaponDefinitions[toKey].name}が不足している。必要${estimate.requiredWeapons} / 在庫${estimate.availableWeapons}。`,
      consumedWeapons: 0,
      returnedWeapons: 0,
    };
  }

  const nextWeapons = {
    ...resources.weapons,
    [toKey]: estimate.availableWeapons - estimate.requiredWeapons,
    [estimate.fromKey]: (resources.weapons[estimate.fromKey] ?? 0) + estimate.returnedWeapons,
  };
  const nextQuality = Number(estimate.nextQuality.toFixed(2));
  return {
    unit: {
      ...unit,
      weaponKey: toKey,
      weaponQuality: nextQuality,
      battleHistory: [
        `${weaponDefinitions[estimate.fromKey].name}から${weaponDefinitions[toKey].name}へ換装、装備品質${nextQuality.toFixed(2)}`,
        ...unit.battleHistory,
      ].slice(0, 8),
    },
    resources: {
      ...resources,
      weapons: nextWeapons,
    },
    message: `${unit.name}を${weaponDefinitions[toKey].name}へ換装した。新装備${estimate.requiredWeapons}、旧装備回収${estimate.returnedWeapons}。`,
    consumedWeapons: estimate.requiredWeapons,
    returnedWeapons: estimate.returnedWeapons,
  };
};
