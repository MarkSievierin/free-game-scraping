# Epic Games Free Games Telegram Bot

Node.js script that finds `-100%` games in Epic Games Store and Steam, sends them to a Telegram channel, and keeps track of the sent posts in MySQL.

## Sources

### Epic Games Store

Epic games come only from the official giveaway endpoint
`https://store-site-backend-static-ipv4.ak.epicgames.com/freeGamesPromotions?locale=ru-RU&country=UA&allowCountries=UA`.
It is not behind Cloudflare and returns the same shape as the store GraphQL
(`data.Catalog.searchStore.elements`) with a localized description, images, the product page slug
and the promotion windows.

A game is published only when all of these hold:

- its current price is `0`;
- it is a game (a `games` category), not an add-on;
- it has an active promotional offer (`startDate <= now < endDate`) with `discountPercentage: 0`.

The post end date is that promotion's `endDate`.

Why not the other ways to read Epic:

- the browse page through the `r.jina.ai` reader mostly returned Cloudflare "Just a moment..." stubs
  for product pages, so descriptions were silently lost, and the reader never contained the sale end date;
- `store.epicgames.com/graphql` answers `403` from Cloudflare.

Trade-off: the endpoint lists Epic's own weekly giveaways. Small indie games that a publisher discounts
to `-100%` outside the giveaway program are intentionally not covered.

Game UUIDs stay `epic:<pageSlug>`, the same as before, so already posted games are not posted twice.

### Steam

Steam games come from the store specials search sorted by price; each new `-100%` game is enriched
from `appdetails` (description, genres) and its store page (tags, end date). If enrichment fails, the
game is held back by the publishing rules below and retried on the next run.

A free DLC is posted only when its base game (`fullgame` in `appdetails`) is free as well: DLC for a
paid game is useless to most of the channel. Such DLC is skipped silently on every run (one extra
`appdetails` request for the base game).

## Publishing rules

Before sending, every new game (any store) must have a title, link, image, description and offer end
date; blank values count as missing. Incomplete games are not sent and not saved, so a later run
publishes them once the store provides the data. They are logged and reported in one message per run
to the dev bot (`BOT_TOKEN_DEV` + `CHAT_ID_DEV`). This report works in `prod` too, so set these
variables on the production server as well; without them the run only logs the skipped games.

Offer end dates use one format for all stores: `DD.MM.YYYY в HH:MM`. Epic UTC timestamps are shown in
the `Europe/Berlin` time zone. Steam shows dates without a year, with the month in full or abbreviated
("27 августа в 17:00", "2 ноя в 10:00"), so months are matched by their first three letters and the
year is taken as the nearest upcoming one.

When a game disappears from its store listing, its post is cleaned up: posts younger than 47 hours are
deleted, older ones are edited to a short "ended" view without the claim button and the store link:

```text
<s>Game title</s>
⛔ Раздача завершилась 29.10.2026

🎮 Больше бесплатных игр: @free_games7722
```

The date is the stored offer end date (old Steam rows without a year are resolved against the post
date); if it cannot be parsed, the line has no date. The channel line is added only when
`TELEGRAM_CHANNEL_USERNAME` is set.

## Structure

- `index.js` - thin application entry point and environment bootstrap
- `src/config` - environment parsing and runtime configuration
- `src/domain` - store-independent game rules and identifiers
- `src/application` - use cases: run, fetch, notify and stale-message cleanup
- `src/infrastructure` - MySQL, Telegram and external store integrations
- `src/presentation` - Telegram message formatting and buttons

The main flow is:

```text
index.js
  -> application/run-free-games
     -> infrastructure/sources/*
     -> infrastructure/database/*
     -> presentation/telegram/*
     -> infrastructure/telegram/*
```

When `APP_TYPE` is not `prod`, internal errors are sent to `CHAT_ID_DEV` by the
stage bot. Production only writes errors to the process log. Reports about games skipped for
missing data go to `CHAT_ID_DEV` in every environment (see "Publishing rules").

## Setup

1. Install dependencies:

```bash
npm install
```

2. Fill in `.env`:

```env
APP_TYPE=stage
MAX_GAMES=
ENABLE_EPIC=false
ENABLE_STEAM=false
EPIC_LOCALE=ru-RU
EPIC_COUNTRY=UA
EPIC_ALLOW_COUNTRIES=UA
EPIC_PROMOTIONS_ENDPOINT=

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=free_games
MYSQL_USER=free_games_bot
MYSQL_PASSWORD=your_mysql_password

BOT_TOKEN=your_telegram_bot_token
CHAT_ID=your_chat_id

BOT_TOKEN_DEV=your_stage_telegram_bot_token
CHAT_ID_DEV=your_stage_chat_id
TELEGRAM_CHANNEL_USERNAME=free_games7722
```

`ENABLE_EPIC` and `ENABLE_STEAM` control which source flows run. At least one of them must be `true`.
`EPIC_PROMOTIONS_ENDPOINT` is optional and overrides the Epic giveaway endpoint (without the query string).
`BOT_TOKEN_DEV` and `CHAT_ID_DEV` are needed in `prod` too: they receive the skipped-games report.
`APP_TYPE=prod` writes `prod` records, every other value writes `stage` records. Records are unique by `server_type + uuid`.

3. Initialize MySQL database and run migrations:

```bash
npm run setup:db
```

The bot stores Telegram `message_id` values for sent games. On later runs it removes fresh stale posts, or edits older posts to mark the offer as ended.

## Run

Run the bot:

```bash
npm start
```

For cron:

```bash
cd /root/free-game-scraping-stage && npm start
```

## План развития

1. Добавить теги для игр из Epic Games Store.
2. Добавить отправку уведомлений пачкой: у всех сообщений отключать звук, а у последнего сообщения в пачке оставлять обычное уведомление со звуком.

## Remote MySQL Access

Keep MySQL bound to the server and connect from a local machine through SSH:

```bash
ssh -N -L 3307:127.0.0.1:3306 root@SERVER_IP
```

Then connect DBeaver to:

```text
Host: 127.0.0.1
Port: 3307
Database: free_games
User: free_games_bot
Password: MYSQL_PASSWORD
```
