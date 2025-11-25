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
  actionButtons?: boolean;
  dataBinding?: { entity?: string };
  filter?: string;
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
  actionButtons = true,
  dataBinding,
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

  // Get class/entity name for Add button
  const entityName = typeof dataBinding?.entity === 'string' && dataBinding.entity ? dataBinding.entity : '';
  const addButtonText = entityName ? `Add ${entityName}` : 'Add Register';

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

      {actionButtons ? (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <button
            style={{
              padding: '6px 14px',
              background: 'linear-gradient(90deg, #2563eb 0%, #1e40af 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '13px',
              boxShadow: '0 1px 4px rgba(37,99,235,0.10)',
              letterSpacing: '0.01em',
              transition: 'background 0.2s',
              marginRight: '0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            type="button"
            title={addButtonText}
            onClick={() => {}}
          >
            {/* Smaller Add icon */}
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="10" cy="10" r="8" fill="#2563eb"/>
              <rect x="9" y="5.5" width="2" height="9" rx="1" fill="white"/>
              <rect x="5.5" y="9" width="9" height="2" rx="1" fill="white"/>
            </svg>
            {addButtonText}
          </button>
        </div>
      ) : null}

      <div style={{ overflowX: 'auto', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            tableLayout: 'auto',
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
                {actionButtons ? (
                  <th style={{ textAlign: 'center', padding: '10px 4px', fontWeight: 600, width: '40px', minWidth: '40px', maxWidth: '40px', overflow: 'hidden' }}>
                    {/* Slimmer Actions column, no label for minimalist look */}
                  </th>
                ) : null}
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
                {actionButtons ? (
                  <td style={{ textAlign: 'center', padding: '10px 2px', width: '40px', minWidth: '40px', maxWidth: '40px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: '2px', width: '100%' }}>
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '2px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        type="button"
                        title="Edit"
                        onClick={() => {}}
                      >
                        {/* Modern pencil icon */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
                      </button>
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '2px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        type="button"
                        title="Remove"
                        onClick={() => {}}
                      >
                        {/* Modern trash icon */}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m5 0V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                      </button>
                    </div>
                  </td>
                ) : null}
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
