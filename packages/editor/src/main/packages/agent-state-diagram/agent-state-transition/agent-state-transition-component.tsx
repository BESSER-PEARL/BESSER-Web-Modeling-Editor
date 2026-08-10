import React, { FunctionComponent } from 'react';
import { Point } from '../../../utils/geometry/point';
import { AgentStateTransition } from './agent-state-transition';
import { ThemedPath, ThemedPolyline } from '../../../components/theme/themedComponents';

export const AgentStateTransitionComponent: FunctionComponent<Props> = ({ element }) => {
  let position = { x: 0, y: 0 };
  let direction: 'v' | 'h' = 'v';
  const path = element.path.map((point) => new Point(point.x, point.y));
  let distance =
    path.reduce(
      (length, point, i, points) => (i + 1 < points.length ? length + points[i + 1].subtract(point).length : length),
      0,
    ) / 2;

  for (let index = 0; index < path.length - 1; index++) {
    const vector = path[index + 1].subtract(path[index]);
    if (vector.length > distance) {
      const norm = vector.normalize();
      direction = Math.abs(norm.x) > Math.abs(norm.y) ? 'h' : 'v';
      position = path[index].add(norm.scale(distance));
      break;
    }
    distance -= vector.length;
  }

  const layoutText = (dir: 'v' | 'h') => {
    switch (dir) {
      case 'v':
        return {
          dx: 5,
          dominantBaseline: 'middle',
          textAnchor: 'start',
        };
      case 'h':
        return {
          dy: -5,
          dominantBaseline: 'text-after-edge',
          textAnchor: 'middle',
        };
    }
  };

  const isInvalid = (): boolean => {
    if (element.transitionType === 'custom') return false;
    const pt = element.predefinedType;
    if (pt === 'when_intent_matched') return !element.intentName;
    if (pt === 'when_variable_operation_matched') {
      return !(element.variable && element.operator && element.targetValue);
    }
    return false;
  };

  const getLabel = (): string => {
    if (element.transitionType === 'custom') {
      const ev = element.event || 'WildcardEvent';
      const n = element.conditions?.length || 0;
      return ev === 'None' ? `No event + ${n} cond.` : `${ev} + ${n} cond.`;
    }
    const pt = element.predefinedType;
    if (!pt) return '';
    if (pt === 'when_intent_matched') return element.intentName || 'Intent';
    if (pt === 'when_no_intent_matched') return 'No intent';
    if (pt === 'when_variable_operation_matched') {
      const v = element.variable || '?';
      const op = element.operator || '?';
      const tv = element.targetValue || '?';
      return `${v} ${op} ${tv}`;
    }
    if (pt === 'when_file_received') return 'File';
    if (pt === 'auto') return 'Auto';
    return '';
  };

  const invalid = isInvalid();
  const arrowColor = invalid ? '#ef4444' : element.strokeColor;
  const textFill = invalid ? '#ef4444' : (element.textColor || undefined);
  const fillStyle = textFill ? { fill: textFill } : {};

  return (
    <g>
      <marker
        id={`marker-${element.id}`}
        viewBox="0 0 30 30"
        markerWidth="22"
        markerHeight="30"
        refX="30"
        refY="15"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <ThemedPath d="M0,29 L30,15 L0,1" fillColor="none" strokeColor={arrowColor} />
      </marker>
      <ThemedPolyline
        points={element.path.map((point) => `${point.x} ${point.y}`).join(',')}
        strokeColor={arrowColor}
        fillColor="none"
        strokeWidth={1}
        markerEnd={`url(#marker-${element.id})`}
      />
      <text x={position.x} y={position.y} {...layoutText(direction)} pointerEvents="none" style={{ ...fillStyle }}>
        {getLabel()}
      </text>
    </g>
  );
};

interface Props {
  element: AgentStateTransition;
}