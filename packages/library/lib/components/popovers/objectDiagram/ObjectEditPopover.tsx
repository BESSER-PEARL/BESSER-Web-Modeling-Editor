import { PopoverProps } from "../types"
import { ObjectEditPanel } from "@/components/inspectors/objectDiagram/ObjectEditPanel"

/**
 * Object-diagram node popover — delegate to the full `ObjectEditPanel`
 * so the toolbar pencil exposes the same controls (class link + auto
 * attribute population, type-aware value widgets, per-row colors,
 * Enter-to-next-slot navigation) the dock inspector does.
 *
 * Previously this popover reused the class-oriented
 * `EditableAttributeList` (shared with `ClassEditPopover`), which only
 * edits a single free-form `name` field per row — no `name`/`value`
 * split, no class picker, no type-aware value widgets (bool switch,
 * numeric field, date/time/duration pickers, enum dropdown, quoted
 * strings) — so linking an object to a class or editing a typed value
 * was only reachable from the dock. Mirrors the identical
 * `ObjectDiagramEdgeEditPopover` fix applied to the edge popover for
 * the same reason. The panel mounts cleanly here because it does not
 * assume a particular surface (just `elementId`).
 */
export const ObjectEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => <ObjectEditPanel elementId={elementId} />
