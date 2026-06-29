const fs = require('fs');
const path = require('path');

const STAGING_PATH = path.join(__dirname, '../staging_questions.json');
const MAIN_PATH = path.join(__dirname, '../questions_i18n.json');

function verifyAndMerge() {
  if (!fs.existsSync(STAGING_PATH)) {
    console.log('Keine Fragen in der Staging-Datei gefunden.');
    return;
  }

  const stagingQuestions = JSON.parse(fs.readFileSync(STAGING_PATH, 'utf8'));
  const mainQuestions = JSON.parse(fs.readFileSync(MAIN_PATH, 'utf8'));

  console.log(`${stagingQuestions.length} Fragen werden in den Hauptpool übernommen...`);

  const updatedMain = [...mainQuestions, ...stagingQuestions];

  fs.writeFileSync(MAIN_PATH, JSON.stringify(updatedMain, null, 2), 'utf8');
  fs.unlinkSync(STAGING_PATH); // Lösche Staging nach Übernahme

  console.log('Übernahme erfolgreich abgeschlossen.');
  console.log(`Neuer Gesamtbestand: ${updatedMain.length} Fragen.`);
}

verifyAndMerge();
