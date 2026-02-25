// app/api/profiles/[username]/route.ts
// GET — public profile data. Thin wrapper around shared helper.

import { NextRequest, NextResponse } from 'next/server';
import { getPublicProfile } from '@/lib/profiles/getPublicProfile';

type Params = { params: Promise<{ username: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { username } = await params;
  const data = await getPublicProfile(username);

  if (!data) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json(data);
}
