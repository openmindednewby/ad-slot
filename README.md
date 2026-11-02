# @dloizides/ad-slot

A consent-gated ad slot for marketing sites. No framework, no runtime dependencies, no third-party script and no publisher id ship in this package.

A slot asks for an ad only when both hold:

1. a publisher id is set (`null`, `undefined` or blank keeps it dark for good);
2. the consent port reports marketing consent. A port that throws counts as no consent.

The box keeps its size in every state, so a slot adds no layout shift of its own.

## Use

Put the reservation in the server markup, so the box exists before any script runs:

```astro
<div id="ad" style={adSlotCssText('rectangle')}></div>
```

Then mount it in the browser:

```ts
import { createConsentPort, mountAdSlot } from '@dloizides/ad-slot';
import { mountConsentBanner, readCookieConsent } from '@dloizides/legal-ui/dom';

const consent = createConsentPort(readCookieConsent);
mountConsentBanner(document.body, { ...bannerOptions, onConsent: consent.notify });

mountAdSlot(document.getElementById('ad'), {
  format: 'rectangle',
  publisherId: import.meta.env.PUBLIC_AD_PUBLISHER_ID,
  consent,
  provider,
});
```

`provider` is yours: `requestAd({ box, publisherId, format })` loads the ad into `box`. The only network request a slot can cause is the one it makes.

## API

| Export | Purpose |
|---|---|
| `mountAdSlot(host, options)` | Reserves the box and follows consent. Returns `{ state(), destroy() }`. |
| `createConsentPort(read)` | Port over a store reader, with `notify()` for consent changes. |
| `adSlotCssText(format)` | The reservation as style text, for server markup. |
| `AD_FORMATS` | `mobile-banner` 320x100, `rectangle` 300x250, `leaderboard` 728x90. |

Width is `100%` capped at the format's width, so a slot cannot cause horizontal scroll. Pick the format for the viewport before mounting: a provider's ad wider than the box is clipped.

`host` carries `data-ad-format` and `data-ad-state` (`dark` or `requested`). Withdrawing consent empties the box and returns it to `dark`; a script the provider already loaded stays on the page, so unloading it is the provider's job. A provider that throws goes to `onError`, the slot stays dark, and the next consent change retries.
