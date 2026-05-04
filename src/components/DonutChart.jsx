import React, { useState } from 'react';

export default function DonutChart({ data, colors }) {
  const [hoveredOrigin, setHoveredOrigin] = useState(null);

  return (
    <div className="donut-container">
      <div className="donut-chart-wrap">
        <svg viewBox="0 0 42 42" width="100%" height="100%" className="donut-svg">
          <circle cx="21" cy="21" r="15.915494309189533" fill="transparent" stroke="var(--card-border)" strokeWidth="6" />
          {data.map(o => (
            <circle
              className="donut-segment"
              key={o.origin}
              cx="21" cy="21" r="15.915494309189533"
              fill="transparent"
              stroke={colors[o.origin] || colors.generic}
              strokeWidth={hoveredOrigin === o.origin ? "8" : "6"}
              strokeDasharray={`${o.exactPct} ${100 - o.exactPct}`}
              strokeDashoffset={-o.offset}
              onMouseEnter={() => setHoveredOrigin(o.origin)}
              onMouseLeave={() => setHoveredOrigin(null)}
            />
          ))}
        </svg>
        
        <div className="donut-center">
          {hoveredOrigin ? (
            <>
              <span className="donut-label">
                {data.find(o => o.origin === hoveredOrigin)?.label}
              </span>
              <strong className="donut-percent">
                {data.find(o => o.origin === hoveredOrigin)?.percentage}%
              </strong>
            </>
          ) : (
            <span className="donut-hover-prompt">Hover to view</span>
          )}
        </div>
      </div>
      
      <div className="donut-legend">
        {data.map(o => (
          <div 
            key={o.origin} 
            className={`donut-legend-item ${hoveredOrigin && hoveredOrigin !== o.origin ? 'dimmed' : ''}`}
            onMouseEnter={() => setHoveredOrigin(o.origin)}
            onMouseLeave={() => setHoveredOrigin(null)}
          >
            <div className="donut-legend-label">
              <div className={`donut-legend-color ${hoveredOrigin === o.origin ? 'hovered' : ''}`} style={{ background: colors[o.origin] || colors.generic }}></div>
              <strong className={`donut-legend-name ${hoveredOrigin === o.origin ? 'hovered' : ''}`}>{o.label}</strong>
            </div>
            <span>{o.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}