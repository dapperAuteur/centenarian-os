// File: components/SyncStatusIndicator.tsx

'use client';

import { useEffect, useState } from 'react';
import { OfflineSyncManager } from '@/lib/offline/sync-manager';
import { Wifi, WifiOff, CloudOff, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

/**
 * Sync Status Indicator
 * 
 * Shows current offline/online status and pending syncs.
 * 
 * **Placement:** Dashboard navigation bar (top right)
 */
export function SyncStatusIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({ pending: 0, failed: 0, lastSync: null as number | null });
  const [showDetails, setShowDetails] = useState(false);

  const syncManager = OfflineSyncManager.getInstance();

  useEffect(() => {
    // Online/offline listeners
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Update sync status every 5 seconds
    const updateStatus = async () => {
      const status = await syncManager.getSyncStatus();
      setSyncStatus(status);
    };

    updateStatus();
    const interval = setInterval(updateStatus, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [syncManager]);

  const getStatusIcon = () => {
    if (isOffline) {
      return <WifiOff className="w-5 h-5 text-amber-600" />;
    }
    
    if (syncStatus.failed > 0) {
      return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
    
    if (syncStatus.pending > 0) {
      return <Loader2 className="w-5 h-5 text-sky-600 animate-spin" />;
    }
    
    return <CheckCircle className="w-5 h-5 text-lime-600" />;
  };

  const getStatusText = () => {
    if (isOffline) return 'Offline';
    if (syncStatus.failed > 0) return `${syncStatus.failed} Failed`;
    if (syncStatus.pending > 0) return `Syncing ${syncStatus.pending}...`;
    return 'Synced';
  };

  const getStatusColor = () => {
    if (isOffline) return 'bg-amber-50 border-amber-200 text-amber-800';
    if (syncStatus.failed > 0) return 'bg-red-50 border-red-200 text-red-800';
    if (syncStatus.pending > 0) return 'bg-sky-50 border-sky-200 text-sky-800';
    return 'bg-lime-50 border-lime-200 text-lime-800';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg border-2 transition ${getStatusColor()}`}
      >
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
      </button>

      {/* Dropdown Details */}
      {showDetails && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50">
          <h4 className="font-bold text-gray-900 mb-3">Sync Status</h4>
          
          <div className="space-y-2">
            <StatusRow
              icon={isOffline ? <CloudOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
              label="Connection"
              value={isOffline ? 'Offline' : 'Online'}
              color={isOffline ? 'amber' : 'lime'}
            />
            
            <StatusRow
              icon={<Loader2 className="w-4 h-4" />}
              label="Pending"
              value={syncStatus.pending}
              color="sky"
            />
            
            {syncStatus.failed > 0 && (
              <StatusRow
                icon={<AlertCircle className="w-4 h-4" />}
                label="Failed"
                value={syncStatus.failed}
                color="red"
              />
            )}

            {syncStatus.lastSync && (
              <div className="pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-500">Last Sync</div>
                <div className="text-sm font-medium text-gray-900">
                  {new Date(syncStatus.lastSync).toLocaleTimeString()}
                </div>
              </div>
            )}
          </div>

          {isOffline && (
            <div className="mt-4 p-3 bg-amber-50 rounded-lg">
              <p className="text-xs text-amber-800">
                Changes are saved locally and will sync when connection is restored.
              </p>
            </div>
          )}

          {syncStatus.failed > 0 && (
            <button
              onClick={async () => {
                window.dispatchEvent(new Event('online'));
                setShowDetails(false);
              }}
              className="mt-3 w-full px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition"
            >
              Retry Failed Syncs
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StatusRow({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: string | number; 
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-2">
        <div className={`text-${color}-600`}>{icon}</div>
        <span className="text-sm text-gray-600">{label}</span>
      </div>
      <span className={`text-sm font-semibold text-${color}-600`}>{value}</span>
    </div>
  );
}