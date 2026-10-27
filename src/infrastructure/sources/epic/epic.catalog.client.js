const { buildEpicCatalogUrl } = require("./epic.catalog.config");

const EPIC_REQUEST_TIMEOUT_MS = 30000;

async function fetchEpicCatalog(config) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EPIC_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildEpicCatalogUrl(config), {
      method: "GET",
      headers: { accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Epic promotions request failed with HTTP ${response.status}`);
    }

    const payload = await response.json();

    if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
      throw new Error(`Epic promotions error: ${payload.errors[0]?.message || "unknown error"}`);
    }

    // An unexpected shape must fail loudly: an empty result would end every posted Epic game.
    if (!Array.isArray(payload?.data?.Catalog?.searchStore?.elements)) {
      throw new Error("Epic promotions response has no data.Catalog.searchStore.elements");
    }

    return payload;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Epic promotions request timed out after ${EPIC_REQUEST_TIMEOUT_MS}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  EPIC_REQUEST_TIMEOUT_MS,
  fetchEpicCatalog,
};
