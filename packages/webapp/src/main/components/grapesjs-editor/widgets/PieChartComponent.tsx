import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, PieLabelRenderProps } from 'recharts';



interface PieDataItem {
  name: string;
  value: number;
  color?: string;
}

interface SeriesItem {
  name: string;
  color?: string;
  data: PieDataItem[];
}


interface PieChartComponentProps {
  title?: string;
  data?: PieDataItem[];
  series?: SeriesItem[];
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
  series,
  showLegend = true,
  legendPosition = 'right',
  showLabels = true,
  labelPosition = 'inside',
  paddingAngle = 0,
}) => {
  // If series is provided, use its first item for data. If it's an empty array, show no data.
  let chartData: PieDataItem[] = data as PieDataItem[];
  if (Array.isArray(series)) {
    chartData = series.length > 0 ? (series[0].data as PieDataItem[]) : [];
  }
  // Ensure every data item has a color property (for palette changes)
  chartData = chartData.map((item, idx) => ({
    ...item,
    color: item.color || COLORS[idx % COLORS.length],
  }));
  const isEmpty = !chartData || chartData.length === 0;
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
      {isEmpty ? (
        <div style={{ textAlign: 'center', padding: '120px 0', color: '#888' }}>No data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData as any}
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
              {(chartData as PieDataItem[]).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
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
      )}
      <div style={{ marginTop: '15px', padding: '10px', background: '#f5f5f5', borderRadius: '4px' }}>
        <p style={{ margin: 0, fontSize: '14px', color: '#666', fontFamily: 'Arial, sans-serif' }}>
          Distribution across different categories
        </p>
      </div>
    </div>
  );
};
