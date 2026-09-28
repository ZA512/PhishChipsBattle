"use strict";
const message = document.getElementById("message");
async function signIn(mode) {
  const buttons = document.querySelectorAll("button");
  buttons.forEach((b) => (b.disabled = true));
  try {
    const body = {
      email: document.getElementById("email").value,
      password: document.getElementById("password").value,
      name: document.getElementById("name").value,
      bootstrapSecret: document.getElementById("bootstrap-secret").value,
    };
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    location.assign("/phishing.html");
  } catch (e) {
    message.className = "notice error";
    message.textContent = e.message;
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}
document.getElementById("local-form").addEventListener("submit", (e) => {
  e.preventDefault();
  signIn("login");
});
document
  .getElementById("register")
  .addEventListener("click", () => signIn("register"));
document
  .getElementById("bootstrap")
  .addEventListener("click", () => signIn("bootstrap"));
(async () => {
  try {
    const res = await fetch("/api/auth/config");
    if (!res.ok) throw new Error("Serveur indisponible");
    const data = await res.json();
    message.textContent =
      data.mode === "entra"
        ? "Utilisez votre compte Microsoft professionnel."
        : "Connexion locale protégée par mot de passe.";
    document
      .getElementById(data.mode === "entra" ? "sso" : "local-form")
      .classList.remove("hidden");
  } catch (e) {
    message.className = "notice error";
    message.textContent = e.message;
  }
})();
