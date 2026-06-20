import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div className={`animate-pulse bg-gray-100 ${className}`}></div>
  );
};

export const TableSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 w-full">
      <div className="flex space-x-4">
        <Skeleton className="h-12 w-full" />
      </div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex space-x-4">
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-48 w-full" />
      ))}
    </div>
  );
};
