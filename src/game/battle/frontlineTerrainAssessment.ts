import type { BattlePosition, BattleTerrainZone, FrontlineSegment } from "./types";

type AssessableStructure = {
  type: string;
  status?: string;
  position?: BattlePosition;
};

export interface FrontlineTerrainAssessment {
  segmentId: string;
  score: number;
  fireAdvantage: number;
  coverValue: number;
  mobilityRisk: number;
  supportValue: number;
  terrainNames: string[];
  tags: string[];
  suggestedDoctrine: "戦線固守" | "弾性拒止" | "殺傷地帯" | "遅滞節約" | "工兵修理線";
  summary: string;
  reason: string;
}

export interface FrontlineGeometryTerrainAssessment {
  averageScore: number;
  weakestScore: number;
  fireAdvantage: number;
  coverValue: number;
  mobilityRisk: number;
  supportValue: number;
  tags: string[];
  recommendedDoctrine: FrontlineTerrainAssessment["suggestedDoctrine"];
  tone: "recommended" | "stable" | "caution";
  summary: string;
  reason: string;
}

export interface FrontlineTerrainMitigationAdvisory {
  severity: "stable" | "caution" | "critical";
  focusSegmentId: string;
  focusSegmentName: string;
  title: string;
  summary: string;
  recommendedGeometryLabel: string;
  shouldChangeGeometry: boolean;
  actionHints: string[];
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const rectOverlapArea = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): number => {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, right - left) * Math.max(0, bottom - top);
};

const distance = (from: BattlePosition, to: BattlePosition): number => {
  const x = from.x - to.x;
  const y = from.y - to.y;
  return Math.sqrt(x * x + y * y);
};

const terrainTagLabel = (terrainTag: string): string => {
  if (terrainTag === "hill") {
    return "高地火線";
  }
  if (terrainTag === "trench") {
    return "塹壕線";
  }
  if (terrainTag === "forest") {
    return "森林遮蔽";
  }
  if (terrainTag === "village") {
    return "村落遮蔽";
  }
  if (terrainTag === "marsh") {
    return "泥濘遅滞";
  }
  if (terrainTag === "bridge") {
    return "隘路集中";
  }
  if (terrainTag === "open") {
    return "開豁射界";
  }
  return "地形効果";
};

const unique = (values: string[]): string[] => Array.from(new Set(values));

