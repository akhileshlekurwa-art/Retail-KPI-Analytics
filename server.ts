import express from "express";
import multer from "multer";
import * as xlsx from "xlsx";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { generateSampleRetailData } from "./server/sampleData";
import { RetailRecord } from "./src/types";

const app = express();
const PORT = 3000;

// Use memory storage for uploaded files so we can parse them directly from buffer
const upload = multer({ storage: multer.memoryStorage() });

// Middleware for parsing JSON
app.use(express.json({ limit: "50mb" }));

// Helper function to normalize headers for fuzzy column mapping
function normalizeHeader(h: any): string {
  if (!h) return "";
  return h.toString().toLowerCase().trim().replace(/[^a-z0-9]/g, "");
}

// Map headers dynamically with support for Store Master fallbacks
function mapRawRowToRetailRecord(
  rawRow: any,
  headerMapping: Record<string, string>,
  txId: string,
  storeLookupFallback?: { region: string; city: string; storeFormat: string }
): RetailRecord {
  const getVal = (stdKey: string, fallback: any) => {
    const rawKey = headerMapping[stdKey];
    if (!rawKey) return fallback;
    const val = rawRow[rawKey];
    return val !== undefined && val !== null ? val : fallback;
  };

  const grossSales = parseFloat(getVal("grossSales", 0)) || 0;
  const discountAmount = parseFloat(getVal("discountAmount", 0)) || 0;
  const returnAmount = parseFloat(getVal("returnAmount", 0)) || 0;
  
  const rawDate = getVal("date", "");
  let dateStr = "";
  if (rawDate) {
    if (typeof rawDate === "number") {
      // Excel serial date representation
      try {
        const dateObj = xlsx.SSF.parse_date_code(rawDate);
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

  // Fallbacks for Store Details from lookup if available
  const storeVal = getVal("store", "Store A").toString();
  const regionVal = getVal("region", storeLookupFallback?.region || "Unknown Region").toString();
  const cityVal = getVal("city", storeLookupFallback?.city || "Unknown City").toString();
  const storeFormatVal = getVal("storeFormat", storeLookupFallback?.storeFormat || "Standard").toString();

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
}

// API Routes FIRST

// Get sample data
app.get("/api/sample-data", (req, res) => {
  try {
    const data = generateSampleRetailData();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper function to find matching header columns
function findHeaderMapping(rawKeys: string[], standardKeys: Record<string, string[]>): Record<string, string> {
  const headerMapping: Record<string, string> = {};
  for (const [stdKey, aliases] of Object.entries(standardKeys)) {
    // Find matching raw header
    const match = rawKeys.find(rk => {
      const normRk = normalizeHeader(rk);
      return aliases.includes(normRk) || normRk.includes(stdKey.toLowerCase());
    });
    if (match) {
      headerMapping[stdKey] = match;
    } else {
      // Fallback: see if any raw key contains a substring of the aliases
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

// Download Weekly Sales report template
app.get("/api/download-sales-template", (req, res) => {
  try {
    const csvContent = [
      "Transaction ID,Date,Week,Store,Product Category,Gross Sales,Discount Amount,Return Amount,Target Sales,Stock Level,Reorder Point",
      "TX5001,2026-06-01,W23,NY Metro,Electronics,850,50,0,350,45,15",
      "TX5002,2026-06-02,W23,NY Metro,Apparel,120,20,15,350,8,10",
      "TX5003,2026-06-03,W23,LA Central,Electronics,1200,150,100,500,12,15",
      "TX5004,2026-06-04,W23,SF Plaza,Groceries,45,0,0,250,90,30",
      "TX5005,2026-06-05,W23,Chicago Loop,Apparel,280,45,45,300,50,20",
      "TX5006,2026-06-06,W23,Houston Galleria,Home & Kitchen,350,30,0,400,25,20"
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=weekly_sales_report_template.csv");
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download Store Master reference template
app.get("/api/download-stores-template", (req, res) => {
  try {
    const csvContent = [
      "Store,Region,City,Store Format",
      "NY Metro,East,New York,Hypermarket",
      "Boston Hub,East,Boston,Express",
      "LA Central,West,Los Angeles,Hypermarket",
      "SF Plaza,West,San Francisco,Supermarket",
      "Chicago Loop,North,Chicago,Supermarket",
      "Detroit Depot,North,Detroit,Express",
      "Houston Galleria,South,Houston,Supermarket",
      "Miami Beach,South,Miami,Express"
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=store_master_template.csv");
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Download sample combined template (returns a clean CSV representation)
app.get("/api/download-template", (req, res) => {
  try {
    const csvContent = [
      "Transaction ID,Date,Week,Region,City,Store,Store Format,Product Category,Gross Sales,Discount Amount,Return Amount,Target Sales,Stock Level,Reorder Point",
      "TX5001,2026-06-01,W23,East,New York,NY Metro,Hypermarket,Electronics,850,50,0,350,45,15",
      "TX5002,2026-06-02,W23,East,New York,NY Metro,Hypermarket,Apparel,120,20,15,350,8,10",
      "TX5003,2026-06-03,W23,West,Los Angeles,LA Central,Hypermarket,Electronics,1200,150,100,500,12,15",
      "TX5004,2026-06-04,W23,West,San Francisco,SF Plaza,Supermarket,Groceries,45,0,0,250,90,30",
      "TX5005,2026-06-05,W23,North,Chicago,Chicago Loop,Supermarket,Apparel,280,45,45,300,50,20",
      "TX5006,2026-06-06,W23,South,Houston,Houston Galleria,Supermarket,Home & Kitchen,350,30,0,400,25,20"
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=retail_data_template.csv");
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Parse uploaded files (supporting single file, double files, or multi-sheet workbooks)
app.post(
  "/api/upload",
  upload.fields([
    { name: "file", maxCount: 1 },
    { name: "salesFile", maxCount: 1 },
    { name: "storeMasterFile", maxCount: 1 }
  ]),
  (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      
      let salesBuffer: Buffer | null = null;
      let storeMasterBuffer: Buffer | null = null;

      if (files?.salesFile?.[0] && files?.storeMasterFile?.[0]) {
        salesBuffer = files.salesFile[0].buffer;
        storeMasterBuffer = files.storeMasterFile[0].buffer;
      } else if (req.file) {
        salesBuffer = req.file.buffer;
      } else if (files?.file?.[0]) {
        salesBuffer = files.file[0].buffer;
      }

      if (!salesBuffer) {
        return res.status(400).json({ success: false, error: "Please upload at least the Weekly Sales file." });
      }

      const salesWorkbook = xlsx.read(salesBuffer, { type: "buffer" });
      
      let rawSalesData: any[] = [];
      let rawStoreMasterData: any[] = [];
      let autoDetectedSheets = false;
      let salesSheetNameUsed = "";
      let storeSheetNameUsed = "";
      
      if (!storeMasterBuffer && salesWorkbook.SheetNames.length >= 2) {
        const sheets = salesWorkbook.SheetNames;
        const salesSheetName = sheets.find(s => s.toLowerCase().includes("sale") || s.toLowerCase().includes("report") || s.toLowerCase().includes("weekly")) || sheets[0];
        const storeSheetName = sheets.find(s => s.toLowerCase().includes("store") || s.toLowerCase().includes("master") || s.toLowerCase().includes("outlet") || s.toLowerCase().includes("shop")) || sheets[1];
        
        if (salesSheetName && storeSheetName && salesSheetName !== storeSheetName) {
          rawSalesData = xlsx.utils.sheet_to_json<any>(salesWorkbook.Sheets[salesSheetName]);
          rawStoreMasterData = xlsx.utils.sheet_to_json<any>(salesWorkbook.Sheets[storeSheetName]);
          autoDetectedSheets = true;
          salesSheetNameUsed = salesSheetName;
          storeSheetNameUsed = storeSheetName;
        } else {
          rawSalesData = xlsx.utils.sheet_to_json<any>(salesWorkbook.Sheets[sheets[0]]);
        }
      } else {
        rawSalesData = xlsx.utils.sheet_to_json<any>(salesWorkbook.Sheets[salesWorkbook.SheetNames[0]]);
        
        if (storeMasterBuffer) {
          const storeWorkbook = xlsx.read(storeMasterBuffer, { type: "buffer" });
          rawStoreMasterData = xlsx.utils.sheet_to_json<any>(storeWorkbook.Sheets[storeWorkbook.SheetNames[0]]);
        }
      }

      if (!rawSalesData || rawSalesData.length === 0) {
        return res.status(400).json({ success: false, error: "The Weekly Sales report sheet is empty." });
      }

      // Fuzzy column mapping for Sales Report
      const salesSampleRow = rawSalesData[0];
      const salesRawKeys = Object.keys(salesSampleRow);
      const salesHeaderMapping = findHeaderMapping(salesRawKeys, salesStandardKeys);

      // Store Master Lookup building
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

      // Process records and merge properties on the go
      let autoIdCounter = 6001;
      const uniqueSalesStores = new Set<string>();
      const unmappedStoresSet = new Set<string>();

      const processedData: RetailRecord[] = rawSalesData.map(row => {
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

        return mapRawRowToRetailRecord(row, salesHeaderMapping, txId, lookupDetails);
      });

      const uniqueSalesStoresCount = uniqueSalesStores.size;
      const uniqueMasterStoresCount = Object.keys(storeMasterLookup).length;
      
      let matchedUniqueStoresCount = 0;
      uniqueSalesStores.forEach(s => {
        if (storeMasterLookup[s.toLowerCase().trim()]) {
          matchedUniqueStoresCount++;
        }
      });

      res.json({
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
      });
    } catch (err: any) {
      console.error("Upload & Join error:", err);
      res.status(500).json({ success: false, error: err.message || "An error occurred while parsing and joining the files." });
    }
  }
);

// Generate Business Insights using Gemini API
app.post("/api/insights", async (req, res) => {
  try {
    const { kpi, filteredData, activeFilters, isIndian } = req.body;
    
    // Create prompt with summary details
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({
        success: false,
        error: "GEMINI_API_KEY is not configured on the server. Please check Settings > Secrets."
      });
    }

    // Aggregations to include in prompt
    // We summarize region sales
    const regionSales: Record<string, number> = {};
    const storeTargetDeficit: Record<string, { sales: number; target: number; deficit: number }> = {};
    const categoryReturns: Record<string, { returns: number; sales: number }> = {};
    const stockoutRiskItems: Array<{ category: string; store: string; stock: number; reorder: number }> = [];

    filteredData.forEach((r: RetailRecord) => {
      // Region sales
      regionSales[r.region] = (regionSales[r.region] || 0) + r.netSales;

      // Store sales & target
      if (!storeTargetDeficit[r.store]) {
        storeTargetDeficit[r.store] = { sales: 0, target: 0, deficit: 0 };
      }
      storeTargetDeficit[r.store].sales += r.netSales;
      storeTargetDeficit[r.store].target += r.targetSales;

      // Category returns
      if (!categoryReturns[r.category]) {
        categoryReturns[r.category] = { returns: 0, sales: 0 };
      }
      categoryReturns[r.category].returns += r.returnAmount;
      categoryReturns[r.category].sales += r.netSales;

      // Stockout risk
      if (r.stockLevel <= r.reorderPoint) {
        stockoutRiskItems.push({
          category: r.category,
          store: r.store,
          stock: r.stockLevel,
          reorder: r.reorderPoint
        });
      }
    });

    // Calculate store target performance
    const missingStores = Object.entries(storeTargetDeficit)
      .map(([store, val]) => {
        const achievement = val.target > 0 ? (val.sales / val.target) * 100 : 100;
        const deficit = val.target - val.sales;
        return { store, sales: val.sales, target: val.target, deficit, achievement };
      })
      .filter(item => item.deficit > 0)
      .sort((a, b) => b.deficit - a.deficit)
      .slice(0, 5);

    // Calculate category return rates
    const highReturns = Object.entries(categoryReturns)
      .map(([category, val]) => {
        const returnRate = val.sales > 0 ? (val.returns / val.sales) * 100 : 0;
        return { category, returnAmount: val.returns, returnRate };
      })
      .sort((a, b) => b.returnAmount - a.returnAmount)
      .slice(0, 5);

    // Format data for prompt
    const analysisPayload = {
      kpis: kpi,
      activeFilters,
      regionSalesSummary: Object.entries(regionSales).map(([name, sales]) => ({ name, sales })),
      storesMissingTarget: missingStores,
      categoriesByReturnRate: highReturns,
      stockoutRisksCount: stockoutRiskItems.length,
      sampleStockoutRisks: stockoutRiskItems.slice(0, 5)
    };

    const ai = new GoogleGenAI({
      apiKey: geminiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    const currencyWord = isIndian ? "Indian Rupees (INR, ₹) - formatting figures beautifully using the standard Indian numbering layout (Lakhs / Crores if applicable)" : "US Dollars (USD, $)";

    const prompt = `
      As an expert retail analyst and executive business advisor, analyze this retail transaction and KPI dataset to generate deep, action-oriented, data-backed retail business insights. The financial figures are in ${currencyWord}. Make sure your written numbers and symbols represent this currency.
      
      Here is the aggregated data and summary of active filters:
      ${JSON.stringify(analysisPayload, null, 2)}
      
      Generate a professional response strictly following the JSON Schema provided.
      The "executiveSummary" should be 2-3 detailed paragraphs using Markdown formatting. Detail what is driving performance, call out significant issues, and analyze structural problems (e.g. why returns are high or stores are missing target).
      The "actionItems" should contain 4 to 6 highly specific, tangible operational steps a retail manager can take immediately (e.g. inventory rebalancing, discount strategies, quality checks).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bestRegion: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                sales: { type: Type.NUMBER }
              },
              required: ["name", "sales"]
            },
            worstRegion: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                sales: { type: Type.NUMBER }
              },
              required: ["name", "sales"]
            },
            storesMissingTarget: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  store: { type: Type.STRING },
                  sales: { type: Type.NUMBER },
                  target: { type: Type.NUMBER },
                  deficit: { type: Type.NUMBER },
                  achievement: { type: Type.NUMBER }
                },
                required: ["store", "sales", "target", "deficit", "achievement"]
              }
            },
            highReturnCategories: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  returnAmount: { type: Type.NUMBER },
                  returnRate: { type: Type.NUMBER }
                },
                required: ["category", "returnAmount", "returnRate"]
              }
            },
            stockoutRiskItems: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  category: { type: Type.STRING },
                  store: { type: Type.STRING },
                  stockLevel: { type: Type.NUMBER },
                  reorderPoint: { type: Type.NUMBER }
                },
                required: ["category", "store", "stockLevel", "reorderPoint"]
              }
            },
            executiveSummary: {
              type: Type.STRING,
              description: "A highly professional, data-driven executive summary in markdown format with paragraphs."
            },
            actionItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "4-6 highly specific, actionable, data-backed retail operations recommendations based on performance details."
            }
          },
          required: ["bestRegion", "worstRegion", "storesMissingTarget", "highReturnCategories", "stockoutRiskItems", "executiveSummary", "actionItems"]
        }
      }
    });

    const parsedInsights = JSON.parse(response.text || "{}");
    res.json({ success: true, insights: parsedInsights });
  } catch (err: any) {
    console.error("Gemini API error:", err);
    res.status(500).json({ success: false, error: err.message || "An error occurred with Gemini." });
  }
});

// Configure Vite middleware in development or static assets in production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // In Express v4, use app.get('*', ...)
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Global Express Error-handling Middleware (MUST be last)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Global Express unhandled error:", err);
    res.status(err.status || err.statusCode || 500).json({
      success: false,
      error: err.message || "An unexpected internal server error occurred on the server."
    });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Global Process Exception Handlers to prevent node crash
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION AT:", promise, "REASON:", reason);
});

startServer();
