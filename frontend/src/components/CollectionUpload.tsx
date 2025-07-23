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
  const [collectionName, setCollectionName] = useState<string>('My Collection');
  const [description, setDescription] = useState<string>('');
  const [isPublic, setIsPublic] = useState<boolean>(false);
  const [inventoryPolicy, setInventoryPolicy] = useState<'add' | 'replace'>('add');
  const [collectionAction, setCollectionAction] = useState<'new' | 'update'>('new');
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

  const setCollections = useCollectionStore((state) => state.setCollections);
  const refetchCollections = useCallback(async () => {
    try {
      setIsUploading(true);
      setError(null);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/collections`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Failed to fetch collections');
      const data = await res.json();
      setCollections(data.collections || []);
    } catch (err: any) {
      setError(err.message || 'Failed to refresh collections');
    } finally {
      setIsUploading(false);
    }
  }, [accessToken, setCollections]);

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
      setError('No file selected.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', collectionName);
      formData.append('description', description);
      formData.append('isPublic', String(isPublic));
      formData.append('inventoryPolicy', inventoryPolicy);
      formData.append('collectionAction', collectionAction);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${process.env.NEXT_PUBLIC_API_URL}/api/collections/upload`, true);
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);

      xhr.upload.onprogress = function (event) {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setProgress(percent);
          setStatusText(`Uploading... (${percent}%)`);
        }
      };
      xhr.onload = function () {
        if (xhr.status === 200) {
          setProgress(100);
          setStatusText('Upload complete!');
          showToast('Collection uploaded successfully!', 'success');
          const response = JSON.parse(xhr.responseText);
          if (response.cards) {
            setLiveCards(response.cards);
            setParsedPreview(JSON.stringify(response.cards.slice(0, 5), null, 2));
            if (onCollectionUploaded) onCollectionUploaded(response.cards);
            addCollection(response.collection);
            refetchCollections();
          }
          setIsUploading(false);
        } else {
          setError('Failed to upload collection.');
          setIsUploading(false);
        }
      };
      xhr.onerror = function () {
        setError('Failed to upload collection.');
        setIsUploading(false);
        setProgress(0);
        setStatusText('');
      };
      xhr.send(formData);
    } catch (err: any) {
      setError('Failed to upload collection.');
      setIsUploading(false);
      setProgress(0);
      setStatusText('');
    }
  }, [addCollection, onCollectionUploaded, accessToken, showToast, collectionName, description, isPublic, inventoryPolicy, collectionAction, refetchCollections]);

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