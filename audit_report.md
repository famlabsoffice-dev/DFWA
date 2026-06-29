# DFWA PWA - Audit & Mängelliste (2026-06-29)

Dieser Bericht fasst die Ergebnisse der vollständigen Funktionsprüfung der DFWA PWA zusammen.

## 1. Kritische Mängel (Sofortiger Handlungsbedarf)

| ID | Bereich | Mangel | Auswirkung | Status |
|---|---|---|---|---|
| **C1** | Build / Runtime | Inline-Event-Handler (`onclick`) in `index.html` funktionieren nicht mit ES-Modulen. | Spiel lässt sich nicht starten/bedienen. | **Gefixt** (auf JS-Listener umgestellt) |
| **C2** | API / Backend | `SYSTEM_SECRET` fehlte im Server-Environment ohne Fallback. | Alle Score-Uploads und Challenge-Verifizierungen schlugen mit 500 fehl. | **Gefixt** (Fallback eingeführt) |
| **C3** | Architektur | `app.js` griff auf nicht importierte Module (`APIClient`, `UIManager`) zu. | Leaderboard blieb leer, Fehlermeldungen wurden nicht angezeigt. | **Gefixt** (Imports hinzugefügt) |
| **C4** | Gameplay | `updateLeaderboard()` wurde am Spielende nicht aufgerufen. | Erreichte Scores wurden nie an den Server gesendet. | **Gefixt** (Aufruf in `endGame` ergänzt) |

## 2. Funktionale Mängel & Inkonsistenzen

| ID | Bereich | Mangel | Empfehlung |
|---|---|---|---|
| **F1** | PWA / Offline | `sw.js` precached keine gehashten Vite-Assets (JS/CSS). | Offline-Start nach erstem Build unzuverlässig, bis Assets im Runtime-Cache landen. | Vite-PWA-Plugin nutzen oder Asset-Liste dynamisch generieren. |
| **F2** | Backend | `express-rate-limit` Warnung: `trust proxy` ist false. | Rate-Limiting erkennt Benutzer hinter Proxies (wie Manus/Cloudflare) nicht korrekt. | `app.set('trust proxy', 1)` in `server.js` setzen. |
| **F3** | UI / UX | Fehlende Media Queries in `style.css`. | Layout nutzt zwar `clamp()` und `vw`, kann aber auf extrem schmalen/hohen Geräten (Foldables) brechen. | Mobile-spezifische Breakpoints für HUD-Elemente hinzufügen. |
| **F4** | Sicherheit | `SYSTEM_SECRET` Fallback auf `LOCAL_ONLY_UNTRUSTED`. | In Produktion unsicher, wenn Env-Variable vergessen wird. | Server-Start verweigern, wenn `NODE_ENV=production` und Secret fehlt. |

## 3. PWA & Lighthouse Performance

*   **LCP (Largest Contentful Paint):** `ack_core_clean.png` ist mit **1.5 MB** viel zu groß für eine mobile PWA.
    *   *Lösung:* Konvertierung zu WebP/AVIF und Reduktion der Auflösung.
*   **Asset-Caching:** Der Service Worker v1.1.0 ist funktional, aber die manuelle Asset-Liste ist fehleranfällig.
*   **Installability:** Manifest ist korrekt hinterlegt, Icons sind maskable. Die `download.html` ist jedoch redundant zum In-App-Prompt.

## 4. Nächste Schritte (Empfehlung)

1.  **Performance:** WebP-Konvertierung des Hauptbildes (QS 1.8).
2.  **Robustheit:** `trust proxy` Fix für den Server.
3.  **PWA:** Automatisierung der Service Worker Asset-Liste via Vite.
