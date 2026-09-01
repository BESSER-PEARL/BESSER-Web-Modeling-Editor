import { describe, it, expect } from 'vitest';
import type { UMLModel } from '@besser/wme';
import {
  splitUserDiagramIntoProfiles,
  readUserBoxName,
  uniquifyNames,
  uniquifyUserModelNames,
  mergeSingletonBoxes,
  flattenUserDiagramForBackend,
  reinjectHiddenContainers,
} from '../user-profile-graph';

/* ------------------------------------------------------------------ */
/*  Model builders                                                     */
/* ------------------------------------------------------------------ */

const box = (id: string, className: string, attributes: string[] = [], icon?: string) => ({
  id,
  type: 'UserModelName',
  name: className.toLowerCase(),
  className,
  owner: null,
  attributes,
  ...(icon ? { icon } : {}),
});

const attr = (id: string, owner: string, name: string) => ({
  id,
  type: 'UserModelAttribute',
  name,
  owner,
});

const icon = (id: string, owner: string) => ({ id, type: 'UserModelIcon', owner });

const link = (id: string, source: string, target: string) => ({
  id,
  type: 'ObjectLink',
  source: { element: source },
  target: { element: target },
});

const asModel = (elements: Record<string, any>, relationships: Record<string, any>): UMLModel =>
  ({ type: 'UserDiagram', elements, relationships } as unknown as UMLModel);

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('splitUserDiagramIntoProfiles', () => {
  it('splits two Users sharing a box into two profiles that both contain the shared box', () => {
    // u1 --- culture (shared) --- u2 ;  u1 also owns pi1
    const elements: Record<string, any> = {
      u1: box('u1', 'User', ['u1name']),
      u1name: attr('u1name', 'u1', 'name = Alice'),
      u2: box('u2', 'User', ['u2name']),
      u2name: attr('u2name', 'u2', 'name = Bob'),
      culture: box('culture', 'Culture', ['crel']),
      crel: attr('crel', 'culture', 'religion = Islam'),
      pi1: box('pi1', 'Personal_Information', ['age']),
      age: attr('age', 'pi1', 'age >= 18'),
    };
    const relationships: Record<string, any> = {
      r1: link('r1', 'u1', 'culture'),
      r2: link('r2', 'u2', 'culture'),
      r3: link('r3', 'u1', 'pi1'),
    };

    const profiles = splitUserDiagramIntoProfiles(asModel(elements, relationships));
    expect(profiles).toHaveLength(2);

    const byRoot = Object.fromEntries(profiles.map((p) => [p.rootBoxId, p]));
    const alice = byRoot.u1;
    const bob = byRoot.u2;

    expect(alice.name).toBe('Alice');
    expect(bob.name).toBe('Bob');

    const boxIds = (m: UMLModel) =>
      Object.values((m as any).elements)
        .filter((e: any) => e.type === 'UserModelName')
        .map((e: any) => e.id)
        .sort();

    // Shared culture box is present in BOTH profiles (not duplicated away).
    expect(boxIds(alice.model)).toEqual(['culture', 'pi1', 'u1']);
    expect(boxIds(bob.model)).toEqual(['culture', 'u2']);
  });

  it('treats other Users as walls: two Users linked only through each other do not merge', () => {
    // u1 --- u2 : traversal from u1 must not cross into u2's subgraph.
    const elements: Record<string, any> = {
      u1: box('u1', 'User', []),
      u2: box('u2', 'User', ['pi_link']),
      pi: box('pi', 'Personal_Information', []),
    };
    const relationships: Record<string, any> = {
      r1: link('r1', 'u1', 'u2'),
      r2: link('r2', 'u2', 'pi'),
    };

    const profiles = splitUserDiagramIntoProfiles(asModel(elements, relationships));
    const byRoot = Object.fromEntries(profiles.map((p) => [p.rootBoxId, p]));

    const boxIds = (m: UMLModel) =>
      Object.values((m as any).elements)
        .filter((e: any) => e.type === 'UserModelName')
        .map((e: any) => e.id)
        .sort();

    // u1's profile is just u1 (the wall stops it reaching pi through u2).
    expect(boxIds(byRoot.u1.model)).toEqual(['u1']);
    // u2 reaches pi normally.
    expect(boxIds(byRoot.u2.model)).toEqual(['pi', 'u2']);
  });

  it('includes each member box’s attribute and icon children, and only in-profile links', () => {
    const elements: Record<string, any> = {
      u1: box('u1', 'User', ['u1name'], 'u1icon'),
      u1name: attr('u1name', 'u1', 'name = Alice'),
      u1icon: icon('u1icon', 'u1'),
      pi: box('pi', 'Personal_Information', ['age']),
      age: attr('age', 'pi', 'age >= 18'),
      // A stray User + box that must not leak into u1's profile.
      u2: box('u2', 'User', []),
      other: box('other', 'Personal_Information', []),
    };
    const relationships: Record<string, any> = {
      r1: link('r1', 'u1', 'pi'),
      r2: link('r2', 'u2', 'other'),
    };

    const [alice] = splitUserDiagramIntoProfiles(asModel(elements, relationships));
    const ids = Object.keys((alice.model as any).elements).sort();
    expect(ids).toEqual(['age', 'pi', 'u1', 'u1icon', 'u1name']);

    // Only the u1<->pi link survives; the u2<->other link is excluded.
    const relIds = Object.keys((alice.model as any).relationships);
    expect(relIds).toEqual(['r1']);
  });

  it('de-dups duplicate box names within a profile (backend rejects duplicate object names)', () => {
    // A User linked to two Personal_Information boxes that both carry the
    // palette default name `personal_information` — a model saved before
    // create-time uniquification. The emitted sub-model must rename the clash.
    const elements: Record<string, any> = {
      u1: box('u1', 'User', []),
      pi1: box('pi1', 'Personal_Information', []),
      pi2: box('pi2', 'Personal_Information', []),
    };
    const relationships: Record<string, any> = {
      r1: link('r1', 'u1', 'pi1'),
      r2: link('r2', 'u1', 'pi2'),
    };

    const [profile] = splitUserDiagramIntoProfiles(asModel(elements, relationships));
    const names = Object.values((profile.model as any).elements)
      .filter((e: any) => e.type === 'UserModelName')
      .map((e: any) => e.name);
    // All box names are distinct.
    expect(new Set(names).size).toBe(names.length);

    // The original canvas model is untouched (we clone on rename).
    expect(elements.pi1.name).toBe('personal_information');
    expect(elements.pi2.name).toBe('personal_information');
  });

  it('returns [] when the model has no User box', () => {
    const elements = { pi: box('pi', 'Personal_Information', []) };
    expect(splitUserDiagramIntoProfiles(asModel(elements, {}))).toEqual([]);
  });

  it('reads an empty name when the User has no name attribute', () => {
    const elements = { u1: box('u1', 'User', []) };
    const [p] = splitUserDiagramIntoProfiles(asModel(elements, {}));
    expect(p.name).toBe('');
  });
});

