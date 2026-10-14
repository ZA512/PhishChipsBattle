"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Only the dialog lifecycle is simulated; run the actual shared frontend helper.
class Element extends EventTarget {
  constructor(tag) {
    super();
    this.tag = tag;
    this.children = [];
    this.open = false;
    this.returnValue = "";
  }
  setAttribute() {}
  append(...children) {
    this.children.push(...children);
    children.forEach((child) => (child.parent = this));
  }
  appendChild(child) {
    this.append(child);
  }
  remove() {
    this.parent.children = this.parent.children.filter(
      (child) => child !== this,
    );
  }
  showModal() {
    this.open = true;
  }
  close(value = "") {
    this.returnValue = value;
    this.open = false;
    this.dispatchEvent(new Event("close"));
  }
  focus() {}
}

function page() {
  const html = fs.readFileSync(
    path.join(__dirname, "../../frontend/enterprise-admin.html"),
    "utf8",
  );
  assert.match(
    html,
    /<dialog id="mail-preview" class="portal-confirm mail-preview">/,
  );
  const body = new Element("body");
  const preview = new Element("dialog");
  preview.className = "portal-confirm mail-preview";
  body.append(preview);
  const document = {
    body,
    createElement: (tag) => new Element(tag),
    querySelector: (selector) =>
      body.children.find(
        (item) =>
          item.className?.split(" ").includes("portal-confirm") &&
          (!selector.startsWith("dialog") || item.tag === "dialog") &&
          (!selector.includes("[open]") || item.open),
      ) || null,
  };
  const source = fs.readFileSync(
    path.join(__dirname, "../../frontend/account.js"),
    "utf8",
  );
  const end = source.indexOf("PCB.ready =");
  assert.ok(end > 0);
  const context = { window: {}, document };
  vm.runInNewContext(source.slice(0, end), context);
  return {
    confirm: context.window.PCB.confirm,
    preview,
    dialogs: () => body.children.filter((item) => item.open),
  };
}

test("Un aperçu de mail fermé ne bloque pas la confirmation", async () => {
  const ui = page();
  // Opening and closing an inspected mail must not block later deletions either.
  ui.preview.showModal();
  ui.preview.close();
  const pending = ui.confirm("Supprimer les mails ?");
  assert.equal(ui.dialogs().length, 1);
  const dialog = ui.dialogs()[0];
  assert.notEqual(dialog, ui.preview);
  dialog.children[2].children[1].onclick(); // Confirmer
  assert.equal(await pending, true);
  assert.equal(ui.dialogs().length, 0);
});

test("Une fenêtre ouverte empêche les confirmations concurrentes", async () => {
  const ui = page();
  ui.preview.showModal();
  assert.equal(await ui.confirm("Supprimer ?"), false);
  assert.equal(ui.dialogs().length, 1);
  ui.preview.close();
  const pending = ui.confirm("Supprimer ?");
  assert.equal(await ui.confirm("Second clic"), false);
  assert.equal(ui.dialogs().length, 1);
  ui.dialogs()[0].children[2].children[0].onclick(); // Annuler
  assert.equal(await pending, false);
  assert.equal(ui.dialogs().length, 0);
});

test("Annuler ou fermer sans confirmation permet de réessayer", async () => {
  const ui = page();
  const canceled = ui.confirm("Supprimer la sélection ?");
  assert.equal(ui.dialogs().length, 1);
  ui.dialogs()[0].children[2].children[0].onclick();
  assert.equal(await canceled, false);
  const dismissed = ui.confirm("Supprimer tout ?");
  assert.equal(ui.dialogs().length, 1);
  ui.dialogs()[0].close(); // Native dismissal, e.g. Escape, has no confirm value.
  assert.equal(await dismissed, false);
  const accepted = ui.confirm("Réessayer ?");
  assert.equal(ui.dialogs().length, 1);
  ui.dialogs()[0].children[2].children[1].onclick();
  assert.equal(await accepted, true);
});
