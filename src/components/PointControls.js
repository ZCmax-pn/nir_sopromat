import React from 'react';
import './PointControls.css';

function PointControls({ position, selectedPoint, onSupportSelect }) {
  const supportTypes = [
    { type: 'support1', label: 'Шарнирно-неподвижная', icon: '/images/Group 1.svg' },
    { type: 'support2', label: 'Шарнирно-подвижная', icon: '/images/Group 2.svg' },
    { type: 'support3', label: 'Жесткая заделка', icon: '/images/Group 3.svg' },
    { type: 'support4', label: 'Врезанный шарнир', icon: '/images/Ellipse 3.svg' },
    { type: 'beam', label: 'Соединить точки', icon: null }
  ];

  return (
    <div 
      className="buttons-opora visible"
      style={{
        left: `${position.x + 10}px`,
        top: `${position.y + 10}px`
      }}
    >
      {supportTypes.map(support => (
        <button
          key={support.type}
          className="opora-btn"
          onClick={() => onSupportSelect(support.type)}
        >
          {support.icon && (
            <img 
              src={support.icon} 
              alt={support.label} 
              className="opora-icon"
            />
          )}
          {support.label}
        </button>
      ))}
    </div>
  );
}

export default PointControls;

