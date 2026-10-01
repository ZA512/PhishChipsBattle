"use strict";
// Shared appearance for the portal. The mail skin is an independent game setting.
window.PCBTheme = {
  refresh() {
    const dark = localStorage.getItem("pcb-dark") === "true";
    document.documentElement.classList.toggle("dark", dark);
    document.querySelectorAll("[data-appearance]").forEach((button) => {
      button.textContent = dark ? "☀ Clair" : "☾ Sombre";
      button.setAttribute(
        "aria-label",
        dark ? "Activer le mode clair" : "Activer le mode sombre",
      );
    });
  },
  toggle() {
    localStorage.setItem(
      "pcb-dark",
      localStorage.getItem("pcb-dark") !== "true",
    );
    this.refresh();
  },
};
PCBTheme.refresh();
document.addEventListener("DOMContentLoaded", () => {
  PCBTheme.refresh();
  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-appearance]")) PCBTheme.toggle();
  });
});
