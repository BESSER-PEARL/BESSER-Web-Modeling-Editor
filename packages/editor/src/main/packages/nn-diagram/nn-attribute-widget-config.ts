import { NNElementType } from './index';
import { INNAttribute } from './nn-component-attribute';
import { getListExpectation } from './nn-validation-defaults';

export type WidgetType = 'text' | 'dropdown' | 'predecessor' | 'layers_of_tensors' | 'multiselect' | 'subscript_indices' | 'repeat_dim' | 'pad_amount';

export type TnsTypeCategory = 'unary' | 'binary' | 'double' | 'n-ary';

export interface AttributeWidgetConfig {
  widget: WidgetType;
  /** Fixed options list, only for widget: 'dropdown' */
  options?: string[];
  /** Fallback value when stored value is absent or not in options, only for widget: 'dropdown' */
  defaultValue?: string;
  /** Compute the initial stored value when the attribute is first checked on, e.g. pooling dimension-aware defaults */
  getInitialValue?: (elements: Record<string, any>, layerId: string) => string;
  /** For layers_of_tensors: tns_type category determines element count */
  tnsTypeCategory?: TnsTypeCategory;
  /** Placeholder text shown in the text field */
  placeholder?: string;
}

/**
 * Determine the layers_of_tensors category based on tns_type value
 * - unary: 1 element (string layer/tensorop name)
 * - binary: 2 elements (string layer/tensorop name OR numeric literal)
 * - double: 2 elements (string layer/tensorop names only)
 * - n-ary: N≥2 elements (string layer/tensorop names only)
 */
export function getTnsTypeCategory(tnsType: string): TnsTypeCategory {
  // N-ary: concatenation
  if (tnsType === 'concatenate') {
    return 'n-ary';
  }

  // Binary: operations that support two operands (layer names OR numeric literals)
  if (['binop_add', 'binop_subtract', 'binop_multiply', 'binop_divide', 'binop_floor_divide', 'multiply'].includes(tnsType)) {
    return 'binary';
  }

  // Double: operations that require exactly 2 layer/tensorop names
  if (['matmultiply'].includes(tnsType)) {
    return 'double';
  }

  // Unary: single layer/tensorop reference
  return 'unary';
}

function getPoolingDimension(elements: Record<string, any>, layerId: string): string {
  const dimAttr = Object.values(elements).find(
    (el: any) => el.owner === layerId && el.type === NNElementType.DimensionAttributePooling,
  );
  return (dimAttr as INNAttribute)?.value || '2D';
}

