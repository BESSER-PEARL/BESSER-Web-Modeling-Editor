import { Action } from '../../utils/actions/actions';
import { PreviewElement } from '../../packages/compose-preview';

export const enum PaletteActionTypes {
  SET_PALETTE = '@@palette/SET_PALETTE',
}

export type SetPaletteAction = Action<PaletteActionTypes.SET_PALETTE> & {
  payload: PreviewElement[];
};

export type PaletteActions = SetPaletteAction;

export const setPalette = (palette: PreviewElement[]) => ({
  type: PaletteActionTypes.SET_PALETTE,
  payload: palette,
});
