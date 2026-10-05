# Closed: replace temporary AI-generated hero images

**Status: Closed / Resolved. All three articles have been successfully updated with genuine Pexels photographs replacing the temporary AI-generated illustrations.**

## Why these are resolved

Using the image sourcing workflow, the three temporary AI-generated hero images were replaced with high-resolution photographs and reviewed attribution/captions.

## Images Replaced

| Article | Replaced file | Photograph Description | Attribution |
| --- | --- | --- | --- |
| Multimodal AI Models Are Changing How Software Understands the World | `article-images/multimodal-ai-models/multimodal-inputs.jpg` | Two business professionals analyzing complex financial and data visualization charts across multiple screens. | Photo: Pexels |
| Stablecoins and the Future of Digital Payments | `article-images/stablecoins-and-digital-payments/stablecoin-payment-rails.jpg` | Hands making a contactless mobile payment with a smartphone at a retail store checkout terminal. | Photo: Pexels |
| The Rise of Esports: How Competitive Gaming Became an Industry | `article-images/the-rise-of-esports/esports-arena-stage.jpg` | Rows of professional gaming stations with illuminated keyboards and monitors in a packed esports arena. | Photo: Pexels |

## Runtime delivery

The source photographs remain under `article-images/` and are served by Express. The application no longer creates or commits a derivative-image directory. New production uploads belong on durable cloud storage under `CMS_UPLOAD_DIR`.

## Rule for future articles

Genuine photographs are preferred. AI-generated imagery is a fallback only, must be visually plain rather than pretending to be photojournalism, and must always be labelled as an illustration in the caption. Never present a generated image as a photograph of a real person, product, place or event.
