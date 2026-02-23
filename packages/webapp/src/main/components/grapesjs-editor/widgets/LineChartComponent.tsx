import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SeriesItem {
  name: string;
  color?: string;
  data: Array<{ name: string; value: number }>;
}

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
  series?: SeriesItem[];
}


// Use the same default data as BarChart for consistency
const defaultData = [
  { name: 'Category A', value: 40 },
  { name: 'Category B', value: 65 },
  { name: 'Category C', value: 85 },
  { name: 'Category D', value: 55 },
  { name: 'Category E', value: 75 },
];

const defaultSeries: SeriesItem[] = [
  {
    name: 'Series 1',
    color: '#4CAF50',
    data: defaultData,
  },
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
  series,
}) => {
  // If series prop is provided, use it. If it's an empty array, show "No data available". If undefined, use defaultSeries.
  let chartSeries: SeriesItem[] = defaultSeries;
  if (Array.isArray(series)) {
    chartSeries = series.length > 0 ? series : [];
  }

  // Merge all data points by name for X axis
  const allNames = Array.from(
    new Set(chartSeries.flatMap(s => s.data.map(d => d.name)))
  );
  const mergedData = allNames.map(name => {
    const entry: any = { name };
    chartSeries.forEach((s, idx) => {
      const found = s.data.find(d => d.name === name);
      entry[`value${idx}`] = found ? found.value : null;
    });
    return entry;
  });

  const isEmpty = !chartSeries || chartSeries.length === 0 || allNames.length === 0;

  return (
    <div style={{ width: '100%', height: 400, marginBottom: 20 }}>
      {title && <h3 style={{ textAlign: 'center', marginBottom: 10 }}>{title}</h3>}
      {isEmpty ? (
        <div style={{ textAlign: 'center', paddingTop: 160, color: '#888' }}>No data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={mergedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
            <XAxis dataKey="name" stroke="#666" />
            <YAxis stroke="#666" />
            {showTooltip && <Tooltip />}
            {showLegend && <Legend />}
            {chartSeries.map((s, idx) => (
              <Line
                key={s.name || idx}
                type={curveType}
                dataKey={`value${idx}`}
                stroke={s.color || color}
                strokeWidth={lineWidth}
                dot={{ fill: s.color || color, r: 5 }}
                activeDot={{ r: 7 }}
                name={s.name || `Series ${idx + 1}`}
                isAnimationActive={animate}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};
