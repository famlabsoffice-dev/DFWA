# CI/CD Dokumentation - DFWA

## Übersicht
Das DFWA-Projekt nutzt GitHub Actions für Continuous Integration (CI) und Qualitätssicherung (QA). Die Workflows stellen sicher, dass Code-Änderungen automatisch getestet, gelintet und für das Deployment vorbereitet werden.

## Workflows

### 1. CI Workflow (`ci.yml`)
- **Trigger:** Jeder `push` und `pull_request`.
- **Zweck:** Grundlegende Build-Prüfung und Unit-Tests.
- **Schritte:**
  - Setup Node.js (v20) & pnpm (v9).
  - Abhängigkeiten installieren (`pnpm install`).
  - Unit-Tests ausführen (`pnpm test`).

### 2. QA Workflow (`qa.yml`)
- **Trigger:** `push` oder `pull_request` auf den `main` Branch.
- **Zweck:** Erweiterte Qualitätssicherung.
- **Schritte:**
  - Validierungsskripte und Tests ausführen.

### 3. Deploy Workflow (`deploy-pages.yml`)
- **Trigger:** `push` auf `main`.
- **Zweck:** Build-Prozess für das Frontend.
- **Schritte:**
  - Vite Build (`npm run build`).

## Lokale Ausführung
Um die CI-Schritte lokal zu reproduzieren:

```bash
# Abhängigkeiten installieren
pnpm install

# Tests ausführen
pnpm test

# Linting prüfen
pnpm run lint

# Build erstellen
pnpm run build
```

## Status-Badges
- **CI:** `![CI](https://github.com/famlabsoffice-dev/DFWA/actions/workflows/ci.yml/badge.svg)`
- **QA:** `![QA](https://github.com/famlabsoffice-dev/DFWA/actions/workflows/qa.yml/badge.svg)`
