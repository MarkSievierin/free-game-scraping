const assert = require("node:assert/strict");
const test = require("node:test");

const { buildGameUuid } = require("../src/domain/free-game");
const { fetchEpicCatalog } = require("../src/infrastructure/sources/epic/epic.catalog.client");
const {
  buildEpicCatalogUrl,
  parseEpicGamesFromCatalog,
} = require("../src/infrastructure/sources/epic/epic-catalog.source");

const NOW = new Date("2026-10-27T12:00:00.000Z");

// Trimmed from a real freeGamesPromotions response (locale=ru-RU, country=UA).
function buildSkerRitualElement(overrides = {}) {
  return {
    title: "Sker Ritual",
    id: "6aab3ddef4f84fbc9dd81c60f9d8549c",
    namespace: "156c17659ff0468bb533eba104a1f19f",
    description:
      "The round-based co-op survival FPS and spin-off to the award-winning British horror, Maid of Sker.",
    offerType: "BASE_GAME",
    keyImages: [
      {
        type: "OfferImageWide",
        url: "https://cdn1.epicgames.com/spt-assets/43d96f4437e34c87b7eff08831d1b1de/sker-ritual-1tuka.png",
      },
      {
        type: "Thumbnail",
        url: "https://cdn1.epicgames.com/spt-assets/43d96f4437e34c87b7eff08831d1b1de/sker-ritual-1cyza.png",
      },
    ],
    productSlug: null,
    urlSlug: "8dbc8d70481d4c0b8412d3aec76a35a1",
    url: null,
    categories: [
      { path: "freegames" },
      { path: "games/edition/base" },
      { path: "games/edition" },
      { path: "games" },
    ],
    catalogNs: {
      mappings: [{ pageSlug: "sker-ritual-aac702", pageType: "productHome" }],
    },
    offerMappings: [{ pageSlug: "sker-ritual-aac702", pageType: "productHome" }],
    price: {
      totalPrice: {
        discountPrice: 0,
        originalPrice: 45900,
        currencyCode: "UAH",
        currencyInfo: { decimals: 2 },
        fmtPrice: {
          originalPrice: "459,00 ₴",
          discountPrice: "0",
        },
      },
    },
    promotions: {
      promotionalOffers: [
        {
          promotionalOffers: [
            {
              startDate: "2026-10-22T15:00:00.000Z",
              endDate: "2026-10-29T15:00:00.000Z",
              discountSetting: { discountType: "PERCENTAGE", discountPercentage: 0 },
            },
          ],
        },
      ],
      upcomingPromotionalOffers: [],
    },
    ...overrides,
  };
}

function buildPayload(elements) {
  return {
    data: {
      Catalog: {
        searchStore: {
          elements,
        },
      },
    },
  };
}

function withPromotion(promotion) {
  return {
    promotionalOffers: [{ promotionalOffers: [promotion] }],
    upcomingPromotionalOffers: [],
  };
}

test("Epic parser maps an active giveaway from freeGamesPromotions to the game contract", () => {
  const games = parseEpicGamesFromCatalog(buildPayload([buildSkerRitualElement()]), {
    now: NOW,
    locale: "ru-RU",
  });

  assert.equal(games.length, 1);
  assert.equal(games[0].store, "epic");
  assert.equal(games[0].appId, "sker-ritual-aac702");
  assert.equal(games[0].title, "Sker Ritual");
  assert.match(games[0].description, /^The round-based co-op survival FPS/);
  assert.equal(games[0].link, "https://store.epicgames.com/ru/p/sker-ritual-aac702");
  assert.equal(
    games[0].imageUrl,
    "https://cdn1.epicgames.com/spt-assets/43d96f4437e34c87b7eff08831d1b1de/sker-ritual-1tuka.png",
  );
  assert.equal(games[0].discount, "-100%");
  assert.equal(games[0].price, "Бесплатно");
  assert.equal(games[0].originalPrice, "459,00 ₴");
  assert.equal(games[0].offerEndsAt, "29.10.2026 в 16:00");
  assert.equal(buildGameUuid(games[0]), "epic:sker-ritual-aac702");
});

