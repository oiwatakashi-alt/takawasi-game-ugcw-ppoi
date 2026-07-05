import type { UnitOrder, UnitType } from "../army/types";
import type { BattleFormation, BattlePosition, BattleUnit, StandingPosture } from "./types";

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const degreesToRadians = (degrees: number): number => degrees * (Math.PI / 180);

export interface FormationFacingOption {
  facingDeg: number;
  label: string;
  shortLabel: string;
}

export const formationFacingOptions: FormationFacingOption[] = [
  { facingDeg: -48, label: "北東拒止", shortLabel: "北東拒止" },
  { facingDeg: -24, label: "北東斜行", shortLabel: "北東" },
  { facingDeg: 0, label: "正面", shortLabel: "正面" },
  { facingDeg: 24, label: "南東斜行", shortLabel: "南東" },
  { facingDeg: 48, label: "南東拒止", shortLabel: "南東拒止" },
];

export const normalizeFormationFacingDeg = (facingDeg?: number): number => Math.round(clamp(facingDeg ?? 0, -65, 65));

export const formationFacingLabel = (facingDeg?: number): string => {
  const normalized = normalizeFormationFacingDeg(facingDeg);
  const exact = formationFacingOptions.find((option) => option.facingDeg === normalized);
  if (exact) {
    return exact.label;
  }
  if (normalized <= -38) {
    return "北東拒止";
  }
  if (normalized < -8) {
    return "北東斜行";
  }
  if (normalized <= 8) {
    return "正面";
  }
  if (normalized < 38) {
    return "南東斜行";
  }
  return "南東拒止";
};

export const formationFacingDisplayLabel = (facingDeg?: number): string => {
  const normalized = normalizeFormationFacingDeg(facingDeg);
  const signed = normalized > 0 ? `+${normalized}` : `${normalized}`;
  return `${formationFacingLabel(normalized)} ${signed}度`;
};

export const defaultFormationFacingForSegment = (segmentId?: string, type?: UnitType): number => {
  if (type === "artillery") {
    return 0;
  }
  if (segmentId === "left-flank") {
    return 24;
  }
  if (segmentId === "right-flank") {
    return -24;
  }
  if (segmentId === "engineer-line") {
    return 0;
  }
  return 0;
};

const facingVector = (facingDeg?: number): BattlePosition => {
  const radians = degreesToRadians(normalizeFormationFacingDeg(facingDeg));
  return { x: Math.cos(radians), y: Math.sin(radians) };
};

const lateralVector = (facingDeg?: number): BattlePosition => {
  const forward = facingVector(facingDeg);
  return { x: -forward.y, y: forward.x };
};

export const pointFromFormationFrame = (
  origin: BattlePosition,
  facingDeg: number | undefined,
  forwardDistance: number,
  lateralDistance: number,
): BattlePosition => {
  const forward = facingVector(facingDeg);
  const lateral = lateralVector(facingDeg);
  return {
    x: origin.x + forward.x * forwardDistance + lateral.x * lateralDistance,
    y: origin.y + forward.y * forwardDistance + lateral.y * lateralDistance,
  };
};

const projectToFormationFrame = (
  origin: BattlePosition,
  facingDeg: number | undefined,
  point: BattlePosition,
): { forward: number; lateral: number } => {
  const forward = facingVector(facingDeg);
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  return {
    forward: dx * forward.x + dy * forward.y,
    lateral: -dx * forward.y + dy * forward.x,
  };
};

const baseFormationByType: Record<
  UnitType,
  { min: number; base: number; max: number; depth: number; fireArcDeg: number; densityBase: number }
> = {
  infantry: { min: 12, base: 20, max: 28, depth: 4.2, fireArcDeg: 64, densityBase: 42 },
  jaeger: { min: 14, base: 22, max: 32, depth: 3.2, fireArcDeg: 86, densityBase: 28 },
  artillery: { min: 7, base: 10, max: 15, depth: 5.2, fireArcDeg: 38, densityBase: 18 },
  engineer: { min: 8, base: 12, max: 18, depth: 4.5, fireArcDeg: 56, densityBase: 26 },
};

const postureFrontageMultiplier: Record<StandingPosture, number> = {
  hold_line: 1.06,
  elastic_defense: 0.98,
  aggressive_screen: 1.16,
  fire_support: 0.74,
  engineer_support: 0.78,
  fallback_guard: 0.9,
};

const orderFrontageMultiplier: Record<UnitOrder, number> = {
  hold: 1,
  advance: 0.86,
  flank: 0.92,
  rest: 0.82,
  build: 0.8,
  retreat: 0.68,
};

