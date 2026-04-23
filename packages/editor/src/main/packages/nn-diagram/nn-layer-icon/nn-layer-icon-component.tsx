import React, { FunctionComponent } from 'react';
import { Text } from '../../../components/controls/text/text';
import { NNElementType } from '..';

// Map layer types to image filenames
const LAYER_ICONS: { [key: string]: string } = {
  [NNElementType.Conv1DLayer]: 'conv1d.png',
  [NNElementType.Conv2DLayer]: 'conv2d.png',
  [NNElementType.Conv3DLayer]: 'conv3d.png',
  [NNElementType.PoolingLayer]: 'pooling.png',
  [NNElementType.LinearLayer]: 'linear.png',
  [NNElementType.FlattenLayer]: 'flatten.png',
  [NNElementType.EmbeddingLayer]: 'embedding.png',
  [NNElementType.DropoutLayer]: 'dropout.png',
  [NNElementType.RNNLayer]: 'rnn.png',
  [NNElementType.LSTMLayer]: 'lstm.png',
  [NNElementType.GRULayer]: 'gru.png',
  [NNElementType.LayerNormalizationLayer]: 'layernorm.png',
  [NNElementType.BatchNormalizationLayer]: 'batchnorm.png',
  [NNElementType.TensorOp]: 'tensorop.png',
  [NNElementType.Configuration]: 'configuration.png',
  [NNElementType.TrainingDataset]: 'train_data.png',
  [NNElementType.TestDataset]: 'test_data.png',
};

// Base path for layer icons - assets folder is copied to root by webpack
const ICON_BASE_PATH = '/images/nn-layers/';

interface Props {
  element: {
    id: string;
    name: string;
    type: string;
    bounds: { width: number; height: number };
    textColor?: string;
  };
  children?: React.ReactNode;
}

export const NNLayerIconComponent: FunctionComponent<Props> = ({ element }) => {
  const iconFile = LAYER_ICONS[element.type] || 'default.png';
  const iconPath = `${ICON_BASE_PATH}${iconFile}`;

  const iconSize = 80;
  const textHeight = 20;

  // Vertical layout: icon on top, text below
  const iconX = (element.bounds.width - iconSize) / 2;
  const iconY = 4;
  const textY = iconY + iconSize + 4;

  return (
    <g>
      {/* Layer icon - no background frame */}
      <image
        href={iconPath}
        x={iconX}
        y={iconY}
        width={iconSize}
        height={iconSize}
        preserveAspectRatio="xMidYMid meet"
      />

      {/* Layer name */}
      <svg y={textY} height={textHeight} width="100%">
        <Text fill={element.textColor || '#000000'} fontSize="11px">
          <tspan x="50%" textAnchor="middle">
            {element.name}
          </tspan>
        </Text>
      </svg>
    </g>
  );
};
