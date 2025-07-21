import { useToast } from './ToastProvider';
import { useState, useCallback, useEffect } from 'react';
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
  const hasHydrated = useHasHydrated();
  // Removed: token (secure session via cookie)
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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    setError(null);
    const file = acceptedFiles[0];
    if (!file) {
      setIsUploading(false);
      setError('No file selected.');
      return;
    }
    try {
      // Read file as text
      const text = await file.text();
      // Prepare payload (adjust as needed for your API)
      const payload = { csv: text };
      // Use ApiClient with Bearer token
      const api = new ApiClient(accessToken || undefined);
      const data = await api["request"]("/api/collections", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
      });
      // Add to collection store and callback
      // Type guard to ensure data is a Collection
      if (
        data &&
        typeof data === 'object' &&
        'id' in data &&
        'name' in data &&
        'cards' in data &&
        Array.isArray((data as any).cards)
      ) {
        addCollection(data as Collection);
        if (onCollectionUploaded) onCollectionUploaded((data as any).cards || []);
        showToast('Collection uploaded successfully!', 'success');
      } else {
        setError('Invalid collection data returned from server.');
        showToast('Invalid collection data returned from server.', 'error');
      }
    } catch (err: any) {
      // Try to extract backend error message if available
      let errorMessage = 'Failed to upload collection. Make sure the backend is running.';
      if (err) {
        // If error is a Response object (fetch error)
        if (err instanceof Response) {
          try {
            const data = await err.json();
            if (data && typeof data === 'object' && 'error' in data) {
              errorMessage = data.error || errorMessage;
            } else if (data && typeof data === 'string') {
              errorMessage = data;
            }
          } catch { }
        } else if (typeof err === 'object' && err !== null) {
          if ('error' in err && typeof err.error === 'string') {
            errorMessage = err.error;
          } else if ('message' in err && typeof err.message === 'string') {
            errorMessage = err.message;
          }
        } else if (typeof err === 'string') {
          errorMessage = err;
        }
      }
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setIsUploading(false);
      if (!error && !setError) {
        showToast('Collection uploaded successfully!', 'success');
      }
    }
  }, [addCollection, onCollectionUploaded, checkAuth, accessToken, showToast]);

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
              try {
                const apiClient = new ApiClient();
                const result = await apiClient.loadSampleCollection();
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
              } catch {
                setError('Failed to load collection. Make sure the backend is running.');
                showToast('Failed to load collection. Make sure the backend is running.', 'error');
              } finally {
                setIsUploading(false);
                if (!error && !setError) {
                  showToast('Sample collection loaded!', 'success');
                }
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