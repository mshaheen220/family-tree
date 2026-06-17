import React, { useState, useEffect, useMemo } from 'react';
import SegmentedBarChart from './SegmentedBarChart.jsx';
import { originLabels, originColors, originDemonyms } from '../utils/constants.js';

const getSourceLabel = (url) => {
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname.replace(/^www\./, '');
    if (host.includes('ancestry.')) return 'Ancestry Record';
    if (host.includes('familysearch.org')) return 'FamilySearch Record';
    if (host.includes('findagrave.com')) return 'Find a Grave';
    if (host.includes('newspapers.com')) return 'Newspapers.com';
    return host;
  } catch (e) {
    return 'View Source / Record';
  }
};

// Helper to dynamically extract and format dates from inside GEDCOM strings
const formatDates = (val) => {
  if (!val) return null;
  const str = Array.isArray(val) ? val.join(', ') : String(val);
  // Matches 4-digit years and common GEDCOM date prefixes/months (e.g., 1881, 12 Jan 1881, ABT 1881)
  const regex = /(\b(?:(?:ABT|BEF|AFT|EST|CAL)\s+)?(?:(?:\d{1,2}\s+)?[A-Za-z]{3,9}\s+)?\d{4}\b)/gi;
  const parts = str.split(regex);
  return parts.map((part, i) => {
    if (/^(?:(?:ABT|BEF|AFT|EST|CAL)\s+)?(?:(?:\d{1,2}\s+)?[A-Za-z]{3,9}\s+)?\d{4}$/i.test(part)) {
      return <span key={i} className="highlight-date">{part}</span>;
    }
    return part;
  });
};

