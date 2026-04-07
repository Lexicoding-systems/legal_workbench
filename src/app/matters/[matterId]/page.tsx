"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";

/* ── Types ─────────────────────────────────────────────────────────────── */

interface Document {
  id: string;
  filename: string;
  mimeType: string;
  status: "PENDING" | "PROCESSING" | "READY" | "ERROR";
  createdAt: string;
}

interface Matter {
  id: string;
  name: string;
  description: string | null;
  documents: Document[];
}

interface Chunk {
  id: string;
  text: string;
  citationLabel: string;
  pageNumber: number;
  rank: number;
}

interface ChronologyItem {
  date: string;
  event: string;
  sourceChunkIds: string[];
}

interface FactItem {
  statement: string;
  classification: "observation" | "inference" | "allegation";
  sourceChunkIds: string[];
}

interface ComplaintSection {
  heading: string;
  paragraphs: string[];
  sourceChunkIds: string[];
}

type ArtifactTab = "chronology" | "facts" | "complaint";

/* ── Helpers ────────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  PROCESSING: "bg-yellow-100 text-yellow-700",
  READY: "bg-green-100 text-green-700",
  ERROR: "bg-red-100 text-red-600",
};

const CLASSIFICATION_COLORS: Record<string, string> = {
  observation: "bg-blue-50 text-blue-700 border-blue-200",
  inference: "bg-yellow-50 text-yellow-700 border-yellow-200",
  allegation: "bg-orange-50 text-orange-700 border-orange-200",
};

/* ── Component ──────────────────────────────────────────────────────────── */

