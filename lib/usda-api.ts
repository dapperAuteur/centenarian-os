interface USDAFoodItem {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients: Array<{
    nutrientId: number;
    nutrientName: string;
    nutrientNumber: string;
    value: number;
    unitName: string;
  }>;
}

interface USDASearchResult {
  foods: USDAFoodItem[];
  totalHits: number;
}

const API_KEY = process.env.NEXT_PUBLIC_USDA_API_KEY;
const BASE_URL = 'https://api.nal.usda.gov/fdc/v1';

export async function searchUSDAFoods(query: string, pageSize: number = 10): Promise<USDASearchResult> {
  const response = await fetch(
    `${BASE_URL}/foods/search?api_key=${API_KEY}&query=${encodeURIComponent(query)}&pageSize=${pageSize}&dataType=Foundation,SR Legacy`
  );
  
  if (!response.ok) throw new Error('USDA API request failed');
  return response.json();
}

export async function getFoodDetails(fdcId: number): Promise<USDAFoodItem> {
  const response = await fetch(
    `${BASE_URL}/food/${fdcId}?api_key=${API_KEY}`
  );
  
  if (!response.ok) throw new Error('Failed to fetch food details');
  return response.json();
}

export function extractNutrients(food: USDAFoodItem) {
  const getNutrient = (nutrientId: number) => {
    const nutrient = food.foodNutrients.find(n => n.nutrientId === nutrientId);
    return nutrient?.value || 0;
  };

  return {
    calories: getNutrient(1008),      // Energy (kcal)
    protein: getNutrient(1003),       // Protein
    carbs: getNutrient(1005),         // Carbohydrate
    fat: getNutrient(1004),           // Total lipid (fat)
    fiber: getNutrient(1079),         // Fiber, total dietary
  };
}

export function calculateNCV(calories: number, protein: number, fiber: number): 'Green' | 'Yellow' | 'Red' {
  const nutrientDensity = (protein + fiber) / (calories || 1);
  
  if (nutrientDensity > 0.15) return 'Green';
  if (nutrientDensity > 0.08) return 'Yellow';
  return 'Red';
}