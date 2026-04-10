import { NNElementType } from './index';
import { INNAttribute } from './nn-component-attribute';
import { getListExpectation } from './nn-validation-defaults';

export type WidgetType = 'text' | 'dropdown' | 'predecessor' | 'layers_of_tensors';

export interface AttributeWidgetConfig {
  widget: WidgetType;
  /** Fixed options list, only for widget: 'dropdown' */
  options?: string[];
  /** Fallback value when stored value is absent or not in options, only for widget: 'dropdown' */
  defaultValue?: string;
  /** Compute the initial stored value when the attribute is first checked on, e.g. pooling dimension-aware defaults */
  getInitialValue?: (elements: Record<string, any>, layerId: string) => string;
}

function getPoolingDimension(elements: Record<string, any>, layerId: string): string {
  const dimAttr = Object.values(elements).find(
    (el: any) => el.owner === layerId && el.type === NNElementType.DimensionAttributePooling,
  );
  return (dimAttr as INNAttribute)?.value || '2D';
}

const ACTV_FUNC_OPTIONS = ['relu', 'leaky_relu', 'sigmoid', 'softmax', 'tanh'];
const BOOLEAN_OPTIONS   = ['true', 'false'];
const PADDING_OPTIONS   = ['valid', 'same'];
const RETURN_OPTIONS    = ['hidden', 'last', 'full'];
const TNS_TYPE_OPTIONS  = ['reshape', 'concatenate', 'multiply', 'matmultiply', 'transpose', 'permute'];

