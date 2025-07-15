'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import type { MTGCard } from '@/types';

interface CollectionUploadProps {
  onCollectionUploaded: (data: MTGCard[]) => void;
}

export default function CollectionUpload({ onCollectionUploaded }: CollectionUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/api/parse-collection', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        onCollectionUploaded(result);
      } else {
        setError(result.error || 'Failed to parse collection');
      }
    } catch {
      setError('Failed to upload collection. Make sure the backend is running.');
    } finally {
      setIsUploading(false);
    }
  }, [onCollectionUploaded]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls', '.xlsx'],
    },
    multiple: false,
  });

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
              try {
                // Load your actual collection with Scryfall enrichment via backend
                const response = await fetch('http://localhost:8000/api/load-sample-collection');
                const result = await response.json();

                if (result.success) {
                  onCollectionUploaded(result);
                } else {
                  setError(result.error || 'Failed to load collection');
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
