import React, { FunctionComponent } from 'react';
import { clamp } from '../../utils/clamp';
import { styled } from '../theme/styles';
import { I18nContext } from '../i18n/i18n-context';
import { localized } from '../i18n/localized';

type Props = {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  onAutoLayout?: () => void;
  style?: React.CSSProperties | undefined;
} & I18nContext;

const ZoomButton = styled.button`
  background: var(--apollon-background);
  color: var(--apollon-primary-contrast);
  border: 1px solid var(--apollon-gray);
  margin: 0;
  outline: none;
  border-radius: 0.25rem;
  width: 2.25em;
  height: 2.25em;
  display: flex;
  align-items: center;
  justify-content: center;

  @media (hover: hover) {
    :hover {
      background-color: var(--apollon-gray);
      border-color: var(--apollon-gray-variant);
    }
  }

  :focus-visible {
    outline: 2px solid ${(props) => props.theme.color.primary};
    outline-offset: 2px;
  }

  :active {
    background-color: var(--apollon-gray);
    border-color: var(--apollon-gray-variant);
  }
`;

export const ZoomPaneComponent: FunctionComponent<Props> = (props) => {
  const { min = 0.5, max = 5, step = 0.5, value, onChange, onAutoLayout, style, translate } = props;
  const label = (key: string, fallback: string) => translate?.(key) || fallback;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'absolute',
        right: '0.75em',
        bottom: '0.75em',
        ...style,
      }}
    >
      {onAutoLayout && (
        <ZoomButton
          style={{ marginBottom: '0.5em' }}
          onClick={onAutoLayout}
          title="Auto-layout (ELK)"
          aria-label={label('zoomPane.autoLayout', 'Auto-layout')}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="3" width="6" height="5" rx="1" />
            <rect x="2" y="16" width="6" height="5" rx="1" />
            <rect x="16" y="16" width="6" height="5" rx="1" />
            <path d="M12 8v4M5 16v-2h14v2" />
          </svg>
        </ZoomButton>
      )}
      <ZoomButton
        style={{ marginBottom: '0.5em' }}
        onClick={() => onChange(clamp(value + step, min, max))}
        aria-label={label('zoomPane.zoomIn', 'Zoom in')}
      >
        +
      </ZoomButton>
      <ZoomButton onClick={() => onChange(clamp(value - step, min, max))} aria-label={label('zoomPane.zoomOut', 'Zoom out')}>
        -
      </ZoomButton>
    </div>
  );
};

export const ZoomPane = localized(ZoomPaneComponent);
