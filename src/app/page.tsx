"use client";

import { useEffect, useState } from "react";

interface Matter {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  _count: { documents: number; artifacts: number };
}

export default function HomePage() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchMatters() {
    const res = await fetch("/api/matters");
    const data = await res.json();
    setMatters(data);
    setLoading(false);
  }

  useEffect(() => {
    fetchMatters();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Failed to create matter");
      }
      setName("");
      setDescription("");
      await fetchMatters();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Matters</h1>

      <form
        onSubmit={handleCreate}
        className="bg-white border border-gray-200 rounded-lg p-5 mb-8"
      >
        <h2 className="text-base font-semibold mb-4">New Matter</h2>
        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Matter name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={creating}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 self-start"
          >
            {creating ? "Creating…" : "Create Matter"}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : matters.length === 0 ? (
        <p className="text-gray-500 text-sm">No matters yet. Create one above.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {matters.map((m) => (
            <a
              key={m.id}
              href={`/matters/${m.id}`}
              className="bg-white border border-gray-200 rounded-lg p-5 hover:border-blue-400 transition-colors block"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{m.name}</p>
                  {m.description && (
                    <p className="text-sm text-gray-500 mt-1">{m.description}</p>
                  )}
                </div>
                <div className="text-right text-xs text-gray-400 ml-4 flex-shrink-0">
                  <p>
                    {m._count.documents} doc
                    {m._count.documents !== 1 ? "s" : ""}
                  </p>
                  <p>
                    {m._count.artifacts} artifact
                    {m._count.artifacts !== 1 ? "s" : ""}
                  </p>
                  <p className="mt-1">
                    {new Date(m.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