describe('readUserBoxName', () => {
  it('reads the value of the sibling name criterion', () => {
    const elements = {
      u1: box('u1', 'User', ['n']),
      n: attr('n', 'u1', 'name = Claire'),
    };
    expect(readUserBoxName(elements.u1, elements)).toBe('Claire');
  });

  it('returns empty string when no name attribute is present', () => {
    const elements = { u1: box('u1', 'User', ['x']), x: attr('x', 'u1', 'age >= 18') };
    expect(readUserBoxName(elements.u1, elements)).toBe('');
  });
});

describe('uniquifyUserModelNames', () => {
  it('gives every UserModelName box a diagram-wide-unique name', () => {
    // Two Users + two Personal_Information boxes, all at the palette default.
    const elements: Record<string, any> = {
      u1: { id: 'u1', type: 'UserModelName', name: 'user_1', className: 'User' },
      u2: { id: 'u2', type: 'UserModelName', name: 'user_1', className: 'User' },
      pi1: { id: 'pi1', type: 'UserModelName', name: 'personal_Information_1', className: 'Personal_Information' },
      pi2: { id: 'pi2', type: 'UserModelName', name: 'personal_Information_1', className: 'Personal_Information' },
      a1: { id: 'a1', type: 'UserModelAttribute', name: 'age >= 18', owner: 'pi1' },
    };
    const model = { type: 'UserDiagram', elements, relationships: {} } as any;

    const out = uniquifyUserModelNames(model);
    const names = Object.values(out.elements)
      .filter((e: any) => e.type === 'UserModelName')
      .map((e: any) => e.name)
      .sort();
    expect(names).toEqual(['personal_Information_1', 'personal_Information_2', 'user_1', 'user_2']);
    // Non-box elements are untouched.
    expect(out.elements.a1.name).toBe('age >= 18');
    // Input model is not mutated (pure).
    expect(model.elements.u2.name).toBe('user_1');
  });

  it('returns the same reference when nothing collides (no needless clone)', () => {
    const model = {
      type: 'UserDiagram',
      elements: { u1: { id: 'u1', type: 'UserModelName', name: 'user_1', className: 'User' } },
      relationships: {},
    } as any;
    expect(uniquifyUserModelNames(model)).toBe(model);
  });

  it('passes non-UserDiagram models through untouched', () => {
    const model = { type: 'ClassDiagram', elements: {}, relationships: {} } as any;
    expect(uniquifyUserModelNames(model)).toBe(model);
    expect(uniquifyUserModelNames(null)).toBe(null);
  });
});

