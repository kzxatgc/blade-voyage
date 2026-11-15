# Enemy Player Detection & Combat AI System

## Overview
Details the vision, detection, and attack range systems for enemies (`Pink Star`, `Crabby`, `Fierce Tooth`) in *Blade Voyage*, implemented in `src/client/entities/Enemy.ts`.

---

## 1. Core Detection & Combat Parameters

All metrics are scaled to the $32\text{px}$ tile grid:

| Parameter | Enemy Type | Value | Distance | Purpose |
|---|---|---|---|---|
| `ENEMY_SIGHT_RANGE_X` | `pink_star` | `4.5 * 32` | $144\text{px}$ ($4.5$ tiles) | Long-range vision matching its full-speed charging roll. |
| | `crabby` | `2.5 * 32` | $80\text{px}$ ($2.5$ tiles) | Close melee engagement range. |
| | `fierce_tooth` | `2.5 * 32` | $80\text{px}$ ($2.5$ tiles) | Close melee engagement range. |
| `ENEMY_BEHIND_TOUCH_DIST` | `pink_star` | `36` | $36\text{px}$ ($1.125$ tiles) | Tuned rear awareness. |
| | `crabby` | `48` | $48\text{px}$ ($1.5$ tiles) | Symmetrical rear peripheral awareness across both directions. |
| | `fierce_tooth` | `48` | $48\text{px}$ ($1.5$ tiles) | Symmetrical rear peripheral awareness across both directions. |
| `ENEMY_SIGHT_RANGE_Y` | All | `24` | $24\text{px}$ ($0.75$ tile) | Vertical tolerance for jumps/slopes without cross-tier aggro. |
| `ENEMY_POST_ATTACK_COOLDOWN`| All | `90` | $90\text{ frames}$ ($1.5\text{s}$) | Post-attack recovery window to punish or escape. |

---

## 2. Attack Hitbox Parameters

| Enemy | Attack Style | Reach | Hitbox Dimensions | Active Window |
|---|---|---|---|---|
| **Pink Star** | Rolling Charge | Full-body contact | $26 \times 23\text{px}$ (body) | Frames $1\text{--}120$ ($2.0\text{s}$), bounces on walls |
| **Crabby** | Dual-Claw Sweep | $25\text{px}$ front & $25\text{px}$ back | $82 \times 26\text{px}$ (symmetrical) | Attack timer $\ge 12$ of $24$ frames |
| **Fierce Tooth** | Directional Jaw Snap | $31\text{px}$ forward | $55 \times 24\text{px}$ (forward only) | Attack timer $\ge 15$ of $30$ frames |

---

## 3. Player Attack Damage

Defined in `Player.ts` (`getAttackDamage`) and `Swords.ts`. Enemy HP = 100.

| Attack | Damage | Hits to Kill | Notes |
|---|---|---|---|
| Ground melee | **20** | 5 | Standard sword swing while grounded |
| Air melee | **30** | 4 | Jumping sword strike |
| Thrown sword | **35** | 3 | Spinning sword projectile; deflected by attacking Pink Star |

### Special Rules
- **Pink Star** is **immune** to player melee and thrown sword while `attackTimer > 0` (actively charging).
- **Any enemy** hit mid-attack has its `attackEffect` particle and `attackTimer` cleared immediately (interrupted).
- Enemy knockback power on player hit: `2.3` (attack) — contact damage applies damage only, no knockback.