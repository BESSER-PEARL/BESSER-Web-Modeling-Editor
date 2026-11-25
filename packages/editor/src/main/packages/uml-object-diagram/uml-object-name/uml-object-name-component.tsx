import React, { FunctionComponent } from 'react';
import { connect } from 'react-redux';
import { Text } from '../../../components/controls/text/text';
import { UMLObjectName } from './uml-object-name';
import { ThemedPath, ThemedRect } from '../../../components/theme/themedComponents';
import { diagramBridge } from '../../../services/diagram-bridge/diagram-bridge-service';
import { settingsService } from '../../../services/settings/settings-service';
import { ModelState } from '../../../components/store/model-state';
import { UserModelElementType } from '../../user-modeling';
import { isHiddenUserModelContainer } from '../../user-modeling/hidden-containers';

// The root User element carries a `name` attribute that names the whole profile
// (see the user metamodel + useUserProfileNameSync). We surface that value as
// the canvas header so a named profile reads meaningfully, even though element
// naming is otherwise suppressed in the User editor.
const ROOT_USER_CLASS_NAME = 'User';
const USER_NAME_ATTRIBUTE = 'name';

/** Split a criterion like `name = Alice` into its attribute name + value. */
const parseCriterion = (raw: string): { name: string; value: string } => {
  const match = raw.match(/^(.*?)(?:\s*(?:<=|>=|==|=|<|>)\s*)(.*)$/);
  return {
    name: (match ? match[1] : raw).trim(),
    value: (match ? match[2] : '').trim(),
  };
};

/**
 * For the root User box, read the profile name from its sibling `name`
 * `UserModelAttribute` (the live source of truth — canvas edits update that row,
 * not the box's own `name`). Returns '' for any non-root box or when unset.
 */
const resolveUserProfileName = (
  element: UMLObjectName,
  className: string,
  elements: ModelState['elements'],
): string => {
  const isRootUser = (className || (element as any).className) === ROOT_USER_CLASS_NAME;
  if (!isRootUser || !elements) return '';
  const attribute = Object.values(elements).find(
    (candidate: any) =>
      candidate?.owner === element.id &&
      candidate?.type === (UserModelElementType as any).UserModelAttribute &&
      typeof candidate.name === 'string' &&
      parseCriterion(candidate.name).name === USER_NAME_ATTRIBUTE,
  ) as any;
  return attribute ? parseCriterion(attribute.name).value : '';
};

const UMLObjectNameComponentUnconnected: FunctionComponent<Props> = ({ element, children, fillColor, elements }) => {
  // Helper function to get the class name from the classId
  const getClassName = (): string => {
    if (!element.classId) {
      return '';
    }

    const classInfo = diagramBridge.getClassById(element.classId);
    return classInfo ? classInfo.name : '';
  };

  const className = getClassName();
  const isUserModelElement = element.type === (UserModelElementType as any).UserModelName;

  // Empty grouping containers (Competence/Accessibility) are kept in the
  // transmitted model — instances + containment links are still emitted so the
  // B-UML metamodel and backend validation are unchanged — but they carry no
  // attributes of their own, so drawing them just adds empty tiles. Suppress
  // the whole subtree (box + icon + rows) from the canvas only. See
  // hidden-containers.ts.
  if (isUserModelElement && isHiddenUserModelContainer(className || element.className)) {
    return null;
  }
  // Attribute-level palette chips carry an explicit `displayLabel` (e.g. "gender")
  // so they can show the attribute name even though the node is still a real
  // instance of its container class (classId/className unchanged).
  const chipLabel = (element as any).displayLabel as string | undefined;
  // The root User box shows its chosen profile name when one is set (e.g. a
  // "child" profile), falling back to the class name ("User") when unnamed.
  const profileName = resolveUserProfileName(element, className, elements);
  const displayLabel = isUserModelElement
    ? (chipLabel || profileName || className || element.className || element.name)
    : `${element.name}${className ? ` : ${className}` : ''}`;
  
  // Check if we should show icon view or normal view
  const shouldShowIconView = settingsService.shouldShowIconView();

  if (shouldShowIconView) {
    return renderIconView(element, children, fillColor, displayLabel);
  } else {
    return renderNormalView(element, children, fillColor, displayLabel);
  }
};

