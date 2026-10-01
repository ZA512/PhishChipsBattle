"use strict";
PCB.ready
  .then(async (player) => {
    if (!player) return;
    const id = new URLSearchParams(location.search).get("id");
    const data = await PCB.request(
      `/api/sessions/${encodeURIComponent(id || "")}/recap`,
    );
    document.getElementById("message").textContent =
      `Score : ${data.session.score} · Erreurs : ${data.session.errors} · Équipe de la partie : ${data.session.service_name || "—"}`;
    const container = document.getElementById("answers");
    if (!data.answers.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent =
        "Aucun email traité. Même le rapport d’incident est au chômage.";
      container.appendChild(empty);
    }
    const labels = {
      safe: "Mail sûr",
      phishing: "Phishing",
      joker: "SOS Sécu",
      timeout: "Temps écoulé",
    };
    for (const answer of data.answers) {
      const card = document.createElement("section");
      card.className = "card";
      const title = document.createElement("h2");
      title.textContent = answer.subject;
      card.appendChild(title);
      const sender = document.createElement("p");
      sender.className = "meta";
      sender.textContent = "De : " + answer.sender;
      card.appendChild(sender);
      const result = document.createElement("p");
      result.className = answer.is_correct ? "notice success" : "notice error";
      result.textContent = `${answer.is_correct ? "Correct" : "Erreur"} · Votre choix : ${labels[answer.user_choice] || answer.user_choice} · Email : ${labels[answer.type] || answer.type} · ${answer.decision_time}s`;
      card.appendChild(result);
      const list = document.createElement("ul");
      answer.clues.forEach((clue) => {
        const li = document.createElement("li");
        li.textContent = clue;
        list.appendChild(li);
      });
      card.appendChild(list);
      container.appendChild(card);
    }
  })
  .catch((e) => {
    const message = document.getElementById("message");
    message.className = "notice error";
    message.textContent = e.message;
  });
