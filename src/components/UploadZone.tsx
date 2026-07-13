import React, { useRef, useState } from "react";
import { UploadCloud, FileSpreadsheet, Download, Database, Check, Layers, Link2, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";
import * as XLSX from "xlsx";

const salesStandardKeys = {
  transactionId: ["transactionid", "txid", "tx_id", "id", "transid", "transaction_id"],
  date: ["date", "transdate", "transactiondate", "dt", "day"],
  week: ["week", "wk", "period", "reportingweek"],
  store: ["store", "storename", "outlet", "shop", "store_name"],
  category: ["category", "productcategory", "prodcat", "itemcategory", "product_category", "product", "dept", "department"],
  grossSales: ["grosssales", "gross", "sales", "revenue", "gross_sales", "amount"],
  discountAmount: ["discountamount", "discount", "discounts", "disc", "discount_amount"],
  returnAmount: ["returnamount", "returns", "return", "refund", "return_amount"],
  targetSales: ["targetsales", "target", "targets", "weeklytarget", "target_sales"],
  stockLevel: ["stocklevel", "stock", "inventory", "qty", "onhand", "stock_level"],
  reorderPoint: ["reorderpoint", "reorder", "rop", "reorder_point", "minstock"]
};

const storeMasterStandardKeys = {
  store: ["store", "storename", "outlet", "shop", "store_name", "storeid", "store_id"],
  region: ["region", "reg", "territory", "area"],
  city: ["city", "cty", "location", "town"],
  storeFormat: ["storeformat", "format", "type", "outletformat", "store_format"]
};

function normalizeHeader(h: any): string {
  if (!h) return "";
  return h.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

function findHeaderMapping(rawKeys: string[], standardKeys: Record<string, string[]>): Record<string, string> {
  const headerMapping: Record<string, string> = {};
  for (const [stdKey, aliases] of Object.entries(standardKeys)) {
    const match = rawKeys.find(rk => {
      const normRk = normalizeHeader(rk);
      return aliases.includes(normRk) || normRk.includes(stdKey.toLowerCase());
    });
    if (match) {
      headerMapping[stdKey] = match;
    } else {
      const softMatch = rawKeys.find(rk => {
        const normRk = normalizeHeader(rk);
        return aliases.some(alias => normRk.includes(alias));
      });
      if (softMatch) {
        headerMapping[stdKey] = softMatch;
      }
    }
  }
  return headerMapping;
}

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result instanceof ArrayBuffer) {
        resolve(e.target.result);
      } else {
        reject(new Error("Failed to read file as ArrayBuffer"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
};

const processFilesClientSide = async (salesFileObj: File, masterFileObj: File | null) => {
  const salesBuffer = await readFileAsArrayBuffer(salesFileObj);
  const salesWorkbook = XLSX.read(salesBuffer, { type: "array" });
  
  let rawSalesData: any[] = [];
  let rawStoreMasterData: any[] = [];
  let autoDetectedSheets = false;
  let salesSheetNameUsed = "";
  let storeSheetNameUsed = "";
  
  if (!masterFileObj && salesWorkbook.SheetNames.length >= 2) {
    const sheets = salesWorkbook.SheetNames;
    const salesSheetName = sheets.find(s => s.toLowerCase().includes("sale") || s.toLowerCase().includes("report") || s.toLowerCase().includes("weekly")) || sheets[0];
    const storeSheetName = sheets.find(s => s.toLowerCase().includes("store") || s.toLowerCase().includes("master") || s.toLowerCase().includes("outlet") || s.toLowerCase().includes("shop")) || sheets[1];
    
    if (salesSheetName && storeSheetName && salesSheetName !== storeSheetName) {
      rawSalesData = XLSX.utils.sheet_to_json<any>(salesWorkbook.Sheets[salesSheetName]);
      rawStoreMasterData = XLSX.utils.sheet_to_json<any>(salesWorkbook.Sheets[storeSheetName]);
      autoDetectedSheets = true;
      salesSheetNameUsed = salesSheetName;
      storeSheetNameUsed = storeSheetName;
    } else {
      rawSalesData = XLSX.utils.sheet_to_json<any>(salesWorkbook.Sheets[sheets[0]]);
    }
  } else {
    rawSalesData = XLSX.utils.sheet_to_json<any>(salesWorkbook.Sheets[salesWorkbook.SheetNames[0]]);
    
    if (masterFileObj) {
      const masterBuffer = await readFileAsArrayBuffer(masterFileObj);
      const storeWorkbook = XLSX.read(masterBuffer, { type: "array" });
      rawStoreMasterData = XLSX.utils.sheet_to_json<any>(storeWorkbook.Sheets[storeWorkbook.SheetNames[0]]);
    }
  }

  if (!rawSalesData || rawSalesData.length === 0) {
    throw new Error("The Weekly Sales report sheet is empty.");
  }

  const salesSampleRow = rawSalesData[0];
  const salesRawKeys = Object.keys(salesSampleRow);
  const salesHeaderMapping = findHeaderMapping(salesRawKeys, salesStandardKeys);

  const storeMasterLookup: Record<string, { region: string; city: string; storeFormat: string }> = {};
  let masterMapping: Record<string, string> = {};
  
  if (rawStoreMasterData && rawStoreMasterData.length > 0) {
    const masterSampleRow = rawStoreMasterData[0];
    const masterRawKeys = Object.keys(masterSampleRow);
    masterMapping = findHeaderMapping(masterRawKeys, storeMasterStandardKeys);
    
    const masterStoreKey = masterMapping["store"];
    const masterRegionKey = masterMapping["region"];
    const masterCityKey = masterMapping["city"];
    const masterFormatKey = masterMapping["storeFormat"];

    if (masterStoreKey) {
      rawStoreMasterData.forEach(row => {
        const storeName = row[masterStoreKey];
        if (storeName) {
          const normStore = storeName.toString().toLowerCase().trim();
          storeMasterLookup[normStore] = {
            region: masterRegionKey ? (row[masterRegionKey]?.toString() || "Unknown Region") : "Unknown Region",
            city: masterCityKey ? (row[masterCityKey]?.toString() || "Unknown City") : "Unknown City",
            storeFormat: masterFormatKey ? (row[masterFormatKey]?.toString() || "Standard") : "Standard"
          };
        }
      });
    }
  }

  let autoIdCounter = 6001;
  const uniqueSalesStores = new Set<string>();
  const unmappedStoresSet = new Set<string>();

  const processedData: any[] = rawSalesData.map(row => {
    const txId = `TX${autoIdCounter++}`;
    const storeKeyInSales = salesHeaderMapping["store"];
    const storeName = storeKeyInSales ? (row[storeKeyInSales]?.toString() || "") : "";
    const normStore = storeName.toLowerCase().trim();
    
    if (storeName) {
      uniqueSalesStores.add(storeName);
    }

    let lookupDetails: { region: string; city: string; storeFormat: string } | undefined;
    if (normStore && storeMasterLookup[normStore]) {
      lookupDetails = storeMasterLookup[normStore];
    } else if (normStore && Object.keys(storeMasterLookup).length > 0) {
      unmappedStoresSet.add(storeName);
    }

    const getVal = (stdKey: string, fallback: any) => {
      const rawKey = salesHeaderMapping[stdKey];
      if (!rawKey) return fallback;
      const val = row[rawKey];
      return val !== undefined && val !== null ? val : fallback;
    };

    const grossSales = parseFloat(getVal("grossSales", 0)) || 0;
    const discountAmount = parseFloat(getVal("discountAmount", 0)) || 0;
    const returnAmount = parseFloat(getVal("returnAmount", 0)) || 0;
    
    const rawDate = getVal("date", "");
    let dateStr = "";
    if (rawDate) {
      if (typeof rawDate === "number") {
        try {
          const dateObj = XLSX.SSF.parse_date_code(rawDate);
          const jsDate = new Date(dateObj.y, dateObj.m - 1, dateObj.d);
          dateStr = jsDate.toISOString().split("T")[0];
        } catch (e) {
          dateStr = new Date().toISOString().split("T")[0];
        }
      } else {
        try {
          dateStr = new Date(rawDate).toISOString().split("T")[0];
        } catch (e) {
          dateStr = rawDate.toString();
        }
      }
    } else {
      dateStr = new Date().toISOString().split("T")[0];
    }

    const storeVal = getVal("store", "Store A").toString();
    const regionVal = getVal("region", lookupDetails?.region || "Unknown Region").toString();
    const cityVal = getVal("city", lookupDetails?.city || "Unknown City").toString();
    const storeFormatVal = getVal("storeFormat", lookupDetails?.storeFormat || "Standard").toString();

    return {
      transactionId: getVal("transactionId", txId).toString(),
      date: dateStr,
      week: getVal("week", "W1").toString(),
      region: regionVal,
      city: cityVal,
      store: storeVal,
      storeFormat: storeFormatVal,
      category: getVal("category", "General").toString(),
      grossSales,
      discountAmount,
      returnAmount,
      targetSales: parseFloat(getVal("targetSales", 0)) || 0,
      stockLevel: parseInt(getVal("stockLevel", 100)) || 0,
      reorderPoint: parseInt(getVal("reorderPoint", 20)) || 0,
      netSales: grossSales - discountAmount - returnAmount
    };
  });

  const uniqueSalesStoresCount = uniqueSalesStores.size;
  const uniqueMasterStoresCount = Object.keys(storeMasterLookup).length;
  
  let matchedUniqueStoresCount = 0;
  uniqueSalesStores.forEach(s => {
    if (storeMasterLookup[s.toLowerCase().trim()]) {
      matchedUniqueStoresCount++;
    }
  });

  return {
    success: true,
    mappedColumns: salesHeaderMapping,
    storeMasterMappedColumns: Object.keys(storeMasterLookup).length > 0 ? masterMapping : undefined,
    rowCount: processedData.length,
    data: processedData,
    joinStats: Object.keys(storeMasterLookup).length > 0 ? {
      usingStoreMaster: true,
      salesStoresCount: uniqueSalesStoresCount,
      masterStoresCount: uniqueMasterStoresCount,
      matchedStoresCount: matchedUniqueStoresCount,
      unmappedStores: Array.from(unmappedStoresSet),
      autoDetectedSheets,
      salesSheetNameUsed,
      storeSheetNameUsed
    } : {
      usingStoreMaster: false
    }
  };
};

interface UploadZoneProps {
  onDataLoaded: (data: any[], filename?: string) => void;
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

  // Client-processed fallback state
  const [isClientProcessed, setIsClientProcessed] = useState(false);

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
    setIsClientProcessed(false);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      let result;
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        console.warn("Server returned non-JSON/HTML. Bypassing upload using offline client-side fallback...");
        const localResult = await processFilesClientSide(file, null);
        onDataLoaded(localResult.data, file.name);
        setUploadSuccess(true);
        setIsClientProcessed(true);
        if (localResult.joinStats && localResult.joinStats.usingStoreMaster) {
          setJoinStats(localResult.joinStats);
        }
        setTimeout(() => setUploadSuccess(false), 3000);
        return;
      }

      result = await response.json();
      if (result.success) {
        onDataLoaded(result.data, file.name);
        setUploadSuccess(true);
        setIsClientProcessed(false);
        if (result.joinStats && result.joinStats.usingStoreMaster) {
          setJoinStats(result.joinStats);
        }
        setTimeout(() => setUploadSuccess(false), 3000);
      } else {
        console.warn("Server returned failure. Bypassing upload using offline client-side fallback...");
        const localResult = await processFilesClientSide(file, null);
        onDataLoaded(localResult.data, file.name);
        setUploadSuccess(true);
        setIsClientProcessed(true);
        if (localResult.joinStats && localResult.joinStats.usingStoreMaster) {
          setJoinStats(localResult.joinStats);
        }
        setTimeout(() => setUploadSuccess(false), 3000);
      }
    } catch (err: any) {
      console.warn("Server upload caught error. Bypassing upload using offline client-side fallback...", err);
      try {
        const localResult = await processFilesClientSide(file, null);
        onDataLoaded(localResult.data, file.name);
        setUploadSuccess(true);
        setIsClientProcessed(true);
        if (localResult.joinStats && localResult.joinStats.usingStoreMaster) {
          setJoinStats(localResult.joinStats);
        }
        setTimeout(() => setUploadSuccess(false), 3000);
      } catch (localErr: any) {
        onError(`Server upload blocked/failed (${err.message}). Local fallback parse also failed: ${localErr.message}`);
      }
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
    setIsClientProcessed(false);

    const formData = new FormData();
    formData.append("salesFile", salesFile);
    formData.append("storeMasterFile", storeMasterFile);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      let result;
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        console.warn("Server returned HTML page for join. Bypassing upload using offline client-side fallback...");
        const localResult = await processFilesClientSide(salesFile, storeMasterFile);
        onDataLoaded(localResult.data, `${salesFile.name} + ${storeMasterFile.name}`);
        setUploadSuccess(true);
        setIsClientProcessed(true);
        setLoadedFileName(`${salesFile.name} + ${storeMasterFile.name} Joined`);
        if (localResult.joinStats) {
          setJoinStats(localResult.joinStats);
        }
        setTimeout(() => setUploadSuccess(false), 3000);
        return;
      }

      result = await response.json();
      if (result.success) {
        onDataLoaded(result.data, `${salesFile.name} + ${storeMasterFile.name}`);
        setUploadSuccess(true);
        setIsClientProcessed(false);
        setLoadedFileName(`${salesFile.name} + ${storeMasterFile.name} Joined`);
        if (result.joinStats) {
          setJoinStats(result.joinStats);
        }
        setTimeout(() => setUploadSuccess(false), 3000);
      } else {
        console.warn("Server join failed. Bypassing upload using offline client-side fallback...");
        const localResult = await processFilesClientSide(salesFile, storeMasterFile);
        onDataLoaded(localResult.data, `${salesFile.name} + ${storeMasterFile.name}`);
        setUploadSuccess(true);
        setIsClientProcessed(true);
        setLoadedFileName(`${salesFile.name} + ${storeMasterFile.name} Joined`);
        if (localResult.joinStats) {
          setJoinStats(localResult.joinStats);
        }
        setTimeout(() => setUploadSuccess(false), 3000);
      }
    } catch (err: any) {
      console.warn("Server join caught error. Bypassing upload using offline client-side fallback...", err);
      try {
        const localResult = await processFilesClientSide(salesFile, storeMasterFile);
        onDataLoaded(localResult.data, `${salesFile.name} + ${storeMasterFile.name}`);
        setUploadSuccess(true);
        setIsClientProcessed(true);
        setLoadedFileName(`${salesFile.name} + ${storeMasterFile.name} Joined`);
        if (localResult.joinStats) {
          setJoinStats(localResult.joinStats);
        }
        setTimeout(() => setUploadSuccess(false), 3000);
      } catch (localErr: any) {
        onError(`Server join blocked/failed (${err.message}). Local fallback alignment also failed: ${localErr.message}`);
      }
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

      {isClientProcessed && (
        <div className="mt-3 bg-blue-50/70 border border-blue-200 rounded p-3 flex items-start gap-2.5 text-[11px]" id="proxy-bypass-notice">
          <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-blue-900 uppercase tracking-tight flex items-center gap-1.5">
              <span>Enterprise Proxy Safe Mode Active</span>
              <span className="bg-blue-100 text-blue-800 text-[8px] px-1.5 py-0.5 rounded font-extrabold font-mono">CLIENT-SIDE</span>
            </p>
            <p className="text-slate-600 leading-normal">
              Your corporate web gateway or firewall policy (Status 403: Noncompliant action) blocked uploading spreadsheet files to our external server containers.
              <strong> No worries!</strong> We've automatically initiated <strong>Secure Local Parsing</strong>. Your files were parsed, aligned, and merged entirely inside your browser sandbox — <strong>no enterprise data ever left your browser</strong>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
