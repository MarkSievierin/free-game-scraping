const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildIncompleteGamesMessage,
  createIncompleteGamesReporter,
} = require("../src/application/incomplete-games-reporter");

const INCOMPLETE_GAMES = [
  {
    game: {
      store: "epic",
      appId: "sker-ritual-aac702",
      title: "Sker <Ritual>",
      link: "https://store.epicgames.com/ru/p/sker-ritual-aac702",
    },
    missingFields: ["description", "offerEndsAt"],
  },
  {
    game: {
      store: "steam",
      appId: "123",
      title: "No Link",
    },
    missingFields: ["link", "imageUrl"],
  },
];

test("builds one escaped report listing every incomplete game", () => {
  assert.equal(
    buildIncompleteGamesMessage({ incompleteGames: INCOMPLETE_GAMES, serverType: "prod" }),
    [
      "⚠️ <b>Не опубликовано: не хватает данных</b> (prod)",
      "",
      "• <b>Sker &lt;Ritual&gt;</b> (epic) — нет: описание, дата окончания",
      "https://store.epicgames.com/ru/p/sker-ritual-aac702",
      "",
      "• <b>No Link</b> (steam) — нет: ссылка, картинка",
    ].join("\n"),
  );
});

test("sends a single report to the dev chat even in prod", async () => {
  const calls = [];
  const reportIncompleteGames = createIncompleteGamesReporter({
    env: {
      APP_TYPE: "prod",
      CHAT_ID_DEV: "-5193737797",
    },
    telegramClient: {
      async sendMessage(dto) {
        calls.push(dto.toPayload());
      },
    },
  });

  await reportIncompleteGames(INCOMPLETE_GAMES);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].chat_id, "-5193737797");
  assert.equal(calls[0].parse_mode, "HTML");
  assert.equal(calls[0].disable_web_page_preview, "true");
  assert.match(calls[0].text, /^⚠️ <b>Не опубликовано: не хватает данных<\/b> \(prod\)/u);
});

test("does nothing when there are no incomplete games", async () => {
  const calls = [];
  const reportIncompleteGames = createIncompleteGamesReporter({
    env: { CHAT_ID_DEV: "-5193737797" },
    telegramClient: {
      async sendMessage() {
        calls.push(true);
      },
    },
  });

  await reportIncompleteGames([]);

  assert.deepEqual(calls, []);
});

test("logs and continues when the dev chat is not configured or sending fails", async (t) => {
  const errors = [];
  t.mock.method(console, "error", (message) => errors.push(message));

  await createIncompleteGamesReporter({ env: { APP_TYPE: "prod" } })(INCOMPLETE_GAMES);
  await createIncompleteGamesReporter({
    env: { APP_TYPE: "stage", CHAT_ID_DEV: "-5193737797" },
    telegramClient: {
      async sendMessage() {
        throw new Error("Bad Request");
      },
    },
  })(INCOMPLETE_GAMES);

  assert.equal(errors.length, 2);
  assert.match(errors[0], /BOT_TOKEN_DEV or CHAT_ID_DEV is missing/);
  assert.match(errors[1], /Bad Request/);
});
