# Pending: replace temporary AI-generated hero images

**Status: open. Three articles are published with AI-generated illustrations that
should be swapped for genuine photographs when available.**

## Why these are temporary

The agent working on the pilot articles could not download photographs from
Pixabay, Pexels or the other approved free-image sites: the build sandbox has no
outbound network from the shell, and image search returned only search-engine
thumbnails (maximum 1124px against the 1600px hero requirement) sourced largely
from commercial stock libraries such as Getty, which are not licensed for use here.

AI-generated illustrations were used as a stopgap so the articles could ship. Each
is captioned honestly as an illustration, so no reader is told a generated image is
a photograph.

## Images to replace

| Article | Current file | What the photograph needs to show |
| --- | --- | --- |
| Multimodal AI Models Are Changing How Software Understands the World | `article-images/multimodal-ai-models/multimodal-inputs.jpg` | A workstation or screen showing several kinds of input at once (image, audio waveform, document, chart). Search terms: "data visualisation screen", "multiple monitors analytics", "audio waveform editing". |
| Stablecoins and the Future of Digital Payments | `article-images/stablecoins-and-digital-payments/stablecoin-payment-rails.jpg` | A real payment moment: contactless phone payment at a terminal, or a small merchant counter. Search terms: "contactless payment terminal", "mobile payment shop", "point of sale". |
| The Rise of Esports: How Competitive Gaming Became an Industry | `article-images/the-rise-of-esports/esports-arena-stage.jpg` | A real tournament: arena crowd, stage, player booths, big screens. Search terms: "esports arena", "gaming tournament crowd", "esports stage". |

## How to swap one in

1. Download the photograph from a site with a clear free licence (Pixabay, Pexels,
   Library of Congress, National Gallery of Art open access, PD Image Archive).
   Prefer at least 1600px wide, landscape, and check it crops sensibly at 16:9.
2. Save it over the existing path in the table above, or save it under a new name in
   the same folder and update the `img:` line in the article's Markdown file in
   `article_stories/`.
3. Update the `alt:` line. Remove the words "Illustration generated with AI for
   Sholynk" and replace them with a real description plus the credit, for example:
   `alt: A packed esports arena during a live final, seen from behind the crowd. Photo: Pexels.`
4. Run `npm run sync`, then `npm test`.
5. Delete the superseded AI file so it is not left in the repository.

Responsive WebP derivatives in `generated-images/` are regenerated automatically and
should not be edited or deleted by hand.

## Rule for future articles

Genuine photographs are preferred. AI-generated imagery is a fallback only, must be
visually plain rather than pretending to be photojournalism, and must always be
labelled as an illustration in the caption. Never present a generated image as a
photograph of a real person, product, place or event.
