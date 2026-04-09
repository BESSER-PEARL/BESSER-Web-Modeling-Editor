import { NNElementType } from './index';
import { INNAttribute } from './nn-component-attribute';

export const NN_ATTRIBUTE_DEFAULTS: Record<string, string> = {
  // Conv layers (1D/2D/3D share the same attribute names and defaults)
  out_channels: '16',
  in_channels: '3',
  padding_amount: '0',
  // Pooling-specific
  output_dim: '16',
  // Linear
  out_features: '128',
  in_features: '64',
  // Flatten
  start_dim: '1',
  end_dim: '-1',
  // Embedding
  num_embeddings: '1000',
  embedding_dim: '128',
  // Dropout
  rate: '0.5',
  // BatchNormalization
  num_features: '128',
  // TensorOp
  concatenate_dim: '0',
  // Recurrent layers (RNN/LSTM/GRU share the same attribute names and defaults)
  hidden_size: '128',
  input_size: '64',
  dropout: '0.0',
  // Configuration
  batch_size: '32',
  epochs: '10',
  learning_rate: '0.001',
  weight_decay: '0.0',
  momentum: '0',
};

export function getAttributeDefaultValue(element: { attributeName: string; value: string }): string {
  return NN_ATTRIBUTE_DEFAULTS[element.attributeName] || element.value || '';
}

export const LIST_STRICT_REGEX = /^\[\s*-?\d+(\s*,\s*-?\d+)*\s*\]$/;
export const LIST_PERMISSIVE_REGEX = /^(\[(-?\d+(\s*,\s*-?\d+)*(\s*,?\s*)?)?\]?)$/;

export function getListExpectation(
  elementType: string,
  ownerId: string | null | undefined,
  elements: Record<string, any>,
): { count: number | null; example: string } {
  switch (elementType) {
    case NNElementType.KernelDimAttributeConv1D: return { count: 1, example: '[3]' };
    case NNElementType.StrideDimAttributeConv1D: return { count: 1, example: '[1]' };
    case NNElementType.KernelDimAttributeConv2D: return { count: 2, example: '[3, 3]' };
    case NNElementType.StrideDimAttributeConv2D: return { count: 2, example: '[1, 1]' };
    case NNElementType.KernelDimAttributeConv3D: return { count: 3, example: '[3, 3, 3]' };
    case NNElementType.StrideDimAttributeConv3D: return { count: 3, example: '[1, 1, 1]' };
    case NNElementType.NormalizedShapeAttributeLayerNormalization: return { count: 1, example: '[-1]' };
    case NNElementType.TransposeDimAttributeTensorOp: return { count: 2, example: '[0, 1]' };
    case NNElementType.KernelDimAttributePooling:
    case NNElementType.StrideDimAttributePooling: {
      const isKernel = elementType === NNElementType.KernelDimAttributePooling;
      if (ownerId) {
        const dimAttr = Object.values(elements).find(
          (el: any) => el.owner === ownerId && el.type === NNElementType.DimensionAttributePooling,
        );
        switch ((dimAttr as INNAttribute)?.value) {
          case '1D': return { count: 1, example: isKernel ? '[3]' : '[1]' };
          case '3D': return { count: 3, example: isKernel ? '[3, 3, 3]' : '[1, 1, 1]' };
          default:   return { count: 2, example: isKernel ? '[3, 3]' : '[1, 1]' };
        }
      }
      return { count: 2, example: isKernel ? '[3, 3]' : '[1, 1]' };
    }
    default: return { count: null, example: '[1]' };
  }
}