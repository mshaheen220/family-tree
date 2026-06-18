import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './styles/css2.css';
import './styles/themes.css';
import './styles/styles.css';
import './styles/ChatDrawer.css';
import { parseGedcomBase, generateTreeLayout, CW } from './src/components/gedcomParser.js';
import PersonCard from './src/components/PersonCard.jsx';
import Legend from './src/components/Legend.jsx';
import Header from './src/components/Header.jsx';
import PersonModal from './src/components/PersonModal.jsx';
import AnalyticsModal from './src/components/AnalyticsModal.jsx';
import ChatDrawer from './src/components/ChatDrawer.jsx';
import packageJson from './package.json';

function AppInfoModal({ show, onClose, version, rootPerson }) {
  if (!show) return null;
  return (
    <div className={`modal-backdrop ${show ? 'show' : ''}`} onClick={onClose} onWheel={e => e.stopPropagation()}>
      <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>App Info</h2>
          <button className="close-btn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body flush-body" style={{ padding: '1.5rem' }}>
          <ul className="stats-list">
            <li><strong>Version</strong> <span>{version}</span></li>
            {rootPerson ? (
              <>
                <li><strong>Root Person ID</strong> <span>{rootPerson.id}</span></li>
                <li><strong>Name</strong> <span>{rootPerson.name}</span></li>
                <li><strong>Birthdate</strong> <span>{rootPerson.birth || rootPerson.birthYear || 'Unknown'}</span></li>
              </>
            ) : (
              <li><strong>Root Person</strong> <span>None Selected</span></li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Hardcoded users for demonstration
  const MOCK_USERS = {
    'editor': { password: 'familytree', role: 'editor' },
    'viewer': { password: 'familytree', role: 'viewer' }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const user = MOCK_USERS[username.toLowerCase().trim()];

    if (user && user.password === password) {
      onLogin({ username, role: user.role });
    } else {
      setError('Invalid username or password.');
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', backgroundColor: 'var(--bg-color, #f4f4f9)', fontFamily: 'sans-serif' }}>
      <div style={{ padding: '2.5rem', background: 'white', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', textAlign: 'center', width: '100%', maxWidth: '400px' }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#333' }}>Welcome to Family Realm</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="text"
            placeholder="Enter username (editor or viewer)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{ padding: '0.75rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid #ccc' }}
          />
          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '0.75rem', fontSize: '1rem', borderRadius: '6px', border: '1px solid #ccc' }}
          />
          <button type="submit" style={{ padding: '0.75rem', fontSize: '1rem', cursor: 'pointer', backgroundColor: 'var(--primary-color, #2a5298)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>
            Enter
          </button>
        </form>
        {error && <p style={{ color: '#d9534f', marginTop: '1rem', fontSize: '0.9rem' }}>{error}</p>}
      </div>
    </div>
  );
}

function MainApp({ user }) {
  const [view, setView] = useState({ scale: 0.38, tx: 60, ty: 30 });
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, startTx: 0, startTy: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [currentGedcom, setCurrentGedcom] = useState(null);
  const [selectedRootId, setSelectedRootId] = useState(null);
  const [defaultRootId, setDefaultRootId] = useState(null);
  
  const [theme, setTheme] = useState('classic');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [infoPerson, setInfoPerson] = useState(null);
  const [showAppInfo, setShowAppInfo] = useState(false);
  
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        
        const gedcomRes = await fetch('/api/gedcom');
        if (gedcomRes.ok) {
          const text = await gedcomRes.text();
          setCurrentGedcom(text);
          if (config.rootId) {
            const cleanId = `@${config.rootId.replace(/@/g, '')}@`;
            setDefaultRootId(cleanId);
            setSelectedRootId(cleanId);
          }
        } else {
          console.error("Failed to fetch GEDCOM file from backend.");
        }
      } catch (e) {
        console.error("Error loading initial data:", e);
      } finally {
        setIsLoading(false);
      }
    }
    fetchInitialData();
  }, []);
  
  const { indis, fams, individuals, rtNodes } = useMemo(() => {
    if (!currentGedcom) return { indis: {}, fams: {}, individuals: [], rtNodes: [] };
    return parseGedcomBase(currentGedcom);
  }, [currentGedcom]);
  
  const { nodes, connectors, maxGen, rootId, genBands, genLabels } = useMemo(() => {
    if (!currentGedcom) return { nodes: [], connectors: [], maxGen: 0, rootId: null, genBands: [], genLabels: [] };
    return generateTreeLayout(indis, fams, individuals, rtNodes, selectedRootId);
  }, [indis, fams, individuals, rtNodes, selectedRootId]);
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
    setSelectedRootId(defaultRootId);
    if (selectedRootId === defaultRootId) {
      handleResetView();
    }
  };

  const handleHardReset = () => {
    window.location.reload();
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

  if (isLoading || !currentGedcom) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', color: 'var(--primary-color, #2a5298)' }}>
        <h2>Loading Family Realm...</h2>
      </div>
    );
  }

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
      <AppInfoModal show={showAppInfo} onClose={() => setShowAppInfo(false)} version={packageJson.version} rootPerson={indis?.[rootId]} />
      
      <button 
        className="btn" 
        style={{ position: 'absolute', bottom: '20px', left: '20px', zIndex: 1000, borderRadius: '50%', width: '45px', height: '45px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.2rem', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}
        onClick={() => setShowAppInfo(true)}
        title="App Information"
      >
        ℹ️
      </button>
      
      {user?.role === 'editor' && <ChatDrawer rootId={rootId} />}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return <MainApp user={user} />;
}