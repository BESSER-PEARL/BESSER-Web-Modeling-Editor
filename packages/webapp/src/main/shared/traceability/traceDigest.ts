import type { CodeArtifact, ModelArtifact, TraceArtifact, TraceEvidence, TraceFile, TraceOperation } from '../types/traceability';
import { changesOf, isCodeArtifact, isModelArtifact, isPromptArtifact, isRequirementArtifact, toolIdsOf } from '../types/traceability';
import { lineageOf } from './lineage';
import { requirementCoverage } from './requirementCoverage';
import type { TraceIndex } from './traceQueries';
import {
  generatedFrom, historyOf, isDeleted, isDiagram, MAX_PARENT_DEPTH, outOfDate, qualifiedName, resolveArtifactId, withDescendants,
} from './traceQueries';
import { traceSummary } from './traceSummary';

/**
 * The trace digest the assistant gets in `context.traceDigest`: a bounded, read-only summary of the project's
 * trace, so the modeling agent can answer questions about it ("why does Book have an isbn?", "what is out of
 * date?"). The wire format is section 3 of the cross-repo traceability contract; the agent re-validates and
 * re-caps it (`modeling-agent/src/protocol/adapters.py::_parse_trace_digest`), so the caps below equal its own.
 *
 * Pure function of the trace and the user's message. It never carries file contents or prompt texts beyond the
 * capped `text` / `quote` of a requirement.
 */

export const TRACE_DIGEST_SCHEMA_VERSION = 1;

/** Caps, the same as the agent's `TRACE_DIGEST_*` (`modeling-agent/src/common/agent_config.py`). */
export const TRACE_DIGEST_CAPS = {
  recentOperations: 15,
  requirements: 40,
  outOfDate: 30,
  generations: 10,
  focus: 5,
  focusHistory: 20,
  focusDerivedFrom: 10,
  focusDerived: 20,
  listItems: 20,
  nameChars: 200,
  textChars: 500,
} as const;

/** The serialized digest stays within this many characters (the contract says "about 12k"). */
export const TRACE_DIGEST_MAX_CHARS = 12000;

export type TraceDigestOperationType = 'ModelingSession' | 'CodeGeneration' | 'RequirementExtraction' | 'Conversation';
export type TraceDigestReason = 'SOURCE_CHANGED' | 'TARGET_CHANGED' | 'UPSTREAM_CHANGED';

export interface TraceDigestOperation {
  id: string;
  type: string;
  status: string;
  startedAt: string;
  by?: string[];
  tools?: string[];
  summary?: string;
}

export interface TraceDigestRequirement {
  id: string;
  kind: string;
  text: string;
  quote?: string;
  realizedBy?: string[];
  covered: boolean;
}

export interface TraceDigestOutOfDate {
  source: string;
  target: string;
  reasons: TraceDigestReason[];
  generation?: string;
}

export interface TraceDigestGeneration {
  generator: string;
  at: string;
  files: number;
  outOfDateFiles: number;
}

export interface TraceDigestChange {
  kind: 'CREATED' | 'UPDATED' | 'DELETED';
  feature?: string;
  old?: string;
  new?: string;
  at: string;
  by?: string;
  via?: string;
}

export interface TraceDigestSource {
  type: 'Requirement' | 'Prompt' | 'Model';
  name: string;
  evidence?: string;
}

export interface TraceDigestDerived {
  path: string;
  lines?: string;
  outOfDate?: TraceDigestReason[];
}

export interface TraceDigestFocus {
  artifactId: string;
  name: string;
  elementType?: string;
  history?: TraceDigestChange[];
  derivedFrom?: TraceDigestSource[];
  derived?: TraceDigestDerived[];
}

export interface TraceDigest {
  schemaVersion: 1;
  recording: boolean;
  counts: {
    artifacts: number;
    links: number;
    outOfDateLinks: number;
    operations: Record<TraceDigestOperationType, number>;
  };
  recentOperations?: TraceDigestOperation[];
  requirements?: TraceDigestRequirement[];
  outOfDate?: TraceDigestOutOfDate[];
  generations?: TraceDigestGeneration[];
  focus?: TraceDigestFocus[];
}

