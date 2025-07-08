# DAHLIA Short-Form Static Previews

This directory contains **static HTML renderings** of every page that appears in the DAHLIA short-form application flow.  They are intended for designers, content reviewers, and other stakeholders who need a quick way to browse, comment on, or reference individual screens without installing or running the full Ruby/Rails/Angular application.

## What you will find

* `index.html` – a single, scrollable gallery that shows each page title, its descriptive notes, associated code references, and a live inline preview rendered in an iframe.  The iframe height adjusts automatically so each preview fits its content.
* One HTML file for every flow page (e.g. `contact.html`, `income.html`, `review-summary.html`, …).  Each file is a fully-self-contained snapshot that includes only the markup and a minimal CSS stub (`style.css`) to approximate the app’s look and feel.
* `style.css` – lightweight styles that give the standalone pages a clean card appearance while keeping the footprint small.

## How these files were produced

The previews were generated from the source application using a purpose-built Node.js script.  The script:

1. Locates every Slim template that makes up the short-form flow.
2. Compiles each template into raw HTML, inlines component/directive templates, and substitutes translation keys with their English strings.
3. Wraps each page in a simplified shell (`.app-card` container) and writes the result to an HTML file in this folder.
4. Parses `short-form-pages.md` to gather page metadata and assembles `index.html`, embedding the individual page files in iframes so they can be browsed side-by-side.

All generated files are static; no external assets or JavaScript frameworks are required to view them.  Opening `index.html` in a browser is the quickest way to review the entire flow.
