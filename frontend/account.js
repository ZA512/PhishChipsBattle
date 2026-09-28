"use strict";
window.PCB = {
  player: null,
  async request(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    const data = await response
      .json()
      .catch(() => ({ error: "Réponse serveur invalide" }));
    if (!response.ok) {
      const error = new Error(data.error || `Erreur ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return data;
  },
  ready: null,
};
PCB.ready = (async () => {
  try {
    const { player } = await PCB.request("/api/auth/me");
    PCB.player = player;
    const teams = await PCB.request("/api/teams/me");
    const administration =
      ["admin", "organizer"].includes(player.role) &&
      ["/enterprise-admin.html", "/admin.html", "/admin-stats.html"].includes(
        location.pathname,
      );
    if (
      teams.selectionRequired &&
      !location.pathname.endsWith("/teams.html") &&
      !administration
    ) {
      location.replace("/teams.html");
      return null;
    }
    const bar = document.createElement("nav");
    bar.className = "account-nav";
    for (const [label, href] of [
      ["Jeu", "/phishing.html"],
      ["Battles", "/battles.html"],
      ["Équipes", "/teams.html"],
      ["Classements", "/scores.html"],
      ["Profil", `/profile.html?id=${player.id}`],
    ]) {
      const link = document.createElement("a");
      link.textContent = label;
      link.href = href;
      bar.appendChild(link);
    }
    if (["admin", "organizer"].includes(player.role)) {
      const admin = document.createElement("a");
      admin.textContent = "Administration";
      admin.href = "/enterprise-admin.html";
      bar.appendChild(admin);
    }
    const name = document.createElement("span");
    name.textContent = player.display_name || player.name;
    bar.appendChild(name);
    const logout = document.createElement("button");
    logout.textContent = "Déconnexion";
    logout.className = "btn btn-secondary";
    logout.addEventListener("click", async () => {
      await PCB.request("/api/auth/logout", { method: "POST" });
      location.assign("/login.html");
    });
    bar.appendChild(logout);
    document.body.prepend(bar);
    return player;
  } catch (error) {
    if (error.status === 401) {
      location.replace("/login.html");
      return null;
    }
    const message = document.createElement("p");
    message.className = "notice error";
    message.textContent = error.message;
    document.body.prepend(message);
    return null;
  }
})();
