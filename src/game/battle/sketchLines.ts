import type { BattlePosition } from "./types";

export const maxFrontlineSketchPoints = 8;

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

export const compactSketchPoints = (
  points: BattlePosition[],
  maxPoints = maxFrontlineSketchPoints,
): BattlePosition[] => {
  if (points.length <= maxPoints) {
    return points.map((point) => ({ ...point }));
  }
  const distances = points.map((point, index) =>
    index === 0 ? 0 : Math.hypot(point.x - points[index - 1].x, point.y - points[index - 1].y),
  );
  const cumulative = distances.reduce<number[]>((acc, distance, index) => {
    acc[index] = (acc[index - 1] ?? 0) + distance;
    return acc;
  }, []);
  const total = cumulative[cumulative.length - 1] ?? 0;
  if (total <= 0) {
    return [points[0], points[points.length - 1]].filter(Boolean).map((point) => ({ ...point }));
  }
  const selected = [points[0]];
  for (let step = 1; step < maxPoints - 1; step += 1) {
    const targetDistance = (total * step) / (maxPoints - 1);
    const nearestIndex = cumulative.findIndex((distance) => distance >= targetDistance);
    const candidate = points[Math.max(1, nearestIndex)];
    if (candidate && selected[selected.length - 1] !== candidate) {
      selected.push(candidate);
    }
  }
  selected.push(points[points.length - 1]);
  return selected
    .filter((point, index, all) => index === 0 || point.x !== all[index - 1].x || point.y !== all[index - 1].y)
    .map((point) => ({ ...point }));
};

export const svgPolylinePoints = (points: BattlePosition[]): string =>
  points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");

export const svgSmoothSketchPath = (points: BattlePosition[]): string => {
  if (points.length === 0) {
    return "";
  }
  if (points.length === 1) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }
  const commands = [`M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[Math.min(points.length - 1, index + 2)];
    const cp1 = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6,
    };
    const cp2 = {
      x: next.x - (afterNext.x - current.x) / 6,
      y: next.y - (afterNext.y - current.y) / 6,
    };
    commands.push(
      `C ${clamp(cp1.x, 0, 140).toFixed(1)} ${clamp(cp1.y, 0, 100).toFixed(1)}, ${clamp(cp2.x, 0, 140).toFixed(1)} ${clamp(cp2.y, 0, 100).toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`,
    );
  }
  return commands.join(" ");
};
