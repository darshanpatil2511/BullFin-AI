import { useState } from 'react';

export default function PortfolioUpload({ onMetrics }) {
  const [file, setFile]         = useState(null);
  const [error, setError]       = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async () => {
    if (!file) return;
    setError(null);
    setUploading(true);

    // 1) Upload the CSV
    const formData = new FormData();
    formData.append('file', file);
    const uploadRes = await fetch('/api/upload-portfolio', {
      method: 'POST',
      body: formData,
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) {
      setError(uploadData.error || 'Upload failed');
      setUploading(false);
      return;
    }

    // 2) Fetch metrics
    const portfolio = uploadData.data;
    const metricsRes = await fetch('/api/metrics', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ portfolio }),
    });
    const metricsData = await metricsRes.json();
    if (!metricsRes.ok) {
      setError(metricsData.error || 'Metrics calculation failed');
      setUploading(false);
      return;
    }
    setUploading(false);
    onMetrics(metricsData);
  };

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept=".csv"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button
        onClick={handleSubmit}
        disabled={!file || uploading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {uploading ? 'Processing…' : 'Upload & Analyze'}
      </button>
      {error && <p className="text-red-600">{error}</p>}
    </div>
  );
}