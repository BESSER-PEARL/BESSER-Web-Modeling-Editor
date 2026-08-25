/**
 * Forms-based editor for a User Profile, shown as a right-side drawer beside
 * the graphical canvas. It is a second view over the active UserDiagram model:
 * edits here appear on the canvas live and vice-versa (see useUserProfileForm).
 *
 * The form is driven generically from the metamodel tree: a fixed `User` header
 * at the top, then a recursive set of "parts" the user can add (single parts
 * toggle on/off, repeatable parts like Disability grow into a list), each
 * expanding to expose its attribute criteria and its own nested parts.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import type { ApollonEditor } from '@besser/wme';
import { X, Plus, Trash2, ChevronDown, ChevronRight, UserCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { isHiddenUserModelAttribute } from '@besser/wme';
import { useUserProfileForm } from './useUserProfileForm';
import { createEmptyInstance, USER_NAME_ATTRIBUTE } from './model-serialization';
import { MetaChildRef, MetaNode, MetaTree } from './metamodel-tree';
import { AttrValue, Instance, isNumericType, OPERATORS, Operator } from './types';
import { AttributeChip } from './AttributeChip';
import { PersonalizationFields } from './PersonalizationFields';
import { attributeIconService } from '../../../shared/services/attribute-icons/attributeIconService';
import type { UserPersonalizationSpec } from '@besser/wme';

interface UserProfileFormPanelProps {
  open: boolean;
  onClose: () => void;
  editor: ApollonEditor | undefined;
}

const fieldSelectClass =
  'h-8 rounded-md border border-brand/15 bg-card px-1.5 text-[13px] font-medium text-foreground shadow-sm transition-colors hover:border-brand/30 focus:border-brand/40 focus:outline-none focus:ring-1 focus:ring-brand/20';

const valueInputClass =
  'h-8 w-full flex-1 rounded-md border border-input bg-background px-2 text-[13px] ring-offset-background transition-colors placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/20';

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

const findByKey = (instance: Instance, key: string): Instance | null => {
  if (instance.key === key) return instance;
  for (const list of Object.values(instance.children)) {
    for (const child of list) {
      const found = findByKey(child, key);
      if (found) return found;
    }
  }
  return null;
};

const MetaIcon: React.FC<{ svg?: string; className?: string }> = ({ svg, className }) => {
  if (!svg) return null;
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center [&>svg]:h-full [&>svg]:w-full', className)}
      // Metamodel icons are trusted, static SVG shipped with the app.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

/* ------------------------------------------------------------------ */
/*  Attribute row                                                      */
/* ------------------------------------------------------------------ */

