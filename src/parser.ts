import { ParsedDelayNotice, ParsedDelayNoticeSchema } from './schema.js';

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

/**
 * Parses a messy Indian Railways delay notice text into structured JSON.
 * Throws a ParseError if the notice lacks train number, station code, or expected time,
 * or if output fails schema validation.
 */
export function parseDelayNotice(rawNotice: string): ParsedDelayNotice {
  if (!rawNotice || typeof rawNotice !== 'string' || rawNotice.trim().length === 0) {
    throw new ParseError("Empty or invalid notice text provided.");
  }

  const text = rawNotice.trim();

  // 1. Extract Train Number (and optional name in parentheses)
  // Match patterns like: "TRAIN NO: 12123 (Deccan Queen)", "Train # 11008 (Deccan Express)", "Trn: 12124", "Train 12157"
  let train: string | null = null;
  const trainRegexes = [
    /(?:train\s*(?:no|number|#)?|trn)\s*[:=.\s]\s*(\d{4,5}(?:\s*\([^)]+\))?)/i,
    /\btrain\s+(\d{4,5}(?:\s*\([^)]+\))?)/i,
    /\b(\d{4,5})\b/,
  ];

  for (const regex of trainRegexes) {
    const match = text.match(regex);
    if (match && match[1]) {
      train = match[1].trim();
      break;
    }
  }

  if (!train) {
    throw new ParseError("Could not extract train number from notice.");
  }

  // 2. Extract Station Code
  // Match patterns like: "STATION: PUNE", "at station CND", "PUNE station", "at PUNE", "Stn: PUNE"
  let station: string | null = null;
  const stationRegexes = [
    // Explicit key-value like "STATION: PUNE", "STN: CND", "Station: PUNE (Pune Junction)"
    /(?:station|stn)\s*[:=]\s*([A-Z]{2,5}(?:\s*\([^)]+\))?)/i,
    // Preceding "at station" or "at stn" e.g. "at station CND"
    /(?:at\s+station|at\s+stn)\s+([A-Z]{2,5})\b/i,
    // Preceding station word like "PUNE station" or "CND stn"
    /\b([A-Z]{2,5})\s+(?:station|stn)\b/i,
    // Preceding preposition like "at CND"
    /\bat\s+([A-Z]{2,5})\b/i,
    // Following station word like "station PUNE"
    /\b(?:station|stn)\s+([A-Z]{2,5})\b/i,
  ];

  const forbiddenWords = [
    "TRAIN", "TIME", "REASON", "EXP", "NEW", "NO", "ARR", "ARRIVAL",
    "RESCH", "RESCHEDULED", "EXPECTED", "STATION", "NOTICE", "DELAY", "DELAYED",
    "AT", "BY", "IN", "ON", "TO", "FOR", "OF", "IS", "IT", "BE", "SO", "DO", "OR", "IF", "AN", "AS", "AM", "PM"
  ];

  for (const regex of stationRegexes) {
    const match = text.match(regex);
    if (match && match[1]) {
      const candidate = match[1].trim();
      const cleanToken = candidate.split('(')[0].trim().toUpperCase();
      if (!forbiddenWords.includes(cleanToken)) {
        station = candidate;
        break;
      }
    }
  }

  if (!station) {
    throw new ParseError("Could not extract station code from notice.");
  }

  // 3. Extract Expected Time
  // Match patterns like: "EXPECTED TIME: 14:30", "expected arrival 08:45 AM", "Exp: 19:15", "rescheduled to 18:00"
  let expectedTime: string | null = null;
  const timeRegexes = [
    /(?:expected time|expected arrival|exp|time|rescheduled to|expected at|exp arrival)[:.\s]*([0-2]?\d:[0-5]\d(?:\s*(?:AM|PM|IST))?)/i,
    /\b([0-2]?\d:[0-5]\d(?:\s*(?:AM|PM|IST))?)\b/i,
  ];

  for (const regex of timeRegexes) {
    const match = text.match(regex);
    if (match && match[1]) {
      expectedTime = match[1].trim();
      break;
    }
  }

  if (!expectedTime) {
    throw new ParseError("Could not extract expected time from notice.");
  }

  // 4. Extract Reason (if present)
  // Match patterns like: "REASON: ...", "Reason: ...", "due to ..."
  let reason: string | null = null;
  const reasonMatch = text.match(/(?:reason|due to)[:.\s]*(.+)$/i);
  if (reasonMatch && reasonMatch[1]) {
    const extractedReason = reasonMatch[1].trim();
    reason = extractedReason.replace(/^[|\s-]+|[|\s-]+$/g, '').trim() || null;
  }

  const rawParsed = {
    train,
    station,
    expectedTime,
    reason: reason ?? null,
  };

  // 5. Schema Validation (Test Case 9: Parsed output is validated against a declared schema)
  const validationResult = ParsedDelayNoticeSchema.safeParse(rawParsed);
  if (!validationResult.success) {
    throw new ParseError(`Schema validation failed for parsed output: ${validationResult.error.message}`);
  }

  return validationResult.data;
}
