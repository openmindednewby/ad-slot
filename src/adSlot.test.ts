import { AD_FORMATS, adSlotCssText, createConsentPort, mountAdSlot } from './index';
import type { AdConsentPort, AdFormat, AdProvider, AdRequest, AdSlotHandle, AdSlotOptions } from './index';

const PUBLISHER_ID = 'publisher-under-test';
const FORMAT: AdFormat = 'rectangle';

interface Harness {
  host: HTMLElement;
  requests: AdRequest[];
  setConsent: (marketing: boolean | null) => void;
  mount: (overrides?: Partial<AdSlotOptions>) => AdSlotHandle;
}

function harness(initialMarketing: boolean | null): Harness {
  const host = document.createElement('div');
  const requests: AdRequest[] = [];
  let marketing = initialMarketing;
  const consent = createConsentPort(() => (marketing === null ? null : { marketing }));
  const provider: AdProvider = {
    requestAd: (request) => {
      requests.push(request);
      request.box.appendChild(document.createElement('iframe'));
    },
  };
  return {
    host,
    requests,
    setConsent: (next) => {
      marketing = next;
      consent.notify();
    },
    mount: (overrides = {}) =>
      mountAdSlot(host, { format: FORMAT, publisherId: PUBLISHER_ID, consent, provider, ...overrides }),
  };
}

function reservedBox(host: HTMLElement): { height: string; maxWidth: string; overflow: string } {
  return { height: host.style.height, maxWidth: host.style.maxWidth, overflow: host.style.overflow };
}

describe('mountAdSlot', () => {
  it('with no publisher id and consent granted, makes no request and keeps the box reserved', () => {
    const { host, requests, mount } = harness(true);

    const slot = mount({ publisherId: undefined });

    expect(requests).toHaveLength(0);
    expect(slot.state()).toBe('dark');
    expect(host.style.height).toBe(`${AD_FORMATS.rectangle.height}px`);
  });

  it('with a blank publisher id and consent granted, makes no request', () => {
    const { requests, mount } = harness(true);

    mount({ publisherId: '   ' });

    expect(requests).toHaveLength(0);
  });

  it('with no publisher id and consent granted later, still makes no request', () => {
    const { requests, setConsent, mount } = harness(false);
    mount({ publisherId: null });

    setConsent(true);

    expect(requests).toHaveLength(0);
  });

  it('with a publisher id and marketing consent false, makes no request', () => {
    const { requests, mount } = harness(false);

    const slot = mount();

    expect(requests).toHaveLength(0);
    expect(slot.state()).toBe('dark');
  });

  it('with a publisher id and no consent decision stored, makes no request', () => {
    const { requests, mount } = harness(null);

    mount();

    expect(requests).toHaveLength(0);
  });

  it('with marketing consent turning from false to true, makes exactly one request naming the publisher and format', () => {
    const { host, requests, setConsent, mount } = harness(false);
    const slot = mount();

    setConsent(true);

    expect(requests).toEqual([{ box: host, publisherId: PUBLISHER_ID, format: FORMAT }]);
    expect(slot.state()).toBe('requested');
  });

  it('with marketing consent already true at mount, requests straight away', () => {
    const { requests, mount } = harness(true);

    mount();

    expect(requests).toHaveLength(1);
  });

  it('with consent re-announced as true, does not request a second time', () => {
    const { requests, setConsent, mount } = harness(true);
    mount();

    setConsent(true);

    expect(requests).toHaveLength(1);
  });

  it('with consent going from false to true and an ad in the box, keeps the reserved size', () => {
    const { host, setConsent, mount } = harness(false);
    mount();
    const dark = reservedBox(host);

    setConsent(true);

    expect(reservedBox(host)).toEqual(dark);
    expect(dark).toEqual({
      height: `${AD_FORMATS.rectangle.height}px`,
      maxWidth: `${AD_FORMATS.rectangle.width}px`,
      overflow: 'hidden',
    });
  });

  it('with consent withdrawn after a request, empties the box and goes dark at the same size', () => {
    const { host, setConsent, mount } = harness(true);
    const slot = mount();
    const before = reservedBox(host);

    setConsent(false);

    expect(host.childElementCount).toBe(0);
    expect(slot.state()).toBe('dark');
    expect(reservedBox(host)).toEqual(before);
  });

  it('with consent withdrawn then granted again, requests again', () => {
    const { requests, setConsent, mount } = harness(true);
    mount();
    setConsent(false);

    setConsent(true);

    expect(requests).toHaveLength(2);
  });

  it('with a consent port that throws, treats it as no consent', () => {
    const { requests, mount } = harness(true);
    const consent: AdConsentPort = {
      hasMarketingConsent: () => {
        throw new Error('storage blocked');
      },
      subscribe: () => () => undefined,
    };

    const slot = mount({ consent });

    expect(requests).toHaveLength(0);
    expect(slot.state()).toBe('dark');
  });

  it('with a provider that throws, reports it, stays dark and retries on the next consent change', () => {
    const { requests, setConsent, mount } = harness(false);
    const failure = new Error('provider down');
    const onError = jest.fn();
    let attempts = 0;
    const provider: AdProvider = {
      requestAd: (request) => {
        attempts += 1;
        if (attempts === 1) {
          throw failure;
        }
        requests.push(request);
      },
    };
    const slot = mount({ provider, onError });

    setConsent(true);
    const stateAfterFailure = slot.state();
    setConsent(true);

    expect(stateAfterFailure).toBe('dark');
    expect(onError).toHaveBeenCalledWith(failure);
    expect(requests).toHaveLength(1);
  });

  it('with a provider that throws and no error handler, does not throw into the consent flow', () => {
    const { setConsent, mount } = harness(false);
    const provider: AdProvider = {
      requestAd: () => {
        throw new Error('provider down');
      },
    };
    mount({ provider });

    const announce = (): void => setConsent(true);

    expect(announce).not.toThrow();
  });

  it('after destroy, ignores consent changes and empties the box', () => {
    const { host, requests, setConsent, mount } = harness(true);
    const slot = mount();

    slot.destroy();
    setConsent(false);
    setConsent(true);

    expect(requests).toHaveLength(1);
    expect(host.childElementCount).toBe(0);
    expect(slot.state()).toBe('dark');
  });

  it('with no publisher id, destroy is safe to call', () => {
    const { mount } = harness(true);
    const slot = mount({ publisherId: undefined });

    const destroy = (): void => slot.destroy();

    expect(destroy).not.toThrow();
  });

  it('with an existing host style, keeps it alongside the reservation', () => {
    const { host, mount } = harness(false);
    host.style.marginTop = '16px';

    mount();

    expect(host.style.marginTop).toBe('16px');
    expect(host.style.height).toBe(`${AD_FORMATS.rectangle.height}px`);
  });

  it('with consent granted, marks the host with its format and each state', () => {
    const { host, setConsent, mount } = harness(false);
    mount();
    const dark = host.dataset.adState;

    setConsent(true);

    expect(dark).toBe('dark');
    expect(host.dataset.adState).toBe('requested');
    expect(host.dataset.adFormat).toBe(FORMAT);
  });
});

