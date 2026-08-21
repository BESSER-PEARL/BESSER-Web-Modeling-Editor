import React, { FunctionComponent } from 'react';
import { connect } from 'react-redux';
import { UMLClassifierMember } from './uml-classifier-member';
import { ThemedRect } from '../../../components/theme/themedComponents';
import { settingsService } from '../../../services/settings/settings-service';
import { ModelState } from '../../../components/store/model-state';
import { ObjectElementType } from '../../uml-object-diagram';
import { UserModelElementType } from '../../user-modeling';
import { getAttributePaletteConfig, resolveAttributeIcon } from '../../user-modeling/attribute-palette-config';

interface OwnProps {
  element: UMLClassifierMember;
  fillColor?: string;
}

interface StateProps {
  elements: ModelState['elements'];
}

type Props = OwnProps & StateProps;

const getIconWidth = (svgString?: string): number => {
  if (!svgString) return 0;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, "image/svg+xml");
    const svg = doc.querySelector("svg");

    if (!svg) return 0;

    // Try `width` attribute first
    const widthAttr = svg.getAttribute("width");
    if (widthAttr) {
      const match = widthAttr.match(/[\d.]+/);
      return match ? parseFloat(match[0]) : 0;
    }

    // Fallback: extract width from viewBox
    const viewBox = svg.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.trim().split(/\s+/);
      return parts.length === 4 ? parseFloat(parts[2]) : 0;
    }

    return 0;
  } catch {
    return 0;
  }
};

/** Split a criterion like `gender = Female` into its attribute name + value. */
const parseCriterion = (raw: string): { name: string; value: string } => {
  const match = raw.match(/^(.*?)(?:\s*(?:<=|>=|==|=|<|>)\s*)(.*)$/);
  return {
    name: (match ? match[1] : raw).trim(),
    value: (match ? match[2] : '').trim(),
  };
};

/**
 * Resolve a value-driven icon SVG for a User-profile attribute chip, so the
 * glyph swaps live as the user edits the value on the canvas (the component
 * subscribes to `state.elements`). A chip is a `UMLUserModelName` with a
 * `displayLabel` carrying a single configured attribute (e.g. gender ♀/♂).
 *
 * Returns null for anything else (whole grouping boxes keep their stored icon),
 * so this is a pure concrete-syntax layer over the unchanged model.
 */
const resolveChipIcon = (element: UMLClassifierMember, elements: ModelState['elements']): string | null => {
  const owner = element.owner ? (elements[element.owner] as any) : undefined;
  if (!owner || !owner.className || !owner.displayLabel) {
    return null;
  }

  const siblings = Object.values(elements).filter(
    (candidate: any) =>
      candidate?.owner === owner.id && candidate?.type === UserModelElementType.UserModelAttribute,
  ) as any[];

  const attribute = siblings[0];
  if (!attribute || typeof attribute.name !== 'string') return null;
  const { name, value } = parseCriterion(attribute.name);
  const config = getAttributePaletteConfig(owner.className, name);
  return config ? resolveAttributeIcon(config, value || undefined) : null;
};

const UMLClassifierMemberComponentIconUnconnected: FunctionComponent<Props> = ({ element, fillColor, elements }) => {
  // Check if this is an ObjectIcon and if icon view is enabled
  const isObjectIcon = element.type === ObjectElementType.ObjectIcon;
  const isUserModelIcon = element.type === UserModelElementType.UserModelIcon;
  const shouldShowIconView = settingsService.shouldShowIconView();
  
  // Icons should only be visible in icon view mode, hidden in normal view
  if ((isObjectIcon || isUserModelIcon) && !shouldShowIconView) {
    return null;
  }
  
  // If this is not an ObjectIcon, don't render anything
  if (!isObjectIcon && !isUserModelIcon) {
    return null;
  }
  
  // For attribute chips, derive the icon from the sibling attribute's current
  // value (live swap); otherwise fall back to the element's stored icon.
  const iconContent = resolveChipIcon(element, elements) ?? (element as any).icon;
  if (!iconContent || typeof iconContent !== 'string' || iconContent.trim() === '') {
    return null;
  }
  
  // Set your icon width here, or extract it from the SVG if dynamic
  const iconWidth = getIconWidth(iconContent);

  return (
    <g>
      <ThemedRect fillColor={fillColor || element.fillColor} strokeColor="none" width="100%" height="100%" />
      {iconContent && (
        <g
          transform={`translate(${(element.bounds.width - iconWidth)/2})`}
          dangerouslySetInnerHTML={{ __html: iconContent }}
        />
      )}
    </g>
  );
};

export const UMLClassifierMemberComponentIcon = connect<StateProps, {}, OwnProps, ModelState>(
  (state) => ({
    elements: state.elements,
  })
)(UMLClassifierMemberComponentIconUnconnected);