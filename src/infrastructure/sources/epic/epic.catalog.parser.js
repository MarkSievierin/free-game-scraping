const { buildGameUuid } = require("../../../domain/free-game");
const { normalizeText } = require("../../../shared/text");
const { formatOfferEndsAtFromTimestamp } = require("../../../shared/offer-date");
const { EPIC_BASE_URL, resolveEpicCatalogConfig } = require("./epic.catalog.config");

function buildAbsoluteEpicUrl(value) {
  const path = normalizeText(value);

  if (!path) {
    return "";
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    const parsedUrl = new URL(path);

    if (parsedUrl.hostname === "store.epicgames.com") {
      parsedUrl.protocol = "https:";
    }

    return parsedUrl.toString();
  }

  return `${EPIC_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

function extractOfferSlug(link) {
  const match = String(link || "").match(/\/p\/([^/?#]+)/);

  return match ? match[1] : "";
}

function getEpicOfferPageSlug(element) {
  const mappings = [
    ...(Array.isArray(element?.catalogNs?.mappings) ? element.catalogNs.mappings : []),
    ...(Array.isArray(element?.offerMappings) ? element.offerMappings : []),
  ];
  const productHomeMapping = mappings.find(
    (mapping) => mapping?.pageType === "productHome" && mapping?.pageSlug,
  );

  return normalizeText(
    productHomeMapping?.pageSlug ||
      element?.productSlug ||
      element?.urlSlug ||
      element?.id,
  );
}

function getActiveFreePromotion(element, now = new Date()) {
  const nowTimestamp = now.getTime();
  const promotionGroups = element?.promotions?.promotionalOffers || [];

  for (const group of promotionGroups) {
    for (const promotion of group?.promotionalOffers || []) {
      const startTimestamp = Date.parse(promotion?.startDate);
      const endTimestamp = Date.parse(promotion?.endDate);

      // discountPercentage is the share of the price left to pay, so 0 means a giveaway.
      if (
        promotion?.discountSetting?.discountPercentage === 0 &&
        startTimestamp <= nowTimestamp &&
        nowTimestamp < endTimestamp
      ) {
        return promotion;
      }
    }
  }

  return null;
}

function getEpicImageUrl(element) {
  const images = Array.isArray(element?.keyImages) ? element.keyImages : [];
  const preferredImageTypes = ["OfferImageWide", "OfferImageTall", "Thumbnail", "OfferImage"];

  for (const imageType of preferredImageTypes) {
    const image = images.find((candidate) => candidate?.type === imageType && candidate?.url);

    if (image) {
      return normalizeText(image.url);
    }
  }

  return normalizeText(images.find((image) => image?.url)?.url || "");
}

function getEpicOriginalPrice(element) {
  const formattedPrice = element?.price?.totalPrice?.fmtPrice?.originalPrice;

  if (formattedPrice) {
    return normalizeText(formattedPrice);
  }

  const originalPrice = element?.price?.totalPrice?.originalPrice;
  const decimals = element?.price?.totalPrice?.currencyInfo?.decimals;

  if (typeof originalPrice !== "number") {
    return "";
  }

  const divisor = 10 ** (Number.isInteger(decimals) ? decimals : 2);

  return String(originalPrice / divisor);
}

function getEpicTags(element) {
  const productType = normalizeText(element?.offerType) === "BASE_GAME" ? "Game" : "";

  return productType ? [productType] : [];
}

function isGameCatalogElement(element) {
  const categories = Array.isArray(element?.categories) ? element.categories : [];
  const categoryPaths = categories
    .map((category) => normalizeText(category?.path).toLowerCase())
    .filter(Boolean);

  return categoryPaths.some((path) => path === "games" || path.startsWith("games/"));
}

function mapEpicCatalogElement(element, promotion, locale) {
  const catalogPath = normalizeText(element?.url);
  const fallbackSlug = getEpicOfferPageSlug(element);
  const fallbackLocale = locale.toLowerCase() === "ru-ru" ? "ru" : locale;
  const link = buildAbsoluteEpicUrl(catalogPath || `/${fallbackLocale}/p/${fallbackSlug}`);
  const appId = extractOfferSlug(link) || fallbackSlug;

  if (!appId || !normalizeText(element?.title)) {
    return null;
  }

  const productType =
    normalizeText(element?.offerType) === "BASE_GAME"
      ? "Game"
      : normalizeText(element?.offerType || "Game");
  const tags = getEpicTags(element);

  if (productType && !tags.includes(productType)) {
    tags.unshift(productType);
  }

  return {
    appId,
    store: "epic",
    catalogPath: catalogPath || `/${fallbackLocale}/p/${appId}`,
    productType,
    title: normalizeText(element.title),
    discount: "-100%",
    price: "Бесплатно",
    originalPrice: getEpicOriginalPrice(element),
    link,
    imageUrl: getEpicImageUrl(element),
    description: normalizeText(element.description || element.longDescription || ""),
    genres: [],
    tags,
    offerEndsAt: formatOfferEndsAtFromTimestamp(promotion.endDate),
  };
}

function parseEpicGamesFromCatalog(payload, { now = new Date(), locale } = {}) {
  const elements = payload?.data?.Catalog?.searchStore?.elements;
  const resolvedLocale = normalizeText(locale) || resolveEpicCatalogConfig().locale;
  const gamesByUuid = new Map();

  if (!Array.isArray(elements)) {
    return [];
  }

  for (const element of elements) {
    const promotion = getActiveFreePromotion(element, now);

    if (
      element?.price?.totalPrice?.discountPrice !== 0 ||
      !promotion ||
      !isGameCatalogElement(element)
    ) {
      continue;
    }

    const game = mapEpicCatalogElement(element, promotion, resolvedLocale);

    if (game) {
      gamesByUuid.set(buildGameUuid(game), game);
    }
  }

  return [...gamesByUuid.values()];
}

module.exports = {
  buildAbsoluteEpicUrl,
  extractOfferSlug,
  getActiveFreePromotion,
  getEpicOfferPageSlug,
  parseEpicGamesFromCatalog,
};
