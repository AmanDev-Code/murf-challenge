'use client';

import { useEffect, useState } from 'react';

export type NetworkQuality = '4g' | '3g' | '2g' | 'slow-2g' | 'unknown';

export interface UseNetworkQualityResult {
  quality: NetworkQuality;
  isSlowNetwork: boolean;
  downlink: number | null;
}

/**
 * Minimal shape of the non-standard Network Information API
 * (`navigator.connection`), which is only available in Chromium-based
 * browsers today. Everything is optional because support varies.
 */
interface NetworkInformationLike {
  effectiveType?: NetworkQuality;
  downlink?: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

function getConnection(): NetworkInformationLike | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as Navigator & {
    connection?: NetworkInformationLike;
    mozConnection?: NetworkInformationLike;
    webkitConnection?: NetworkInformationLike;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

function readQuality(connection: NetworkInformationLike | null): NetworkQuality {
  const effectiveType = connection?.effectiveType;
  if (
    effectiveType === '4g' ||
    effectiveType === '3g' ||
    effectiveType === '2g' ||
    effectiveType === 'slow-2g'
  ) {
    return effectiveType;
  }
  return 'unknown';
}

function readDownlink(connection: NetworkInformationLike | null): number | null {
  return typeof connection?.downlink === 'number' ? connection.downlink : null;
}

function isSlow(quality: NetworkQuality): boolean {
  return quality === '2g' || quality === 'slow-2g';
}

/**
 * Reports the browser's estimated network quality via the Network Information
 * API (`navigator.connection`). Falls back to 'unknown' in browsers that don't
 * support it (e.g. Safari, Firefox) — callers should treat 'unknown' as
 * "no signal, assume default behavior" rather than as a slow network.
 */
export function useNetworkQuality(): UseNetworkQualityResult {
  const [quality, setQuality] = useState<NetworkQuality>(() => readQuality(getConnection()));
  const [downlink, setDownlink] = useState<number | null>(() => readDownlink(getConnection()));

  useEffect(() => {
    const connection = getConnection();
    if (!connection) {
      setQuality('unknown');
      setDownlink(null);
      return;
    }

    const handleChange = () => {
      setQuality(readQuality(connection));
      setDownlink(readDownlink(connection));
    };

    // Sync immediately in case the connection object changed between render
    // and effect (rare, but keeps state accurate).
    handleChange();

    connection.addEventListener?.('change', handleChange);
    return () => {
      connection.removeEventListener?.('change', handleChange);
    };
  }, []);

  return {
    quality,
    isSlowNetwork: isSlow(quality),
    downlink,
  };
}
