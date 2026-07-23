const fs = require("fs");

const html = fs.readFileSync("frontend/index.html", "utf8");
const css = fs.readFileSync("frontend/styles.css", "utf8");
const app = fs.readFileSync("frontend/app.js", "utf8");

const optionBodies = [...html.matchAll(/<button\b[^>]*class="[^"]*combo-option[^"]*"[^>]*>([\s\S]*?)<\/button>/g)]
  .map(match => match[1].trim());

if (!optionBodies.length) throw new Error("Combobox validation failed: no options were found.");

const mixedTextOptions = optionBodies.filter(body => body.includes("<span") && !body.startsWith("<span"));
if (mixedTextOptions.length) {
  throw new Error(`Combobox validation failed: ${mixedTextOptions.length} option(s) mix bare primary text with span descriptions.`);
}

const requirements = [
  [css, /\.combo-menu\.combo-menu-floating\s*\{[^}]*overflow-y\s*:\s*hidden/s, "short menus must not scroll"],
  [css, /\.combo-menu\.combo-menu-floating\.combo-menu-scrollable\s*\{[^}]*overflow-y\s*:\s*auto/s, "long menus must opt into scrolling"],
  [css, /\.combo-option\s*>\s*span:first-child[^}]*font-size\s*:\s*13px/s, "primary option labels must remain readable"],
  [css, /\.combo-option\s*>\s*span:last-child:not\(:first-child\)[^}]*font-size\s*:\s*11px/s, "option descriptions must use the shared supporting size"],
  [app, /options\.length\s*>\s*5/, "scrolling must begin only after five options"],
  [app, /options\.slice\(0,\s*5\)/, "long menus must display five rows before scrolling"]
];

const missing = requirements.filter(([source, pattern]) => !pattern.test(source)).map(([, , message]) => message);
if (missing.length) throw new Error(`Combobox validation failed: ${missing.join("; ")}.`);

console.log(`Combobox check passed (${optionBodies.length} options; scrolling begins after 5).`);
