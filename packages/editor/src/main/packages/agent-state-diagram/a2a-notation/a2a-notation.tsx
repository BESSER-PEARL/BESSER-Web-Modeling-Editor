import React, { useMemo, useState } from 'react';

export interface A2ATag {
  dir: 'in' | 'out';
  raw: string;
  peer?: string;
  ref?: string;
  flow?: string;
  order?: string;
  kind?: string;
}

export function parseA2ATag(value?: string): A2ATag | undefined {
  if (!value) return undefined;
  const raw = value.trim();
  if (!raw.startsWith('a2a:')) return undefined;

  const parts = raw.split(';');
  const head = parts[0];
  const dir = head === 'a2a:in' ? 'in' : head === 'a2a:out' ? 'out' : undefined;
  if (!dir) return undefined;

  const tag: A2ATag = { dir, raw };
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq);
    const val = part.slice(eq + 1);
    if (key === 'peer') tag.peer = val;
    else if (key === 'ref') tag.ref = val;
    else if (key === 'flow') tag.flow = val;
    else if (key === 'order') tag.order = val;
    else if (key === 'kind') tag.kind = val;
  }
  return tag;
}

export function parseA2AOutTags(description?: string): A2ATag[] {
  if (!description) return [];
  return description
    .split(/\r?\n/)
    .map((line) => parseA2ATag(line))
    .filter((tag): tag is A2ATag => tag?.dir === 'out');
}

export function a2aTitle(tags: A2ATag[], fallback: string): string {
  if (tags.length === 0) return fallback;
  return tags
    .map((tag) => {
      const peer = tag.peer || 'peer';
      return `${tag.dir === 'in' ? 'Receive from' : 'Send to'} ${peer}`;
    })
    .join('\n');
}

interface A2ABadgeProps {
  dir: 'in' | 'out';
  x: number;
  y: number;
  count?: number;
  title?: string;
}

export const A2ABadge = ({ dir, x, y, count, title }: A2ABadgeProps) => {
  const [open, setOpen] = useState(false);
  const width = count && count > 1 ? 58 : 46;
  const height = 34;
  const palette =
    dir === 'in'
      ? { fill: '#eff6ff', stroke: '#2563eb', text: '#1d4ed8', panelFill: '#f8fbff' }
      : { fill: '#dbeafe', stroke: '#1d4ed8', text: '#1e40af', panelFill: '#f1f7ff' };
  const detailLines = useMemo(() => (title ? title.split('\n').map((line) => line.trim()).filter(Boolean) : []), [title]);
  const getTextWidth = (text: string, fontSize = 9) => text.length * fontSize * 0.62;
  const panelWidth = Math.max(
    140,
    ...detailLines.map((line) => getTextWidth(line) + 75)
  );
  const panelHeight = detailLines.length * 14 + 10;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        if (detailLines.length > 0) {
          setOpen((prev) => !prev);
        }
      }}
      style={{ cursor: detailLines.length > 0 ? 'pointer' : 'default' }}
    >
      {title && <title>{title}</title>}
      <rect width={width} height={height} rx="6" fill={palette.fill} stroke={palette.stroke} strokeWidth="1" />
      <text x="7" y="14" fill={palette.text} fontSize="8" fontWeight="700">
        A2A
      </text>
      {count && count > 1 && (
        <text x="35" y="14" fill={palette.text} fontSize="8" fontWeight="700">
          x{count}
        </text>
      )}

      <rect x="12" y="18" width="22" height="11" rx="2" fill="none" stroke={palette.stroke} strokeWidth="1.4" />
      <path d="M 12 18 L 23 24 L 34 18" fill="none" stroke={palette.stroke} strokeWidth="1.4" strokeLinecap="round" />
      {dir === 'in' ? (
        <path
          d="M 5 23 H 11 M 9 21 L 11 23 L 9 25"
          fill="none"
          stroke={palette.stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M 35 23 H 41 M 39 21 L 41 23 L 39 25"
          fill="none"
          stroke={palette.stroke}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {open && detailLines.length > 0 && (
        <g transform={`translate(${width + 6}, -2)`}>
          <rect width={panelWidth} height={panelHeight} rx="4" fill={palette.panelFill} stroke={palette.stroke} strokeWidth="1" />
          {detailLines.map((line, index) => (
            <text key={`${line}-${index}`} x="8" y={14 + index * 14} fill={palette.text} fontSize="9">
              {line}
            </text>
          ))}
        </g>
      )}
    </g>
  );
};
