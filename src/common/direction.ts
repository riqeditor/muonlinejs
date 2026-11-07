// thegame: direção do MU (0..7), a mesma usada no andar (WalkRequest), na rotação
// e no HitRequest: 0=W, 1=SW, 2=S, 3=SE, 4=E, 5=NE, 6=N, 7=NW, onde
// os deslocamentos são os do OpenMU (DirectionExtensions.cs): W=(-1,-1), SW=(0,-1),
// S=(+1,-1), SE=(+1,0), E=(+1,+1), NE=(0,+1), N=(-1,+1), NW=(-1,0).

const DIRECTION_BY_SIGN: Record<string, number> = {
  '-1,-1': 0,
  '0,-1': 1,
  '1,-1': 2,
  '1,0': 3,
  '1,1': 4,
  '0,1': 5,
  '-1,1': 6,
  '-1,0': 7,
};

/** Direção (0..7) de (fromX, fromY) olhando para (toX, toY). */
export function directionTo(fromX: number, fromY: number, toX: number, toY: number): number {
  const dx = Math.round(toX) - Math.round(fromX);
  const dy = Math.round(toY) - Math.round(fromY);
  if (dx === 0 && dy === 0) return 2;
  // Arredonda o ângulo para o setor de 45° mais próximo.
  const angle = Math.atan2(dy, dx);
  const sx = Math.round(Math.cos(angle));
  const sy = Math.round(Math.sin(angle));
  return DIRECTION_BY_SIGN[`${sx},${sy}`] ?? 2;
}

/** Ângulo (rot.y) do modelo para uma direção do MU. Igual ao usado em logic.ts. */
export function directionToAngle(direction: number): number {
  return (direction * Math.PI) / 4 - Math.PI / 4;
}

/** Distância em quadrados (o MU usa a maior das diferenças em X e Y). */
export function tileDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(Math.round(ax) - Math.round(bx)), Math.abs(Math.round(ay) - Math.round(by)));
}
