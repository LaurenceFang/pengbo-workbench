import { useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "./button";
import type { InspectorContext } from "./ui-kit";

export type DataTableState = "loading" | "empty" | "error" | "locked" | "blocked" | "ready" | "degraded";

export type DataTableColumn<T> = {
  key: keyof T & string;
  label: string;
  width?: number | string;
  minWidth?: number;
  align?: "left" | "center" | "right";
  sortable?: boolean;
  filterable?: boolean;
  sticky?: boolean;
  render?: (value: unknown, row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null;
};

type SortState = { key: string; direction: "ascending" | "descending" } | null;

export type DataTableProps<T extends Record<string, unknown>> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  selectedRowKey?: string | null;
  onSelectRow?: (row: T) => void;
  onOpenInspector?: (row: T) => void;
  onOpenAI?: (row: T) => void;
  inspectorContext?: (row: T) => InspectorContext;
  onRetry?: () => void;
  state?: DataTableState;
  error?: string;
  empty?: ReactNode;
  dataSource?: ReactNode;
  freshness?: ReactNode;
  ariaLabel?: string;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  filterPlaceholder?: string;
  virtualized?: boolean;
  rowHeight?: number;
  viewportHeight?: number;
  labels?: { filter?: string; inspector?: string; ai?: string; retry?: string; loading?: string; locked?: string; blocked?: string; empty?: string; error?: string; degraded?: string; rows?: string; source?: string; freshness?: string };
};

function StateMessage({ state, title, description, action }: { state: Exclude<DataTableState, "ready" | "degraded">; title: string; description: ReactNode; action?: ReactNode }) {
  return <section aria-live={state === "loading" ? "polite" : "assertive"} className={`ui-state-block ui-state-${state}`}><span className="ui-badge ui-badge-info">{title}</span><h3>{title}</h3><p>{description}</p>{action ? <div className="ui-state-action">{action}</div> : null}</section>;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  selectedRowKey = null,
  onSelectRow,
  onOpenInspector,
  onOpenAI,
  onRetry,
  state = "ready",
  error,
  empty = "No matching rows.",
  dataSource,
  freshness,
  ariaLabel = "Financial data table",
  filterValue,
  onFilterChange,
  filterPlaceholder = "Filter rows",
  virtualized = false,
  rowHeight = 46,
  viewportHeight = 520,
  labels = {},
  inspectorContext,
}: DataTableProps<T>) {
  const [localFilter, setLocalFilter] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const activeFilter = filterValue ?? localFilter;
  const filterableColumns = columns.filter((column) => column.filterable !== false);

  const filteredRows = useMemo(() => {
    const query = activeFilter.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => filterableColumns.some((column) => String(row[column.key] ?? "").toLowerCase().includes(query)));
  }, [activeFilter, filterableColumns, rows]);

  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;
    const column = columns.find((candidate) => candidate.key === sort.key);
    if (!column) return filteredRows;
    return [...filteredRows].sort((left, right) => {
      const leftValue = column.sortValue ? column.sortValue(left) : left[column.key] as unknown;
      const rightValue = column.sortValue ? column.sortValue(right) : right[column.key] as unknown;
      if (leftValue == null && rightValue == null) return 0;
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;
      const result = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: "base" });
      return sort.direction === "ascending" ? result : -result;
    });
  }, [columns, filteredRows, sort]);

  const visibleRange = virtualized ? {
    start: Math.max(0, Math.floor(scrollTop / rowHeight) - 4),
    end: Math.min(sortedRows.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + 4),
  } : { start: 0, end: sortedRows.length };
  const visibleRows = sortedRows.slice(visibleRange.start, visibleRange.end);

  function toggleSort(column: DataTableColumn<T>) {
    if (column.sortable === false) return;
    setSort((current) => current?.key === column.key
      ? current.direction === "ascending" ? { key: column.key, direction: "descending" } : null
      : { key: column.key, direction: "ascending" });
  }

  function handleFilter(value: string) {
    if (onFilterChange) onFilterChange(value);
    else setLocalFilter(value);
    setScrollTop(0);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, index: number) {
    if (event.key === "Enter") {
      const row = visibleRows[index];
      if (row) onOpenInspector?.(row);
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const nextIndex = event.key === "ArrowDown" ? Math.min(visibleRows.length - 1, index + 1) : Math.max(0, index - 1);
      const nextRow = visibleRows[nextIndex];
      if (nextRow) {
        onSelectRow?.(nextRow);
        document.querySelector<HTMLTableRowElement>(`[data-table-row-key="${CSS.escape(rowKey(nextRow))}"]`)?.focus();
      }
    }
    if (event.key === " ") {
      event.preventDefault();
      const row = visibleRows[index];
      if (row) onSelectRow?.(row);
    }
  }

  if (state === "loading") return <StateMessage state="loading" title={labels.loading ?? "加载中"} description={labels.loading ?? "正在加载表格数据。"} />;
  if (state === "locked") return <StateMessage state="locked" title={labels.locked ?? "已锁定"} description={labels.locked ?? "解锁工作区后查看此表格。"} />;
  if (state === "blocked") return <StateMessage state="blocked" title={labels.blocked ?? "暂不可用"} description={labels.blocked ?? "当前权限或数据条件不满足。"} />;
  if (state === "error") return <StateMessage state="error" title={labels.error ?? "加载失败"} description={error ?? "表格数据加载失败。"} action={<Button onClick={onRetry} variant="ghost">{labels.retry ?? "重试"}</Button>} />;
  if (state === "empty" || sortedRows.length === 0) return <StateMessage state="empty" title={labels.empty ?? "暂无数据"} description={empty} />;

  const selectedRow = selectedRowKey ? sortedRows.find((row) => rowKey(row) === selectedRowKey) : undefined;
  const selectedContext = selectedRow ? inspectorContext?.(selectedRow) : undefined;
  return <section className="data-table-component" aria-label={ariaLabel} data-inspector-route-id={selectedContext?.routeId} data-inspector-object-type={selectedContext?.objectType} data-inspector-object-id={selectedContext?.objectId}>
    <div className="data-table-toolbar">
      <label className="data-table-filter"><span>{labels.filter ?? "Filter"}</span><input aria-label={labels.filter ?? "Filter rows"} onChange={(event) => handleFilter(event.target.value)} placeholder={filterPlaceholder} value={activeFilter} /></label>
      <span className="data-table-count">{sortedRows.length} {labels.rows ?? "rows"}</span>
      {state === "degraded" ? <span className="ui-badge ui-badge-warning">{labels.degraded ?? "Cached or incomplete"}</span> : null}
      {dataSource ? <span className="data-table-meta">{labels.source ?? "来源"}: {dataSource}</span> : null}
      {freshness ? <span className="data-table-meta">{labels.freshness ?? "更新"}: {freshness}</span> : null}
    </div>
    <div className={`ui-table-wrap ${virtualized ? "is-virtualized" : ""}`} onScroll={virtualized ? (event) => setScrollTop(event.currentTarget.scrollTop) : undefined} style={virtualized ? { maxHeight: viewportHeight } : undefined}>
      <table className="ui-data-table"><thead><tr>{columns.map((column, columnIndex) => <th aria-sort={sort?.key === column.key ? sort.direction : "none"} className={`${column.sticky === true || columnIndex === 0 ? "is-sticky-column" : ""} align-${column.align ?? "left"}`} key={column.key} style={{ width: column.width, minWidth: column.minWidth }}><button aria-label={column.label} className="data-table-sort-button" disabled={column.sortable === false} onClick={() => toggleSort(column)} type="button">{column.label}</button></th>)}</tr></thead>
        <tbody style={virtualized ? { height: sortedRows.length * rowHeight, position: "relative" } : undefined}>
          {virtualized && visibleRange.start > 0 ? <tr aria-hidden="true" className="data-table-spacer" style={{ height: visibleRange.start * rowHeight }}><td colSpan={columns.length} /></tr> : null}
          {visibleRows.map((row, index) => { const key = rowKey(row); const selected = selectedRowKey === key; return <tr aria-selected={selected} className={selected ? "is-selected" : ""} data-table-row-key={key} key={key} onClick={() => onSelectRow?.(row)} onDoubleClick={() => onOpenInspector?.(row)} onKeyDown={(event) => handleRowKeyDown(event, index)} tabIndex={selected || (!selectedRowKey && index === 0) ? 0 : -1}>{columns.map((column, columnIndex) => <td className={`${column.sticky === true || columnIndex === 0 ? "is-sticky-column" : ""} align-${column.align ?? "left"}`} key={column.key}>{column.render ? column.render(row[column.key], row) : String(row[column.key] ?? "—")}</td>)}</tr>; })}
          {virtualized && visibleRange.end < sortedRows.length ? <tr aria-hidden="true" className="data-table-spacer" style={{ height: (sortedRows.length - visibleRange.end) * rowHeight }}><td colSpan={columns.length} /></tr> : null}
        </tbody>
      </table>
    </div>
    {selectedRowKey ? <div className="data-table-row-actions"><Button variant="text" disabled={!onOpenInspector} onClick={() => { const row = sortedRows.find((candidate) => rowKey(candidate) === selectedRowKey); if (row) onOpenInspector?.(row); }}>{labels.inspector ?? "Open context"}</Button><Button variant="text" disabled={!onOpenAI} onClick={() => { const row = sortedRows.find((candidate) => rowKey(candidate) === selectedRowKey); if (row) onOpenAI?.(row); }}>{labels.ai ?? "Open AI assistant"}</Button></div> : null}
  </section>;
}
