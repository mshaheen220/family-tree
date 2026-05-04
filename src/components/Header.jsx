import React, { useRef } from 'react';
import Tooltip from './Tooltip.jsx';
import { exportTreeToPdf } from '../utils/exportTree.js';

export default function Header({
  maxGen,
  rootName,
  searchTerm,
  setSearchTerm,
  filteredIndividuals,
  rootId,
  setSelectedRootId,
  theme,
  setTheme,
  handleFileUpload,
  setShowAnalytics,
  view,
  setView,
  handleRecenter,
  handleResetToDatasetDefault,
  handleHardReset
}) {
  const fileInputRef = useRef(null);

  return (
    <header>
      <div>
        <h1>Family Tree</h1>
        <p>{maxGen} Generations of Ancestry {rootName ? `for ${rootName}` : ''}</p>
      </div>
      <div className="controls">
        <Tooltip text="Search and select the root person">
          <div className="search-wrap">
            <svg className="search-icon" viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input 
              className="search-input"
              type="text" 
              placeholder="Search..." 
              title="Type a name, then hit Enter"
              aria-label="Search people"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredIndividuals.length > 0) {
                  setSelectedRootId(filteredIndividuals[0].id);
                  setSearchTerm('');
                  e.target.blur(); // Drops focus so the dropdown hides
                }
              }}
            />
            <div className="search-divider"></div>
            <select 
              className="person-select"
              value={searchTerm ? 'search_prompt' : (rootId || '')} 
              aria-label="Select root person"
              onChange={(e) => { 
                if (e.target.value !== 'search_prompt') {
                  setSelectedRootId(e.target.value); 
                  setSearchTerm(''); 
                }
              }}
            >
              {searchTerm && filteredIndividuals.length > 0 && <option value="search_prompt" disabled>Select from {filteredIndividuals.length} result(s)...</option>}
              {filteredIndividuals.length === 0 && <option value="search_prompt" disabled>No results...</option>}
              {filteredIndividuals.map(ind => (
                <option key={ind.id} value={ind.id}>{ind.name}</option>
              ))}
            </select>
          </div>
        </Tooltip>
        <Tooltip text="Select a visual color theme">
          <select 
            className="theme-select"
            value={theme} 
            aria-label="Select color theme"
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="classic">Classic Theme</option>
            <option value="dark">Dark Theme</option>
            <option value="ocean">Ocean Theme</option>
            <option value="forest">Forest Theme</option>
            <option value="monochrome">Monochrome Theme</option>
          </select>
        </Tooltip>
        <input type="file" accept=".ged" className="hidden-file-input" ref={fileInputRef} onChange={handleFileUpload} />
        <Tooltip text="Upload GEDCOM file">
          <button className="btn" aria-label="Upload GEDCOM file" onClick={() => fileInputRef.current?.click()}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          </button>
        </Tooltip>
        <Tooltip text="Export Tree to PDF">
          <button className="btn" aria-label="Export Tree to PDF" onClick={() => exportTreeToPdf()}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          </button>
        </Tooltip>
        <Tooltip text="Tree Analytics & Insights">
          <button className="btn" aria-label="View Tree Analytics" onClick={() => setShowAnalytics(true)}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
          </button>
        </Tooltip>
        <Tooltip text="Zoom Out">
          <button className="btn" aria-label="Zoom out" onClick={() => setView(prev => ({ ...prev, scale: Math.max(0.1, prev.scale - 0.12) }))}>−</button>
        </Tooltip>
        <span className="zoom-label">{Math.round(view.scale * 100)}%</span>
        <Tooltip text="Zoom In">
          <button className="btn" aria-label="Zoom in" onClick={() => setView(prev => ({ ...prev, scale: Math.min(2, prev.scale + 0.12) }))}>+</button>
        </Tooltip>
        <div className="header-divider"></div>
        <Tooltip text="Recenter on current person">
          <button className="btn" aria-label="Recenter on current person" onClick={handleRecenter}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
          </button>
        </Tooltip>
        <Tooltip text="Reset to default person in current tree">
          <button className="btn" aria-label="Reset to default person" onClick={handleResetToDatasetDefault}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </button>
        </Tooltip>
        <Tooltip text="Restart completely (Load original default tree)">
          <button className="btn" aria-label="Restart completely" onClick={handleHardReset}>
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
          </button>
        </Tooltip>
      </div>
    </header>
  );
}