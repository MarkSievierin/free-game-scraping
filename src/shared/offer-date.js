const { normalizeText } = require("./text");

// Epic returns exact UTC timestamps; posts show them in one fixed zone so every store reads the same.
const OFFER_TIME_ZONE = "Europe/Berlin";

const RUSSIAN_MONTHS = {
  января: 1,
  февраля: 2,
  марта: 3,
  апреля: 4,
  мая: 5,
  июня: 6,
  июля: 7,
  августа: 8,
  сентября: 9,
  октября: 10,
  ноября: 11,
  декабря: 12,
};

const NUMERIC_DATE_PATTERN = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+в\s+(\d{1,2}):(\d{2}))?$/;
const RUSSIAN_DATE_PATTERN = /^(\d{1,2})\s+([а-яё]+)(?:\s+(\d{4}))?(?:\s+в\s+(\d{1,2}):(\d{2}))?$/i;

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatOfferDateParts({ day, month, year, hour, minute }) {
  const date = `${pad(day)}.${pad(month)}.${year}`;

  return hour === undefined ? date : `${date} в ${pad(hour)}:${pad(minute)}`;
}

function formatOfferEndsAtFromTimestamp(value) {
  const date = new Date(value || "");

  if (!value || Number.isNaN(date.getTime())) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: OFFER_TIME_ZONE,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return formatOfferDateParts(parts);
}

// Steam shows "27 августа в 17:00" without a year: the offer ends after the reference date,
// so a day that has already passed this year belongs to the next one.
function inferYear(day, month, referenceDate) {
  const referenceYear = referenceDate.getUTCFullYear();
  const candidate = Date.UTC(referenceYear, month - 1, day);
  const referenceDay = Date.UTC(referenceYear, referenceDate.getUTCMonth(), referenceDate.getUTCDate());

  return candidate < referenceDay ? referenceYear + 1 : referenceYear;
}

function isValidDay(day, month, year) {
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseOfferEndsAt(value, { referenceDate = new Date() } = {}) {
  const text = normalizeText(value).toLowerCase();
  let parts = null;
  const numericMatch = text.match(NUMERIC_DATE_PATTERN);

  if (numericMatch) {
    parts = {
      day: Number(numericMatch[1]),
      month: Number(numericMatch[2]),
      year: Number(numericMatch[3]),
      hour: numericMatch[4],
      minute: numericMatch[5],
    };
  }

  const russianMatch = !parts && text.match(RUSSIAN_DATE_PATTERN);

  if (russianMatch && RUSSIAN_MONTHS[russianMatch[2]]) {
    const day = Number(russianMatch[1]);
    const month = RUSSIAN_MONTHS[russianMatch[2]];

    parts = {
      day,
      month,
      year: russianMatch[3] ? Number(russianMatch[3]) : inferYear(day, month, referenceDate),
      hour: russianMatch[4],
      minute: russianMatch[5],
    };
  }

  if (!parts || !isValidDay(parts.day, parts.month, parts.year)) {
    return null;
  }

  return {
    ...parts,
    hour: parts.hour === undefined ? undefined : Number(parts.hour),
    minute: parts.minute === undefined ? undefined : Number(parts.minute),
  };
}

function normalizeOfferEndsAt(value, options) {
  const parts = parseOfferEndsAt(value, options);

  return parts ? formatOfferDateParts(parts) : "";
}

function formatOfferEndDate(value, options) {
  const parts = parseOfferEndsAt(value, options);

  return parts ? formatOfferDateParts({ ...parts, hour: undefined }) : "";
}

module.exports = {
  formatOfferEndDate,
  formatOfferEndsAtFromTimestamp,
  normalizeOfferEndsAt,
};