describe('adSlotCssText', () => {
  it('for each format, reserves a fixed height and caps the width so a 360 px screen does not scroll', () => {
    const formats = Object.keys(AD_FORMATS) as AdFormat[];

    const css = formats.map((format) => adSlotCssText(format));

    formats.forEach((format, index) => {
      expect(css[index]).toContain(`height:${AD_FORMATS[format].height}px`);
      expect(css[index]).toContain(`max-width:${AD_FORMATS[format].width}px`);
      expect(css[index]).toContain('width:100%');
      expect(css[index]).toContain('overflow:hidden');
    });
  });

  it('for server markup, gives the same box mountAdSlot applies so hydration cannot shift it', () => {
    const server = document.createElement('div');
    server.setAttribute('style', adSlotCssText(FORMAT));
    const { host, mount } = harness(false);

    mount();

    expect(reservedBox(host)).toEqual(reservedBox(server));
  });
});

describe('createConsentPort', () => {
  it('with a stored marketing true, reports consent', () => {
    const port = createConsentPort(() => ({ marketing: true }));

    const result = port.hasMarketingConsent();

    expect(result).toBe(true);
  });

  it('with nothing stored, reports no consent', () => {
    const port = createConsentPort(() => null);

    const result = port.hasMarketingConsent();

    expect(result).toBe(false);
  });

  it('after unsubscribe, stops calling the listener', () => {
    const port = createConsentPort(() => null);
    const listener = jest.fn();
    const unsubscribe = port.subscribe(listener);
    port.notify();

    unsubscribe();
    port.notify();

    expect(listener).toHaveBeenCalledTimes(1);
  });
});
