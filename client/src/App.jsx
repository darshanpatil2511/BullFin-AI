import Navbar from './components/Navbar.jsx';
import PortfolioUpload from './components/PortfolioUpload.jsx';
import ManualEntry from './components/ManualEntry.jsx';
import { useState } from 'react';
import MetricsDisplay from './components/MetricsDisplay.jsx';

function App() {
  const [metrics, setMetrics] = useState(null);
  const [mode, setMode] = useState(''); // '' indicates no selection
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="p-8">
        <h1 className="text-4xl font-extrabold mb-4">
          Welcome to BullFin.AI
        </h1>
        <label className="mb-4 block">
          Mode:{' '}
          <select
            value={mode}
            onChange={e => {
              setMode(e.target.value);
              setMetrics(null);
            }}
            className="border px-4 py-2 rounded"
          >
            <option value="" disabled>
              Select mode
            </option>
            <option value="csv">Upload CSV</option>
            <option value="manual">Manual Entry</option>
          </select>
        </label>
        {mode === 'csv' && <PortfolioUpload onMetrics={setMetrics} />}
        {mode === 'manual' && <ManualEntry onMetrics={setMetrics} />}
        {metrics && (
          <div className="mt-6">
            <h2 className="text-2xl font-bold mb-2">
              {mode === 'csv' ? 'Portfolio Results' : 'Manual Entry Results'}
            </h2>
            <ul className="list-disc ml-6 space-y-1">
              <li>CAGR: {metrics.CAGR}</li>
              <li>Volatility: {metrics.Volatility}</li>
              <li>Sharpe Ratio: {metrics.Sharpe}</li>
              <li>Beta: {metrics.Beta ?? 'N/A'}</li>
            </ul>
            {/* Per-share returns dropdown and list */}
            <MetricsDisplay shareProfits={metrics.ShareProfits} portfolio={metrics.portfolio} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;