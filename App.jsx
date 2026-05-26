import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './styles/css2.css';
import './styles/themes.css';
import './styles/styles.css';
import { parseGedcomBase, generateTreeLayout, CW } from './src/components/gedcomParser.js';
import PersonCard from './src/components/PersonCard.jsx';
import Legend from './src/components/Legend.jsx';
import Header from './src/components/Header.jsx';
import PersonModal from './src/components/PersonModal.jsx';
import AnalyticsModal from './src/components/AnalyticsModal.jsx';

// Use the ?raw suffix to import the file as a string directly!
import gedcomData from './data/tree.ged?raw';

export default function App() {
  const [view, setView] = useState({ scale: 0.38, tx: 60, ty: 30 });
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, startTx: 0, startTy: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [currentGedcom, setCurrentGedcom] = useState(gedcomData);
  const [selectedRootId, setSelectedRootId] = useState(null);
  const [theme, setTheme] = useState('classic');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [infoPerson, setInfoPerson] = useState(null);
  
  // Parse GEDCOM whenever the loaded file changes
  const { indis, fams, individuals, rtNodes } = useMemo(() => parseGedcomBase(currentGedcom), [currentGedcom]);
  
  // Recalculate layout only when the root person or the base data changes
  const { nodes, connectors, maxGen, rootId, genBands, genLabels } = useMemo(() => generateTreeLayout(indis, fams, individuals, rtNodes, selectedRootId), [indis, fams, individuals, rtNodes, selectedRootId]);
  const byId = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);

  // Filter individuals based on search term
  const filteredIndividuals = useMemo(() => {
    if (!searchTerm) return individuals;
    const lower = searchTerm.toLowerCase();
    return individuals.filter(i => 
      i.name.toLowerCase().includes(lower) || 
      (i.aka && i.aka.some(alias => alias.toLowerCase().includes(lower)))
    );
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
      const targetScale = 0.75; // Zoom in nicely on the subject
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

  // Memoized Handlers to prevent render-cascades
  const handleNodeMouseEnter = useCallback((id) => setHoveredNodeId(id), []);
  const handleNodeMouseLeave = useCallback(() => setHoveredNodeId(null), []);
  const handleNodeClick = useCallback((id) => setSelectedRootId(id), []);

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
      className={isDragging ? 'grabbing' : ''}
      onMouseDown={handleMouseDown} 
      onMouseMove={handleMouseMove} 
      onMouseUp={handleMouseUp} 
      onMouseLeave={handleMouseUp}
    >
      <Header 
        maxGen={maxGen}
        rootName={byId[rootId]?.name}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filteredIndividuals={filteredIndividuals}
        rootId={rootId}
        setSelectedRootId={setSelectedRootId}
        theme={theme}
        setTheme={setTheme}
        handleFileUpload={handleFileUpload}
        setShowAnalytics={setShowAnalytics}
        view={view}
        setView={setView}
        handleRecenter={handleRecenter}
        handleResetToDatasetDefault={handleResetToDatasetDefault}
        handleHardReset={handleHardReset}
      />

      <div 
        id="canvas" 
        className={isDragging ? 'dragging' : ''}
        style={{ 
          width: maxX, height: maxY, 
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`
        }}
      >
        <svg id="connectors" width={maxX} height={maxY} className={highlightedIds ? 'dimmed' : ''}>
          {connectors?.map(c => (
            <polyline 
              key={c.id} 
              className={`connector-line ${c.isMarriage ? 'marriage' : ''}`}
              points={c.path} 
            />
          ))}
        </svg>

        {nodes.length === 0 && (
          <div className="error-message" style={{ top: window.innerHeight / 2 - view.ty, left: window.innerWidth / 2 - view.tx }}>
            The layout engine couldn't calculate this person's family tree.<br/>
            Please select another relative from the dropdown.
          </div>
        )}

        {nodes.map(p => (
          <PersonCard 
            key={p.id} 
            person={p} 
            isRoot={p.id === rootId} 
            isDimmed={highlightedIds ? !highlightedIds.has(p.id) : false}
            onMouseEnter={handleNodeMouseEnter}
            onMouseLeave={handleNodeMouseLeave}
            onClick={handleNodeClick} 
            onInfoClick={setInfoPerson}
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
      
      <PersonModal person={infoPerson} onClose={() => setInfoPerson(null)} indis={indis} fams={fams} />
      <AnalyticsModal show={showAnalytics} onClose={() => setShowAnalytics(false)} indis={indis} nodes={nodes} fams={fams} rootId={rootId} />
    </div>
  );
}