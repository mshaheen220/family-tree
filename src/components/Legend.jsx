import React from 'react';
import { originLabels, ORIGIN_CONFIG } from '../utils/constants.js';

export default function Legend({ nodes }) {
  // Find all unique origins present in the current dataset
  const presentOrigins = new Set();
  nodes?.forEach(node => {
    if (node.origin === 'dual') {
      presentOrigins.add('polish'); // 'dual' identity uses the Polish flag design
    } else if (node.origin) {
      presentOrigins.add(node.origin);
    }
  });

  const uniqueOrigins = Array.from(presentOrigins).sort();

  return (
    <div
      className="legend"
      onMouseDown={e => e.stopPropagation()}
    >
      <h2>Legend</h2>
      <div className="legend-row"><div className="legend-line descent"></div><span>Descent</span></div>
      <div className="legend-row"><div className="legend-line marriage"></div><span>Marriage / Union</span></div>
      
      {uniqueOrigins.length > 0 && (
        <>
          <div className="legend-section-title">
            Geographic Origin
          </div>
          {uniqueOrigins.map(origin => (
            <div className="legend-row" key={origin}>
              <span className="origin-tag" style={ORIGIN_CONFIG[origin]?.badge || {}}>
                {originLabels[origin] || origin}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}