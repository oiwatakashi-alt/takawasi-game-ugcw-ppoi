export type ScreenId =
  | "campaign-map"
  | "camp-army"
  | "camp-officers"
  | "camp-armory"
  | "camp-engineering"
  | "camp-doctrine"
  | "deployment"
  | "battle"
  | "after-action";

export const SCREEN_LABELS: Record<ScreenId, string> = {
  "campaign-map": "戦略マップ",
  "camp-army": "軍編成",
  "camp-officers": "将校",
  "camp-armory": "兵站・装備",
  "camp-engineering": "築城",
  "camp-doctrine": "参謀方針",
  deployment: "出撃配置",
  battle: "戦闘",
  "after-action": "戦果報告",
};

export const CAMP_SCREENS: ScreenId[] = [
  "camp-army",
  "camp-officers",
  "camp-armory",
  "camp-engineering",
  "camp-doctrine",
];