const renderIconView = (element: UMLObjectName, children: React.ReactNode, fillColor?: string, displayLabel?: string) => {
  const clipId = `clip-${element.id}`;
  const displayText = displayLabel || element.name;
  // Left-align long text so the beginning is always visible
  const textFitsBox = displayText.length * 8 < element.bounds.width;
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect width={element.bounds.width} height={element.bounds.height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <ThemedRect
          fillColor={fillColor || element.fillColor}
          strokeColor="none"
          width="100%"
          height={element.stereotype ? 50 : 40}
        />
        <ThemedRect
          y={element.stereotype ? 50 : 40}
          width="100%"
          height={element.bounds.height - (element.stereotype ? 50 : 40)}
          strokeColor="none"
        />
        <svg height={40}>
          <Text
            fill={element.textColor}
            fontStyle={element.italic ? 'italic' : undefined}
            textDecoration={element.underline ? 'underline' : undefined}
            x={textFitsBox ? '50%' : 8}
            textAnchor={textFitsBox ? 'middle' : 'start'}
          >
            {displayText}
          </Text>
        </svg>
        {children}
      </g>
      <ThemedRect width="100%" height="100%" strokeColor={element.strokeColor} fillColor="none" pointerEvents="none" />
      <ThemedPath d={`M 0 ${element.headerHeight} H ${element.bounds.width}`} strokeColor={element.strokeColor} />
    </g>
  );
};

const renderNormalView = (element: UMLObjectName, children: React.ReactNode, fillColor?: string, displayLabel?: string) => {
  const clipId = `clip-${element.id}`;
  const displayText = displayLabel || element.name;
  const textFitsBox = displayText.length * 8 < element.bounds.width;
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <rect width={element.bounds.width} height={element.bounds.height} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <ThemedRect
          fillColor={fillColor || element.fillColor}
          strokeColor="none"
          width="100%"
          height={element.stereotype ? 50 : 40}
        />
        <ThemedRect
          y={element.stereotype ? 50 : 40}
          width="100%"
          height={element.bounds.height - (element.stereotype ? 50 : 40)}
          strokeColor="none"
        />
        {element.stereotype ? (
          <svg height={50}>
            <Text fill={element.textColor}>
              <tspan x="50%" dy={-8} textAnchor="middle" fontSize="85%">
                {`«${element.stereotype}»`}
              </tspan>
              <tspan
                x={textFitsBox ? '50%' : 8}
                dy={18}
                textAnchor={textFitsBox ? 'middle' : 'start'}
                fontStyle={element.italic ? 'italic' : undefined}
                textDecoration="underline"
              >
                {displayText}
              </tspan>
            </Text>
          </svg>
        ) : (
          <svg height={40}>
            <Text
              fill={element.textColor}
              fontStyle={element.italic ? 'italic' : undefined}
              textDecoration="underline"
              x={textFitsBox ? '50%' : 8}
              textAnchor={textFitsBox ? 'middle' : 'start'}
            >
              {displayText}
            </Text>
          </svg>
        )}
        {children}
      </g>
      <ThemedRect width="100%" height="100%" strokeColor={element.strokeColor} fillColor="none" pointerEvents="none" />
      {element.hasAttributes && (
        <ThemedPath d={`M 0 ${element.headerHeight} H ${element.bounds.width}`} strokeColor={element.strokeColor} />
      )}
      {element.hasMethods && element.stereotype !== 'enumeration' && (
        <ThemedPath d={`M 0 ${element.deviderPosition} H ${element.bounds.width}`} strokeColor={element.strokeColor} />
      )}
    </g>
  );
};

interface OwnProps {
  element: UMLObjectName;
  fillColor?: string;
  children?: React.ReactNode;
}

interface StateProps {
  elements: ModelState['elements'];
}

type Props = OwnProps & StateProps;

export const UMLObjectNameComponent = connect<StateProps, {}, OwnProps, ModelState>((state) => ({
  elements: state.elements,
}))(UMLObjectNameComponentUnconnected);