export default function MatterDetailPage() {
  const { matterId } = useParams<{ matterId: string }>();

  const [matter, setMatter] = useState<Matter | null>(null);
  const [loadingMatter, setLoadingMatter] = useState(true);

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Retrieval
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [chunks, setChunks] = useState<Chunk[] | null>(null);

  // Legal Research (Perplexity)
  const [researchQuery, setResearchQuery] = useState("");
  const [researching, setResearching] = useState(false);
  const [researchResult, setResearchResult] = useState<{
    answer: string;
    citations: string[];
  } | null>(null);
  const [researchError, setResearchError] = useState<string | null>(null);

  // Generation
  const [activeTab, setActiveTab] = useState<ArtifactTab>("chronology");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [chronology, setChronology] = useState<ChronologyItem[] | null>(null);
  const [facts, setFacts] = useState<FactItem[] | null>(null);
  const [complaint, setComplaint] = useState<ComplaintSection[] | null>(null);

  /* ── Data fetching ──────────────────────────────────────────────────── */

  async function fetchMatter() {
    const res = await fetch(`/api/matters/${matterId}`);
    if (!res.ok) return;
    const data = await res.json();
    setMatter(data);
    setLoadingMatter(false);
  }

  useEffect(() => {
    fetchMatter();
  }, [matterId]);

  /* ── Upload ─────────────────────────────────────────────────────────── */

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("matterId", matterId);

      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const doc = await res.json();
      if (!res.ok) throw new Error(doc.error ?? "Upload failed");

      // Auto-process immediately after upload
      setProcessingId(doc.id);
      const processRes = await fetch(`/api/documents/${doc.id}/process`, {
        method: "POST",
      });
      const processData = await processRes.json();
      if (!processRes.ok)
        throw new Error(processData.error ?? "Processing failed");

      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      setProcessingId(null);
      // Always refresh the document list — even on error, so failed/stuck
      // documents are visible and the user knows what happened.
      await fetchMatter();
    }
  }

  /* ── Retrieval ──────────────────────────────────────────────────────── */

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setChunks(null);
    try {
      const res = await fetch("/api/retrieval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), matterId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setChunks(data.chunks);
    } catch (err: any) {
      setChunks([]);
    } finally {
      setSearching(false);
    }
  }

  /* ── Legal Research ─────────────────────────────────────────────────── */

  async function handleResearch(e: React.FormEvent) {
    e.preventDefault();
    if (!researchQuery.trim()) return;
    setResearching(true);
    setResearchResult(null);
    setResearchError(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: researchQuery.trim(),
          matterContext: matter?.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Research failed");
      setResearchResult(data);
    } catch (err: any) {
      setResearchError(err.message);
    } finally {
      setResearching(false);
    }
  }

  /* ── Generation ─────────────────────────────────────────────────────── */

  async function handleGenerate(type: ArtifactTab) {
    setGenerating(true);
    setGenerateError(null);
    setActiveTab(type);

    const endpoint = `/api/generate/${type === "facts" ? "facts" : type}`;

    try {
      const res = await fetch(
        `/api/generate/${type === "chronology" ? "chronology" : type === "facts" ? "facts" : "complaint"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matterId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");

      if (type === "chronology") setChronology(data.items);
      else if (type === "facts") setFacts(data.items);
      else if (type === "complaint") setComplaint(data.sections);
    } catch (err: any) {
      setGenerateError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  /* ── Render ─────────────────────────────────────────────────────────── */

  if (loadingMatter) {
    return <p className="text-gray-500 text-sm">Loading matter…</p>;
  }
  if (!matter) {
    return <p className="text-red-600 text-sm">Matter not found.</p>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <a href="/" className="text-sm text-blue-600 hover:underline">
          ← All matters
        </a>
        <h1 className="text-2xl font-bold mt-2">{matter.name}</h1>
        {matter.description && (
          <p className="text-gray-500 text-sm mt-1">{matter.description}</p>
        )}
      </div>

      {/* ── Documents ─────────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-base font-semibold mb-4">Documents</h2>

        {/* Upload form */}
        <form onSubmit={handleUpload} className="flex gap-3 items-center mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md"
            className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          <button
            type="submit"
            disabled={uploading}
            className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
          >
            {uploading ? "Uploading & parsing…" : "Upload"}
          </button>
        </form>
        {uploadError && (
          <p className="text-red-600 text-sm mb-3">{uploadError}</p>
        )}

        {/* Document list */}
        {matter.documents.length === 0 ? (
          <p className="text-gray-400 text-sm">No documents yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="pb-2 font-medium">Filename</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {matter.documents.map((doc) => (
                <tr key={doc.id} className="border-b border-gray-50">
                  <td className="py-2 text-gray-800 font-mono text-xs">
                    {doc.filename}
                    {processingId === doc.id && (
                      <span className="ml-2 text-yellow-600">processing…</span>
                    )}
                  </td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[doc.status] ?? ""}`}
                    >
                      {doc.status}
                    </span>
                  </td>
                  <td className="py-2 text-gray-400">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Retrieval ─────────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-base font-semibold mb-4">Search Corpus</h2>
        <form onSubmit={handleSearch} className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Search documents…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={searching}
            className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
          >
            {searching ? "Searching…" : "Search"}
          </button>
        </form>

        {chunks !== null && (
          <div>
            {chunks.length === 0 ? (
              <p className="text-gray-400 text-sm">No results found.</p>
            ) : (
              <div className="space-y-3">
                {chunks.map((c) => (
                  <div
                    key={c.id}
                    className="border border-gray-100 rounded p-3 bg-gray-50"
                  >
                    <p className="text-xs text-blue-600 font-mono mb-1">
                      {c.citationLabel}
                    </p>
                    <p className="text-sm text-gray-700">{c.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Legal Research ────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-base font-semibold mb-1">Legal Research</h2>
        <p className="text-xs text-gray-400 mb-4">
          Web-grounded search via Perplexity — case law, statutes, precedents.
        </p>
        <form onSubmit={handleResearch} className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="e.g. wrongful termination retaliation standard of proof"
            value={researchQuery}
            onChange={(e) => setResearchQuery(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit"
            disabled={researching}
            className="bg-green-700 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-800 disabled:opacity-50 flex-shrink-0"
          >
            {researching ? "Searching…" : "Research"}
          </button>
        </form>

        {researchError && (
          <p className="text-red-600 text-sm mb-3">{researchError}</p>
        )}

        {researchResult && (
          <div className="space-y-4">
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {researchResult.answer}
            </div>
            {researchResult.citations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Sources
                </p>
                <ol className="list-decimal list-inside space-y-1">
                  {researchResult.citations.map((url, i) => (
                    <li key={i} className="text-xs">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-all"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Generation ────────────────────────────────────────────────── */}
      <section className="bg-white border border-gray-200 rounded-lg p-5">
        <h2 className="text-base font-semibold mb-4">Generate</h2>

        <div className="flex gap-3 mb-5 flex-wrap">
          <button
            onClick={() => handleGenerate("chronology")}
            disabled={generating}
            className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating && activeTab === "chronology"
              ? "Generating…"
              : "Generate Chronology"}
          </button>
          <button
            onClick={() => handleGenerate("facts")}
            disabled={generating}
            className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating && activeTab === "facts"
              ? "Generating…"
              : "Generate Fact Table"}
          </button>
          <button
            onClick={() => handleGenerate("complaint")}
            disabled={generating}
            className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating && activeTab === "complaint"
              ? "Generating…"
              : "Generate Complaint Skeleton"}
          </button>
        </div>

        {generateError && (
          <p className="text-red-600 text-sm mb-4">{generateError}</p>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {(["chronology", "facts", "complaint"] as ArtifactTab[]).map(
            (tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                  activeTab === tab
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab === "chronology"
                  ? "Chronology"
                  : tab === "facts"
                    ? "Facts"
                    : "Complaint"}
              </button>
            )
          )}
        </div>

        {/* Chronology panel */}
        {activeTab === "chronology" && (
          <div>
            {!chronology ? (
              <p className="text-gray-400 text-sm">
                Click &ldquo;Generate Chronology&rdquo; to extract a timeline.
              </p>
            ) : chronology.length === 0 ? (
              <p className="text-gray-400 text-sm">
                No dated events found in documents.
              </p>
            ) : (
              <div className="space-y-3">
                {chronology.map((item, i) => (
                  <div
                    key={i}
                    className="border border-gray-100 rounded p-3 bg-gray-50"
                  >
                    <p className="text-xs font-semibold text-gray-500 mb-1">
                      {item.date}
                    </p>
                    <p className="text-sm text-gray-800">{item.event}</p>
                    {item.sourceChunkIds.length > 0 && (
                      <p className="text-xs text-blue-600 mt-1 font-mono">
                        Sources: {item.sourceChunkIds.length} chunk
                        {item.sourceChunkIds.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Facts panel */}
        {activeTab === "facts" && (
          <div>
            {!facts ? (
              <p className="text-gray-400 text-sm">
                Click &ldquo;Generate Fact Table&rdquo; to extract material facts.
              </p>
            ) : facts.length === 0 ? (
              <p className="text-gray-400 text-sm">No facts extracted.</p>
            ) : (
              <div className="space-y-2">
                {facts.map((item, i) => (
                  <div
                    key={i}
                    className={`border rounded p-3 ${CLASSIFICATION_COLORS[item.classification] ?? "bg-gray-50"}`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide mr-2">
                      [{item.classification}]
                    </span>
                    <span className="text-sm">{item.statement}</span>
                    {item.sourceChunkIds.length > 0 && (
                      <p className="text-xs opacity-70 mt-1 font-mono">
                        {item.sourceChunkIds.length} source chunk
                        {item.sourceChunkIds.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Complaint panel */}
        {activeTab === "complaint" && (
          <div>
            {!complaint ? (
              <p className="text-gray-400 text-sm">
                Click &ldquo;Generate Complaint Skeleton&rdquo; to draft a complaint.
              </p>
            ) : complaint.length === 0 ? (
              <p className="text-gray-400 text-sm">No sections generated.</p>
            ) : (
              <div className="space-y-5">
                {complaint.map((section, i) => (
                  <div key={i}>
                    <h3 className="font-semibold text-gray-800 mb-2">
                      {section.heading}
                    </h3>
                    {section.paragraphs.map((p, j) => (
                      <p key={j} className="text-sm text-gray-700 mb-2">
                        {p}
                      </p>
                    ))}
                    {section.sourceChunkIds.length > 0 && (
                      <p className="text-xs text-blue-600 font-mono">
                        Sources: {section.sourceChunkIds.length} chunk
                        {section.sourceChunkIds.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
