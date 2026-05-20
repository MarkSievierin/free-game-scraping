class TelegramClient {
  constructor({ botToken }) {
    if (!botToken) {
      throw new Error("Telegram bot token is required");
    }

    this.botToken = botToken;
  }

  async sendMessage(dto) {
    return this.request("sendMessage", dto.toPayload());
  }

  async sendPhoto(dto) {
    return this.request("sendPhoto", dto.toPayload());
  }

  async request(method, payload) {
    const url = `https://api.telegram.org/bot${this.botToken}/${method}`;
    const body = new URLSearchParams();

    for (const [key, value] of Object.entries(payload)) {
      const normalizedValue =
        value !== null && typeof value === "object" ? JSON.stringify(value) : String(value);

      body.append(key, normalizedValue);
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Telegram request failed with status ${response.status}`);
    }

    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description || "Unknown error"}`);
    }

    return data;
  }
}

module.exports = {
  TelegramClient,
};