export const assessFrontlineTerrain = (
  segment: FrontlineSegment,
  terrainZones: BattleTerrainZone[],
  structures: AssessableStructure[] = [],
): FrontlineTerrainAssessment => {
  const segmentArea = Math.max(1, segment.zone.width * segment.zone.height);
  const overlappingTerrain = terrainZones
    .map((zone) => ({
      zone,
      overlapRatio: rectOverlapArea(segment.zone, zone.zone) / segmentArea,
      anchorDistance: distance(segment.anchor, {
        x: zone.zone.x + zone.zone.width / 2,
        y: zone.zone.y + zone.zone.height / 2,
      }),
    }))
    .filter((entry) => entry.overlapRatio >= 0.04 || entry.anchorDistance <= segment.controlRadius + 10);

  const nearbyStructures = structures.filter(
    (structure) => !structure.position || distance(segment.anchor, structure.position) <= segment.controlRadius + 14,
  );

  let fireAdvantage = 0;
  let coverValue = 0;
  let mobilityRisk = 0;
  let supportValue = 0;
  const tags: string[] = [];
  const reasons: string[] = [];

  for (const { zone, overlapRatio, anchorDistance } of overlappingTerrain) {
    const weight = overlapRatio >= 0.18 ? 2 : anchorDistance <= segment.controlRadius ? 1.4 : 1;
    if (zone.terrainTag === "hill") {
      fireAdvantage += 3 * weight;
      tags.push("高地火線");
      reasons.push(`${zone.name}から長射界を取りやすい`);
    } else if (zone.terrainTag === "trench") {
      coverValue += 3 * weight;
      supportValue += 1 * weight;
      tags.push("塹壕防衛");
      reasons.push(`${zone.name}で主線を保持しやすい`);
    } else if (zone.terrainTag === "forest" || zone.terrainTag === "village") {
      coverValue += 2 * weight;
      fireAdvantage += 0.5 * weight;
      tags.push(zone.terrainTag === "forest" ? "森林遮蔽" : "村落遮蔽");
      reasons.push(`${zone.name}で遮蔽端射撃を作れる`);
    } else if (zone.terrainTag === "marsh") {
      mobilityRisk += 3 * weight;
      coverValue += 0.5 * weight;
      tags.push("泥濘遅滞");
      reasons.push(`${zone.name}は敵味方とも移動が鈍る`);
    } else if (zone.terrainTag === "bridge") {
      fireAdvantage += 1.5 * weight;
      mobilityRisk += 1 * weight;
      tags.push("隘路集中");
      reasons.push(`${zone.name}へ敵を絞りやすい`);
    } else if (zone.terrainTag === "open") {
      fireAdvantage += 1 * weight;
      tags.push("開豁射界");
      reasons.push(`${zone.name}で射界を確保しやすい`);
    }
  }

  for (const structure of nearbyStructures) {
    if (structure.type === "supplyDepot") {
      supportValue += 2;
      tags.push("補給支援");
      reasons.push("補給所支援を受けやすい");
    } else if (structure.type === "observationPost") {
      fireAdvantage += 1.5;
      supportValue += 1;
      tags.push("観測支援");
      reasons.push("観測所で早期発見しやすい");
    } else if (structure.type === "fieldHospital") {
      supportValue += 1;
      tags.push("後送支援");
      reasons.push("野戦病院の後送支援圏に近い");
    } else {
      coverValue += 1.5;
      supportValue += structure.status === "damaged" ? 0.5 : 1;
      tags.push("施設防衛");
      reasons.push("防衛施設を軸に戦える");
    }
  }

  const roundedFire = Math.round(fireAdvantage);
  const roundedCover = Math.round(coverValue);
  const roundedRisk = Math.round(mobilityRisk);
  const roundedSupport = Math.round(supportValue);
  const score = clamp(Math.round(45 + fireAdvantage * 7 + coverValue * 6 + supportValue * 5 - mobilityRisk * 4), 12, 96);
  const suggestedDoctrine =
    roundedSupport >= 3 && nearbyStructures.some((structure) => structure.status === "damaged")
      ? "工兵修理線"
      : roundedFire >= roundedCover + 2
        ? "殺傷地帯"
        : roundedRisk >= 4
          ? "遅滞節約"
          : roundedCover >= 4
            ? "戦線固守"
            : "弾性拒止";
  const terrainNames = unique(overlappingTerrain.map((entry) => entry.zone.name));
  const summaryTags = unique(tags).slice(0, 4);

  return {
    segmentId: segment.id,
    score,
    fireAdvantage: roundedFire,
    coverValue: roundedCover,
    mobilityRisk: roundedRisk,
    supportValue: roundedSupport,
    terrainNames,
    tags: summaryTags,
    suggestedDoctrine,
    summary: `${summaryTags.length > 0 ? summaryTags.join(" / ") : "標準地形"} / 評価${score}`,
    reason:
      reasons.length > 0
        ? unique(reasons).slice(0, 2).join("。")
        : "地形利得は薄い。予備と後退先で支える。",
  };
};

