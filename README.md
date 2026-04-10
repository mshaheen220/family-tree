# Dynamic Interactive Family Tree

A browser-based, interactive family tree viewer built with React. This application dynamically parses standard GEDCOM (`.ged`) files and calculates complex, multi-generational family layouts on the fly. 

Unlike static diagrams, this viewer allows you to "walk" through the family tree by clicking on any relative to instantly recalculate the grid and bring their extended ancestry into view.

> **Note on Mobile Support:** This application is purposely not optimized for mobile phones. The expansive and intricate nature of these family tree layouts requires a larger display (desktop or tablet) to truly do the data justice!

## ✨ Features
* **Direct GEDCOM Parsing:** Upload any `.ged` file directly in the browser—no server or database required.
* **Dynamic Layout Engine:** Automatically handles pedigree collapse, multiple marriages, and half-siblings using a specialized Directed Acyclic Graph (DAG) algorithm.
* **Interactive Traversal:** Click any person's card to re-center the universe on them and reveal their hidden ancestors/descendants.
* **Smooth Camera Controls:** Drag to pan, scroll to zoom, and enjoy smooth CSS transitions when jumping between relatives.
* **Custom Themes:** Switch between 5 mathematically balanced, high-contrast color themes (Classic, Dark, Ocean, Forest, Monochrome) to suit your preference.
* **Nationality Badges:** Automatically assigns flag-inspired origin badges based on parsed birthplaces or deathplaces.
* **Tree Analytics & Insights:** A dedicated modal offering rich data analysis including Geographic "Melting Pot" donut charts, Longest Lived Relatives, Namesake Lineages, and Family Size dynamics.
* **Interactive Branch Highlighting:** Hover over any relative's card to instantly illuminate their direct bloodlines and dim the rest of the canvas.
* **Hidden Relatives Indicator:** A subtle `+` badge appears on edge cards to notify you when a person has extended family hidden from the current view.
* **Smart Search:** Quickly find and jump to specific relatives in massive datasets using the integrated search-and-select dropdown.
* **Generational Banding:** Visually aligns relatives into strict horizontal generations.

### 🌍 Supported Nationality Badges
The application scans the location data in your GEDCOM file to automatically assign visual origin tags to each person's card. Currently supported regions include:
* **North America:** America, Canada, Mexico
* **Europe:** Poland, Czech Republic, Slovakia, Austria, Germany, France, Switzerland, Ireland, England, Scotland, Italy, Spain, Russia, Ukraine
* **Middle East & Asia:** Lebanon, China
* **Fallback:** Any unmapped location will gracefully fall back to a slate-colored "Other" badge.

---

## 👤 For Users: How to Use

**1. Navigating the Tree**
* **Click and Drag** anywhere on the background to pan around the canvas.
* **Scroll your mouse wheel** (or use the `+` / `-` buttons in the header) to zoom in and out.
* The background is divided by dashed horizontal lines. Everyone on the same line belongs to the same generation relative to the "Root" person.

**2. Exploring Relatives**
To keep the screen from turning into a tangled spiderweb of overlapping lines, the tree only displays the direct bloodline of the currently selected "Root" person. 
* To see the hidden ancestors of a spouse or distant cousin, **simply click their card!** 
* The tree will instantly recalculate and the camera will smoothly glide to their newly expanded family branch.
* You can **hover** your mouse over any card to instantly highlight that person's direct bloodline.
* Look for the **`+` badge** in the corner of a card. This indicates the person has parents, spouses, or children not currently shown on screen. Click them to reveal those branches!
* You can also use the **dropdown menu** in the top navigation bar to jump directly to any person in the file.
* **Search:** Click into the search bar inside the dropdown menu to type a name, then press `Enter` to instantly snap the tree to that person.

**3. Tree Analytics**
Click the **Analytics (Bar Chart)** icon in the header to view deep statistical insights about your family tree. You can toggle the modal to analyze either the *Entire File* or just the *Current Tree View*.

**4. Uploading Your Own Tree**
Click the **Upload .ged** button in the header to load your own family tree. You can export a `.ged` file from ancestry sites like Ancestry.com, FamilySearch, or MyHeritage. All data is processed locally in your browser and is never uploaded to a server.

---

## 💻 For Developers: Under the Hood

This project is built using **Vite**, **React**, and **`relatives-tree`** (a specialized math engine for calculating family DAG coordinates).

### Getting Started

**Prerequisites:** Ensure you have Node.js installed.

1. Clone the repository and navigate into the directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the local Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser to `http://localhost:3000`.

*Note: The app loads a default `.ged` file on startup. You can replace the file at `data/tree.ged` to change the default tree.*

### Technical Highlights

Calculating family trees programmatically is notoriously difficult. This app includes a custom, highly-resilient GEDCOM parser to overcome common layout hurdles:

* **The Ancestry.com Sanitizer:** Sites like Ancestry often export "dangling pointers" when records are deleted (e.g., a person claiming a child, but the child not claiming the parent). The `parseGedcom` function enforces **Strict Bidirectionality**. If both records do not acknowledge the relationship, the link is severed before it can crash the layout engine.
* **Phantom Node Protection:** The engine filters out identical same-sex marriages (often caused by Ancestry export artifacts).
* **The Childless Multi-Marriage Fix:** Layout engines often crash when calculating intermediate childless marriages. Our parser dynamically injects invisible "Dummy Children" into these unions to give the math engine a physical node to route paths around, and then crops the dummy nodes out of the final SVG render.
* **Auto-Cropping & Centering:** The custom grid math perfectly maps the engine's 2x2 grid into custom CSS pixel dimensions, auto-crops phantom routing lines, and calculates SVG `<polyline>` corners for perfectly crisp, 90-degree orthogonal connectors.

### Project Structure
* `App.jsx`: The core application orchestrator. Manages state, camera controls, and the canvas.
* `src/components/gedcomParser.js`: The heavy-lifting data parser, sanitization engine, and layout math calculator.
* `src/components/PersonCard.jsx`, `Legend.jsx`, `AnalyticsModal.jsx`, `Tooltip.jsx`: Modular, reusable UI components.
* `styles/styles.css`: All application styling, including the custom flag badges and card flexbox logic.
* `data/tree.ged`: The raw text database loaded via Vite's `?raw` import feature.
