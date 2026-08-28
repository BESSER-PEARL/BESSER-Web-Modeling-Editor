// Individual picker for the KG → Object Diagram conversion.
//
// Converting a whole ABox stops producing a readable diagram once a graph has
// more than a few dozen individuals, so the user picks one to build the
// diagram around and how far to walk from it. The backend
// (/kg-to-object-diagram, `rootIndividualIds` + `maxDepth`) prunes the ABox
// before converting.
//
// The individuals come straight out of the active KG diagram the client
// already holds — nodes with `nodeType === 'individual'` — so opening the
// picker costs no round trip.
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { KGNodeData, KnowledgeGraphData } from '../../shared/types/project';

/** Matches the backend's `maxDepth`: `null` means the full connected component. */
export type KgScopeDepth = 1 | 2 | null;

export interface KgIndividualSelection {
  rootIndividualIds: string[];
  maxDepth: number | null;
}

export interface KgIndividualPickerModalProps {
  open: boolean;
  /** Model of the active KG diagram; individuals are read from `nodes`. */
  model: KnowledgeGraphData | null;
  onConfirm: (selection: KgIndividualSelection) => void;
  onCancel: () => void;
}

const DEPTH_OPTIONS: Array<{ value: KgScopeDepth; labelKey: string }> = [
  { value: 1, labelKey: 'import.kg.individualPicker.depthDirect' },
  { value: 2, labelKey: 'import.kg.individualPicker.depthTwo' },
  { value: null, labelKey: 'import.kg.individualPicker.depthAll' },
];

function individualsOf(model: KnowledgeGraphData | null): KGNodeData[] {
  const nodes = model?.nodes ?? [];
  return nodes
    .filter((node) => node.nodeType === 'individual')
    .sort((a, b) => (a.label || a.id).localeCompare(b.label || b.id));
}

export const KgIndividualPickerModal: React.FC<KgIndividualPickerModalProps> = ({
  open,
  model,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [depth, setDepth] = useState<KgScopeDepth>(null);

  const individuals = useMemo(() => individualsOf(model), [model]);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return individuals;
    return individuals.filter(
      (node) =>
        (node.label || '').toLowerCase().includes(needle) ||
        (node.iri || '').toLowerCase().includes(needle) ||
        node.id.toLowerCase().includes(needle),
    );
  }, [individuals, filter]);

  // A KG with no individuals is a TBox-only ontology, where an object diagram
  // has nothing to show. Say so rather than sending an empty selection.
  const isEmpty = individuals.length === 0;

  const handleConfirm = () => {
    if (!selectedId) return;
    onConfirm({ rootIndividualIds: [selectedId], maxDepth: depth });
  };

  const handleOpenChange = (next: boolean) => {
    if (next) return;
    setFilter('');
    setSelectedId(null);
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('import.kg.individualPicker.title')}</DialogTitle>
          <DialogDescription>
            {isEmpty
              ? t('import.kg.individualPicker.emptyDescription')
              : t('import.kg.individualPicker.description')}
          </DialogDescription>
        </DialogHeader>

        {!isEmpty && (
          <>
            <Input
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder={t('import.kg.individualPicker.filterPlaceholder')}
              data-testid="kg-individual-picker-filter"
            />

            <ul
              className="max-h-[320px] divide-y divide-border overflow-y-auto rounded border border-border"
              data-testid="kg-individual-picker-list"
            >
              {visible.map((node) => {
                const isSelected = node.id === selectedId;
                return (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(node.id)}
                      aria-pressed={isSelected}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                        isSelected ? 'bg-muted font-medium' : ''
                      }`}
                      data-testid={`kg-individual-picker-option-${node.id}`}
                    >
                      <div>{node.label || node.id}</div>
                      {node.iri && (
                        <div className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                          {node.iri}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
              {visible.length === 0 && (
                <li className="px-3 py-2 text-sm text-muted-foreground">
                  {t('import.kg.individualPicker.noMatches')}
                </li>
              )}
            </ul>

            <fieldset className="mt-1">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('import.kg.individualPicker.scopeLabel')}
              </Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {DEPTH_OPTIONS.map((option) => (
                  <Button
                    key={String(option.value)}
                    type="button"
                    size="sm"
                    variant={depth === option.value ? 'default' : 'outline'}
                    onClick={() => setDepth(option.value)}
                    data-testid={`kg-individual-picker-depth-${option.value ?? 'all'}`}
                  >
                    {t(option.labelKey)}
                  </Button>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <DialogFooter className="flex justify-between gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onCancel} data-testid="kg-individual-picker-cancel">
            {t('common.cancel')}
          </Button>
          {!isEmpty && (
            <Button
              onClick={handleConfirm}
              disabled={!selectedId}
              data-testid="kg-individual-picker-confirm"
            >
              {t('import.kg.individualPicker.confirm')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
