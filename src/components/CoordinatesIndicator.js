import React from 'react';
import './CoordinatesIndicator.css';

function CoordinatesIndicator({ coordinates }) {
  return (
    <div className="coordinates-indicator">
      X: {coordinates.x} мм, Y: {coordinates.y} мм
    </div>
  );
}

export default CoordinatesIndicator;