export interface TraceDigestOptions {
  /** A human-readable one-line summary of an operation ("Created class Book; ..."). Left out: none is sent. */
  summarize?: (operation: TraceOperation, index: TraceIndex) => string;
  /** Whether recording is on for the project; the digest says so. Default true. */
  recording?: boolean;
  /** Serialized size bound; default {@link TRACE_DIGEST_MAX_CHARS}. */
  maxChars?: number;
  /** The editor ids of the elements selected on the canvas, in order: the focus when the message names none, so
   *  "what does changing this affect?" is answered about the selection. */
  selected?: readonly string[];
}

const OPERATION_TYPES: readonly TraceDigestOperationType[] = [
  'ModelingSession', 'CodeGeneration', 'RequirementExtraction', 'Conversation',
];

const cap = (value: string, max: number): string => (value.length > max ? value.slice(0, max) : value);
const name = (value: string): string => cap(value, TRACE_DIGEST_CAPS.nameChars);
const text = (value: string): string => cap(value, TRACE_DIGEST_CAPS.textChars);
const names = (values: string[]): string[] => values.filter(Boolean).slice(0, TRACE_DIGEST_CAPS.listItems).map(name);

const reasonsOf = (reasons: string[]): TraceDigestReason[] => reasons as TraceDigestReason[];

const byNewest = <T>(time: (item: T) => string) => (a: T, b: T) => time(b).localeCompare(time(a));

/** "Person:Ana", "Agent:modeling-assistant". */
function actorsOf(index: TraceIndex, operation: TraceOperation): string[] {
  return names(
    operation.performedBy.flatMap((id) => {
      const actor = index.actorsById.get(id);
      return actor ? [`${actor.type}:${actor.name}`] : [];
    }),
  );
}

const toolNamesOf = (index: TraceIndex, operation: TraceOperation): string[] =>
  names(toolIdsOf(operation).flatMap((id) => {
    const tool = index.toolsById.get(id);
    return tool ? [tool.name] : [];
  }));

const generatorOf = (index: TraceIndex, operation: TraceOperation): string =>
  toolIdsOf(operation).map((id) => index.toolsById.get(id)).find((tool) => tool?.type === 'CodeGenerator')?.name ?? 'code generator';

/** `Book.isbn`, or a file's path with its lines: `sql_alchemy.py:108-140`. */
function endName(index: TraceIndex, artifact: TraceArtifact): string {
  if (isCodeArtifact(artifact)) {
    const lines = linesOf(artifact);
    return lines ? `${artifact.path}:${lines}` : artifact.path;
  }
  return qualifiedName(index, artifact);
}

const linesOf = (code: CodeArtifact): string | undefined =>
  code.startLine !== undefined ? `${code.startLine}-${code.endLine ?? code.startLine}` : undefined;

function evidenceText(evidence: TraceEvidence[]): string | undefined {
  const parts = evidence.map((e) => (e.type === 'AIEvidence' ? `AIEvidence: ${e.algorithm}` : `RuleEvidence: ${e.rule}`));
  return parts.length > 0 ? text(parts.join('; ')) : undefined;
}

/* ---------------------------------------------------------------- focus */

const WORD_CHAR = /[\p{L}\p{N}_]/u;
const WORDS = /[\p{L}\p{N}_]+/gu;
const isWordChar = (char: string | undefined): boolean => char !== undefined && WORD_CHAR.test(char);

/** The index in `message` where `phrase` appears as a whole word (case-insensitive), or -1. */
export function wholeWordIndex(message: string, phrase: string): number {
  if (!phrase.trim()) return -1;
  return wholeWordIndexLower(message.toLowerCase(), phrase.toLowerCase());
}

