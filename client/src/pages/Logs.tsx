import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function Logs() {
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    api.get('/analytics/logs').then(res => setLogs(res.data)).catch(console.error);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Logs</h1>
      <table className="min-w-full">
        <thead>
          <tr>
            <th>Provider</th>
            <th>Model</th>
            <th>Tokens (In/Out)</th>
            <th>Cost</th>
            <th>Cached</th>
            <th>Latency</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id}>
              <td>{log.provider}</td>
              <td>{log.model}</td>
              <td>{log.inputTokens} / {log.outputTokens}</td>
              <td>${log.costUsd.toFixed(6)}</td>
              <td>{log.cachedHit ? 'Yes' : 'No'}</td>
              <td>{log.latencyMs}ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
