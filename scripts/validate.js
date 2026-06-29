const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const ajv = new Ajv({ allErrors: true });
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, 'questions.schema.json'), 'utf8'));
const validate = ajv.compile(schema);

const dataPath = path.join(__dirname, '../questions_i18n.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

const valid = validate(data);

if (!valid) {
  console.error('JSON-Validierung fehlgeschlagen:');
  validate.errors.forEach((err) => {
    console.error(`- ${err.instancePath}: ${err.message}`);
  });
  process.exit(1);
} else {
  // Zusätzliche Prüfungen für Platzhalter
  let hasPlaceholders = false;
  data.forEach((q, index) => {
    const check = (str) => /TBD|Folgt|Platzhalter/i.test(str);
    if (check(q.cat) || check(q.text.de) || check(q.text.en)) {
      console.error(`Platzhalter in Frage ${index} gefunden.`);
      hasPlaceholders = true;
    }
  });

  if (hasPlaceholders) {
    process.exit(1);
  }

  console.log('JSON-Validierung erfolgreich.');
}
