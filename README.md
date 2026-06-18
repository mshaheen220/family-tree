# Dynamic Interactive Family Tree & AI Chat

A browser-based, interactive family tree viewer built with React, integrated with an AI-powered genealogy chat agent. This application processes standard GEDCOM (`.ged`) files to calculate complex, multi-generational family layouts on the fly, and uses an intelligent vector database to let you converse with an AI about your family history.

Unlike static diagrams, this viewer allows you to "walk" through the family tree by clicking on any relative to instantly recalculate the grid and bring their extended ancestry into view.

> **Note on Mobile Support:** This application is purposely not optimized for mobile phones. The expansive and intricate nature of these family tree layouts requires a larger display (desktop or tablet) to truly do the data justice!

## ✨ Features
* **AI Genealogy Chat:** Integrated AI assistant powered by LangChain and Google Gemini to answer questions about your family history using RAG (Retrieval-Augmented Generation) and LanceDB.
* **Automated Data Pipeline:** A full Python and Node.js data pipeline automates the processing of standard GEDCOM files, generating searchable vector databases and relational profiles.
* **Dynamic Layout Engine:** Automatically handles pedigree collapse, multiple marriages, and half-siblings using a specialized Directed Acyclic Graph (DAG) algorithm.
* **Interactive Traversal:** Click any person's card to re-center the universe on them and reveal their hidden ancestors/descendants.
* **High-Resolution PDF Export:** Capture and download the current family tree view as a perfectly cropped, print-ready PDF document.
* **Headshot Integration:** Automatically displays portrait photos for relatives by mapping their GEDCOM IDs to local image files, with graceful fallbacks for missing photos.
* **Smooth Camera Controls:** Drag to pan, scroll to zoom, and enjoy smooth CSS transitions when jumping between relatives.
* **Quick Reset Controls:** One-click buttons to instantly re-center the camera, reset to the dataset's default root person, or completely reload the original tree.
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
* **Europe:** Poland, Czech Republic, Slovakia, Austria, Hungary, Germany, France, Switzerland, Ireland, England, Scotland, Italy, Spain, Russia, Ukraine, Carpatho-Rusyn
* **Middle East & Asia:** Lebanon, Syria, Turkiye, China
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

**4. Exporting to PDF**
Click the **Printer** icon in the header to take a high-resolution snapshot of your current tree and download it as a perfectly-sized PDF, great for printing or sharing.

**5. Quick Actions**
Use the toolbar icons on the right side of the header to quickly recenter the camera on the current person, revert back to the primary person in your dataset, or completely restart and load the original default tree.

**6. Processing Your Own Tree**
To load your own family tree, you must first export a `.ged` file from ancestry sites like Ancestry.com, FamilySearch, or MyHeritage. Then, you'll run the local data pipeline to prepare the database for the application (see Developer Instructions below for details).

---

## 💻 For Developers: Under the Hood

This project is built using **Vite**, **React**, a **Node.js** backend, a **Python** data pipeline, and **`relatives-tree`** (a specialized math engine for calculating family DAG coordinates).

### Getting Started

**Prerequisites:** Ensure you have Node.js and Python 3 installed. You will also need a Google Gemini API Key for the AI Chat features.

1. **Clone the repository** and navigate into the directory.
   ```bash
   git clone <repo-url>
   cd family-tree
   ```
2. **Install frontend dependencies:**
   ```bash
   npm install
   ```
3. **Install backend dependencies:**
   ```bash
   cd server-node
   npm install --legacy-peer-deps
   cd ..
   ```
4. **Configure the AI:**
   Create a `.env` file in the `server-node` directory and add your Google Gemini API key:
   ```bash
   echo "GOOGLE_API_KEY=your_gemini_api_key_here" > server-node/.env
   ```
5. **Run the Data Pipeline:**
   Before running the application, you must process your GEDCOM file to generate the required databases and vector stores. You need a source `.ged` file and a Root ID (the person the tree should center on).
   ```bash
   # Usage: ./run_pipeline.sh <path_to_gedcom_file> <root_person_id>
   ./run_pipeline.sh data/source_trees/tree.ged I412076094635
   ```
   *(The pipeline will automatically set up a Python virtual environment and install needed dependencies.)*
6. **Start the Application:**
   Run both the Vite frontend and Node.js backend simultaneously, specifying the Root ID you just built:
   ```bash
   npm run dev -- I412076094635
   ```
7. Open your browser to `http://localhost:3000`.

### Switching Between Pre-Processed Family Trees

Once you run the pipeline (`./run_pipeline.sh`) for a specific `ROOT_ID`, the extracted tree data, profiles, and vector database are persistently saved into a dedicated directory under `data/`. 

You do **not** need to re-run the pipeline for that person again unless your underlying source GEDCOM file is updated.

If you have processed multiple IDs over time (resulting in multiple folders in your `data/` directory), you can instantly boot the application for any of them without re-running the heavy extraction process. Just pass the desired folder ID when starting the development server:

```bash
npm run dev -- <ROOT_ID>
```
*(Example: `npm run dev -- I412076094635`)*

This will start both the frontend UI and the backend AI agent using the localized data specifically scoped to that root person.

### Technical Highlights

Calculating family trees programmatically is notoriously difficult. This app includes a custom, highly-resilient GEDCOM parser to overcome common layout hurdles:

* **The Ancestry.com Sanitizer:** Sites like Ancestry often export "dangling pointers" when records are deleted (e.g., a person claiming a child, but the child not claiming the parent). The `parseGedcom` function enforces **Strict Bidirectionality**. If both records do not acknowledge the relationship, the link is severed before it can crash the layout engine.
* **Phantom Node Protection:** The engine filters out identical same-sex marriages (often caused by Ancestry export artifacts).
* **The Childless Multi-Marriage Fix:** Layout engines often crash when calculating intermediate childless marriages. Our parser dynamically injects invisible "Dummy Children" into these unions to give the math engine a physical node to route paths around, and then crops the dummy nodes out of the final SVG render.
* **Auto-Cropping & Centering:** The custom grid math perfectly maps the engine's 2x2 grid into custom CSS pixel dimensions, auto-crops phantom routing lines, and calculates SVG `<polyline>` corners for perfectly crisp, 90-degree orthogonal connectors.

### Project Structure
* `start.js`: Concurrently starts the Vite frontend and the Node.js backend using the provided Root ID.
* `run_pipeline.sh`: A shell script that automates the Python data processing and Node indexing steps.
* `App.jsx`: The core application orchestrator. Manages state, camera controls, and the canvas.
* `python-pipeline/`: Python scripts that parse GEDCOM files, generate AI profiles, and build the SQLite database.
* `server-node/`: Node.js Express server that manages AI Chat via Socket.io, LanceDB vector queries, and LangChain RAG.
* `src/components/gedcomParser.js`: The heavy-lifting data parser, sanitization engine, and layout math calculator.
* `src/components/PersonCard.jsx`, `Legend.jsx`, `AnalyticsModal.jsx`, `Tooltip.jsx`: Modular, reusable UI components.
* `styles/styles.css`: All application styling, including the custom flag badges and card flexbox logic.
