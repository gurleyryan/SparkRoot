import { useToast } from './ToastProvider';
import { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import type { MTGCard, Collection } from '@/types';
import { ApiClient } from '@/lib/api';
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
  const showToast = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // 0-100
  const [statusText, setStatusText] = useState<string>('');
  const [parsedPreview, setParsedPreview] = useState<string>('');
  const hasHydrated = useHasHydrated();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const addCollection = useCollectionStore((state) => state.addCollection);

  // Debug: log token and user info
  useEffect(() => {
    console.debug('CollectionUpload: user', user);
    console.debug('CollectionUpload: isAuthenticated', isAuthenticated);
    if (typeof window !== 'undefined') {
      console.debug('auth-storage in localStorage:', localStorage.getItem('auth-storage'));
    }
  }, [user, isAuthenticated]);

  // SSE upload with live progress and preview
  const eventSourceRef = useRef<EventSource | null>(null);
  const [liveCards, setLiveCards] = useState<MTGCard[]>([]);
  const [livePreview, setLivePreview] = useState<any>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    setError(null);
    setProgress(5);
    setStatusText('Reading file...');
    setParsedPreview('');
    setLiveCards([]);
    setLivePreview(null);
    const file = acceptedFiles[0];
    if (!file) {
      setIsUploading(false);
      setProgress(0);
      setStatusText('');
      setError('No file selected.');
      return;
    }
    try {
      // Read file as text
      const text = await file.text();
      setProgress(20);
      setStatusText('Parsing CSV...');
      setParsedPreview(text.split('\n').slice(0, 3).join('\n'));
      setProgress(30);
      setStatusText('Uploading to server (streaming)...');

      // Prepare a FormData for file upload (SSE endpoint expects file upload)
      const formData = new FormData();
      formData.append('file', new Blob([text], { type: 'text/csv' }), file.name);

      // Use fetch to POST the file, then open EventSource to /api/collections/progress-upload
      // We'll use a custom EventSource polyfill for POST if needed, but for now, use a two-step: upload file to temp, then stream progress
      // For simplicity, we POST the file to /api/collections/progress-upload and listen for SSE events

      // Use XMLHttpRequest to POST and get the SSE stream
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/collections/progress-upload', true);
      if (accessToken) {
        xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      }
      xhr.responseType = 'text';

      let received = '';
      let cards: MTGCard[] = [];
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 3 || xhr.readyState === 4) {
          // Parse SSE events from responseText
          const chunk = xhr.responseText.substring(received.length);
          received = xhr.responseText;
          const events = chunk.split(/\n\n/).filter(Boolean);
          for (const event of events) {
            const lines = event.split('\n');
            let dataLine = lines.find(l => l.startsWith('data:'));
            if (dataLine) {
              try {
                const payload = JSON.parse(dataLine.replace('data:', '').trim());
                if (payload.progress) {
                  setProgress(Math.round(payload.progress * 100));
                  setStatusText(payload.status || 'Processing...');
                }
                if (payload.card) {
                  cards.push(payload.card);
                  setLiveCards([...cards]);
                  setLivePreview(payload.card);
                }
                if (payload.done) {
                  setProgress(100);
                  setStatusText('Collection uploaded and enriched!');
                  addCollection({
                    id: payload.collection_id || '',
                    user_id: '', // or payload.user_id if available
                    name: payload.collection_name || file.name,
                    description: '', // or payload.description if available
                    cards,
                    created_at: '',
                    updated_at: '',
                  });
                  if (onCollectionUploaded) onCollectionUploaded(cards);
                  showToast('Collection uploaded successfully!', 'success');
                  setIsUploading(false);
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      };
      xhr.onerror = function () {
        setError('Failed to upload collection (streaming).');
        setIsUploading(false);
        setProgress(0);
        setStatusText('');
      };
      xhr.send(formData);
    } catch (err: any) {
      setProgress(0);
      setStatusText('');
      setError('Failed to upload collection. Make sure the backend is running.');
      showToast('Failed to upload collection. Make sure the backend is running.', 'error');
      setIsUploading(false);
    }
  }, [addCollection, onCollectionUploaded, accessToken, showToast]);

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
    <div className="max-w-4xl mx-auto">
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
                  <div>Name: {livePreview.name || livePreview.original_name}</div>
                  <div>Set: {livePreview.set_code}</div>
                  <div>Quantity: {livePreview.quantity}</div>
                  {livePreview.image_uris && livePreview.image_uris.normal && (
                    <img src={livePreview.image_uris.normal} alt={livePreview.name} className="mt-1 max-h-32" />
                  )}
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

          {/* Real Collection Button */}
          <button
            onClick={async () => {
              setIsUploading(true);
              setError(null);
              setProgress(10);
              setStatusText('Loading sample collection...');
              try {
                const apiClient = new ApiClient();
                const result = await apiClient.loadSampleCollection();
                setProgress(40);
                setStatusText('Saving sample collection...');
                if (result && typeof result === 'object' && 'success' in result && result.success && 'collection' in result) {
                  const collectionObj = (result as { collection: unknown }).collection;
                  if (collectionObj && typeof collectionObj === 'object' && 'cards' in collectionObj && Array.isArray((collectionObj as { cards: unknown }).cards)) {
                    const cards = (collectionObj as { cards: MTGCard[] }).cards;
                    const name = (collectionObj as { name?: string }).name || 'Sample Collection';
                    const description = (collectionObj as { description?: string }).description || '';
                    const saveResult = await apiClient.saveCollection({
                      name,
                      description,
                      collection_data: cards,
                      is_public: false,
                    });
                    setProgress(80);
                    setStatusText('Finalizing...');
                    if (saveResult && typeof saveResult === 'object' && 'id' in saveResult) {
                      addCollection({
                        id: String((saveResult as { id: string }).id),
                        user_id: '',
                        name,
                        description,
                        cards,
                        created_at: '',
                        updated_at: '',
                      });
                    }
                    if (typeof onCollectionUploaded === 'function') {
                      onCollectionUploaded(cards);
                    }
                  } else if (Array.isArray(collectionObj)) {
                    const cards = collectionObj as MTGCard[];
                    const name = 'Sample Collection';
                    const description = '';
                    const saveResult = await apiClient.saveCollection({
                      name,
                      description,
                      collection_data: cards,
                      is_public: false,
                    });
                    setProgress(80);
                    setStatusText('Finalizing...');
                    if (saveResult && typeof saveResult === 'object' && 'id' in saveResult) {
                      addCollection({
                        id: String((saveResult as { id: string }).id),
                        user_id: '',
                        name,
                        description,
                        cards,
                        created_at: '',
                        updated_at: '',
                      });
                    }
                    if (typeof onCollectionUploaded === 'function') {
                      onCollectionUploaded(cards);
                    }
                  } else {
                    setError('Sample collection format is invalid.');
                  }
                } else if (result && typeof result === 'object' && 'error' in result) {
                  setError((result as { error?: string }).error || 'Failed to load collection');
                } else {
                  setError('Failed to load collection');
                }
                setProgress(100);
                setStatusText('Sample collection loaded!');
              } catch {
                setProgress(0);
                setStatusText('');
                setError('Failed to load collection. Make sure the backend is running.');
                showToast('Failed to load collection. Make sure the backend is running.', 'error');
              } finally {
                setIsUploading(false);
              }
            }}
            className="px-6 py-2 bg-rarity-mythic hover:bg-rarity-rare text-white rounded-lg transition-colors font-semibold"
          >
            Load Sample Collection (or your uploaded collection)
          </button>
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