const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
function check(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) check(file);
    else if (file.endsWith(".js"))
      execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
  }
}
check(path.resolve(__dirname, "../src"));
check(path.resolve(__dirname, "../../frontend"));
console.log("Syntaxe JavaScript vérifiée (API et interface).");
