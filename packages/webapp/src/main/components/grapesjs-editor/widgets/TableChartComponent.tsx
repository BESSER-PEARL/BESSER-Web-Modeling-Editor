import React, { useMemo } from 'react';

interface TableColumn {
  field: string;
  label?: string;
}

interface TableChartComponentProps {
  color?: string;
  title?: string;
  data?: Array<Record<string, any>>;
  showHeader?: boolean;
  striped?: boolean;
  showPagination?: boolean;
  rowsPerPage?: number;
  columns?: TableColumn[];
}

export const TableChartComponent: React.FC<TableChartComponentProps> = ({
  color = '#2c3e50',
  title = 'Table Chart Title',
  data = [],
  showHeader = true,
  striped = false,
  showPagination = true,
  rowsPerPage = 5,
  columns,
}) => {
  const headerColor = useMemo(() => {
    if (typeof color === 'string' && color.trim().length > 0) {
      return color;
    }
    return '#2c3e50';
  }, [color]);

  const pageSize = useMemo(() => Math.max(1, Number(rowsPerPage) || 1), [rowsPerPage]);

  const resolvedColumns = useMemo<TableColumn[]>(() => {
    if (Array.isArray(columns) && columns.length > 0) {
      return columns.map(col => ({
        field: col.field,
        label: col.label || col.field,
      }));
    }
    return [
      { field: 'label', label: 'Label' },
      { field: 'value', label: 'Value' },
    ];
  }, [columns]);

  const placeholderRows = useMemo(() => {
    const sampleRowCount = Math.max(3, resolvedColumns.length || 1);
    return Array.from({ length: sampleRowCount }).map((_, index) => {
      return resolvedColumns.reduce<Record<string, string>>((row, col) => {
        row[col.field] = `${col.label ?? col.field} ${index + 1}`;
        return row;
      }, {});
    });
  }, [resolvedColumns]);

  const sourceRows = useMemo(() => {
    if (Array.isArray(data) && data.length > 0) {
      return data;
    }
    return placeholderRows;
  }, [data, placeholderRows]);

  const visibleRows = useMemo(() => {
    return showPagination ? sourceRows.slice(0, pageSize) : sourceRows;
  }, [sourceRows, pageSize, showPagination]);

  return (
    <div
      className="table-chart-container"
      style={{
        padding: '20px',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        minHeight: '240px',
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
        alignSelf: 'stretch',
        minWidth: 0,
        overflowX: 'hidden',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h3 style={{ margin: 0, color: '#333', fontFamily: 'Arial, sans-serif' }}>
          {title}
        </h3>
        <p style={{ margin: 0, color: '#666', fontSize: '13px', fontFamily: 'Arial, sans-serif' }}>
          Data preview only. Configure bindings to connect table rows to your domain model.
        </p>
      </div>

      <div style={{ overflowX: 'auto', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            tableLayout: 'fixed',
            maxWidth: '100%',
            boxSizing: 'border-box',
          }}
        >
          {showHeader && (
            <thead>
              <tr style={{ backgroundColor: headerColor, color: '#fff' }}>
                {resolvedColumns.map(column => (
                  <th key={column.field} style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>
                    {column.label ?? column.field}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {visibleRows.map((row, index) => (
              <tr
                key={`row-${index}`}
                style={{
                  backgroundColor: striped && index % 2 === 1 ? '#f5f7fa' : index % 2 === 0 ? '#ffffff' : '#fafafa',
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                {resolvedColumns.map(column => (
                  <td
                    key={column.field}
                    style={{
                      padding: '10px 12px',
                      color: '#34495e',
                      wordBreak: 'break-word',
                      whiteSpace: 'normal',
                      maxWidth: '100%',
                    }}
                  >
                    {(row as any)?.[column.field] ?? ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showPagination && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '8px',
            color: '#64748b',
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
          }}
        >
          <span>
            Showing {visibleRows.length} of {sourceRows.length} rows
          </span>
          <span>Rows per page: {pageSize}</span>
        </div>
      )}
    </div>
  );
};
