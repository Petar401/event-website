# Balkania — Music events across the Balkans

A static, no-build website for music events in **Bulgaria, Greece, Türkiye and Serbia**.

- **Flag ring** at the top: the four flags on a rotating 3D ring, with a greeting in each language.
- **Upcoming** and **Past** events. Each section is a 3D ring carousel, and events are split automatically by date. When an upcoming event ends, it moves to *Past* without any edits.
- **The chosen item is always in front and on top.** Control it with arrow keys (← →, Home/End), click, mouse drag, mouse wheel or trackpad scroll, touch swipe, or the arrow and dot buttons.
- **Auto-rotation** starts after a few idle seconds. It pauses on hover, focus or drag, when the tab is hidden, and when the visitor prefers reduced motion.
- **Photos are never cropped.** The whole photo is shown (`object-fit: contain`) over a blurred copy of itself, so it fits its frame with no empty bars. The detail panel shows each photo at its natural aspect ratio.
- **Languages:** English, Български, Ελληνικά, Türkçe, Српски. Dates are formatted for the chosen locale.
- **Hamburger drawer** on screens ≤ 860px, with a focus trap, Esc to close and a scrim.
- **Extras:** a live countdown, *Add to calendar* (.ics), a map link, a country filter, an accent colour that follows the selected country, and a Web Audio **rhythm player** for each country's dance meter. The meters are Rachenitsa 7/8, Kalamatianos 7/8, Karşılama 9/8 and Kolo 2/4.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

This is a static site with no build step. On Vercel, import the repository and keep the defaults: framework preset *Other*, empty build command, output directory `.`.

## Editing content

All content lives in `js/data.js`:

- `EVENTS`: title, local-language title, venue, city, ISO start and end with UTC offset, category, blurb and photo.
- `I18N`: UI strings per language. Event blurbs are in English only for now.
- `RHYTHMS`: the meter groups and tempo used by the rhythm player.

Photos are loaded from Unsplash with `fit=max`, so they are only resized and never cropped. Keep each photo's real `w` and `h` in the data; the page uses them to show the photo at its true aspect ratio.

> All events are fictional samples set in real places. Photo credits are listed in the footer.
