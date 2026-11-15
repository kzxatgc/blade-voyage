/**
 * Global debug configuration for Blade Voyage.
 * Controls visual debug overlays such as bounding boxes and range indicators.
 */
export interface DebugConfig {
  /** Master toggle for all debug overlays */
  enabled: boolean;
  /** Player health is infinite (cannot die) */
  playerInfiniteHealth: boolean;
  /** Show body hitbox rect for player (yellow) and enemies (cyan) */
  showEntityBodyRects: boolean;
  /** Show player melee attack range rect (orange) */
  showPlayerAttackRange: boolean;
  /** Show sword spawn boundary box (lime green) around player */
  showSwordSpawnRange: boolean;
  /** Show enemy vision detection range (red outer box) */
  showEnemyDetectionRange: boolean;
  /** Show enemy melee attack range (red inner box) */
  showEnemyAttackRange: boolean;
}

export const DEBUG_CONFIG: DebugConfig = {
  enabled: true,
  playerInfiniteHealth: true,
  showEntityBodyRects: false,
  showPlayerAttackRange: false,
  showSwordSpawnRange: false,
  showEnemyDetectionRange: false,
  showEnemyAttackRange: false,
};

export function isDebugEnabled(): boolean {
  return DEBUG_CONFIG.enabled;
}

export function setDebugMode(enabled: boolean): void {
  DEBUG_CONFIG.enabled = enabled;
}

export function toggleDebugMode(): boolean {
  DEBUG_CONFIG.enabled = !DEBUG_CONFIG.enabled;
  return DEBUG_CONFIG.enabled;
}

