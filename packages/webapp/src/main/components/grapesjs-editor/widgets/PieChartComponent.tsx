import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, PieLabelRenderProps } from 'recharts';

interface PieChartComponentProps {
  title?: string;
  data?: Array<{ name: string; value: number }>;
  showLegend?: boolean;
  legendPosition?: 'top' | 'right' | 'bottom' | 'left';
  showLabels?: boolean;
  labelPosition?: 'inside' | 'outside';
  paddingAngle?: number;
}

const defaultData = [
  { name: 'Desktop', value: 45 },
  { name: 'Mobile', value: 35 },
  { name: 'Tablet', value: 15 },
  { name: 'Other', value: 5 },
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export const PieChartComponent: React.FC<PieChartComponentProps> = ({
  title = 'Pie Chart Title',
  data = defaultData,
  showLegend = true,
  legendPosition = 'right',
  showLabels = true,
  labelPosition = 'inside',
  paddingAngle = 0,
}) => {
  return (
    <div
      className="pie-chart-container"
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
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={showLabels ? labelPosition === 'outside' : false}
            label={showLabels ? (entry: any) => {
              const percent = entry.percent;
              return labelPosition === 'inside' ? 
                `${(percent * 100).toFixed(0)}%` : 
                `${entry.name}: ${(percent * 100).toFixed(0)}%`;
            } : undefined}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            paddingAngle={paddingAngle}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          {showLegend && (
            <Legend 
              verticalAlign={legendPosition === 'top' || legendPosition === 'bottom' ? legendPosition : 'middle'}
              align={legendPosition === 'left' || legendPosition === 'right' ? legendPosition : 'center'} 
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      <div style={{ marginTop: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#666', fontFamily: 'Arial, sans-serif' }}>
          Distribution across different categories
        </p>
      </div>
    </div>
  );
};
