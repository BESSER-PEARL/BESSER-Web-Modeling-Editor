import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SeriesItem {
  name: string;
  color?: string;
  data: Array<{ name: string; value: number }>;
}

interface BarChartComponentProps {
  series?: SeriesItem[];
  title?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  barWidth?: number;
  orientation?: 'vertical' | 'horizontal';
  stacked?: boolean;
}

const defaultSeries: SeriesItem[] = [
  { name: 'Series 1', color: '#3498db', data: [
    { name: 'Category A', value: 40 },
    { name: 'Category B', value: 65 },
    { name: 'Category C', value: 85 },
    { name: 'Category D', value: 55 },
    { name: 'Category E', value: 75 },
  ]},
];

export const BarChartComponent: React.FC<BarChartComponentProps> = ({
  series = defaultSeries,
  title = 'Bar Chart Title',
  showGrid = true,
  showLegend = true,
  barWidth = 30,
  orientation = 'vertical',
  stacked = false,
}) => {
  // Merge all data keys for the X axis
  const allNames = Array.from(new Set(series.flatMap(s => s.data.map(d => d.name))));
  // Build a merged data array for grouped/stacked bars
  const mergedData = allNames.map(name => {
    const entry: any = { name };
    series.forEach(s => {
      const found = s.data.find(d => d.name === name);
      entry[s.name] = found ? found.value : 0;
    });
    return entry;
  });

  const isEmpty = !series || series.length === 0 || allNames.length === 0;

  return (
    <div style={{ width: '100%', height: 400, marginBottom: 20 }}>
      {title && <h3 style={{ textAlign: 'center', marginBottom: 10 }}>{title}</h3>}
      {isEmpty ? (
        <div style={{ textAlign: 'center', paddingTop: 160, color: '#888' }}>No data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={360}>
          <BarChart 
            data={mergedData}
            layout={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
            margin={orientation === 'horizontal' ? 
              { top: 5, right: 30, left: 50, bottom: 5 } :
              { top: 5, right: 30, left: 20, bottom: 20 }
            }
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
            <XAxis 
              type={orientation === 'horizontal' ? 'number' : 'category'}
              dataKey={orientation === 'horizontal' ? undefined : 'name'}
              stroke="#666" 
            />
            <YAxis 
              type={orientation === 'horizontal' ? 'category' : 'number'}
              dataKey={orientation === 'horizontal' ? 'name' : undefined}
              stroke="#666"
              width={orientation === 'horizontal' ? 100 : 60}
            />
            <Tooltip />
            {showLegend && <Legend />}
            {series.map((s, idx) => (
              <Bar
                key={s.name || idx}
                dataKey={s.name}
                fill={s.color || '#3498db'}
                radius={orientation === 'horizontal' ? [0, 8, 8, 0] : [8, 8, 0, 0]}
                name={s.name}
                barSize={barWidth}
                stackId={stacked ? "stack" : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};
