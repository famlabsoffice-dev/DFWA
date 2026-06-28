import fs from 'fs';

const questionsPath = './questions_i18n.json';
const questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

let counts = [0, 0, 0, 0];
questions.forEach(q => {
    counts[q.correct]++;
});

console.log('Original distribution:', counts);
const total = questions.length;
counts.forEach((c, i) => {
    console.log(`Index ${i}: ${(c / total * 100).toFixed(2)}%`);
});

// Korrektur durch Shufflen der Optionen
const fixedQuestions = questions.map(q => {
    const optionsDe = [...q.options.de];
    const optionsEn = [...q.options.en];
    const correctVal = optionsDe[q.correct];
    const correctValEn = optionsEn[q.correct];
    
    // Zufälliger neuer Index für die richtige Antwort
    const newCorrect = Math.floor(Math.random() * 4);
    
    // Tausche die Optionen
    [optionsDe[q.correct], optionsDe[newCorrect]] = [optionsDe[newCorrect], optionsDe[q.correct]];
    [optionsEn[q.correct], optionsEn[newCorrect]] = [optionsEn[newCorrect], optionsEn[q.correct]];
    
    return {
        ...q,
        options: {
            de: optionsDe,
            en: optionsEn
        },
        correct: newCorrect
    };
});

let newCounts = [0, 0, 0, 0];
fixedQuestions.forEach(q => {
    newCounts[q.correct]++;
});

console.log('New distribution:', newCounts);
newCounts.forEach((c, i) => {
    console.log(`Index ${i}: ${(c / total * 100).toFixed(2)}%`);
});

fs.writeFileSync(questionsPath, JSON.stringify(fixedQuestions, null, 2));
console.log('Bias correction applied and saved.');
