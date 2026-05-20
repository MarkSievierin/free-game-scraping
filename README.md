# Epic Games Free Games Telegram Bot

Node.js script that opens Epic Games Store catalog with Playwright, parses the rendered HTML and sends games with a `-100%` discount to Telegram.

## Structure

- `index.js` - application entry point
- `src/services` - business logic and integrations with external sources
- `src/clients` - external API clients
- `src/dto` - request DTOs for transport layer input

## Setup

1. Install dependencies:

```bash
npm install
```

2. Install Playwright browser:

```bash
npx playwright install chromium
```

3. Fill in `.env`:

```env
APP_TYPE=dev
MAX_GAMES=
ENABLE_EPIC=true
ENABLE_STEAM=false

BOT_TOKEN=your_telegram_bot_token
CHAT_ID=your_chat_id
```

`ENABLE_EPIC` and `ENABLE_STEAM` control which source flows run. At least one of them must be `true`.

4. Initialize SQLite database and run migrations:

```bash
npm run setup:db
```

## Run

```bash
npm start
```
