'use client';

// components/finance/import/StatementSummary.tsx
// The review step's view of a PDF statement: its summary, whether it adds up
// (and if not, each difference in plain words), its APRs, and any
// promotional balances with their expiry dates. When it doesn't add up, the
// import needs an explicit "Import anyway".

import { TONE_CLASSES, toneForReconciliation } from '@/lib/finance/csv-import/status-tones';
import { formatCents, formatIsoDate } from '@/lib/finance/csv-import/ui-helpers';
import type { StatementPreview } from '@/lib/finance/pdf-import/service';
import { StatusNotice, ToneIcon, card } from './shared';

interface StatementSummaryProps {
  statement: StatementPreview;
  /** False when the chosen account's last four digits differ from the statement's. */
  accountMatchesStatement: boolean | null;
  confirmUnreconciled: boolean;
  onConfirmUnreconciledChange: (confirmed: boolean) => void;
}

const money = (cents: number | null): string => (cents === null ? 'Not shown' : formatCents(cents));

export default function StatementSummary({
  statement,
  accountMatchesStatement,
  confirmUnreconciled,
  onConfirmUnreconciledChange,
}: StatementSummaryProps) {
  const { facts, reconciliation, period } = statement;
  const activity = statement.documentKind === 'activity';
  const reconciliationTone = toneForReconciliation({
    ok: reconciliation.ok,
    applicable: reconciliation.applicable !== false,
  });
  const summaryRows: [string, number | null][] = [
    ['Previous balance', facts.previousBalance],
    ['Payments', facts.payments === null ? null : -facts.payments],
    ['Other credits', facts.credits === null ? null : -facts.credits],
    ['Purchases', facts.purchases],
    ['Cash advances', facts.cashAdvances],
    ['Fees', facts.fees],
    ['Interest charged', facts.interestCharged],
    ['New balance', facts.newBalance],
  ];

  return (
    <section className={card} aria-labelledby="statement-summary-heading">
      <h3 id="statement-summary-heading" className="text-base font-semibold text-gray-900">
        Statement summary
      </h3>
      <p className="mt-1 text-sm text-gray-700">
        {statement.issuer === 'generic' ? 'Unrecognized layout' : statement.issuerLabel}
        {statement.accountLastFour ? `, account ending ${statement.accountLastFour}` : ''}
        {period.start && period.end
          ? `, ${formatIsoDate(period.start)} to ${formatIsoDate(period.end)}`
          : period.end
            ? `, closing ${formatIsoDate(period.end)}`
            : ''}
        . Read inside CentenarianOS; the PDF was not sent anywhere else.
      </p>

      {accountMatchesStatement === false && (
        <StatusNotice tone="attention" alert className="mt-3">
          <p>
            The account you chose doesn&apos;t end in {statement.accountLastFour}. Go back and check you picked the
            right one.
          </p>
        </StatusNotice>
      )}

      {statement.warnings.length > 0 && (
        <StatusNotice tone="attention" className="mt-3">
          <p className="font-medium">Check these before you import:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            {statement.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </StatusNotice>
      )}

      {(statement.notes ?? []).length > 0 && (
        <StatusNotice className="mt-3">
          <ul className="list-disc space-y-0.5 pl-5">
            {(statement.notes ?? []).map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </StatusNotice>
      )}

      {activity ? (
        <StatusNotice className="mt-4">
          <p>
            This is a list of transactions printed from the card&apos;s website, not a monthly statement, so it has no
            balances or totals to check the rows against. Each row is still checked against what is already in this
            account.
          </p>
        </StatusNotice>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <dl className="divide-y divide-gray-100 text-sm">
            {summaryRows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-1.5">
                <dt className="text-gray-700">{label}</dt>
                <dd className="font-medium tabular-nums text-gray-900">{money(value)}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-4 py-1.5">
              <dt className="text-gray-700">Minimum payment</dt>
              <dd className="font-medium tabular-nums text-gray-900">{money(facts.minimumPayment)}</dd>
            </div>
            <div className="flex justify-between gap-4 py-1.5">
              <dt className="text-gray-700">Payment due</dt>
              <dd className="font-medium text-gray-900">{facts.dueDate ? formatIsoDate(facts.dueDate) : 'Not shown'}</dd>
            </div>
          </dl>

          <div className="space-y-4">
            {reconciliation.ok ? (
              <p role="status" className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${TONE_CLASSES.success.box}`}>
                <ToneIcon tone="success" className="mt-0.5 h-4 w-4" />
                <span>
                  <span className="font-medium">Adds up.</span> Its totals match its new balance, and the rows found match
                  each total.
                </span>
              </p>
            ) : (
              <div role="alert" className={`rounded-lg border px-3 py-2 text-sm ${TONE_CLASSES[reconciliationTone].box}`}>
                <p className="flex items-start gap-2 font-medium">
                  <ToneIcon tone={reconciliationTone} className="mt-0.5 h-4 w-4" />
                  {reconciliation.checked
                    ? "Needs your attention: the statement doesn't add up."
                    : "Needs your attention: the statement couldn't be checked, because its previous or new balance wasn't found."}
                </p>
                {reconciliation.differences.length > 0 && (
                  <ul className="mt-1 list-disc space-y-0.5 pl-8">
                    {reconciliation.differences.map((difference) => (
                      <li key={difference.check}>
                        {difference.label}: {formatCents(difference.expected)} vs. {formatCents(difference.actual)} (off by{' '}
                        {formatCents(Math.abs(difference.difference))}).
                      </li>
                    ))}
                  </ul>
                )}
                <label htmlFor="import-confirm-unreconciled" className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 font-medium">
                  <input
                    id="import-confirm-unreconciled"
                    type="checkbox"
                    checked={confirmUnreconciled}
                    onChange={(event) => onConfirmUnreconciledChange(event.target.checked)}
                    className="h-5 w-5 accent-sky-700"
                  />
                  Import anyway: I&apos;ve checked the differences
                </label>
              </div>
            )}

            {facts.aprs.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Interest rates (APR)</h4>
                <ul role="list" className="mt-1 divide-y divide-gray-100 text-sm">
                  {facts.aprs.map((apr) => (
                    <li key={`${apr.balanceType}-${apr.apr}`} className="flex justify-between gap-4 py-1.5">
                      <span className="text-gray-700">{apr.balanceType}</span>
                      <span className="font-medium tabular-nums text-gray-900">{apr.apr.toFixed(2)}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-gray-900">Promotional balances</h4>
              {facts.promos.length === 0 ? (
                <p className="mt-1 text-sm text-gray-700">None on this statement.</p>
              ) : (
                <ul role="list" className="mt-1 divide-y divide-gray-100 text-sm">
                  {facts.promos.map((promo, index) => (
                    <li key={`${promo.description}-${index}`} className="py-1.5">
                      <p className="flex justify-between gap-4">
                        <span className="text-gray-800">{promo.description}</span>
                        <span className="font-medium tabular-nums text-gray-900">{formatCents(promo.balance)}</span>
                      </p>
                      <p className="text-gray-700">
                        {promo.expiresOn ? `Expires ${formatIsoDate(promo.expiresOn)}` : 'Expiry date not shown'}
                        {promo.deferredInterest !== undefined && promo.deferredInterest > 0
                          ? `. ${formatCents(promo.deferredInterest)} of deferred interest is charged if it isn't paid off by then.`
                          : '.'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
