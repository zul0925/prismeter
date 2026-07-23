const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("frontend/messages.js", "utf8");
const sandbox = { Object, window: { PrismeterI18n: { register(messages) { sandbox.messages = messages; } } } };
vm.runInNewContext(source, sandbox, { filename: "frontend/messages.js" });
const dictionary = sandbox.messages;
const staticMessages = sandbox.window.PrismeterStaticMessages;
if (!dictionary || !staticMessages?.exact || !staticMessages?.fragments) {
  throw new Error("message catalog did not register its dynamic and static translations");
}
const chineseKeys = Object.keys(dictionary["zh-CN"] || {}).sort();
const englishKeys = Object.keys(dictionary.en || {}).sort();
if (!chineseKeys.length || !englishKeys.length) {
  throw new Error("i18n catalog must contain both zh-CN and en messages");
}
const missing = chineseKeys.filter(key => !englishKeys.includes(key));
const unexpected = englishKeys.filter(key => !chineseKeys.includes(key));
if (missing.length || unexpected.length) {
  throw new Error(`i18n dictionaries differ. Missing English: ${missing.join(", ") || "none"}; unexpected English: ${unexpected.join(", ") || "none"}`);
}
if (chineseKeys.some(key => !dictionary["zh-CN"][key] || !dictionary.en[key])) {
  throw new Error("i18n dictionaries contain an empty message");
}
const appSource = fs.readFileSync("frontend/app.js", "utf8");
const usedKeys = [...appSource.matchAll(/\bt\(\s*["']([^"']+)/g)].map(match => match[1]);
const unresolvedKeys = [...new Set(usedKeys.filter(key => !dictionary["zh-CN"][key] || !dictionary.en[key]))].sort();
if (unresolvedKeys.length) {
  throw new Error(`i18n catalog is missing keys used by frontend/app.js: ${unresolvedKeys.join(", ")}`);
}
const declaredKeys = [...fs.readFileSync("frontend/index.html", "utf8").matchAll(/\bdata-i18n="([^"]+)"/g)].map(match => match[1]);
const unresolvedDeclaredKeys = [...new Set(declaredKeys.filter(key => !dictionary["zh-CN"][key] || !dictionary.en[key]))].sort();
if (unresolvedDeclaredKeys.length) {
  throw new Error(`i18n catalog is missing keys declared by frontend/index.html: ${unresolvedDeclaredKeys.join(", ")}`);
}
if (appSource.match(/const (?:uiMessages|englishUi|additionalEnglishUi|englishFragments) =/)) {
  throw new Error("Message catalogs and static translations must live in frontend/messages.js, not frontend/app.js");
}
const staticChinese = staticMessages.exact;
const staticEnglish = {};
const html = fs.readFileSync("frontend/index.html", "utf8");
const visibleText = [...html.matchAll(/>([^<>]*[\u4e00-\u9fff][^<>]*)</g)]
  .map(match => match[1].trim())
  .filter(Boolean);
const declarativeFallbackCopy = new Set(
  [...html.matchAll(/\bdata-i18n="[^"]+"[^>]*>([^<>]*[\u4e00-\u9fff][^<>]*)</g)]
    .map(match => match[1].trim())
    .filter(Boolean)
);
const accessibleAttributes = [...html.matchAll(/(?:title|aria-label|placeholder)="([^"]*[\u4e00-\u9fff][^"]*)"/g)]
  .map(match => match[1]);
// "文" is a decorative, aria-hidden icon rather than readable interface copy.
const decorativeText = new Set(["文"]);
const untranslatedStatic = [...new Set([...visibleText, ...accessibleAttributes])]
  .filter(value => !decorativeText.has(value) && !declarativeFallbackCopy.has(value) && !staticChinese[value] && !staticEnglish[value]);
if (untranslatedStatic.length) {
  throw new Error(`Static interface copy is missing English translations: ${untranslatedStatic.join(" | ")}`);
}
const whitespaceWrapped = visibleText.map(value => `\n    ${value}\n  `);
const untranslatedRenderedCopy = whitespaceWrapped
  .map(value => value.match(/^(\s*)([\s\S]*?)(\s*)$/)?.[2] || value)
  .filter(value => !decorativeText.has(value) && !declarativeFallbackCopy.has(value) && !staticChinese[value] && !staticEnglish[value]);
if (untranslatedRenderedCopy.length) {
  throw new Error(`Whitespace-wrapped static copy does not resolve to English: ${[...new Set(untranslatedRenderedCopy)].join(" | ")}`);
}
console.log(`i18n check passed (${chineseKeys.length} keyed messages and all audited static interface copy translated in its rendered form).`);
