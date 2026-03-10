import React from 'react';
import { UMLDiagramType } from '@besser/wme';
import type { SupportedDiagramType } from '../../../types/project';
import { NON_UML_EDITOR_ITEMS, ROUTE_ITEMS, UML_ITEMS, navButtonClass } from '../../sidebar/workspace-navigation';

interface MobileNavigationProps {
  locationPath: string;
  activeUmlType: UMLDiagramType;
  activeDiagramType: SupportedDiagramType;
  isDarkTheme: boolean;
  onSwitchUml: (type: UMLDiagramType) => void;
  onSwitchDiagramType: (type: SupportedDiagramType) => void;
  onNavigate: (path: string) => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  locationPath,
  activeUmlType,
  activeDiagramType,
  isDarkTheme,
  onSwitchUml,
  onSwitchDiagramType,
  onNavigate,
}) => {
  return (
    <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 md:hidden">
      {UML_ITEMS.map((item) => {
        const active = locationPath === '/' && activeUmlType === item.type;
        return (
          <button
            key={item.type}
            type="button"
            className={navButtonClass(active, true, isDarkTheme)}
            onClick={() => onSwitchUml(item.type)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
      {NON_UML_EDITOR_ITEMS.map((item) => {
        const active = locationPath === '/' && activeDiagramType === item.type;
        return (
          <button
            key={item.type}
            type="button"
            className={navButtonClass(active, true, isDarkTheme)}
            onClick={() => onSwitchDiagramType(item.type)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
      {ROUTE_ITEMS.map((item) => {
        const active = locationPath === item.path;
        return (
          <button
            key={item.path}
            type="button"
            className={navButtonClass(active, true, isDarkTheme)}
            onClick={() => onNavigate(item.path)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};