/** {@link wholeWordIndex} on text already lowercased: a plain search with a check of the characters around. */
function wholeWordIndexLower(message: string, phrase: string): number {
  for (let at = message.indexOf(phrase); at >= 0; at = message.indexOf(phrase, at + 1)) {
    // A phrase that starts (ends) with a word character must not continue a word before (after) it.
    const before = isWordChar(phrase[0]) && isWordChar(message[at - 1]);
    const after = isWordChar(phrase[phrase.length - 1]) && isWordChar(message[at + phrase.length]);
    if (!before && !after) return at;
  }
  return -1;
}

/** Names with at most this many words are found by the message's words; longer ones by a plain search. */
const MAX_NAME_WORDS = 32;

/**
 * What the focus is looked up in, built once per trace index (one per trace revision) and kept with it: every model
 * artifact a message can name, by its lowercased name and, for a member, its lowercased `Owner.member` name.
 */
interface FocusLookup {
  /** Lowercased name -> artifacts of that name (elements and members alike). */
  byName: Map<string, ModelArtifact[]>;
  /** Lowercased `Owner.member` name -> members of that name. */
  byQualified: Map<string, ModelArtifact[]>;
  /** The member's owner, for each member. */
  ownerOf: Map<string, ModelArtifact>;
  /** The most words a name of `byName` / `byQualified` has. */
  maxWords: number;
  /** Names that do not start and end with a word character, or with too many words: searched for one by one. */
  odd: string[];
}

const focusLookups = new WeakMap<TraceIndex, FocusLookup>();

function focusLookupOf(index: TraceIndex): FocusLookup {
  let lookup = focusLookups.get(index);
  if (lookup) return lookup;
  lookup = { byName: new Map(), byQualified: new Map(), ownerOf: new Map(), maxWords: 1, odd: [] };
  const { byName, byQualified, ownerOf, odd } = lookup;
  const oddSet = new Set<string>();
  const add = (map: Map<string, ModelArtifact[]>, phrase: string, artifact: ModelArtifact) => {
    const key = phrase.toLowerCase();
    const list = map.get(key);
    if (list) list.push(artifact);
    else map.set(key, [artifact]);
    const words = key.match(WORDS)?.length ?? 0;
    if (!isWordChar(key[0]) || !isWordChar(key[key.length - 1]) || words > MAX_NAME_WORDS) {
      if (!oddSet.has(key)) {
        oddSet.add(key);
        odd.push(key);
      }
    } else if (words > lookup!.maxWords) {
      lookup!.maxWords = words;
    }
  };
  for (const artifact of index.trace.artifacts) {
    if (!isModelArtifact(artifact) || artifact.name.trim().length < 2) continue;
    const parent = artifact.parentId ? index.artifacts.get(artifact.parentId) : undefined;
    add(byName, artifact.name, artifact);
    if (isModelArtifact(parent) && !isDiagram(parent)) {
      ownerOf.set(artifact.id, parent);
      add(byQualified, `${parent.name}.${artifact.name}`, artifact);
    }
  }
  focusLookups.set(index, lookup);
  return lookup;
}

/** Where each phrase of `lookup` first appears in the (lowercased) message as a whole word. */
function phrasesIn(lookup: FocusLookup, message: string): Map<string, number> {
  const found = new Map<string, number>();
  const note = (phrase: string, at: number) => {
    const known = lookup.byName.has(phrase) || lookup.byQualified.has(phrase);
    const earlier = found.get(phrase);
    if (known && (earlier === undefined || at < earlier)) found.set(phrase, at);
  };
  // Every run of 1 to `maxWords` consecutive words of the message, with what lies between them, is a candidate.
  const words = [...message.matchAll(WORDS)].map((m) => ({ start: m.index!, end: m.index! + m[0].length }));
  for (let first = 0; first < words.length; first += 1) {
    for (let last = first; last < words.length && last - first < lookup.maxWords; last += 1) {
      note(message.slice(words[first].start, words[last].end), words[first].start);
    }
  }
  for (const phrase of lookup.odd) {
    const at = wholeWordIndexLower(message, phrase);
    if (at >= 0) note(phrase, at);
  }
  return found;
}

