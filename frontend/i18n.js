(() => {
  const catalogs = new Map();
  let language = "zh-CN";

  function normalizeLanguage(nextLanguage) {
    return nextLanguage === "en" || String(nextLanguage || "").startsWith("en-") ? "en" : "zh-CN";
  }

  function register(messages) {
    Object.entries(messages || {}).forEach(([locale, catalog]) => {
      catalogs.set(locale, Object.freeze({ ...(catalogs.get(locale) || {}), ...catalog }));
    });
  }

  function setLanguage(nextLanguage) {
    language = normalizeLanguage(nextLanguage);
    document.documentElement.lang = language;
    return language;
  }

  function t(key, values = {}) {
    const source = catalogs.get(language) || {};
    const fallback = catalogs.get("zh-CN") || {};
    const template = source[key] || fallback[key];
    if (!template) {
      console.warn(`Missing i18n message: ${key}`);
      return `[${key}]`;
    }
    return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
  }

  function has(key, locale = language) {
    return Boolean((catalogs.get(normalizeLanguage(locale)) || {})[key]);
  }

  function apply(root = document) {
    const elements = root.matches?.("[data-i18n]") ? [root] : [...root.querySelectorAll?.("[data-i18n]") || []];
    elements.forEach(element => {
      const key = element.dataset.i18n;
      const value = t(key);
      if (element.dataset.i18nContent !== "false") element.textContent = value;
      (element.dataset.i18nAttrs || "").split(",").map(name => name.trim()).filter(Boolean)
        .forEach(name => element.setAttribute(name, value));
    });
  }

  function formatDate(value, options = { month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" }) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(language, options).format(date) : null;
  }

  function formatNumber(value, options = {}) {
    return new Intl.NumberFormat(language, options).format(value);
  }

  window.PrismeterI18n = Object.freeze({ register, setLanguage, get language() { return language; }, t, has, apply, formatDate, formatNumber });
})();
