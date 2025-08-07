import { useState } from 'react';

export default function ManualEntry({ onMetrics }) {
  const [rows, setRows] = useState([
    { symbol: '', shares: '', purchasePrice: '', date: '' }
  ]);

  const handleChange = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  const addRow = () => {
    setRows([...rows, { symbol: '', shares: '', purchasePrice: '', date: '' }]);
  };

  const handleSubmit = async () => {
    // convert strings to proper types
    const portfolio = rows.map(r => ({
      symbol: r.symbol,
      shares: Number(r.shares),
      purchasePrice: Number(r.purchasePrice),
      date: r.date
    }));
    // Send portfolio to metrics API
    const res = await fetch('/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolio }),
    });
    const data = await res.json();
    if (!res.ok) {
      // Optionally handle API errors here
      console.error('Metrics API error:', data.error);
      return;
    }
    onMetrics(data);
  };

  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-4 gap-2">
          <input placeholder="Symbol" value={row.symbol} onChange={e => handleChange(i,'symbol',e.target.value)} className="border p-2 rounded" />
          <input placeholder="Shares" type="number" value={row.shares} onChange={e => handleChange(i,'shares',e.target.value)} className="border p-2 rounded" />
          <input placeholder="Price" type="number" value={row.purchasePrice} onChange={e => handleChange(i,'purchasePrice',e.target.value)} className="border p-2 rounded" />
          <input placeholder="Date (YYYY-MM-DD)" value={row.date} onChange={e => handleChange(i,'date',e.target.value)} className="border p-2 rounded" />
        </div>
      ))}
      <button onClick={addRow} className="px-4 py-2 bg-green-200 rounded">Add Row</button>
      <button onClick={handleSubmit} className="px-4 py-2 bg-blue-600 text-white rounded">Upload & Analyze</button>
    </div>
  );
}
