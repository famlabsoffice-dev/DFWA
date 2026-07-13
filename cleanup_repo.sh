#!/usr/bin/env bash
# DFWA Repo Cleanup — 10.07.2026
# Im lokalen Klon von famlabsoffice-dev/DFWA ausfuehren, im main-Branch.
# Entfernt ~100MB toten/veralteten Kram. Siehe FEHLERLISTE.md fuer Details je Eintrag.
#
# Prinzip gegen Phantom-Dateien: .gitignore verhindert nur KUENFTIGES Tracking.
# Bereits committete Dateien muessen explizit mit `git rm --cached` aus dem Index
# genommen werden, sonst bleiben sie im Checkout/History haengen.

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

drop() {
  local path="$1"
  if [ ! -e "$path" ]; then
    return 0
  fi
  if git ls-files --error-unmatch "$path" >/dev/null 2>&1; then
    echo "git rm -r --cached: $path"
    git rm -r --cached --quiet -- "$path"
  fi
  echo "rm: $path"
  rm -rf -- "$path"
}

echo "== K7 / veraltete Build-Artefakte in assets/ =="
find assets -maxdepth 1 -type f \( -name "main-*.js" -o -name "main-*.css" -o -name "game-C1dcqWNr*.js" \) -print0 \
  | while IFS= read -r -d '' f; do drop "$f"; done

echo "== H2 / manus.visuals (Konzept-PNGs, ~89MB) =="
drop "manus.visuals"

echo "== H3 / bytegleiche Duplikat-Bilder (je eine Version behalten) =="
drop "assets/images/ack_core_brain.webp"
drop "assets/images/ack_splash_void.webp"
drop "assets/images/ack_pause.webp"
# behalten: ack_cyber_eye.webp, ack_defeat.webp
# ACHTUNG: falls ack_core_brain.webp / ack_splash_void.webp / ack_pause.webp an
# anderer Stelle im Code referenziert werden als in diesem Audit geprueft,
# vorher gegenchecken: grep -rn "ack_core_brain\|ack_splash_void\|ack_pause" --include="*.html" --include="*.js" .

echo "== H4 / dist/ (Build-Output, wird von CI frisch erzeugt) =="
drop "dist"

echo "== M1 / Session-/Debug-Artefakte im Root =="
for f in \
  analysis_output.txt analysis_output_v2.txt analysis_output_v4.txt analysis_output_v5.txt \
  lint_output.txt lint_output_v2.txt lint_output_v3.txt lint_output_v4.txt lint_output_v5.txt \
  lint_output_v6.txt lint_output_v7.txt lint_output_v8.txt lint_output_v9.txt lint_output_v10.json \
  preview.log preview_proof.log preview_test.log dev_server.log \
  pwa_audit.txt current_date.txt fix_app.py \
  fehleranalyse_bericht.md fehleranalyse_bericht_update.md start_screen_test_report.md \
  manus.read proof_before.png proof_after.png \
  test_buttons.js test_manual.js
do
  drop "$f"
done

echo "== M2 / versionierte Laufzeit-DB =="
drop "server/leaderboard.db"

echo "== M3 / Lockfile-Konflikt (pnpm ist massgeblich) =="
drop "server/package-lock.json"

echo ""
echo "Fertig. Diff pruefen, dann committen:"
echo "  git status"
echo "  git commit -m 'chore: repo cleanup - remove stale build artifacts, duplicate assets, session debug files (~100MB)'"
echo "  git push"
