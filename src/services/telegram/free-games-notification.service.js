async function sendTelegramNotifications({ telegramClient, notifications }) {
  const successfulNotifications = [];

  for (const notification of notifications) {
    try {
      let telegramResponse;

      if (notification.method === "photo") {
        telegramResponse = await telegramClient.sendPhoto(notification.dto);
      } else {
        telegramResponse = await telegramClient.sendMessage(notification.dto);
      }

      console.log("=".repeat(60));
      console.log(notification.logText);
      successfulNotifications.push({
        ...notification,
        telegramMessage: telegramResponse.result,
      });
    } catch (error) {
      const title = notification.title || "notification";
      console.error(`Ошибка при отправке ${title}: ${error.message}`);
    }
  }

  return successfulNotifications;
}

module.exports = {
  sendTelegramNotifications,
};
