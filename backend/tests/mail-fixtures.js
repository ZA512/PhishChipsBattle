"use strict";
// Deliberately synthetic integration fixtures. Never loaded by the application.
module.exports = Array.from({ length: 24 }, (_, i) => ({
  sender: `Fixture ${i} <fixture${i}@example.test>`,
  realSender: `fixture${i}@example.test`,
  subject: `Scénario de test ${i}`,
  body: `Contenu synthétique ${i}.`,
  type: i % 2 ? "phishing" : "safe",
  usage: "both",
  clues: [`Indice synthétique ${i} : fixture sans valeur pédagogique.`],
}));