test("Epic parser skips paid games, discounts, upcoming giveaways and add-ons", () => {
  const paidElement = buildSkerRitualElement({
    title: "Luftrausers",
    catalogNs: { mappings: [{ pageSlug: "luftrausers-51e5e9", pageType: "productHome" }] },
    price: { totalPrice: { discountPrice: 18400, originalPrice: 18400 } },
    promotions: null,
  });
  const discountedElement = buildSkerRitualElement({
    title: "Sorry We're Closed",
    catalogNs: { mappings: [{ pageSlug: "sorry-were-closed-724c86", pageType: "productHome" }] },
    price: { totalPrice: { discountPrice: 32130, originalPrice: 45900 } },
    promotions: {
      promotionalOffers: [
        {
          promotionalOffers: [
            {
              startDate: "2026-10-19T15:00:00.000Z",
              endDate: "2026-11-02T16:00:00.000Z",
              discountSetting: { discountType: "PERCENTAGE", discountPercentage: 70 },
            },
          ],
        },
      ],
      upcomingPromotionalOffers: [
        {
          promotionalOffers: [
            {
              startDate: "2026-10-29T15:00:00.000Z",
              endDate: "2026-11-05T16:00:00.000Z",
              discountSetting: { discountType: "PERCENTAGE", discountPercentage: 0 },
            },
          ],
        },
      ],
    },
  });
  const nonZeroPromotionElement = buildSkerRitualElement({
    title: "Zero Price Without Giveaway",
    catalogNs: { mappings: [{ pageSlug: "zero-price", pageType: "productHome" }] },
    promotions: withPromotion({
      startDate: "2026-10-22T15:00:00.000Z",
      endDate: "2026-10-29T15:00:00.000Z",
      discountSetting: { discountType: "PERCENTAGE", discountPercentage: 50 },
    }),
  });
  const notStartedElement = buildSkerRitualElement({
    title: "Not Started Yet",
    catalogNs: { mappings: [{ pageSlug: "not-started", pageType: "productHome" }] },
    promotions: withPromotion({
      startDate: "2026-10-29T15:00:00.000Z",
      endDate: "2026-11-05T15:00:00.000Z",
      discountSetting: { discountType: "PERCENTAGE", discountPercentage: 0 },
    }),
  });
  const addOnElement = buildSkerRitualElement({
    title: "Lost Castle: The Old Ones Awaken",
    offerType: "ADD_ON",
    categories: [{ path: "addons" }, { path: "freegames" }, { path: "addons/durable" }],
    catalogNs: { mappings: [{ pageSlug: "lost-castle-abb2e2", pageType: "productHome" }] },
  });

  const games = parseEpicGamesFromCatalog(
    buildPayload([
      paidElement,
      discountedElement,
      nonZeroPromotionElement,
      notStartedElement,
      addOnElement,
    ]),
    { now: NOW, locale: "ru-RU" },
  );

  assert.deepEqual(games, []);
});

test("Epic parser drops a giveaway once its promotion has ended", () => {
  const games = parseEpicGamesFromCatalog(buildPayload([buildSkerRitualElement()]), {
    now: new Date("2026-10-29T15:00:00.000Z"),
    locale: "ru-RU",
  });

  assert.deepEqual(games, []);
});

test("Epic promotions URL carries locale, country and allowed countries", () => {
  const url = new URL(
    buildEpicCatalogUrl({
      locale: "en-US",
      country: "US",
      allowCountries: "US",
      endpoint: "https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions",
    }),
  );

  assert.equal(url.hostname, "store-site-backend-static-ipv4.ak.epicgames.com");
  assert.equal(url.pathname, "/freeGamesPromotions");
  assert.equal(url.searchParams.get("locale"), "en-US");
  assert.equal(url.searchParams.get("country"), "US");
  assert.equal(url.searchParams.get("allowCountries"), "US");
});

async function withStubbedFetch(response, callback) {
  const previousFetch = global.fetch;
  global.fetch = async () => response;

  try {
    await callback();
  } finally {
    global.fetch = previousFetch;
  }
}

function buildJsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return body;
    },
  };
}

test("Epic client returns the promotions payload", async () => {
  const payload = buildPayload([buildSkerRitualElement()]);

  await withStubbedFetch(buildJsonResponse(payload), async () => {
    assert.deepEqual(await fetchEpicCatalog({ locale: "ru-RU", country: "UA" }), payload);
  });
});

test("Epic client fails on HTTP errors, payload errors and unexpected shapes", async () => {
  await withStubbedFetch(buildJsonResponse({}, { ok: false, status: 403 }), async () => {
    await assert.rejects(fetchEpicCatalog(), /HTTP 403/);
  });

  await withStubbedFetch(
    buildJsonResponse({ errors: [{ message: "Something went wrong" }], data: null }),
    async () => {
      await assert.rejects(fetchEpicCatalog(), /Something went wrong/);
    },
  );

  await withStubbedFetch(buildJsonResponse({ data: { Catalog: null } }), async () => {
    await assert.rejects(fetchEpicCatalog(), /searchStore\.elements/);
  });
});
