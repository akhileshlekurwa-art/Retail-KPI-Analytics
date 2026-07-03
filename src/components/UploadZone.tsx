import React, { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, Download, Database, Check, Layers, Link2, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";

interface UploadZoneProps {
  onDataLoaded: (data: any[]) => void;
  onLoading: (isLoading: boolean) => void;
  onError: (error: string | null) => void;
}

interface JoinStats {
  usingStoreMaster: boolean;
  salesStoresCount: number;
  masterStoresCount: number;
  matchedStoresCount: number;
  unmappedStores: string[];
  autoDetectedSheets?: boolean;
  salesSheetNameUsed?: string;
  storeSheetNameUsed?: string;
}

export default function UploadZone({ onDataLoaded, onLoading, onError }: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const salesInputRef = useRef<HTMLInputElement>(null);
  const storeMasterInputRef = useRef<HTMLInputElement>(null);

  // Layout mode: "single" or "joiner"
  const [uploadMode, setUploadMode] = useState<"single" | "joiner">("single");

  // Drag states
  const [dragActive, setDragActive] = useState(false);
  const [dragSalesActive, setDragSalesActive] = useState(false);
  const [dragMasterActive, setDragMasterActive] = useState(false);

  // Loaded state
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);

  // Two-file joiner files
  const [salesFile, setSalesFile] = useState<File | null>(null);
  const [storeMasterFile, setStoreMasterFile] = useState<File | null>(null);

  // Backend returned join statistics
  const [joinStats, setJoinStats] = useState<JoinStats | null>(null);

  // Validate format
  const isValidFormat = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    return ext === "csv" || ext === "xlsx" || ext === "xls";
  };

  // Upload single file (legacy/combined)
  const handleSingleFile = async (file: File) => {
    if (!file) return;
    if (!isValidFormat(file)) {
      onError("Invalid file format. Please upload a .csv or .xlsx file.");
      return;
    }

    onLoading(true);
    onError(null);
    setUploadSuccess(false);
    setLoadedFileName(file.name);
    setJoinStats(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        onDataLoaded(result.data);
        setUploadSuccess(true);
        if (result.joinStats && result.joinStats.usingStoreMaster) {
          setJoinStats(result.joinStats);
        }
        setTimeout(() => setUploadSuccess(false), 3000);
      } else {
        onError(result.error || "Failed to parse the file. Ensure headers align with our template.");
      }
    } catch (err: any) {
      onError(err.message || "An error occurred while uploading. Ensure the server is active.");
    } finally {
      onLoading(false);
    }
  };

  // Upload and join two files
  const handleJoinFiles = async () => {
    if (!salesFile || !storeMasterFile) {
      onError("Please select both a Weekly Sales Report and a Store Master Reference file.");
      return;
    }

    onLoading(true);
    onError(null);
    setUploadSuccess(false);
    setJoinStats(null);

    const formData = new FormData();
    formData.append("salesFile", salesFile);
    formData.append("storeMasterFile", storeMasterFile);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        onDataLoaded(result.data);
        setUploadSuccess(true);
        setLoadedFileName(`${salesFile.name} + ${storeMasterFile.name} Joined`);
        if (result.joinStats) {
          setJoinStats(result.joinStats);
        }
        setTimeout(() => setUploadSuccess(false), 3000);
      } else {
        onError(result.error || "Failed to join datasets. Check column naming in your files.");
      }
    } catch (err: any) {
      onError(err.message || "An error occurred while joining files. Ensure the server is active.");
    } finally {
      onLoading(false);
    }
  };

  // Single file drag handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleSingleFile(e.dataTransfer.files[0]);
    }
  };

  // Sales file drag handlers
  const handleSalesDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragSalesActive(true);
    } else if (e.type === "dragleave") {
      setDragSalesActive(false);
    }
  };

  const handleSalesDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragSalesActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (isValidFormat(f)) {
        setSalesFile(f);
        onError(null);
      } else {
        onError("Invalid format for Sales Report. Use .csv or .xlsx.");
      }
    }
  };

  // Master file drag handlers
  const handleMasterDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragMasterActive(true);
    } else if (e.type === "dragleave") {
      setDragMasterActive(false);
    }
  };

  const handleMasterDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragMasterActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      if (isValidFormat(f)) {
        setStoreMasterFile(f);
        onError(null);
      } else {
        onError("Invalid format for Store Master. Use .csv or .xlsx.");
      }
    }
  };

  // Load standard seed demo database
  const loadSampleData = async () => {
    onLoading(true);
    onError(null);
    setLoadedFileName(null);
    setJoinStats(null);
    try {
      const response = await fetch("/api/sample-data");
      const result = await response.json();
      if (result.success) {
        onDataLoaded(result.data);
        setUploadSuccess(true);
        setLoadedFileName("Aura Retail DB (Sample Seed)");
        setTimeout(() => setUploadSuccess(false), 3000);
      } else {
        onError("Failed to fetch sample retail database.");
      }
    } catch (err: any) {
      onError("Error connecting to sample database endpoint.");
    } finally {
      onLoading(false);
    }
  };

  return (
    <div className="bg-white rounded border border-slate-200 p-4 shadow-sm" id="upload-zone-wrapper">
      {/* Header with Title and Download Template Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-2 uppercase">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            Upload Retail Dataset
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Import spreadsheets with our smart column mapper. Join weekly sales logs with your store directories.
          </p>
        </div>
        
        {/* Template Downloads and Loader */}
        <div className="flex flex-wrap items-center gap-2">
          {uploadMode === "single" ? (
            <a
              href="/api/download-template"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/40 rounded transition-colors cursor-pointer"
              id="btn-download-combined-template"
            >
              <Download className="w-3.5 h-3.5" />
              Combined CSV Template
            </a>
          ) : (
            <>
              <a
                href="/api/download-sales-template"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/40 rounded transition-colors cursor-pointer"
                id="btn-download-sales-template"
              >
                <Download className="w-3.5 h-3.5" />
                1. Sales Template
              </a>
              <a
                href="/api/download-stores-template"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/40 rounded transition-colors cursor-pointer"
                id="btn-download-stores-template"
              >
                <Download className="w-3.5 h-3.5" />
                2. Store Master Template
              </a>
            </>
          )}
          
          <button
            onClick={loadSampleData}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors cursor-pointer"
            id="btn-load-demo"
          >
            <Database className="w-3.5 h-3.5" />
            Load Demo Data
          </button>
        </div>
      </div>

      {/* Mode Switch Tabs */}
      <div className="flex border-b border-slate-200 mb-4" id="upload-tabs">
        <button
          onClick={() => {
            setUploadMode("single");
            onError(null);
          }}
          className={`pb-2 px-4 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            uploadMode === "single"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          id="tab-single"
        >
          Single Combined Spreadsheet
        </button>
        <button
          onClick={() => {
            setUploadMode("joiner");
            onError(null);
          }}
          className={`pb-2 px-4 text-[10px] font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
            uploadMode === "joiner"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          id="tab-joiner"
        >
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          Two-Excel Store Joiner
        </button>
      </div>

      {/* Mode Views */}
      {uploadMode === "single" ? (
        /* Unified Standard Single Upload Zone */
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
            dragActive
              ? "border-blue-500 bg-blue-50/50"
              : "border-slate-200 hover:border-blue-400 hover:bg-slate-50/50"
          }`}
          id="upload-drag-area-single"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleSingleFile(e.target.files[0]);
              }
            }}
            accept=".csv,.xlsx,.xls"
            className="hidden"
          />

          <div className={`p-2.5 rounded-full mb-2 transition-colors ${
            uploadSuccess ? "bg-emerald-100 text-emerald-600" : "bg-slate-50 text-slate-400"
          }`}>
            {uploadSuccess ? (
              <Check className="w-6 h-6 animate-bounce" />
            ) : (
              <UploadCloud className="w-6 h-6 text-blue-500" />
            )}
          </div>

          {loadedFileName ? (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-800">
                {loadedFileName}
              </p>
              <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Active Dataset Loaded. Drag or click here to upload a different spreadsheet.
              </p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-700">
                Drag & drop a combined Excel/CSV here, or <span className="text-blue-600 underline">browse</span>
              </p>
              <p className="text-[10px] text-slate-400">
                Supports .csv, .xlsx, .xls up to 50MB. Multi-sheet Excel files will auto-detect and join.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Report & Store Master Two-Excel Joiner View */
        <div className="space-y-4" id="upload-zone-joiner-stage">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Field 1: Weekly Sales File */}
            <div
              onDragEnter={handleSalesDrag}
              onDragOver={handleSalesDrag}
              onDragLeave={handleSalesDrag}
              onDrop={handleSalesDrop}
              onClick={() => salesInputRef.current?.click()}
              className={`border-2 border-dashed rounded p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragSalesActive
                  ? "border-blue-500 bg-blue-50/50"
                  : "border-slate-200 hover:border-blue-400 hover:bg-slate-50/50"
              }`}
              id="drop-sales-file"
            >
              <input
                type="file"
                ref={salesInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSalesFile(e.target.files[0]);
                    onError(null);
                  }
                }}
                accept=".csv,.xlsx,.xls"
                className="hidden"
              />

              <div className={`p-2 rounded mb-2 ${salesFile ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-blue-50 text-blue-500"}`}>
                {salesFile ? <Check className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
              </div>

              {salesFile ? (
                <div>
                  <p className="text-xs font-bold text-slate-800 truncate max-w-[200px] mx-auto">
                    {salesFile.name}
                  </p>
                  <p className="text-[9px] text-emerald-600 font-semibold mt-0.5">
                    Weekly Sales Report selected
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    Upload Weekly Sales Report
                  </p>
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    Drag and drop or <span className="text-blue-600 underline">browse</span>
                  </p>
                </div>
              )}
            </div>

            {/* Field 2: Store Master Directory */}
            <div
              onDragEnter={handleMasterDrag}
              onDragOver={handleMasterDrag}
              onDragLeave={handleMasterDrag}
              onDrop={handleMasterDrop}
              onClick={() => storeMasterInputRef.current?.click()}
              className={`border-2 border-dashed rounded p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                dragMasterActive
                  ? "border-indigo-500 bg-indigo-50/50"
                  : "border-slate-200 hover:border-indigo-400 hover:bg-slate-50/50"
              }`}
              id="drop-master-file"
            >
              <input
                type="file"
                ref={storeMasterInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setStoreMasterFile(e.target.files[0]);
                    onError(null);
                  }
                }}
                accept=".csv,.xlsx,.xls"
                className="hidden"
              />

              <div className={`p-2 rounded mb-2 ${storeMasterFile ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-indigo-50 text-indigo-500"}`}>
                {storeMasterFile ? <Check className="w-5 h-5" /> : <Layers className="w-5 h-5" />}
              </div>

              {storeMasterFile ? (
                <div>
                  <p className="text-xs font-bold text-slate-800 truncate max-w-[200px] mx-auto">
                    {storeMasterFile.name}
                  </p>
                  <p className="text-[9px] text-indigo-600 font-semibold mt-0.5">
                    Store Master directory selected
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    Upload Store Master Reference
                  </p>
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    Drag and drop or <span className="text-indigo-600 underline">browse</span>
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* Merge Trigger Button */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleJoinFiles}
              disabled={!salesFile || !storeMasterFile}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition-all cursor-pointer ${
                salesFile && storeMasterFile
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed"
              }`}
              id="btn-merge-datasets"
            >
              <Link2 className="w-3.5 h-3.5" />
              Align & Merge Sales + Master
            </button>
          </div>
        </div>
      )}

      {/* Dataset Alignment Report (display statistics about the join) */}
      {joinStats && joinStats.usingStoreMaster && (
        <div className="mt-4 border border-slate-200 bg-slate-50/50 rounded p-3.5 animate-fade-in" id="join-stats-report">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200/60 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                Store Master Directory Successfully Joined
              </span>
            </div>
            {joinStats.autoDetectedSheets ? (
              <span className="text-[9px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded tracking-tight">
                Auto-Detected Workbook Sheets: "{joinStats.salesSheetNameUsed}" ⇆ "{joinStats.storeSheetNameUsed}"
              </span>
            ) : (
              <span className="text-[9px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded uppercase tracking-wider">
                Two-File Mapping Complete
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-white border border-slate-200/80 rounded p-2 text-center shadow-xs">
              <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-tight">Sales Stores</span>
              <span className="text-sm font-extrabold text-slate-800">{joinStats.salesStoresCount}</span>
            </div>
            
            <div className="bg-white border border-slate-200/80 rounded p-2 text-center shadow-xs">
              <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-tight font-medium">Store Directory</span>
              <span className="text-sm font-extrabold text-slate-800">{joinStats.masterStoresCount}</span>
            </div>

            <div className="bg-white border border-slate-200/80 rounded p-2 text-center shadow-xs">
              <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-tight">Joined Matches</span>
              <span className="text-sm font-extrabold text-emerald-600">
                {joinStats.matchedStoresCount} / {joinStats.salesStoresCount}
              </span>
            </div>

            <div className="bg-white border border-slate-200/80 rounded p-2 text-center shadow-xs font-medium">
              <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-tight">Alignment Accuracy</span>
              <span className="text-sm font-extrabold text-slate-800">
                {Math.round((joinStats.matchedStoresCount / (joinStats.salesStoresCount || 1)) * 100)}%
              </span>
            </div>
          </div>

          {/* Unmapped warnings block */}
          {joinStats.unmappedStores.length > 0 && (
            <div className="mt-3 bg-amber-50/50 border border-amber-100 rounded p-2.5 flex items-start gap-2 text-[10px]" id="unmapped-warnings">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-amber-900 uppercase tracking-tight">
                  Unmapped Store References Detected ({joinStats.unmappedStores.length})
                </p>
                <p className="text-slate-600 leading-normal">
                  The following stores were found in the Weekly Sales report but are missing from your Store Master directory. 
                  They are plotted with fallback locations ("Unknown Region", "Unknown City", "Standard"):
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {joinStats.unmappedStores.map((store) => (
                    <span key={store} className="bg-amber-100 text-amber-800 border border-amber-200 text-[9px] px-2 py-0.5 rounded font-bold">
                      {store}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
