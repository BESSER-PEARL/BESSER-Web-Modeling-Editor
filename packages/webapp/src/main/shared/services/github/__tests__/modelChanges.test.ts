import { describe, expect, it } from 'vitest';
import type { BesserProject } from '../../../types/project';
import { diffClassModels, idsToDraw } from '../modelChanges';

const model = (elements: Record<string, unknown>, relationships: Record<string, unknown> = {}) => ({ elements, relationships });
const project = (classModel: unknown) => ({ diagrams: { ClassDiagram: [{ id: 'd1', model: classModel }] } }) as unknown as BesserProject;
const room = { type: 'Class', name: 'Room' };
const roomNumber = { type: 'ClassAttribute', name: '+ number: str', owner: 'room' };
const names = (elements: { name: string }[]) => elements.map((element) => element.name);

describe('diffClassModels', () => {
  it('finds what was added, changed and removed', () => {
    const base = project(model({ room, roomNumber, old: { type: 'Class', name: 'Old' } }));
    const head = project(model({
      room: { ...room, name: 'Suite' },
      roomNumber,
      spa: { type: 'Class', name: 'Spa' },
      email: { type: 'ClassAttribute', name: '+ email: str', owner: 'room' },
    }));

    const changes = diffClassModels(base, head);

    expect(names(changes.added)).toEqual(['Spa', '+ email: str']);
    expect(names(changes.changed)).toEqual(['Suite']);
    expect(changes.changed[0].previousName).toBe('Room');
    expect(names(changes.removed)).toEqual(['Old']);
  });

  it('does not count layout or the fields an editor save adds', () => {
    // Live 2026-11-05: the first editor save added bounds, isId and attributeType to every element.
    const base = project(model({ room, roomNumber }));
    const head = project(model({
      room: { ...room, bounds: { x: 9, y: 9, width: 209, height: 90 }, isAbstract: false },
      roomNumber: { ...roomNumber, attributeType: 'str', isId: false, visibility: 'public' },
    }));

    expect(diffClassModels(base, head)).toEqual({ added: [], changed: [], removed: [] });
  });

  it('sees a changed attribute type however the editor wrote it', () => {
    const base = project(model({ room, roomNumber }));
    const head = project(model({ room, roomNumber: { ...roomNumber, name: 'number', attributeType: 'int' } }));

    expect(names(diffClassModels(base, head).changed)).toEqual(['number']);
  });

  it('treats everything as new when the base held no model', () => {
    expect(names(diffClassModels(null, project(model({ room }))).added)).toEqual(['Room']);
  });
});

describe('idsToDraw', () => {
  it('draws a whole class when one member is new, and new relationships', () => {
    const baseModel = model({ room, roomNumber }, { r1: {} });
    const headModel = model(
      { room, roomNumber, email: { type: 'ClassAttribute', name: '+ email: str', owner: 'room' }, spa: { type: 'Class', name: 'Spa' } },
      { r1: {}, r2: {} },
    );

    const changes = diffClassModels(project(baseModel), project(headModel));

    expect(idsToDraw(changes, baseModel, headModel).sort()).toEqual(['r2', 'room', 'spa']);
  });

  it('skips a class of another class diagram', () => {
    const changes = { added: [{ id: 'elsewhere', name: 'Elsewhere' }], changed: [], removed: [] };
    expect(idsToDraw(changes, model({}), model({ room }))).toEqual([]);
  });
});
