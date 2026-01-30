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
    <div style={{ width: '100%', height: 400, marginBottom: 20 }}>
      {title && <h3 style={{ textAlign: 'center', marginBottom: 10 }}>{title}</h3>}
      {isEmpty ? (
        <div style={{ textAlign: 'center', paddingTop: 160, color: '#888' }}>No data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
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
    </div>
  );
};
