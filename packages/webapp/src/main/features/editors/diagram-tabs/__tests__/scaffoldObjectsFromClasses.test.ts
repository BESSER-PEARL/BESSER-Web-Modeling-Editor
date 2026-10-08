import { describe, expect, it } from 'vitest';
import { scaffoldObjectsFromClasses } from '../scaffoldObjectsFromClasses';

const v4 = (type: string, nodes: any[]): any => ({ version: '4.0.0', id: type, title: '', type, nodes, edges: [] });

// Enumerations written by older data (or the assistant before its casing fix)
// carry a lowercase stereotype; the exact 'Enumeration' compare missed them and
// enum-typed slots fell back to a generic sample value.
describe('scaffoldObjectsFromClasses enum literals', () => {
  it.each(['Enumeration', 'enumeration'])('seeds an enum-typed slot with the first literal (%s)', (stereotype) => {
    const classModel = v4('ClassDiagram', [
      {
        id: 'enum1',
        type: 'class',
        position: { x: 0, y: 0 },
        data: { name: 'Color', stereotype, attributes: [{ id: 'l1', name: 'RED' }, { id: 'l2', name: 'GREEN' }], methods: [] },
      },
      {
        id: 'car',
        type: 'class',
        position: { x: 300, y: 0 },
        data: { name: 'Car', attributes: [{ id: 'a1', name: 'paint', attributeType: 'Color' }], methods: [] },
      },
    ]);

    const { model } = scaffoldObjectsFromClasses({ classModel, objectModel: v4('ObjectDiagram', []) });

    const car = (model.nodes as any[]).find((n) => n.data.classId === 'car');
    expect(car.data.attributes[0].value).toBe('RED');
  });
});

// Live report: unanchored name heuristics broke slot types, e.g. a Room's
// `capacity: int` got "Springfield" (capa-CITY), `hotel` got a phone number
// (ho-TEL), `seat` a datetime (ends in "at").
describe('scaffoldObjectsFromClasses sample values', () => {
  const sampleFor = (name: string, attributeType: string): string => {
    const classModel = v4('ClassDiagram', [
      { id: 'c', type: 'class', position: { x: 0, y: 0 }, data: { name: 'Thing', attributes: [{ id: 'a', name, attributeType }], methods: [] } },
    ]);
    const { model } = scaffoldObjectsFromClasses({ classModel, objectModel: v4('ObjectDiagram', []) });
    return (model.nodes as any[])[0].data.attributes[0].value;
  };

  it.each([
    ['capacity', 'int', /^\d+$/],
    ['seat', 'int', /^\d+$/],
    ['attendees', 'int', /^\d+$/],
    ['destination', 'int', /^\d+$/],
    ['page', 'int', /^200$/],
    ['rating', 'bool', /^(true|false)$/],
    ['createdAt', 'int', /^\d+$/],
  ])('keeps %s: %s within its type', (name, type, expected) => {
    expect(sampleFor(name, type)).toMatch(expected);
  });

  it.each([
    ['hotel', 'str', '+1-555-0100'],
    ['capacity', 'str', 'Springfield'],
    ['seat', 'str', '2026-01-01T00:00:00'],
    ['attendees', 'str', '2026-01-01'],
  ])('does not match %s as a substring of another word', (name, type, wrong) => {
    expect(sampleFor(name, type)).not.toBe(wrong);
  });

  it.each([
    ['city', 'str', 'Springfield'],
    ['homeCity', 'str', 'Springfield'],
    ['phone_number', 'str', '+1-555-0100'],
    ['tel', 'str', '+1-555-0100'],
    ['createdAt', 'datetime', '2026-01-01T00:00:00'],
    ['endDate', 'date', '2026-01-01'],
    ['firstName', 'str', 'Alice'],
    ['age', 'int', '25'],
  ])('still recognises whole words: %s', (name, type, value) => {
    expect(sampleFor(name, type)).toBe(value);
  });
});

describe('scaffoldObjectsFromClasses naming', () => {
  it('names objects <class>_<n> with the next free suffix, matching the palette', () => {
    const classModel = v4('ClassDiagram', [
      { id: 'book', type: 'class', position: { x: 0, y: 0 }, data: { name: 'Book', attributes: [], methods: [] } },
    ]);
    const objectModel = v4('ObjectDiagram', [
      // Palette-created, not linked to the class (no classId): its name is taken.
      { id: 'o1', type: 'objectName', position: { x: 0, y: 0 }, width: 240, height: 40, data: { name: 'book_1', attributes: [], methods: [] } },
    ]);
    const { model } = scaffoldObjectsFromClasses({ classModel, objectModel });
    const generated = (model.nodes as any[]).find((n) => n.data.classId === 'book');
    expect(generated.data.name).toBe('book_2');
  });

  it('uses valid v4 handle ids for generated links', () => {
    const classModel = {
      ...v4('ClassDiagram', [
        { id: 'a', type: 'class', position: { x: 0, y: 0 }, data: { name: 'A', attributes: [], methods: [] } },
        { id: 'b', type: 'class', position: { x: 300, y: 0 }, data: { name: 'B', attributes: [], methods: [] } },
      ]),
      edges: [{ id: 'r', type: 'ClassBidirectional', source: 'a', target: 'b', data: { points: [] } }],
    };
    const { model } = scaffoldObjectsFromClasses({ classModel, objectModel: v4('ObjectDiagram', []) });
    const link = (model.edges as any[])[0];
    expect([link.sourceHandle, link.targetHandle]).toEqual(['right', 'left']);
  });
});
