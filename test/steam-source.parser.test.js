const assert = require("node:assert/strict");
const test = require("node:test");

const {
  parseSteamAppDetails,
  parseSteamPageMetadata,
  parseSteamSearchResults,
} = require("../src/infrastructure/sources/steam/steam.parser");

test("Steam search parser keeps free games and ignores paid games", () => {
  const games = parseSteamSearchResults(`
    <a class="search_result_row" href="https://store.steampowered.com/app/123/Free_Game/">
      <div class="title">Free Game</div>
      <div class="discount_pct">-100%</div>
      <div class="discount_final_price">Бесплатно</div>
      <img src="https://cdn.example/fallback.jpg">
    </a>
    <a class="search_result_row" href="https://store.steampowered.com/app/456/Paid_Game/">
      <div class="title">Paid Game</div>
      <div class="discount_pct">-50%</div>
      <div class="discount_final_price">500 руб.</div>
    </a>
  `);

  assert.deepEqual(games.map((game) => [game.appId, game.title, game.store]), [
    ["123", "Free Game", "steam"],
  ]);
  assert.equal(
    games[0].imageUrl,
    "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/123/header.jpg",
  );
});

test("Steam details parsers normalize API and page metadata", () => {
  const details = parseSteamAppDetails(
    {
      123: {
        success: true,
        data: {
          short_description: "A &amp; B",
          genres: [{ description: "Action" }, { description: "" }],
        },
      },
    },
    "123",
  );
  const pageMetadata = parseSteamPageMetadata(`
    <div class="app_tag">Action</div>
    <div class="app_tag">Action</div>
    <div class="app_tag">Indie</div>
    <div class="game_purchase_discount_quantity">До 27 августа в 17:00</div>
  `, { now: new Date("2026-08-24T12:00:00.000Z") });

  assert.deepEqual(details, {
    type: "",
    baseGameAppId: "",
    isFree: false,
    description: "A & B",
    genres: ["Action"],
  });
  assert.deepEqual(pageMetadata, {
    tags: ["Action", "Indie"],
    offerEndsAt: "27.08.2026 в 17:00",
  });
});

test("Steam page metadata reads abbreviated end dates", () => {
  const pageMetadata = parseSteamPageMetadata(`
    <div class="game_purchase_discount_quantity">Можно приобрести бесплатно до 2 ноя в 10:00.
      Действуют некоторые ограничения. <span class="tooltip">(?)</span></div>
  `, { now: new Date("2026-10-31T12:00:00.000Z") });

  assert.equal(pageMetadata.offerEndsAt, "02.11.2026 в 10:00");
});

test("Steam app details expose DLC base game and free status", () => {
  const dlc = parseSteamAppDetails(
    {
      4693960: {
        success: true,
        data: {
          type: "dlc",
          fullgame: { appid: "2482760", name: "Hunting Simulator 3" },
          is_free: true,
        },
      },
    },
    "4693960",
  );
  const paidGame = parseSteamAppDetails(
    { 2482760: { success: true, data: { type: "game", is_free: false, price_overview: { final: 99900 } } } },
    "2482760",
  );
  const discountedGame = parseSteamAppDetails(
    { 1: { success: true, data: { type: "game", is_free: false, price_overview: { final: 0 } } } },
    "1",
  );

  assert.deepEqual([dlc.type, dlc.baseGameAppId, dlc.isFree], ["dlc", "2482760", true]);
  assert.equal(paidGame.isFree, false);
  assert.equal(discountedGame.isFree, true);
});
