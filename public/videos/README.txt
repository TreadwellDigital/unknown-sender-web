Drop the hero background videos in this folder:

  hero-desktop.mp4   Landscape, ~1080p, 10–20s silent loop
  hero-mobile.mp4    Portrait, ~720p, same loop cropped

Encoding tips:
  - H.264 baseline profile (widest browser support)
  - No audio stream at all (browsers only autoplay silent video)
  - Target 1–2 MB per file — mobile users pay for it
  - Handbrake preset "Web > Vimeo YouTube HQ 1080p60" is a good start

Once these files exist the hero uses them automatically. Until then
the page falls back to the poster image and, failing that, a dark
gradient — the site still renders fine.
