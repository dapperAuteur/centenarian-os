// lib/finance/csv-import/presets.ts
// Known bank and card CSV export layouts, used by detectMapping in ./parse.ts
// to make a first guess at a file's column mapping. Data only.

import type { BankPreset } from './types.ts';

/** The `preset` value detectMapping returns when no bank layout matched. */
export const GENERIC_PRESET_ID = 'generic';

/**
 * Known export layouts: the header keys that identify each one, which column
 * plays which role, and how the file signs its amounts.
 *
 * UNVERIFIED. These header lists and sign conventions come from general
 * knowledge of what each bank's CSV export looks like, not from real files
 * checked for this code, and banks change their exports without notice. Treat
 * every preset as a starting guess: detectMapping returns it for the person
 * to confirm, and applyMapping takes whatever mapping, sign convention and
 * date order the caller passes. Correct a preset here once a real export
 * shows it is wrong.
 *
 * Keys are written the way normalizeHeader produces them. A preset applies
 * when every key in `headers` is present; when several apply, the one with
 * the most keys wins.
 */
export const BANK_PRESETS: readonly BankPreset[] = [
  {
    // Transaction Date,Post Date,Description,Category,Type,Amount,Memo
    id: 'chase_card',
    label: 'Chase credit card',
    headers: ['transaction_date', 'post_date', 'description', 'category', 'type', 'amount', 'memo'],
    mapping: {
      date: 'transaction_date',
      postDate: 'post_date',
      description: 'description',
      memo: 'memo',
      amount: 'amount',
      category: 'category',
    },
    sign: 'negative_is_expense',
  },
  {
    // Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #
    id: 'chase_checking',
    label: 'Chase checking or savings',
    headers: ['details', 'posting_date', 'description', 'amount', 'type', 'balance'],
    mapping: { date: 'posting_date', description: 'description', amount: 'amount' },
    sign: 'negative_is_expense',
  },
  {
    // Date,Description,Card Member,Account #,Amount, then on the longer export:
    // Extended Details,Appears On Your Statement As,Address,City/State,Zip Code,Country,Reference,Category
    // The shortest Amex export is only Date,Description,Amount, which no header
    // can tell apart from any other file: it falls through to the generic guess.
    id: 'amex',
    label: 'American Express',
    headers: ['date', 'description', 'card_member', 'account_#', 'amount'],
    mapping: {
      date: 'date',
      description: 'description',
      amount: 'amount',
      category: 'category',
      bankId: 'reference',
    },
    sign: 'positive_is_expense',
  },
  {
    // Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
    id: 'capital_one_card',
    label: 'Capital One credit card',
    headers: ['transaction_date', 'posted_date', 'card_no.', 'description', 'category', 'debit', 'credit'],
    mapping: {
      date: 'transaction_date',
      postDate: 'posted_date',
      description: 'description',
      debit: 'debit',
      credit: 'credit',
      category: 'category',
    },
    sign: 'split_columns',
  },
  {
    // Account Number,Transaction Description,Transaction Date,Transaction Type,Transaction Amount,Balance
    // The amount is unsigned; Transaction Type says Debit or Credit.
    id: 'capital_one_360',
    label: 'Capital One 360 checking or savings',
    headers: [
      'account_number',
      'transaction_description',
      'transaction_date',
      'transaction_type',
      'transaction_amount',
      'balance',
    ],
    mapping: {
      date: 'transaction_date',
      description: 'transaction_description',
      amount: 'transaction_amount',
      type: 'transaction_type',
    },
    sign: 'type_column',
  },
  {
    // Transaction Date,Clearing Date,Description,Merchant,Category,Type,Amount (USD),Purchased By
    id: 'apple_card',
    label: 'Apple Card',
    headers: [
      'transaction_date',
      'clearing_date',
      'description',
      'merchant',
      'category',
      'type',
      'amount_(usd)',
    ],
    mapping: {
      date: 'transaction_date',
      postDate: 'clearing_date',
      description: 'description',
      merchant: 'merchant',
      amount: 'amount_(usd)',
      category: 'category',
    },
    sign: 'positive_is_expense',
  },
  {
    // Trans. Date,Post Date,Description,Amount,Category
    id: 'discover',
    label: 'Discover',
    headers: ['trans._date', 'post_date', 'description', 'amount', 'category'],
    mapping: {
      date: 'trans._date',
      postDate: 'post_date',
      description: 'description',
      amount: 'amount',
      category: 'category',
    },
    sign: 'positive_is_expense',
  },
  {
    // Status,Date,Description,Debit,Credit[,Member Name]
    // VERIFIED against real Citi card exports (AAdvantage and Costco cards),
    // read locally: charges in Debit as positive numbers, payments and
    // refunds in Credit as negative numbers, Status "Cleared" or "Pending".
    id: 'citi',
    label: 'Citi credit card',
    headers: ['status', 'date', 'description', 'debit', 'credit'],
    mapping: {
      date: 'date',
      description: 'description',
      debit: 'debit',
      credit: 'credit',
      status: 'status',
    },
    sign: 'split_columns',
    accountKind: 'card',
  },
  {
    // A summary block, a blank line, then: Date,Description,Amount,Running Bal.
    id: 'bofa_checking',
    label: 'Bank of America checking or savings',
    headers: ['date', 'description', 'amount', 'running_bal.'],
    mapping: { date: 'date', description: 'description', amount: 'amount' },
    sign: 'negative_is_expense',
  },
  {
    // Posted Date,Reference Number,Payee,Address,Amount
    id: 'bofa_card',
    label: 'Bank of America credit card',
    headers: ['posted_date', 'reference_number', 'payee', 'address', 'amount'],
    mapping: {
      date: 'posted_date',
      description: 'payee',
      amount: 'amount',
      bankId: 'reference_number',
    },
    sign: 'negative_is_expense',
  },
  {
    // No header row. Five columns: date, amount, "*", (blank), description.
    id: 'wells_fargo',
    label: 'Wells Fargo',
    headers: ['col_1', 'col_2', 'col_3', 'col_4', 'col_5'],
    headerless: true,
    cellEquals: { col_3: '*' },
    mapping: { date: 'col_1', description: 'col_5', amount: 'col_2' },
    sign: 'negative_is_expense',
  },
  {
    // Date,Time,TimeZone,Name,Type,Status,Currency,Gross,Fee,Net,From Email Address,
    // To Email Address,Transaction ID,..., Balance Impact, ...
    // VERIFIED against real PayPal activity exports, read locally. PayPal's
    // Type is a label ("Express Checkout Payment"), not debit/credit, so it
    // stands in for a blank Name. Gross is signed: money out is negative.
    // Many rows move no money and are left out (skipRows): item detail lines
    // (blank Balance Impact), authorizations, holds and voids (Balance Impact
    // "Memo"), denied payments, and the other-currency side of a conversion.
    id: 'paypal',
    label: 'PayPal',
    headers: ['date', 'name', 'type', 'status', 'gross', 'transaction_id'],
    mapping: {
      date: 'date',
      description: 'name',
      memo: 'type',
      amount: 'gross',
      bankId: 'transaction_id',
      status: 'status',
    },
    sign: 'negative_is_expense',
    accountKind: 'wallet',
    skipRows: [
      {
        column: 'balance_impact',
        pattern: '^$',
        reason: 'An item line that details another PayPal row. No money moved on its own.',
      },
      {
        column: 'balance_impact',
        pattern: '^memo$',
        reason: 'PayPal marks this as a memo (an authorization, a hold or a void). No money moved.',
      },
      { column: 'status', pattern: '^denied$', reason: 'PayPal denied this transaction, so no money moved.' },
      {
        column: 'type',
        pattern: 'account hold|reversal of general account hold',
        reason: 'A temporary hold or its release. No money moved.',
      },
      {
        column: 'currency',
        pattern: '^(?!usd$).+',
        reason: 'In another currency. The US dollar side of the conversion is imported instead.',
      },
    ],
  },
  {
    // A summary block ("Account Name : ...", "Account Number : ...", "Date
    // Range : ..."), then:
    // Transaction Number,Date,Description,Memo,Amount Debit,Amount Credit,Balance,Check Number
    // and on card and loan exports also Fees,Principal,Interest.
    // VERIFIED against real Arizona Federal Credit Union exports (checking,
    // credit card and auto loan), read locally. Debits are negative numbers
    // in Amount Debit, credits positive in Amount Credit. Description holds
    // the transaction type ("Withdrawal Debit Card"); the merchant is in Memo.
    id: 'azfcu',
    label: 'Arizona Federal Credit Union',
    headers: ['transaction_number', 'date', 'description', 'memo', 'amount_debit', 'amount_credit', 'balance'],
    mapping: {
      date: 'date',
      description: 'description',
      detail: 'memo',
      debit: 'amount_debit',
      credit: 'amount_credit',
      bankId: 'transaction_number',
    },
    sign: 'split_columns',
    skipRows: [
      {
        column: 'description',
        pattern: '^(transaction )?comment$',
        reason: 'A comment line from the credit union. No money moved.',
      },
    ],
  },
  {
    // Posting Date,Transaction Date,Amount,Credit Debit Indicator,type,Type Group,Reference,
    // Instructed Currency,Currency Exchange Rate,Instructed Amount,Description,Category,
    // Check Serial Number,Card Ending,Rewards Total,Rewards Type
    // VERIFIED against real Navy Federal checking and savings exports, read
    // locally. Amount is unsigned; Credit Debit Indicator says which way.
    id: 'navy_federal',
    label: 'Navy Federal Credit Union',
    headers: ['posting_date', 'transaction_date', 'amount', 'credit_debit_indicator', 'description'],
    mapping: {
      date: 'transaction_date',
      postDate: 'posting_date',
      description: 'description',
      amount: 'amount',
      type: 'credit_debit_indicator',
      category: 'category',
      bankId: 'reference',
    },
    sign: 'type_column',
    accountKind: 'bank',
  },
  {
    // No header row. Four tab-separated columns: date, amount ("$-25.00"),
    // description, a type word ("payment"). Best Buy's card site downloads
    // this as an ".xls" file, but it is plain text.
    // VERIFIED against a real Best Buy (Citibank) download, read locally:
    // a payment is negative, so purchases are positive.
    id: 'best_buy_text',
    label: 'Best Buy credit card (Citibank) download',
    headers: ['col_1', 'col_2', 'col_3', 'col_4'],
    headerless: true,
    cellPattern: { col_2: '^\\$?[-+]?\\$?[\\d,]+\\.\\d{2}$', col_4: '^[a-z][a-z ]*$' },
    mapping: { date: 'col_1', amount: 'col_2', description: 'col_3' },
    sign: 'positive_is_expense',
    accountKind: 'card',
  },
];
