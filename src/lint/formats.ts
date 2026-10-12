/**
 * The `format` registry of the lint rules: for every format name (and alias)
 * its validator plus a short description and an example, used both to check
 * an argument and to explain a mismatch in the default issue message.
 */
import { Temporal } from "temporal-polyfill";
import { HeredocValue } from "../don.js";
import {
  isCidr,
  isEmail,
  isHostname,
  isIpv4,
  isIpv6,
  isPort,
  isPortEphemeral,
  isPortRegistered,
  isPortWellKnown,
  isRegexp,
  isSemver,
  isUrl,
  isUuid,
} from "./string-formats.js";

/** The string a `pattern` matches against: the value itself, or a heredoc's `content`. */
export const patternSubject = (value: unknown): string | undefined => {
  if (typeof value === "string") return value;
  if (value instanceof HeredocValue) return value.content;
  return undefined;
};

/**
 * Runs a `Temporal.<Type>.from()` parse over a string argument and reports
 * whether it succeeds. Only strings are checked: `from()` also accepts
 * property bags, which a DON argument can never be.
 */
const parsesAs =
  (parse: (value: string) => unknown) =>
  (value: unknown): boolean => {
    if (typeof value !== "string") return false;
    try {
      parse(value);
      return true;
    } catch {
      return false;
    }
  };

const reject = { overflow: "reject" } as const;

const isDuration = parsesAs((v) => Temporal.Duration.from(v));
const isPlainDate = parsesAs((v) => Temporal.PlainDate.from(v, reject));
const isPlainTime = parsesAs((v) => Temporal.PlainTime.from(v, reject));
const isPlainDateTime = parsesAs((v) => Temporal.PlainDateTime.from(v, reject));
const isInstant = parsesAs((v) => Temporal.Instant.from(v));
const isPlainYearMonth = parsesAs((v) =>
  Temporal.PlainYearMonth.from(v, reject),
);
const isPlainMonthDay = parsesAs((v) => Temporal.PlainMonthDay.from(v, reject));
const isZonedDateTime = parsesAs((v) => Temporal.ZonedDateTime.from(v, reject));

const tryInstant = (create: () => unknown): boolean => {
  try {
    create();
    return true;
  } catch {
    return false;
  }
};
const isEpochSeconds = (value: unknown): boolean =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  tryInstant(() => Temporal.Instant.fromEpochMilliseconds(value * 1000));
const isEpochMilliseconds = (value: unknown): boolean =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  tryInstant(() => Temporal.Instant.fromEpochMilliseconds(value));
const isEpochNanoseconds = (value: unknown): boolean =>
  typeof value === "bigint" &&
  tryInstant(() => Temporal.Instant.fromEpochNanoseconds(value));

