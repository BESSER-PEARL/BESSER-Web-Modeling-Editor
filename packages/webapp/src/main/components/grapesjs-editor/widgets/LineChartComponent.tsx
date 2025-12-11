import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LineChartComponentProps {
  color?: string;
  title?: string;
  data?: Array<{ name: string; value: number }>;
  showGrid?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  lineWidth?: number;
  curveType?: 'linear' | 'monotone' | 'step' | 'stepBefore' | 'stepAfter';
  animate?: boolean;
}

const defaultData = [
  { name: 'Jan', value: 30 },
  { name: 'Feb', value: 35 },
  { name: 'Mar', value: 55 },
  { name: 'Apr', value: 45 },
  { name: 'May', value: 75 },
  { name: 'Jun', value: 65 },
];

export const LineChartComponent: React.FC<LineChartComponentProps> = ({
  color = '#4CAF50',
  title = 'Line Chart Title',
  data = defaultData,
  showGrid = true,
  showLegend = true,
  showTooltip = true,
  lineWidth = 2,
  curveType = 'monotone',
  animate = true,
}) => {
  return (
    <div
      className="line-chart-container"
      style={{
        padding: '20px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      }}
    >
      <h3 style={{ margin: '0 0 15px 0', color: '#333', fontFamily: 'Arial, sans-serif' }}>
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
          <XAxis dataKey="name" stroke="#666" />
          <YAxis stroke="#666" />
          {showTooltip && <Tooltip />}
          {showLegend && <Legend />}
          <Line
            type={curveType}
            dataKey="value"
            stroke={color}
            strokeWidth={lineWidth}
            dot={{ fill: color, r: 5 }}
            activeDot={{ r: 7 }}
            name="Monthly Sales"
            isAnimationActive={animate}
          />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ marginTop: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#666', fontFamily: 'Arial, sans-serif' }}>
          <span className="legend-color" style={{ color: color, fontWeight: 'bold' }}>●</span> Monthly Sales Data
        </p>
      </div>
    </div>
  );
};
