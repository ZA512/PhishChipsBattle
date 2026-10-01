"use strict";
// Render imported corrections verbatim. Never invent an indicator or a verdict.
window.PCBFeedback = (() => {
  const headings = new Set([
    "À repérer",
    "Ce qui concorde",
    "Le bon réflexe",
    "What to notice",
    "What fits",
    "The right move",
  ]);
  const legacy = new Map([
    ["Email spoofing / Header anomaly", "L’expéditeur"],
    ["URL Obfuscation / Redirect chaining", "La destination du lien"],
    ["Typosquatting", "L’adresse qui ressemble à une autre"],
    ["Homograph attack (IDN spoofing)", "Les caractères trompeurs"],
    ["Domain fraud / Suspicious TLD", "Le domaine utilisé"],
    ["Social engineering - Urgency", "La pression pour agir vite"],
    ["Social engineering - Curiosity", "L’appât"],
    ["Social engineering - Fear / Intimidation", "La menace"],
    ["Content anomaly", "La demande inhabituelle"],
    ["Malicious attachment", "Le fichier proposé"],
    ["Data harvesting / Credential phishing", "Les informations demandées"],
    ["Subdomain spoofing", "Le domaine qui contrôle l’adresse"],
    ["Legitimate indicator", "Ce qui concorde dans ce scénario"],
  ]);
  function render(container, clues) {
    container.replaceChildren();
    const list = document.createElement("ul");
    list.className = "feedback-points";
    const technical = [];
    for (const clue of Array.isArray(clues) ? clues : []) {
      if (typeof clue !== "string" || !clue.trim()) continue;
      const cut = clue.indexOf(":"),
        prefix = cut > 0 ? clue.slice(0, cut).trim() : "",
        known = headings.has(prefix) || legacy.has(prefix);
      const item = document.createElement("li");
      if (known && clue.slice(cut + 1).trim()) {
        const heading = document.createElement("strong");
        heading.className = "feedback-label";
        heading.textContent = legacy.get(prefix) || prefix;
        item.append(heading);
        if (legacy.has(prefix)) technical.push(clue);
      }
      const explanation = document.createElement("p");
      explanation.className = "feedback-copy";
      explanation.textContent =
        known && clue.slice(cut + 1).trim() ? clue.slice(cut + 1).trim() : clue;
      item.append(explanation);
      list.append(item);
    }
    if (list.children.length) container.append(list);
    else {
      const empty = document.createElement("p");
      empty.className = "feedback-copy";
      empty.textContent = "Aucune explication renseignée pour ce scénario.";
      container.append(empty);
    }
    if (technical.length) {
      const details = document.createElement("details"),
        summary = document.createElement("summary"),
        technicalList = document.createElement("ul");
      details.className = "feedback-technical";
      summary.textContent = "Les noms techniques, si vous y tenez";
      for (const clue of technical) {
        const item = document.createElement("li");
        item.textContent = clue;
        technicalList.append(item);
      }
      details.append(summary, technicalList);
      container.append(details);
    }
  }
  return { render };
})();
