import { PopoverProps } from "../types"
import { ObjectLinkEditPanel } from "@/components/inspectors/objectDiagram/ObjectLinkEditPanel"

/**
 * SA-FINAL O1: Object diagram edge popover — delegate to the full
 * `ObjectLinkEditPanel` so the toolbar pencil exposes the same controls
 * (name, flip, association picker, color) the inspector dock does.
 *
 * Previously this popover was a style-only stub that exposed no way to
 * pin an `associationId` or rename a link from the toolbar — users had
 * to reach for the dock. The panel mounts cleanly here because it does
 * not assume a particular surface (just `elementId`).
 */
export const ObjectDiagramEdgeEditPopover: React.FC<PopoverProps> = ({
  elementId,
}) => <ObjectLinkEditPanel elementId={elementId} />

