import { useState } from 'react';

export default function MetricsDisplay({ shareProfits, portfolio }) {
  // Explicit chronological order for periods
  const horizons = ['1 Week', '1 Month', '6 Months', '1 Year'];
  const [selected, setSelected] = useState(horizons[0]);

  // Symbols list for comparison
  const symbols = Object.keys(shareProfits);
  const [compareA, setCompareA] = useState(symbols[0]);
  const [compareB, setCompareB] = useState(symbols[1] || symbols[0]);

  // Map symbol to its purchase price from portfolio data
  const purchasePrices = portfolio.reduce((acc, item) => {
    acc[item.symbol] = item.purchasePrice;
    return acc;
  }, {});

  // Map symbol to its quantity from portfolio data
  const quantities = portfolio.reduce((acc, item) => {
    acc[item.symbol] = item.shares;
    return acc;
  }, {});

  // Compute top 3 performing shares for the selected period
  const sortedShares = Object.entries(shareProfits)
    .map(([symbol, profits]) => ({
      symbol,
      profit: profits[selected] ?? -Infinity
    }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 3);

  // Toggle for showing comparison section
  const [showCompare, setShowCompare] = useState(false);

  return (
    <div className="mt-6">
      <h2 className="text-2xl font-bold mb-2">Per‐Share Returns</h2>
      <label>
        Period:{' '}
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="border px-2 py-1 rounded"
        >
          {horizons.map(h => (
            <option key={h}>{h}</option>
          ))}
        </select>
      </label>

      <ul className="list-disc ml-6 mt-4 space-y-2">
        {Object.entries(shareProfits).map(([symbol, profits]) => {
          const pct = profits[selected];
          const purchasePrice = purchasePrices[symbol] || 0;
          const qty = quantities[symbol] || 0;
          const currentPrice = pct != null
            ? purchasePrice * (1 + pct / 100)
            : null;
          const profitAmt = currentPrice != null
            ? ((currentPrice - purchasePrice) * qty).toFixed(2)
            : null;

          return (
            <li key={symbol}>
              <strong>{symbol}</strong> (Qty: {qty})<br/>
              Return: {pct != null ? pct + '%' : 'N/A'}<br/>
              Profit: {profitAmt != null ? `$${profitAmt}` : 'N/A'}
            </li>
          );
        })}
      </ul>

      <h3 className="text-xl font-semibold mt-6">Top 3 Performers</h3>
      <ol className="list-decimal ml-6 mt-2 space-y-1">
        {sortedShares.map(({ symbol, profit }) => (
          <li key={symbol}>
            {symbol}: {profit !== -Infinity ? profit + '%' : 'N/A'}
          </li>
        ))}
      </ol>

      <button
        className="mt-6 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        onClick={() => setShowCompare(!showCompare)}
      >
        {showCompare ? 'Hide Comparison' : 'Show Comparison'}
      </button>

      {showCompare && (
        <div className="mt-6">
          <h3 className="text-xl font-semibold mb-2">Compare Two Shares</h3>
          <div className="flex space-x-4 mb-4">
            <div>
              <label className="block">Share A:</label>
              <select
                value={compareA}
                onChange={e => setCompareA(e.target.value)}
                className="border px-2 py-1 rounded"
              >
                {symbols.map(sym => (
                  <option key={sym} value={sym}>{sym}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block">Share B:</label>
              <select
                value={compareB}
                onChange={e => setCompareB(e.target.value)}
                className="border px-2 py-1 rounded"
              >
                {symbols.map(sym => (
                  <option key={sym} value={sym}>{sym}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <h4 className="font-semibold mb-2">{compareA} vs {compareB} ({selected})</h4>
            <ul className="list-disc ml-6 space-y-2">
              <li key={compareA}>
                <strong>{compareA}</strong> (Qty: {quantities[compareA]})
                <br /> Purchase Price: ${purchasePrices[compareA]?.toFixed(2) ?? 'N/A'}
                <br /> Current Price: {shareProfits[compareA][selected] != null
                  ? (purchasePrices[compareA] * (1 + shareProfits[compareA][selected] / 100)).toFixed(2)
                  : 'N/A'}
                <br /> Return: {shareProfits[compareA][selected] != null ? shareProfits[compareA][selected] + '%' : 'N/A'}
                <br /> Profit Amount: {shareProfits[compareA][selected] != null
                  ? `$${(((purchasePrices[compareA] * (1 + shareProfits[compareA][selected] / 100)) - purchasePrices[compareA]) * quantities[compareA]).toFixed(2)}`
                  : 'N/A'}
              </li>
              <li key={compareB}>
                <strong>{compareB}</strong> (Qty: {quantities[compareB]})
                <br /> Purchase Price: ${purchasePrices[compareB]?.toFixed(2) ?? 'N/A'}
                <br /> Current Price: {shareProfits[compareB][selected] != null
                  ? (purchasePrices[compareB] * (1 + shareProfits[compareB][selected] / 100)).toFixed(2)
                  : 'N/A'}
                <br /> Return: {shareProfits[compareB][selected] != null ? shareProfits[compareB][selected] + '%' : 'N/A'}
                <br /> Profit Amount: {shareProfits[compareB][selected] != null
                  ? `$${(((purchasePrices[compareB] * (1 + shareProfits[compareB][selected] / 100)) - purchasePrices[compareB]) * quantities[compareB]).toFixed(2)}`
                  : 'N/A'}
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}