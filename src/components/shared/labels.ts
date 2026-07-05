import type { UnitOrder, UnitType } from "../../game/army/types";
import type {
  BattleActionReason,
  AmmoPolicy,
  BattleResult,
  BattleStatus,
  FacilityAssignmentMode,
  StandingPosture,
  TargetPriority,
} from "../../game/battle/types";
import type { FortificationStatus, FortificationType } from "../../game/fortifications/types";
import type { OfficerRank, OfficerStatus } from "../../game/officers/types";
import type { StrategicOperation } from "../../game/theater/types";

export const unitTypeLabels: Record<UnitType, string> = {
  infantry: "戦列歩兵",
  jaeger: "猟兵",
  artillery: "野戦砲兵",
  engineer: "工兵",
};

export const unitOrderLabels: Record<UnitOrder, string> = {
  hold: "保持",
  advance: "前進",
  flank: "側面機動",
  rest: "休息/補給",
  build: "築城/修理",
  retreat: "後退",
};

export const standingPostureLabels: Record<StandingPosture, string> = {
  hold_line: "固守",
  elastic_defense: "弾性防御",
  aggressive_screen: "阻止射撃",
  fire_support: "火力支援",
  engineer_support: "工兵支援",
  fallback_guard: "後退守備",
};

export const targetPriorityLabels: Record<TargetPriority, string> = {
  nearest: "最接近",
  brute: "大型敵",
  officer: "敵指揮",
  riflemen: "敵銃兵",
  largest_mass: "最大集団",
  weakest: "弱敵",
};

export const ammoPolicyLabels: Record<AmmoPolicy, string> = {
  normal: "通常射撃",
  conserve: "弾薬節約",
  intense: "集中射撃",
};

export const facilityAssignmentModeLabels: Record<FacilityAssignmentMode, string> = {
  defend: "防衛",
  repair: "修理",
  resupply: "補給",
  hold_near: "近傍保持",
};

export const battleActionReasonLabels: Record<BattleActionReason, string> = {
  awaiting_orders: "指示待機",
  holding_anchor: "基準位置を保持",
  returning_anchor: "基準位置へ復帰",
  firing_target: "射程内目標へ射撃",
  advancing: "前進機動",
  flanking: "側面機動",
  falling_back: "条件到達で後退",
  retreating: "撤退中",
  moving_to_facility: "担当施設へ移動",
  moving_to_supply: "補給所へ移動",
  resupplying: "補給中",
  moving_to_repair: "修理対象へ移動",
  repairing_structure: "担当施設を修理",
  recovering: "休息/再編中",
  destroyed: "戦闘不能",
};

export const battleStatusLabels: Record<BattleStatus, string> = {
  ready: "配置完了",
  running: "戦闘中",
  paused: "一時停止",
  held: "防衛成功",
  withdrawn: "戦闘撤退",
  collapsed: "戦線崩壊",
};

export const battleOutcomeLabels: Record<BattleResult["outcome"], string> = {
  hold: "防衛成功",
  withdraw: "戦闘撤退",
  collapse: "戦線崩壊",
};

export const operationOutcomeLabels: Record<NonNullable<StrategicOperation["outcome"]>, string> = {
  victory: "成功",
  draw: "痛み分け",
  defeat: "失敗",
};

export const fortificationTypeLabels: Record<FortificationType, string> = {
  trench: "塹壕線",
  barricade: "バリケード",
  supplyDepot: "補給所",
  observationPost: "観測所",
  fieldHospital: "野戦病院",
};

export const fortificationStatusLabels: Record<FortificationStatus, string> = {
  planned: "計画中",
  built: "稼働中",
  damaged: "損傷",
  overrun: "蹂躙",
  abandoned: "放棄",
};

export const terrainLabels: Record<string, string> = {
  open: "開豁地",
  forest: "森林",
  hill: "高地",
  trench: "塹壕/掩体",
  marsh: "湿地/泥濘",
  bridge: "橋梁/隘路",
  village: "村落",
};

export const weaponLabels: Record<string, string> = {
  reserveRifle: "後装旧式銃",
  dreyse: "針撃銃",
  mauser71: "改良針撃銃",
  jaegerRifle: "猟兵銃",
  fieldGun: "野戦砲",
  tools: "工兵器材",
};

export const officerRankLabels: Record<OfficerRank, string> = {
  Captain: "大尉",
  Major: "少佐",
  Colonel: "大佐",
  General: "将軍",
};

export const officerStatusLabels: Record<OfficerStatus, string> = {
  active: "任務中",
  resting: "休養中",
  wounded: "負傷療養",
  dead: "戦死",
};

export const formatTerrainTags = (tags: string[]): string =>
  tags.map((tag) => terrainLabels[tag] ?? tag).join("、");
