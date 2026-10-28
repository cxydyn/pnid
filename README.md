# Smart P&ID Viewer & RCA Investigation Dashboard

An offline-capable engineering P&ID (Piping and Instrumentation Diagram) schematic viewer and comprehensive Root Cause Analysis (RCA) troubleshooting platform built with React, Vite, Tailwind CSS, IndexedDB, and PDF.js.

## Core Features

- **P&ID Drawing Explorer**: Windows Explorer-like file management with virtual folders, search, and metadata organization.
- **High-DPI PDF Viewer**: Pan, zoom, rotate, and circular interactive Magnifier tool for fine instrumentation tag inspection.
- **Equipment Hotspots**: Interactive bounding boxes with 4 actions (Direct Link, Dropdown Menu, Operational Note, RCA Binding).
- **Annotation Tools**: Red pen, highlighter, text callouts, and eraser.
- **RCA Investigation Dashboard**:
  - Incident Report with forensic photos and Small/Medium/Large print sizing (IndexedDB storage).
  - 5-Whys causal problem tracing ladder with CAPA actions.
  - Interactive Ishikawa Fishbone Diagram (6M categories: Manpower, Machine, Material, Method, Measurement, Environment).
  - Fault Tree Analysis (FTA) with Boolean AND/OR logic gates.
- **A4 Landscape Print Mode**: Strict CSS print rules auto-breaking sections into clean printable landscape pages.
- **Data Sync & Backup**: Export/Import JSON, ZIP backup with all PDFs and images (JSZip), and bulk CSV metadata syncing (PapaParse).

## Development & Build

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build production bundle
npm run build
```

## GitHub Pages Deployment

This repository includes an automated GitHub Actions workflow (`.github/workflows/deploy.yml`).

1. Push this repository to GitHub.
2. In your GitHub repository, navigate to **Settings** > **Pages**.
3. Under **Build and deployment** > **Source**, select **GitHub Actions**.
4. Every push to `main` or `master` will automatically build and publish the live site.
