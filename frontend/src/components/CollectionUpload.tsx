'use client';

import { useState, useCallback, useEffect } from 'react';
// Hydration-safe Zustand hook
function useHasHydrated() {
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => {
    setHasHydrated(true);
  }, []);
  return hasHydrated;
}
import { useDropzone } from 'react-dropzone';
import type { MTGCard } from '@/types';
import { ApiClient } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useCollectionStore } from '@/store/collectionStore';

interface CollectionUploadProps {
  onCollectionUploaded?: (data: MTGCard[]) => void;
}


export default function CollectionUpload({ onCollectionUploaded }: CollectionUploadProps) {
  const hasHydrated = useHasHydrated();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const addCollection = useCollectionStore((state) => state.addCollection);

  // Debug: log token and user info
  useEffect(() => {
    console.debug('CollectionUpload: token', token);
    console.debug('CollectionUpload: user', user);
    console.debug('CollectionUpload: isAuthenticated', isAuthenticated);
    if (typeof window !== 'undefined') {
      console.debug('auth-storage in localStorage:', localStorage.getItem('auth-storage'));
    }
  }, [token, user, isAuthenticated]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    setError(null);
    const file = acceptedFiles[0];

    // Check token validity before upload
    if (!token) {
      setError('You must be logged in to upload a collection. No token found.');
      setIsUploading(false);
      return;
    }

    // Optionally, check token validity with backend
    try {
      await checkAuth();
      if (!useAuthStore.getState().isAuthenticated) {
        setError('Session expired or invalid. Please log in again.');
        setIsUploading(false);
        return;
      }
    } catch (e) {
      setError('Session expired or invalid. Please log in again.');
      setIsUploading(false);
      return;
    }

    try {
      const apiClient = new ApiClient(token);
      // Parse the collection file
      const parsed = await apiClient.parseCollection(file);
      // ...existing code for handling parsed collection...
      if (parsed && typeof parsed === 'object' && 'success' in parsed && parsed.success && 'collection' in parsed) {
        const collectionObj = (parsed as { collection: unknown }).collection;
        // Type guard for collectionObj
        if (collectionObj && typeof collectionObj === 'object' && 'cards' in collectionObj && Array.isArray((collectionObj as { cards: unknown }).cards)) {
          const cards = (collectionObj as { cards: MTGCard[] }).cards;
          const name = (collectionObj as { name?: string }).name || 'My Collection';
          const description = (collectionObj as { description?: string }).description || '';
          // Save the collection to backend
          const saveResult = await apiClient.saveCollection({
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
          // Fallback: treat as array of cards
          const cards = collectionObj as MTGCard[];
          const name = 'My Collection';
          const description = '';
          const saveResult = await apiClient.saveCollection({
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
          setError('Parsed collection format is invalid.');
        }
      } else if (parsed && typeof parsed === 'object' && 'error' in parsed) {
        setError((parsed as { error?: string }).error || 'Failed to parse collection');
      } else {
        setError('Failed to parse collection');
      }
    } catch {
      setError('Failed to upload collection. Make sure the backend is running.');
    } finally {
      setIsUploading(false);
    }
  }, [token, addCollection, onCollectionUploaded, checkAuth]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls', '.xlsx'],
    },
    multiple: false,
  });

  if (!hasHydrated) {
    return <div className="text-center text-slate-400 py-12">Loading authentication state...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-300
          ${isDragActive 
            ? 'border-amber-400 bg-amber-400/10' 
            : 'border-slate-600 hover:border-amber-400/50 bg-slate-800/30'
          }
          ${isUploading ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        <div className="space-y-6">
          {/* Upload Icon */}
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <svg className="w-10 h-10 text-slate-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          {/* Text */}
          <div>
            <h3 className="text-2xl font-bold text-white mb-2">
              {isUploading ? 'Parsing Collection...' : 'Upload Your Collection'}
            </h3>
            <p className="text-slate-300 mb-4">
              {isDragActive 
                ? 'Drop your CSV file here...'
                : 'Drag & drop your collection CSV file here, or click to browse'
              }
            </p>
            <p className="text-sm text-slate-400">
              Supports ManaBox, Moxfield, and other CSV formats
            </p>
          </div>

          {/* Real Collection Button */}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              setIsUploading(true);
              setError(null);
              try {
                const apiClient = new ApiClient(token || undefined);
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
              } finally {
                setIsUploading(false);
              }
            }}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors font-semibold"
          >
            Load Sample Collection (or your uploaded collection)
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-900/50 border border-red-500 rounded-lg">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
        <h4 className="text-lg font-semibold text-amber-400 mb-3">Supported Formats</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
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

