import type { ArmyUnit } from "../army/types";
import type { FrontlineSegment, StandingOrder, StandingOrderTemplate } from "./types";
import { clampPositionToDeploymentLimit, frontlineSegmentForUnit } from "./frontlineDefaults";
import { defaultFormationFacingForSegment } from "./formations";

export const cloneStandingOrder = (standingOrder: StandingOrder): StandingOrder => ({
  ...standingOrder,
  anchor: { ...standingOrder.anchor },
  fallback: {
    ...standingOrder.fallback,
    destination: { ...standingOrder.fallback.destination },
  },
  facilityAssignment: standingOrder.facilityAssignment ? { ...standingOrder.facilityAssignment } : undefined,
});

const positionInsideSegment = (segment: FrontlineSegment, position: StandingOrder["anchor"]): boolean =>
  position.x >= (segment.deploymentLimit?.zone.x ?? segment.zone.x) &&
  position.x <= (segment.deploymentLimit?.zone.x ?? segment.zone.x) + (segment.deploymentLimit?.zone.width ?? segment.zone.width) &&
  position.y >= (segment.deploymentLimit?.zone.y ?? segment.zone.y) &&
  position.y <= (segment.deploymentLimit?.zone.y ?? segment.zone.y) + (segment.deploymentLimit?.zone.height ?? segment.zone.height);

export const alignStandingOrderToFrontlineSegments = (
  standingOrder: StandingOrder,
  segments: FrontlineSegment[],
): StandingOrder => {
  const next = cloneStandingOrder(standingOrder);
  const segment = segments.find((candidate) => candidate.id === next.frontlineSegmentId);
  if (!segment) {
    return next;
  }
  if (positionInsideSegment(segment, next.anchor)) {
    return {
      ...next,
      anchor: clampPositionToDeploymentLimit(segment, next.anchor),
      controlRadius: segment.controlRadius,
    };
  }
  return {
    ...next,
    anchor: clampPositionToDeploymentLimit(segment, segment.anchor),
    controlRadius: segment.controlRadius,
    fallback: {
      ...next.fallback,
      destination: { ...segment.fallbackPoint },
    },
  };
};

export const snapStandingOrderToFrontlineSegment = (
  standingOrder: StandingOrder,
  segments: FrontlineSegment[],
): StandingOrder => {
  const segment =
    segments.find((candidate) => candidate.id === standingOrder.frontlineSegmentId) ??
    segments[0];
  if (!segment) {
    return cloneStandingOrder(standingOrder);
  }
  return {
    ...cloneStandingOrder(standingOrder),
    anchor: clampPositionToDeploymentLimit(segment, segment.anchor),
    controlRadius: segment.controlRadius,
    frontlineSegmentId: segment.id,
    fallback: {
      ...standingOrder.fallback,
      destination: { ...segment.fallbackPoint },
    },
  };
};

export const createDeploymentStandingOrderDraft = (
  unit: ArmyUnit,
  index: number,
  savedTemplate?: StandingOrderTemplate,
  segments?: FrontlineSegment[],
): StandingOrder => {
  if (savedTemplate) {
    return segments
      ? alignStandingOrderToFrontlineSegments(savedTemplate.standingOrder, segments)
      : cloneStandingOrder(savedTemplate.standingOrder);
  }

  const segment = frontlineSegmentForUnit(unit.type, index, segments);

  return {
    anchor: { ...segment.anchor },
    controlRadius: segment.controlRadius,
    frontlineSegmentId: segment.id,
    facingDeg: defaultFormationFacingForSegment(segment.id, unit.type),
    posture:
      unit.type === "engineer"
        ? "engineer_support"
        : unit.type === "artillery"
          ? "fire_support"
          : unit.type === "jaeger"
            ? "aggressive_screen"
            : index % 2 === 0
              ? "hold_line"
              : "elastic_defense",
    targetPriority: unit.type === "artillery" ? "largest_mass" : unit.type === "jaeger" ? "officer" : "nearest",
    ammoPolicy: unit.type === "artillery" || unit.type === "engineer" ? "conserve" : "normal",
    fallback: {
      enabled: unit.type !== "artillery",
      moraleBelow: unit.type === "jaeger" ? 42 : 35,
      soldiersBelowRatio: 0.56,
      ammoBelow: unit.type === "engineer" ? 20 : 12,
      destination: { ...segment.fallbackPoint },
    },
  };
};
