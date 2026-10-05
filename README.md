# Balkania — Music events across the Balkans

A static, no-build website for music events in **Bulgaria, Greece, Türkiye and Serbia**.

- **Flag ring** at the top: the four flags on a rotating 3D ring, with a greeting in each language.
- **Upcoming** and **Past** events. Each section is a 3D ring carousel, and events are split automatically by date. When an upcoming event ends, it moves to *Past* without any edits.
- **The chosen item is always in front and on top.** Control it with arrow keys (← →, Home/End), click, mouse drag, mouse wheel or trackpad scroll, touch swipe, or the arrow and dot buttons.
- **Auto-rotation** starts after a few idle seconds. It pauses on hover, focus or drag, when the tab is hidden, and when the visitor prefers reduced motion.
- **Photos are never cropped.** The whole photo is shown (`object-fit: contain`) over a blurred copy of itself, so it fits its frame with no empty bars. The detail panel shows each photo at its natural aspect ratio.
- **Languages:** English, Български, Ελληνικά, Türkçe, Српски. Everything is translated, including event titles, descriptions, venues, photo descriptions, rhythm names and the page title. Dates, prices and numbers are formatted for the chosen locale.
- **Hamburger drawer** on screens ≤ 860px, with a focus trap, Esc to close and a scrim.
- **Tickets:** a *Buy tickets* button with prices in local currency and status badges (*Selling fast*, *Sold out*). It opens a 3-step checkout that ends in an e-ticket with a QR code, or goes to an external box-office link.
- **Extras:** a "Next up" pill in the hero, a live countdown, *Add to calendar* (.ics), a map link, a country filter, an accent colour that follows the selected country, and a Web Audio **rhythm player** for each country's dance meter. The meters are Rachenitsa 7/8, Kalamatianos 7/8, Karşılama 9/8 and Kolo 2/4.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

This is a static site with no build step. On Vercel, import the repository and keep the defaults: framework preset *Other*, empty build command, output directory `.`.

## Editing content

All content lives in `js/data.js`.

### Events
Each event has its text in all five languages:

```js
t: {
  en: [title, venue, city, description, photoAltText],
  bg: [...], el: [...], tr: [...], sr: [...]
}
```

The title in the event country's own language is shown automatically as a subtitle whenever the site is viewed in another language.

`start` and `end` are ISO dates with a UTC offset. The site uses them to sort each event into **Upcoming** or **Past**.

### Tickets
- `tickets: { currency, tiers: [{ id, price, status }] }`:
  - `currency` is an ISO code (`EUR`, `RSD`, `TRY`).
  - Tier ids are `early`, `ga` or `vip`.
  - `status` is `available`, `few` or `soldout`.
  - Prices are formatted for the visitor's language.
- `ticketUrl`: if set, **Buy tickets** opens this external box-office link in a new tab. If it's empty, the built-in checkout runs: choose tickets → order summary → e-ticket with a QR code. The built-in checkout is a demo and takes no payment.
- Past events can have an `attendance` number, shown as "12,000 guests".

### Other content
- `I18N`: all UI strings for `en`, `bg`, `el`, `tr` and `sr`.
- `RHYTHMS`: the meter groups, tempo and localized names used by the rhythm player.

Photos are loaded from Unsplash with `fit=max`, so they are only resized and never cropped. Keep each photo's real `w` and `h` in the data; the page uses them to show the photo at its true aspect ratio.

> This is a demo website: the events and tickets are illustrative samples set in real places. Photo credits are listed in the footer.
