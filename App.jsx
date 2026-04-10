import React, { useState, useEffect, useRef, useMemo } from 'react';
import './styles/css2.css';
import './styles/styles.css';
import { parseGedcom, CW } from './src/components/gedcomParser.js';
import PersonCard from './src/components/PersonCard.jsx';
import Legend from './src/components/Legend.jsx';
import Tooltip from './src/components/Tooltip.jsx';
import AnalyticsModal from './src/components/AnalyticsModal.jsx';

// Use the ?raw suffix to import the file as a string directly!
import gedcomData from './data/tree.ged?raw';

export default function App() {
  const [view, setView] = useState({ scale: 0.38, tx: 60, ty: 30 });
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, startTx: 0, startTy: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const [currentGedcom, setCurrentGedcom] = useState(gedcomData);
  const [selectedRootId, setSelectedRootId] = useState(null);
  const [theme, setTheme] = useState('classic');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  
  // Parse GEDCOM whenever the loaded file changes
  const { nodes, connectors, maxGen, individuals, rootId, genBands, genLabels, indis, fams } = useMemo(() => parseGedcom(currentGedcom, selectedRootId), [currentGedcom, selectedRootId]);
  const byId = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);

  // Filter individuals based on search term
  const filteredIndividuals = useMemo(() => {
    if (!searchTerm) return individuals;
    const lower = searchTerm.toLowerCase();
    return individuals.filter(i => i.name.toLowerCase().includes(lower));
  }, [individuals, searchTerm]);

  // Trace lineage for hover highlighting
  const highlightedIds = useMemo(() => {
    if (!hoveredNodeId) return null;
    const highlight = new Set([hoveredNodeId]);

    // Trace ancestors (up the tree)
    const upQueue = [hoveredNodeId];
    while (upQueue.length > 0) {
      const curr = indis[upQueue.shift()];
      if (curr && curr.famc && curr.famc.length > 0) {
        const fam = fams[curr.famc[0]];
        if (fam) {
          if (fam.husb) { highlight.add(fam.husb); upQueue.push(fam.husb); }
          if (fam.wife) { highlight.add(fam.wife); upQueue.push(fam.wife); }
        }
      }
    }

    // Trace descendants and spouses (down the tree)
    const downQueue = [hoveredNodeId];
    while (downQueue.length > 0) {
      const curr = indis[downQueue.shift()];
      if (curr && curr.fams) {
        curr.fams.forEach(fId => {
          const fam = fams[fId];
          if (fam) {
            if (fam.husb) highlight.add(fam.husb);
            if (fam.wife) highlight.add(fam.wife);
            fam.chil.forEach(cId => { highlight.add(cId); downQueue.push(cId); });
          }
        });
      }
    }
    return highlight;
  }, [hoveredNodeId, indis, fams]);

  // Auto-center camera on the Root Person
  const handleResetView = () => {
    const rootNode = nodes.find(n => n.id === rootId);
    if (rootNode) {
      const targetScale = 0.55; // Zoom in nicely on the subject
      const tx = (window.innerWidth / 2) - (rootNode.x + CW / 2) * targetScale;
      const ty = (window.innerHeight / 2) - (rootNode.y + 45) * targetScale; // 45 is half of card height
      setView({ scale: targetScale, tx, ty });
    } else {
      setView({ scale: 0.38, tx: 60, ty: 30 }); // Fallback if no tree is loaded
    }
  };

  useEffect(() => {
    handleResetView();
  }, [rootId, currentGedcom, nodes]);

  // Apply theme class to document body
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Specific Reset Handlers
  const handleRecenter = () => {
    handleResetView();
  };

  const handleResetToDatasetDefault = () => {
    setSelectedRootId(null);
    // If it was already null, React skips the update effect, so we manually recenter
    if (selectedRootId === null) {
      handleResetView();
    }
  };

  const handleHardReset = () => {
    setCurrentGedcom(gedcomData);
    setSelectedRootId(null);
    if (currentGedcom === gedcomData && selectedRootId === null) {
      handleResetView();
    }
  };

  // File Upload Handler
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      setCurrentGedcom(evt.target.result);
      setSelectedRootId(null); // Reset root person so it auto-calculates
    };
    reader.readAsText(file);
  };

  // Drag / Zoom Handlers
  const handleMouseDown = (e) => {
    dragRef.current = { isDragging: true, startX: e.clientX, startY: e.clientY, startTx: view.tx, startTy: view.ty };
    setIsDragging(true);
  };
  const handleMouseMove = (e) => {
    if (!dragRef.current.isDragging) return;
    setView(prev => ({ ...prev, 
      tx: dragRef.current.startTx + (e.clientX - dragRef.current.startX),
      ty: dragRef.current.startTy + (e.clientY - dragRef.current.startY)
    }));
  };
  const handleMouseUp = () => {
    dragRef.current.isDragging = false;
    setIsDragging(false);
  };
  const handleWheel = (e) => {
    const delta = e.deltaY > 0 ? -0.06 : 0.06;
    setView(prev => ({ ...prev, scale: Math.min(2, Math.max(0.1, prev.scale + delta)) }));
  };

  // Build node data
  const originLabels = {
    polish: 'Polish', czech: 'Czech', slovak: 'Slovak',
    austrian: 'Austrian', lebanese: 'Lebanese', american: 'American',
    german: 'German', french: 'French', swiss: 'Swiss', irish: 'Irish'
  };

  const maxX = nodes.length > 0 ? Math.max(...nodes.map(p => p.x + CW)) + 140 : window.innerWidth;
  const maxY = nodes.length > 0 ? Math.max(...nodes.map(p => p.y + p.h)) + 140 : window.innerHeight;

  return (
    <div 
      id="canvas-wrap" 
      onMouseDown={handleMouseDown} 
      onMouseMove={handleMouseMove} 
      onMouseUp={handleMouseUp} 
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <header>
        <div>
          <h1>Family Tree</h1>
          <p>{maxGen} Generations of Ancestry</p>
        </div>
        <div className="controls">
          <Tooltip text="Search and select the root person">
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--btn-bg)', border: '1px solid var(--gold)', borderRadius: '3px', padding: '2px 5px', transition: 'all 0.2s' }}>
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill="none" style={{ color: 'var(--gold)' }}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input 
                className="search-input"
                type="text" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <div style={{ width: '1px', height: '16px', background: 'var(--gold)', opacity: 0.3, margin: '0 5px' }}></div>
              <select 
                value={rootId || ''} 
                onChange={(e) => { setSelectedRootId(e.target.value); setSearchTerm(''); }}
                style={{ padding: '3px 5px', border: 'none', background: 'transparent', color: 'var(--gold)', fontFamily: "'Crimson Text', serif", outline: 'none', cursor: 'pointer', maxWidth: '160px', textOverflow: 'ellipsis' }}
              >
                {filteredIndividuals.length === 0 && <option value="" disabled>No results...</option>}
                {filteredIndividuals.map(ind => (
                  <option key={ind.id} value={ind.id} style={{ color: '#000' }}>{ind.name}</option>
                ))}
              </select>
            </div>
          </Tooltip>
          <Tooltip text="Select a visual color theme">
            <select 
              value={theme} 
              onChange={(e) => setTheme(e.target.value)}
              style={{ padding: '5px 10px', borderRadius: '3px', border: '1px solid var(--gold)', background: 'var(--btn-bg)', color: 'var(--gold)', fontFamily: "'Crimson Text', serif", outline: 'none', cursor: 'pointer' }}
            >
              <option value="classic" style={{ color: '#000' }}>Classic Theme</option>
              <option value="dark" style={{ color: '#000' }}>Dark Theme</option>
              <option value="ocean" style={{ color: '#000' }}>Ocean Theme</option>
              <option value="forest" style={{ color: '#000' }}>Forest Theme</option>
              <option value="monochrome" style={{ color: '#000' }}>Monochrome Theme</option>
            </select>
          </Tooltip>
          <input
            type="file"
            accept=".ged"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <Tooltip text="Upload GEDCOM file">
            <button className="btn" onClick={() => fileInputRef.current?.click()}>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </button>
          </Tooltip>
          <Tooltip text="Tree Analytics & Insights">
            <button className="btn" onClick={() => setShowAnalytics(true)}>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            </button>
          </Tooltip>
          <Tooltip text="Zoom Out">
            <button className="btn" onClick={() => setView(prev => ({ ...prev, scale: Math.max(0.1, prev.scale - 0.12) }))}>−</button>
          </Tooltip>
          <span className="zoom-label">{Math.round(view.scale * 100)}%</span>
          <Tooltip text="Zoom In">
            <button className="btn" onClick={() => setView(prev => ({ ...prev, scale: Math.min(2, prev.scale + 0.12) }))}>+</button>
          </Tooltip>
          <div style={{ width: '1px', height: '20px', background: 'rgba(200,153,42,.3)', margin: '0 5px' }}></div>
          <Tooltip text="Recenter on current person">
            <button className="btn" onClick={handleRecenter}>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
            </button>
          </Tooltip>
          <Tooltip text="Reset to default person in current tree">
            <button className="btn" onClick={handleResetToDatasetDefault}>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            </button>
          </Tooltip>
          <Tooltip text="Restart completely (Load original default tree)">
            <button className="btn" onClick={handleHardReset}>
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
            </button>
          </Tooltip>
        </div>
      </header>

      <div 
        id="canvas" 
        style={{ 
          width: maxX, height: maxY, 
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transition: isDragging ? 'none' : 'transform 0.4s ease-out'
        }}
      >
        <svg id="connectors" width={maxX} height={maxY} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible', opacity: highlightedIds ? 0.35 : 1, transition: 'opacity 0.2s' }}>
          {connectors?.map(c => (
            <polyline 
              key={c.id} 
              points={c.path} 
              stroke={c.isMarriage ? "var(--marriage-line)" : "var(--blood-line)"} 
              strokeWidth="2" 
              fill="none" 
              strokeLinejoin="round" 
              strokeDasharray={c.isMarriage ? "6,3" : "none"}
              opacity={c.isMarriage ? "0.85" : "0.7"} 
            />
          ))}
        </svg>

        {nodes.length === 0 && (
          <div style={{ position: 'absolute', top: window.innerHeight / 2 - view.ty, left: window.innerWidth / 2 - view.tx, transform: 'translate(-50%, -50%)', color: 'var(--accent)', fontSize: '1.2rem', textAlign: 'center', fontFamily: "'Playfair Display', serif" }}>
            The layout engine couldn't calculate this person's family tree.<br/>
            Please select another relative from the dropdown.
          </div>
        )}

        {nodes.map(p => (
          <PersonCard 
            key={p.id} 
            person={p} 
            isRoot={p.id === rootId} 
            isDimmed={highlightedIds && !highlightedIds.has(p.id)}
            onMouseEnter={() => setHoveredNodeId(p.id)}
            onMouseLeave={() => setHoveredNodeId(null)}
            onClick={() => setSelectedRootId(p.id)} 
          />
        ))}
        
        {genBands?.map(b => (
          <div key={`band-${b.id}`} className="gen-band" style={{ top: b.y }}></div>
        ))}
      </div>

      {/* Dynamic Generation Labels */}
      {genLabels?.map(l => (
        <div key={`label-${l.gen}`} className="gen-label" style={{ top: (l.y * view.scale + view.ty + 62) }}>
          Generation {l.gen}
        </div>
      ))}

      <Legend nodes={nodes} />
      
      <AnalyticsModal show={showAnalytics} onClose={() => setShowAnalytics(false)} indis={indis} nodes={nodes} fams={fams} />
    </div>
  );
}