/**
 * The model artifacts the message names: their name, or the qualified `Owner.member` name, as a whole word.
 * A member named alone ("isbn") counts only when its owner is named too ("isbn of Book"), since member names
 * like `name` or `id` are common words. A matched member beats its owner (and a matched element its diagram).
 * Names of one letter never match. A deleted artifact gives way to a live one of the same name; two live
 * artifacts of one name are both kept (the question is ambiguous). Ordered by where the message names them.
 *
 * The message is split into words once and its runs of words looked up in names indexed once per trace index, so
 * the cost is that of the message, not of the trace.
 */
export function findFocusArtifacts(index: TraceIndex, message: string, max: number = TRACE_DIGEST_CAPS.focus): TraceArtifact[] {
  if (!message.trim()) return [];
  const lookup = focusLookupOf(index);
  const found = phrasesIn(lookup, message.toLowerCase());
  const at = new Map<string, number>();
  const candidate = (artifact: ModelArtifact, position: number) => {
    const earlier = at.get(artifact.id);
    if (earlier === undefined || position < earlier) at.set(artifact.id, position);
  };
  for (const [phrase, position] of found) {
    for (const member of lookup.byQualified.get(phrase) ?? []) candidate(member, position);
  }
  for (const [phrase, position] of found) {
    for (const artifact of lookup.byName.get(phrase) ?? []) {
      const owner = lookup.ownerOf.get(artifact.id);
      if (!owner) candidate(artifact, position);
      // A member named alone, with its owner named too; its qualified name, when named, came first.
      else if (!at.has(artifact.id) && found.has(owner.name.toLowerCase())) candidate(artifact, position);
    }
  }
  const matched = [...at].map(([id, position]) => {
    const artifact = index.artifacts.get(id)!;
    return { artifact, at: position, key: qualifiedName(index, artifact).toLowerCase(), deleted: isDeleted(index, id) };
  });
  // A matched part beats what holds it.
  const candidates = withoutHolders(index, matched);
  const liveKeys = new Set(candidates.filter((c) => !c.deleted).map((c) => c.key));
  return candidates
    .filter((c) => !c.deleted || !liveKeys.has(c.key))
    .sort((a, b) => a.at - b.at || a.key.localeCompare(b.key) || a.artifact.id.localeCompare(b.artifact.id))
    .slice(0, max)
    .map((c) => c.artifact);
}

/** The items without those that hold another item (a class whose attribute is in the list too). */
function withoutHolders<T extends { artifact: TraceArtifact }>(index: TraceIndex, items: T[]): T[] {
  const holders = new Set<string>();
  for (const { artifact } of items) {
    for (let id = artifact.parentId, steps = 0; id && steps < MAX_PARENT_DEPTH; steps += 1) {
      holders.add(id);
      id = index.artifacts.get(id)?.parentId;
    }
  }
  return items.filter(({ artifact }) => !holders.has(artifact.id));
}

/**
 * The model artifacts of the elements selected on the canvas (editor element ids, or trace artifact ids), in
 * selection order: those the trace knows and has not deleted, without a diagram, and a selected part beating what
 * holds it, as for a named focus.
 */
export function selectedFocusArtifacts(
  index: TraceIndex,
  selected: readonly string[],
  max: number = TRACE_DIGEST_CAPS.focus,
): TraceArtifact[] {
  const seen = new Set<string>();
  const found: Array<{ artifact: TraceArtifact }> = [];
  for (const id of selected) {
    const artifactId = resolveArtifactId(index, id);
    const artifact = artifactId ? index.artifacts.get(artifactId) : undefined;
    if (!isModelArtifact(artifact) || isDiagram(artifact) || seen.has(artifact.id) || isDeleted(index, artifact.id)) continue;
    seen.add(artifact.id);
    found.push({ artifact });
  }
  return withoutHolders(index, found).slice(0, max).map(({ artifact }) => artifact);
}

