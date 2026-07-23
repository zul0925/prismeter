const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "frontend", "app.js"), "utf8");

function requireSource(pattern, message) {
  if (!pattern.test(source)) throw new Error(`Startup isolation check failed: ${message}`);
}

requireSource(/products:\s*\{\}/, "provider product state must be initialized before bootstrap");
requireSource(/interfaceLanguagePreference:\s*"system"/, "the initial language preference must follow the system");
requireSource(/if\s*\(!state\.languagePreferenceInitialized\)/, "backend language may only initialize the window preference once");
requireSource(/runUiStateStep\("navigation",\s*renderNavigation\)/, "connected-account navigation rendering must be isolated");
requireSource(/runUiStateStep\("overview",\s*renderOverview\)/, "overview rendering must be isolated");
requireSource(/syncDesktopPreferences\(payload\.settings\)\.catch/, "desktop preferences must not block backend-state rendering");
requireSource(/get_system_locale/, "system language must be resolved by the desktop runtime");

const loaderStart = source.indexOf("async function loadBackendState");
const loaderEnd = source.indexOf("\nfunction monitoringSummary", loaderStart);
const loader = source.slice(loaderStart, loaderEnd);
if (/await\s+syncDesktopPreferences/.test(loader)) {
  throw new Error("Startup isolation check failed: desktop preference synchronization blocks backend-state rendering");
}

console.log("Startup state, rendering, and language lifecycles are isolated.");
