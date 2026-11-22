export function shouldShowAttackCooldownIndicator(
  hasSword: boolean,
  isDead: boolean,
  isFrenzyActive: boolean
): boolean {
  return hasSword && !isDead && !isFrenzyActive;
}
