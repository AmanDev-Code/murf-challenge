'use client';

import { createContext, useContext, ReactNode, createElement } from 'react';

export type Locale = 'en' | 'hi';

/**
 * All UI string keys used across VoicePay screens. Each key maps to an
 * object with `en` (English) and `hi` (Hindi / Devanagari) values.
 */
export const STRINGS: Record<string, Record<Locale, string>> = {
  welcome_title: {
    en: 'VoicePay',
    hi: 'वॉइसपे',
  },
  welcome_subtitle: {
    en: 'Your AI voice banking assistant',
    hi: 'आपका AI वॉइस बैंकिंग सहायक',
  },
  tap_to_start: {
    en: 'Tap to start',
    hi: 'शुरू करने के लिए टैप करें',
  },
  connecting: {
    en: 'Connecting…',
    hi: 'कनेक्ट हो रहा है…',
  },
  listening: {
    en: 'Listening',
    hi: 'सुन रहा है',
  },
  speaking: {
    en: 'Speaking',
    hi: 'बोल रहा है',
  },
  call_ended: {
    en: 'Call ended',
    hi: 'कॉल समाप्त',
  },
  mic_denied_title: {
    en: 'Microphone access required',
    hi: 'माइक्रोफ़ोन की अनुमति आवश्यक है',
  },
  mic_denied_message: {
    en: 'VoicePay needs access to your microphone to hear your voice commands.',
    hi: 'VoicePay को आपके वॉइस कमांड सुनने के लिए माइक्रोफ़ोन की अनुमति चाहिए।',
  },
  mic_denied_instructions: {
    en: 'Please enable microphone access in your browser settings and try again.',
    hi: 'कृपया अपने ब्राउज़र की सेटिंग में माइक्रोफ़ोन की अनुमति दें और दोबारा प्रयास करें।',
  },
  try_again: {
    en: 'Try again',
    hi: 'दोबारा प्रयास करें',
  },
  start_new_call: {
    en: 'Start new call',
    hi: 'नई कॉल शुरू करें',
  },
  trust_encrypted: {
    en: 'End-to-end encrypted',
    hi: 'एंड-टू-एंड एन्क्रिप्टेड',
  },
  trust_rbi: {
    en: 'RBI regulated',
    hi: 'RBI विनियमित',
  },
  emergency_human: {
    en: 'Talk to a human',
    hi: 'किसी व्यक्ति से बात करें',
  },
  quick_balance: {
    en: 'Check balance',
    hi: 'बैलेंस देखें',
  },
  quick_transactions: {
    en: 'Recent transactions',
    hi: 'हाल के लेन-देन',
  },
  quick_emi: {
    en: 'EMI status',
    hi: 'EMI स्थिति',
  },
  quick_upi: {
    en: 'Send via UPI',
    hi: 'UPI से भेजें',
  },
  call_duration: {
    en: 'Call duration',
    hi: 'कॉल अवधि',
  },
  topics_discussed: {
    en: 'Topics discussed',
    hi: 'चर्चा किए गए विषय',
  },
  rate_call: {
    en: 'Rate this call',
    hi: 'इस कॉल को रेट करें',
  },
  save_transcript: {
    en: 'Save transcript',
    hi: 'ट्रांसक्रिप्ट सहेजें',
  },
  slow_network_banner: {
    en: 'Slow network detected. Voice quality may be reduced.',
    hi: 'धीमा नेटवर्क मिला। आवाज़ की गुणवत्ता कम हो सकती है।',
  },
  consent_title: {
    en: 'Voice banking consent',
    hi: 'वॉइस बैंकिंग सहमति',
  },
  consent_message: {
    en: 'This call may be recorded for quality and security purposes.',
    hi: 'गुणवत्ता और सुरक्षा के लिए यह कॉल रिकॉर्ड की जा सकती है।',
  },
  consent_agree: {
    en: 'I agree',
    hi: 'मैं सहमत हूँ',
  },
  consent_text_mode: {
    en: 'Continue with text instead',
    hi: 'टेक्स्ट से जारी रखें',
  },
};

/**
 * Translate a string key for the given locale. Falls back to the English
 * value if the key exists but the locale is missing, or returns the key
 * itself if the key is not found (makes missing translations visible in UI).
 */
export function t(key: string, locale: Locale): string {
  const entry = STRINGS[key];
  if (!entry) return key;
  return entry[locale] ?? entry.en ?? key;
}

// ---------- React Context ----------

interface LocaleContextValue {
  locale: Locale;
  t: (key: string) => string;
}

export const LocaleContext = createContext<LocaleContextValue>({
  locale: 'en',
  t: (key: string) => t(key, 'en'),
});

interface LocaleProviderProps {
  locale: Locale;
  children: ReactNode;
}

/**
 * Provides the current locale and a bound `t()` function to the component
 * tree so consumers don't have to pass the locale manually.
 */
export function LocaleProvider({ locale, children }: LocaleProviderProps) {
  const value: LocaleContextValue = {
    locale,
    t: (key: string) => t(key, locale),
  };

  return createElement(LocaleContext.Provider, { value }, children);
}

/**
 * Convenience hook for consuming the locale context.
 */
export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext);
}
