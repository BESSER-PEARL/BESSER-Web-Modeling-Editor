import React from 'react';
import { RadialBarChart, RadialBar, Legend, Tooltip, ResponsiveContainer } from 'recharts';

interface RadialBarChartComponentProps {
  title?: string;
  data?: Array<{ name: string; value: number; fill: string }>;
  startAngle?: number;
  endAngle?: number;
}

const defaultData = [
  { name: 'Excellent', value: 90, fill: '#00C49F' },
  { name: 'Good', value: 70, fill: '#0088FE' },
  { name: 'Average', value: 50, fill: '#FFBB28' },
  { name: 'Poor', value: 30, fill: '#FF8042' },
];

export const RadialBarChartComponent: React.FC<RadialBarChartComponentProps> = ({
  title = 'Radial Bar Chart Title',
  data = defaultData,
  startAngle = 90,
  endAngle = 450,
}) => {
  return (
    <div
      className="radial-bar-chart-container"
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
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="10%"
          outerRadius="80%"
          data={data}
          startAngle={startAngle}
          endAngle={endAngle}
        >
          <RadialBar
            label={{ position: 'insideStart', fill: '#fff' }}
            background
            dataKey="value"
          />
          <Legend
            iconSize={10}
            layout="vertical"
            verticalAlign="middle"
            align="right"
          />
          <Tooltip />
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#666', fontFamily: 'Arial, sans-serif' }}>
          Rating distribution by category
        </p>
      </div>
    </div>
  );
};
