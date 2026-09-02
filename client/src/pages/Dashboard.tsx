import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

export default function Dashboard() {
  const [summary, setSummary] = useState<any>(null);
  const [costTrend, setCostTrend] = useState<any[]>([]);
  const [byModel, setByModel] = useState<any[]>([]);

  useEffect(() => {
    api.get('/analytics/summary').then(res => setSummary(res.data)).catch(console.error);
    api.get('/analytics/cost-trend?days=30').then(res => setCostTrend(res.data)).catch(console.error);
    api.get('/analytics/by-model').then(res => setByModel(res.data)).catch(console.error);
  }, []);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <nav className="flex gap-4 text-sm text-blue-600">
          <Link to="/keys">API Keys</Link>
          <Link to="/logs">Logs</Link>
          <Link to="/knowledge-bases">Knowledge Bases</Link>
        </nav>
      </div>
      
      {summary && (
        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
          <div className="p-4 border rounded shadow">
            <div className="text-sm text-gray-500">Total Requests</div>
            <div className="text-xl font-bold">{summary.totalRequests}</div>
          </div>
          <div className="p-4 border rounded shadow">
            <div className="text-sm text-gray-500">Total Cost</div>
            <div className="text-xl font-bold">\${summary.totalCost.toFixed(4)}</div>
          </div>
          <div className="p-4 border rounded shadow">
            <div className="text-sm text-gray-500">Tokens Saved</div>
            <div className="text-xl font-bold">{summary.tokensSaved}</div>
          </div>
          <div className="p-4 border rounded shadow">
            <div className="text-sm text-gray-500">Cache Hit Rate</div>
            <div className="text-xl font-bold">{(summary.cacheHitRate * 100).toFixed(2)}%</div>
          </div>
          <div className="p-4 border rounded shadow">
            <div className="text-sm text-gray-500">RAG Requests</div>
            <div className="text-xl font-bold">{summary.ragRequests || 0}</div>
          </div>
          <div className="p-4 border rounded shadow">
            <div className="text-sm text-gray-500">RAG Tokens</div>
            <div className="text-xl font-bold">{summary.ragTokens || 0}</div>
          </div>
          <div className="p-4 border rounded shadow">
            <div className="text-sm text-gray-500">Embedding Cost</div>
            <div className="text-xl font-bold">\${(summary.embeddingCost || 0).toFixed(4)}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-8">
        <div className="border rounded p-4 shadow h-80 flex flex-col justify-between">
          <h2 className="text-lg font-bold mb-4">Cost Trend (Last 30 Days)</h2>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={costTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <RechartsTooltip />
                <Line type="monotone" dataKey="cost" stroke="#8884d8" name="Cost (USD)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="border rounded p-4 shadow h-80 flex flex-col justify-between">
          <h2 className="text-lg font-bold mb-4">Spend by Model</h2>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byModel}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="model" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar dataKey="cost" fill="#82ca9d" name="Cost (USD)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