const ACTV_FUNC_OPTIONS         = ['relu', 'leaky_relu', 'sigmoid', 'softmax', 'tanh'];
const BOOLEAN_OPTIONS           = ['true', 'false'];
const PADDING_OPTIONS           = ['valid', 'same'];
const RETURN_OPTIONS            = ['hidden', 'last', 'full'];
const TNS_TYPE_OPTIONS          = ['reshape', 'concatenate', 'multiply', 'matmultiply', 'permute', 'transpose', 'mean', 'max', 'squeeze', 'unsqueeze', 'binop_add', 'binop_subtract', 'binop_multiply', 'binop_divide', 'binop_floor_divide', 'subscript', 'shape_dim', 'normalize', 'repeat', 'interpolate', 'pad', 'dropout', 'zeros_like', 'split', 'identity'];
const TASK_TYPE_OPTIONS         = ['binary', 'multi_class', 'regression'];
const INPUT_FORMAT_OPTIONS      = ['csv', 'images'];
const PAD_MODE_OPTIONS          = ['constant', 'reflect', 'replicate'];
const INTERPOLATE_MODE_OPTIONS  = ['nearest', 'linear', 'bilinear', 'bicubic', 'trilinear', 'area', 'nearest-exact', 'lanczos3', 'lanczos5', 'gaussian', 'mitchellcubic'];

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
  [NNElementType.BiasAttributeConv1D]:                   { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'true' },
  [NNElementType.IsLayerCallAttributeConv1D]:            { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.PermuteInAttributeConv2D]:              { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.PermuteOutAttributeConv2D]:             { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BiasAttributeConv2D]:                   { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'true' },
  [NNElementType.IsLayerCallAttributeConv2D]:            { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.PermuteInAttributeConv3D]:              { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.PermuteOutAttributeConv3D]:             { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BiasAttributeConv3D]:                   { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'true' },
  [NNElementType.IsLayerCallAttributeConv3D]:            { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.PermuteInAttributePooling]:             { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.PermuteOutAttributePooling]:            { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.IsLayerCallAttributePooling]:           { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
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
  [NNElementType.PaddingIdxAttributeEmbedding]:          { widget: 'text', defaultValue: '' },
  [NNElementType.IsLayerCallAttributeEmbedding]:         { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputVarAttributeEmbedding]:            { widget: 'text', defaultValue: '' },
  [NNElementType.OutputVarAttributeEmbedding]:           { widget: 'text', defaultValue: '' },
  [NNElementType.InputReusedAttributeDropout]:           { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.DimensionAttributeDropout]:             { widget: 'dropdown', options: ['1D', '2D', '3D'], defaultValue: '1D' },
  [NNElementType.IsLayerCallAttributeDropout]:           { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputVarAttributeDropout]:              { widget: 'text', defaultValue: '' },
  [NNElementType.OutputVarAttributeDropout]:             { widget: 'text', defaultValue: '' },
  [NNElementType.InputReusedAttributeLayerNormalization]:{ widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.EpsAttributeLayerNormalization]:         { widget: 'text', defaultValue: '1e-5' },
  [NNElementType.AffineAttributeLayerNormalization]:      { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'true' },
  [NNElementType.IsLayerCallAttributeLayerNormalization]: { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputVarAttributeLayerNormalization]:    { widget: 'text', defaultValue: '' },
  [NNElementType.OutputVarAttributeLayerNormalization]:   { widget: 'text', defaultValue: '' },
  [NNElementType.InputReusedAttributeBatchNormalization]:{ widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.EpsAttributeBatchNormalization]:         { widget: 'text', defaultValue: '1e-5' },
  [NNElementType.MomentumAttributeBatchNormalization]:    { widget: 'text', defaultValue: '0.1' },
  [NNElementType.AffineAttributeBatchNormalization]:      { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'true' },
  [NNElementType.TrackRunningStatsAttributeBatchNormalization]: { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'true' },
  [NNElementType.IsLayerCallAttributeBatchNormalization]: { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputVarAttributeBatchNormalization]:    { widget: 'text', defaultValue: '' },
  [NNElementType.OutputVarAttributeBatchNormalization]:   { widget: 'text', defaultValue: '' },
  [NNElementType.InputReusedAttributeTensorOp]:          { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.ReduceDimAttributeTensorOp]:            { widget: 'text', defaultValue: '' },
  [NNElementType.ReduceKeepdimAttributeTensorOp]:        { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.ShapeDimAttributeTensorOp]:             { widget: 'text', defaultValue: '' },
  [NNElementType.ActualVarsAttributeTensorOp]:           { widget: 'multiselect', defaultValue: '[]', options: ['output', 'hidden'] },
  [NNElementType.SubscriptIndicesAttributeTensorOp]:     { widget: 'subscript_indices', defaultValue: '' },
  [NNElementType.RepeatDimAttributeTensorOp]:            { widget: 'text', defaultValue: '' },
  [NNElementType.InterpolateSizeAttributeTensorOp]:      { widget: 'text', defaultValue: '', placeholder: '' },
  [NNElementType.InterpolateScaleAttributeTensorOp]:     { widget: 'text', defaultValue: '', placeholder: '' },
  [NNElementType.InterpolateModeAttributeTensorOp]:      { widget: 'dropdown', options: INTERPOLATE_MODE_OPTIONS, defaultValue: 'bilinear' },
  [NNElementType.PadAmountAttributeTensorOp]:            { widget: 'pad_amount', defaultValue: '[]' },
  [NNElementType.PadModeAttributeTensorOp]:              { widget: 'dropdown', options: PAD_MODE_OPTIONS, defaultValue: 'constant' },
  [NNElementType.PadValueAttributeTensorOp]:             { widget: 'text', defaultValue: '0.0' },
  [NNElementType.DropoutRateAttributeTensorOp]:          { widget: 'text', defaultValue: '' },
  [NNElementType.DropoutTrainingAwareAttributeTensorOp]: { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.SplitDimAttributeTensorOp]:             { widget: 'text', defaultValue: '' },
  [NNElementType.SplitSizesAttributeTensorOp]:           { widget: 'text', defaultValue: '' },
  [NNElementType.PermuteInAttributeTensorOp]:            { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.PermuteOutAttributeTensorOp]:           { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.InputVarAttributeTensorOp]:             { widget: 'text', defaultValue: '' },
  [NNElementType.OutputVarAttributeTensorOp]:            { widget: 'text', defaultValue: '' },
  [NNElementType.OutputVarsAttributeTensorOp]:           { widget: 'text', defaultValue: '[]' },
  [NNElementType.BidirectionalAttributeRNN]:             { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BidirectionalAttributeLSTM]:            { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BidirectionalAttributeGRU]:             { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BatchFirstAttributeRNN]:                { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BatchFirstAttributeLSTM]:               { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BatchFirstAttributeGRU]:                { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BiasAttributeRNN]:                      { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'true' },
  [NNElementType.IsLayerCallAttributeRNN]:               { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.HiddenUnusedAttributeRNN]:              { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BiasAttributeLSTM]:                     { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'true' },
  [NNElementType.IsLayerCallAttributeLSTM]:              { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.HiddenUnusedAttributeLSTM]:             { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.CellUnusedAttributeLSTM]:               { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BiasAttributeGRU]:                      { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'true' },
  [NNElementType.IsLayerCallAttributeGRU]:               { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.HiddenUnusedAttributeGRU]:              { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.BiasAttributeLinear]:                   { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'true' },
  [NNElementType.IsLayerCallAttributeLinear]:            { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },
  [NNElementType.IsLayerCallAttributeFlatten]:           { widget: 'dropdown', options: BOOLEAN_OPTIONS, defaultValue: 'false' },

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

  // ── Dataset enum attributes ───────────────────────────────────────────────────
  [NNElementType.TaskTypeAttributeDataset]:    { widget: 'dropdown', options: TASK_TYPE_OPTIONS,    defaultValue: 'multi_class' },
  [NNElementType.InputFormatAttributeDataset]: { widget: 'dropdown', options: INPUT_FORMAT_OPTIONS, defaultValue: 'images' },
  [NNElementType.NormalizeAttributeDataset]:   { widget: 'dropdown', options: BOOLEAN_OPTIONS,      defaultValue: 'false' },
};

const DEFAULT_CONFIG: AttributeWidgetConfig = { widget: 'text' };

export function getWidgetConfig(attributeType: string): AttributeWidgetConfig {
  return WIDGET_CONFIG_MAP[attributeType] ?? DEFAULT_CONFIG;
}