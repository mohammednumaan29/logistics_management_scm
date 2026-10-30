# DisruptionIQ Intro Page Preview

This is a separate landing-page preview built on top of the uploaded WareTrack 3D project.

## What's included

- `intro.html` — standalone DisruptionIQ landing page.
- `src/intro.js` — intro CTA behavior.
- `src/intro.css` — responsive dark/charcoal and yellow styling.
- `vite.config.js` — configured to build both `index.html` (WareTrack app) and `intro.html`.
- Existing WareTrack Three.js scene and procedural warehouse/truck/forklift/pallet models remain in place.

## Run locally

Requires Node.js and npm.

```bash
npm install
npm run dev
```

Open the intro page at `http://localhost:5173/intro.html`.

To build both pages:

```bash
npm run build
```

## CTA integration note

In this standalone preview, **Get Started** fades out the intro overlay and reveals the existing WareTrack 3D app behind it. The click also dispatches a `disruptioniq:get-started` browser event. When integrating into the DisruptionIQ React frontend, replace that preview behavior with navigation to the role-selection page (for example, through React Router or the existing page navigation function).

The current DisruptionIQ React project was not included in this upload, so this archive does not modify or replace that frontend. Once its source ZIP is available, the WareTrack scene can be integrated into it and the CTA can be connected to the real role-selection route.
