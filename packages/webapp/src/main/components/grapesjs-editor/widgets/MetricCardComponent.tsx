import React from 'react';

interface MetricCardComponentProps {
  'metric-title'?: string;
  'value-color'?: string;
  'value-size'?: number;
  'show-trend'?: boolean;
  'positive-color'?: string;
  'negative-color'?: string;
  format?: 'number' | 'currency' | 'percentage' | 'time';
  value?: number;
  trend?: number; // Percentage change (e.g., 12 for +12%)
  data_binding?: {
    entity?: string;
    endpoint?: string;
    data_field?: string;
    aggregation?: string;
  };
}

// Format value based on format type
const formatValue = (value: number, format: string): string => {
  switch (format) {
    case 'currency':
      return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
    case 'percentage':
      return `${value.toFixed(2)}%`;
    case 'time':
      const hours = Math.floor(value / 60);
      const minutes = value % 60;
      return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    case 'number':
    default:
      return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
};

// Format trend display
const formatTrend = (trend: number): string => {
  const sign = trend >= 0 ? '↑' : '↓';
  return `${sign} ${Math.abs(trend)}% from last month`;
};

export const MetricCardComponent: React.FC<MetricCardComponentProps> = ({
  'metric-title': metricTitle = 'Metric Title',
  'value-color': valueColor = '#2c3e50',
  'value-size': valueSize = 32,
  'show-trend': showTrend = true,
  'positive-color': positiveColor = '#27ae60',
  'negative-color': negativeColor = '#e74c3c',
  format = 'number',
  value = 0,
  trend = 0,
  data_binding,
}) => {
  // Display data binding info if available
  const hasDataBinding = data_binding && data_binding.entity;
  const displayValue = hasDataBinding 
    ? `${data_binding.aggregation?.toUpperCase() || 'SUM'}(${data_binding.data_field || 'field'})`
    : formatValue(value, format);

  const trendColor = trend >= 0 ? positiveColor : negativeColor;

  return (
    <div
      className="metric-card-container"
      style={{
        background: 'white',
        padding: '25px',
        borderRadius: '10px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        fontFamily: 'Arial, sans-serif',
        minHeight: '140px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Metric Title */}
      <div
        style={{
          color: '#666',
          fontSize: '14px',
          marginBottom: '8px',
          fontWeight: '500',
        }}
      >
        {metricTitle}
      </div>

      {/* Metric Value */}
      <div
        style={{
          fontSize: `${valueSize}px`,
          fontWeight: 'bold',
          color: valueColor,
          marginBottom: '8px',
          wordBreak: 'break-word',
        }}
      >
        {displayValue}
      </div>

      {/* Trend Indicator (optional) */}
      {showTrend && (
        <div
          style={{
            color: trendColor,
            fontSize: '12px',
            marginTop: '8px',
            fontWeight: '500',
          }}
        >
          {hasDataBinding ? '📊 Data bound to ' + (data_binding.entity || 'entity') : formatTrend(trend)}
        </div>
      )}

      {/* Data Binding Info (for editor preview) */}
      {hasDataBinding && (
        <div
          style={{
            marginTop: '10px',
            padding: '8px',
            background: '#f0f0f0',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#666',
            fontFamily: 'monospace',
          }}
        >
          <div>📦 Entity: {data_binding.entity}</div>
          <div>📊 Field: {data_binding.data_field || 'none'}</div>
          <div>🧮 Agg: {data_binding.aggregation || 'none'}</div>
        </div>
      )}
    </div>
  );
};
