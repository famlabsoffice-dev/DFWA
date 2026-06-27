const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_API_BASE
});

const CATEGORY = process.argv[2] || 'Allgemeinwissen';
const COUNT = parseInt(process.argv[3]) || 5;

async function generateQuestions() {
    console.log(`Generiere ${COUNT} neue Fragen für die Kategorie: ${CATEGORY}...`);

    const prompt = `Generiere ${COUNT} Quizfragen für die Kategorie "${CATEGORY}" im JSON-Format.
    Jede Frage muss folgendes Schema haben:
    {
      "cat": "${CATEGORY}",
      "text": { "de": "Frage auf Deutsch", "en": "Question in English" },
      "options": {
        "de": ["Antwort 1", "Antwort 2", "Antwort 3", "Antwort 4"],
        "en": ["Option 1", "Option 2", "Option 3", "Option 4"]
      },
      "correct": 0 (Index der richtigen Antwort, 0-3)
    }
    Gib nur das JSON-Array zurück, ohne zusätzlichen Text oder Markdown-Formatierung.`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-5",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.7
        });

        if (!response.choices || response.choices.length === 0) {
            throw new Error('Keine Antwort von OpenAI erhalten');
        }
        let content = response.choices[0].message.content.trim();
        // Entferne eventuelle Markdown-Code-Blocks
        content = content.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        
        const newQuestions = JSON.parse(content);
        
        const stagingPath = path.join(__dirname, '../staging_questions.json');
        let existingStaging = [];
        if (fs.existsSync(stagingPath)) {
            existingStaging = JSON.parse(fs.readFileSync(stagingPath, 'utf8'));
        }
        
        const updatedStaging = [...existingStaging, ...newQuestions];
        fs.writeFileSync(stagingPath, JSON.stringify(updatedStaging, null, 2), 'utf8');
        
        console.log(`${newQuestions.length} Fragen wurden zur staging_questions.json hinzugefügt.`);
        console.log(`Bitte überprüfe die Fragen in staging_questions.json und führe 'node scripts/verify_staging.js' aus, um sie in den Hauptpool zu übernehmen.`);
    } catch (error) {
        console.error('Fehler bei der Generierung:', error);
    }
}

generateQuestions();
