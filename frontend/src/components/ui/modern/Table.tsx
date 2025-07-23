import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { clsx } from 'clsx';

export interface Column<T = any> {
  key: string;
  header: string;
  accessor?: keyof T | ((item: T) => React.ReactNode);
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, item: T, index: number) => React.ReactNode;
}

export interface ModernTableProps<T = any> {
  data: T[];
  columns: Column<T>[];
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
}

const ModernTable = <T extends Record<string, any>>({
  data,
  columns,
  onSort,
  sortKey,
  sortDirection,
  loading = false,
  emptyMessage = 'Aucune donnée disponible',
  className,
  striped = true,
  hoverable = true,
  compact = false,
}: ModernTableProps<T>) => {
  const handleSort = (key: string) => {
    if (!onSort) return;

    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(key, newDirection);
  };

  const getSortIcon = (key: string) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="w-4 h-4 text-slate-500" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-blue-400" />
      : <ArrowDown className="w-4 h-4 text-blue-400" />;
  };

  const getCellValue = (item: T, column: Column<T>) => {
    if (column.render) {
      const value = typeof column.accessor === 'function' 
        ? column.accessor(item)
        : item[column.accessor as keyof T];
      return column.render(value, item, data.indexOf(item));
    }

    if (typeof column.accessor === 'function') {
      return column.accessor(item);
    }

    return item[column.accessor as keyof T];
  };

  const getAlignmentClass = (align?: string) => {
    switch (align) {
      case 'center': return 'text-center';
      case 'right': return 'text-right';
      default: return 'text-left';
    }
  };

  if (loading) {
    return (
      <div className={clsx('glass border border-slate-700/50 rounded-xl overflow-hidden', className)}>
        <div className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-400">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('glass border border-slate-700/50 rounded-xl overflow-hidden', className)}>
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full">
          {/* Header */}
          <thead>
            <tr className="border-b border-slate-700/50 bg-slate-800/30">
              {columns.map((column, index) => (
                <th
                  key={column.key}
                  className={clsx(
                    'px-6 text-sm font-semibold text-slate-300',
                    compact ? 'py-3' : 'py-4',
                    getAlignmentClass(column.align),
                    column.sortable && 'cursor-pointer hover:text-slate-100 transition-colors'
                  )}
                  style={{ width: column.width }}
                  onClick={() => column.sortable && handleSort(column.key)}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.header}</span>
                    {column.sortable && getSortIcon(column.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td 
                  colSpan={columns.length}
                  className="px-6 py-12 text-center text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, rowIndex) => (
                <motion.tr
                  key={rowIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: rowIndex * 0.02 }}
                  className={clsx(
                    'border-b border-slate-700/30 last:border-b-0',
                    striped && rowIndex % 2 === 1 && 'bg-slate-800/20',
                    hoverable && 'hover:bg-slate-800/40 transition-colors'
                  )}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={clsx(
                        'px-6 text-sm text-slate-200',
                        compact ? 'py-3' : 'py-4',
                        getAlignmentClass(column.align)
                      )}
                    >
                      {getCellValue(item, column)}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ModernTable;