describe('mergeSingletonBoxes', () => {
  const boxIdsOfClass = (m: any, className: string) =>
    Object.values(m.elements)
      .filter((e: any) => e.type === 'UserModelName' && e.className === className)
      .map((e: any) => e.id);

  it('fuses same-parent siblings of a single-cardinality class (age + nationality → one Personal_Information)', () => {
    // u1 --- piAge (Personal_Information: age)   [both 0..1 children of User]
    //    \--- piNat (Personal_Information: nationality)
    const elements: Record<string, any> = {
      u1: box('u1', 'User', []),
      piAge: box('piAge', 'Personal_Information', ['age']),
      age: attr('age', 'piAge', 'age >= 18'),
      piNat: box('piNat', 'Personal_Information', ['nat']),
      nat: attr('nat', 'piNat', 'nationality_iso3166 = FR'),
    };
    const relationships: Record<string, any> = {
      r1: link('r1', 'u1', 'piAge'),
      r2: link('r2', 'u1', 'piNat'),
    };

    const out = mergeSingletonBoxes(asModel(elements, relationships));

    // The two Personal_Information boxes collapse into one.
    const piBoxes = boxIdsOfClass(out, 'Personal_Information');
    expect(piBoxes).toHaveLength(1);

    // The surviving box carries BOTH criteria.
    const survivor = out.elements[piBoxes[0]];
    const attrNames = survivor.attributes.map((aid: string) => out.elements[aid].name).sort();
    expect(attrNames).toEqual(['age >= 18', 'nationality_iso3166 = FR']);
    // Re-homed attribute now points at the surviving box.
    expect(out.elements.nat.owner).toBe(piBoxes[0]);

    // Only one User→Personal_Information link survives (the duplicate is dropped).
    expect(Object.keys(out.relationships)).toHaveLength(1);

    // Input model is untouched (pure).
    expect(boxIdsOfClass(asModel(elements, relationships), 'Personal_Information')).toHaveLength(2);
    expect(elements.nat.owner).toBe('piNat');
  });

  it('does NOT fuse a repeatable (0..*) child class (two Skills stay two objects)', () => {
    // u1 --- comp (Competence) --- skill1, skill2   [Competence→Skill is 0..*]
    const elements: Record<string, any> = {
      u1: box('u1', 'User', []),
      comp: box('comp', 'Competence', []),
      s1: box('s1', 'Skill', []),
      s2: box('s2', 'Skill', []),
    };
    const relationships: Record<string, any> = {
      r1: link('r1', 'u1', 'comp'),
      r2: link('r2', 'comp', 's1'),
      r3: link('r3', 'comp', 's2'),
    };

    const model = asModel(elements, relationships);
    const out = mergeSingletonBoxes(model);
    expect(boxIdsOfClass(out, 'Skill')).toHaveLength(2);
    // Nothing to merge -> same reference returned (pure, no needless clone).
    expect(out).toBe(model);
  });

  it('returns the same reference when there is nothing to merge', () => {
    const elements: Record<string, any> = {
      u1: box('u1', 'User', []),
      pi: box('pi', 'Personal_Information', []),
    };
    const model = asModel(elements, { r1: link('r1', 'u1', 'pi') });
    expect(mergeSingletonBoxes(model)).toBe(model);
  });

  it('passes non-UserDiagram models through untouched', () => {
    const model = { type: 'ClassDiagram', elements: {}, relationships: {} } as any;
    expect(mergeSingletonBoxes(model)).toBe(model);
  });
});

