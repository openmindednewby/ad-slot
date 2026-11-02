/** What a slot asks of the consent system. */
export interface AdConsentPort {
  hasMarketingConsent(): boolean;
  subscribe(listener: () => void): () => void;
}

/** The part of a stored consent record the port reads; the legal-ui `CookieConsent` record fits it. */
export interface StoredMarketingConsent {
  marketing: boolean;
}

export interface NotifyingConsentPort extends AdConsentPort {
  notify(): void;
}

/** Builds a port over a store reader such as `readCookieConsent`; wire `notify` to the banner's `onConsent`. */
export function createConsentPort(read: () => StoredMarketingConsent | null): NotifyingConsentPort {
  const listeners = new Set<() => void>();
  return {
    hasMarketingConsent: (): boolean => read()?.marketing === true,
    subscribe: (listener): (() => void) => {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
    notify: (): void => {
      listeners.forEach((listener) => listener());
    },
  };
}
