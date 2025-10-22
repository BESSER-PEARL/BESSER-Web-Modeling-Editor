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

  const fill = element.textColor ? { fill: element.textColor } : {};

  const getConditionName = () => {
    if (!element.condition) return '';


    if (element.condition === 'when_intent_matched') {
      return 'When Intent Matched:';
    } else if (element.condition === 'when_no_intent_matched') {
      return 'When No Intent Matched';
    } else if (element.condition === 'when_variable_operation_matched') {
      return 'When Variable Operation Matched';
    } else if (element.condition === 'when_file_received') {
      return 'When File Received';
    } else if (element.condition === 'auto') {
      return 'Auto';
    }

    const paramValues = Object.values(element.params);
    const formattedParams = paramValues.length > 0 ? paramValues.join(', ') : '';

    if (formattedParams && element.name) {
      return `${element.name} [${formattedParams}]`;
    }
    if (formattedParams) {
      return `[${formattedParams}]`;
    }
    return element.name;
  };

  const getConditionValue = () => {
    if (!element.condition) return '';

    if (element.condition === 'when_intent_matched') {
      if (element.intentName) {
        return `${element.intentName}`;
      }
      else {
        return 'No intent name provided';
      }
    } else if (element.condition === 'when_no_intent_matched') {
      return '';

    } else if (element.condition === 'when_variable_operation_matched') {
      if (element.variable && element.operator && element.targetValue) {
        return `session(${element.variable}) ${element.operator} ${element.targetValue}`;
      }
      else {
        return 'Either variable, operator or target value is not provided';
      }
    } else if (element.condition === 'when_file_received') {
      if (element.fileType) {
        return `${element.fileType}`;
      }
    } else if (element.condition === 'auto') {
      return '';
    }
    return "No condition value selected"
  };

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
        <ThemedPath d="M0,29 L30,15 L0,1" fillColor="none" strokeColor={element.strokeColor} />
      </marker>
      <ThemedPolyline
        points={element.path.map((point) => `${point.x} ${point.y}`).join(',')}
        strokeColor={element.strokeColor}
        fillColor="none"
        strokeWidth={1}
        markerEnd={`url(#marker-${element.id})`}
      />
      <text x={position.x} y={position.y} {...layoutText(direction)} pointerEvents="none" style={{ ...fill }}>
        {getConditionName()}
      </text>
      <text x={position.x} y={position.y + 30} {...layoutText(direction)} pointerEvents="none" style={{ ...fill }}>
        {getConditionValue()}
      </text>
    </g>
  );
};

interface Props {
  element: AgentStateTransition;
}