// thegame: XP total necessária para chegar ao nível `level`, igual à fórmula padrão do
// OpenMU (GameConfiguration.ExperienceFormula, Season 6):
//   if(level == 0, 0,
//     if(level < 256, 10 * (level + 8) * (level - 1)^2,
//        10 * (level + 8) * (level - 1)^2 + 1000 * (level - 247) * (level - 256)^2))
// Se a fórmula for mudada no painel admin, mude aqui também.
export function experienceForLevel(level: number): number {
  if (level <= 0) return 0;
  const base = 10 * (level + 8) * (level - 1) * (level - 1);
  if (level < 256) return base;
  return base + 1000 * (level - 247) * (level - 256) * (level - 256);
}
