import React from 'react';
import { KG_NODE_COLORS } from './stylesheet';
import type { KGNodeType } from './types';

interface Props {
  type: KGNodeType;
  size?: number;
}

/** Small SVG icon that mirrors the shape Cytoscape draws on the canvas for
 *  a given KG node type. Used by the palette swatches and the node list. */
export const KgShapeIcon: React.FC<Props> = ({ type, size = 18 }) => {
  const color = KG_NODE_COLORS[type];
  const stroke = color.border;
  const fill = color.fill;
  const strokeWidth = 1.5;

  switch (type) {
    case 'class': {
      // round-rectangle
      const w = size;
      const h = Math.round(size * 0.72);
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
          <rect
            x={strokeWidth}
            y={strokeWidth}
            width={w - strokeWidth * 2}
            height={h - strokeWidth * 2}
            rx={Math.min(3, h / 3)}
            ry={Math.min(3, h / 3)}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        </svg>
      );
    }
    case 'individual': {
      // ellipse / circle
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 2 - strokeWidth}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        </svg>
      );
    }
    case 'property': {
      // diamond (losange)
      const p = strokeWidth;
      const m = size / 2;
      const far = size - p;
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <polygon
            points={`${m},${p} ${far},${m} ${m},${far} ${p},${m}`}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        </svg>
      );
    }
    case 'literal': {
      // round-tag: rounded rectangle with one cut-off corner (tag shape)
      const w = Math.round(size * 1.1);
      const h = Math.round(size * 0.72);
      const r = Math.min(3, h / 3);
      const notch = Math.min(h / 2, 4);
      const d = [
        `M ${strokeWidth + r},${strokeWidth}`,
        `L ${w - strokeWidth - notch},${strokeWidth}`,
        `L ${w - strokeWidth},${h / 2}`,
        `L ${w - strokeWidth - notch},${h - strokeWidth}`,
        `L ${strokeWidth + r},${h - strokeWidth}`,
        `Q ${strokeWidth},${h - strokeWidth} ${strokeWidth},${h - strokeWidth - r}`,
        `L ${strokeWidth},${strokeWidth + r}`,
        `Q ${strokeWidth},${strokeWidth} ${strokeWidth + r},${strokeWidth}`,
        'Z',
      ].join(' ');
      return (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
          <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />
        </svg>
      );
    }
    case 'blank': {
      // dashed ellipse (smaller)
      const s = Math.round(size * 0.8);
      return (
        <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden>
          <circle
            cx={s / 2}
            cy={s / 2}
            r={s / 2 - strokeWidth}
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray="3 2"
          />
        </svg>
      );
    }
  }
};
