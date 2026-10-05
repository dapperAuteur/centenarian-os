// app/api/finance/retirement/settings/route.ts
// PUT: save the retirement planner's inputs (any subset; null clears a value back to the default).
//   { birth_year?, current_age?, retirement_age?, life_expectancy?, spending_mode?,
//     desired_yearly_spending?, spending_multiple?, social_security_monthly?,
//     social_security_start_age?, inflation_rate?, return_conservative?, return_middle?,
//     return_optimistic?, selected_preset?, target_method?, withdrawal_rate? }

import { NextRequest, NextResponse } from 'next/server';
import { parseSettingsInput, saveSettings } from '@/lib/finance/retirement/server';
import { errorResponse, readJson, sessionUser, unauthorized } from '@/lib/finance/retirement/request';

export async function PUT(request: NextRequest) {
  const { db, userId } = await sessionUser();
  if (!userId) return unauthorized();
  try {
    const settings = await saveSettings(db, userId, parseSettingsInput(await readJson(request)));
    return NextResponse.json({ settings });
  } catch (err) {
    return errorResponse(err, 'api/finance/retirement/settings');
  }
}