describe('flattenUserDiagramForBackend', () => {
  const boxes = (m: any) =>
    Object.values(m.elements).filter((e: any) => e.type === 'UserModelName') as any[];

  it('gives each User a private copy of a shared box (one owner per object)', () => {
    // u1 --- culture (shared) --- u2 : Culture is a 0..1 child of User.
    const elements: Record<string, any> = {
      u1: box('u1', 'User', ['u1n']),
      u1n: attr('u1n', 'u1', 'name = Alice'),
      u2: box('u2', 'User', ['u2n']),
      u2n: attr('u2n', 'u2', 'name = Bob'),
      culture: box('culture', 'Culture', []),
    };
    const relationships: Record<string, any> = {
      r1: link('r1', 'u1', 'culture'),
      r2: link('r2', 'u2', 'culture'),
    };

    const out = flattenUserDiagramForBackend(asModel(elements, relationships));

    // Two Users + one private Culture each = 2 User boxes + 2 Culture boxes.
    expect(boxes(out).filter((b) => b.className === 'User')).toHaveLength(2);
    expect(boxes(out).filter((b) => b.className === 'Culture')).toHaveLength(2);

    // Every box id is unique, and every object name is diagram-wide-unique.
    const ids = boxes(out).map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    const names = boxes(out).map((b) => b.name);
    expect(new Set(names).size).toBe(names.length);

    // Each Culture is linked from exactly one User (cardinality satisfied).
    const cultureIds = new Set(boxes(out).filter((b) => b.className === 'Culture').map((b) => b.id));
    Object.values(out.relationships).forEach((rel: any) => {
      const endpoints = [rel.source.element, rel.target.element];
      const cultureEnd = endpoints.filter((e) => cultureIds.has(e));
      expect(cultureEnd).toHaveLength(1);
    });
  });

  it('fuses single-cardinality chips within each profile', () => {
    // One User with age + nationality chips -> one Personal_Information object.
    const elements: Record<string, any> = {
      u1: box('u1', 'User', []),
      piAge: box('piAge', 'Personal_Information', ['age']),
      age: attr('age', 'piAge', 'age >= 18'),
      piNat: box('piNat', 'Personal_Information', ['nat']),
      nat: attr('nat', 'piNat', 'nationality_iso3166 = FR'),
    };
    const relationships: Record<string, any> = {
      r1: link('r1', 'u1', 'piAge'),
      r2: link('r2', 'u1', 'piNat'),
    };

    const out = flattenUserDiagramForBackend(asModel(elements, relationships));
    expect(boxes(out).filter((b) => b.className === 'Personal_Information')).toHaveLength(1);
  });

  it('passes non-UserDiagram models through untouched', () => {
    const model = { type: 'ClassDiagram', elements: {}, relationships: {} } as any;
    expect(flattenUserDiagramForBackend(model)).toBe(model);
  });
});

