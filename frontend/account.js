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
  confirm(text) {
    if (document.querySelector(".portal-confirm"))
      return Promise.resolve(false);
    return new Promise((resolve) => {
      const dialog = document.createElement("dialog");
      dialog.className = "portal-confirm";
      dialog.setAttribute("aria-labelledby", "confirm-title");
      const title = document.createElement("h2");
      title.id = "confirm-title";
      title.textContent = "On confirme ?";
      const description = document.createElement("p");
      description.textContent = text;
      const actions = document.createElement("div");
      actions.className = "form-actions";
      const cancel = document.createElement("button");
      cancel.className = "btn btn-secondary";
      cancel.textContent = "Annuler";
      const accept = document.createElement("button");
      accept.className = "btn btn-danger";
      accept.textContent = "Confirmer";
      cancel.onclick = () => dialog.close("cancel");
      accept.onclick = () => dialog.close("confirm");
      actions.append(cancel, accept);
      dialog.append(title, description, actions);
      document.body.appendChild(dialog);
      dialog.addEventListener(
        "close",
        () => {
          const confirmed = dialog.returnValue === "confirm";
          dialog.remove();
          resolve(confirmed);
        },
        { once: true },
      );
      dialog.showModal();
      cancel.focus();
    });
  },
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
    bar.setAttribute("aria-label", "Navigation principale");
    const brand = document.createElement("a");
    brand.href = "/phishing.html";
    brand.className = "brand";
    brand.innerHTML =
      '<span class="brand-mark">P&C</span><span><strong>Phish & Chips</strong><small>BATTLE DE BUREAU</small></span>';
    bar.appendChild(brand);
    const links = document.createElement("div");
    links.className = "nav-links";
    for (const [label, href] of [
      ["Entraînement", "/phishing.html"],
      ["Battles", "/battles.html"],
      ["Mon équipe", "/teams.html"],
      ["Classements", "/scores.html"],
      ["Mon dossier", `/profile.html?id=${player.id}`],
    ]) {
      const link = document.createElement("a");
      link.textContent = label;
      link.href = href;
      if (new URL(link.href).pathname === location.pathname)
        link.setAttribute("aria-current", "page");
      links.appendChild(link);
    }
    if (["admin", "organizer"].includes(player.role)) {
      const admin = document.createElement("a");
      admin.textContent = "Administration";
      admin.href = "/enterprise-admin.html";
      if (administration) admin.setAttribute("aria-current", "page");
      links.appendChild(admin);
    }
    bar.appendChild(links);
    const account = document.createElement("div");
    account.className = "nav-account";
    const name = document.createElement("span");
    name.className = "account-name";
    name.textContent = player.display_name || player.name;
    account.appendChild(name);
    const appearance = document.createElement("button");
    appearance.type = "button";
    appearance.className = "appearance-button";
    appearance.dataset.appearance = "";
    account.appendChild(appearance);
    const logout = document.createElement("button");
    logout.textContent = "Déconnexion";
    logout.setAttribute("aria-label", "Déconnexion");
    logout.title = "Déconnexion";
    logout.className = "btn btn-secondary";
    logout.addEventListener("click", async () => {
      await PCB.request("/api/auth/logout", { method: "POST" });
      location.assign("/login.html");
    });
    account.appendChild(logout);
    bar.appendChild(account);
    document.body.prepend(bar);
    window.PCBTheme?.refresh();
    if (!document.querySelector("footer")) {
      const footer = document.createElement("footer");
      footer.className = "portal-footer";
      footer.textContent =
        "Phish & Chips Battle · GPLv3 · La sécurité n’a pas approuvé votre dernier clic.";
      document.body.appendChild(footer);
    }
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
