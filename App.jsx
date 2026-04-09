import React, { useState, useEffect, useRef, useMemo } from 'react';
import './styles/css2.css';
import './styles/styles.css';
import calcTree from 'relatives-tree';

// Use the ?raw suffix to import the file as a string directly!
import gedcomData from './data/tree.ged?raw';

const CW = 192, RH = 285, PX = 80, PY = 80;

function parseGedcom(data, preferredRootId = null) {
  const lines = data.split(/\r?\n/);
  const indis = {};
  const fams = {};
  let current = null;
  let parsingTag = null;

  for (const line of lines) {
    if (!line.trim()) continue;
    const matchIndi = line.match(/^0 (@[A-Z0-9_]+@) INDI/);
    const matchFam = line.match(/^0 (@[A-Z0-9_]+@) FAM/);

    if (matchIndi) {
      current = { id: matchIndi[1], type: 'INDI', name: '', birth: '', death: '', place: '', famc: [], fams: [] };
      indis[current.id] = current;
      parsingTag = null;
    } else if (matchFam) {
      current = { id: matchFam[1], type: 'FAM', husb: null, wife: null, chil: [] };
      fams[current.id] = current;
      parsingTag = null;
    } else if (line.startsWith('0 ')) {
      current = null;
    } else if (current) {
      const parts = line.trim().split(' ');
      const lvl = parts[0], tag = parts[1], val = parts.slice(2).join(' ').trim();

      if (current.type === 'INDI') {
        if (lvl === '1') {
          parsingTag = tag;
          if (tag === 'NAME') current.name = val.replace(/\//g, '').trim();
          if (tag === 'SEX') current.sex = val;
          if (tag === 'FAMC') current.famc.push(val);
          if (tag === 'FAMS') current.fams.push(val);
        } else if (lvl === '2') {
          if (tag === 'DATE') {
            if (parsingTag === 'BIRT') current.birth = val;
            if (parsingTag === 'DEAT') current.death = val;
          } else if (tag === 'PLAC') {
            if (parsingTag === 'BIRT') current.place = val;
          }
        }
      } else if (current.type === 'FAM') {
        if (lvl === '1') {
          if (tag === 'HUSB') current.husb = val;
          else if (tag === 'WIFE') current.wife = val;
          else if (tag === 'CHIL') current.chil.push(val);
        }
      }
    }
  }

  if (Object.keys(indis).length === 0) {
    return { nodes: [], connectors: [], maxGen: 0, individuals: [], rootId: null, genBands: [], genLabels: [] };
  }

  // --- GLOBAL DATA CLEANUP ---
  Object.keys(fams).forEach(fId => {
    const fam = fams[fId];
    // 1. Strict Bidirectionality
    if (fam.husb && (!indis[fam.husb] || !indis[fam.husb].fams.includes(fId))) fam.husb = null;
    if (fam.wife && (!indis[fam.wife] || !indis[fam.wife].fams.includes(fId))) fam.wife = null;
    // 2. Same-Sex Artifact Filter
    if (fam.husb && fam.wife) {
      const hSex = indis[fam.husb].sex ? indis[fam.husb].sex.toUpperCase() : '';
      const wSex = indis[fam.wife].sex ? indis[fam.wife].sex.toUpperCase() : '';
      if (hSex && wSex && hSex === wSex) { fam.husb = null; fam.wife = null; fam.chil = []; }
    }
    // 3. Clean up children bidirectionality
    fam.chil = fam.chil.filter(cId => indis[cId] && indis[cId].famc.includes(fId));
  });
  
  // Enforce strict single-family child limits (Prevent multi-parent DAG crashes)
  Object.values(indis).forEach(indi => {
    const validFamc = indi.famc.filter(fId => fams[fId] && fams[fId].chil.includes(indi.id));
    if (validFamc.length > 0) {
      validFamc.sort((a, b) => ((fams[b].husb?1:0)+(fams[b].wife?1:0)) - ((fams[a].husb?1:0)+(fams[a].wife?1:0)));
      indi.famc = [validFamc[0]]; // Keep only the primary family
      validFamc.slice(1).forEach(fId => fams[fId].chil = fams[fId].chil.filter(cId => cId !== indi.id));
    } else indi.famc = [];
  });

  // --- FIX FOR RELATIVES-TREE EMPTY ARRAY CRASH ---
  let dummyIndex = 1;
  Object.values(fams).forEach(fam => {
    if ((fam.husb || fam.wife) && fam.chil.length === 0) {
      const dummyId = `DUMMY_${dummyIndex++}`;
      indis[dummyId] = { id: dummyId, type: 'INDI', name: '', sex: 'U', famc: [fam.id], fams: [], isDummy: true };
      fam.chil.push(dummyId);
    }
  });
  // ---------------------------

  // Calculate Generations (Bidirectional to keep spouses perfectly aligned)
  Object.values(indis).forEach(p => p.gen = null);
  
  const setGen = (startId) => {
    const queue = [startId];
    indis[startId].gen = 0;
    
    while(queue.length > 0) {
      const currId = queue.shift();
      const curr = indis[currId];
      
      // Trace downwards (Spouses and Children)
      curr.fams.forEach(fId => {
        const fam = fams[fId];
        if (!fam) return;
        const spouseId = fam.husb === currId ? fam.wife : fam.husb;
        if (spouseId && indis[spouseId] && indis[spouseId].gen === null) {
          indis[spouseId].gen = curr.gen; // Lock spouse to same generation
          queue.push(spouseId);
        }
        fam.chil.forEach(cId => {
          if (indis[cId] && indis[cId].gen === null) {
            indis[cId].gen = curr.gen + 1;
            queue.push(cId);
          }
        });
      });
      
      // Trace upwards (Parents and Siblings)
      curr.famc.forEach(fId => {
        const fam = fams[fId];
        if (!fam) return;
        if (fam.husb && indis[fam.husb] && indis[fam.husb].gen === null) {
          indis[fam.husb].gen = curr.gen - 1;
          queue.push(fam.husb);
        }
        if (fam.wife && indis[fam.wife] && indis[fam.wife].gen === null) {
          indis[fam.wife].gen = curr.gen - 1;
          queue.push(fam.wife);
        }
        fam.chil.forEach(cId => {
          if (cId !== currId && indis[cId] && indis[cId].gen === null) {
            indis[cId].gen = curr.gen; // Lock siblings to same generation
            queue.push(cId);
          }
        });
      });
    }
  };

  // Run generation assignment for all nodes
  Object.keys(indis).forEach(id => {
    if (indis[id].gen === null) setGen(id);
  });

  // Normalize generation numbers so the absolute oldest ancestors are Generation 1
  const minGen = Math.min(...Object.values(indis).map(p => p.gen));
  let maxGen = 1;
  Object.values(indis).forEach(p => {
    p.gen = p.gen - minGen + 1;
    if (p.gen > maxGen) maxGen = p.gen;
  });

  // --- RELATIVES-TREE LAYOUT ALGORITHM ---
  const dedup = (arr) => {
    const seen = new Set();
    return arr.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  };

  const rtNodes = Object.values(indis).map(i => {
    const parents = [];
    const children = [];
    const spouses = [];
    const siblings = [];

    if (i.famc.length > 0) {
      const fam = fams[i.famc[0]];
      if (fam) {
        if (fam.husb) parents.push({ id: fam.husb, type: 'blood' });
        if (fam.wife) parents.push({ id: fam.wife, type: 'blood' });
        fam.chil.forEach(cId => {
          if (cId !== i.id) siblings.push({ id: cId, type: 'blood' });
        });
      }
    }

    i.fams.forEach(fId => {
      const fam = fams[fId];
      // Security Check: Enforce strict bidirectionality against Ancestry artifacts
      if (fam && (fam.husb === i.id || fam.wife === i.id)) {
        const spouseId = fam.husb === i.id ? fam.wife : fam.husb;
        if (spouseId) spouses.push({ id: spouseId, type: 'married' });
        fam.chil.forEach(cId => {
          children.push({ id: cId, type: 'blood' });
        });
      }
    });

    let gender = 'male'; // Safe default
    const sexStr = i.sex ? i.sex.toUpperCase() : '';
    if (sexStr.startsWith('F')) gender = 'female';
    else if (sexStr.startsWith('M')) gender = 'male';
    else {
      if (i.fams.some(fId => fams[fId]?.wife === i.id)) gender = 'female';
    }

    return { id: i.id, gender, parents: dedup(parents), children: dedup(children), siblings: dedup(siblings), spouses: dedup(spouses) };
  });

  // Prepare sorted list of all people for the dropdown
  const individuals = Object.values(indis).filter(i => !i.isDummy).map(i => {
    let label = i.name || 'Unknown';
    const bYear = i.birth ? (i.birth.match(/\d{4}/) || [''])[0] : '';
    const dYear = i.death ? (i.death.match(/\d{4}/) || [''])[0] : '';
    if (bYear || dYear) label += ` (${bYear} - ${dYear})`;
    
    // Add a hint for phantom/duplicate records
    const connCount = i.famc.length + i.fams.length;
    if (connCount === 0) label += ' [Disconnected]';

    return { id: i.id, name: label, sortName: i.name || 'Unknown', connCount };
  }).sort((a, b) => {
    const nameCmp = a.sortName.localeCompare(b.sortName);
    if (nameCmp !== 0) return nameCmp;
    return b.connCount - a.connCount; // Put the fully connected duplicate first
  });

  const validRootId = preferredRootId && indis[preferredRootId] && !indis[preferredRootId].isDummy ? preferredRootId : Object.values(indis).find(i => !i.isDummy)?.id;
  let tree;
  try {
    tree = calcTree(rtNodes, validRootId);
  } catch (err) {
    // Fallback: If layout engine crashes (like on a childless root spouse), pivot to try their spouse instead
    let fallbackSuccess = false;
    const rootPerson = indis[validRootId];
    if (rootPerson) {
      for (const fId of rootPerson.fams) {
        const fam = fams[fId];
        if (!fam) continue;
        const spouseId = fam.husb === validRootId ? fam.wife : fam.husb;
        if (spouseId) {
          try { tree = calcTree(rtNodes, spouseId); fallbackSuccess = true; break; } catch(e) {}
        }
      }
      if (!fallbackSuccess) {
        for (const fId of rootPerson.famc) {
          const fam = fams[fId];
          if (!fam) continue;
          if (fam.husb) { try { tree = calcTree(rtNodes, fam.husb); fallbackSuccess = true; break; } catch(e) {} }
          if (!fallbackSuccess && fam.wife) { try { tree = calcTree(rtNodes, fam.wife); fallbackSuccess = true; break; } catch(e) {} }
        }
      }
    }
    if (!fallbackSuccess) {
      return { nodes: [], connectors: [], maxGen: 0, individuals, rootId: validRootId, genBands: [], genLabels: [] };
    }
  }

  // Calculate the layout grid using ONLY the real, visible cards
  const realNodes = tree.nodes.filter(n => indis[n.id] && !indis[n.id].isDummy);
  if (realNodes.length === 0) {
    return { nodes: [], connectors: [], maxGen: 0, individuals, rootId: validRootId, genBands: [], genLabels: [] };
  }

  const minTop = Math.min(...realNodes.map(n => n.top));
  const minLeft = Math.min(...realNodes.map(n => n.left));
  let rtMaxGen = 1;

  const X_UNIT = 130; // Horizontal grid spacing multiplier
  const Y_UNIT = 160; // Vertical grid spacing multiplier
  
  const mapX = (val) => (val - minLeft) * X_UNIT + PX;
  const mapY = (val) => (val - minTop) * Y_UNIT + PY;

  // Map Relatives-Tree coordinates to our nodes
  const nodes = realNodes.map(rtn => {
    const i = indis[rtn.id];
    if (!i) return null; // Skip dummy routing nodes generated by relatives-tree

    const gen = Math.floor((rtn.top - minTop) / 2) + 1;
    if (gen > rtMaxGen) rtMaxGen = gen;
    
    // Phase 5: Determine Origin based on Birthplace text
    let o = '';
    const pl = i.place ? i.place.toLowerCase() : '';
    if (pl.includes('poland') || pl.includes('malopolskie')) o = 'polish';
    else if (pl.includes('czech')) o = 'czech';
    else if (pl.includes('slovakia')) o = 'slovak';
    else if (pl.includes('austria')) o = 'austrian';
    else if (pl.includes('lebanon')) o = 'lebanese';
    else if (pl.includes('germany') || pl.includes('deutschland') || pl.includes('bayern') || pl.includes('baden')) o = 'german';
    else if (pl.includes('france') || pl.includes('alsace') || pl.includes('bas-rhin') || pl.includes('moselle')) o = 'french';
    else if (pl.includes('switzerland') || pl.includes('zürich') || pl.includes('zurich')) o = 'swiss';
    else if (pl.includes('irish') || pl.includes('ireland')) o = 'irish';
    else if (pl.includes('usa') || pl.includes('pennsylvania') || pl.includes('pa') || pl.includes('virginia') || pl.includes('wv') || pl.includes('carolina') || pl.includes('california')) o = 'american';

    // relatives-tree nodes default to 2x2. Their center point is left + 1, top + 1.
    // We calculate the center pixel, then subtract half the card size to align it.
    const centerX = mapX(rtn.left + 1);
    const centerY = mapY(rtn.top + 1);

    return { ...i, origin: o, x: centerX - CW / 2, y: centerY - 45, h: 90, gen };
  }).filter(Boolean);

  const dummyPoints = tree.nodes.filter(n => indis[n.id]?.isDummy).map(n => ({
    x: mapX(n.left + 1),
    y: mapY(n.top)
  }));

  // Map Relatives-Tree orthogonal connectors
  const connectors = [];
  tree.connectors.forEach((c, idx) => {
    // Prune off phantom lines that reach up into invisible cropped generations
    if (c.points.some((val, i) => i % 2 !== 0 && val < minTop)) return;
    
    const pts = [];
    for (let i = 0; i < c.points.length; i += 2) {
      pts.push({ x: mapX(c.points[i]), y: mapY(c.points[i+1]) });
    }
    
    // Prune lines dropping down to invisible dummy nodes
    const isDummyLine = pts.some(p => dummyPoints.some(dp => Math.abs(p.x - dp.x) < 1 && Math.abs(p.y - dp.y) < 1));
    if (!isDummyLine) {
      connectors.push({
        id: idx,
        path: pts.map(p => `${p.x},${p.y}`).join(' ')
      });
    }
  });

  // Calculate generation bands and labels exactly between our Y coordinates
  const genBands = [];
  const genLabels = [];
  for (let i = 0; i < rtMaxGen; i++) {
    genLabels.push({ gen: i + 1, y: mapY(minTop + i * 2 + 1) - 45 });
    if (i < rtMaxGen - 1) {
      genBands.push({ id: i, y: mapY(minTop + (i + 1) * 2) });
    }
  }

  maxGen = Math.max(maxGen, rtMaxGen);
  // ------------------------------

  return { nodes, connectors, maxGen: rtMaxGen, individuals, rootId: validRootId, genBands, genLabels };
}

export default function App() {
  const [view, setView] = useState({ scale: 0.38, tx: 60, ty: 30 });
  const dragRef = useRef({ isDragging: false, startX: 0, startY: 0, startTx: 0, startTy: 0 });
  const fileInputRef = useRef(null);
  const [currentGedcom, setCurrentGedcom] = useState(gedcomData);
  const [selectedRootId, setSelectedRootId] = useState(null);
  
  // Parse GEDCOM whenever the loaded file changes
  const { nodes, connectors, maxGen, individuals, rootId, genBands, genLabels } = useMemo(() => parseGedcom(currentGedcom, selectedRootId), [currentGedcom, selectedRootId]);
  const byId = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);

  // Auto-center camera on the Root Person
  useEffect(() => {
    const rootNode = nodes.find(n => n.id === rootId);
    if (rootNode) {
      const targetScale = 0.55; // Zoom in nicely on the subject
      const tx = (window.innerWidth / 2) - (rootNode.x + CW / 2) * targetScale;
      const ty = (window.innerHeight / 2) - (rootNode.y + 45) * targetScale; // 45 is half of card height
      setView({ scale: targetScale, tx, ty });
    }
  }, [rootId, currentGedcom]);

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
  };
  const handleMouseMove = (e) => {
    if (!dragRef.current.isDragging) return;
    setView(prev => ({ ...prev, 
      tx: dragRef.current.startTx + (e.clientX - dragRef.current.startX),
      ty: dragRef.current.startTy + (e.clientY - dragRef.current.startY)
    }));
  };
  const handleMouseUp = () => dragRef.current.isDragging = false;
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
      style={{ cursor: dragRef.current.isDragging ? 'grabbing' : 'grab' }}
    >
      <header>
        <div>
          <h1>Family Tree</h1>
          <p>{maxGen} Generations of Ancestry</p>
        </div>
        <div className="controls">
          <select 
            value={rootId || ''} 
            onChange={(e) => setSelectedRootId(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: '3px', border: '1px solid var(--gold)', background: 'rgba(200,153,42,.15)', color: 'var(--gold)', fontFamily: "'Crimson Text', serif", outline: 'none', cursor: 'pointer' }}
          >
            {individuals.map(ind => (
              <option key={ind.id} value={ind.id} style={{ color: '#000' }}>{ind.name}</option>
            ))}
          </select>
          <input
            type="file"
            accept=".ged"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <button className="btn" onClick={() => fileInputRef.current?.click()}>Upload .ged</button>
          <button className="btn" onClick={() => setView(prev => ({ ...prev, scale: Math.max(0.1, prev.scale - 0.12) }))}>−</button>
          <span className="zoom-label">{Math.round(view.scale * 100)}%</span>
          <button className="btn" onClick={() => setView(prev => ({ ...prev, scale: Math.min(2, prev.scale + 0.12) }))}>+</button>
          <button className="btn" onClick={() => setView({ scale: 0.38, tx: 60, ty: 30 })}>Reset</button>
        </div>
      </header>

      <div 
        id="canvas" 
        style={{ 
          width: maxX, height: maxY, 
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transition: dragRef.current.isDragging ? 'none' : 'transform 0.4s ease-out'
        }}
      >
        <svg id="connectors" width={maxX} height={maxY} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}>
          {connectors?.map(c => (
            <polyline key={c.id} points={c.path} stroke="#7a3b1e" strokeWidth="2" fill="none" strokeLinejoin="round" opacity="0.7" />
          ))}
        </svg>

        {nodes.length === 0 && (
          <div style={{ position: 'absolute', top: window.innerHeight / 2 - view.ty, left: window.innerWidth / 2 - view.tx, transform: 'translate(-50%, -50%)', color: 'var(--accent)', fontSize: '1.2rem', textAlign: 'center', fontFamily: "'Playfair Display', serif" }}>
            The layout engine couldn't calculate this person's family tree.<br/>
            Please select another relative from the dropdown.
          </div>
        )}

        {nodes.map(p => (
          <div 
            key={p.id} 
            className={`card ${p.id === rootId ? 'selected' : ''}`} 
            style={{ left: p.x, top: p.y }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRootId(p.id);
            }}
          >
            <div className="name">{p.name}</div>
            { (p.birth || p.death) && (
              <div className="dates">
                {p.birth && `b. ${p.birth}`}<br />
                {p.death && `d. ${p.death}`}
              </div>
            )}
            { (p.place || p.deathPlace) && <div className="place">{p.place || p.deathPlace}</div> }
            
            { p.origin === 'dual' ? (
              <>
                <span className="origin-tag origin-polish">Polish</span>
                <span className="origin-note">subject of Austro-Hungarian Empire</span>
              </>
            ) : p.origin ? (
              <span className={`origin-tag origin-${p.origin}`}>{originLabels[p.origin] || p.origin}</span>
            ) : null }
          </div>
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

      <div className="legend">
        <h4>Legend</h4>
        <div className="legend-row"><div className="legend-line descent"></div><span>Descent</span></div>
      </div>
    </div>
  );
}