const isJson = (value: unknown): boolean => {
  const text = patternSubject(value);
  if (text === undefined) return false;
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

interface FormatDetails {
  /** What a valid value is, completing "must be a valid <format>: ...". */
  description: string;
  example: string;
}

interface FormatSpec extends FormatDetails {
  validate: (value: unknown) => boolean;
  /** Tailors the details to the value that failed (e.g. one written with a range). */
  detailsFor?: (value: unknown) => FormatDetails;
}

const spec = (
  validate: (value: unknown) => boolean,
  description: string,
  example: string,
  detailsFor?: FormatSpec["detailsFor"],
): FormatSpec => ({ validate, description, example, detailsFor });

/** Whether the value was written with a CIDR range (`<ip>/<range>`). */
const hasRange = (value: unknown): boolean =>
  typeof value === "string" && value.includes("/");

const IPV4_DETAILS: FormatDetails = {
  description: "an IPv4 address",
  example: "192.0.2.1",
};
const IPV4_RANGE_DETAILS: FormatDetails = {
  description: "an IPv4 address with a range from /0 to /32",
  example: "10.0.0.0/8",
};
const IPV6_DETAILS: FormatDetails = {
  description: "an IPv6 address",
  example: "2001:db8::1",
};
const IPV6_RANGE_DETAILS: FormatDetails = {
  description: "an IPv6 address with a range from /0 to /128",
  example: "2001:db8::/32",
};
const CIDR_DETAILS: FormatDetails = {
  description: "an IPv4 or IPv6 address",
  example: "192.0.2.1 or 2001:db8::1",
};

/** An IP format's details: the range is mentioned only if the value used one. */
const ipDetails =
  (plain: FormatDetails, withRange: FormatDetails): FormatSpec["detailsFor"] =>
  (value) =>
    hasRange(value) ? withRange : plain;

const json = spec(isJson, "text that parses as JSON", '{"a":1}');
const duration = spec(isDuration, "an ISO 8601 duration", "P1Y2M3DT4H5M6S");
const plainDate = spec(
  isPlainDate,
  "an ISO 8601 calendar date (YYYY-MM-DD)",
  "2024-02-29",
);
const plainTime = spec(
  isPlainTime,
  "an ISO 8601 time of day (HH:mm[:ss[.fffffffff]])",
  "10:30:15",
);
const plainDateTime = spec(
  isPlainDateTime,
  "an ISO 8601 date and time without an offset (YYYY-MM-DDTHH:mm[:ss])",
  "2024-02-29T10:30:15",
);
const instant = spec(
  isInstant,
  "an ISO 8601 date and time with a Z or a UTC offset",
  "2024-02-29T10:30:15Z",
);
const plainYearMonth = spec(
  isPlainYearMonth,
  "a year and month (YYYY-MM)",
  "2024-02",
);
const plainMonthDay = spec(isPlainMonthDay, "a month and day (MM-DD)", "02-29");
const zonedDateTime = spec(
  isZonedDateTime,
  "an ISO 8601 date and time with a [time zone]",
  "2024-02-29T10:30:15+01:00[Europe/Madrid]",
);
const epochSeconds = spec(
  isEpochSeconds,
  "an integer number of seconds since the Unix epoch",
  "1709202615",
);
const epochMilliseconds = spec(
  isEpochMilliseconds,
  "an integer number of milliseconds since the Unix epoch",
  "1709202615000",
);
const epochNanoseconds = spec(
  isEpochNanoseconds,
  "a bigint number of nanoseconds since the Unix epoch",
  "1709202615000000000n",
);

const formats: Record<string, FormatSpec> = {
  json,
  url: spec(isUrl, "an absolute URL", "https://example.com/path"),
  ipv4: spec(
    isIpv4,
    IPV4_DETAILS.description,
    IPV4_DETAILS.example,
    ipDetails(IPV4_DETAILS, IPV4_RANGE_DETAILS),
  ),
  ipv6: spec(
    isIpv6,
    IPV6_DETAILS.description,
    IPV6_DETAILS.example,
    ipDetails(IPV6_DETAILS, IPV6_RANGE_DETAILS),
  ),
  CIDR: spec(
    isCidr,
    CIDR_DETAILS.description,
    CIDR_DETAILS.example,
    // With a range the family is known from the value, so name its own limit.
    (value) =>
      hasRange(value)
        ? String(value).includes(":")
          ? IPV6_RANGE_DETAILS
          : IPV4_RANGE_DETAILS
        : CIDR_DETAILS,
  ),
  hostname: spec(isHostname, "an RFC 1123 hostname", "api.example.com"),
  port: spec(isPort, "an integer port from 0 to 65535", "8080"),
  "port-well-known": spec(
    isPortWellKnown,
    "an integer well-known port from 0 to 1023",
    "443",
  ),
  "port-registered": spec(
    isPortRegistered,
    "an integer registered port from 1024 to 49151",
    "8080",
  ),
  "port-ephemeral": spec(
    isPortEphemeral,
    "an integer ephemeral port from 49152 to 65535",
    "50000",
  ),
  uuid: spec(
    isUuid,
    "a canonical UUID",
    "123e4567-e89b-42d3-a456-426614174000",
  ),
  email: spec(isEmail, "an RFC 5322 email address", "user@example.com"),
  regexp: spec(isRegexp, "a valid JavaScript regular expression", "^[a-z]+$"),
  semver: spec(
    isSemver,
    "a Semantic Versioning 2.0.0 version",
    "1.2.3-rc.1+build.5",
  ),
  duration,
  "plain-date": plainDate,
  PlainDate: plainDate,
  "plain-time": plainTime,
  PlainTime: plainTime,
  "plain-date-time": plainDateTime,
  PlainDateTime: plainDateTime,
  instant,
  Instant: instant,
  "plain-year-month": plainYearMonth,
  PlainYearMonth: plainYearMonth,
  "plain-month-day": plainMonthDay,
  PlainMonthDay: plainMonthDay,
  "zoned-date-time": zonedDateTime,
  ZonedDateTime: zonedDateTime,
  "epoch-seconds": epochSeconds,
  EpochSeconds: epochSeconds,
  unix: epochSeconds,
  "epoch-milliseconds": epochMilliseconds,
  EpochMilliseconds: epochMilliseconds,
  "epoch-nanoseconds": epochNanoseconds,
  EpochNanoseconds: epochNanoseconds,
};

const specFor = (format: string): FormatSpec | undefined =>
  Object.hasOwn(formats, format) ? formats[format] : undefined;

/** An unknown `format` never matches, so a typo surfaces as an issue. */
export const matchesFormat = (value: unknown, format: string): boolean =>
  specFor(format)?.validate(value) ?? false;

/**
 * The default issue message for a value that fails `format`, or `undefined`
 * when `value` actually satisfies it. It names the format, says what a valid
 * value looks like and gives an example — never the offending value itself,
 * which may be a secret. The IP formats mention a range only when the value
 * was written with one.
 */
export const formatMismatchMessage = (
  argIndex: number,
  value: unknown,
  format: string,
): string | undefined => {
  if (matchesFormat(value, format)) return undefined;
  const found = specFor(format);
  if (!found) {
    return `argument at position ${argIndex} has an unknown format "${format}"`;
  }
  const { description, example } = found.detailsFor?.(value) ?? found;
  return `argument at position ${argIndex} must be a valid ${format}: ${description} (e.g. ${example})`;
};
