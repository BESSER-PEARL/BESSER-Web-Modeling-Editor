/** Knowledge Graph -> RDF export controls, shown in the Export dialog while a
 *  Knowledge Graph diagram is active.
 *
 *  Lets the user pick the RDF syntax and the constraint vocabulary; a short
 *  note counts how many constraint specs will and won't be emitted at the chosen
 *  vocabulary, so they know what they are shipping.
 */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileCode2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import type { KgRdfFormat, KgRdfVocab } from '../../shared/api/knowledgeGraph';
import { CONSTRAINT_BY_KIND } from '../../shared/kg/constraint-catalog';
import type { KGNodeData } from '../../shared/types/project';

interface KgRdfExportSectionProps {
  /** All nodes of the active diagram, used to count the specs to be emitted. */
  nodes: KGNodeData[];
  /** An export is running (this one or another): the button is disabled. */
  busy: boolean;
  onExport: (format: KgRdfFormat, vocab: KgRdfVocab) => void;
}

export interface VocabStats {
  total: number;
  owlOnly: number;
  shaclOnly: number;
  both: number;
}

/** How many constraint specs exist, and in which vocabularies each can be written. */
export function countSpecs(nodes: KGNodeData[]): VocabStats {
  const stats: VocabStats = { total: 0, owlOnly: 0, shaclOnly: 0, both: 0 };
  for (const n of nodes) {
    if (n.nodeType !== 'nodeConstraint' && n.nodeType !== 'propertyConstraint') continue;
    const specs = (n.metadata?.constraintSpecs ?? []) as Array<{ kind: string }>;
    for (const s of specs) {
      stats.total += 1;
      const entry = CONSTRAINT_BY_KIND.get(s.kind);
      if (!entry) continue;
      const owl = entry.vocab.includes('owl');
      const shacl = entry.vocab.includes('shacl');
      if (owl && shacl) stats.both += 1;
      else if (owl) stats.owlOnly += 1;
      else if (shacl) stats.shaclOnly += 1;
    }
  }
  return stats;
}

/** Specs that are NOT written at the chosen vocabulary. */
export function skippedAt(stats: VocabStats, vocab: KgRdfVocab): number {
  return vocab === 'owl' ? stats.shaclOnly : vocab === 'shacl' ? stats.owlOnly : 0;
}

export const KgRdfExportSection: React.FC<KgRdfExportSectionProps> = ({ nodes, busy, onExport }) => {
  const { t } = useTranslation();
  const [format, setFormat] = useState<KgRdfFormat>('ttl');
  const [vocab, setVocab] = useState<KgRdfVocab>('both');

  const stats = useMemo(() => countSpecs(nodes), [nodes]);
  const skipped = skippedAt(stats, vocab);
  const emitted = stats.total - skipped;

  return (
    <div className="grid gap-3" data-testid="kg-rdf-export">
      <div className="space-y-1">
        <Label className="text-xs">{t('export.kg.options.rdfSyntax')}</Label>
        <Select value={format} onValueChange={(v) => setFormat(v as KgRdfFormat)}>
          <SelectTrigger className="h-9" data-testid="kg-rdf-format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ttl">Turtle (.ttl)</SelectItem>
            <SelectItem value="owl">OWL / RDF-XML (.owl)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('export.kg.options.constraintVocab')}</Label>
        <Select value={vocab} onValueChange={(v) => setVocab(v as KgRdfVocab)}>
          <SelectTrigger className="h-9" data-testid="kg-rdf-vocab">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="both">{t('export.kg.options.vocabBoth')}</SelectItem>
            <SelectItem value="owl">{t('export.kg.options.vocabOwl')}</SelectItem>
            <SelectItem value="shacl">{t('export.kg.options.vocabShacl')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {stats.total > 0 ? (
        <div
          data-testid="kg-rdf-spec-count"
          className="rounded-md border border-purple-300/60 bg-purple-50/40 px-2 py-1.5 text-xs text-purple-900 dark:bg-purple-950/30 dark:text-purple-200"
        >
          {t('export.kg.options.emitted', { count: stats.total, emitted })}
          {skipped > 0 && <>{t('export.kg.options.skippedSuffix', { count: skipped })}</>}.
        </div>
      ) : (
        <div className="text-xs italic text-muted-foreground">{t('export.kg.options.noSpecs')}</div>
      )}
      <Button
        onClick={() => onExport(format, vocab)}
        disabled={busy}
        aria-busy={busy}
        data-testid="kg-rdf-export-button"
        className="justify-start gap-2 shadow-elevation-1 transition-shadow hover:shadow-elevation-2"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <FileCode2 className="size-4" />}
        {t('export.kg.options.export')}
      </Button>
    </div>
  );
};
