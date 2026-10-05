import React from 'react';
import { connect } from 'react-redux';
import { ModelState } from '../../store/model-state';
import { Button } from '../button/button';
import { GearIcon } from '../icon/gear';
import { I18nConsumer } from '../../i18n/i18n-context';

type Props = { onClick: any; colorEnabled?: boolean };

export function ColorButtonComponent({ onClick, colorEnabled }: Props) {
  if (!colorEnabled) {
    return null;
  }

  return (
    <I18nConsumer>
      {(i18n) => (
        <Button color="link" onClick={onClick} aria-label={i18n?.translate('actions.style') || 'Style'}>
          <GearIcon />
        </Button>
      )}
    </I18nConsumer>
  );
}
type OwnProps = {};

type StateProps = {};

type DispatchProps = {};

export const ColorButton = connect<StateProps, DispatchProps, OwnProps, ModelState>((state) => ({
  colorEnabled: state.editor.colorEnabled,
}))(ColorButtonComponent);
