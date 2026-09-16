/**
 * A pasted requirements document must stay in chat, not become a file.
 *
 * Pastes over 3000 characters were diverted into file-conversion — a different
 * path with much narrower diagram-type detection — while the chat path itself
 * accepts 32000. So an ordinary "Natural-Language Requirements" brief took the
 * narrow route purely for being long, and (because that path was also 400ing on
 * an unsupported `temperature`) surfaced as "Failed to process the text file".
 *
 * Routing now keys on what the paste IS. Structured documents that
 * file-conversion can genuinely parse still go there; prose stays in chat.
 */
import { describe, expect, it } from 'vitest';

import { looksStructured, shouldAttachPaste } from '../paste-routing';

const REQUIREMENTS_BRIEF = `Natural-Language Requirements

A hotel booking application. Guests browse available rooms for a date range,
see the nightly rate and the amenities for each room, and book one. A booking
records the guest, the room, the check-in and check-out dates, and the total
price. Staff can see today's arrivals and mark a booking as checked in.

Rooms have a number, a type (single, double, suite), a nightly rate and a
capacity. A room cannot be double-booked for overlapping dates, and a booking
must be for at least one night. Guests have a name, an email and a phone
number. Cancelling a booking within 24 hours of check-in keeps 50% of the
price; earlier cancellations are refunded in full.`.repeat(8);

describe('looksStructured', () => {
  it('treats a long requirements brief as prose', () => {
    // The reported case: >3000 chars of ordinary English.
    expect(REQUIREMENTS_BRIEF.length).toBeGreaterThan(3000);
    expect(looksStructured(REQUIREMENTS_BRIEF)).toBe(false);
  });

  it('treats prose containing commas as prose', () => {
    const proseWithCommas = [
      'The customer places an order, the system checks stock, and staff pack it.',
      'If stock is short, the order waits, the customer is told, and we reorder.',
      'Once packed, the order ships, the customer is notified, and we invoice.',
    ].join('\n');
    expect(looksStructured(proseWithCommas)).toBe(false);
  });

  it.each([
    ['JSON object', '{"name": "Book", "attributes": []}'],
    ['JSON array', '[{"id": 1}, {"id": 2}]'],
    ['XML/XMI', '<?xml version="1.0"?><uml:Model/>'],
    ['HTML', '<html><body>hi</body></html>'],
    ['PlantUML', '@startuml\nclass Book\n@enduml'],
    ['mindmap', '@startmindmap\n* root\n@endmindmap'],
  ])('routes %s to file conversion', (_label, text) => {
    expect(looksStructured(text)).toBe(true);
  });

  it('routes a CSV table to file conversion', () => {
    const csv = ['name,type,rate', 'Room 1,single,80', 'Room 2,suite,220'].join('\n');
    expect(looksStructured(csv)).toBe(true);
  });

  it('routes a TSV table to file conversion', () => {
    const tsv = ['a\tb\tc', '1\t2\t3', '4\t5\t6'].join('\n');
    expect(looksStructured(tsv)).toBe(true);
  });

  it('does not mistake two short lines for a table', () => {
    // Too few rows to be a table; err toward chat.
    expect(looksStructured('a,b,c\n1,2,3')).toBe(false);
  });

  it('handles empty and whitespace input', () => {
    expect(looksStructured('')).toBe(false);
    expect(looksStructured('   \n  ')).toBe(false);
  });
});

describe('shouldAttachPaste', () => {
  it('keeps a long prose brief in chat', () => {
    expect(shouldAttachPaste(REQUIREMENTS_BRIEF)).toBe(false);
  });

  it('attaches a structured document', () => {
    expect(shouldAttachPaste('{"a": 1}')).toBe(true);
  });

  it('attaches anything past the chat limit, prose or not', () => {
    // Beyond this the chat path would reject the send outright.
    expect(shouldAttachPaste('a'.repeat(32001))).toBe(true);
    expect(shouldAttachPaste('a'.repeat(31999))).toBe(false);
  });

  it('ignores an empty paste', () => {
    expect(shouldAttachPaste('')).toBe(false);
  });
});
