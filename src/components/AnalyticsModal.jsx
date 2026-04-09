import React, { useMemo } from 'react';

const originLabels = {
  polish: 'Polish', czech: 'Czech', slovak: 'Slovak', austrian: 'Austrian', lebanese: 'Lebanese', american: 'American',
  german: 'German', french: 'French', swiss: 'Swiss', irish: 'Irish', english: 'English', scottish: 'Scottish', italian: 'Italian',
  spanish: 'Spanish', canadian: 'Canadian', mexican: 'Mexican', russian: 'Russian', ukrainian: 'Ukrainian', chinese: 'Chinese', generic: 'Other'
};

export default function AnalyticsModal({ show, onClose, indis }) {
  if (!show) return null;

  const longevityData = useMemo(() => {
    const peopleWithLifespan = Object.values(indis || {}).map(p => {
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
  }, [indis]);

  const originsData = useMemo(() => {
    const counts = {};
    let total = 0;
    Object.values(indis || {}).forEach(p => {
      if (!p.isDummy && p.origin) {
        counts[p.origin] = (counts[p.origin] || 0) + 1;
        total++;
      }
    });
    return Object.entries(counts)
      .map(([origin, count]) => ({
        origin, label: originLabels[origin] || origin, count, percentage: Math.round((count / total) * 100)
      }))
      .sort((a, b) => b.count - a.count);
  }, [indis]);

  const treeHealth = useMemo(() => {
    const realPeople = Object.values(indis || {}).filter(p => !p.isDummy);
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
  }, [indis]);

  const namesData = useMemo(() => {
    const firstNames = {};
    const lastNames = {};

    Object.values(indis || {}).forEach(p => {
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
  }, [indis]);

  return (
    <div className="analytics-backdrop" onClick={onClose} onWheel={e => e.stopPropagation()}>
      <div className="analytics-modal" onClick={e => e.stopPropagation()}>
        <div className="analytics-header">
          <h2>Tree Analytics</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="analytics-content">
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
            <div className="origins-list">
              {originsData.map(o => (
                <div key={o.origin} className="origin-stat">
                  <div className="origin-stat-label">
                    <span className={`origin-tag origin-${o.origin}`} style={{ margin: 0 }}>{o.label}</span>
                    <span>{o.percentage}% ({o.count})</span>
                  </div>
                  <div className="origin-stat-bar-bg">
                    <div className={`origin-stat-bar origin-${o.origin}`} style={{ width: `${o.percentage}%`, height: '100%', borderRadius: '4px', border: 'none' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}