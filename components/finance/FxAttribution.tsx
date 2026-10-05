// components/finance/FxAttribution.tsx
// Credit line shown wherever fetched exchange rates appear.
//
// ExchangeRate-API's open access terms require the link "Rates By Exchange Rate API" to
// https://www.exchangerate-api.com on pages that use its rates
// (https://www.exchangerate-api.com/docs/free). Frankfurter needs no credit, but saying the
// rates are ECB reference rates tells the user what they are looking at. Both say rates are for
// reference: the rate a booth or ATM gives is different, which is what manual rates are for.

interface FxAttributionProps {
  className?: string;
}

export default function FxAttribution({ className = '' }: FxAttributionProps) {
  return (
    <p className={`text-xs text-gray-500 ${className}`}>
      Reference rates: European Central Bank via{' '}
      <a href="https://frankfurter.dev" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-700">
        Frankfurter
      </a>
      {' · '}
      <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-gray-700">
        Rates By Exchange Rate API
      </a>
      . Your rate at a booth or ATM will differ; enter it as your own rate.
    </p>
  );
}
