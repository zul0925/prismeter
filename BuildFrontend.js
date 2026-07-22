const fs = require("fs");
const path = require("path");

// The maintained frontend now lives directly in ./frontend.  This command is
// intentionally a validator: older revisions regenerated it from a 0.7.7
// prototype and silently discarded newer UI and native-window fixes.
const frontend = path.join(__dirname, "frontend");
const required = ["index.html", "styles.css", "app.js"];

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
