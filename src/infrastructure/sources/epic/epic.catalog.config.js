const { normalizeText } = require("../../../shared/text");

// The store GraphQL and product pages sit behind Cloudflare; this public endpoint does not.
const EPIC_PROMOTIONS_ENDPOINT =
  "https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions";
const EPIC_BASE_URL = "https://store.epicgames.com";
const EPIC_DEFAULT_LOCALE = "ru-RU";
const EPIC_DEFAULT_COUNTRY = "UA";

function resolveEpicCatalogConfig({ locale, country, allowCountries, endpoint } = {}) {
  const resolvedLocale = normalizeText(locale || process.env.EPIC_LOCALE) || EPIC_DEFAULT_LOCALE;
  const resolvedCountry = normalizeText(country || process.env.EPIC_COUNTRY) || EPIC_DEFAULT_COUNTRY;
  const resolvedAllowCountries =
    normalizeText(allowCountries || process.env.EPIC_ALLOW_COUNTRIES) || resolvedCountry;

  return {
    locale: resolvedLocale,
    country: resolvedCountry,
    allowCountries: resolvedAllowCountries,
    endpoint:
      normalizeText(endpoint || process.env.EPIC_PROMOTIONS_ENDPOINT) || EPIC_PROMOTIONS_ENDPOINT,
  };
}

function buildEpicCatalogUrl(config) {
  const resolvedConfig = resolveEpicCatalogConfig(config);
  const query = new URLSearchParams({
    locale: resolvedConfig.locale,
    country: resolvedConfig.country,
    allowCountries: resolvedConfig.allowCountries,
  }).toString();

  return `${resolvedConfig.endpoint}?${query}`;
}

module.exports = {
  EPIC_BASE_URL,
  buildEpicCatalogUrl,
  resolveEpicCatalogConfig,
};
