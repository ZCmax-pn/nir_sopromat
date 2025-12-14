import React from 'react';
import './MobileMenu.css';

function MobileMenu({ isOpen, onClose, onClear, onCalculate, onSave }) {
  if (!isOpen) return null;

  return (
    <div className="mobile-menu active" onClick={(e) => {
      if (e.target.classList.contains('mobile-menu')) {
        onClose();
      }
    }}>
      <div className="mobile-menu-content">
        <div className="mobile-menu-close" onClick={onClose}>
          <i className="fas fa-times"></i>
        </div>
        <button className="clean" onClick={() => { onClear(); onClose(); }}>
          Очистить всё
        </button>
        <button className="text-download-json" onClick={() => { onSave(); onClose(); }}>
          Сохранить расчет в виде Json
        </button>
        <button className="calculation" onClick={() => { onCalculate(); onClose(); }}>
          Выполнить расчет
        </button>
      </div>
    </div>
  );
}

export default MobileMenu;

