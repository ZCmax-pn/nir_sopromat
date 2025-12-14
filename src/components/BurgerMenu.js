import React from 'react';
import './BurgerMenu.css';

function BurgerMenu({ isOpen, onToggle }) {
  return (
    <div className="burger-wrapper">
      <div className="burger-menu" onClick={onToggle}>
        <i className="fas fa-bars"></i>
      </div>
    </div>
  );
}

export default BurgerMenu;

