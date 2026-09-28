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
    for (const answer of data.answers) {
      const card = document.createElement("section");
      card.className = "card";
      const title = document.createElement("h2");
      title.textContent = answer.subject;
      card.appendChild(title);
      const result = document.createElement("p");
      result.className = answer.is_correct ? "notice success" : "notice error";
      result.textContent = `${answer.is_correct ? "Correct" : "Erreur"} · Votre choix : ${answer.user_choice} · Email : ${answer.type} · ${answer.decision_time}s`;
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
