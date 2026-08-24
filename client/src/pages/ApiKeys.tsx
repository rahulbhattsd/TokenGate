import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function ApiKeys() {
  const [keys, setKeys] = useState<any[]>([]);
  const [label, setLabel] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    const { data } = await api.get('/keys');
    setKeys(data);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data } = await api.post('/keys', { label });
    setNewKey(data.key);
    fetchKeys();
    setLabel('');
  };

  const handleRevoke = async (id: string) => {
    await api.delete(`/keys/${id}`);
    fetchKeys();
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Keys</h1>
      <form onSubmit={handleCreate} className="mb-4">
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label" required className="border p-2 mr-2" />
        <button type="submit" className="bg-blue-500 text-white p-2">Create Key</button>
      </form>
      {newKey && <div className="mb-4 text-green-600">New Key (copy it now!): {newKey}</div>}
      <ul>
        {keys.map(k => (
          <li key={k.id} className="mb-2">
            {k.label} - {k.revoked ? 'Revoked' : 'Active'}
            {!k.revoked && <button onClick={() => handleRevoke(k.id)} className="ml-2 text-red-500">Revoke</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
