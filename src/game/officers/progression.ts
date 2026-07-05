import type { Officer } from "./types";
import type { ArmyUnit } from "../army/types";

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const rankOrder: Officer["rank"][] = ["Captain", "Major", "Colonel", "General"];
const rankDisplay: Record<Officer["rank"], string> = {
  Captain: "大尉",
  Major: "少佐",
  Colonel: "大佐",
  General: "将軍",
};

export interface OfficerCommandResult {
  officers: Officer[];
  units: ArmyUnit[];
  message: string;
}

export const applyOfficerBattleExperience = (officer: Officer, xp: number): Officer => {
  if (officer.status !== "active") {
    return officer;
  }
  return {
    ...officer,
    experience: officer.experience + xp,
      history: [`指揮経験 +${xp}`, ...officer.history].slice(0, 8),
  };
};

export const woundOfficer = (officer: Officer, turns = 2): Officer => ({
  ...officer,
  status: "wounded",
  recoveryTurns: turns,
  assignedOperationId: undefined,
  history: [`負傷、復帰まで${turns}ターン`, ...officer.history].slice(0, 8),
});

export const recoverOfficers = (officers: Officer[]): Officer[] =>
  officers.map((officer) => {
    const recoveryAmount = officer.status === "resting" ? 22 : officer.status === "wounded" ? 4 : 8;
    const commandFatigue = clamp((officer.commandFatigue ?? 0) - recoveryAmount, 0, 100);
    if (officer.status === "resting") {
      return {
        ...officer,
        commandFatigue,
        status: commandFatigue === 0 ? "active" : "resting",
        history:
          commandFatigue === 0
            ? ["休養完了、任務に復帰", ...officer.history].slice(0, 8)
            : officer.history,
      };
    }
    if (officer.status !== "wounded") {
      return {
        ...officer,
        commandFatigue,
      };
    }
    const recoveryTurns = Math.max(0, officer.recoveryTurns - 1);
    return {
      ...officer,
      recoveryTurns,
      commandFatigue,
      status: recoveryTurns === 0 ? "active" : "wounded",
      history:
        recoveryTurns === 0
          ? ["任務に復帰", ...officer.history].slice(0, 8)
          : officer.history,
    };
  });

export const restOfficer = (officers: Officer[], officerId: string): { officers: Officer[]; message: string } => {
  const officer = officers.find((candidate) => candidate.id === officerId);
  if (!officer) {
    return { officers, message: "将校が見つからない。" };
  }
  if (officer.status === "dead") {
    return { officers, message: `${officer.name}は戦死している。` };
  }
  if (officer.status === "wounded") {
    return { officers, message: `${officer.name}は負傷療養中。` };
  }
  if (officer.status === "resting") {
    return { officers, message: `${officer.name}はすでに休養中。` };
  }
  return {
    officers: officers.map((candidate) =>
      candidate.id === officerId
        ? {
            ...candidate,
            status: "resting",
            assignedOperationId: undefined,
            history: ["指揮疲労回復のため休養入り", ...candidate.history].slice(0, 8),
          }
        : candidate,
    ),
    message: `${officer.name}を休養に入れた。次ターン以降、指揮疲労の回復が速まる。`,
  };
};

export const returnOfficerToDuty = (officers: Officer[], officerId: string): { officers: Officer[]; message: string } => {
  const officer = officers.find((candidate) => candidate.id === officerId);
  if (!officer) {
    return { officers, message: "将校が見つからない。" };
  }
  if (officer.status !== "resting") {
    return { officers, message: `${officer.name}は休養中ではない。` };
  }
  return {
    officers: officers.map((candidate) =>
      candidate.id === officerId
        ? {
            ...candidate,
            status: "active",
            history: ["休養を切り上げ任務復帰", ...candidate.history].slice(0, 8),
          }
        : candidate,
    ),
    message: `${officer.name}を任務へ復帰させた。`,
  };
};

export const nextOfficerRank = (rank: Officer["rank"]): Officer["rank"] | undefined => {
  const index = rankOrder.indexOf(rank);
  return index >= 0 && index < rankOrder.length - 1 ? rankOrder[index + 1] : undefined;
};

export const officerPromotionCost = (officer: Officer): number => {
  const nextRank = nextOfficerRank(officer.rank);
  if (!nextRank) {
    return Number.POSITIVE_INFINITY;
  }
  const thresholdByRank: Record<Officer["rank"], number> = {
    Captain: 18,
    Major: 34,
    Colonel: 46,
    General: Number.POSITIVE_INFINITY,
  };
  return thresholdByRank[officer.rank];
};

export const promoteOfficer = (officers: Officer[], officerId: string): { officers: Officer[]; message: string } => {
  const officer = officers.find((candidate) => candidate.id === officerId);
  if (!officer) {
    return { officers, message: "将校が見つからない。" };
  }
  const nextRank = nextOfficerRank(officer.rank);
  if (!nextRank) {
    return { officers, message: `${officer.name}はこれ以上昇進できない。` };
  }
  if (officer.status !== "active") {
    return { officers, message: `${officer.name}は任務復帰まで昇進できない。` };
  }
  const cost = officerPromotionCost(officer);
  if (officer.experience < cost) {
    return { officers, message: `${officer.name}の昇進には経験${cost}が必要。` };
  }
  return {
    officers: officers.map((candidate) =>
      candidate.id === officerId
        ? {
            ...candidate,
            rank: nextRank,
            experience: candidate.experience - cost,
            history: [`${rankDisplay[nextRank]}へ昇進`, ...candidate.history].slice(0, 8),
          }
        : candidate,
    ),
    message: `${officer.name}を${rankDisplay[nextRank]}へ昇進させた。`,
  };
};

export const assignOfficerToUnit = (
  officers: Officer[],
  units: ArmyUnit[],
  officerId: string,
  unitId: string,
): OfficerCommandResult => {
  const officer = officers.find((candidate) => candidate.id === officerId);
  const unit = units.find((candidate) => candidate.id === unitId);
  if (!officer || !unit) {
    return { officers, units, message: "配属先が見つからない。" };
  }
  if (officer.status !== "active") {
    return { officers, units, message: `${officer.name}は任務復帰まで配属変更できない。` };
  }
  const previousOfficerId = unit.officerId;
  const previousUnitId = officer.assignedUnitId;
  const nextOfficers = officers.map((candidate) => {
    if (candidate.id === officerId) {
      return {
        ...candidate,
        assignedUnitId: unitId,
        history: [`${unit.name}へ配属変更`, ...candidate.history].slice(0, 8),
      };
    }
    if (candidate.id === previousOfficerId) {
      return {
        ...candidate,
        assignedUnitId: previousUnitId,
        history: [`${previousUnitId ? "交換配属" : "司令部待機"}: ${officer.name}と交代`, ...candidate.history].slice(0, 8),
      };
    }
    return candidate;
  });
  const nextUnits = units.map((candidate) => {
    if (candidate.id === unitId) {
      return {
        ...candidate,
        officerId,
        battleHistory: [`${officer.name}が指揮官に着任`, ...candidate.battleHistory].slice(0, 8),
      };
    }
    if (previousUnitId && candidate.id === previousUnitId) {
      return {
        ...candidate,
        officerId: previousOfficerId,
        battleHistory: [`${officers.find((item) => item.id === previousOfficerId)?.name ?? "前任将校"}が交換着任`, ...candidate.battleHistory].slice(0, 8),
      };
    }
    return candidate;
  });
  return {
    officers: nextOfficers,
    units: nextUnits,
    message: `${officer.name}を${unit.name}へ配属変更した。`,
  };
};