function focusEntry(index: TraceIndex, artifact: TraceArtifact): TraceDigestFocus {
  const entry: TraceDigestFocus = {
    artifactId: name(artifact.id),
    name: name(qualifiedName(index, artifact)),
  };
  if (isModelArtifact(artifact)) entry.elementType = name(artifact.elementType);

  // The artifact's own changes and those of its parts (a class's attributes), oldest first; the newest are kept.
  const history = historyOf(index, artifact.id).map(({ change, operation, artifact: changed }): TraceDigestChange => {
    const feature = changed.id === artifact.id
      ? change.feature
      : [qualifiedName(index, changed), change.feature].filter(Boolean).join(change.feature ? '.' : '');
    const by = actorsOf(index, operation).join(', ');
    const via = toolNamesOf(index, operation).join(', ');
    return {
      kind: change.kind,
      ...(feature ? { feature: name(feature) } : {}),
      ...(change.oldValue ? { old: text(change.oldValue) } : {}),
      ...(change.newValue ? { new: text(change.newValue) } : {}),
      at: name(change.timestamp),
      ...(by ? { by: name(by) } : {}),
      ...(via ? { via: name(via) } : {}),
    };
  });
  if (history.length > 0) entry.history = history.slice(-TRACE_DIGEST_CAPS.focusHistory);

  const parts = withDescendants(index, artifact.id);
  const derivedFrom: TraceDigestSource[] = [];
  const seenLinks = new Set<string>();
  for (const part of parts) {
    for (const link of [...(index.linksByTarget.get(part.id) ?? [])].sort(byNewest((l) => l.timestamp))) {
      const source = index.artifacts.get(link.sourceId);
      if (!source || seenLinks.has(link.id) || isCodeArtifact(source)) continue;
      seenLinks.add(link.id);
      const type = isRequirementArtifact(source) ? 'Requirement' : isPromptArtifact(source) ? 'Prompt' : 'Model';
      const evidence = evidenceText(link.evidence);
      derivedFrom.push({ type, name: name(endName(index, source)), ...(evidence ? { evidence } : {}) });
    }
  }
  if (derivedFrom.length > 0) entry.derivedFrom = derivedFrom.slice(0, TRACE_DIGEST_CAPS.focusDerivedFrom);

  const derived: Array<TraceDigestDerived & { at: string }> = [];
  const seenCode = new Set<string>();
  for (const part of parts) {
    for (const generated of generatedFrom(index, part.id)) {
      if (seenCode.has(generated.link.id)) continue;
      seenCode.add(generated.link.id);
      const lines = linesOf(generated.fragment);
      derived.push({
        path: name(generated.fragment.path),
        ...(lines ? { lines } : {}),
        ...(generated.outOfDate.length > 0 ? { outOfDate: reasonsOf(generated.outOfDate) } : {}),
        at: generated.link.timestamp,
      });
    }
  }
  if (derived.length > 0) {
    entry.derived = derived.sort(byNewest((d) => d.at)).slice(0, TRACE_DIGEST_CAPS.focusDerived).map(({ at: _at, ...rest }) => rest);
  }
  return entry;
}

/* --------------------------------------------------------------- sections */

function recentOperations(index: TraceIndex, newest: TraceOperation[], options: TraceDigestOptions): TraceDigestOperation[] {
  return newest
    .map((operation): TraceDigestOperation => {
      const by = actorsOf(index, operation);
      const tools = toolNamesOf(index, operation);
      const summary = options.summarize?.(operation, index);
      return {
        id: name(operation.id),
        type: operation.type,
        status: operation.status,
        startedAt: name(operation.startedAt),
        ...(by.length > 0 ? { by } : {}),
        ...(tools.length > 0 ? { tools } : {}),
        ...(summary ? { summary: text(summary) } : {}),
      };
    });
}

