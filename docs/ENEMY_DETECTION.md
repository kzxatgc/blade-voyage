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
| `ENEMY_BEHIND_TOUCH_DIST` | `pink_star` | `32` | $32\text{px}$ ($1$ tile) | Tuned rear awareness. |
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

| Attack | Damage | Notes |
|---|---|---|---|
| Ground melee | **20** | Standard sword swing while grounded |
| Air melee | **30** | Jumping sword strike |
| Thrown sword | **35** | Spinning sword projectile; deflected by attacking Pink Star |

### Special Rules
- **Pink Star** is **immune** to player melee and thrown sword while `attackTimer > 0` (actively charging).
- **Any enemy** hit mid-attack has its `attackEffect` particle and `attackTimer` cleared immediately (interrupted).
- **Attack-only Damage (No Contact Damage)**: Enemies only damage and knock back the player when an active attack lands (Pink Star rolling charge, Crabby claw sweep, Fierce Tooth jaw snap). Touching an enemy while it is idle, walking, chasing, or recovering deals no damage.

---

## 4. Engagement & Approach Behavior

When an enemy detects the player within sight range (`ENEMY_SIGHT_RANGE_X`):

1. **Pink Star (`pink_star`)**:
   - Because its attack is a rolling charge covering up to $240\text{px}$, it immediately enters `anticipationState` (plays anticipation animation, shows `!` dialogue, triggers exclamation SFX), then launches into its $120\text{-frame}$ charge.

2. **Crabby (`crabby`) & Fierce Tooth (`fierce_tooth`)**:
   - Because both possess short-range melee attacks ($\sim 25\text{px}$ dual-claw sweep for Crabby, $31\text{px}$ jaw snap for Fierce Tooth), they **advance toward the player** upon detecting them outside melee reach:
     - Enters `chaseState = true`, faces the player, and moves forward at a steady advance speed ($0.8\text{px/frame}$) using their `run` animation and dust particles.
     - **Ledge & Wall Safety**: Ledge checks (`solidCheck`) and wall collision checks prevent the advancing enemy from walking off cliffs or walking into walls.
     - **Strike Trigger**: As soon as the enemy enters actual melee attack range, it stops moving and enters `anticipationState` (wind-up animation, `!` dialogue, and exclamation SFX). Once the wind-up finishes, the melee attack executes directly against the player.
     - **Flank / Rear Touch**: If touched from behind within rear awareness range ($48\text{px}$), the enemy turns around immediately. If already in melee reach, it immediately begins anticipation without delay.
