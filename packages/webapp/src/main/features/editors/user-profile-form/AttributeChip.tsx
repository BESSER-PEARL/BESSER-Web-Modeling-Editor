import React from 'react';
import { X, User, HelpCircle } from 'lucide-react';
import { attributeIconService } from '../../../shared/services/attribute-icons/attributeIconService';

interface AttributeChipProps {
  containerClass: string;
  attribute: string;
  value?: string;
  enumValues?: string[];
  onValueChange: (value: string) => void;
  onRemove: () => void;
  displayName?: string;
}

// Map icon names to Lucide components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  User,
  HelpCircle,
};

export const AttributeChip: React.FC<AttributeChipProps> = ({
  containerClass,
  attribute,
  value,
  enumValues = [],
  onValueChange,
  onRemove,
  displayName = attribute,
}) => {
  const iconName = attributeIconService.getIconName(containerClass, attribute, value);
  const IconComponent = ICON_MAP[iconName] || HelpCircle;

  const isEnum = enumValues.length > 0;

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/5 px-2.5 py-1.5 text-[13px] transition-all hover:border-brand/50 hover:bg-brand/10">
      <div className="flex items-center gap-1.5">
        <IconComponent className="size-3.5 text-brand" />
        <span className="font-medium text-foreground">{displayName}</span>
      </div>

      {value ? (
        <span className="text-muted-foreground">{value}</span>
      ) : (
        <span className="text-muted-foreground/50">not set</span>
      )}

      {isEnum ? (
        <select
          className="ml-1 h-5 border-0 bg-transparent text-[12px] text-foreground outline-none focus:ring-1 focus:ring-brand/50"
          value={value || ''}
          onChange={(e) => onValueChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          title={`Change ${displayName}`}
        >
          <option value="">—</option>
          {enumValues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          className="ml-1 h-5 w-20 border-0 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground/30 focus:ring-1 focus:ring-brand/50"
          value={value || ''}
          placeholder="value"
          onChange={(e) => onValueChange(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          title={`Set ${displayName}`}
        />
      )}

      <button
        className="ml-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title={`Remove ${displayName}`}
        aria-label={`Remove ${displayName}`}
      >
        <X className="size-3" />
      </button>
    </div>
  );
};
