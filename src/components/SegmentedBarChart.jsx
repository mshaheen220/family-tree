import React, { useState } from 'react';

export default function SegmentedBarChart({ data, colors }) {
  const [hoveredOrigin, setHoveredOrigin] = useState(null);

  return (
    <div>
      <div className="segmented-bar">
        {data.map(o => (
          <div 
            key={o.origin} 
            className={`segmented-segment ${hoveredOrigin && hoveredOrigin !== o.origin ? 'dimmed' : ''}`}
            style={{ 
              width: `${o.exactPct}%`, 
              background: colors[o.origin] || colors.generic,
            }}
            title={`${o.label}: ${o.percentage}%`}
            onMouseEnter={() => setHoveredOrigin(o.origin)}
            onMouseLeave={() => setHoveredOrigin(null)}
          ></div>
        ))}
      </div>
      <div className="segmented-legend">
        {data.map(o => (
          <div 
            key={o.origin} 
            className={`segmented-legend-item ${hoveredOrigin && hoveredOrigin !== o.origin ? 'dimmed' : ''}`}
            onMouseEnter={() => setHoveredOrigin(o.origin)}
            onMouseLeave={() => setHoveredOrigin(null)}
          >
            <div className={`segmented-legend-color ${hoveredOrigin === o.origin ? 'hovered' : ''}`} style={{ background: colors[o.origin] || colors.generic }}></div>
            <strong className={`segmented-legend-name ${hoveredOrigin === o.origin ? 'hovered' : ''}`}>{o.label}</strong>
            <span className="segmented-legend-pct">{o.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}