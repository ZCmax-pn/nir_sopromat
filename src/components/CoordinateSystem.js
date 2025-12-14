import React from 'react';
import './CoordinateSystem.css';

function CoordinateSystem() {
  return (
    <div className="coordinate-system">
      <div className="coordinate-info">
        <div className="coordinate-origin">
          <span className="coordinate-label">Начало (0,0)</span>
        </div>
        <div className="coordinate-grid">
          <div className="grid-line x-axis"></div>
          <div className="grid-line y-axis"></div>
        </div>
      </div>
    </div>
  );
}

export default CoordinateSystem;

