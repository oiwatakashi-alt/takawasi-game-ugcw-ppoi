import type { UnitType } from "../game/army/types";
import type { EnemyBattleUnit } from "../game/battle/types";
import type { FortificationStatus, FortificationType } from "../game/fortifications/types";

export interface GeneratedImageAsset {
  id: string;
  src128: string;
  src64: string;
  usage: string;
  status: "placeholder" | "generated" | "processed";
}

export interface AssetManifestEntry {
  id: string;
  path: string;
  status: GeneratedImageAsset["status"];
  usage: string;
}

export type DoctrineIconId =
  | "command"
  | "organization"
  | "training"
  | "logistics"
  | "engineering"
  | "medicine"
  | "intelligence";

export type WeaponAssetId = "dreyse" | "jaegerRifle" | "fieldGun" | "tools";

const assetUrl = (fileName: string) => new URL(`./generated/${fileName}`, import.meta.url).href;

const imageAsset = (id: string, usage: string, status: GeneratedImageAsset["status"] = "processed"): GeneratedImageAsset => ({
  id,
  src128: assetUrl(`${id}-128.png`),
  src64: assetUrl(`${id}-64.png`),
  usage,
  status,
});

export const assetRegistry = {
  battle: {
    unitTokens: {
      infantry: imageAsset("player-infantry-token", "Battle/Army自軍歩兵駒。"),
      jaeger: imageAsset("player-jaeger-token", "Battle/Army自軍猟兵駒。"),
      artillery: imageAsset("player-artillery-token", "Battle/Army自軍砲兵駒。"),
      engineer: imageAsset("player-engineer-token", "Battle/Army自軍工兵駒。"),
    } satisfies Record<UnitType, GeneratedImageAsset>,
    enemyTokens: {
      undeadMob: imageAsset("undead-mob-token", "Battle敵アンデッド群集駒。"),
      undeadRiflemen: imageAsset("undead-riflemen-token", "Battle敵アンデッド銃兵駒。"),
      brute: imageAsset("undead-brute-token", "Battle敵Brute駒。"),
      undeadOfficer: imageAsset("undead-officer-token", "Battle敵将校駒。"),
    } satisfies Record<EnemyBattleUnit["type"], GeneratedImageAsset>,
    structures: {
      trench: imageAsset("trench-token", "Battle/Engineering塹壕施設駒。"),
      barricade: imageAsset("barricade-token", "Battle/Engineeringバリケード施設駒。"),
      supplyDepot: imageAsset("supply-depot-icon", "Battle/Engineering補給所施設駒。"),
      observationPost: imageAsset("facility-observation-icon", "Battle/Engineering観測所施設駒。"),
      fieldHospital: imageAsset("facility-hospital-icon", "Battle/Engineering野戦病院施設駒。"),
    } satisfies Record<FortificationType, GeneratedImageAsset>,
    objectives: {
      victory: imageAsset("objective-victory-icon", "Battle勝利地点アイコン。"),
      supply: imageAsset("objective-supply-icon", "Battle補給点アイコン。"),
      visibility: imageAsset("objective-visibility-icon", "Battle視界点アイコン。"),
    },
    status: {
      built: imageAsset("range-marker-icon", "施設稼働中/範囲補助アイコン。"),
      planned: imageAsset("deployment-zone-corner", "施設計画中補助アイコン。"),
      damaged: imageAsset("status-damaged-icon", "施設損傷アイコン。"),
      overrun: imageAsset("status-overrun-icon", "施設制圧/突破アイコン。"),
      abandoned: imageAsset("enemy-pressure-marker-icon", "施設放棄/危険アイコン。"),
    } satisfies Record<FortificationStatus, GeneratedImageAsset>,
    markers: {
      target: imageAsset("target-marker-icon", "Battle現在目標マーカー。"),
      range: imageAsset("range-marker-icon", "Battle射程マーカー。"),
      repair: imageAsset("repair-marker-icon", "Battle/Engineering修理マーカー。"),
    },
  },
  army: {
    unitTokens: {
      infantry: imageAsset("player-infantry-token", "Army歩兵兵科トークン。"),
      jaeger: imageAsset("player-jaeger-token", "Army猟兵兵科トークン。"),
      artillery: imageAsset("player-artillery-token", "Army砲兵兵科トークン。"),
      engineer: imageAsset("player-engineer-token", "Army工兵兵科トークン。"),
    } satisfies Record<UnitType, GeneratedImageAsset>,
    brigadeFlags: {
      infantry: imageAsset("brigade-flag-infantry", "Army歩兵旅団旗。"),
      jaeger: imageAsset("brigade-flag-jaeger", "Army猟兵旅団旗。"),
      artillery: imageAsset("brigade-flag-artillery", "Army砲兵旅団旗。"),
      engineer: imageAsset("brigade-flag-engineer", "Army工兵旅団旗。"),
    } satisfies Record<UnitType, GeneratedImageAsset>,
    brigadeCardFrame: imageAsset("brigade-card-frame-icon", "Army旅団カード紙枠。"),
    corpsStandard: imageAsset("corps-standard-icon", "Army I軍団軍旗/徽章。"),
    officerPortrait: imageAsset("officer-portrait-generic", "Army/Officers汎用士官肖像。"),
    officerSilhouette: imageAsset("officer-silhouette", "Army未任命士官シルエット。"),
    weapons: {
      dreyse: imageAsset("weapon-dreyse-icon", "Armory針撃銃シルエット。"),
      jaegerRifle: imageAsset("weapon-jaeger-rifle-icon", "Armory猟兵銃シルエット。"),
      fieldGun: imageAsset("weapon-field-gun-icon", "Armory野戦砲シルエット。"),
      tools: imageAsset("weapon-tools-icon", "Armory工兵器材シルエット。"),
    } satisfies Record<WeaponAssetId, GeneratedImageAsset>,
  },
  deployment: {
    zoneCorner: imageAsset("deployment-zone-corner", "Deployment開始配置枠コーナー。"),
    selectedMarker: imageAsset("selected-unit-marker", "Deployment選択済みマーカー。"),
    reserveStrip: imageAsset("reserve-roster-strip", "Deployment予備旅団ラベル。"),
    routeArrow: imageAsset("deployment-route-arrow", "Deployment投入ルート矢印。"),
  },
  theater: {
    mainBattleFlag: imageAsset("main-battle-flag-icon", "Theater主戦場旗。"),
    sideOperationTag: imageAsset("side-operation-tag-icon", "Theater小任務タグ。"),
    fiveBandFront: imageAsset("five-band-front-icon", "Theater五層戦線アイコン。"),
    enemyPressure: imageAsset("enemy-pressure-marker-icon", "Theater敵圧マーカー。"),
    threatIntel: imageAsset("threat-intel-icon", "Theater脅威情報マーカー。"),
  },
  engineering: {
    structures: {
      trench: imageAsset("trench-token", "Engineering塹壕アイコン。"),
      barricade: imageAsset("barricade-token", "Engineeringバリケードアイコン。"),
      supplyDepot: imageAsset("supply-depot-icon", "Engineering補給所アイコン。"),
      observationPost: imageAsset("facility-observation-icon", "Engineering観測所アイコン。"),
      fieldHospital: imageAsset("facility-hospital-icon", "Engineering野戦病院アイコン。"),
    } satisfies Record<FortificationType, GeneratedImageAsset>,
    hospital: imageAsset("facility-hospital-icon", "Engineering/AfterAction野戦病院・医療回収アイコン。"),
    observationPost: imageAsset("facility-observation-icon", "Engineering将来施設: 観測所。"),
    repairSupplies: imageAsset("repair-supplies-icon", "Engineering修理資材アイコン。"),
    status: {
      built: imageAsset("range-marker-icon", "Engineering施設稼働中アイコン。"),
      planned: imageAsset("deployment-zone-corner", "Engineering計画中アイコン。"),
      damaged: imageAsset("status-damaged-icon", "Engineering損傷アイコン。"),
      overrun: imageAsset("status-overrun-icon", "Engineering制圧済みアイコン。"),
      abandoned: imageAsset("enemy-pressure-marker-icon", "Engineering放棄アイコン。"),
    } satisfies Record<FortificationStatus, GeneratedImageAsset>,
  },
  doctrine: {
    command: imageAsset("doctrine-command-icon", "Doctrine軍団指揮アイコン。"),
    organization: imageAsset("doctrine-organization-icon", "Doctrine軍制拡張アイコン。"),
    training: imageAsset("doctrine-training-icon", "Doctrine訓練アイコン。"),
    logistics: imageAsset("doctrine-logistics-icon", "Doctrine兵站アイコン。"),
    engineering: imageAsset("doctrine-engineering-icon", "Doctrine野戦工兵アイコン。"),
    medicine: imageAsset("doctrine-medicine-icon", "Doctrine野戦医療アイコン。"),
    intelligence: imageAsset("threat-intel-icon", "Doctrine敵情分析アイコン。"),
  } satisfies Record<DoctrineIconId, GeneratedImageAsset>,
  uiFrames: {
    brigadeCardFrame: imageAsset("brigade-card-frame-icon", "UI旅団カード紙枠。"),
    reserveStrip: imageAsset("reserve-roster-strip", "UI予備名札。"),
    deploymentZoneCorner: imageAsset("deployment-zone-corner", "UI配置枠コーナー。"),
  },
};

