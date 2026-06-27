const fs = require('fs');
const path = require('path');
const Levenshtein = require('fast-levenshtein');

const FILE_PATH = path.join(__dirname, '../questions_i18n.json');
const THRESHOLD = 0.8; // Ähnlichkeits-Schwellenwert (0.8 = 80% Übereinstimmung)

function getSimilarity(str1, str2) {
    const distance = Levenshtein.get(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLength);
}

function deduplicate() {
    if (!fs.existsSync(FILE_PATH)) {
        console.error('questions_i18n.json nicht gefunden!');
        return;
    }

    const rawData = fs.readFileSync(FILE_PATH, 'utf8');
    let questions = JSON.parse(rawData);
    const initialCount = questions.length;
    
    const uniqueQuestions = [];
    const removedCount = 0;

    for (let i = 0; i < questions.length; i++) {
        let isDuplicate = false;
        const currentQ = questions[i];
        
        // Prüfe gegen bereits hinzugefügte eindeutige Fragen
        for (let j = 0; j < uniqueQuestions.length; j++) {
            const existingQ = uniqueQuestions[j];
            
            // 1:1 Duplikat Prüfung (Text DE oder EN)
            if (currentQ.text.de === existingQ.text.de || currentQ.text.en === existingQ.text.en) {
                isDuplicate = true;
                break;
            }

            // Fuzzy Matching (DE Text)
            const similarity = getSimilarity(currentQ.text.de, existingQ.text.de);
            if (similarity > THRESHOLD) {
                isDuplicate = true;
                console.log(`Ähnliche Frage gefunden (Ähnlichkeit: ${(similarity * 100).toFixed(2)}%):`);
                console.log(`1: ${existingQ.text.de}`);
                console.log(`2: ${currentQ.text.de}`);
                break;
            }
        }

        if (!isDuplicate) {
            uniqueQuestions.push(currentQ);
        }
    }

    fs.writeFileSync(FILE_PATH, JSON.stringify(uniqueQuestions, null, 2), 'utf8');
    console.log(`Deduplizierung abgeschlossen.`);
    console.log(`Ursprünglich: ${initialCount} Fragen`);
    console.log(`Entfernt: ${initialCount - uniqueQuestions.length} Duplikate/ähnliche Fragen`);
    console.log(`Verbleibend: ${uniqueQuestions.length} Fragen`);
}

deduplicate();
