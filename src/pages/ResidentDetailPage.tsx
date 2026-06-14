import React from 'react';
import { useParams } from 'react-router-dom';
import ResidentDetailView from '../components/ResidentDetailView';

export default function ResidentDetailPage() {
  const { residentId } = useParams<{ residentId: string }>();

  if (!residentId) {
    return <div className="p-6">Resident ID not provided</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <ResidentDetailView residentId={parseInt(residentId)} />
      </div>
    </div>
  );
}