function requirementsOf(index: TraceIndex): TraceDigestRequirement[] {
  // The requirements of the extraction whose model still stands, as the page shows them.
  const rows = requirementCoverage(index).groups.filter((g) => g.current).flatMap((g) => g.rows);
  return rows
    .slice(0, TRACE_DIGEST_CAPS.requirements)
    .map((row): TraceDigestRequirement => {
      const realizedBy = names(row.realizations.filter((r) => !r.deleted).map((r) => qualifiedName(index, r.element)));
      return {
        id: name(row.requirement.id),
        kind: name(row.requirement.kind),
        text: text(row.requirement.name),
        ...(row.requirement.quote ? { quote: text(row.requirement.quote) } : {}),
        ...(realizedBy.length > 0 ? { realizedBy } : {}),
        covered: row.status !== 'uncovered',
      };
    });
}

function generationsOf(index: TraceIndex): TraceDigestGeneration[] {
  return index.trace.operations
    .filter((o) => o.type === 'CodeGeneration' && index.linksByOperation.has(o.id))
    .sort(byNewest((o) => o.startedAt))
    .slice(0, TRACE_DIGEST_CAPS.generations)
    .map((operation): TraceDigestGeneration => {
      const files = new Map<string, boolean>();
      for (const link of index.linksByOperation.get(operation.id) ?? []) {
        const target = index.artifacts.get(link.targetId);
        if (!isCodeArtifact(target)) continue;
        const parent = target.parentId ? index.artifacts.get(target.parentId) : undefined;
        const file = isCodeArtifact(parent) ? parent : target;
        files.set(file.id, (files.get(file.id) ?? false) || outOfDate(index, link).length > 0);
      }
      return {
        generator: name(generatorOf(index, operation)),
        at: name(operation.startedAt),
        files: files.size,
        outOfDateFiles: [...files.values()].filter(Boolean).length,
      };
    });
}

/* ----------------------------------------------------------------- digest */

/** The part of the digest that does not depend on the message, computed once per trace index (one per trace
 *  revision): the lineage, summary and sections cost a pass over the whole trace each. */
interface DigestBase {
  counts: TraceDigest['counts'];
  newestOperations: TraceOperation[];
  requirements: TraceDigestRequirement[];
  outOfDate: TraceDigestOutOfDate[];
  generations: TraceDigestGeneration[];
}

const digestBases = new WeakMap<TraceIndex, DigestBase>();

function digestBaseOf(trace: TraceFile, index: TraceIndex): DigestBase {
  const cached = digestBases.get(index);
  if (cached) return cached;
  const lineage = lineageOf(index, null, { history: false });
  const summary = traceSummary(index, lineage);
  const operations = Object.fromEntries(OPERATION_TYPES.map((type) => [type, 0])) as Record<TraceDigestOperationType, number>;
  for (const operation of trace.operations) operations[operation.type] += 1;

  const outOfDate = lineage.edges
    .filter((edge) => edge.outOfDate.length > 0)
    .flatMap((edge) => {
      const source = index.artifacts.get(edge.link.sourceId);
      const target = index.artifacts.get(edge.link.targetId);
      return source && target ? [{ edge, source, target }] : [];
    })
    .sort((a, b) => b.edge.link.timestamp.localeCompare(a.edge.link.timestamp)
      || endName(index, a.source).localeCompare(endName(index, b.source))
      || endName(index, a.target).localeCompare(endName(index, b.target)))
    .slice(0, TRACE_DIGEST_CAPS.outOfDate)
    .map(({ edge, source, target }): TraceDigestOutOfDate => {
      const operation = index.operations.get(edge.link.operationId);
      const generation = operation?.type === 'CodeGeneration'
        ? `${generatorOf(index, operation)} @ ${operation.startedAt}`
        : undefined;
      return {
        source: name(endName(index, source)),
        target: name(endName(index, target)),
        reasons: reasonsOf(edge.outOfDate),
        ...(generation ? { generation: name(generation) } : {}),
      };
    });

  const base: DigestBase = {
    counts: { artifacts: summary.artifacts, links: summary.links, outOfDateLinks: summary.outOfDateLinks, operations },
    newestOperations: [...trace.operations].sort(byNewest((o) => o.startedAt)).slice(0, TRACE_DIGEST_CAPS.recentOperations),
    requirements: requirementsOf(index),
    outOfDate,
    generations: generationsOf(index),
  };
  digestBases.set(index, base);
  return base;
}

