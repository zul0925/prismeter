const fs = require("fs");

const source = fs.readFileSync("frontend/app.js", "utf8");
const dictionaryPrefix = "const uiMessages = Object.freeze(";
const dictionaryStart = source.indexOf(dictionaryPrefix);
const dictionaryEnd = source.indexOf("\n});", dictionaryStart);
if (dictionaryStart < 0 || dictionaryEnd < 0) throw new Error("uiMessages dictionary was not found");
const dictionaryLiteral = source.slice(dictionaryStart + dictionaryPrefix.length, dictionaryEnd + 2);

// This check deliberately evaluates only the literal dictionary stored in this
// repository. It prevents a new keyed Chinese message from being released
// without its English counterpart.
const dictionary = Function(`return (${dictionaryLiteral})`)();
const chineseKeys = Object.keys(dictionary["zh-CN"] || {}).sort();
const englishKeys = Object.keys(dictionary.en || {}).sort();
const missing = chineseKeys.filter(key => !englishKeys.includes(key));
const unexpected = englishKeys.filter(key => !chineseKeys.includes(key));
if (missing.length || unexpected.length) {
  throw new Error(`i18n dictionaries differ. Missing English: ${missing.join(", ") || "none"}; unexpected English: ${unexpected.join(", ") || "none"}`);
}
if (chineseKeys.some(key => !dictionary["zh-CN"][key] || !dictionary.en[key])) {
  throw new Error("i18n dictionaries contain an empty message");
}

function readFrozenObject(name) {
  const prefix = `const ${name} = Object.freeze(`;
  const start = source.indexOf(prefix);
  const end = source.indexOf("\n});", start);
  if (start < 0 || end < 0) throw new Error(`${name} dictionary was not found`);
  return Function(`return (${source.slice(start + prefix.length, end + 2)})`)();
}

const staticChinese = readFrozenObject("englishUi");
const staticEnglish = readFrozenObject("additionalEnglishUi");
const html = fs.readFileSync("frontend/index.html", "utf8");
const visibleText = [...html.matchAll(/>([^<>]*[\u4e00-\u9fff][^<>]*)</g)]
  .map(match => match[1].trim())
  .filter(Boolean);
const accessibleAttributes = [...html.matchAll(/(?:title|aria-label|placeholder)="([^"]*[\u4e00-\u9fff][^"]*)"/g)]
  .map(match => match[1]);
// "文" is a decorative, aria-hidden icon rather than readable interface copy.
const decorativeText = new Set(["文"]);
const untranslatedStatic = [...new Set([...visibleText, ...accessibleAttributes])]
  .filter(value => !decorativeText.has(value) && !staticChinese[value] && !staticEnglish[value]);
if (untranslatedStatic.length) {
  throw new Error(`Static interface copy is missing English translations: ${untranslatedStatic.join(" | ")}`);
}
console.log(`i18n check passed (${chineseKeys.length} keyed messages and all audited static interface copy translated).`);