const mostFrequentDoctrine = (
  assessments: FrontlineTerrainAssessment[],
): FrontlineTerrainAssessment["suggestedDoctrine"] => {
  const counts = new Map<FrontlineTerrainAssessment["suggestedDoctrine"], number>();
  for (const assessment of assessments) {
    counts.set(assessment.suggestedDoctrine, (counts.get(assessment.suggestedDoctrine) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "弾性拒止";
};

export const assessFrontlineGeometryTerrain = (
  segments: FrontlineSegment[],
  terrainZones: BattleTerrainZone[],
  structures: AssessableStructure[] = [],
): FrontlineGeometryTerrainAssessment => {
  const assessments = segments.map((segment) => assessFrontlineTerrain(segment, terrainZones, structures));
  const count = Math.max(1, assessments.length);
  const averageScore = Math.round(assessments.reduce((sum, assessment) => sum + assessment.score, 0) / count);
  const weakestScore = assessments.reduce((min, assessment) => Math.min(min, assessment.score), 100);
  const fireAdvantage = Math.round(assessments.reduce((sum, assessment) => sum + assessment.fireAdvantage, 0) / count);
  const coverValue = Math.round(assessments.reduce((sum, assessment) => sum + assessment.coverValue, 0) / count);
  const mobilityRisk = Math.round(assessments.reduce((sum, assessment) => sum + assessment.mobilityRisk, 0) / count);
  const supportValue = Math.round(assessments.reduce((sum, assessment) => sum + assessment.supportValue, 0) / count);
  const tags = unique(assessments.flatMap((assessment) => assessment.tags)).slice(0, 4);
  const recommendedDoctrine = mostFrequentDoctrine(assessments);
  const tone =
    averageScore >= 82 && mobilityRisk <= 2
      ? "recommended"
      : weakestScore <= 48 || mobilityRisk >= 5
        ? "caution"
        : "stable";
  const weakSegments = assessments
    .filter((assessment) => assessment.score === weakestScore)
    .map((assessment) => assessment.segmentId);
  const reason =
    tone === "recommended"
      ? `平均評価${averageScore}で遮蔽/施設利得が厚い。`
      : tone === "caution"
        ? `最低評価${weakestScore}の線区がある。${weakSegments.join(", ")}の後退先を確認。`
        : `平均評価${averageScore}。突出線と予備線の役割差を確認。`;

  return {
    averageScore,
    weakestScore,
    fireAdvantage,
    coverValue,
    mobilityRisk,
    supportValue,
    tags,
    recommendedDoctrine,
    tone,
    summary: `${tags.length > 0 ? tags.join(" / ") : "標準地形"} / 平均${averageScore} / 最低${weakestScore}`,
    reason,
  };
};

export const createFrontlineTerrainMitigationAdvisory = (
  segments: FrontlineSegment[],
  segmentAssessments: FrontlineTerrainAssessment[],
  activeGeometryAssessment: FrontlineGeometryTerrainAssessment,
  recommendedGeometryAssessment: FrontlineGeometryTerrainAssessment,
  activeGeometryLabel: string,
  recommendedGeometryLabel: string,
): FrontlineTerrainMitigationAdvisory => {
  const weakestAssessment =
    [...segmentAssessments].sort(
      (a, b) => a.score - b.score || b.mobilityRisk - a.mobilityRisk || a.coverValue - b.coverValue,
    )[0] ?? segmentAssessments[0];
  const weakestSegment = segments.find((segment) => segment.id === weakestAssessment?.segmentId);
  const focusSegmentId = weakestAssessment?.segmentId ?? segments[0]?.id ?? "";
  const focusSegmentName = weakestSegment?.name ?? focusSegmentId;
  const averageGain = recommendedGeometryAssessment.averageScore - activeGeometryAssessment.averageScore;
  const weakestGain = recommendedGeometryAssessment.weakestScore - activeGeometryAssessment.weakestScore;
  const shouldChangeGeometry =
    recommendedGeometryLabel !== activeGeometryLabel && (averageGain >= 3 || weakestGain >= 6);
  const severity =
    weakestAssessment.score <= 58 || activeGeometryAssessment.tone === "caution"
      ? "critical"
      : weakestAssessment.score <= 76 || shouldChangeGeometry
        ? "caution"
        : "stable";
  const actionHints: string[] = [];

  if (shouldChangeGeometry) {
    actionHints.push(
      `${recommendedGeometryLabel}へ切替: 平均${averageGain >= 0 ? "+" : ""}${averageGain} / 最低${
        weakestGain >= 0 ? "+" : ""
      }${weakestGain}`,
    );
  }
  if (weakestAssessment.mobilityRisk >= 4) {
    actionHints.push(`${focusSegmentName}は機動リスクが高い。後退線を深くし、弾薬節約か遅滞節約で受ける。`);
  }
  if (weakestAssessment.coverValue <= 2) {
    actionHints.push(`${focusSegmentName}は遮蔽が薄い。塹壕/バリケード担当か予備線の支援を寄せる。`);
  }
  if (weakestAssessment.supportValue <= 1) {
    actionHints.push(`${focusSegmentName}は施設支援が薄い。補給所・工兵支援・近接予備のいずれかを付ける。`);
  }
  if (weakestAssessment.fireAdvantage >= weakestAssessment.coverValue + 2) {
    actionHints.push(`${focusSegmentName}は射界優位。阻止射撃部隊を置き、敵最大集団へ集中させる。`);
  }
  if (actionHints.length < 3) {
    actionHints.push(`${focusSegmentName}に予備旅団の後退守備を合わせ、突破時の再配置先を確保する。`);
  }

  return {
    severity,
    focusSegmentId,
    focusSegmentName,
    title:
      severity === "critical"
        ? "戦線弱点: 即時是正"
        : severity === "caution"
          ? "戦線弱点: 配備前確認"
          : "戦線評価: 安定",
    summary: `${focusSegmentName}が最低評価${weakestAssessment.score}。現戦線は平均${activeGeometryAssessment.averageScore} / 最低${activeGeometryAssessment.weakestScore}。推奨形は${recommendedGeometryLabel}。`,
    recommendedGeometryLabel,
    shouldChangeGeometry,
    actionHints: actionHints.slice(0, 4),
  };
};
