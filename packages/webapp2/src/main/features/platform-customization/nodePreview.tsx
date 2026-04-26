/**
 * nodePreview
 * -----------
 * Pure renderers + style helpers shared between the Platform Customization panel
 * (live preview next to each row) and what the BESSER PlatformGenerator emits
 * into the generated React app — keeping a single visual definition.
 */

import React from 'react';
import type {
  PlatformAssociationOverride,
  PlatformClassOverride,
} from '../../shared/types/project';

/** Translate a PlatformClassOverride to inline CSS the box variant can spread. */
export function nodeStyleFromOverride(s?: PlatformClassOverride): React.CSSProperties {
  if (!s) return {};
  const css: React.CSSProperties = {};
  if (s.fillColor) css.backgroundColor = s.fillColor;
  if (s.borderColor) css.borderColor = s.borderColor;
  if (s.borderWidth !== undefined) css.borderWidth = s.borderWidth;
  if (s.borderStyle) css.borderStyle = s.borderStyle;
  if (s.borderRadius !== undefined) css.borderRadius = s.borderRadius;
  if (s.fontSize !== undefined) css.fontSize = s.fontSize;
  if (s.fontWeight) css.fontWeight = s.fontWeight;
  if (s.fontColor) css.color = s.fontColor;
  return css;
}

/** Calculate a minimal stroke-dasharray for a LineStyle name. */
export function dashFromLineStyle(name: string | undefined): string | undefined {
  if (name === 'dashed') return '8 4';
  if (name === 'dotted') return '2 4';
  return undefined;
}

/** Compact 96×64 preview of a class node. When the class has an SVG icon
 * attached via metadata, the icon is shown in place of the shape so the panel
 * matches what the generated editor will render. */
export const ClassNodePreview: React.FC<{
  override?: PlatformClassOverride;
  /** Raw SVG markup attached to the class via metadata.icon, when available. */
  icon?: string;
  label?: string;
}> = ({ override, icon, label = 'Aa' }) => {
  // Icons take precedence over node_shape — same rule the generated editor uses
  // (see InstanceNode.tsx in the platform generator templates).
  if (icon) {
    return (
      <div
        className="flex size-full items-center justify-center [&_svg]:h-full [&_svg]:w-full"
        style={{ color: override?.fontColor ?? 'hsl(var(--primary))' }}
        // Icons are user-uploaded SVG strings; same handling as the generated InstanceNode.
        dangerouslySetInnerHTML={{ __html: icon }}
      />
    );
  }

  const shape = override?.nodeShape ?? 'rounded_rect';
  const fill = override?.fillColor ?? 'hsl(var(--card))';
  const stroke = override?.borderColor ?? 'hsl(var(--primary))';
  const sw = override?.borderWidth ?? 2;
  const dash = dashFromLineStyle(override?.borderStyle);
  const radius = override?.borderRadius ?? 8;
  const fontColor = override?.fontColor ?? 'hsl(var(--foreground))';
  const fontSize = override?.fontSize ? Math.min(override.fontSize, 14) : 11;
  const fontWeight = override?.fontWeight ?? 'bold';

  const commonProps = { fill, stroke, strokeWidth: sw, strokeDasharray: dash };

  let shapeNode: React.ReactNode;
  if (shape === 'ellipse') {
    shapeNode = <ellipse cx="48" cy="32" rx="44" ry="28" {...commonProps} />;
  } else if (shape === 'diamond') {
    shapeNode = <polygon points="48,4 92,32 48,60 4,32" {...commonProps} />;
  } else if (shape === 'hexagon') {
    shapeNode = <polygon points="20,4 76,4 92,32 76,60 20,60 4,32" {...commonProps} />;
  } else {
    shapeNode = (
      <rect x="4" y="4" width="88" height="56" rx={radius} ry={radius} {...commonProps} />
    );
  }

  return (
    <svg
      viewBox="0 0 96 64"
      className="size-full"
      role="img"
      aria-label="Node style preview"
    >
      {shapeNode}
      <text
        x="48"
        y="36"
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight={fontWeight}
        fill={fontColor}
        style={{ pointerEvents: 'none' }}
      >
        {label}
      </text>
    </svg>
  );
};

/** Mini SVG preview of an association edge with arrows + line style. */
export const EdgeStylePreview: React.FC<{ override?: PlatformAssociationOverride }> = ({
  override,
}) => {
  const stroke = override?.edgeColor ?? 'hsl(var(--primary))';
  const sw = override?.lineWidth ?? 2;
  const dash = dashFromLineStyle(override?.lineStyle);

  // Render small inline arrow markers; using IDs keeps the SVG self-contained.
  const targetId = `prev-arrow-end-${override?.targetArrowStyle ?? 'none'}`;
  const sourceId = `prev-arrow-start-${override?.sourceArrowStyle ?? 'none'}`;
  return (
    <svg
      viewBox="0 0 96 32"
      className="size-full"
      role="img"
      aria-label="Edge style preview"
      style={{ color: stroke }}
    >
      <defs>
        {makeMarker(targetId, override?.targetArrowStyle, 'end')}
        {makeMarker(sourceId, override?.sourceArrowStyle, 'start')}
      </defs>
      <line
        x1="8"
        y1="16"
        x2="88"
        y2="16"
        stroke={stroke}
        strokeWidth={sw}
        strokeDasharray={dash}
        markerStart={override?.sourceArrowStyle && override.sourceArrowStyle !== 'none' ? `url(#${sourceId})` : undefined}
        markerEnd={override?.targetArrowStyle && override.targetArrowStyle !== 'none' ? `url(#${targetId})` : undefined}
      />
    </svg>
  );
};

function makeMarker(
  id: string,
  arrow: PlatformAssociationOverride['targetArrowStyle'] | undefined,
  end: 'start' | 'end',
): React.ReactNode {
  if (!arrow || arrow === 'none') return null;
  const orient = end === 'end' ? 'auto-start-reverse' : 'auto';
  const base = {
    id,
    viewBox: '0 0 12 12',
    refX: 11,
    refY: 6,
    markerWidth: 12,
    markerHeight: 12,
    orient,
  };
  switch (arrow) {
    case 'filled_triangle':
      return (
        <marker key={id} {...base}>
          <polygon points="0,0 12,6 0,12" fill="currentColor" />
        </marker>
      );
    case 'open_triangle':
      return (
        <marker key={id} {...base}>
          <polyline points="0,0 12,6 0,12" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </marker>
      );
    case 'diamond':
      return (
        <marker key={id} {...base}>
          <polygon points="0,6 6,0 12,6 6,12" fill="currentColor" />
        </marker>
      );
    case 'open_diamond':
      return (
        <marker key={id} {...base}>
          <polygon
            points="0,6 6,0 12,6 6,12"
            fill="hsl(var(--card))"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </marker>
      );
    case 'circle':
      return (
        <marker key={id} {...base}>
          <circle cx="6" cy="6" r="4.5" fill="currentColor" />
        </marker>
      );
    default:
      return null;
  }
}
