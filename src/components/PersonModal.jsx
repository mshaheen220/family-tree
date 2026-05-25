import React, { useState, useEffect } from 'react';

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

  if (!person) return null;

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

  const cleanId = person.id.replace(/[@I]/gi, '');
  const photoUrl = `${import.meta.env.BASE_URL}headshots/${cleanId}.jpg`;

  // Parse Family Data
  const spouses = [];
  const children = [];
  if (person.fams && fams && indis) {
    person.fams.forEach(fId => {
      const fam = fams[fId];
      if (fam) {
        const spouseId = person.sex === 'M' ? fam.wife : fam.husb;
        if (spouseId && indis[spouseId]) {
          spouses.push({ spouse: indis[spouseId], fam });
        }
        if (fam.chil) {
          fam.chil.forEach(cId => {
            if (indis[cId] && !indis[cId].isDummy) children.push(indis[cId]);
          });
        }
      }
    });
  }

  const grandchildren = [];
  children.forEach(child => {
    if (child.fams && fams && indis) {
      child.fams.forEach(fId => {
        const fam = fams[fId];
        if (fam && fam.chil) {
          fam.chil.forEach(gcId => {
            if (indis[gcId] && !indis[gcId].isDummy) {
              grandchildren.push({ gc: indis[gcId], parent: child });
            }
          });
        }
      });
    }
  });

  const greatGrandchildren = [];
  grandchildren.forEach(item => {
    const gc = item.gc;
    if (gc.fams && fams && indis) {
      gc.fams.forEach(fId => {
        const fam = fams[fId];
        if (fam && fam.chil) {
          fam.chil.forEach(ggcId => {
            if (indis[ggcId] && !indis[ggcId].isDummy) {
              greatGrandchildren.push({ ggc: indis[ggcId], parent: gc });
            }
          });
        }
      });
    }
  });

  const uniqueSources = person.sources ? [...new Set(person.sources)] : [];

  const colCount = (children.length > 0 ? 1 : 0) + 
                   (grandchildren.length > 0 ? 1 : 0) + 
                   (greatGrandchildren.length > 0 ? 1 : 0);
  const sizeClass = colCount >= 3 ? 'modal-large' : colCount === 2 ? 'modal-medium' : '';

  return (
    <div className="modal-backdrop show" onClick={onClose}>
      <div className={`modal-content ${sizeClass}`.trim()} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{person.name}</h2>
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

          {!person.birth && !person.death && !person.burial && !person.residence && spouses.length === 0 && children.length === 0 && grandchildren.length === 0 && greatGrandchildren.length === 0 && !person.military && uniqueSources.length === 0 && (
            <p>No detailed records available for this person.</p>
          )}
        </div>
      </div>
    </div>
  );
}