const WIDGET_CONFIG_MAP: Record<string, AttributeWidgetConfig> = {
  // ── Predecessor (name_module_input) ─────────────────────────────────────────
  [NNElementType.NameModuleInputAttributeConv1D]:             { widget: 'predecessor' },
  [NNElementType.NameModuleInputAttributeConv2D]:             { widget: 'predecessor' },
  [NNElementType.NameModuleInputAttributeConv3D]:             { widget: 'predecessor' },
  [NNElementType.NameModuleInputAttributePooling]:            { widget: 'predecessor' },
  [NNElementType.NameModuleInputAttributeRNN]:                { widget: 'predecessor' },
  [NNElementType.NameModuleInputAttributeLSTM]:               { widget: 'predecessor' },
  [NNElementType.NameModuleInputAttributeGRU]:                { widget: 'predecessor' },
  [NNElementType.NameModuleInputAttributeLinear]:             { widget: 'predecessor' },
  [NNElementType.NameModuleInputAttributeFlatten]:            { widget: 'predecessor' },
  [NNElementType.NameModuleInputAttributeEmbedding]:          { widget: 'predecessor' },
  [NNElementType.NameModuleInputAttributeDropout]:            { widget: 'predecessor' },
  [NNElementType.NameModuleInputAttributeLayerNormalization]: { widget: 'predecessor' },
  [NNElementType.NameModuleInputAttributeBatchNormalization]: { widget: 'predecessor' },

  // ── Layers of tensors (double predecessor dropdown) ──────────────────────────
  [NNElementType.LayersOfTensorsAttributeTensorOp]: { widget: 'layers_of_tensors' },

  // ── Padding type ─────────────────────────────────────────────────────────────
  [NNElementType.PaddingTypeAttributeConv1D]:  { widget: 'dropdown', options: PADDING_OPTIONS, defaultValue: 'valid' },
  [NNElementType.PaddingTypeAttributeConv2D]:  { widget: 'dropdown', options: PADDING_OPTIONS, defaultValue: 'valid' },
  [NNElementType.PaddingTypeAttributeConv3D]:  { widget: 'dropdown', options: PADDING_OPTIONS, defaultValue: 'valid' },
  [NNElementType.PaddingTypeAttributePooling]: { widget: 'dropdown', options: PADDING_OPTIONS, defaultValue: 'valid' },

  // ── TensorOp type ────────────────────────────────────────────────────────────
  [NNElementType.TnsTypeAttributeTensorOp]: { widget: 'dropdown', options: TNS_TYPE_OPTIONS, defaultValue: 'reshape' },

  // ── Return type (RNN / LSTM / GRU) ───────────────────────────────────────────
  [NNElementType.ReturnTypeAttributeRNN]:  { widget: 'dropdown', options: RETURN_OPTIONS, defaultValue: 'last' },
  [NNElementType.ReturnTypeAttributeLSTM]: { widget: 'dropdown', options: RETURN_OPTIONS, defaultValue: 'last' },
  [NNElementType.ReturnTypeAttributeGRU]:  { widget: 'dropdown', options: RETURN_OPTIONS, defaultValue: 'last' },

  // ── Activation function ──────────────────────────────────────────────────────
  [NNElementType.ActvFuncAttributeConv1D]:             { widget: 'dropdown', options: ACTV_FUNC_OPTIONS, defaultValue: 'relu' },
  [NNElementType.ActvFuncAttributeConv2D]:             { widget: 'dropdown', options: ACTV_FUNC_OPTIONS, defaultValue: 'relu' },
  [NNElementType.ActvFuncAttributeConv3D]:             { widget: 'dropdown', options: ACTV_FUNC_OPTIONS, defaultValue: 'relu' },
  [NNElementType.ActvFuncAttributePooling]:            { widget: 'dropdown', options: ACTV_FUNC_OPTIONS, defaultValue: 'relu' },
  [NNElementType.ActvFuncAttributeRNN]:                { widget: 'dropdown', options: ACTV_FUNC_OPTIONS, defaultValue: 'relu' },
  [NNElementType.ActvFuncAttributeLSTM]:               { widget: 'dropdown', options: ACTV_FUNC_OPTIONS, defaultValue: 'relu' },
  [NNElementType.ActvFuncAttributeGRU]:                { widget: 'dropdown', options: ACTV_FUNC_OPTIONS, defaultValue: 'relu' },
  [NNElementType.ActvFuncAttributeLinear]:             { widget: 'dropdown', options: ACTV_FUNC_OPTIONS, defaultValue: 'relu' },
  [NNElementType.ActvFuncAttributeFlatten]:            { widget: 'dropdown', options: ACTV_FUNC_OPTIONS, defaultValue: 'relu' },
  [NNElementType.ActvFuncAttributeEmbedding]:          { widget: 'dropdown', options: ACTV_FUNC_OPTIONS, defaultValue: 'relu' },
  [NNElementType.ActvFuncAttributeLayerNormalization]: { widget: 'dropdown', options: ACTV_FUNC_OPTIONS, defaultValue: 'relu' },
  [NNElementType.ActvFuncAttributeBatchNormalization]: { widget: 'dropdown', options: ACTV_FUNC_OPTIONS, defaultValue: 'relu' },

  // ── Boolean attributes ───────────────────────────────────────────────────────
  [NNElementType.PermuteInAttributeConv1D]:              { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.PermuteOutAttributeConv1D]:             { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.PermuteInAttributeConv2D]:              { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.PermuteOutAttributeConv2D]:             { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.PermuteInAttributeConv3D]:              { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.PermuteOutAttributeConv3D]:             { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.PermuteInAttributePooling]:             { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.PermuteOutAttributePooling]:            { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputReusedAttributeConv1D]:            { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputReusedAttributeConv2D]:            { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputReusedAttributeConv3D]:            { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputReusedAttributePooling]:           { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputReusedAttributeRNN]:               { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputReusedAttributeLSTM]:              { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputReusedAttributeGRU]:               { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputReusedAttributeLinear]:            { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputReusedAttributeFlatten]:           { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputReusedAttributeEmbedding]:         { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputReusedAttributeDropout]:           { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputReusedAttributeLayerNormalization]:{ widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputReusedAttributeBatchNormalization]:{ widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputReusedAttributeTensorOp]:          { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BidirectionalAttributeRNN]:             { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BidirectionalAttributeLSTM]:            { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BidirectionalAttributeGRU]:             { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BatchFirstAttributeRNN]:                { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BatchFirstAttributeLSTM]:               { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BatchFirstAttributeGRU]:                { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },

  // ── Pooling dimension-aware list attributes ───────────────────────────────────
  // getInitialValue picks the correctly-sized list based on the Pooling layer's dimension attribute.
  [NNElementType.KernelDimAttributePooling]: {
    widget: 'text',
    getInitialValue: (elements, layerId) =>
      getListExpectation(NNElementType.KernelDimAttributePooling, layerId, elements).example,
  },
  [NNElementType.StrideDimAttributePooling]: {
    widget: 'text',
    getInitialValue: (elements, layerId) =>
      getListExpectation(NNElementType.StrideDimAttributePooling, layerId, elements).example,
  },
  [NNElementType.OutputDimAttributePooling]: {
    widget: 'text',
    getInitialValue: (elements, layerId) => {
      switch (getPoolingDimension(elements, layerId)) {
        case '1D': return '[16]';
        case '3D': return '[16, 16, 16]';
        default:   return '[16, 16]';
      }
    },
  },
};

const DEFAULT_CONFIG: AttributeWidgetConfig = { widget: 'text' };

export function getWidgetConfig(attributeType: string): AttributeWidgetConfig {
  return WIDGET_CONFIG_MAP[attributeType] ?? DEFAULT_CONFIG;
}