export const battleAssetUrls = {
  unitTokens: Object.fromEntries(
    Object.entries(assetRegistry.battle.unitTokens).map(([key, asset]) => [key, asset.src128]),
  ) as Record<UnitType, string>,
  enemyTokens: Object.fromEntries(
    Object.entries(assetRegistry.battle.enemyTokens).map(([key, asset]) => [key, asset.src128]),
  ) as Record<EnemyBattleUnit["type"], string>,
  structures: Object.fromEntries(
    Object.entries(assetRegistry.battle.structures).map(([key, asset]) => [key, asset.src128]),
  ) as Record<FortificationType, string>,
  objectives: {
    victory: assetRegistry.battle.objectives.victory.src128,
    supply: assetRegistry.battle.objectives.supply.src128,
    visibility: assetRegistry.battle.objectives.visibility.src128,
  },
  status: Object.fromEntries(
    Object.entries(assetRegistry.battle.status).map(([key, asset]) => [key, asset.src64]),
  ) as Record<FortificationStatus, string>,
  markers: {
    target: assetRegistry.battle.markers.target.src64,
    range: assetRegistry.battle.markers.range.src64,
    repair: assetRegistry.battle.markers.repair.src64,
  },
};

const flattenAssets = (value: unknown): GeneratedImageAsset[] => {
  if (!value || typeof value !== "object") {
    return [];
  }
  if ("id" in value && "src128" in value) {
    return [value as GeneratedImageAsset];
  }
  return Object.values(value as Record<string, unknown>).flatMap(flattenAssets);
};

export const assetManifest: AssetManifestEntry[] = Array.from(
  new Map(
    flattenAssets(assetRegistry).map((asset) => [
      asset.id,
      {
        id: asset.id,
        path: `src/assets/generated/${asset.id}-128.png`,
        status: asset.status,
        usage: asset.usage,
      },
    ]),
  ).values(),
);
