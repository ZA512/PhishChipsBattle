"use strict";
const message = document.getElementById("message");
let bootstrapAvailable = false;
function showAuthView(view) {
  if (view === "bootstrap" && !bootstrapAvailable) return;
  document.querySelectorAll("[data-auth-form]").forEach((form) => {
    form.classList.toggle("hidden", form.dataset.authForm !== view);
  });
  document.querySelectorAll("#auth-tabs button").forEach((button) => {
    const active = button.dataset.authView === view;
    button.setAttribute("aria-pressed", String(active));
    button.classList.toggle("btn-secondary", !active);
  });
  document
    .getElementById("auth-tabs")
    .classList.toggle("hidden", view === "bootstrap");
  document
    .getElementById("setup-link")
    .classList.toggle("hidden", !bootstrapAvailable || view === "bootstrap");
  document.getElementById("auth-title").textContent = {
    login: "Identifiez-vous.",
    register: "Un volontaire de plus.",
    bootstrap: "Qui garde les clés ?",
  }[view];
  document.getElementById("auth-description").textContent = {
    login: "On aimerait savoir à qui envoyer le rapport d’incident.",
    register:
      "Choisissez un pseudo. Il figurera dans les classements, pour le meilleur et surtout pour le pire.",
    bootstrap:
      "Créez le premier administrateur de cette installation. Ce formulaire disparaîtra ensuite.",
  }[view];
  message.textContent = "";
}
document.querySelectorAll("[data-auth-view]").forEach((button) => {
  button.addEventListener("click", () => showAuthView(button.dataset.authView));
});
document.querySelectorAll("[data-auth-form]").forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const mode = form.dataset.authForm;
    const prefix = mode === "login" ? "" : mode + "-";
    const button = event.submitter;
    button.disabled = true;
    message.textContent = "";
    try {
      const body = {
        email: document.getElementById(prefix + "email").value,
        password: document.getElementById(prefix + "password").value,
        ...(mode !== "login"
          ? { name: document.getElementById(prefix + "name").value }
          : {}),
        ...(mode === "bootstrap"
          ? {
              bootstrapSecret:
                document.getElementById("bootstrap-secret").value,
            }
          : {}),
      };
      const response = await fetch("/api/auth/" + mode, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        if (mode === "bootstrap" && response.status === 409) {
          bootstrapAvailable = false;
          showAuthView("login");
        }
        throw new Error(data.error);
      }
      location.assign("/phishing.html");
    } catch (error) {
      message.className = "notice error";
      message.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  });
});
(async () => {
  try {
    const response = await fetch("/api/auth/config");
    if (!response.ok) throw new Error("Serveur indisponible");
    const data = await response.json();
    if (data.mode === "entra") {
      message.textContent = "Utilisez votre compte Microsoft professionnel.";
      document.getElementById("sso").classList.remove("hidden");
    } else {
      bootstrapAvailable = data.bootstrapAvailable === true;
      showAuthView("login");
    }
  } catch (error) {
    message.className = "notice error";
    message.textContent = error.message;
  }
})();
