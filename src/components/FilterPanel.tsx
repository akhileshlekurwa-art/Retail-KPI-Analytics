import React, { useState } from "react";
import { Filter, X, Check, ChevronDown, RefreshCw } from "lucide-react";
import { FilterState, RetailRecord } from "../types";

interface FilterPanelProps {
  data: RetailRecord[];
  filters: FilterState;
  onFilterChange: (newFilters: FilterState) => void;
}

export default function FilterPanel({ data, filters, onFilterChange }: FilterPanelProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});

  // Helper to extract unique values for any field in the dataset
  const getUniqueValues = (field: keyof RetailRecord): string[] => {
    const values = data.map(item => item[field]?.toString() || "");
    return Array.from(new Set(values)).filter(val => val !== "").sort();
  };

  const fields: Array<{ label: string; key: keyof FilterState; dataKey: keyof RetailRecord }> = [
    { label: "Week", key: "week", dataKey: "week" },
    { label: "Region", key: "region", dataKey: "region" },
    { label: "City", key: "city", dataKey: "city" },
    { label: "Store", key: "store", dataKey: "store" },
    { label: "Store Format", key: "storeFormat", dataKey: "storeFormat" },
    { label: "Category", key: "category", dataKey: "category" }
  ];

  const handleToggleOption = (key: keyof FilterState, option: string) => {
    const currentSelected = filters[key];
    let newSelected: string[];

    if (currentSelected.includes(option)) {
      newSelected = currentSelected.filter(item => item !== option);
    } else {
      newSelected = [...currentSelected, option];
    }

    onFilterChange({
      ...filters,
      [key]: newSelected
    });
  };

  const handleSelectAll = (key: keyof FilterState, dataKey: keyof RetailRecord) => {
    const options = getUniqueValues(dataKey);
    onFilterChange({
      ...filters,
      [key]: options
    });
  };

  const handleClearAll = (key: keyof FilterState) => {
    onFilterChange({
      ...filters,
      [key]: []
    });
  };

  const handleResetFilters = () => {
    onFilterChange({
      week: [],
      region: [],
      store: [],
      city: [],
      storeFormat: [],
      category: []
    });
    setSearchTerms({});
  };

  const toggleDropdown = (key: string) => {
    setActiveDropdown(activeDropdown === key ? null : key);
  };

  const isFilterActive = (key: keyof FilterState) => filters[key].length > 0;
  const anyFilterActive = Object.values(filters).some(arr => arr.length > 0);

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className="bg-white rounded border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4 mb-3">
        <h3 className="text-xs font-bold text-slate-800 flex items-center gap-2 uppercase">
          <Filter className="w-4 h-4 text-blue-600" />
          Interactive Dashboard Filters
        </h3>
        
        {anyFilterActive && (
          <button
            onClick={handleResetFilters}
            className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            Clear All Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {fields.map(({ label, key, dataKey }) => {
          const options = getUniqueValues(dataKey);
          const selected = filters[key];
          const searchTerm = searchTerms[key] || "";
          
          const filteredOptions = options.filter(opt => 
            opt.toLowerCase().includes(searchTerm.toLowerCase())
          );

          return (
            <div 
              key={key} 
              className="relative" 
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => toggleDropdown(key)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold rounded border transition-all text-left ${
                  selected.length > 0
                    ? "border-blue-500 bg-blue-50 text-blue-800"
                    : "border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700"
                }`}
                id={`filter-${key}`}
              >
                <span className="truncate">
                  {selected.length === 0 
                    ? `${label}: All` 
                    : selected.length === 1 
                      ? selected[0] 
                      : `${label} (${selected.length})`}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 ml-1 transition-transform text-slate-400 ${
                  activeDropdown === key ? "rotate-180 text-blue-600" : ""
                }`} />
              </button>

              {activeDropdown === key && (
                <div className="absolute z-30 mt-1 w-52 bg-white border border-slate-200 rounded shadow-md py-1.5">
                  <div className="px-2 pb-1.5 pt-0.5 border-b border-slate-100 flex items-center justify-between gap-1">
                    <input
                      type="text"
                      placeholder={`Search ${label}...`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerms({ ...searchTerms, [key]: e.target.value })}
                      className="w-full text-[11px] px-2 py-1 rounded border border-slate-200 focus:outline-none focus:border-blue-500"
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerms({ ...searchTerms, [key]: "" })}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between px-2.5 py-1 bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                    <button 
                      onClick={() => handleSelectAll(key, dataKey)}
                      className="hover:text-blue-600 cursor-pointer"
                    >
                      Select All
                    </button>
                    <button 
                      onClick={() => handleClearAll(key)}
                      className="hover:text-rose-600 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>

                  <div className="max-h-44 overflow-y-auto px-1 py-1">
                    {filteredOptions.length === 0 ? (
                      <p className="text-[10px] text-slate-400 text-center py-2">No options found</p>
                    ) : (
                      filteredOptions.map(option => {
                        const isChecked = selected.includes(option);
                        return (
                          <button
                            key={option}
                            onClick={() => handleToggleOption(key, option)}
                            className={`w-full flex items-center gap-2 px-2 py-1 text-[11px] text-left rounded transition-colors ${
                              isChecked 
                                ? "bg-blue-50 text-blue-900 font-bold" 
                                : "hover:bg-slate-50 text-slate-600"
                            }`}
                          >
                            <div className={`w-3 h-3 border rounded flex items-center justify-center transition-colors shrink-0 ${
                              isChecked ? "border-blue-500 bg-blue-500 text-white" : "border-slate-300"
                            }`}>
                              {isChecked && <Check className="w-2 h-2 stroke-[3]" />}
                            </div>
                            <span className="truncate">{option}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Filter Badges */}
      {anyFilterActive && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-slate-100">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 self-center mr-1">
            Active:
          </span>
          {fields.map(({ label, key }) => {
            const selected = filters[key];
            if (selected.length === 0) return null;
            return (
              <div key={key} className="flex flex-wrap gap-1 items-center bg-slate-50 border border-slate-200 rounded pl-2 pr-1 py-0.5 text-[10px] text-slate-600">
                <span className="font-semibold text-slate-400 mr-0.5">{label}:</span>
                {selected.length <= 2 ? (
                  selected.map(val => (
                    <span key={val} className="bg-white border border-slate-200/60 rounded px-1 py-0.5 font-medium text-[9px] text-slate-700 flex items-center gap-0.5">
                      {val}
                      <button 
                        onClick={() => handleToggleOption(key, val)}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="bg-blue-50 text-blue-800 border border-blue-100 rounded px-1 py-0.5 font-bold text-[9px] flex items-center gap-0.5">
                    {selected.length} Selected
                    <button 
                      onClick={() => handleClearAll(key)}
                      className="text-blue-500 hover:text-rose-500 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
