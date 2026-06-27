# DFWA - Don't fAck with Ack
Das ultimative Dystopie-Quiz als PWA.

## CI/CD & Automatisierung

Dieses Projekt nutzt GitHub Actions für die Qualitätssicherung und eine dynamische Kuratierung des Fragen-Pools.

### CI/CD-Pipeline
Die Datei `.github/workflows/qa.yml` validiert automatisch bei jedem Push auf den `main`-Branch und bei Pull Requests:
- Syntaxprüfung der JSON-Dateien gegen das Schema.
- Prüfung auf Platzhalter (TBD, Folgt, Platzhalter).

### Dynamische Kuratierung
Der Fragen-Pool kann mithilfe von LLMs erweitert werden:

1. **Fragen generieren**:
   ```bash
   # Generiert 5 Fragen in der Kategorie 'Technik' (Standard: Allgemeinwissen, 5 Fragen)
   node scripts/generate_questions.js "Technik" 5
   ```
   Die Fragen werden in `staging_questions.json` zwischengespeichert.

2. **Fragen verifizieren & übernehmen**:
   Überprüfen Sie die `staging_questions.json` manuell auf Korrektheit. Führen Sie anschließend das Merge-Skript aus:
   ```bash
   node scripts/verify_staging.js
   ```
   Dies fügt die Fragen zu `questions_i18n.json` hinzu und leert den Staging-Bereich.

## Vorhandene Skripte
- `scripts/validate.js`: Validiert die Fragen-JSON gegen das Schema.
- `scripts/deduplicate.js`: Entfernt doppelte Fragen aus dem Pool.
- `scripts/generate_questions.js`: KI-gestützte Generierung neuer Fragen.
- `scripts/verify_staging.js`: Übernahme verifizierter Fragen in den Hauptpool.
