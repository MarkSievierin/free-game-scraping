const assert = require("node:assert/strict");
const test = require("node:test");

const {
  formatOfferEndDate,
  formatOfferEndsAtFromTimestamp,
  normalizeOfferEndsAt,
} = require("../src/shared/offer-date");

test("Epic timestamps are formatted in the shared offer date format", () => {
  assert.equal(formatOfferEndsAtFromTimestamp("2026-10-29T15:00:00.000Z"), "29.10.2026 в 16:00");
  assert.equal(formatOfferEndsAtFromTimestamp("2026-08-27T22:00:00.000Z"), "28.08.2026 в 00:00");
  assert.equal(formatOfferEndsAtFromTimestamp(""), "");
  assert.equal(formatOfferEndsAtFromTimestamp("not a date"), "");
});

test("Steam dates without a year get the nearest upcoming year", () => {
  const referenceDate = new Date("2026-08-24T12:00:00.000Z");

  assert.equal(normalizeOfferEndsAt("27 августа в 17:00", { referenceDate }), "27.08.2026 в 17:00");
  assert.equal(normalizeOfferEndsAt("24 августа", { referenceDate }), "24.08.2026");
  assert.equal(
    normalizeOfferEndsAt("3 января в 9:05", { referenceDate: new Date("2026-12-28T12:00:00.000Z") }),
    "03.01.2027 в 09:05",
  );
});

test("Steam abbreviated months are parsed", () => {
  const referenceDate = new Date("2026-10-31T12:00:00.000Z");

  assert.equal(normalizeOfferEndsAt("2 ноя в 10:00", { referenceDate }), "02.11.2026 в 10:00");
  assert.equal(normalizeOfferEndsAt("31 окт в 10:00", { referenceDate }), "31.10.2026 в 10:00");
  assert.equal(normalizeOfferEndsAt("5 сент. в 10:00", { referenceDate }), "05.09.2027 в 10:00");
  assert.equal(normalizeOfferEndsAt("1 май", { referenceDate }), "01.05.2027");
});

test("dates already stored in other formats are normalized", () => {
  assert.equal(normalizeOfferEndsAt("26 апреля 2026"), "26.04.2026");
  assert.equal(normalizeOfferEndsAt("29.10.2026 в 16:00"), "29.10.2026 в 16:00");
  assert.equal(normalizeOfferEndsAt("дату не видно"), "");
  assert.equal(normalizeOfferEndsAt("31 февраля 2026"), "");
  assert.equal(normalizeOfferEndsAt(""), "");
});

test("offer end date drops the time", () => {
  assert.equal(formatOfferEndDate("29.10.2026 в 16:00"), "29.10.2026");
  assert.equal(
    formatOfferEndDate("27 августа в 17:00", { referenceDate: new Date("2026-08-20T00:00:00.000Z") }),
    "27.08.2026",
  );
  assert.equal(formatOfferEndDate("непонятно"), "");
});
