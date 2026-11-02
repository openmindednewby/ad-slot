import type { AdConsentPort } from './consentPort';
import { adSlotCssText } from './formats';
import type { AdFormat } from './formats';

export type AdSlotState = 'dark' | 'requested';

export interface AdRequest {
  box: HTMLElement;
  publisherId: string;
  format: AdFormat;
}

/** Loads an ad into the box. Any script or network call lives here, in the consuming app. */
export interface AdProvider {
  requestAd(request: AdRequest): void;
}

export interface AdSlotOptions {
  format: AdFormat;
  publisherId: string | null | undefined;
  consent: AdConsentPort;
  provider: AdProvider;
  onError?: (error: unknown) => void;
}

export interface AdSlotHandle {
  state(): AdSlotState;
  destroy(): void;
}

function readConsent(consent: AdConsentPort): boolean {
  try {
    return consent.hasMarketingConsent();
  } catch {
    return false;
  }
}

/** Reserves the box in `host`, then requests an ad only with a publisher id and marketing consent. */
export function mountAdSlot(host: HTMLElement, options: AdSlotOptions): AdSlotHandle {
  const { format, consent, provider, onError } = options;
  const publisherId = options.publisherId?.trim() ?? '';
  let state: AdSlotState = 'dark';

  const setState = (next: AdSlotState): void => {
    state = next;
    host.dataset.adState = next;
  };

  const goDark = (): void => {
    host.replaceChildren();
    setState('dark');
  };

  const request = (): void => {
    try {
      provider.requestAd({ box: host, publisherId, format });
      setState('requested');
    } catch (error) {
      onError?.(error);
    }
  };

  const sync = (): void => {
    const wanted = readConsent(consent);
    if (wanted && state === 'dark') {
      request();
    } else if (!wanted && state === 'requested') {
      goDark();
    }
  };

  host.style.cssText += adSlotCssText(format);
  host.dataset.adFormat = format;
  setState('dark');

  if (publisherId === '') {
    return { state: () => state, destroy: goDark };
  }

  sync();
  const unsubscribe = consent.subscribe(sync);

  return {
    state: () => state,
    destroy: (): void => {
      unsubscribe();
      goDark();
    },
  };
}
