import { useEffect, useState } from 'react';
import { FilePlus, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../lib/api';

interface KnowledgeBase {
  id: string;
  name: string;
  description?: string | null;
  version: number;
  _count?: { documents: number };
}

interface DocumentItem {
  id: string;
  name: string;
  status: string;
  errorMessage?: string | null;
  createdAt: string;
  _count?: { chunks: number };
}

interface SearchResult {
  chunksRetrieved: number;
  chunksUsed: number;
  tokensUsed: number;
  sources: Array<{
    documentId: string;
    documentName: string;
    chunkIndex: number;
    similarity: number;
    page?: number;
  }>;
  context: string;
}

export default function KnowledgeBases() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selected, setSelected] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState('');
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchKnowledgeBases = async () => {
    const { data } = await api.get('/api/knowledge-bases');
    setKnowledgeBases(data);
    if (!selected && data.length > 0) setSelected(data[0]);
  };

  const fetchDocuments = async (knowledgeBaseId: string) => {
    const { data } = await api.get(`/api/knowledge-bases/${knowledgeBaseId}/documents`);
    setDocuments(data);
  };

  useEffect(() => {
    fetchKnowledgeBases().catch(console.error);
  }, []);

  useEffect(() => {
    if (selected) fetchDocuments(selected.id).catch(console.error);
  }, [selected?.id]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const { data } = await api.post('/api/knowledge-bases', { name, description: description || undefined });
    setName('');
    setDescription('');
    await fetchKnowledgeBases();
    setSelected(data);
  };

  const handleUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected || !file) return;
    setLoading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      await api.post(`/api/knowledge-bases/${selected.id}/documents`, body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setFile(null);
      await fetchDocuments(selected.id);
      await fetchKnowledgeBases();
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!selected) return;
    await api.delete(`/api/knowledge-bases/${selected.id}/documents/${documentId}`);
    await fetchDocuments(selected.id);
    await fetchKnowledgeBases();
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const { data } = await api.post(`/api/knowledge-bases/${selected.id}/search`, { query });
    setSearchResult(data);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Knowledge Bases</h1>
        <a className="text-sm text-blue-600" href="/">Dashboard</a>
      </div>

      <form onSubmit={handleCreate} className="grid gap-3 border rounded p-4 shadow">
        <h2 className="text-lg font-bold">Create Knowledge Base</h2>
        <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
          <input className="border p-2" value={name} onChange={event => setName(event.target.value)} placeholder="Name" required />
          <input className="border p-2" value={description} onChange={event => setDescription(event.target.value)} placeholder="Description" />
          <button className="bg-blue-600 text-white px-4 py-2 inline-flex items-center gap-2" type="submit">
            <Plus size={16} /> Create
          </button>
        </div>
      </form>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="border rounded shadow divide-y">
          {knowledgeBases.map(kb => (
            <button
              className={`w-full text-left p-4 ${selected?.id === kb.id ? 'bg-blue-50' : 'bg-white'}`}
              key={kb.id}
              onClick={() => setSelected(kb)}
              type="button"
            >
              <div className="font-semibold">{kb.name}</div>
              <div className="text-sm text-gray-500">v{kb.version} - {kb._count?.documents || 0} documents</div>
            </button>
          ))}
          {knowledgeBases.length === 0 && <div className="p-4 text-sm text-gray-500">No knowledge bases yet.</div>}
        </div>

        {selected && (
          <div className="space-y-6">
            <section className="border rounded p-4 shadow space-y-4">
              <div>
                <h2 className="text-xl font-bold">{selected.name}</h2>
                <div className="text-sm text-gray-500">Version {selected.version}</div>
              </div>

              <form onSubmit={handleUpload} className="flex flex-col gap-3 md:flex-row md:items-center">
                <input
                  className="border p-2 flex-1"
                  type="file"
                  accept=".txt,.md,.json,.csv,.pdf,text/plain,text/markdown,application/json,text/csv,application/pdf"
                  onChange={event => setFile(event.target.files?.[0] || null)}
                />
                <button className="bg-green-600 text-white px-4 py-2 inline-flex items-center justify-center gap-2" disabled={!file || loading} type="submit">
                  <FilePlus size={16} /> {loading ? 'Uploading' : 'Upload'}
                </button>
              </form>

              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Document</th>
                    <th>Status</th>
                    <th>Chunks</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map(document => (
                    <tr className="border-b" key={document.id}>
                      <td className="py-2">
                        <div className="font-medium">{document.name}</div>
                        {document.errorMessage && <div className="text-red-600">{document.errorMessage}</div>}
                      </td>
                      <td>{document.status}</td>
                      <td>{document._count?.chunks || 0}</td>
                      <td className="text-right">
                        <button className="text-red-600 inline-flex items-center gap-1" onClick={() => handleDeleteDocument(document.id)} type="button">
                          <Trash2 size={16} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                  {documents.length === 0 && (
                    <tr>
                      <td className="py-4 text-gray-500" colSpan={4}>No documents indexed.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="border rounded p-4 shadow space-y-4">
              <h2 className="text-lg font-bold">Retrieval Tester</h2>
              <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row">
                <input className="border p-2 flex-1" value={query} onChange={event => setQuery(event.target.value)} placeholder="Question" required />
                <button className="bg-blue-600 text-white px-4 py-2 inline-flex items-center justify-center gap-2" type="submit">
                  <Search size={16} /> Search
                </button>
              </form>

              {searchResult && (
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">
                    Retrieved {searchResult.chunksRetrieved}, used {searchResult.chunksUsed}, {searchResult.tokensUsed} tokens
                  </div>
                  <div className="grid gap-2">
                    {searchResult.sources.map(source => (
                      <div className="border rounded p-3" key={`${source.documentId}-${source.chunkIndex}`}>
                        <div className="font-medium">{source.documentName}</div>
                        <div className="text-sm text-gray-500">
                          Chunk {source.chunkIndex} - Similarity {source.similarity.toFixed(3)}
                          {source.page ? ` - Page ${source.page}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                  <pre className="bg-gray-50 border rounded p-3 whitespace-pre-wrap text-xs max-h-72 overflow-auto">{searchResult.context}</pre>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
