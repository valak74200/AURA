import React from 'react';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import ErrorBoundary from './ErrorBoundary';

interface QueryErrorBoundaryProps {
  children: React.ReactNode;
}

const QueryErrorBoundary: React.FC<QueryErrorBoundaryProps> = ({ children }) => {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onError={(error, errorInfo) => {
            console.error('Query Error:', error, errorInfo);
            // Optionally reset queries on error
            reset();
          }}
          fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  Erreur de connexion
                </h2>
                <p className="text-gray-600 mb-4">
                  Impossible de charger les données. Veuillez vérifier votre connexion.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Recharger la page
                </button>
              </div>
            </div>
          }
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
};

export default QueryErrorBoundary;