'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type MicPermissionStatus = 'granted' | 'denied' | 'prompt' | 'checking' | 'error';

export interface UseMicPermissionResult {
  status: MicPermissionStatus;
  error: string | null;
  requestPermission: () => Promise<void>;
  errorDetails: string | null;
}

/**
 * Maps a getUserMedia DOMException to a user-facing status + messages.
 */
function classifyGetUserMediaError(err: unknown): {
  status: MicPermissionStatus;
  error: string;
  errorDetails: string;
} {
  const name = err instanceof DOMException ? err.name : 'UnknownError';
  const rawMessage =
    err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error';

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return {
        status: 'denied',
        error: 'Microphone access was denied.',
        errorDetails: rawMessage,
      };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        status: 'error',
        error: 'No microphone was found on this device.',
        errorDetails: rawMessage,
      };
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        status: 'error',
        error: 'Your microphone is already in use by another application.',
        errorDetails: rawMessage,
      };
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return {
        status: 'error',
        error: 'No microphone matches the requested settings.',
        errorDetails: rawMessage,
      };
    case 'SecurityError':
      return {
        status: 'error',
        error: 'Microphone access is blocked. Please use a secure (HTTPS) connection.',
        errorDetails: rawMessage,
      };
    default:
      return {
        status: 'error',
        error: 'Could not access the microphone.',
        errorDetails: `${name}: ${rawMessage}`,
      };
  }
}

/**
 * Tracks the browser microphone permission state.
 *
 * Uses `navigator.permissions.query({ name: 'microphone' })` where available and
 * subscribes to its `change` event. iOS Safari (and some older browsers) do not
 * implement the Permissions API for `microphone`, so we fall back to a direct
 * `getUserMedia` probe: we open a stream, read the resulting state, then stop the
 * tracks immediately so we don't hold the mic open.
 */
export function useMicPermission(): UseMicPermissionResult {
  const [status, setStatus] = useState<MicPermissionStatus>('checking');
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const permissionStatusRef = useRef<PermissionStatus | null>(null);
  const changeHandlerRef = useRef<(() => void) | null>(null);

  const safeSet = useCallback(
    (next: { status?: MicPermissionStatus; error?: string | null; errorDetails?: string | null }) => {
      if (!mountedRef.current) return;
      if (next.status !== undefined) setStatus(next.status);
      if (next.error !== undefined) setError(next.error);
      if (next.errorDetails !== undefined) setErrorDetails(next.errorDetails);
    },
    []
  );

  /**
   * Actively opens (and immediately closes) a mic stream. This will trigger the
   * browser permission prompt when the state is 'prompt', and resolves the true
   * granted/denied state everywhere — including iOS Safari.
   */
  const probeWithGetUserMedia = useCallback(async (): Promise<void> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      safeSet({
        status: 'error',
        error: 'This browser does not support microphone access.',
        errorDetails: 'navigator.mediaDevices.getUserMedia is unavailable.',
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release the mic right away — we only needed to resolve the permission.
      stream.getTracks().forEach((track) => track.stop());
      safeSet({ status: 'granted', error: null, errorDetails: null });
    } catch (err) {
      const classified = classifyGetUserMediaError(err);
      safeSet(classified);
    }
  }, [safeSet]);

  const requestPermission = useCallback(async (): Promise<void> => {
    safeSet({ status: 'checking', error: null, errorDetails: null });
    await probeWithGetUserMedia();
  }, [probeWithGetUserMedia, safeSet]);

  useEffect(() => {
    mountedRef.current = true;

    // Server-side / unsupported environments.
    if (typeof navigator === 'undefined') {
      safeSet({
        status: 'error',
        error: 'Microphone access is not available in this environment.',
        errorDetails: 'navigator is undefined.',
      });
      return;
    }

    const permissions = navigator.permissions;
    const canQuery = typeof permissions?.query === 'function';

    let cancelled = false;

    const initViaPermissionsApi = async () => {
      try {
        // `microphone` is not in the TS PermissionName union in all lib versions.
        const permissionStatus = await permissions.query({
          name: 'microphone' as PermissionName,
        });

        if (cancelled || !mountedRef.current) return;

        permissionStatusRef.current = permissionStatus;

        const applyState = () => {
          const state = permissionStatus.state; // 'granted' | 'denied' | 'prompt'
          safeSet({
            status: state,
            error: state === 'denied' ? 'Microphone access was denied.' : null,
            errorDetails: null,
          });
        };

        applyState();
        changeHandlerRef.current = applyState;
        permissionStatus.addEventListener('change', applyState);
      } catch {
        // Permissions API exists but doesn't support the 'microphone' name
        // (notably iOS Safari). Fall back to a passive capability check.
        if (cancelled || !mountedRef.current) return;
        fallbackToPassiveState();
      }
    };

    // Without the Permissions API we can't know the state without prompting.
    // Report 'prompt' if the API surface exists, so the UI can offer a button
    // that calls requestPermission().
    const fallbackToPassiveState = () => {
      if (typeof navigator.mediaDevices?.getUserMedia === 'function') {
        safeSet({ status: 'prompt', error: null, errorDetails: null });
      } else {
        safeSet({
          status: 'error',
          error: 'This browser does not support microphone access.',
          errorDetails: 'navigator.mediaDevices.getUserMedia is unavailable.',
        });
      }
    };

    if (canQuery) {
      void initViaPermissionsApi();
    } else {
      fallbackToPassiveState();
    }

    return () => {
      cancelled = true;
      mountedRef.current = false;
      const permissionStatus = permissionStatusRef.current;
      const changeHandler = changeHandlerRef.current;
      if (permissionStatus && changeHandler) {
        permissionStatus.removeEventListener('change', changeHandler);
      }
      permissionStatusRef.current = null;
      changeHandlerRef.current = null;
    };
  }, [safeSet]);

  return { status, error, requestPermission, errorDetails };
}
