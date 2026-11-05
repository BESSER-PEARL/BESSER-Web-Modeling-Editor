import { describe, expect, it } from 'vitest';
import type { BesserProject } from '../../../types/project';
import { diffClassModels, hasModelChanges, idsToDraw, soleAuthor } from '../modelChanges';

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

    expect(hasModelChanges(diffClassModels(base, head))).toBe(false);
  });

  it('sees a changed attribute type however the editor wrote it', () => {
    const base = project(model({ room, roomNumber }));
    const head = project(model({ room, roomNumber: { ...roomNumber, name: 'number', attributeType: 'int' } }));

    expect(names(diffClassModels(base, head).changed)).toEqual(['number']);
  });

  it('reads a method by what follows its closing parenthesis', () => {
    const lend = (name: string, extra: object = {}) => ({ lend: { type: 'ClassMethod', name, owner: 'room', ...extra } });
    const diff = (before: string, after: string, extra: object = {}) =>
      names(diffClassModels(project(model({ room, ...lend(before) })), project(model({ room, ...lend(after, extra) }))).changed);

    // Found in review: these were reported as changed after the first editor save.
    expect(diff('+ lend(days: int): str', 'lend(days: int)', { attributeType: 'str' })).toEqual([]);
    expect(diff('+ borrow()', 'borrow()', { attributeType: 'str' })).toEqual([]);
    // And these were missed.
    expect(diff('+ lend(days: int): str', '+ lend(days: int): int')).toHaveLength(1);
    expect(diff('+ lend()', '+ lend(days: int)')).toHaveLength(1);
  });

  it('sees visibility and a class turning abstract', () => {
    const visibility = diffClassModels(
      project(model({ room, roomNumber })),
      project(model({ room, roomNumber: { ...roomNumber, name: '- number: str' } })),
    );
    expect(names(visibility.changed)).toEqual(['- number: str']);

    const kind = diffClassModels(project(model({ room })), project(model({ room: { ...room, type: 'AbstractClass' } })));
    expect(names(kind.changed)).toEqual(['Room']);
  });

  it('counts relationships, so a new association is not "the same"', () => {
    // Found in review: a new association was drawn while the bar said the diagrams were the same.
    const changes = diffClassModels(project(model({ room }, { r1: {} })), project(model({ room }, { r2: {}, r3: {} })));

    expect(changes.relationshipsAdded).toBe(2);
    expect(changes.relationshipsRemoved).toBe(1);
    expect(hasModelChanges(changes)).toBe(true);
  });

  it('treats everything as new when the base held no model', () => {
    expect(names(diffClassModels(null, project(model({ room }))).added)).toEqual(['Room']);
  });
});

describe('soleAuthor', () => {
  const commit = (login: string | null, author = 'name', is_merge = false) =>
    ({ sha: '', message: '', author, author_login: login, is_merge, date: '', html_url: '', origin: null });

  it('is the one person behind the commits, merges aside', () => {
    expect(soleAuthor([commit('ana', 'name', true), commit('ben'), commit('ben')])).toBe('ben');
  });

  it('is nobody when several worked on them', () => {
    expect(soleAuthor([commit('ana'), commit('ben')])).toBeNull();
  });

  it('uses the git name when GitHub matched no account', () => {
    expect(soleAuthor([commit(null, 'Ben Smith')])).toBe('Ben Smith');
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
    const changes = { added: [{ id: 'elsewhere', name: 'Elsewhere' }], changed: [], removed: [], relationshipsAdded: 0, relationshipsRemoved: 0 };
    expect(idsToDraw(changes, model({}), model({ room }))).toEqual([]);
  });
});
