import React from 'react';
import { KG_NODE_TYPES } from './types';
import { KgShapeIcon } from './KgShapeIcon';

export const KG_DRAG_MIME = 'application/x-besser-kg-node';

/** Left-side palette of draggable KG node kinds. Users drag an item onto the
 *  Cytoscape canvas; the canvas reads the MIME payload on `drop` and creates
 *  the corresponding node at the cursor's graph position. */
export const KnowledgeGraphPalette: React.FC = () => {
  return (
    <aside className="flex shrink-0 flex-col gap-2 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Node types</div>
      {KG_NODE_TYPES.map((item) => (
        <div
          key={item.type}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(KG_DRAG_MIME, item.type);
            e.dataTransfer.effectAllowed = 'copy';
          }}
          className="group flex cursor-grab items-center gap-2 rounded-md border border-border/50 bg-background p-2 text-sm transition-colors hover:border-brand/60 active:cursor-grabbing"
          title={item.description}
        >
          <span className="inline-flex h-5 w-6 shrink-0 items-center justify-center">
            <KgShapeIcon type={item.type} size={20} />
          </span>
          <span className="font-medium">{item.label}</span>
        </div>
      ))}
      <div className="mt-2 text-[11px] leading-snug text-muted-foreground">
        Drag a node type onto the canvas to create a new node. To create a
        relation between existing nodes, click <span className="font-medium">Add relation</span>{' '}
        in the canvas toolbar, then click the source node followed by the target node.
      </div>
    </aside>
  );
};
