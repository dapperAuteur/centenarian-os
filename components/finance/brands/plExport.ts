// components/finance/brands/plExport.ts
// The brand P&L as GET /api/brands/[id]/pl returns it, and its PDF export. Used by the Brands page
// and the business page. Totals are in the home currency; each transaction keeps its own currency
// (the row's, else its account's, else home: lib/finance/fx/totals.ts rowCurrency).

import { formatMoney } from '@/lib/finance/fx/math';
import { rowCurrency } from '@/lib/finance/fx/totals';

export interface PlTransaction {
  id: string;
  transaction_date: string;
  description: string | null;
  vendor: string | null;
  amount: number;
  type: 'income' | 'expense';
  currency?: string | null;
  amount_home?: number | null;
  financial_accounts?: { currency?: string | null } | null;
}

export interface PlBrand {
  id: string;
  name: string;
  dba_name: string | null;
  ein: string | null;
  address?: string | null;
  color?: string | null;
}

export interface PlData {
  brand: PlBrand;
  income: number;
  expenses: number;
  net: number;
  transactions: PlTransaction[];
  transfers_excluded?: number;
  home_currency?: string;
  unconverted?: number;
}

/** The currency a P&L row's amount is in. */
export function plRowCurrency(tx: PlTransaction, home: string): string {
  return rowCurrency(tx, home);
}

/** Downloads the P&L for `from`..`to` as a PDF (jsPDF is loaded on demand). */
export async function exportPlPdf(pl: PlData, from: string, to: string): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const home = pl.home_currency ?? 'USD';
  const { brand, income, expenses, net, transactions } = pl;

  let y = 20;
  doc.setFontSize(18);
  doc.text(brand.name, 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(100);
  if (brand.dba_name) { doc.text(`DBA: ${brand.dba_name}`, 14, y); y += 6; }
  if (brand.ein) { doc.text(`EIN: ${brand.ein}`, 14, y); y += 6; }
  if (brand.address) { doc.text(`Address: ${brand.address}`, 14, y); y += 6; }
  doc.text(`Period: ${from || 'start'} to ${to || 'today'}`, 14, y); y += 6;
  doc.text(`Totals in ${home}. Transfers between your own accounts are not counted.`, 14, y); y += 10;

  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text('Summary', 14, y); y += 7;
  doc.setFontSize(10);
  doc.text(`Income:    ${formatMoney(income, home)}`, 14, y); y += 6;
  doc.text(`Expenses:  ${formatMoney(expenses, home)}`, 14, y); y += 6;
  doc.text(`Net:       ${formatMoney(net, home)}`, 14, y); y += 6;
  if ((pl.unconverted ?? 0) > 0) {
    doc.text(`${pl.unconverted} foreign-currency row(s) with no exchange rate yet are not in the totals.`, 14, y);
    y += 6;
  }
  y += 6;

  doc.setFontSize(12);
  doc.text('Transactions', 14, y); y += 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Date', 14, y);
  doc.text('Description', 44, y);
  doc.text('Vendor', 110, y);
  doc.text('Type', 150, y);
  doc.text('Amount', 170, y);
  y += 5;
  doc.setFont('helvetica', 'normal');

  for (const tx of transactions) {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(tx.transaction_date, 14, y);
    doc.text((tx.description ?? '').substring(0, 35), 44, y);
    doc.text((tx.vendor ?? '').substring(0, 22), 110, y);
    doc.text(tx.type, 150, y);
    doc.text(formatMoney(Number(tx.amount), plRowCurrency(tx, home)), 170, y);
    y += 5;
  }

  doc.save(`${brand.name.replace(/\s+/g, '_')}_PL_${from || 'start'}_${to || 'today'}.pdf`);
}
