import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface SyncPulseData {
  serverTime: string;
  lastAuditId: string;
  lastChangeTime: string;
  activeCount: number;
  unassignedCount: number;
  completedToday: number;
}

interface SyncContextType {
  syncVersion: number;
  isOnline: boolean;
  lastSyncTime: Date;
  pulseData: SyncPulseData | null;
  forceSync: () => void;
}

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export const SyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [syncVersion, setSyncVersion] = useState<number>(1);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [pulseData, setPulseData] = useState<SyncPulseData | null>(null);
  const [prevAuditId, setPrevAuditId] = useState<string>('');

  const checkPulse = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.getPulse();
      setIsOnline(true);
      setLastSyncTime(new Date());
      setPulseData(data);

      if (data.lastAuditId && prevAuditId && data.lastAuditId !== prevAuditId) {
        // Remote change detected from another device or user!
        setSyncVersion((v) => v + 1);
      }
      setPrevAuditId(data.lastAuditId);
    } catch (err) {
      setIsOnline(false);
    }
  }, [user, prevAuditId]);

  useEffect(() => {
    if (!user) return;
    checkPulse();
    const interval = setInterval(checkPulse, 4000); // Poll every 4 seconds for instant responsiveness
    return () => clearInterval(interval);
  }, [user, checkPulse]);

  const forceSync = () => {
    setSyncVersion((v) => v + 1);
    checkPulse();
  };

  return (
    <SyncContext.Provider
      value={{
        syncVersion,
        isOnline,
        lastSyncTime,
        pulseData,
        forceSync,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
};

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};