describe('reinjectHiddenContainers', () => {
  // Helpers to read the re-nested topology by class name.
  const boxesOfClass = (m: any, className: string) =>
    Object.values(m.elements).filter((e: any) => e.type === 'UserModelName' && e.className === className) as any[];
  const links = (m: any) => Object.values(m.relationships) as any[];
  const classOf = (m: any, id: string) => m.elements[id]?.className;

  it('re-nests flat User→Disability through a single Accessibility container', () => {
    const elements: Record<string, any> = {
      u1: box('u1', 'User', []),
      d1: box('d1', 'Disability', []),
      d2: box('d2', 'Disability', []),
    };
    const relationships: Record<string, any> = {
      r1: link('r1', 'u1', 'd1'),
      r2: link('r2', 'u1', 'd2'),
    };

    const out = reinjectHiddenContainers(asModel(elements, relationships));

    // Exactly one Accessibility box is created and shared by both Disabilities.
    const acc = boxesOfClass(out, 'Accessibility');
    expect(acc).toHaveLength(1);
    const accId = acc[0].id;
    expect(acc[0].classId).toBeTruthy();
    expect(acc[0].attributes).toEqual([]);

    // User → Accessibility (once); Accessibility → each Disability.
    const userToAcc = links(out).filter(
      (r) => r.source.element === 'u1' && r.target.element === accId,
    );
    expect(userToAcc).toHaveLength(1);

    const accToDis = links(out).filter((r) => r.source.element === accId && classOf(out, r.target.element) === 'Disability');
    expect(accToDis.map((r) => r.target.element).sort()).toEqual(['d1', 'd2']);

    // No direct User→Disability link survives.
    expect(links(out).some((r) => r.source.element === 'u1' && classOf(out, r.target.element) === 'Disability')).toBe(
      false,
    );

    // Input model is untouched (pure).
    expect(boxesOfClass(asModel(elements, relationships), 'Accessibility')).toHaveLength(0);
  });

  it('re-nests Skill/Language/Education under a single Competence and leaves Personal_Information direct', () => {
    const elements: Record<string, any> = {
      u1: box('u1', 'User', []),
      s1: box('s1', 'Skill', []),
      l1: box('l1', 'Language', []),
      e1: box('e1', 'Education', []),
      pi: box('pi', 'Personal_Information', ['age']),
      age: attr('age', 'pi', 'age >= 18'),
    };
    const relationships: Record<string, any> = {
      r1: link('r1', 'u1', 's1'),
      r2: link('r2', 'u1', 'l1'),
      r3: link('r3', 'u1', 'e1'),
      r4: link('r4', 'u1', 'pi'),
    };

    const out = reinjectHiddenContainers(asModel(elements, relationships));

    // One Competence groups all three competence children.
    const comp = boxesOfClass(out, 'Competence');
    expect(comp).toHaveLength(1);
    const compId = comp[0].id;

    const compChildren = links(out)
      .filter((r) => r.source.element === compId)
      .map((r) => classOf(out, r.target.element))
      .sort();
    expect(compChildren).toEqual(['Education', 'Language', 'Skill']);

    // Personal_Information stays a direct child of User (no route matches it).
    expect(links(out).some((r) => r.source.element === 'u1' && r.target.element === 'pi')).toBe(true);
    expect(boxesOfClass(out, 'Accessibility')).toHaveLength(0);
  });

  it('handles a direction-reversed link (child→User) the same way', () => {
    const elements: Record<string, any> = {
      u1: box('u1', 'User', []),
      d1: box('d1', 'Disability', []),
    };
    // Link drawn Disability → User (reverse of the parent→child convention).
    const relationships: Record<string, any> = { r1: link('r1', 'd1', 'u1') };

    const out = reinjectHiddenContainers(asModel(elements, relationships));
    const acc = boxesOfClass(out, 'Accessibility');
    expect(acc).toHaveLength(1);
    const accId = acc[0].id;
    // User → Accessibility and Accessibility → Disability both exist.
    expect(links(out).some((r) => r.source.element === 'u1' && r.target.element === accId)).toBe(true);
    expect(links(out).some((r) => r.source.element === accId && r.target.element === 'd1')).toBe(true);
  });

  it('returns the same reference when there is nothing to re-nest', () => {
    const elements: Record<string, any> = {
      u1: box('u1', 'User', []),
      pi: box('pi', 'Personal_Information', []),
    };
    const model = asModel(elements, { r1: link('r1', 'u1', 'pi') });
    expect(reinjectHiddenContainers(model)).toBe(model);
  });

  it('passes non-UserDiagram models through untouched', () => {
    const model = { type: 'ClassDiagram', elements: {}, relationships: {} } as any;
    expect(reinjectHiddenContainers(model)).toBe(model);
    expect(reinjectHiddenContainers(null)).toBe(null);
  });
});