/**
 * The digest of `trace` for a user message: counts, the newest operations, the current requirements with what
 * realizes them, the links that may be out of date, the newest generations, and, for the artifacts the message
 * names (else those selected on the canvas, `options.selected`), their history, what they were derived from and
 * what was derived from them.
 *
 * The serialized result is at most `options.maxChars` (default 12,000) characters. Beyond the per-string and
 * per-list caps, lists are shortened from their end, the least valuable first: recent operations, generations,
 * requirements, out-of-date links, and last the focus (whose own history, sources and code are cut before an
 * entry is dropped).
 */
export function buildTraceDigest(
  trace: TraceFile,
  index: TraceIndex,
  message: string,
  options: TraceDigestOptions = {},
): TraceDigest {
  const maxChars = options.maxChars ?? TRACE_DIGEST_MAX_CHARS;
  const base = digestBaseOf(trace, index);
  const digest: TraceDigest = {
    schemaVersion: TRACE_DIGEST_SCHEMA_VERSION,
    recording: options.recording ?? true,
    counts: { ...base.counts, operations: { ...base.counts.operations } },
  };

  const recent = recentOperations(index, base.newestOperations, options);
  if (recent.length > 0) digest.recentOperations = recent;
  // Copies: fitting the digest shortens its lists.
  if (base.requirements.length > 0) digest.requirements = [...base.requirements];
  if (base.outOfDate.length > 0) digest.outOfDate = [...base.outOfDate];
  if (base.generations.length > 0) digest.generations = [...base.generations];

  const named = findFocusArtifacts(index, message);
  const focusArtifacts = named.length > 0 ? named : selectedFocusArtifacts(index, options.selected ?? []);
  const focus = focusArtifacts.map((artifact) => focusEntry(index, artifact));
  if (focus.length > 0) digest.focus = focus;

  return fitDigest(digest, maxChars);
}

const size = (digest: TraceDigest): number => JSON.stringify(digest).length;

/** The lists in the order they are shortened: the least valuable first. */
const TRIM_ORDER = ['recentOperations', 'generations', 'requirements', 'outOfDate'] as const;

function fitDigest(digest: TraceDigest, maxChars: number): TraceDigest {
  for (const key of TRIM_ORDER) {
    const list = digest[key] as unknown[] | undefined;
    while (list && list.length > 0 && size(digest) > maxChars) list.pop();
    if (list && list.length === 0) delete digest[key];
  }
  // Only the focus is left: shorten the last entry's lists, then drop it, and so on up.
  const focus = digest.focus;
  while (focus && focus.length > 0 && size(digest) > maxChars) {
    const entry = focus[focus.length - 1];
    const longest = (['derived', 'derivedFrom', 'history'] as const)
      .map((key) => [key, entry[key]?.length ?? 0] as const)
      .sort((a, b) => b[1] - a[1])[0];
    if (longest[1] > 0) {
      const list = entry[longest[0]] as unknown[];
      // The history keeps its newest changes (the list is oldest first), the others their first.
      if (longest[0] === 'history') list.shift();
      else list.pop();
      if (list.length === 0) delete entry[longest[0]];
    } else {
      focus.pop();
    }
  }
  if (focus && focus.length === 0) delete digest.focus;
  return digest;
}

/** A one-line, language-neutral fallback summary of an operation when the caller has no richer one. */
export function plainOperationSummary(operation: TraceOperation): string {
  const changes = changesOf(operation).length;
  return changes > 0 ? `${operation.type}: ${changes} change${changes === 1 ? '' : 's'}` : operation.type;
}
