const fs = require("fs");
const path = require("path");

// The maintained frontend now lives directly in ./frontend.  This command is
// intentionally a validator: older revisions regenerated it from a 0.7.7
// prototype and silently discarded newer UI and native-window fixes.
const frontend = path.join(__dirname, "frontend");
const required = ["index.html", "styles.css", "i18n.js", "messages.js", "app.js"];

for (const filename of required) {
  const file = path.join(frontend, filename);
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
    throw new Error(`Missing maintained frontend file: ${file}`);
  }
}

const html = fs.readFileSync(path.join(frontend, "index.html"), "utf8");
const script = fs.readFileSync(path.join(frontend, "app.js"), "utf8");
if (!html.includes('id="windowMinimize"') || !script.includes("loadBackendState()")) {
  throw new Error("Frontend validation failed: required application shell is incomplete.");
}
if (!html.includes('src="i18n.js"') || !html.includes('src="messages.js"') || !script.includes("window.PrismeterI18n")) {
  throw new Error("Frontend validation failed: the standard i18n runtime is not wired into the application shell.");
}
const runtimeIndex = html.indexOf('src="i18n.js"');
const catalogIndex = html.indexOf('src="messages.js"');
const appIndex = html.indexOf('src="app.js"');
if (!(runtimeIndex < catalogIndex && catalogIndex < appIndex)) {
  throw new Error("Frontend validation failed: i18n runtime, catalog, and application scripts must load in that order.");
}

const htmlIds = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = htmlIds.filter((id, index) => htmlIds.indexOf(id) !== index);
if (duplicateIds.length) {
  throw new Error(`Frontend validation failed: duplicate element IDs: ${[...new Set(duplicateIds)].join(", ")}`);
}

const knownIds = new Set(htmlIds);
const referencedIds = [...script.matchAll(/\bels\.([A-Za-z_$][\w$]*)/g)].map(match => match[1]);
const missingIds = [...new Set(referencedIds.filter(id => !knownIds.has(id)))];
if (missingIds.length) {
  throw new Error(`Frontend validation failed: app.js references missing IDs: ${missingIds.join(", ")}`);
}

const forbiddenDemoFixtures = ["82,400 AFP", "DeepSeek V4 Flash", "GPT-5.6 Luna", "今日消费 ¥ 2.16"];
const retainedFixtures = forbiddenDemoFixtures.filter(value => script.includes(value));
if (retainedFixtures.length) {
  throw new Error(`Frontend validation failed: demo usage fixtures remain: ${retainedFixtures.join(", ")}`);
}

// Native browser dialogs expose the loopback origin (127.0.0.1) in their title
// and bypass Prismeter's visual language. All confirmations and messages must use
// the app's own dialog or toast components.
const nativeDialogPatterns = [
  ["alert", /\b(?:window\.)?alert\s*\(/],
  ["confirm", /\b(?:window\.)?confirm\s*\(/],
  ["prompt", /\b(?:window\.)?prompt\s*\(/]
];
const retainedNativeDialogs = nativeDialogPatterns
  .filter(([, pattern]) => pattern.test(script))
  .map(([name]) => name);
if (retainedNativeDialogs.length) {
  throw new Error(
    `Frontend validation failed: browser-native dialogs remain: ${retainedNativeDialogs.join(", ")}`
  );
}

// The UI is served by Prismeter's loopback server, so every native command
// invoked from the frontend must be explicitly allowed for that remote origin.
// Keep this check close to the frontend to prevent a command from compiling
// successfully while being rejected by Tauri's runtime ACL.
const capabilityFile = path.join(__dirname, "src-tauri", "capabilities", "default.json");
const capability = JSON.parse(fs.readFileSync(capabilityFile, "utf8"));
const permissions = new Set(capability.permissions || []);
const invokedCommands = [...new Set(
  [...script.matchAll(/\binvoke\("([a-z][a-z0-9_]*)"/g)].map(match => match[1])
)];
const missingCommandPermissions = invokedCommands
  .map(command => `allow-${command.replaceAll("_", "-")}`)
  .filter(permission => !permissions.has(permission));
if (missingCommandPermissions.length) {
  throw new Error(
    `Frontend validation failed: Tauri ACL permissions are missing: ${missingCommandPermissions.join(", ")}`
  );
}

const requiredWindowPermissions = [
  ['runWindowAction("minimize")', "core:window:allow-minimize"],
  ['runWindowAction("toggleMaximize")', "core:window:allow-toggle-maximize"],
  ["current.isMaximized(", "core:window:allow-is-maximized"],
  ['runWindowAction("close")', "core:window:allow-close"],
  ["current.startResizeDragging(", "core:window:allow-start-resize-dragging"]
];
const missingWindowPermissions = requiredWindowPermissions
  .filter(([signature, permission]) => script.includes(signature) && !permissions.has(permission))
  .map(([, permission]) => permission);
if (missingWindowPermissions.length) {
  throw new Error(
    `Frontend validation failed: Tauri window permissions are missing: ${missingWindowPermissions.join(", ")}`
  );
}

const removedExportAllFeatures = ["settingsExportButton", "exportAccountsButton", "exportAllAccounts"];
const retainedExportAllFeatures = removedExportAllFeatures.filter(value => html.includes(value) || script.includes(value));
if (retainedExportAllFeatures.length) {
  throw new Error(
    `Frontend validation failed: removed export-all controls remain: ${retainedExportAllFeatures.join(", ")}`
  );
}

console.log("Prismeter frontend validated; no files were regenerated.");
