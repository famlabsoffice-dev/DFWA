# DFWA Visual Usage Guide (EXPLICIT IMPLEMENTATION)

Diese Datei definiert die explizite technische Nutzung aller visuellen Assets im DFWA-Projekt (ACK ATTACK). Alle Implementierungen in `style.css` und `app.js` folgen diesen Vorgaben.

## 1. System-Hintergründe (Realms)
Diese Assets definieren die Atmosphäre der verschiedenen Quiz-Kategorien und Menüs.

| Asset-Pfad (WebP) | Zweck / Kategorie | Technische Umsetzung |
| :--- | :--- | :--- |
| `ack_category_realm.webp` | **Hardware / Standard** | `.realm-hardware`, `.realm-default` (CSS) |
| `ack_core_brain.webp` | **Artificial Intelligence** | `.realm-ai` (CSS) |
| `ack_override_alien.webp` | **Security / History** | `.realm-security` (CSS) |
| `ack_hall_of_infamy.webp` | **Server Room** | `.server-room-bg` (CSS) |
| `ack_splash_void.webp` | **Splash Screen** | `index.html` Preload / Background |

## 2. Situative Emotes (Feedback)
Diese Assets werden im `feedback-screen` angezeigt, um dem Spieler emotionales Feedback zu geben. Gesteuert über `app.js` -> `checkAnswer()`.

| Asset-Pfad (WebP) | Status / Bedingung | Trigger (Logic) |
| :--- | :--- | :--- |
| `ack_eye_wink.webp` | **EXCELLENT** | `state.streak >= 10` |
| `ack_player_win_angry.webp` | **DOMINATING** | `state.streak >= 5` |
| `ack_reaction_set.webp` | **STABLE** | Korrekte Antwort (Standard) |
| `ack_eye_skeptical.webp` | **CRITICAL** | `state.lives === 1` |
| `ack_interference_glitch.webp` | **ERROR** | Falsche Antwort |
| `ack_core_brain.webp` | **TIMEOUT** | Zeit abgelaufen (`timer <= 0`) |

## 3. Spezial-Effekte & UI
Zusätzliche visuelle Elemente für Immersion und Feedback.

| Asset-Pfad (WebP) | Funktion | Verwendung |
| :--- | :--- | :--- |
| `ack_interference_glitch.webp` | **Sabotage Overlay** | `#sabotage-overlay` (CSS/JS) |
| `ack_system_shutdown.webp` | **Game Over** | Hintergrund für End-Modal |
| `ack_streak_evolution.webp` | **Streak HUD** | Dynamisches Asset für Erfolge |

## Design-Richtlinien
- **Palette:** 85% Schwarz, 14% Neon-Grün (#39FF14), 1% Warn-Rot (#FF3131).
- **Stil:** AAA Cyberpunk Dystopie, A.C.K. Identität, hochimmersiv.
- **Format:** Alle Assets werden im Spiel als `.webp` für maximale Performance geladen.

