/**
 * Global debug configuration for Blade Voyage.
 * Controls visual debug overlays such as bounding boxes and range indicators.
 */
export interface DebugConfig {
  /** Master toggle for all debug overlays */
  enabled: boolean;
  /** Start at the level picker instead of the title scene */
  startAtLevelPicker: boolean;
  /** Skip the title and level picker and start the 0.json map directly */
  startDirectlyAtMap0: boolean;
  /** Show virtual touch controls on non-touch devices when debug mode is enabled */
  showTouchControlsOnDesktop: boolean;
  /** Player health is infinite (cannot die) */
  playerInfiniteHealth: boolean;
  /** Use 50% spawn chances for Health, Frenzy, and Shield Potions */
  boostPotionSpawnRates: boolean;
  /** Show body hitbox rect for player (yellow) and enemies (cyan) */
  showEntityBodyRects: boolean;
  /** Show player melee attack range rect (orange) */
  showPlayerAttackRange: boolean;
  /** Show sword spawn range (lime green) and blocked drop areas (red) */
  showSwordSpawnRange: boolean;
  /** Show potion spawn boundary box (cyan) around player */
  showPotionSpawnRange: boolean;
  /** Show enemy vision detection range (red outer box) */
  showEnemyDetectionRange: boolean;
  /** Show the normal-zoom cannon activation viewport (orange) */
  showCannonDetectionRange: boolean;
  /** Show enemy melee attack range (red inner box) */
  showEnemyAttackRange: boolean;
  /** Show camera scroll clamp boundary box (magenta) around player */
  showCameraBounds: boolean;
}

export const DEBUG_CONFIG: DebugConfig = {
  enabled: true,
  playerInfiniteHealth: false,
  startAtLevelPicker: true,
  startDirectlyAtMap0: false,
  boostPotionSpawnRates: true,
  showPotionSpawnRange: false,
  showTouchControlsOnDesktop: false,
  showEntityBodyRects: false,
  showPlayerAttackRange: false,
  showSwordSpawnRange: false,
  showEnemyDetectionRange: false,
  showCannonDetectionRange: false,
  showEnemyAttackRange: false,
  showCameraBounds: false,
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
