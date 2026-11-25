import React, { useCallback, useEffect, useState } from 'react';
import { UploadCloud, FileText, Trash2, RefreshCw, PlusCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import type { KnowledgeDocument } from '../types';
import { Header } from '../components/Header';
import { LoadingState } from '../components/LoadingState';

export const KnowledgeBase: React.FC<{
  onToast: (type: 'success' | 'error' | 'info', msg: string) => void;
}> = ({ onToast }) => {
  const [docs, setDocs] = useState<KnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  const [manualTitle, setManualTitle] = useState('');
  const [manualContent, setManualContent] = useState('');

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listKnowledge();
      setDocs(data);
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to load knowledge documents.');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const created = await api.uploadKnowledgeFile(file);
      onToast('success', `Indexed '${created.original_filename}' (${created.chunk_count} chunks).`);
      await loadDocs();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to upload document.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || manualContent.trim().length < 20) {
      onToast('error', 'Please enter a title and at least 20 characters of knowledge content.');
      return;
    }
    setUploading(true);
    try {
      const created = await api.addKnowledgeText(manualTitle.trim(), manualContent.trim());
      onToast('success', `Added '${created.original_filename}' (${created.chunk_count} chunks).`);
      setManualTitle('');
      setManualContent('');
      await loadDocs();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to add manual knowledge text.');
    } finally {
      setUploading(false);
    }
  };

  const handleReindex = async () => {
    setReindexing(true);
    try {
      const res = await api.reindexKnowledge();
      onToast('success', `Rebuilt FAISS index: ${res.documents_indexed} docs, ${res.total_chunks} chunks.`);
      await loadDocs();
    } catch (err: any) {
      onToast('error', err?.message || 'Reindexing failed.');
    } finally {
      setReindexing(false);
    }
  };

  const handleDelete = async (doc: KnowledgeDocument) => {
    try {
      const res = await api.deleteKnowledge(doc.id);
      onToast('info', res.message);
      await loadDocs();
    } catch (err: any) {
      onToast('error', err?.message || 'Failed to delete document.');
    }
  };

  const totalChunks = docs.reduce((sum, d) => sum + d.chunk_count, 0);

  return (
    <div className="flex flex-1 flex-col">
      <Header
        title="Knowledge Base (RAG)"
        subtitle="Upload PDF, DOCX, or TXT files for SentenceTransformers (all-MiniLM-L6-v2) + FAISS retrieval"
        onRefresh={loadDocs}
        refreshing={loading}
        actions={
          <button
            type="button"
            onClick={handleReindex}
            disabled={reindexing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#16865A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#126E4A] disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${reindexing ? 'animate-spin' : ''}`} />
            <span>{reindexing ? 'Rebuilding Index...' : 'Rebuild Vector Index'}</span>
          </button>
        }
      />

      <main id="main-content" className="flex-1 space-y-6 p-6">
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Upload File Card */}
          <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
            <h2 className="text-sm font-semibold text-[#202923]">Upload Company Document</h2>
            <p className="mt-1 text-xs text-[#78847D]">
              Supported formats: <code>.pdf</code>, <code>.docx</code>, <code>.txt</code> (max 10 MB). Automatically chunked &amp; indexed.
            </p>
            <label
              htmlFor="kb-file-upload"
              className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#BEE6D2] bg-[#FAFAF7] p-8 text-center transition-colors hover:bg-[#DDF2E7]/30"
            >
              <UploadCloud className="h-8 w-8 text-[#16865A]" aria-hidden="true" />
              <span className="mt-2 text-sm font-semibold text-[#202923]">
                {uploading ? 'Extracting & Indexing...' : 'Click to choose PDF, DOCX, or TXT'}
              </span>
              <span className="mt-1 text-xs text-[#78847D]">Text extraction → Cleaning → Chunking → FAISS</span>
              <input
                id="kb-file-upload"
                type="file"
                accept=".pdf,.docx,.txt"
                disabled={uploading}
                onChange={handleFileChange}
                className="visually-hidden"
              />
            </label>
          </div>

          {/* Add Manual Text Card */}
          <form onSubmit={handleManualAdd} className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
            <h2 className="text-sm font-semibold text-[#202923]">Add Knowledge Entry Manually</h2>
            <p className="mt-1 text-xs text-[#78847D]">
              Quickly add product updates, offers, or FAQs directly into the FAISS vector store.
            </p>
            <div className="mt-3 space-y-3">
              <div>
                <label htmlFor="kb-title" className="block text-xs font-medium text-[#78847D]">
                  Document Title
                </label>
                <input
                  id="kb-title"
                  type="text"
                  required
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="e.g. Festival Onboarding Offer"
                  className="mt-1 w-full rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="kb-content" className="block text-xs font-medium text-[#78847D]">
                  Content (min 20 chars)
                </label>
                <textarea
                  id="kb-content"
                  rows={4}
                  required
                  value={manualContent}
                  onChange={(e) => setManualContent(e.target.value)}
                  placeholder="Paste pricing, SLA, or service details..."
                  className="mt-1 w-full rounded-xl border border-[#E7ECE7] bg-[#FAFAF7] px-3 py-2 text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#16865A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#126E4A] disabled:opacity-50"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Add &amp; Index Text</span>
              </button>
            </div>
          </form>
        </div>

        {/* Indexed Documents List */}
        <div className="rounded-2xl border border-[#E7ECE7] bg-white p-5 shadow-2xs">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#202923]">Indexed Knowledge Documents</h2>
              <p className="text-xs text-[#78847D]">
                {docs.length} documents • {totalChunks} total FAISS chunks ready for semantic retrieval
              </p>
            </div>
          </div>

          {loading && docs.length === 0 ? (
            <LoadingState message="Loading knowledge documents..." />
          ) : docs.length === 0 ? (
            <p className="py-8 text-center text-sm text-[#78847D]">
              No knowledge base documents indexed. Upload a document or add text above.
            </p>
          ) : (
            <div tabIndex={0} role="region" aria-label="Knowledge base documents" className="vox-table-wrapper">
              <table className="vox-table vox-table--responsive text-sm">
                <caption className="visually-hidden">Indexed Knowledge Base Documents</caption>
                <thead>
                  <tr className="text-xs font-semibold text-[#78847D]">
                    <th scope="col">Filename</th>
                    <th scope="col">Type</th>
                    <th scope="col">Chunks</th>
                    <th scope="col">Size</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-right">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr key={doc.id}>
                      <th scope="row" className="font-medium text-[#202923]">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-[#16865A]" aria-hidden="true" />
                          <span>{doc.original_filename}</span>
                          {doc.is_sample && (
                            <span className="rounded-md bg-[#F3F6F1] px-1.5 py-0.5 text-[10px] font-semibold text-[#78847D]">
                              Sample Data
                            </span>
                          )}
                        </div>
                      </th>
                      <td data-label="Type" className="text-xs uppercase text-[#4B5850]">
                        {doc.file_type}
                      </td>
                      <td data-label="Chunks" className="text-xs font-semibold text-[#16865A]">
                        {doc.chunk_count} chunks
                      </td>
                      <td data-label="Size" className="text-xs text-[#78847D]">
                        {(doc.file_size_bytes / 1024).toFixed(1)} KB
                      </td>
                      <td data-label="Status">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#DDF2E7] px-2.5 py-0.5 text-xs font-semibold text-[#126E4A]">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          {doc.status}
                        </span>
                      </td>
                      <td data-label="Action" className="text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(doc)}
                          aria-label={`Delete ${doc.original_filename}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#FECACA] px-2.5 py-1 text-xs font-semibold text-[#DC2626] hover:bg-[#FEE2E2]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
