const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildEndedText,
  cleanupStaleFreeGameMessages,
} = require("../src/application/cleanup-stale-free-game-messages");

async function withChannelUsername(username, callback) {
  const previousUsername = process.env.TELEGRAM_CHANNEL_USERNAME;

  if (username === undefined) {
    delete process.env.TELEGRAM_CHANNEL_USERNAME;
  } else {
    process.env.TELEGRAM_CHANNEL_USERNAME = username;
  }

  try {
    await callback();
  } finally {
    if (previousUsername === undefined) {
      delete process.env.TELEGRAM_CHANNEL_USERNAME;
    } else {
      process.env.TELEGRAM_CHANNEL_USERNAME = previousUsername;
    }
  }
}

function createFakeTelegramClient(calls) {
  return {
    async deleteMessage(payload) {
      calls.push({ method: "deleteMessage", payload });
    },
    async editMessageText(payload) {
      calls.push({ method: "editMessageText", payload });
    },
    async editMessageCaption(payload) {
      calls.push({ method: "editMessageCaption", payload });
    },
  };
}

function createRepositoryForActiveGame(game, calls) {
  return {
    async findActiveGamesMissingFromCurrent({ currentGameUuids, enabledStores }) {
      calls.push({ method: "findActiveGamesMissingFromCurrent", currentGameUuids, enabledStores });

      if (currentGameUuids.includes(game.uuid)) {
        return [];
      }

      return [game];
    },
    async markGameDeleted(id) {
      calls.push({ method: "markGameDeleted", id });
    },
    async markGameEnded(id) {
      calls.push({ method: "markGameEnded", id });
    },
    async markGameDeleteFailed(id) {
      calls.push({ method: "markGameDeleteFailed", id });
    },
    async markGameEditFailed(id) {
      calls.push({ method: "markGameEditFailed", id });
    },
  };
}

test("cleanup does not end an Epic game while its UUID is still present in listing", async () => {
  const calls = [];
  const game = {
    id: 1,
    uuid: "epic:listed-game",
    type: "epic",
    title: "Listed Game",
    chat_id: 123,
    telegram_message_id: 456,
    telegram_message_kind: "message",
    message_created_at: "2020-01-01T00:00:00.000Z",
  };

  await cleanupStaleFreeGameMessages({
    telegramClient: createFakeTelegramClient(calls),
    actualFreeGamesRepository: createRepositoryForActiveGame(game, calls),
    currentGameUuids: ["epic:listed-game"],
    enabledStores: ["epic"],
    allowCleanup: true,
  });

  assert.deepEqual(
    calls.map((call) => call.method),
    ["findActiveGamesMissingFromCurrent"],
  );
});

test("cleanup edits an old Epic message only when game is absent from listing", async () => {
  const calls = [];
  const game = {
    id: 2,
    uuid: "epic:missing-game",
    type: "epic",
    title: "Missing Game",
    link: "https://store.epicgames.com/ru/p/missing-game",
    discount_ends_at: "29.10.2026 в 16:00",
    chat_id: 123,
    telegram_message_id: 456,
    telegram_message_kind: "message",
    message_created_at: "2020-01-01T00:00:00.000Z",
  };

  await withChannelUsername("free_games7722", () =>
    cleanupStaleFreeGameMessages({
      telegramClient: createFakeTelegramClient(calls),
      actualFreeGamesRepository: createRepositoryForActiveGame(game, calls),
      currentGameUuids: [],
      enabledStores: ["epic"],
      allowCleanup: true,
    }),
  );

  assert.deepEqual(
    calls.map((call) => call.method),
    ["findActiveGamesMissingFromCurrent", "editMessageText", "markGameEnded"],
  );
  assert.equal(
    calls[1].payload.text,
    "<s><b>Missing Game</b></s>\n⛔ Раздача завершилась 29.10.2026\n\n🎮 Больше бесплатных игр: @free_games7722",
  );
  assert.deepEqual(calls[1].payload.replyMarkup, { inline_keyboard: [] });
  assert.doesNotMatch(calls[1].payload.text, /store\.epicgames\.com/);
  assert.equal(calls[2].id, 2);
});

test("cleanup deletes a fresh stale message when game is absent from listing", async () => {
  const calls = [];
  const game = {
    id: 3,
    uuid: "epic:fresh-missing-game",
    type: "epic",
    title: "Fresh Missing Game",
    chat_id: 123,
    telegram_message_id: 456,
    telegram_message_kind: "photo",
    message_created_at: new Date().toISOString(),
  };

  await cleanupStaleFreeGameMessages({
    telegramClient: createFakeTelegramClient(calls),
    actualFreeGamesRepository: createRepositoryForActiveGame(game, calls),
    currentGameUuids: [],
    enabledStores: ["epic"],
    allowCleanup: true,
  });

  assert.deepEqual(
    calls.map((call) => call.method),
    ["findActiveGamesMissingFromCurrent", "deleteMessage", "markGameDeleted"],
  );
  assert.deepEqual(calls[1].payload, {
    chatId: 123,
    messageId: 456,
  });
});

test("cleanup is skipped when cleanup is disabled", async () => {
  const calls = [];

  await cleanupStaleFreeGameMessages({
    telegramClient: createFakeTelegramClient(calls),
    actualFreeGamesRepository: createRepositoryForActiveGame({ uuid: "epic:any" }, calls),
    currentGameUuids: [],
    enabledStores: ["epic"],
    allowCleanup: false,
  });

  assert.deepEqual(calls, []);
});

test("cleanup edits an old photo post caption to the short ended view", async () => {
  const calls = [];
  const game = {
    id: 4,
    uuid: "steam:123",
    type: "steam",
    title: "Old <Steam> Game",
    link: "https://store.steampowered.com/app/123/",
    discount_ends_at: "27 августа в 17:00",
    chat_id: 123,
    telegram_message_id: 789,
    telegram_message_kind: "photo",
    message_created_at: "2020-08-20T10:00:00.000Z",
  };

  await withChannelUsername(undefined, () =>
    cleanupStaleFreeGameMessages({
      telegramClient: createFakeTelegramClient(calls),
      actualFreeGamesRepository: createRepositoryForActiveGame(game, calls),
      currentGameUuids: [],
      enabledStores: ["steam"],
      allowCleanup: true,
    }),
  );

  assert.deepEqual(
    calls.map((call) => call.method),
    ["findActiveGamesMissingFromCurrent", "editMessageCaption", "markGameEnded"],
  );
  assert.equal(
    calls[1].payload.caption,
    "<s><b>Old &lt;Steam&gt; Game</b></s>\n⛔ Раздача завершилась 27.08.2020",
  );
  assert.deepEqual(calls[1].payload.replyMarkup, { inline_keyboard: [] });
});

test("ended text anchors a yearless Steam date to the post date", async () => {
  await withChannelUsername(undefined, () => {
    assert.equal(
      buildEndedText({
        title: "Year End Sale",
        discount_ends_at: "3 января в 9:00",
        message_created_at: new Date("2025-12-28T12:00:00.000Z"),
      }),
      "<s><b>Year End Sale</b></s>\n⛔ Раздача завершилась 03.01.2026",
    );
  });
});

test("ended text omits the date when the stored value cannot be parsed", async () => {
  await withChannelUsername("free_games7722", () => {
    assert.equal(
      buildEndedText({
        title: "Unknown End",
        discount_ends_at: "дату не видно, забирай скорее",
        created_at: "2026-01-01T00:00:00.000Z",
      }),
      "<s><b>Unknown End</b></s>\n⛔ Раздача завершилась\n\n🎮 Больше бесплатных игр: @free_games7722",
    );
  });
});
