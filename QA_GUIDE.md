# DFWA Qualitätssicherungs-Leitfaden

Um die Stabilität des Projekts zu gewährleisten und unnötigen Ressourcenverbrauch zu vermeiden, müssen folgende Strategien strikt befolgt werden.

## 1. Effektive Nutzung von `manus.read`

Die Datei `manus.read` ist nicht nur ein Protokoll, sondern das **zentrale Steuerungselement** für jede KI-Instanz.

*   **Zustands-Check vor Beginn**: Jede Instanz MUSS die letzten Einträge in `manus.read` lesen, um zu verstehen, was die vorherige Instanz getan hat. Dies verhindert redundante Arbeit.
*   **Explizite Meilensteine**: Definieren Sie in `manus.read` klare "Stable Points". Wenn ein Feature (wie der Startbildschirm) perfekt funktioniert, markieren Sie diesen Stand explizit (z.B. "STABLE_POINT: Startbildschirm-Interaktion verifiziert").
*   **Fehler-Protokollierung**: Wenn etwas schiefgeht, dokumentieren Sie nicht nur das Ergebnis, sondern auch die versuchten Fixes. Dies verhindert, dass nachfolgende Instanzen dieselben erfolglosen Reparaturen wiederholen.

## 2. Strategie zur Vermeidung instabiler Versionen

### A. Das "Atomic Change" Prinzip
*   Führen Sie nur **einen kleinen, logischen Teilschritt** pro Instanz aus.
*   Vermeiden Sie massive Refactorings ganzer Dateien, wenn nur ein Button-Binding korrigiert werden muss.

### B. Obligatorische Validierungskette
Bevor Code als "erledigt" gilt, muss er folgende Kette durchlaufen:
1.  **Build-Check**: `pnpm build` (Muss fehlerfrei durchlaufen).
2.  **Automatisierte Tests**: `pnpm test` (Alle relevanten Tests müssen grün sein).
3.  **Manueller/Visueller Check**: Falls möglich, eine kurze visuelle Verifizierung der geänderten UI-Komponenten.

### C. Automatisierte Sicherung (Git)
*   **Commit nach jedem Erfolg**: Sobald ein Teilschritt validiert ist, muss er committet werden.
*   **Sinnvolle Commit-Messages**: Verwenden Sie Präfixe wie `feat:`, `fix:`, `stable:`, um die Historie durchsuchbar zu machen. Im Notfall kann so mit `git checkout <hash>` sofort zum letzten stabilen Stand zurückgekehrt werden.

## 3. Ressourcen-Management (Credit-Schonung)
*   **Keine "Blind-Reparaturen"**: Wenn ein Fehler nach zwei Versuchen nicht behoben ist, stoppen Sie. Analysieren Sie die Ursache tiefgreifend oder kehren Sie zum letzten stabilen Stand zurück, anstatt Credits für endlose Versuche zu verschwenden.
*   **Minimaler Output**: Fordern Sie von der KI nur das absolut notwendige Ergebnis an (siehe `Instruktion` Knowledge Punkt).

---
**Merke:** Ein funktionierender Rollback zu einer stabilen Version ist immer günstiger als eine teure, instabile Reparatur.
