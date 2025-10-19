interface OFFProduct {
  product_name: string;
  code: string;
  nutriments: {
    'energy-kcal_100g': number;
    'proteins_100g': number;
    'carbohydrates_100g': number;
    'fat_100g': number;
    'fiber_100g': number;
  };
  brands?: string;
  stores?: string;
}

interface OFFSearchResult {
  products: OFFProduct[];
  count: number;
}

const BASE_URL = 'https://world.openfoodfacts.org';

export async function searchOpenFoodFacts(query: string, pageSize: number = 20): Promise<OFFSearchResult> {
  const response = await fetch(
    `${BASE_URL}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&page_size=${pageSize}&json=1`
  );
  
  if (!response.ok) throw new Error('Open Food Facts request failed');
  return response.json();
}

export async function getProductByBarcode(barcode: string): Promise<OFFProduct> {
  const response = await fetch(`${BASE_URL}/api/v0/product/${barcode}.json`);
  if (!response.ok) throw new Error('Failed to fetch product');
  const data = await response.json();
  return data.product;
}

export function extractOFFNutrients(product: OFFProduct) {
  const nutrients = product.nutriments || {};
  
  return {
    calories: nutrients['energy-kcal_100g'] || 0,
    protein: nutrients['proteins_100g'] || 0,
    carbs: nutrients['carbohydrates_100g'] || 0,
    fat: nutrients['fat_100g'] || 0,
    fiber: nutrients['fiber_100g'] || 0,
  };
}

export function calculateNCV(calories: number, protein: number, fiber: number): 'Green' | 'Yellow' | 'Red' {
  const nutrientDensity = (protein + fiber) / (calories || 1);
  
  if (nutrientDensity > 0.15) return 'Green';
  if (nutrientDensity > 0.08) return 'Yellow';
  return 'Red';
}