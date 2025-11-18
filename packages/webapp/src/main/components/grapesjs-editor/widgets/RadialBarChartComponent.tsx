import React from 'react';
import { RadialBarChart, RadialBar, Legend, Tooltip, ResponsiveContainer } from 'recharts';


interface SeriesItem {
  name: string;
  color?: string;
  data: Array<{ name: string; value: number; fill: string }>;
}

interface RadialBarChartComponentProps {
  title?: string;
  data?: Array<{ name: string; value: number; fill: string }>;
  series?: SeriesItem[];
  startAngle?: number;
  endAngle?: number;
}

const defaultData = [
  { name: 'Category A', value: 90, fill: '#00C49F' },
  { name: 'Category B', value: 70, fill: '#0088FE' },
  { name: 'Category C', value: 50, fill: '#FFBB28' },
  { name: 'Category D', value: 30, fill: '#FF8042' },
  { name: 'Category E', value: 15, fill: '#A569BD' },
];


export const RadialBarChartComponent: React.FC<RadialBarChartComponentProps> = ({
  title = 'Radial Bar Chart Title',
  data = defaultData,
  series,
  startAngle = 90,
  endAngle = 450,
}) => {
  // If series is provided, use its first item for data. If it's an empty array, show no data.
  let chartData = data;
  if (Array.isArray(series)) {
    chartData = series.length > 0 ? series[0].data : [];
  }
  const isEmpty = !chartData || chartData.length === 0;
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
      {isEmpty ? (
        <div style={{ textAlign: 'center', padding: '120px 0', color: '#888' }}>No data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="10%"
            outerRadius="80%"
            data={chartData}
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
      )}
      <div style={{ marginTop: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#666', fontFamily: 'Arial, sans-serif' }}>
          Rating distribution by category
        </p>
      </div>
    </div>
  );
};
