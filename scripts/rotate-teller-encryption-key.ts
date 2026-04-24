// File: scripts/rotate-teller-encryption-key.ts
//
// One-shot: re-encrypt every teller_enrollments.access_token from the OLD
// TELLER_ENCRYPTION_KEY to a NEW key. Run this BEFORE swapping the env var
// in Vercel. After a clean --apply run, update TELLER_ENCRYPTION_KEY to the
// new value and delete this script (or archive it).
//
// Required env vars:
//   TELLER_ENCRYPTION_KEY     — current (old) 64-char hex key
//   NEW_TELLER_ENCRYPTION_KEY — new 64-char hex key (generate via `openssl rand -hex 32`)
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY — service role (bypasses RLS)
//
// Usage:
//   npx ts-node scripts/rotate-teller-encryption-key.ts           # dry run
//   npx ts-node scripts/rotate-teller-encryption-key.ts --apply   # write to DB
//
// Safe to re-run: rows already encrypted with the new key are detected and skipped.

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function loadKey(hex: string | undefined, name: string): Buffer {
  if (!hex || hex.length !== 64 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new Error(`${name} must be a 64-char hex string (32 bytes)`);
  }
  return Buffer.from(hex, 'hex');
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, enc, tag]).toString('hex');
}

function decrypt(hex: string, key: Buffer): string {
  const buf = Buffer.from(hex, 'hex');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ct = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ct) + decipher.final('utf8');
}

async function main() {
  const apply = process.argv.includes('--apply');

  const oldKey = loadKey(process.env.TELLER_ENCRYPTION_KEY, 'TELLER_ENCRYPTION_KEY');
  const newKey = loadKey(process.env.NEW_TELLER_ENCRYPTION_KEY, 'NEW_TELLER_ENCRYPTION_KEY');
  if (oldKey.equals(newKey)) {
    throw new Error('Old and new keys are identical — nothing to rotate.');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  const supabase = createClient(supabaseUrl, serviceRole);

  console.log(apply ? '=== APPLY MODE — writes to DB ===' : '=== DRY RUN — no DB writes ===');

  const { data: rows, error } = await supabase
    .from('teller_enrollments')
    .select('id, user_id, enrollment_id, access_token');

  if (error) throw error;
  if (!rows || rows.length === 0) {
    console.log('No enrollments to migrate.');
    return;
  }

  console.log(`Found ${rows.length} enrollment(s) to process.\n`);

  let reencrypted = 0;
  let alreadyNew = 0;
  let failed = 0;

  for (const row of rows) {
    const label = `${row.id} (user=${row.user_id}, enrollment=${row.enrollment_id})`;

    let plaintext: string;
    try {
      plaintext = decrypt(row.access_token as string, oldKey);
    } catch {
      try {
        decrypt(row.access_token as string, newKey);
        console.log(`SKIP  ${label} — already encrypted with new key`);
        alreadyNew++;
        continue;
      } catch {
        console.error(`FAIL  ${label} — decrypt failed with both old and new key`);
        failed++;
        continue;
      }
    }

    const reEncrypted = encrypt(plaintext, newKey);

    if (!apply) {
      console.log(`OK    ${label} — decrypted with old key, would re-encrypt`);
      reencrypted++;
      continue;
    }

    const { error: updErr } = await supabase
      .from('teller_enrollments')
      .update({ access_token: reEncrypted })
      .eq('id', row.id);

    if (updErr) {
      console.error(`FAIL  ${label} — update failed: ${updErr.message}`);
      failed++;
    } else {
      console.log(`OK    ${label} — re-encrypted`);
      reencrypted++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`re-encrypted: ${reencrypted}${apply ? '' : ' (dry run)'}`);
  console.log(`already new:  ${alreadyNew}`);
  console.log(`failed:       ${failed}`);

  if (!apply && failed === 0) {
    console.log('\nDry run clean. Re-run with --apply to write changes.');
  }
  if (apply && failed === 0) {
    console.log('\nDone. Next steps:');
    console.log('  1. Update TELLER_ENCRYPTION_KEY in Vercel (all envs) to the new value');
    console.log('  2. Remove NEW_TELLER_ENCRYPTION_KEY from env');
    console.log('  3. Redeploy');
    console.log('  4. Smoke test /api/teller/sync for one enrollment');
    console.log('  5. Delete (or archive) this script');
  }

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
