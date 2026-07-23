const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "frontend", "app.js"), "utf8");

function requireSource(pattern, message) {
  if (!pattern.test(source)) throw new Error(`Startup isolation check failed: ${message}`);
}

requireSource(/products:\s*\{\}/, "provider product state must be initialized before bootstrap");
requireSource(/backend:\s*\{\s*accounts:\s*\[\],\s*history:\s*\[\],\s*syncEvents:\s*\[\]\s*\}/, "backend state must exist before the initial placeholder render");
requireSource(/interfaceLanguagePreference:\s*"system"/, "the initial language preference must follow the system");
requireSource(/if\s*\(!state\.languagePreferenceInitialized\)/, "backend language may only initialize the window preference once");
requireSource(/runUiStateStep\("navigation",\s*renderNavigation\)/, "connected-account navigation rendering must be isolated");
requireSource(/runUiStateStep\("overview",\s*renderOverview\)/, "overview rendering must be isolated");
requireSource(/syncDesktopPreferences\(payload\.settings\)\.catch/, "desktop preferences must not block backend-state rendering");
requireSource(/get_system_locale/, "system language must be resolved by the desktop runtime");
requireSource(/const\s+backendStatePromise\s*=\s*loadBackendState\(\)/, "backend loading must start before non-critical placeholder rendering");
requireSource(/if\s*\(strictDesktopKeys\.length\)\s*await\s+syncDesktopPreferences\(nextSettings,\s*strictDesktopKeys,\s*strictDesktopKeys\)/, "language-only saves must not invoke unrelated desktop commands");

const loaderStart = source.indexOf("async function loadBackendState");
const loaderEnd = source.indexOf("\nfunction monitoringSummary", loaderStart);
const loader = source.slice(loaderStart, loaderEnd);
if (/await\s+syncDesktopPreferences/.test(loader)) {
  throw new Error("Startup isolation check failed: desktop preference synchronization blocks backend-state rendering");
}
if (/await\s+initializeSystemInterfaceLanguage/.test(source)) {
  throw new Error("Startup isolation check failed: system-locale IPC blocks initial backend-state loading");
}

console.log("Startup state, rendering, and language lifecycles are isolated.");
