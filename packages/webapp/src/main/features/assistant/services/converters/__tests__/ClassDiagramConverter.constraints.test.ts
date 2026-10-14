import { describe, expect, it } from 'vitest';

import { ClassDiagramConverter } from '../ClassDiagramConverter';

/**
 * The modeling agent emits `systemSpec.constraints` (OCL invariants for rules the
 * user stated in prose). Until this converter handled them they reached the browser
 * and were silently dropped, so no business rule ever reached the code generator.
 */

const HOTEL_SPEC = {
  systemName: 'HotelBookingSystem',
  classes: [
    { className: 'Person', attributes: [], methods: [] },
    { className: 'Booking', attributes: [], methods: [] },
    { className: 'Room', attributes: [], methods: [] }
  ],
  relationships: [
    {
      type: 'Association',
      source: 'Booking',
      target: 'Room',
      sourceMultiplicity: '0..*',
      targetMultiplicity: '1..*',
      name: 'rooms'
    }
  ],
  constraints: [
    {
      context: 'Person',
      name: 'ValidEmail',
      expression: "context Person inv ValidEmail: self.email.matches('.+@.+\\..+')"
    },
    {
      context: 'Person',
      name: 'ValidPhoneNumber',
      expression: "context Person inv ValidPhoneNumber: self.phone.matches('^\\+?[0-9]{7,15}$')"
    },
    {
      context: 'Booking',
      name: 'GuestsWithinCapacity',
      expression:
        'context Booking inv GuestsWithinCapacity: ' +
        'self.guests->size() <= self.rooms->collect(r | r.capacity)->sum()'
    }
  ]
};

const oclElements = (model: any) =>
  Object.values(model.elements).filter((e: any) => e.type === 'ClassOCLConstraint') as any[];

const oclLinks = (model: any) =>
  Object.values(model.relationships).filter((r: any) => r.type === 'ClassOCLLink') as any[];

const classIdByName = (model: any, name: string) =>
  (Object.values(model.elements) as any[]).find((e: any) => e.type === 'Class' && e.name === name)?.id;

describe('ClassDiagramConverter — native association classes', () => {
  const spec = {
    ...HOTEL_SPEC,
    classes: [...HOTEL_SPEC.classes, {
      className: 'ReservedRoom', methods: [], attributes: [
        { name: 'agreedPrice', type: 'float' }, { name: 'extraCharges', type: 'float' }
      ]
    }],
    relationships: [{ ...HOTEL_SPEC.relationships[0], sourceRole: 'bookings', associationClass: 'ReservedRoom' }]
  };

  it('attaches the attribute class to the direct association, preserving roles and bounds', () => {
    const model = new ClassDiagramConverter().convertCompleteSystem(spec);
    const links = Object.values(model.relationships).filter((r: any) => r.type === 'ClassLinkRel');
    expect(links).toHaveLength(1);
    const link = links[0] as any;
    expect(link.source.element).toBe(classIdByName(model, 'ReservedRoom'));
    const association = model.relationships[link.target.element];
    expect(association.type).toBe('ClassBidirectional');
    expect(association.source).toMatchObject({ role: 'bookings', multiplicity: '0..*' });
    expect(association.target).toMatchObject({ role: 'rooms', multiplicity: '1..*' });
    const attributes = model.elements[link.source.element].attributes.map((id: string) => model.elements[id].name);
    expect(attributes).toEqual(['agreedPrice', 'extraCharges']);
    // Ordinary specs remain ordinary; never infer an attachment from a name.
    const plain = new ClassDiagramConverter().convertCompleteSystem({ ...spec, relationships: HOTEL_SPEC.relationships });
    expect(Object.values(plain.relationships).some((r: any) => r.type === 'ClassLinkRel')).toBe(false);
  });

  it('rejects missing or multiply attached classes instead of silently discarding link attributes', () => {
    expect(() => new ClassDiagramConverter().convertCompleteSystem({
      ...spec, relationships: [{ ...spec.relationships[0], associationClass: 'Missing' }]
    })).toThrow('Invalid association-class attachment');
    expect(() => new ClassDiagramConverter().convertCompleteSystem({
      ...spec, relationships: [...spec.relationships, ...spec.relationships]
    })).toThrow('Invalid association-class attachment');
  });
});

