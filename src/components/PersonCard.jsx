import React from 'react';

const originLabels = {
  polish: 'Polish', czech: 'Czech', slovak: 'Slovak',
  austrian: 'Austrian', lebanese: 'Lebanese', american: 'American',
  german: 'German', french: 'French', swiss: 'Swiss', irish: 'Irish',
  english: 'English', scottish: 'Scottish', italian: 'Italian',
  spanish: 'Spanish', canadian: 'Canadian', mexican: 'Mexican',
  russian: 'Russian', chinese: 'Chinese', generic: 'Other'
};

export default function PersonCard({ person, isRoot, onClick }) {
  return (
    <div 
      className={`card ${isRoot ? 'selected' : ''}`} 
      style={{ left: person.x, top: person.y }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className="name">{person.name}</div>
      { (person.birth || person.death) && (
        <div className="dates">
          {person.birth && `b. ${person.birth}`}<br />
          {person.death && `d. ${person.death}`}
        </div>
      )}
      { (person.place || person.deathPlace) && <div className="place">{person.place || person.deathPlace}</div> }
      
      { person.origin === 'dual' ? (
        <>
          <span className="origin-tag origin-polish">Polish</span>
          <span className="origin-note">subject of Austro-Hungarian Empire</span>
        </>
      ) : person.origin ? (
        <span className={`origin-tag origin-${person.origin}`}>{originLabels[person.origin] || person.origin}</span>
      ) : null }
    </div>
  );
}