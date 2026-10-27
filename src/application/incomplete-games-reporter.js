const { normalizeServerType } = require("../config/runtime.config");
const { buildGameUuid, normalizeStore } = require("../domain/free-game");
const { buildTelegramMessageRequestDto } = require("../infrastructure/telegram/telegram-message.dto");
const { TelegramClient } = require("../infrastructure/telegram/telegram.client");
const { escapeTelegramHtml } = require("../shared/telegram-html");

// Keeps the report under Telegram's 4096-character message limit.
const MAX_REPORTED_GAMES = 15;

const GAME_FIELD_LABELS = {
  title: "название",
  link: "ссылка",
  imageUrl: "картинка",
  description: "описание",
  offerEndsAt: "дата окончания",
};

function getGameLabel(game) {
  return String(game?.title || "").trim() || buildGameUuid(game || {}) || "Без названия";
}

function buildIncompleteGameLines({ game, missingFields }) {
  const store = normalizeStore(game?.store);
  const missingLabels = missingFields.map((field) => GAME_FIELD_LABELS[field] || field);
  const lines = [
    `• <b>${escapeTelegramHtml(getGameLabel(game))}</b>` +
      `${store ? ` (${escapeTelegramHtml(store)})` : ""} — нет: ${escapeTelegramHtml(missingLabels.join(", "))}`,
  ];
  const link = String(game?.link || "").trim();

  if (link) {
    lines.push(escapeTelegramHtml(link));
  }

  return lines;
}

function buildIncompleteGamesMessage({ incompleteGames, serverType }) {
  const lines = [
    `⚠️ <b>Не опубликовано: не хватает данных</b> (${escapeTelegramHtml(normalizeServerType(serverType))})`,
  ];

  for (const incompleteGame of incompleteGames.slice(0, MAX_REPORTED_GAMES)) {
    lines.push("");
    lines.push(...buildIncompleteGameLines(incompleteGame));
  }

  if (incompleteGames.length > MAX_REPORTED_GAMES) {
    lines.push("");
    lines.push(`…и ещё ${incompleteGames.length - MAX_REPORTED_GAMES}`);
  }

  return lines.join("\n");
}

// Unlike the error reporter this also works in prod: skipped posts are content, not stage noise.
function createIncompleteGamesReporter({ env = process.env, telegramClient } = {}) {
  const serverType = normalizeServerType(env.APP_TYPE);
  const botToken = env.BOT_TOKEN_DEV;
  const chatId = env.CHAT_ID_DEV;
  const client = telegramClient || (botToken ? new TelegramClient({ botToken }) : null);

  return async (incompleteGames) => {
    if (!Array.isArray(incompleteGames) || incompleteGames.length === 0) {
      return;
    }

    if (!client || !chatId) {
      console.error("Incomplete games report is not configured: BOT_TOKEN_DEV or CHAT_ID_DEV is missing.");
      return;
    }

    try {
      await client.sendMessage(
        buildTelegramMessageRequestDto({
          chatId,
          text: buildIncompleteGamesMessage({ incompleteGames, serverType }),
          parseMode: "HTML",
          disableWebPagePreview: true,
        }),
      );
    } catch (error) {
      console.error(`Incomplete games report failed: ${error.message}`);
    }
  };
}

module.exports = {
  buildIncompleteGamesMessage,
  createIncompleteGamesReporter,
};