export const createFormationForUnit = (
  type: UnitType,
  soldiers: number,
  maxSoldiers: number,
  posture: StandingPosture,
  order: UnitOrder,
  facingDeg = 0,
): BattleFormation => {
  const base = baseFormationByType[type];
  const strengthRatio = clamp(soldiers / Math.max(1, maxSoldiers), 0.18, 1.15);
  const frontageWidth = clamp(
    base.base * Math.sqrt(strengthRatio) * postureFrontageMultiplier[posture] * orderFrontageMultiplier[order],
    base.min,
    base.max,
  );
  const density = clamp(soldiers / Math.max(1, frontageWidth * base.densityBase), 0.2, 2.4);

  return {
    frontageWidth,
    depth: base.depth * clamp(density, 0.75, 1.55),
    fireArcDeg: base.fireArcDeg,
    facingDeg: normalizeFormationFacingDeg(facingDeg),
    density,
    overlapPressure: 0,
  };
};

const overlapPressureForUnit = (unit: BattleUnit, units: BattleUnit[]): number =>
  units.reduce((pressure, other) => {
    if (other.unitId === unit.unitId || other.soldiers <= 0) {
      return pressure;
    }
    const unitFront = unit.formation.frontageWidth;
    const otherFront = other.formation.frontageWidth;
    const lateralLimit = (unitFront + otherFront) * 0.38;
    const xLimit = Math.max(5, (unit.formation.depth + other.formation.depth) * 0.72);
    const xOverlap = Math.max(0, 1 - Math.abs(unit.position.x - other.position.x) / xLimit);
    const yOverlap = Math.max(0, 1 - Math.abs(unit.position.y - other.position.y) / lateralLimit);
    return pressure + xOverlap * yOverlap;
  }, 0);

export const updateFormationStates = (units: BattleUnit[]): BattleUnit[] => {
  const withBase = units.map((unit) => ({
    ...unit,
    formation: createFormationForUnit(
      unit.type,
      unit.soldiers,
      unit.maxSoldiers,
      unit.standingOrder.posture,
      unit.order,
      unit.standingOrder.facingDeg ?? unit.formation.facingDeg,
    ),
  }));

  return withBase.map((unit) => ({
    ...unit,
    formation: {
      ...unit.formation,
      overlapPressure: clamp(overlapPressureForUnit(unit, withBase), 0, 1.4),
    },
  }));
};

export const formationDistanceToPoint = (unit: BattleUnit, point: BattlePosition): number => {
  const halfFront = unit.formation.frontageWidth / 2;
  const projected = projectToFormationFrame(unit.position, unit.formation.facingDeg, point);
  const forwardOutside = Math.max(0, Math.abs(projected.forward) - unit.formation.depth / 2);
  const lateralOutside = Math.max(0, Math.abs(projected.lateral) - halfFront);
  return Math.sqrt(forwardOutside * forwardOutside + lateralOutside * lateralOutside);
};

export const targetWithinFormationArc = (unit: BattleUnit, point: BattlePosition, range: number): boolean => {
  const projected = projectToFormationFrame(unit.position, unit.formation.facingDeg, point);
  if (projected.forward < -6 || projected.forward > range) {
    return false;
  }
  const arcRadians = (unit.formation.fireArcDeg / 2) * (Math.PI / 180);
  const lateralLimit = unit.formation.frontageWidth * 0.58 + Math.max(10, projected.forward) * Math.tan(arcRadians);
  return Math.abs(projected.lateral) <= lateralLimit;
};

export const formationFireMultiplier = (unit: BattleUnit): number =>
  clamp(
    0.86 +
      unit.formation.frontageWidth / 150 +
      (unit.standingOrder.posture === "aggressive_screen" ? 0.05 : 0) -
      unit.formation.overlapPressure * 0.24 -
      Math.max(0, unit.formation.density - 1.35) * 0.1,
    0.55,
    1.16,
  );

export const formationExposureMultiplier = (unit: BattleUnit): number =>
  clamp(
    1 -
      unit.formation.frontageWidth / 420 +
      unit.formation.overlapPressure * 0.36 +
      Math.max(0, unit.formation.density - 1.25) * 0.1,
    0.82,
    1.48,
  );

export const formationSummary = (unit: BattleUnit): string =>
  `幅${Math.round(unit.formation.frontageWidth)} / ${formationFacingDisplayLabel(unit.formation.facingDeg)} / 密${unit.formation.density.toFixed(1)} / 重${Math.round(unit.formation.overlapPressure * 100)}%`;
