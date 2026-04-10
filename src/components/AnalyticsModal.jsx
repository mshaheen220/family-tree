import React, { useState, useMemo } from 'react';

const originLabels = {
  polish: 'Polish', czech: 'Czech', slovak: 'Slovak', austrian: 'Austrian', lebanese: 'Lebanese', american: 'American',
  german: 'German', french: 'French', swiss: 'Swiss', irish: 'Irish', english: 'English', scottish: 'Scottish', italian: 'Italian',
  spanish: 'Spanish', canadian: 'Canadian', mexican: 'Mexican', russian: 'Russian', ukrainian: 'Ukrainian', chinese: 'Chinese', generic: 'Other'
};

const originColors = {
  polish: '#ef4444', czech: '#f97316', slovak: '#8b5cf6', austrian: '#06b6d4', lebanese: '#10b981', american: '#3b82f6',
  german: '#eab308', french: '#ec4899', swiss: '#14b8a6', irish: '#22c55e', english: '#6366f1', scottish: '#0ea5e9', italian: '#84cc16',
  spanish: '#f59e0b', canadian: '#f43f5e', mexican: '#059669', russian: '#4338ca', ukrainian: '#d946ef', chinese: '#b91c1c', generic: '#94a3b8'
};

export default function AnalyticsModal({ show, onClose, indis, nodes, fams }) {
  const [isFullData, setIsFullData] = useState(true);
  const [hoveredOrigin, setHoveredOrigin] = useState(null);

  const dataSource = useMemo(() => {
    return isFullData ? Object.values(indis || {}) : (nodes || []);
  }, [isFullData, indis, nodes]);

  const longevityData = useMemo(() => {
    const peopleWithLifespan = dataSource.map(p => {
      if (!p.birth || !p.death) return null;
      // Extract 4 digit year from potentially messy GEDCOM date strings
      const bMatch = p.birth.match(/\d{4}/);
      const dMatch = p.death.match(/\d{4}/);
      if (!bMatch || !dMatch) return null;
      
      const bYear = parseInt(bMatch[0], 10);
      const dYear = parseInt(dMatch[0], 10);
      const age = dYear - bYear;
      
      // Filter out negative ages or crazy outliers from bad data entry
      if (age < 0 || age > 120) return null; 

      return { name: p.name, age, bYear, dYear };
    }).filter(Boolean);

    return peopleWithLifespan.sort((a, b) => b.age - a.age).slice(0, 5);
  }, [dataSource]);

  const originsData = useMemo(() => {
    const counts = {};
    let total = 0;
    dataSource.forEach(p => {
      if (!p.isDummy && p.origin) {
        counts[p.origin] = (counts[p.origin] || 0) + 1;
        total++;
      }
    });
    const sorted = Object.entries(counts)
      .map(([origin, count]) => ({
        origin, label: originLabels[origin] || origin, count, percentage: Math.round((count / total) * 100), exactPct: (count / total) * 100
      }))
      .sort((a, b) => b.count - a.count);
      
    let cumulative = 0;
    return sorted.map(o => {
      const offset = cumulative;
      cumulative += o.exactPct;
      return { ...o, offset };
    });
  }, [dataSource]);

  const treeHealth = useMemo(() => {
    const realPeople = dataSource.filter(p => !p.isDummy);
    const total = realPeople.length;
    if (total === 0) return { total: 0, withBirthPct: 0, withPlacePct: 0, avgLifespan: 0 };

    let withBirth = 0;
    let withPlace = 0;
    let totalLifespan = 0;
    let lifespanCount = 0;

    realPeople.forEach(p => {
      if (p.birth) withBirth++;
      if (p.place || p.deathPlace) withPlace++;

      if (p.birth && p.death) {
        const bMatch = p.birth.match(/\d{4}/);
        const dMatch = p.death.match(/\d{4}/);
        if (bMatch && dMatch) {
          const age = parseInt(dMatch[0], 10) - parseInt(bMatch[0], 10);
          if (age >= 0 && age <= 120) {
            totalLifespan += age;
            lifespanCount++;
          }
        }
      }
    });

    return {
      total,
      withBirthPct: Math.round((withBirth / total) * 100),
      withPlacePct: Math.round((withPlace / total) * 100),
      avgLifespan: lifespanCount > 0 ? Math.round(totalLifespan / lifespanCount) : 0
    };
  }, [dataSource]);

  const namesData = useMemo(() => {
    const firstNames = {};
    const lastNames = {};

    dataSource.forEach(p => {
      if (p.isDummy || !p.name) return;
      // Strip out parenthesis (often used for maiden names in GEDCOMs) and split
      const parts = p.name.replace(/[()]/g, '').trim().split(/\s+/);
      
      if (parts.length > 0) {
        const first = parts[0];
        if (first && first.toLowerCase() !== 'unknown' && first.toLowerCase() !== 'private') {
          firstNames[first] = (firstNames[first] || 0) + 1;
        }
        if (parts.length > 1) {
          const last = parts[parts.length - 1];
          if (last && !last.includes('?') && last.toLowerCase() !== 'unknown' && last.toLowerCase() !== 'private') {
            lastNames[last] = (lastNames[last] || 0) + 1;
          }
        }
      }
    });

    const topFirst = Object.entries(firstNames).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topLast = Object.entries(lastNames).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { topFirst, topLast };
  }, [dataSource]);

  const familyDynamics = useMemo(() => {
    const activeIndiIds = new Set(dataSource.map(p => p.id));
    
    let totalChildren = 0;
    let familiesWithChildren = 0;
    let largestFamily = { parents: 'None', count: 0 };
    
    let totalGenerationGap = 0;
    let gapCount = 0;

    Object.values(fams || {}).forEach(fam => {
      if (!isFullData) {
        // If viewing specific tree, only count families where at least one member is visible
        const hasHusband = fam.husb && activeIndiIds.has(fam.husb);
        const hasWife = fam.wife && activeIndiIds.has(fam.wife);
        const hasChild = fam.chil.some(cId => activeIndiIds.has(cId));
        if (!hasHusband && !hasWife && !hasChild) return;
      }

      const realChildren = fam.chil.filter(cId => indis[cId] && !indis[cId].isDummy);
      
      if (realChildren.length > 0) {
        totalChildren += realChildren.length;
        familiesWithChildren++;

        if (realChildren.length > largestFamily.count) {
          const hName = fam.husb && indis[fam.husb] ? indis[fam.husb].name.replace(/[()]/g, '').trim() : '';
          const wName = fam.wife && indis[fam.wife] ? indis[fam.wife].name.replace(/[()]/g, '').trim() : '';
          
          const hParts = hName.split(' ');
          const wParts = wName.split(' ');
          const hFirst = hParts[0] || '';
          const hLast = hParts.length > 1 ? hParts[hParts.length - 1] : '';
          const wFirst = wParts[0] || '';
          
          let parentsStr = (hFirst && wFirst && hLast) ? `${hFirst} & ${wFirst} ${hLast}` : [hName, wName].filter(Boolean).join(' & ');
          largestFamily = { parents: parentsStr || 'Unknown', count: realChildren.length };
        }

        const getYear = (dateStr) => {
          const m = dateStr ? dateStr.match(/\d{4}/) : null;
          return m ? parseInt(m[0], 10) : null;
        };

        const hBirth = fam.husb && indis[fam.husb] ? getYear(indis[fam.husb].birth) : null;
        const wBirth = fam.wife && indis[fam.wife] ? getYear(indis[fam.wife].birth) : null;
        
        realChildren.forEach(cId => {
          const cBirth = getYear(indis[cId]?.birth);
          if (cBirth) {
            if (hBirth && cBirth - hBirth >= 12 && cBirth - hBirth <= 80) { totalGenerationGap += (cBirth - hBirth); gapCount++; }
            if (wBirth && cBirth - wBirth >= 12 && cBirth - wBirth <= 60) { totalGenerationGap += (cBirth - wBirth); gapCount++; }
          }
        });
      }
    });

    return {
      averageSize: familiesWithChildren > 0 ? (totalChildren / familiesWithChildren).toFixed(1) : 0,
      largestFamily,
      averageGap: gapCount > 0 ? Math.round(totalGenerationGap / gapCount) : 0
    };
  }, [dataSource, fams, indis, isFullData]);

  if (!show) return null;

  return (
    <div className="analytics-backdrop" onClick={onClose} onWheel={e => e.stopPropagation()}>
      <div className="analytics-modal" onClick={e => e.stopPropagation()}>
        <div className="analytics-header">
          <h2>Tree Analytics</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="analytics-content">
          
          <div style={{ display: 'flex', background: 'var(--card-border)', padding: '4px', borderRadius: '6px', marginBottom: '20px' }}>
            <button 
              style={{ flex: 1, padding: '6px 12px', border: 'none', borderRadius: '4px', background: isFullData ? 'var(--card-bg)' : 'transparent', color: isFullData ? 'var(--ink)' : 'var(--ink-light)', fontWeight: isFullData ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', boxShadow: isFullData ? '0 2px 4px var(--shadow)' : 'none' }}
              onClick={() => setIsFullData(true)}
            >
              Entire File Data
            </button>
            <button 
              style={{ flex: 1, padding: '6px 12px', border: 'none', borderRadius: '4px', background: !isFullData ? 'var(--card-bg)' : 'transparent', color: !isFullData ? 'var(--ink)' : 'var(--ink-light)', fontWeight: !isFullData ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s', boxShadow: !isFullData ? '0 2px 4px var(--shadow)' : 'none' }}
              onClick={() => setIsFullData(false)}
            >
              Current Tree View
            </button>
          </div>

          <section className="analytics-section">
            <h3>👨‍👩‍👧‍👦 Family Size & Dynamics</h3>
            <ul className="stats-list">
              <li><strong>Largest Branch</strong> <span>{familyDynamics.largestFamily.parents} ({familyDynamics.largestFamily.count} children)</span></li>
              <li><strong>Average Family Size</strong> <span>{familyDynamics.averageSize} children</span></li>
              <li><strong>Generational Gap</strong> <span>{familyDynamics.averageGap} years (avg age of parents)</span></li>
            </ul>
          </section>

          <section className="analytics-section">
            <h3>🏥 Tree Health & Stats</h3>
            <ul className="stats-list">
              <li><strong>Total Profiles</strong> <span>{treeHealth.total} relatives</span></li>
              <li><strong>Average Lifespan</strong> <span>{treeHealth.avgLifespan} years</span></li>
              <li><strong>Profiles with Birth Dates</strong> <span>{treeHealth.withBirthPct}%</span></li>
              <li><strong>Profiles with Locations</strong> <span>{treeHealth.withPlacePct}%</span></li>
            </ul>
          </section>

          <section className="analytics-section">
            <h3>📛 Most Common Names</h3>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '0.95rem', color: 'var(--ink-light)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>First Names</h4>
                <ul className="stats-list">
                  {namesData.topFirst.map(([name, count], i) => (
                    <li key={i}><strong>{name}</strong> <span>{count}</span></li>
                  ))}
                </ul>
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '0.95rem', color: 'var(--ink-light)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Surnames</h4>
                <ul className="stats-list">
                  {namesData.topLast.map(([name, count], i) => (
                    <li key={i}><strong>{name}</strong> <span>{count}</span></li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="analytics-section">
            <h3>🏆 Longest Lived Relatives</h3>
            <ul className="stats-list">
              {longevityData.map((p, i) => (
                <li key={i}>
                  <strong>{p.name}</strong> 
                  <span>{p.age} years ({p.bYear} - {p.dYear})</span>
                </li>
              ))}
            </ul>
          </section>
          
          <section className="analytics-section">
            <h3>🌍 The Melting Pot</h3>
            {originsData.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '40px', marginTop: '20px' }}>
                <div style={{ 
                  width: '160px', height: '160px', position: 'relative', flexShrink: 0
                }}>
                  <svg viewBox="0 0 42 42" width="100%" height="100%" style={{ transform: 'rotate(-90deg)', overflow: 'visible', filter: 'drop-shadow(0 4px 10px var(--shadow))' }}>
                    <circle cx="21" cy="21" r="15.915494309189533" fill="transparent" stroke="var(--card-border)" strokeWidth="6" />
                    {originsData.map(o => (
                      <circle
                        key={o.origin}
                        cx="21" cy="21" r="15.915494309189533"
                        fill="transparent"
                        stroke={originColors[o.origin] || originColors.generic}
                        strokeWidth={hoveredOrigin === o.origin ? "8" : "6"}
                        strokeDasharray={`${o.exactPct} ${100 - o.exactPct}`}
                        strokeDashoffset={-o.offset}
                        style={{ transition: 'stroke-width 0.2s, stroke 0.2s', cursor: 'pointer', outline: 'none' }}
                        onMouseEnter={() => setHoveredOrigin(o.origin)}
                        onMouseLeave={() => setHoveredOrigin(null)}
                      />
                    ))}
                  </svg>
                  
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', textAlign: 'center' }}>
                    {hoveredOrigin ? (
                      <>
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--ink-light)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 10px', lineHeight: 1.2, marginBottom: '2px' }}>
                          {originsData.find(o => o.origin === hoveredOrigin)?.label}
                        </span>
                        <strong style={{ fontSize: '1.4rem', color: 'var(--ink)', lineHeight: 1 }}>
                          {originsData.find(o => o.origin === hoveredOrigin)?.percentage}%
                        </strong>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.85rem', color: 'var(--ink-light)', fontStyle: 'italic', padding: '0 15px' }}>Hover to view</span>
                    )}
                  </div>
                </div>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {originsData.map(o => (
                    <div 
                      key={o.origin} 
                      onMouseEnter={() => setHoveredOrigin(o.origin)}
                      onMouseLeave={() => setHoveredOrigin(null)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '1rem', color: 'var(--ink)', cursor: 'pointer', opacity: hoveredOrigin && hoveredOrigin !== o.origin ? 0.3 : 1, transition: 'opacity 0.2s' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: originColors[o.origin] || originColors.generic, transition: 'transform 0.2s', transform: hoveredOrigin === o.origin ? 'scale(1.2)' : 'scale(1)' }}></div>
                        <strong style={{ transition: 'color 0.2s', color: hoveredOrigin === o.origin ? 'var(--accent)' : 'inherit' }}>{o.label}</strong>
                      </div>
                      <span>{o.percentage}% ({o.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--ink-light)', fontStyle: 'italic', marginTop: '10px' }}>No location data available in this view.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}