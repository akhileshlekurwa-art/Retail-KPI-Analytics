import { RetailRecord } from "../src/types";

// Generate a rich, highly realistic dataset of ~120 retail records
export function generateSampleRetailData(): RetailRecord[] {
  const records: RetailRecord[] = [];
  const weeks = ["W23", "W24", "W25", "W26"];
  
  const regions = [
    { name: "East", cities: ["New York", "Boston"], stores: ["NY Metro", "Boston Hub"] },
    { name: "West", cities: ["Los Angeles", "San Francisco"], stores: ["LA Central", "SF Plaza"] },
    { name: "North", cities: ["Chicago", "Detroit"], stores: ["Chicago Loop", "Detroit Depot"] },
    { name: "South", cities: ["Houston", "Miami"], stores: ["Houston Galleria", "Miami Beach"] }
  ];

  const storeFormats: Record<string, string> = {
    "NY Metro": "Hypermarket",
    "Boston Hub": "Express",
    "LA Central": "Hypermarket",
    "SF Plaza": "Supermarket",
    "Chicago Loop": "Supermarket",
    "Detroit Depot": "Express",
    "Houston Galleria": "Supermarket",
    "Miami Beach": "Express"
  };

  const categories = [
    { name: "Electronics", avgPrice: 650, returnRate: 0.04, discountRate: 0.08, stockRiskProb: 0.25 },
    { name: "Apparel", avgPrice: 75, returnRate: 0.16, discountRate: 0.18, stockRiskProb: 0.15 },
    { name: "Home & Kitchen", avgPrice: 150, returnRate: 0.06, discountRate: 0.10, stockRiskProb: 0.10 },
    { name: "Groceries", avgPrice: 35, returnRate: 0.01, discountRate: 0.03, stockRiskProb: 0.30 },
    { name: "Beauty & Care", avgPrice: 45, returnRate: 0.03, discountRate: 0.07, stockRiskProb: 0.05 }
  ];

  // Base targets per store format for weekly targets
  const formatWeeklyTarget: Record<string, number> = {
    "Hypermarket": 45000,
    "Supermarket": 28000,
    "Express": 12000
  };

  let txCounter = 1001;

  // Let's seed a deterministic random sequence to make sure it is predictable
  let seed = 42;
  function random(): number {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }

  function getRandomBetween(min: number, max: number): number {
    return Math.floor(random() * (max - min + 1) + min);
  }

  // Iterate over weeks, regions, and categories to generate data
  for (const week of weeks) {
    for (const reg of regions) {
      for (let i = 0; i < reg.stores.length; i++) {
        const store = reg.stores[i];
        const city = reg.cities[i];
        const format = storeFormats[store];
        
        // Target for this store this week (with some random variance)
        const baseTarget = formatWeeklyTarget[format];
        const targetSales = Math.round(baseTarget * (0.9 + random() * 0.2));

        // Generate multiple transactions per store per week
        const txCount = getRandomBetween(4, 7);
        let storeWeekGrossSales = 0;
        let storeWeekDiscount = 0;
        let storeWeekReturn = 0;

        const storeTransactions: any[] = [];

        for (let t = 0; t < txCount; t++) {
          const categoryObj = categories[getRandomBetween(0, categories.length - 1)];
          
          // Generate realistic gross sales based on category avgPrice
          const itemsCount = getRandomBetween(1, 4);
          const grossSales = Math.round(categoryObj.avgPrice * itemsCount * (0.8 + random() * 0.4));
          
          // Discounts (some transactions have none, some have promotional discounts)
          const hasDiscount = random() > 0.3;
          const discountAmount = hasDiscount 
            ? Math.round(grossSales * categoryObj.discountRate * (0.5 + random() * 1.0)) 
            : 0;

          // Returns (apparel has higher, groceries lower)
          const isReturned = random() < categoryObj.returnRate;
          const returnAmount = isReturned ? Math.round((grossSales - discountAmount) * (0.5 + random() * 0.5)) : 0;

          // Inventory & Stock levels
          const reorderPoint = getRandomBetween(10, 30);
          const isStockoutRisk = random() < categoryObj.stockRiskProb;
          const stockLevel = isStockoutRisk 
            ? getRandomBetween(2, reorderPoint - 1) // low stock
            : getRandomBetween(reorderPoint + 5, reorderPoint * 3); // healthy stock

          const dateObj = new Date("2026-06-01");
          // Add offset based on week and store index
          const weekIndex = weeks.indexOf(week);
          dateObj.setDate(dateObj.getDate() + (weekIndex * 7) + getRandomBetween(0, 6));
          const dateStr = dateObj.toISOString().split("T")[0];

          storeTransactions.push({
            transactionId: `TX${txCounter++}`,
            date: dateStr,
            week,
            region: reg.name,
            city,
            store,
            storeFormat: format,
            category: categoryObj.name,
            grossSales,
            discountAmount,
            returnAmount,
            stockLevel,
            reorderPoint,
            netSales: grossSales - discountAmount - returnAmount
          });
        }

        // Adjust targets slightly to make target achievements interesting
        // Some stores will meet target, some will miss it.
        // We will assign the targetSales to all transactions for that store/week, 
        // but when we aggregate, we should make sure we divide/take the average or set target per store-week.
        // To keep it clean in a flat sheet, each record has targetSales representing the STORE-WEEK target.
        // To avoid double-counting targetSales in sum-aggregations, we'll store targetSales as:
        // targetSales = total weekly target / transaction count for that store-week
        // This makes sure summing up `targetSales` in the flat table matches the true store-week target!
        const transactionsLength = storeTransactions.length;
        storeTransactions.forEach(tx => {
          tx.targetSales = Math.round(targetSales / transactionsLength);
          records.push(tx);
        });
      }
    }
  }

  return records;
}