describe('ClassDiagramConverter — OCL constraints', () => {
  it('emits one constraint element per context class', () => {
    const model = new ClassDiagramConverter().convertCompleteSystem(HOTEL_SPEC);
    expect(oclElements(model)).toHaveLength(2); // Person, Booking
  });

  it('merges invariants that share a context into one box', () => {
    const model = new ClassDiagramConverter().convertCompleteSystem(HOTEL_SPEC);
    const person = oclElements(model).find((e) => e.constraint.includes('ValidEmail'));
    expect(person.constraint).toContain('ValidEmail');
    expect(person.constraint).toContain('ValidPhoneNumber');
  });

  it('keeps the capacity rule verbatim', () => {
    const model = new ClassDiagramConverter().convertCompleteSystem(HOTEL_SPEC);
    const booking = oclElements(model).find((e) => e.constraint.includes('GuestsWithinCapacity'));
    expect(booking.constraint).toContain('self.guests->size()');
    expect(booking.constraint).toContain('r.capacity');
  });

  it('links each constraint to its context class', () => {
    const model = new ClassDiagramConverter().convertCompleteSystem(HOTEL_SPEC);
    const links = oclLinks(model);
    expect(links).toHaveLength(2);

    const personId = classIdByName(model, 'Person');
    const bookingId = classIdByName(model, 'Booking');
    const targets = links.map((l) => l.target.element).sort();
    expect(targets).toEqual([personId, bookingId].sort());
  });

  it('points the link source at the constraint element, not the class', () => {
    const model = new ClassDiagramConverter().convertCompleteSystem(HOTEL_SPEC);
    const constraintIds = oclElements(model).map((e) => e.id);
    for (const link of oclLinks(model)) {
      expect(constraintIds).toContain(link.source.element);
    }
  });

  it('does not disturb the classes or associations', () => {
    const model = new ClassDiagramConverter().convertCompleteSystem(HOTEL_SPEC);
    const classes = (Object.values(model.elements) as any[]).filter((e: any) => e.type === 'Class');
    expect(classes.map((c) => c.name).sort()).toEqual(['Booking', 'Person', 'Room']);

    const assocs = (Object.values(model.relationships) as any[]).filter(
      (r: any) => r.type !== 'ClassOCLLink'
    );
    expect(assocs).toHaveLength(1);
    expect(assocs[0].target.multiplicity).toBe('1..*');
  });

  it('drops a constraint whose context is not a class in the spec', () => {
    const model = new ClassDiagramConverter().convertCompleteSystem({
      ...HOTEL_SPEC,
      constraints: [{ context: 'Nonexistent', expression: 'context Nonexistent inv x: true' }]
    });
    expect(oclElements(model)).toHaveLength(0);
    expect(oclLinks(model)).toHaveLength(0);
  });

  it('ignores blank and malformed constraint entries', () => {
    const model = new ClassDiagramConverter().convertCompleteSystem({
      ...HOTEL_SPEC,
      constraints: [
        { context: 'Person', expression: '   ' },
        { context: 'Person' },
        { expression: 'context Person inv x: true' },
        null,
        'not an object'
      ]
    });
    expect(oclElements(model)).toHaveLength(0);
  });

  it('is a no-op when the agent emitted no constraints', () => {
    for (const constraints of [undefined, null, [], 'nope']) {
      const model = new ClassDiagramConverter().convertCompleteSystem({
        ...HOTEL_SPEC,
        constraints
      });
      expect(oclElements(model)).toHaveLength(0);
      expect(oclLinks(model)).toHaveLength(0);
    }
  });

  it('gives every constraint element and link a unique id', () => {
    const model = new ClassDiagramConverter().convertCompleteSystem(HOTEL_SPEC);
    const ids = [...oclElements(model), ...oclLinks(model)].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not overlap constraint boxes with each other', () => {
    const model = new ClassDiagramConverter().convertCompleteSystem(HOTEL_SPEC);
    const boxes = oclElements(model).map((e) => e.bounds);
    const ys = boxes.map((b) => b.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(boxes[0].height);
    }
  });
});
