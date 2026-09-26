import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { parseDelayNotice, ParseError } from '../src/parser.js';
import { ParsedDelayNoticeSchema } from '../src/schema.js';

describe("Meera's Delay Notice Parser", () => {
  it('should parse well-formed notice 1 correctly', () => {
    const notice = fs.readFileSync(path.resolve(process.cwd(), 'samples/well_formed_1.txt'), 'utf-8');
    const result = parseDelayNotice(notice);

    expect(result.train).toContain('12123');
    expect(result.station).toBe('PUNE');
    expect(result.expectedTime).toBe('14:30');
    expect(result.reason).toContain('Signal failure');

    // Test Case 9: Schema validation check
    expect(() => ParsedDelayNoticeSchema.parse(result)).not.toThrow();
  });

  it('should parse well-formed notice 2 with AM/PM time and Marathi reason', () => {
    const notice = fs.readFileSync(path.resolve(process.cwd(), 'samples/well_formed_2.txt'), 'utf-8');
    const result = parseDelayNotice(notice);

    expect(result.train).toContain('11008');
    expect(result.station).toBe('CND');
    expect(result.expectedTime).toBe('08:45 AM');
    expect(result.reason).toContain('Track maintenance');
  });

  it('should parse well-formed notice 3 with shorthand keys', () => {
    const notice = fs.readFileSync(path.resolve(process.cwd(), 'samples/well_formed_3.txt'), 'utf-8');
    const result = parseDelayNotice(notice);

    expect(result.train).toBe('12124');
    expect(result.station).toBe('PUNE');
    expect(result.expectedTime).toBe('19:15');
    expect(result.reason).toContain('Heavy rains');
  });

  it('should parse well-formed notice 4 without reason', () => {
    const notice = fs.readFileSync(path.resolve(process.cwd(), 'samples/well_formed_4.txt'), 'utf-8');
    const result = parseDelayNotice(notice);

    expect(result.train).toBe('12157');
    expect(result.station).toBe('PUNE');
    expect(result.expectedTime).toBe('18:00');
    expect(result.reason).toBeNull();
  });

  // Test Case 10: A test exercises the parser on a malformed notice
  it('should fail on broken notice 1 (missing train number)', () => {
    const notice = fs.readFileSync(path.resolve(process.cwd(), 'samples/broken_1.txt'), 'utf-8');
    expect(() => parseDelayNotice(notice)).toThrow(ParseError);
  });

  it('should fail on broken notice 2 (missing station code)', () => {
    const notice = fs.readFileSync(path.resolve(process.cwd(), 'samples/broken_2.txt'), 'utf-8');
    expect(() => parseDelayNotice(notice)).toThrow(ParseError);
  });

  it('should fail on broken notice 3 (garbage text)', () => {
    const notice = fs.readFileSync(path.resolve(process.cwd(), 'samples/broken_3.txt'), 'utf-8');
    expect(() => parseDelayNotice(notice)).toThrow(ParseError);
  });

  it('should fail on empty string notice', () => {
    expect(() => parseDelayNotice('')).toThrow(ParseError);
    expect(() => parseDelayNotice('   ')).toThrow(ParseError);
  });
});
