import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'blue' | 'white' | 'gray';
  className?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  color = 'blue', 
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <div
      className={`animate-spin ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <img src="/logo.svg" alt="Loading" className="w-full h-full" style={{ filter: color === 'blue' ? 'drop-shadow(0 0 2px #3b82f6)' : undefined }} />
    </div>
  );
}

interface LoadingSkeletonProps {
  className?: string;
  variant?: 'card' | 'text' | 'circle' | 'rectangular';
  lines?: number;
}

export function LoadingSkeleton({ 
  className = '', 
  variant = 'rectangular',
  lines = 1 
}: LoadingSkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-700 rounded';
  
  const variants = {
    card: 'h-48 rounded-xl',
    text: 'h-4 rounded',
    circle: 'rounded-full',
    rectangular: 'h-6 rounded',
  };

  if (variant === 'text' && lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`${baseClasses} ${variants.text} ${
              index === lines - 1 ? 'w-3/4' : 'w-full'
            }`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className={`${baseClasses} ${variants[variant]} ${className}`} />
  );
}

interface LoadingCardProps {
  className?: string;
}

export function LoadingCard({ className = '' }: LoadingCardProps) {
  return (
    <div className={`sleeve-morphism p-6 border border-gray-700 ${className}`}>
      <div className="animate-pulse">
        <div className="bg-gray-700 h-40 rounded-lg mb-4" />
        <div className="space-y-3">
          <div className="bg-gray-700 h-4 rounded w-3/4" />
          <div className="bg-gray-700 h-3 rounded w-1/2" />
          <div className="flex space-x-2">
            <div className="bg-gray-700 h-6 w-6 rounded-full" />
            <div className="bg-gray-700 h-6 w-6 rounded-full" />
            <div className="bg-gray-700 h-6 w-6 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
  message?: string;
}

export function LoadingOverlay({ 
  isLoading, 
  children, 
  className = '',
  message = 'Loading...' 
}: LoadingOverlayProps) {
  return (
    <div className={`relative ${className}`}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
          <div className="bg-gray-800 rounded-lg p-6 shadow-xl border border-gray-700">
            <div className="flex items-center space-x-4">
              <LoadingSpinner size="lg" />
              <div className="text-white font-mtg-body">{message}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
}

export function LoadingButton({ 
  isLoading, 
  children, 
  loadingText = 'Loading...', 
  className = '',
  disabled,
  ...props 
}: LoadingButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={`relative ${className} ${
        isLoading ? 'cursor-not-allowed' : ''
      }`}
    >
      <span className={isLoading ? 'opacity-0' : 'opacity-100'}>
        {children}
      </span>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingSpinner size="sm" color="white" className="mr-2" />
          {loadingText}
        </div>
      )}
    </button>
  );
}

interface LoadingPageProps {
  message?: string;
  description?: string;
}

export function LoadingPage({ 
  message = 'Loading your collection...', 
  description = 'Please wait while we fetch your data.' 
}: LoadingPageProps) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="mb-8">
          <LoadingSpinner size="xl" />
        </div>
        <h2 className="text-2xl font-mtg text-white mb-4">{message}</h2>
        <p className="text-gray-400 font-mtg-body">{description}</p>
      </div>
    </div>
  );
}

interface LoadingGridProps {
  count?: number;
  className?: string;
}

export function LoadingGrid({ count = 6, className = '' }: LoadingGridProps) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <LoadingCard key={index} />
      ))}
    </div>
  );
}

<LoadingSpinner color="blue" className="mx-auto" />