describe('flattenUserDiagramForBackend (hidden-container re-injection)', () => {
  const boxes = (m: any) => Object.values(m.elements).filter((e: any) => e.type === 'UserModelName') as any[];
  const boxesOfClass = (m: any, className: string) => boxes(m).filter((b) => b.className === className);
  const classOf = (m: any, id: string) => m.elements[id]?.className;

  it('re-nests a flat User→Disability + User→Skill + User→Language profile end-to-end', () => {
    const elements: Record<string, any> = {
      u1: box('u1', 'User', ['u1n']),
      u1n: attr('u1n', 'u1', 'name = Alice'),
      d1: box('d1', 'Disability', []),
      s1: box('s1', 'Skill', []),
      lang1: box('lang1', 'Language', []),
    };
    const relationships: Record<string, any> = {
      r1: link('r1', 'u1', 'd1'),
      r2: link('r2', 'u1', 's1'),
      r3: link('r3', 'u1', 'lang1'),
    };

    const out = flattenUserDiagramForBackend(asModel(elements, relationships));

    // One Accessibility and one Competence container injected for the profile.
    expect(boxesOfClass(out, 'Accessibility')).toHaveLength(1);
    expect(boxesOfClass(out, 'Competence')).toHaveLength(1);

    // Container names are diagram-wide-unique (uniquifyUserModelNames ran).
    const names = boxes(out).map((b) => b.name);
    expect(new Set(names).size).toBe(names.length);

    // The chain User→Competence→{Skill,Language} holds.
    const compId = boxesOfClass(out, 'Competence')[0].id;
    const compChildren = Object.values(out.relationships)
      .filter((r: any) => r.source.element === compId)
      .map((r: any) => classOf(out, r.target.element))
      .sort();
    expect(compChildren).toEqual(['Language', 'Skill']);

    // No direct User→{Disability,Skill,Language} link leaks to the backend.
    const userId = boxesOfClass(out, 'User')[0].id;
    const leaks = Object.values(out.relationships).filter(
      (r: any) =>
        r.source.element === userId && ['Disability', 'Skill', 'Language'].includes(classOf(out, r.target.element)),
    );
    expect(leaks).toHaveLength(0);
  });
});

describe('uniquifyNames', () => {
  it('fills empty names with user_<n> and de-duplicates collisions', () => {
    const out = uniquifyNames([
      { name: 'french' },
      { name: '' },
      { name: 'french' },
      { name: '   ' },
    ]);
    expect(out.map((e) => e.name)).toEqual(['french', 'user_2', 'french (2)', 'user_4']);
  });
});
