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
console.log(`i18n check passed (${chineseKeys.length} keyed messages in zh-CN and en).`);
