const fs = require("fs");

const targets = ["frontend/index.html", "frontend/app.js", "src-tauri/src"];
const han = /[\u4e00-\u9fff]/;
const verbose = process.argv.includes("--verbose");

function collect(file) {
  const text = fs.readFileSync(file, "utf8");
  return text.split(/\r?\n/).flatMap((line, index) => han.test(line) ? [`${file}:${index + 1}`] : []);
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes:true }).flatMap(entry => {
    const full = `${directory}/${entry.name}`;
    return entry.isDirectory() ? walk(full) : entry.name.endsWith(".rs") ? collect(full) : [];
  });
}

const findings = targets.flatMap(target => fs.statSync(target).isDirectory() ? walk(target) : collect(target));
console.log(`i18n migration audit: ${findings.length} source lines still contain Chinese text.`);
if (verbose) console.log(findings.join("\n"));
else console.log("Run `npm.cmd run audit:i18n -- --verbose` to list file locations.");
