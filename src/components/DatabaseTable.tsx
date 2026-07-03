import React, { useState, useMemo } from "react";
import { Search, Download, Filter, CheckCircle, HelpCircle, ArrowUpDown } from "lucide-react";
import { RetailRecord } from "../types";

interface DatabaseTableProps {
  data: RetailRecord[];
}

type SortField = "transactionId" | "date" | "store" | "region" | "netSales";
type SortOrder = "asc" | "desc";

export default function DatabaseTable({ data }: DatabaseTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Reset pagination on search
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // Sorting logic
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  // Filtering & Sorting
  const processedData = useMemo(() => {
    let result = [...data];

    // Filter by search term
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.transactionId.toLowerCase().includes(term) ||
          r.store.toLowerCase().includes(term) ||
          r.category.toLowerCase().includes(term) ||
          r.city.toLowerCase().includes(term) ||
          r.region.toLowerCase().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === "string") {
        valA = valA.toLowerCase();
        valB = (valB as string).toLowerCase();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, searchTerm, sortField, sortOrder]);

  // Pagination calculations
  const totalRows = processedData.length;
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return processedData.slice(startIndex, startIndex + rowsPerPage);
  }, [processedData, currentPage, rowsPerPage]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Transaction ID",
      "Date",
      "Week",
      "Store",
      "Region",
      "City",
      "Store Format",
      "Category",
      "Gross Sales ($)",
      "Discount ($)",
      "Returns ($)",
      "Net Sales ($)",
      "Target Sales ($)",
      "Stock Level",
      "Reorder Point"
    ];

    const csvRows = [headers.join(",")];

    data.forEach((r) => {
      const row = [
        r.transactionId,
        r.date,
        r.week,
        `"${r.store.replace(/"/g, '""')}"`,
        `"${r.region.replace(/"/g, '""')}"`,
        `"${r.city.replace(/"/g, '""')}"`,
        `"${r.storeFormat.replace(/"/g, '""')}"`,
        `"${r.category.replace(/"/g, '""')}"`,
        r.grossSales,
        r.discountAmount,
        r.returnAmount,
        r.netSales,
        r.targetSales,
        r.stockLevel,
        r.reorderPoint
      ];
      csvRows.push(row.join(","));
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `aligned_retail_sales_export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded border border-slate-200 shadow-sm overflow-hidden" id="joined-database-viewer">
      {/* Title & Controls Bar */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
            Joined Transaction Ledger
            <span className="text-[9px] bg-blue-100 text-blue-700 font-bold border border-blue-200 rounded px-1.5 py-0.5">
              Live Database
            </span>
          </h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Real-time tabular verification of the Weekly Sales Report mapped with your Store Master directory.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Export Button */}
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded transition-all cursor-pointer shadow-xs"
            id="btn-export-joined-database"
            title="Download fully merged dataset as CSV"
          >
            <Download className="w-3.5 h-3.5" />
            Export Aligned Dataset
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row items-center gap-3">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search by Store Name, City, Region, Transaction ID..."
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50/80 border border-slate-200 rounded text-xs placeholder:text-slate-400 focus:outline-hidden focus:bg-white focus:border-blue-500 transition-all"
            id="table-search-input"
          />
        </div>

        {/* Rows per page selector */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto text-xs font-semibold text-slate-500 shrink-0">
          <span>Show:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs focus:outline-hidden text-slate-800"
          >
            <option value={5}>5 rows</option>
            <option value={10}>10 rows</option>
            <option value={20}>20 rows</option>
            <option value={50}>50 rows</option>
          </select>
        </div>
      </div>

      {/* Table Element wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[9px] border-b border-slate-200">
              <th className="py-2.5 px-4 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort("transactionId")}>
                <div className="flex items-center gap-1">
                  TX ID <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-4 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort("date")}>
                <div className="flex items-center gap-1">
                  Date / Week <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-4 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort("store")}>
                <div className="flex items-center gap-1">
                  Store <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-4 cursor-pointer hover:bg-slate-100 select-none" onClick={() => handleSort("region")}>
                <div className="flex items-center gap-1">
                  Location (Master) <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
              <th className="py-2.5 px-4">Format</th>
              <th className="py-2.5 px-4">Category</th>
              <th className="py-2.5 px-4 cursor-pointer hover:bg-slate-100 select-none text-right" onClick={() => handleSort("netSales")}>
                <div className="flex items-center justify-end gap-1">
                  Net Sales <ArrowUpDown className="w-3 h-3" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedData.length > 0 ? (
              paginatedData.map((row, idx) => {
                const isUnmapped = row.region.includes("Unknown") || row.region.includes("Unmapped");
                return (
                  <tr key={row.transactionId} className="hover:bg-slate-50/50 transition-colors">
                    {/* TX ID */}
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-700">
                      {row.transactionId}
                    </td>

                    {/* Date / Week */}
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                      {row.date} <span className="text-[10px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-mono ml-1">{row.week}</span>
                    </td>

                    {/* Store */}
                    <td className="py-2.5 px-4 font-bold text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span>{row.store}</span>
                        {isUnmapped ? (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" title="Fallback map applied" />
                        ) : (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" title="Store master linked" />
                        )}
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-2.5 px-4 text-slate-600">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800">{row.city}</span>
                        <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{row.region} Region</span>
                      </div>
                    </td>

                    {/* Store Format */}
                    <td className="py-2.5 px-4">
                      <span className={`inline-block text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tight ${
                        row.storeFormat === "Hypermarket" 
                          ? "bg-purple-50 text-purple-700 border border-purple-100" 
                          : row.storeFormat === "Supermarket"
                          ? "bg-blue-50 text-blue-700 border border-blue-100"
                          : "bg-amber-50 text-amber-700 border border-amber-100"
                      }`}>
                        {row.storeFormat}
                      </span>
                    </td>

                    {/* Product Category */}
                    <td className="py-2.5 px-4 text-slate-600">
                      {row.category}
                    </td>

                    {/* Net Sales */}
                    <td className="py-2.5 px-4 font-bold text-slate-900 text-right font-mono">
                      ${row.netSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  <div className="space-y-1">
                    <p className="text-sm font-bold uppercase text-slate-400">No database records match your filter criteria.</p>
                    <p className="text-xs">Try adjusting your search terms or filters above.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer Controls */}
      {totalRows > 0 && (
        <div className="p-3 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-semibold text-slate-500">
          <div>
            Showing <span className="text-slate-800 font-bold">{Math.min(totalRows, (currentPage - 1) * rowsPerPage + 1)}</span> to{" "}
            <span className="text-slate-800 font-bold">{Math.min(totalRows, currentPage * rowsPerPage)}</span> of{" "}
            <span className="text-slate-800 font-bold">{totalRows}</span> total records
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className={`px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 transition-colors ${
                currentPage === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-slate-50"
              }`}
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 transition-colors ${
                currentPage === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-slate-50"
              }`}
            >
              Prev
            </button>
            <span className="px-3 py-1 font-bold text-slate-800 bg-slate-100 rounded">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 transition-colors ${
                currentPage === totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-slate-50"
              }`}
            >
              Next
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className={`px-2 py-1 rounded border border-slate-200 bg-white text-slate-600 transition-colors ${
                currentPage === totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-slate-50"
              }`}
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
