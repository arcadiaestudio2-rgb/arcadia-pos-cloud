import React from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';

export function SyncStatus() {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  
  const pendingCount = useLiveQuery(
    () => db.sync_queue.where('status').anyOf(['pending', 'failed']).count()
  );

  const errorCount = useLiveQuery(
    () => db.sync_queue.where('status').equals('failed').count()
  );

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50/50 rounded-2xl border border-slate-100 shadow-sm transition-all hover:bg-white hover:border-slate-200">
      {/* Network Indicator */}
      <div className="flex items-center gap-2 pr-2 border-r border-slate-200/60">
        {isOnline ? (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
            <span className="text-[10px] font-black uppercase tracking-tight text-green-700">Online</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
            <span className="text-[10px] font-black uppercase tracking-tight text-red-700">Offline</span>
          </div>
        )}
      </div>

      {/* Sync Status */}
      <div className="flex items-center gap-2">
        {pendingCount === 0 ? (
          <div className="flex items-center gap-1.5 text-slate-400">
            <CheckCircle2 size={12} className="text-primary/40" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Sincronizado</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            {errorCount && errorCount > 0 ? (
              <AlertCircle size={12} className="text-orange-500 animate-pulse" />
            ) : (
              <RefreshCw size={12} className="text-primary animate-spin" style={{ animationDuration: '3s' }} />
            )}
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">
              {pendingCount} Pendiente{pendingCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
