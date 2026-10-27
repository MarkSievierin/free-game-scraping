const { buildEndedGameText } = require("../presentation/telegram/notification.builder");
const { formatOfferEndDate } = require("../shared/offer-date");

const DELETE_MESSAGE_MAX_AGE_MS = 47 * 60 * 60 * 1000;

function getEndedGameDate(game) {
  // Old Steam rows keep "27 августа в 17:00" without a year; the post date anchors the year.
  const referenceDate = new Date(game.message_created_at || game.created_at || "");

  return formatOfferEndDate(game.discount_ends_at, {
    referenceDate: Number.isNaN(referenceDate.getTime()) ? undefined : referenceDate,
  });
}

function buildEndedText(game) {
  return buildEndedGameText({
    title: String(game.title || game.uuid || "Free game").trim(),
    endDate: getEndedGameDate(game),
  });
}

function isFreshEnoughToDelete(game) {
  const createdAt = new Date(game.message_created_at || game.created_at || 0);

  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  return Date.now() - createdAt.getTime() <= DELETE_MESSAGE_MAX_AGE_MS;
}

async function editEndedMessage({ telegramClient, game }) {
  const payload = {
    chatId: game.chat_id,
    messageId: game.telegram_message_id,
    parseMode: "HTML",
    replyMarkup: { inline_keyboard: [] },
  };

  if (game.telegram_message_kind === "photo") {
    return telegramClient.editMessageCaption({
      ...payload,
      caption: buildEndedText(game),
    });
  }

  return telegramClient.editMessageText({
    ...payload,
    text: buildEndedText(game),
  });
}

async function cleanupStaleFreeGameMessages({
  telegramClient,
  actualFreeGamesRepository,
  currentGameUuids,
  enabledStores,
  allowCleanup,
  reportError = async () => {},
}) {
  if (!allowCleanup) {
    console.log("Telegram cleanup skipped.");
    return;
  }

  const staleGames = await actualFreeGamesRepository.findActiveGamesMissingFromCurrent({
    currentGameUuids,
    enabledStores,
  });

  for (const game of staleGames) {
    let attemptedDelete = false;

    try {
      if (isFreshEnoughToDelete(game)) {
        attemptedDelete = true;
        await telegramClient.deleteMessage({
          chatId: game.chat_id,
          messageId: game.telegram_message_id,
        });
        await actualFreeGamesRepository.markGameDeleted(game.id);
        console.log(`Deleted stale Telegram message for ${game.uuid}.`);
        continue;
      }

      await editEndedMessage({ telegramClient, game });
      await actualFreeGamesRepository.markGameEnded(game.id);
      console.log(`Edited stale Telegram message for ${game.uuid}.`);
    } catch (error) {
      await reportError({
        scope: "telegram.cleanup",
        error,
        context: {
          action: attemptedDelete ? "delete" : "edit",
          uuid: game.uuid,
        },
      });
      console.error(`Stale Telegram cleanup failed for ${game.uuid}: ${error.message}`);

      if (!attemptedDelete) {
        await actualFreeGamesRepository.markGameEditFailed(game.id);
        continue;
      }

      try {
        await editEndedMessage({ telegramClient, game });
        await actualFreeGamesRepository.markGameEnded(game.id);
        console.log(`Edited stale Telegram message for ${game.uuid} after delete failed.`);
      } catch (editError) {
        await reportError({
          scope: "telegram.cleanup.fallback",
          error: editError,
          context: {
            action: "edit-after-delete-failed",
            uuid: game.uuid,
          },
        });
        console.error(`Stale Telegram edit fallback failed for ${game.uuid}: ${editError.message}`);
        await actualFreeGamesRepository.markGameEditFailed(game.id);
      }
    }
  }
}

module.exports = {
  buildEndedText,
  cleanupStaleFreeGameMessages,
};
