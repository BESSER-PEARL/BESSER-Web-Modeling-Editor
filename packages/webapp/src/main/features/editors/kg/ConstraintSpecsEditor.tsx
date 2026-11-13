/** Constraint editor used inside the KG inspector for NodeConstraint and
 *  PropertyConstraint nodes.
 *
 *  Rendered as a single self-contained block — the parent inspector hands it
 *  the current constraint node, the list of specs, and a setter; the editor
 *  takes care of:
 *
 *  - showing a live natural-language preview at the top,
 *  - rendering quick-add templates (one click → pre-filled spec rows),
 *  - showing the existing spec list with inline value editors,
 *  - opening a categorised picker (filtered by node type + target property
 *    kind) for new specs,
 *  - inline validation (red banner) on contradictory pairs like
 *    min > max cardinality / minLength > maxLength.
 *
 *  The list itself is `SpecsListEditor`, where each `valueShape` from
 *  `shared/kg/constraint-catalog.ts` has its own tiny inline editor. Adding a new
 *  constraint kind is a matter of (a) appending an entry to the catalog,
 *  (b) extending the `describeSpec` helper, and (c) handling the new
 *  `valueShape` in `SpecsListEditor.tsx`.
 */

import React, { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import type { KGConstraintSpec, KGNodeData, KnowledgeGraphData } from './types';
import { KG_CONSTRAINT_TARGET_CLASS, KG_CONSTRAINT_TARGET_PROPERTY } from './types';
import { describeSpecList } from './describeConstraints';
import { SpecsListEditor } from './SpecsListEditor';

interface ConstraintSpecsEditorProps {
  /** The constraint node being edited (NodeConstraint / PropertyConstraint). */
  node: KGNodeData;
  /** The whole diagram model — used by IRI pickers to autocomplete from
   *  existing classes / properties. */
  model: KnowledgeGraphData;
  /** Called whenever the spec list changes. The parent commits this back
   *  into `node.metadata.constraintSpecs`. */
  onSpecsChange: (specs: KGConstraintSpec[]) => void;
}

function getTargetInfo(
  node: KGNodeData,
  model: KnowledgeGraphData,
): { targetName?: string; targetPropertyKind?: 'Object' | 'Datatype' } {
  const targetIri =
    node.nodeType === 'nodeConstraint' ? KG_CONSTRAINT_TARGET_CLASS : KG_CONSTRAINT_TARGET_PROPERTY;
  for (const edge of model.edges) {
    if (edge.source === node.id && edge.iri === targetIri) {
      const tgt = model.nodes.find((n) => n.id === edge.target);
      if (tgt) {
        const meta = (tgt.metadata ?? {}) as Record<string, unknown>;
        const kind = typeof meta.kind === 'string' ? (meta.kind as string) : undefined;
        return {
          targetName: tgt.label || tgt.id,
          targetPropertyKind: kind === 'Object' || kind === 'Datatype' ? kind : undefined,
        };
      }
    }
  }
  return {};
}

export const ConstraintSpecsEditor: React.FC<ConstraintSpecsEditorProps> = ({
  node,
  model,
  onSpecsChange,
}) => {
  const { t } = useTranslation();
  const meta = (node.metadata ?? {}) as { constraintSpecs?: KGConstraintSpec[] };
  const specs = meta.constraintSpecs ?? [];

  const { targetName, targetPropertyKind } = useMemo(
    () => getTargetInfo(node, model),
    [node, model],
  );

  return (
    <div className="space-y-3 border-t border-border/60 pt-3">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-xs font-semibold text-muted-foreground">
          {t('editors.kg.constraints.editor.heading', { count: specs.length })}
        </Label>
        {targetName && (
          <span className="text-xs text-muted-foreground">
            <Trans
              i18nKey="editors.kg.constraints.editor.appliesTo"
              values={{ target: targetName }}
              components={{ target: <code className="rounded bg-muted px-1 py-0.5" /> }}
            />
          </span>
        )}
      </div>

      {/* Live natural-language preview. */}
      <div className="rounded-md border border-purple-300/60 bg-purple-50/40 px-2 py-1.5 text-xs italic text-purple-900 dark:bg-purple-950/30 dark:text-purple-200">
        {describeSpecList(t, specs, targetName)}
      </div>

      <SpecsListEditor
        specs={specs}
        onChange={onSpecsChange}
        nodeType={node.nodeType as 'nodeConstraint' | 'propertyConstraint'}
        targetPropertyKind={targetPropertyKind}
        ownerNodeId={node.id}
        model={model}
        depth={0}
      />
    </div>
  );
};