export default function PersonModal({ person, onClose, indis, fams }) {
  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const [imgError, setImgError] = useState(false);
  useEffect(() => {
    setImgError(false);
  }, [person]);

  const heritageData = useMemo(() => {
    if (!person || !person.heritage) return null;
    
    // Filter out the untraced noise to show only known immigrant heritage
    let totalKnown = 0;
    const knownOrigins = Object.entries(person.heritage).filter(([org, pct]) => org !== 'untraced' && pct > 0);
    knownOrigins.forEach(([org, pct]) => totalKnown += pct);

    if (totalKnown === 0) {
      return { slices: [], desc: "Not enough historical immigrant data in the family tree to calculate a heritage breakdown." };
    }

    const sorted = knownOrigins
      .map(([origin, pct]) => {
        const exactPct = (pct / totalKnown) * 100; // Recalculate out of 100% known
        return { origin, label: originLabels[origin] || origin, percentage: exactPct < 1 ? '<1' : Math.round(exactPct), exactPct };
      })
      .sort((a, b) => b.exactPct - a.exactPct);

    let cumulative = 0;
    const slices = sorted.map(o => {
      const offset = cumulative;
      cumulative += o.exactPct;
      return { ...o, offset };
    });

    // Build a natural language summary
    const primary = sorted.filter(o => o.exactPct >= 20).map(o => originDemonyms[o.origin] || o.label);
    const secondary = sorted.filter(o => o.exactPct > 0 && o.exactPct < 20).map(o => originDemonyms[o.origin] || o.label);
    let desc = '';
    const formatList = (list) => list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list[0];
    const firstName = person.given ? person.given.split(/\s+/)[0] : person.name.split(' ')[0];

    const is100Percent = sorted.length === 1 && sorted[0].exactPct === 100;

    if (is100Percent) {
      desc = `${firstName} is 100% ${originDemonyms[sorted[0].origin] || sorted[0].label}.`;
    } else if (primary.length > 0) {
      desc += `${firstName} is mostly ${formatList(primary)}`;
      if (secondary.length > 0) desc += `, with ${formatList(secondary)} ancestry.`;
      else desc += `.`;
    } else if (secondary.length > 0) {
      desc += `${firstName} has ${formatList(secondary)} ancestry.`;
    }

    return { slices, desc, is100Percent };
  }, [person]);

  if (!person) return null;

  const cleanId = person.id.replace(/[@I]/gi, '');
  const photoUrl = `${import.meta.env.BASE_URL}headshots/${cleanId}.jpg`;

  // Parse Family Data
  const { spouses, children, grandchildren, greatGrandchildren, uniqueSources } = useMemo(() => {
    const sp = [];
    const ch = [];
    const gc = [];
    const ggc = [];

    if (person.fams && fams && indis) {
      person.fams.forEach(fId => {
        const fam = fams[fId];
        if (fam) {
          const spouseId = person.sex === 'M' ? fam.wife : fam.husb;
          if (spouseId && indis[spouseId]) {
            sp.push({ spouse: indis[spouseId], fam });
          }
          if (fam.chil) {
            fam.chil.forEach(cId => {
              if (indis[cId] && !indis[cId].isDummy) ch.push(indis[cId]);
            });
          }
        }
      });
    }

    ch.forEach(child => {
      if (child.fams && fams && indis) {
        child.fams.forEach(fId => {
          const fam = fams[fId];
          if (fam && fam.chil) {
            fam.chil.forEach(gcId => {
              if (indis[gcId] && !indis[gcId].isDummy) {
                gc.push({ gc: indis[gcId], parent: child });
              }
            });
          }
        });
      }
    });

    gc.forEach(item => {
      const grandc = item.gc;
      if (grandc.fams && fams && indis) {
        grandc.fams.forEach(fId => {
          const fam = fams[fId];
          if (fam && fam.chil) {
            fam.chil.forEach(ggcId => {
              if (indis[ggcId] && !indis[ggcId].isDummy) {
                ggc.push({ ggc: indis[ggcId], parent: grandc });
              }
            });
          }
        });
      }
    });

    const us = person.sources ? [...new Set(person.sources)] : [];

    return { spouses: sp, children: ch, grandchildren: gc, greatGrandchildren: ggc, uniqueSources: us };
  }, [person, fams, indis]);

  const colCount = (children.length > 0 ? 1 : 0) + 
                   (grandchildren.length > 0 ? 1 : 0) + 
                   (greatGrandchildren.length > 0 ? 1 : 0);
  const sizeClass = colCount >= 3 ? 'modal-large' : colCount === 2 ? 'modal-medium' : '';

  return (
    <div className="modal-backdrop show" onClick={onClose}>
      <div className={`modal-content ${sizeClass}`.trim()} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{person.name}</h2>
            {person.aka && person.aka.length > 0 && (
              <div className="aka-text">aka {person.aka.join(', ')}</div>
            )}
          </div>
          <button className="close-btn" onClick={onClose} title="Close">×</button>
        </div>
        
        <div className="modal-body">
          {!imgError && (
            <img 
              src={photoUrl} 
              alt={person.name} 
              className="modal-photo"
              onError={() => setImgError(true)}
            />
          )}
          {(person.birth || person.place) && (
            <div className="modal-tabular-row">
              <div className="modal-tabular-label">Born</div>
              <div className="modal-tabular-data">
                {person.birth && <div>{formatDates(person.birth)}</div>}
                {person.place && <div>{person.place}</div>}
              </div>
            </div>
          )}
          {(person.death || person.deathPlace) && (
            <div className="modal-tabular-row">
              <div className="modal-tabular-label">Died</div>
              <div className="modal-tabular-data">
                {person.death && <div>{formatDates(person.death)}</div>}
                {person.deathPlace && <div>{person.deathPlace}</div>}
              </div>
            </div>
          )}
          
          {(person.burial || person.burialPlace) && (
            <div className="modal-tabular-row">
              <div className="modal-tabular-label">Buried</div>
              <div className="modal-tabular-data">
                {person.burial && <div>{formatDates(person.burial)}</div>}
                {person.burialPlace && <div>{person.burialPlace}</div>}
              </div>
            </div>
          )}
          
          {person.occupation && (
            <div className="modal-tabular-row">
              <div className="modal-tabular-label">Work</div>
              <div className="modal-tabular-data">
                {Array.isArray(person.occupation) 
                  ? person.occupation.map((o, i) => <div key={i}>{formatDates(o)}</div>) 
                  : <div>{formatDates(person.occupation)}</div>}
              </div>
            </div>
          )}
          
          {person.military && (
            <div className="modal-tabular-row">
              <div className="modal-tabular-label">Military</div>
              <div className="modal-tabular-data">
                {Array.isArray(person.military) 
                  ? person.military.map((m, i) => <div key={i}>{formatDates(m)}</div>) 
                  : <div>{formatDates(person.military)}</div>}
              </div>
            </div>
          )}
          
          {person.immigration && (
            <div className="modal-tabular-row">
              <div className="modal-tabular-label">Immigration</div>
              <div className="modal-tabular-data">
                {Array.isArray(person.immigration) 
                  ? person.immigration.map((imm, i) => <div key={i}>{formatDates(imm)}</div>) 
                  : <div>{formatDates(person.immigration)}</div>}
              </div>
            </div>
          )}

          {heritageData && (
            <div className="modal-section">
              <h3>Heritage</h3>
              {heritageData.desc && <p className="analytics-desc">{heritageData.desc}</p>}
              {heritageData.slices.length > 0 && !heritageData.is100Percent && <SegmentedBarChart data={heritageData.slices} colors={originColors} />}
            </div>
          )}

          {person.residence && person.residence.length > 0 && (
            <div className="modal-section">
              <h3>Residence</h3>
              <ul>
                {person.residence.map((res, i) => <li key={i}>{formatDates(res)}</li>)}
              </ul>
            </div>
          )}

          {spouses.length > 0 && (
            <div className="modal-section">
              <h3>{spouses.length === 1 ? 'Spouse' : 'Spouses'}</h3>
              <ul>
                {spouses.map((s, i) => {
                  const mYear = s.fam.marrYear;
                  let endYear = s.fam.divYear;
                  
                  const sBirthStr = s.spouse.birthYear;
                  const sDeathStr = s.spouse.deathYear;
                  const sLife = (sBirthStr || sDeathStr) ? ` (${sBirthStr || '?'}–${sDeathStr || '?'})` : '';

                  // If no divorce date, the marriage ends when the first spouse dies
                  if (!endYear) {
                    const pDeathStr = person.deathYear;
                    const pDeath = pDeathStr ? parseInt(pDeathStr, 10) : null;
                    const sDeath = sDeathStr ? parseInt(sDeathStr, 10) : null;
                    
                    if (pDeath && sDeath) {
                      endYear = Math.min(pDeath, sDeath).toString();
                    } else if (pDeath) {
                      endYear = pDeath.toString();
                    } else if (sDeath) {
                      endYear = sDeath.toString();
                    }
                  }

                  let marrYears = '';
                  if (mYear && endYear) {
                    marrYears = `${mYear}–${endYear}`;
                  } else if (mYear) {
                    marrYears = mYear;
                  } else if (endYear) {
                    marrYears = `?–${endYear}`;
                  }

                  return (
                    <li key={i}>
                      {s.spouse.name} <span className="spouse-life">{sLife}</span>
                      {marrYears && <> (m. <span className="marriage-date">{marrYears}</span>)</>}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {(children.length > 0 || grandchildren.length > 0 || greatGrandchildren.length > 0) && (
            <div className="modal-columns">
              {children.length > 0 && (
                <div className="modal-section">
                  <h3>Children</h3>
                  <ul>
                    {children.map((child, i) => (
                      <li key={i}>{child.name}</li>
                    ))}
                  </ul>
                </div>
              )}

              {grandchildren.length > 0 && (
                <div className="modal-section">
                  <h3>Grandchildren</h3>
                  <ul>
                    {grandchildren.map((item, i) => (
                      <li key={i}>{item.gc.name} <span className="spouse-life">({item.parent.name.split(' ')[0]})</span></li>
                    ))}
                  </ul>
                </div>
              )}

              {greatGrandchildren.length > 0 && (
                <div className="modal-section">
                  <h3>Great Grandchildren</h3>
                  <ul>
                    {greatGrandchildren.map((item, i) => (
                      <li key={i}>{item.ggc.name} <span className="spouse-life">({item.parent.name.split(' ')[0]})</span></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {uniqueSources.length > 0 && (
            <div className="modal-section">
              <h3>Sources & Links</h3>
              <ul>
                {uniqueSources.map((src, i) => (
                  <li key={i}>
                    {src.startsWith('http') ? <a href={src} target="_blank" rel="noreferrer">{getSourceLabel(src)}</a> : src}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!person.birth && !person.death && !person.burial && !person.residence && spouses.length === 0 && children.length === 0 && grandchildren.length === 0 && greatGrandchildren.length === 0 && !person.military && uniqueSources.length === 0 && !heritageData && (
            <p>No detailed records available for this person.</p>
          )}
        </div>
      </div>
    </div>
  );
}