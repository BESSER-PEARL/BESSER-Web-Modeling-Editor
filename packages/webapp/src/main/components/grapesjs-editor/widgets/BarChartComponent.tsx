import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BarChartComponentProps {
  color?: string;
  title?: string;
  data?: Array<{ name: string; value: number }>;
}

const defaultData = [
  { name: 'Product A', value: 40 },
  { name: 'Product B', value: 65 },
  { name: 'Product C', value: 85 },
  { name: 'Product D', value: 55 },
  { name: 'Product E', value: 75 },
];

export const BarChartComponent: React.FC<BarChartComponentProps> = ({
  color = '#3498db',
  title = 'Bar Chart Title',
  data = defaultData,
}) => {
  return (
    <div
      className="bar-chart-container"
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
        <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis dataKey="name" stroke="#666" />
          <YAxis stroke="#666" />
          <Tooltip />
          <Legend />
          <Bar
            dataKey="value"
            fill={color}
            radius={[8, 8, 0, 0]}
            name="Revenue"
          />
        </BarChart>
      </ResponsiveContainer>
      <div style={{ marginTop: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#666', fontFamily: 'Arial, sans-serif' }}>
          <span style={{ color: color, fontWeight: 'bold' }}>■</span> Revenue by Category
        </p>
      </div>
    </div>
  );
};
