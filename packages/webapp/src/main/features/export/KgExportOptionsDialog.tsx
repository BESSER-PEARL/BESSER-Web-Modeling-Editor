/** Export-options dialog for KG → RDF.
 *
 *  Opens when the user picks "Export with options…" in the Generate menu
 *  on a KnowledgeGraphDiagram. Lets them pick the RDF syntax and the
 *  constraint vocabulary; a short footer counts how many specs will / won't
 *  be emitted at the chosen vocab so users know what they're shipping.
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import type { KgRdfFormat, KgRdfVocab } from './useExportKgRdf';
import { CONSTRAINT_BY_KIND } from '../editors/kg/constraint-catalog';
import type { KGNodeData } from '../editors/kg/types';

interface Props {
  open: boolean;
  /** All nodes in the active KG diagram, used to count specs to be emitted. */
  nodes: KGNodeData[];
  onClose: () => void;
  onConfirm: (fmt: KgRdfFormat, vocab: KgRdfVocab) => void;
}

interface VocabStats {
  total: number;
  owlOnly: number;
  shaclOnly: number;
  both: number;
}

function countSpecs(nodes: KGNodeData[]): VocabStats {
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

export const KgExportOptionsDialog: React.FC<Props> = ({ open, nodes, onClose, onConfirm }) => {
  const { t } = useTranslation();
  const [fmt, setFmt] = useState<KgRdfFormat>('ttl');
  const [vocab, setVocab] = useState<KgRdfVocab>('both');

  const stats = useMemo(() => countSpecs(nodes), [nodes]);

  // Specs that will be SKIPPED at the chosen vocab.
  const skipped =
    vocab === 'owl' ? stats.shaclOnly : vocab === 'shacl' ? stats.owlOnly : 0;
  const emitted = stats.total - skipped;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('export.kg.options.title')}</DialogTitle>
          <DialogDescription>{t('export.kg.options.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">{t('export.kg.options.rdfSyntax')}</Label>
            <Select value={fmt} onValueChange={(v) => setFmt(v as KgRdfFormat)}>
              <SelectTrigger className="h-9">
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
              <SelectTrigger className="h-9">
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
            <div className="rounded-md border border-purple-300/60 bg-purple-50/40 px-2 py-1.5 text-xs text-purple-900 dark:bg-purple-950/30 dark:text-purple-200">
              {t('export.kg.options.emitted', { count: stats.total, emitted })}
              {skipped > 0 && <>{t('export.kg.options.skippedSuffix', { count: skipped })}</>}
              .
            </div>
          ) : (
            <div className="text-xs italic text-muted-foreground">{t('export.kg.options.noSpecs')}</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => {
              onConfirm(fmt, vocab);
              onClose();
            }}
          >
            {t('export.kg.options.export')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
