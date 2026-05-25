const cheerio = require("cheerio");
const { chromium } = require("playwright");
const { buildGameUuid } = require("../storage/actual-free-games.repository");

const EPIC_BROWSE_URL =
  "https://store.epicgames.com/ru/browse?sortBy=currentPrice&sortDir=ASC&priceTier=tierDiscouted&category=Game&count=40";
const EPIC_BASE_URL = "https://store.epicgames.com";
const EPIC_AGE_GATE_COOKIE = {
  name: "egs_age_gate_dob",
  value: "1904-2-3",
  domain: "store.epicgames.com",
  path: "/",
  httpOnly: false,
  secure: true,
  sameSite: "Lax",
};
const EPIC_PAGE_TIMEOUT_MS = 10000;
const EPIC_RENDER_DELAY_MS = 12000;
const EPIC_DETAIL_RENDER_DELAY_MS = 8000;
const EPIC_DETAIL_PROCESS_TIMEOUT_MS = 30000;
const EPIC_DETAIL_VISIT_DELAY_MIN_MS = 2500;
const EPIC_DETAIL_VISIT_DELAY_MAX_MS = 4500;
const EPIC_POST_CATALOG_DELAY_MIN_MS = 2000;
const EPIC_POST_CATALOG_DELAY_MAX_MS = 4000;
const EPIC_CATALOG_SCROLL_MIN_PX = 260;
const EPIC_CATALOG_SCROLL_MAX_PX = 460;
const EPIC_DETAIL_SCROLL_MIN_PX = 420;
const EPIC_DETAIL_SCROLL_MAX_PX = 760;

function resolveBooleanEnv(value, defaultValue) {
  const normalizedValue = String(value || "").trim().toLowerCase();

  if (!normalizedValue) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(normalizedValue);
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getViewportSize(page) {
  return page.viewportSize() || { width: 1440, height: 900 };
}

async function moveMouseToRandomCatalogPoints(page, moves = getRandomInt(3, 5)) {
  const viewport = getViewportSize(page);

  for (let index = 0; index < moves; index += 1) {
    const x = getRandomInt(Math.round(viewport.width * 0.12), Math.round(viewport.width * 0.86));
    const y = getRandomInt(Math.round(viewport.height * 0.18), Math.round(viewport.height * 0.78));

    await page.mouse.move(x, y, { steps: getRandomInt(12, 28) });
    await page.waitForTimeout(getRandomInt(120, 360));
  }
}

async function wheelInSmallSteps(page, deltaY) {
  const steps = getRandomInt(2, 4);
  const stepDelta = deltaY / steps;

  for (let index = 0; index < steps; index += 1) {
    await page.mouse.wheel(0, stepDelta + getRandomInt(-18, 18));
    await page.waitForTimeout(getRandomInt(130, 300));
  }
}

async function returnCatalogToTop(page) {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  await page.waitForTimeout(getRandomInt(650, 1100));
}

async function performEpicCatalogWarmup(page) {
  await moveMouseToRandomCatalogPoints(page);
  await page.waitForTimeout(getRandomInt(250, 600));

  const scrollDelta = getRandomInt(EPIC_CATALOG_SCROLL_MIN_PX, EPIC_CATALOG_SCROLL_MAX_PX);
  await wheelInSmallSteps(page, scrollDelta);
  await page.waitForTimeout(getRandomInt(450, 900));
  await wheelInSmallSteps(page, -scrollDelta);
  await returnCatalogToTop(page);
  await moveMouseToRandomCatalogPoints(page, getRandomInt(1, 2));
}

async function performEpicDetailVisitActivity(page) {
  await page.waitForTimeout(
    getRandomInt(EPIC_DETAIL_VISIT_DELAY_MIN_MS, EPIC_DETAIL_VISIT_DELAY_MAX_MS),
  );
  await moveMouseToRandomCatalogPoints(page, getRandomInt(2, 4));

  const firstScrollDelta = getRandomInt(EPIC_DETAIL_SCROLL_MIN_PX, EPIC_DETAIL_SCROLL_MAX_PX);
  await wheelInSmallSteps(page, firstScrollDelta);
  await page.waitForTimeout(getRandomInt(900, 1700));
  await moveMouseToRandomCatalogPoints(page, getRandomInt(1, 3));

  const secondScrollDelta = getRandomInt(
    Math.round(EPIC_DETAIL_SCROLL_MIN_PX * 0.45),
    Math.round(EPIC_DETAIL_SCROLL_MAX_PX * 0.75),
  );
  await wheelInSmallSteps(page, secondScrollDelta);
  await page.waitForTimeout(getRandomInt(700, 1400));
  await wheelInSmallSteps(page, -getRandomInt(180, 360));
  await moveMouseToRandomCatalogPoints(page, getRandomInt(1, 2));
}

function buildAbsoluteEpicUrl(path) {
  if (!path) {
    return "";
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${EPIC_BASE_URL}${path}`;
}

function extractOfferSlug(link) {
  const match = String(link || "").match(/\/p\/([^/?#]+)/);
  return match ? match[1] : "";
}

function extractDiscount(cardText) {
  const match = normalizeText(cardText).match(/-\d+\s*%/);
  return match ? match[0].replace(/\s+/g, "") : "";
}

function extractPriceParts(cardText, discount) {
  const normalizedText = normalizeText(cardText);
  const sanitizedText = discount ? normalizedText.replace(discount, " ") : normalizedText;
  const freePriceMatch = sanitizedText.match(/Бесплатно/i);
  const originalPriceMatch = sanitizedText.match(/\d[\d\s.,]*\s*[^\s]*₴\*?/u);

  return {
    originalPrice: normalizeText(originalPriceMatch?.[0] || ""),
    currentPrice: freePriceMatch ? normalizeText(freePriceMatch[0]) : "",
  };
}

function parseEpicGamesFromHtml(html, { limit } = {}) {
  const $ = cheerio.load(html);
  const games = [];

  $('a[href*="/p/"]').each((_, element) => {
    if (limit && games.length >= limit) {
      return false;
    }

    const card = $(element);
    const cardText = normalizeText(card.text());
    const discount = extractDiscount(cardText);

    if (discount !== "-100%") {
      return;
    }

    const relativeLink = card.attr("href")?.trim() || "";
    const link = buildAbsoluteEpicUrl(relativeLink);
    const image = card.find('img[data-testid="picture-image"]').first();
    const imageUrl = image.attr("src")?.trim() || image.attr("data-image")?.trim() || "";
    const title = normalizeText(image.attr("alt") || "") || "Без названия";
    const productType = normalizeText(card.find("span").first().text());
    const { originalPrice, currentPrice } = extractPriceParts(cardText, discount);

    games.push({
      appId: extractOfferSlug(link),
      store: "epic",
      catalogPath: relativeLink,
      productType,
      title,
      discount,
      price: currentPrice || "Бесплатно",
      originalPrice,
      link,
      imageUrl,
      description: "",
      genres: [],
      tags: productType ? [productType] : [],
      offerEndsAt: "",
    });
  });

  return games;
}

function formatEpicOfferEndsAt(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return normalizeText(value);
  }

  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Berlin",
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.day}.${parts.month}.${parts.year} в ${parts.hour}:${parts.minute}`;
}

function extractOfferEndsAtFromText(value) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return "";
  }

  const saleEndsMatch = normalizedValue.match(
    /Распродажа\s+заканчивается\s+(\d{2}\.\d{2}\.\d{4}(?:\s+в\s+\d{2}:\d{2})?)/i,
  );

  if (!saleEndsMatch) {
    return "";
  }

  return normalizeText(saleEndsMatch[1]);
}

