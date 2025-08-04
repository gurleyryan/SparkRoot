import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import type { MTGCard } from '@/types';
import { useAuthStore } from '../store/authStore';
import { useCollectionStore } from '@/store/collectionStore';

// Hydration-safe Zustand hook
function useHasHydrated() {
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => {
    setHasHydrated(true);
  }, []);
  return hasHydrated;
}

interface CollectionUploadProps {
  onCollectionUploaded?: (data: MTGCard[]) => void;
}

export default function CollectionUpload({ onCollectionUploaded }: CollectionUploadProps) {
  // AbortController for fetches/SSE
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Listen for global logout event to abort fetches/SSE
  React.useEffect(() => {
    function handleLogoutEvent() {
      // Abort any ongoing fetches/SSE
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // If you use EventSource, close it here (add ref if needed)
    }
    window.addEventListener('app-logout', handleLogoutEvent);
    return () => {
      window.removeEventListener('app-logout', handleLogoutEvent);
    };
  }, []);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // 0-100
  const [statusText, setStatusText] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<string>('');
  const [collectionName, setCollectionName] = useState<string>('My Collection');
  const [description, setDescription] = useState<string>('');
  const [isPublic, setIsPublic] = useState<boolean>(false);
  const [inventoryPolicy, setInventoryPolicy] = useState<'add' | 'replace'>('add');
  const [collectionAction, setCollectionAction] = useState<'new' | 'update'>('new');
  const { collections } = useCollectionStore();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const hasHydrated = useHasHydrated();
  const accessToken = useAuthStore((state) => state.accessToken);

  // SSE upload with live progress and preview
  const [liveCards, setLiveCards] = useState<MTGCard[]>([]);
  const [livePreview, setLivePreview] = useState<Partial<MTGCard> | null>(null);

  const setCollections = useCollectionStore((state) => state.setCollections);
  const fetchWithAuth = useAuthStore((s) => s.fetchWithAuth);

  const refetchCollections = useCallback(async () => {
    try {
      setIsUploading(true);
      setError(null);
      const res = await fetchWithAuth('/api/collections');
      if (!res.ok) {
        // If 401, fetchWithAuth will sync token and set error in Zustand
        throw new Error('Session expired, please log in again.');
      }
      const data = await res.json();
      setCollections(data.collections || []);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to refresh collections');
      }
    } finally {
      setIsUploading(false);
    }
  }, [fetchWithAuth, setCollections]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    // Create new AbortController for this upload
    abortControllerRef.current = new AbortController();
    setIsUploading(true);
    setError(null);
    setProgress(0);
    setStatusText('Uploading...');
    setParsedPreview('');
    setLiveCards([]);
    setLivePreview(null);
    const file = acceptedFiles[0];
    if (!file) {
      setIsUploading(false);
      setProgress(0);
      setError('No file selected.');
      return;
    }
    try {
      // Prepare form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', collectionName);
      formData.append('description', description);
      formData.append('isPublic', String(isPublic));
      formData.append('inventoryPolicy', inventoryPolicy);
      formData.append('collectionAction', collectionAction);
      if (collectionAction === 'update' && selectedCollectionId) {
        formData.append('collectionId', selectedCollectionId);
      }

      // Send file via fetch to get a temporary upload URL
      const uploadUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/collections/progress-upload`;
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      if (!response.body) {
        setError('No response body from server.');
        setIsUploading(false);
        return;
      }

      // Use EventSource polyfill for SSE (fetch streaming)
      const reader = response.body.getReader();
      let received = '';
      let done = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (value) {
          received += new TextDecoder().decode(value);
          // Split by SSE event
          const events = received.split(/\n\n/);
          for (let i = 0; i < events.length - 1; i++) {
            const event = events[i];
            if (event && typeof event === 'string' && event.includes('event: progress')) {
              const dataMatch = event.match(/data: (.*)/);
              if (dataMatch) {
                try {
                  const data = JSON.parse(dataMatch[1]);
                  setProgress(data.percent ?? 0);
                  setStatusText(data.status ?? '');
                  if (data.card) {
                    setLivePreview(data.card);
                    setLiveCards(prev => [...prev, data.card]);
                  }
                  if (data.preview) {
                    setParsedPreview(data.preview);
                  }
                } catch {
                  // Intentionally ignore JSON parse errors for SSE progress events
                }
              }
            } else if (event && typeof event === 'string' && event.includes('event: done')) {
              const dataMatch = event.match(/data: (.*)/);
              if (dataMatch) {
                try {
                  const data = JSON.parse(dataMatch[1]);
                  setProgress(100);
                  setStatusText('Upload complete!');
                  if (data.cards) {
                    setLiveCards(data.cards);
                  }
                  if (onCollectionUploaded) {
                    onCollectionUploaded(data.cards ?? []);
                  }
                } catch {
                  // Intentionally ignore JSON parse errors for SSE progress events
                }
              }
            } else if (event && typeof event === 'string' && event.includes('event: error')) {
              const dataMatch = event.match(/data: (.*)/);
              if (dataMatch) {
                try {
                  const data = JSON.parse(dataMatch[1]);
                  setError(data.error || 'Upload error');
                  setStatusText('Error during upload');
                } catch {
                  // Intentionally ignore JSON parse errors for SSE progress events
                }
              }
            }
          }
          received = events[events.length - 1];
        }
        done = streamDone;
      }
      setIsUploading(false);
      refetchCollections();
    } catch {
      setError('Failed to upload collection.');
      setIsUploading(false);
      setProgress(0);
      setStatusText('');
    }
  }, [onCollectionUploaded, accessToken, collectionName, description, isPublic, inventoryPolicy, collectionAction, selectedCollectionId, refetchCollections]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls', '.xlsx'],
    },
  });

  if (!hasHydrated) {
    return <div className="text-center text-mtg-white py-12">Loading authentication state...</div>;
  }

  return (
    <div className="sleeve-morphism max-w-4xl mx-auto p-6" style={{ backgroundColor: "rgba(var(--color-mtg-black-rgb, 21,11,0),0.72)" }}>
      {/* Collection Name */}
      <div className="mb-4">
        <label className="block font-semibold mb-1">Collection Name</label>
        <input
          type="text"
          className="input input-bordered w-full"
          value={collectionName}
          onChange={e => setCollectionName(e.target.value)}
          disabled={isUploading}
        />
      </div>
      {/* Description */}
      <div className="mb-4">
        <label className="block font-semibold mb-1">Description</label>
        <textarea
          className="textarea textarea-bordered w-full"
          value={description}
          onChange={e => setDescription(e.target.value)}
          disabled={isUploading}
        />
      </div>
      {/* Visibility */}
      <div className="mb-4 flex items-center gap-4">
        <label className="font-semibold">Visibility:</label>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={isPublic}
            onChange={e => setIsPublic(e.target.checked)}
            disabled={isUploading}
          />
          <span>Public</span>
        </label>
      </div>
      {/* Inventory Policy & Collection Action */}
      <div className="mb-4 flex flex-wrap gap-4">
        <div>
          <label className="font-semibold">Inventory Policy:</label>
          <select
            className="select select-bordered ml-2"
            value={inventoryPolicy}
            onChange={e => setInventoryPolicy(e.target.value as 'add' | 'replace')}
            disabled={isUploading}
          >
            <option value="add">Add (merge quantities)</option>
            <option value="replace">Replace (overwrite quantities)</option>
          </select>
        </div>
        <div>
          <label className="font-semibold">Collection Action:</label>
          <select
            className="select select-bordered ml-2"
            value={collectionAction}
            onChange={e => setCollectionAction(e.target.value as 'new' | 'update')}
            disabled={isUploading}
          >
            <option value="new">New Collection</option>
            <option value="update">Update Existing</option>
          </select>
        </div>
        {collectionAction === 'update' && (
          <div>
            <label className="font-semibold">Select Collection to Update:</label>
            <select
              className="select select-bordered ml-2"
              value={selectedCollectionId}
              onChange={e => setSelectedCollectionId(e.target.value)}
              disabled={isUploading}
            >
              <option value="">-- Select --</option>
              {collections.map(col => (
                <option key={col.id} value={col.id}>{col.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
      {/* Dropzone and Progress */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300
          ${isDragActive
            ? 'border-rarity-mythic bg-rarity-mythic/10'
            : 'border-rarity-uncommon hover:border-rarity-mythic/50 bg-mtg-black/30'
          }
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-6">
          {/* Upload Icon */}
          <div className="mx-auto w-20 h-20 rounded-full bg-rarity-mythic flex items-center justify-center">
            <svg className="w-10 h-10 text-rarity-common" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          {/* Progress Bar and Status */}
          {isUploading && (
            <div className="w-full mx-auto">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden mb-2">
                <div
                  className="h-2 bg-rarity-mythic transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="text-sm text-rarity-rare mb-2">{statusText}</div>
              {parsedPreview && (
                <pre className="bg-mtg-black/60 text-xs text-left p-2 rounded mb-2 max-h-24 overflow-auto border border-rarity-uncommon">
                  {parsedPreview}
                </pre>
              )}
              {/* Live card preview */}
              {livePreview && (
                <div className="mt-2 p-2 bg-mtg-black/40 border border-rarity-mythic rounded text-xs text-left">
                  <div className="font-bold text-rarity-mythic">Card Preview:</div>
                  <div>Name: {livePreview.name}</div>
                  <div>Set: {livePreview.set}</div>
                  <div>Quantity: {livePreview.quantity}</div>
                  {livePreview.image_uris && livePreview.image_uris.normal && (
                    <img src={livePreview.image_uris.normal} alt={livePreview.name} className="mt-1 max-h-32" />
                  )}
                </div>
              )}
              {/* Card image stack */}
              {livePreview && (
                <div className="mt-4 flex flex-row items-end justify-center relative" style={{ minHeight: '120px' }}>
                  {/* Stack previous cards behind */}
                  {livePreview && livePreview.image_uris && livePreview.image_uris.normal && (
                    <img
                      src={livePreview.image_uris.normal}
                      alt={livePreview.name}
                      className="relative z-10 shadow-lg rounded-lg"
                      style={{
                        position: 'absolute',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        bottom: 0,
                        maxHeight: '120px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                      }}
                    />
                  )}
                  {liveCards && liveCards.slice(-7, -1).map((card, idx) => (
                    card.image_uris && card.image_uris.normal ? (
                      <img
                        key={idx}
                        src={card.image_uris.normal}
                        alt={card.name}
                        className="absolute shadow-md rounded-lg"
                        style={{
                          left: `calc(50% + ${(idx - 3) * 18}px)`,
                          transform: 'translateX(-50%)',
                          bottom: `${(idx + 1) * 8}px`,
                          opacity: 0.7 - idx * 0.07,
                          zIndex: idx,
                          maxHeight: '110px',
                          filter: 'blur(0.5px)',
                        }}
                      />
                    ) : null
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Text */}
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">
              {isUploading ? 'Parsing Collection...' : 'Upload Your Collection'}
            </h3>
            <p className="text-rarity-rare mb-4">
              {isDragActive
                ? 'Drop your CSV file here...'
                : 'Drag & drop your collection CSV file here, or click to browse'
              }
            </p>
            <p className="text-sm text-rarity-uncommon">
              Supports ManaBox, Moxfield, and other CSV formats
            </p>
          </div>
        </div>
      </div>
      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-mtg-red/50 border border-mtg-red rounded-lg">
          <p className="text-mtg-red">{error}</p>
        </div>
      )}
      {/* Instructions */}
      <div className="mt-8 backdrop-blur-sm rounded-xl p-6">
        <h4 className="text-lg font-semibold text-rarity-rare mb-3">Supported Formats</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-rarity-uncommon">
          <div>
            <h5 className="font-medium text-white mb-2">ManaBox Export</h5>
            <p>Export your collection as CSV from ManaBox mobile app</p>
          </div>
          <div>
            <h5 className="font-medium text-white mb-2">Moxfield Collection</h5>
            <p>Download collection CSV from your Moxfield account</p>
          </div>
        </div>
      </div>
    </div>
  );
}