const AttributeRow: React.FC<{
  attr: AttrValue;
  onChange: (patch: Partial<AttrValue>) => void;
  /** Show the attribute-level personalization expander (default true). */
  showPersonalization?: boolean;
}> = ({ attr, onChange, showPersonalization = true }) => {
  const isEnum = Array.isArray(attr.enumValues) && attr.enumValues.length > 0;
  const isNumeric = !isEnum && isNumericType(attr.type);

  return (
    <div className="py-0.5">
      <div className="flex items-center gap-1.5">
        <label className="min-w-[104px] max-w-[104px] truncate text-[13px] font-medium text-muted-foreground" title={attr.name}>
          {attr.name}
        </label>

        {/* Comparison operator only for numeric fields; everything else is an equality value. */}
        {isNumeric ? (
          <select
            className={fieldSelectClass}
            value={attr.operator}
            onChange={(e) => onChange({ operator: e.target.value as Operator })}
            aria-label={`${attr.name} comparison operator`}
          >
            {OPERATORS.map((op) => (
              <option key={op} value={op}>
                {op === '==' ? '=' : op}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-[13px] font-medium text-muted-foreground/70" aria-hidden>
            =
          </span>
        )}

        {isEnum ? (
          <select
            className={cn(fieldSelectClass, 'w-full flex-1')}
            value={attr.value}
            onChange={(e) => onChange({ value: e.target.value })}
            aria-label={`${attr.name} value`}
          >
            <option value="">—</option>
            {attr.enumValues!.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        ) : (
          <input
            type={isNumeric ? 'number' : 'text'}
            className={valueInputClass}
            value={attr.value}
            placeholder={attr.type || 'value'}
            onChange={(e) => onChange({ value: e.target.value })}
            aria-label={`${attr.name} value`}
          />
        )}
      </div>

      {showPersonalization && (
        <div className="mt-1 pl-[108px]">
          <PersonalizationFields
            value={attr.personalization}
            onChange={(spec) => onChange({ personalization: spec })}
          />
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Instance card (one profile box)                                    */
/* ------------------------------------------------------------------ */

interface EditorCallbacks {
  tree: MetaTree;
  setAttr: (instanceKey: string, attrIndex: number, patch: Partial<AttrValue>) => void;
  setInstancePersonalization: (instanceKey: string, spec: UserPersonalizationSpec | undefined) => void;
  addChild: (parentKey: string, className: string) => void;
  removeChild: (parentKey: string, className: string, childKey: string) => void;
}

const InstanceCard: React.FC<{
  instance: Instance;
  cb: EditorCallbacks;
  onRemove?: () => void;
  label?: string;
}> = ({ instance, cb, onRemove, label }) => {
  const meta = cb.tree.byClassName[instance.className];
  // Runtime / too-user-specific attributes (firstName, address, ...) are hidden
  // from the form so they don't confuse modellers. They stay in
  // `instance.attributes` (indices preserved for `setAttr`) so serialization
  // still transmits them as placeholders — this is a display-only filter.
  const visibleAttributes = instance.attributes
    .map((attr, idx) => ({ attr, idx }))
    .filter(({ attr }) => !isHiddenUserModelAttribute(instance.className, attr.name));
  return (
    <div className="rounded-md border border-border/60 bg-card/60 p-2">
      <div className="mb-1.5 flex items-center gap-1.5">
        <MetaIcon svg={instance.icon} className="h-4 w-4" />
        <span className="text-[13px] font-semibold text-foreground">{label ?? instance.className}</span>
        {onRemove && (
          <button
            className="ml-auto rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            onClick={onRemove}
            aria-label={`Remove ${instance.className}`}
            title={`Remove ${instance.className}`}
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>

      {visibleAttributes.length > 0 && (
        <div className="space-y-0.5">
          {visibleAttributes.map(({ attr, idx }) => (
            <AttributeRow
              key={attr.attributeId || attr.name || idx}
              attr={attr}
              onChange={(patch) => cb.setAttr(instance.key, idx, patch)}
            />
          ))}
        </div>
      )}

      {/* Nested parts of this instance */}
      {meta && meta.children.length > 0 && (
        <div className="mt-2 space-y-1.5 border-l-2 border-brand/15 pl-2">
          {meta.children.map((childRef) => (
            <PartSection key={childRef.className} parent={instance} childRef={childRef} cb={cb} />
          ))}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Part section (one metamodel child of a given instance)             */
/* ------------------------------------------------------------------ */

const PartSection: React.FC<{
  parent: Instance;
  childRef: MetaChildRef;
  cb: EditorCallbacks;
}> = ({ parent, childRef, cb }) => {
  const meta = cb.tree.byClassName[childRef.className];
  const instances = parent.children[childRef.className] || [];
  const isSingle = childRef.multiplicity === 'single';
  const enabled = instances.length > 0;

  return (
    <Collapsible defaultOpen={enabled}>
      <div className="flex items-center gap-1.5">
        <CollapsibleTrigger asChild>
          <button className="group flex items-center gap-1 text-[13px] font-semibold text-foreground/80 transition-colors hover:text-brand">
            <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90" />
            <MetaIcon svg={meta?.icon} className="h-3.5 w-3.5" />
            <span>{childRef.className.replace(/_/g, ' ')}</span>
            {!isSingle && enabled && (
              <span className="rounded-full bg-brand/10 px-1.5 text-[12px] font-medium text-brand">
                {instances.length}
              </span>
            )}
          </button>
        </CollapsibleTrigger>

        {isSingle ? (
          <label className="ml-auto flex cursor-pointer items-center gap-1 text-[12px] font-medium text-muted-foreground">
            <input
              type="checkbox"
              className="size-3 accent-[hsl(var(--brand))]"
              checked={enabled}
              onChange={(e) => {
                if (e.target.checked) cb.addChild(parent.key, childRef.className);
                else if (instances[0]) cb.removeChild(parent.key, childRef.className, instances[0].key);
              }}
            />
            Include
          </label>
        ) : (
          <button
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-brand/15 bg-card px-1.5 py-0.5 text-[12px] font-medium text-foreground shadow-sm transition-colors hover:border-brand/30 hover:bg-brand/[0.04]"
            onClick={() => cb.addChild(parent.key, childRef.className)}
            title={`Add ${childRef.className}`}
          >
            <Plus className="size-3" />
            Add
          </button>
        )}
      </div>

      <CollapsibleContent>
        <div className="mt-1.5 space-y-1.5">
          {enabled ? (
            instances.map((inst, i) => (
              <InstanceCard
                key={inst.key}
                instance={inst}
                cb={cb}
                label={isSingle ? undefined : `${childRef.className} ${i + 1}`}
                onRemove={
                  isSingle
                    ? undefined
                    : () => cb.removeChild(parent.key, childRef.className, inst.key)
                }
              />
            ))
          ) : (
            <p className="pl-1 text-[12px] italic text-muted-foreground">
              {isSingle ? 'Not included.' : `No ${childRef.className.toLowerCase()} added yet.`}
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

/* ------------------------------------------------------------------ */
/*  Profile card (one root User + its parts)                           */
/* ------------------------------------------------------------------ */

/**
 * One user profile: the root `User` block (name, root attributes, profile-level
 * personalization, attribute chips) plus its parts. A canvas can hold several,
 * so this is rendered once per profile.
 */
const ProfileCard: React.FC<{
  root: Instance;
  rootMeta: MetaNode;
  cb: EditorCallbacks;
  index: number;
  onRemove?: () => void;
}> = ({ root, rootMeta, cb, index, onRemove }) => {
  const nameIdx = root.attributes.findIndex((attr) => attr.name === USER_NAME_ATTRIBUTE);
  const nameAttr = nameIdx >= 0 ? root.attributes[nameIdx] : null;

  return (
    <div className="space-y-3">
      {/* Root User block */}
      <div className="rounded-lg border border-brand/25 bg-brand/[0.04] p-2.5">
        <div className="flex items-center gap-2">
          <MetaIcon svg={rootMeta.icon} className="h-5 w-5" />
          <span className="text-[14px] font-bold text-brand-dark">
            {nameAttr?.value?.trim() || `${rootMeta.className} ${index + 1}`}
          </span>
          <span className="ml-auto rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand">
            Profile
          </span>
          {onRemove && (
            <button
              className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              onClick={onRemove}
              aria-label="Remove profile"
              title="Remove profile"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>

        {/* Profile name — the User identity attribute. Rendered as a plain
            labelled input (not a matching criterion); it names this profile and
            drives the canvas header for this User box. */}
        {nameAttr && (
          <div className="mt-2">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Profile name
            </label>
            <input
              type="text"
              value={nameAttr.value ?? ''}
              placeholder="Name this profile…"
              onChange={(e) => cb.setAttr(root.key, nameIdx, { value: e.target.value })}
              className="w-full rounded-md border border-brand/25 bg-background px-2 py-1 text-[13px] text-foreground outline-none focus:border-brand"
            />
          </div>
        )}

        {root.attributes.some(
          (attr) =>
            attr.name !== USER_NAME_ATTRIBUTE && !isHiddenUserModelAttribute(root.className, attr.name),
        ) && (
          <div className="mt-2 space-y-0.5">
            {root.attributes.map((attr, idx) =>
              attr.name === USER_NAME_ATTRIBUTE ||
              isHiddenUserModelAttribute(root.className, attr.name) ? null : (
                <AttributeRow
                  key={attr.attributeId || attr.name || idx}
                  attr={attr}
                  onChange={(patch) => cb.setAttr(root.key, idx, patch)}
                />
              ),
            )}
          </div>
        )}

        {/* Profile-level personalization (applies to the whole profile) */}
        <div className="mt-2">
          <PersonalizationFields
            label="Profile personalization"
            value={root.personalization}
            onChange={(spec) => cb.setInstancePersonalization(root.key, spec)}
          />
        </div>
      </div>

      {/* Quick-access attribute chips (personalization level) */}
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Attributes</p>
        <div className="flex flex-wrap gap-2">
          {rootMeta.children.map((childRef) => {
            const childMeta = cb.tree.byClassName[childRef.className];
            if (!childMeta) return null;
            const configuredAttrs = attributeIconService.getConfiguredAttributesForContainer(
              childRef.className,
            );
            if (configuredAttrs.length === 0) return null;

            const childInstances = root.children[childRef.className] || [];
            const firstInstance = childInstances[0];
            if (!firstInstance) return null;

            return configuredAttrs.map((config) => {
              const attrIndex = firstInstance.attributes.findIndex((a) => a.name === config.attribute);
              if (attrIndex < 0) return null;
              const attr = firstInstance.attributes[attrIndex];

              return (
                <AttributeChip
                  key={`${childRef.className}.${config.attribute}`}
                  containerClass={childRef.className}
                  attribute={config.attribute}
                  value={attr.value}
                  enumValues={attr.enumValues}
                  onValueChange={(value) => cb.setAttr(firstInstance.key, attrIndex, { value })}
                  onRemove={() => cb.setAttr(firstInstance.key, attrIndex, { value: '' })}
                  displayName={config.displayName}
                />
              );
            });
          })}
        </div>
      </div>

      {/* Top-level parts of this User */}
      <div className="space-y-2">
        {rootMeta.children.map((childRef) => (
          <PartSection key={childRef.className} parent={root} childRef={childRef} cb={cb} />
        ))}
        {rootMeta.children.length === 0 && (
          <p className="text-[13px] italic text-muted-foreground">No parts are defined in the metamodel.</p>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Panel                                                              */
/* ------------------------------------------------------------------ */

export const UserProfileFormPanel: React.FC<UserProfileFormPanelProps> = ({ open, onClose, editor }) => {
  const { tree, profiles, applyEdit, addProfile, removeProfile, ready } = useUserProfileForm(open, editor);
  const panelRef = useRef<HTMLDivElement>(null);

  // Double-clicking a diagram element on the canvas opens its own editor popup;
  // close the form so the two editing surfaces don't fight for the element.
  useEffect(() => {
    if (!open) return;
    const handleDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || panelRef.current?.contains(target)) return; // ignore clicks inside the form
      if (target.closest('svg')) onClose(); // a double-click on canvas SVG content
    };
    document.addEventListener('dblclick', handleDblClick);
    return () => document.removeEventListener('dblclick', handleDblClick);
  }, [open, onClose]);

  // Locate the instance with `key` across all profile roots, mutate it in place,
  // and return a fresh cloned list. Returns `prev` unchanged when not found so
  // `applyEdit` can skip the write.
  const editByKey = useCallback(
    (prev: Instance[], key: string, mutate: (target: Instance) => void): Instance[] => {
      const clone = structuredClone(prev);
      for (const root of clone) {
        const target = findByKey(root, key);
        if (target) {
          mutate(target);
          return clone;
        }
      }
      return prev;
    },
    [],
  );

  const setAttr = useCallback(
    (instanceKey: string, attrIndex: number, patch: Partial<AttrValue>) => {
      applyEdit((prev) =>
        editByKey(prev, instanceKey, (target) => {
          if (target.attributes[attrIndex]) {
            target.attributes[attrIndex] = { ...target.attributes[attrIndex], ...patch };
          }
        }),
      );
    },
    [applyEdit, editByKey],
  );

  const setInstancePersonalization = useCallback(
    (instanceKey: string, spec: UserPersonalizationSpec | undefined) => {
      applyEdit((prev) =>
        editByKey(prev, instanceKey, (target) => {
          if (spec) target.personalization = spec;
          else delete target.personalization;
        }),
      );
    },
    [applyEdit, editByKey],
  );

  const addChild = useCallback(
    (parentKey: string, className: string) => {
      applyEdit((prev) => {
        if (!tree) return prev;
        const meta = tree.byClassName[className];
        if (!meta) return prev;
        return editByKey(prev, parentKey, (parent) => {
          const existing = parent.children[className] || [];
          parent.children[className] = [...existing, createEmptyInstance(meta)];
        });
      });
    },
    [applyEdit, editByKey, tree],
  );

  const removeChild = useCallback(
    (parentKey: string, className: string, childKey: string) => {
      applyEdit((prev) =>
        editByKey(prev, parentKey, (parent) => {
          if (!parent.children[className]) return;
          const next = parent.children[className].filter((c) => c.key !== childKey);
          if (next.length === 0) delete parent.children[className];
          else parent.children[className] = next;
        }),
      );
    },
    [applyEdit, editByKey],
  );

  if (!open) return null;

  const cb: EditorCallbacks | null = tree
    ? { tree, setAttr, setInstancePersonalization, addChild, removeChild }
    : null;
  const rootMeta: MetaNode | null = tree?.root ?? null;

  // Rendered through a portal to document.body: the drawer is position:fixed,
  // and an ancestor with backdrop-filter/transform (the tab bar uses
  // backdrop-blur) would otherwise become its containing block and trap it
  // behind the canvas. Portalling to body pins it to the viewport.
  return ReactDOM.createPortal(
    <div
      ref={panelRef}
      className="pointer-events-auto fixed inset-y-0 right-0 z-[1000] flex w-[420px] max-w-[92vw] flex-col border-l border-brand/12 bg-card/95 shadow-2xl backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-brand/12 px-3 py-2">
        <UserCircle2 className="size-4 text-brand" />
        <span className="text-[15px] font-semibold text-foreground">User Profile Form</span>
        <button
          className="ml-auto rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={onClose}
          aria-label="Close user profile form"
          title="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        {!rootMeta || !cb || !ready ? (
          <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3 text-[13px] text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              The user metamodel isn&apos;t available yet. Open this on a User Profile diagram once the
              editor has finished loading.
            </span>
          </div>
        ) : (
          <>
            {profiles.map((root, i) => (
              <ProfileCard
                key={root.key}
                root={root}
                rootMeta={rootMeta}
                cb={cb}
                index={i}
                onRemove={profiles.length > 1 ? () => removeProfile(root.key) : undefined}
              />
            ))}

            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 border-dashed border-brand/30 text-brand hover:bg-brand/[0.04]"
              onClick={addProfile}
            >
              <Plus className="size-3.5" />
              Add profile
            </Button>
          </>
        )}
      </div>

      {/* Footer hint */}
      <div className="border-t border-brand/12 px-3 py-2 text-[12px] leading-snug text-muted-foreground">
        Each profile is a User plus its connected elements. Changes sync live with the diagram; fill a
        value to turn a field into a matching criterion.
      </div>
    </div>,
    document.body,
  );
};