function extractEpicSchemaDetails(schemaRaw) {
  if (!schemaRaw) {
    return {
      description: "",
      offerEndsAt: "",
    };
  }

  try {
    const schema = JSON.parse(schemaRaw);
    const primaryOffer = Array.isArray(schema.offers) ? schema.offers[0] : undefined;

    return {
      description: normalizeText(primaryOffer?.description || ""),
      offerEndsAt: formatEpicOfferEndsAt(primaryOffer?.priceValidUntil || ""),
    };
  } catch (error) {
    console.error(`Epic schema parse failed: ${error.message}`);

    return {
      description: "",
      offerEndsAt: "",
    };
  }
}

async function fetchEpicGameDetails(detailPage, game) {
  if (!game.link) {
    return {
      description: "",
      offerEndsAt: "",
    };
  }

  return Promise.race([
    (async () => {
      await detailPage.waitForTimeout(EPIC_DETAIL_RENDER_DELAY_MS);
      await performEpicDetailVisitActivity(detailPage);
      const bodyText = await detailPage.evaluate(() => document.body.innerText).catch(() => "");
      const description = await detailPage
        .locator(".css-1myreog")
        .first()
        .textContent()
        .then((value) => normalizeText(value))
        .catch(() => "");
      const schemaRaw = await detailPage
        .locator('script#_schemaOrgMarkup-Product[type="application/ld+json"]')
        .textContent()
        .catch(() => "");
      const schemaDetails = extractEpicSchemaDetails(schemaRaw);

      return {
        description: description || schemaDetails.description,
        offerEndsAt: extractOfferEndsAtFromText(bodyText) || schemaDetails.offerEndsAt,
      };
    })(),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Epic detail page timed out after ${EPIC_DETAIL_PROCESS_TIMEOUT_MS}ms`));
      }, EPIC_DETAIL_PROCESS_TIMEOUT_MS);
    }),
  ]);
}

async function openEpicGameDetailsByCatalogClick({ context, catalogPage, game }) {
  if (!game.catalogPath) {
    const detailPage = await context.newPage();
    await detailPage.goto(game.link, {
      waitUntil: "domcontentloaded",
      timeout: EPIC_PAGE_TIMEOUT_MS,
    });
    return detailPage;
  }

  const selector = `a[href="${game.catalogPath}"]`;
  const gameCard = catalogPage.locator(selector).first();
  await gameCard.waitFor({ state: "visible", timeout: EPIC_PAGE_TIMEOUT_MS });
  await gameCard.scrollIntoViewIfNeeded();

  const box = await gameCard.boundingBox();

  if (!box) {
    throw new Error(`Epic catalog card is not clickable for ${game.title}`);
  }

  const targetX = box.x + Math.min(Math.max(12, box.width * 0.35), box.width - 12);
  const targetY = box.y + Math.min(Math.max(12, box.height * 0.35), box.height - 12);
  const viewport = getViewportSize(catalogPage);
  const approachX = clamp(targetX - getRandomInt(90, 180), 0, viewport.width - 1);
  const approachY = clamp(targetY + getRandomInt(-80, 80), 0, viewport.height - 1);
  const hoverX = clamp(targetX + getRandomInt(-8, 8), 0, viewport.width - 1);
  const hoverY = clamp(targetY + getRandomInt(-8, 8), 0, viewport.height - 1);

  await catalogPage.mouse.move(approachX, approachY, { steps: getRandomInt(18, 32) });
  await catalogPage.waitForTimeout(getRandomInt(180, 420));
  await catalogPage.mouse.move(hoverX, hoverY, { steps: getRandomInt(24, 42) });
  await catalogPage.waitForTimeout(getRandomInt(350, 750));
  await catalogPage.keyboard.down("Control");

  try {
    const detailPagePromise = context.waitForEvent("page", { timeout: EPIC_PAGE_TIMEOUT_MS });
    await catalogPage.mouse.click(hoverX, hoverY, {
      delay: getRandomInt(130, 280),
      button: "left",
    });
    const detailPage = await detailPagePromise;
    await detailPage.waitForLoadState("domcontentloaded", { timeout: EPIC_PAGE_TIMEOUT_MS });
    await detailPage.bringToFront().catch(() => {});
    return detailPage;
  } finally {
    await catalogPage.keyboard.up("Control").catch(() => {});
  }
}

async function enrichEpicGames(games, context, catalogPage) {
  if (games.length === 0) {
    return games;
  }

  const enrichedGames = [];

  for (const game of games) {
    let detailPage;

    try {
      detailPage = await openEpicGameDetailsByCatalogClick({ context, catalogPage, game });
      const details = await fetchEpicGameDetails(detailPage, game);
      enrichedGames.push({
        ...game,
        description: details.description,
        offerEndsAt: details.offerEndsAt,
      });
    } catch (error) {
      console.error(`Epic details fetch failed for ${game.title}: ${error.message}`);
      enrichedGames.push(game);
    } finally {
      await detailPage?.close().catch(() => {});
      await catalogPage.bringToFront().catch(() => {});
    }
  }

  return enrichedGames;
}

async function createEpicBrowser() {
  const executablePath = String(process.env.EPIC_BROWSER_EXECUTABLE_PATH || "").trim();
  const channel = String(process.env.EPIC_BROWSER_CHANNEL || "").trim();
  const headless = resolveBooleanEnv(process.env.EPIC_BROWSER_HEADLESS, true);

  return chromium.launch({
    headless: false,
    ...(executablePath ? { executablePath } : {}),
    ...(!executablePath && channel ? { channel } : {}),
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });
}

async function createEpicContext(browser) {
  const context = await browser.newContext({
    locale: "ru-RU",
    viewport: { width: 1440, height: 900 },
    timezoneId: "Europe/Berlin",
    colorScheme: "dark",
  });

  await context.route("**/*", async (route) => {
    if (route.request().resourceType() === "font") {
      await route.abort();
      return;
    }

    await route.continue();
  });

  return context;
}

async function fetchFreeGames({ limit, knownGameUuids = [] } = {}) {
  const browser = await createEpicBrowser();
  const context = await createEpicContext(browser);

  try {
    await context.addCookies([EPIC_AGE_GATE_COOKIE]);
    const page = await context.newPage();

    await page.goto(EPIC_BROWSE_URL, {
      waitUntil: "domcontentloaded",
      timeout: EPIC_PAGE_TIMEOUT_MS,
    });
    await page.waitForTimeout(EPIC_RENDER_DELAY_MS);
    await page.waitForTimeout(
      getRandomInt(EPIC_POST_CATALOG_DELAY_MIN_MS, EPIC_POST_CATALOG_DELAY_MAX_MS),
    );
    await performEpicCatalogWarmup(page);

    const html = await page.content();
    const catalogGames = parseEpicGamesFromHtml(html);
    const currentGameUuids = catalogGames.map(buildGameUuid).filter(Boolean);
    const knownGameUuidSet = new Set(knownGameUuids);
    const games = catalogGames
      .filter((game) => !knownGameUuidSet.has(buildGameUuid(game)))
      .slice(0, limit || Number.MAX_SAFE_INTEGER);
    const enrichedGames = await enrichEpicGames(games, context, page);

    Object.defineProperty(enrichedGames, "currentGameUuids", {
      value: currentGameUuids,
      enumerable: false,
    });

    return enrichedGames;
  } finally {
    await context.close();
    await browser.close();
  }
}

module.exports = {
  fetchFreeGames,
  parseEpicGamesFromHtml,
};
