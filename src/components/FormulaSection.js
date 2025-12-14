import React, { useState, useEffect } from 'react';
import './FormulaSection.css';

function FormulaSection({ onFormulaChange }) {
  const [formula, setFormula] = useState('');
  const [displayFormula, setDisplayFormula] = useState('Формула не задана');

  useEffect(() => {
    if (window.MathJax && window.MathJax.typesetPromise) {
      const displayElement = document.getElementById('formulaDisplay');
      if (displayElement) {
        window.MathJax.typesetPromise([displayElement]).catch(err => console.error(err));
      }
    }
  }, [displayFormula]);

  const applyFormula = () => {
    const trimmed = formula.trim();
    if (!trimmed) {
      alert('Введите уравнение');
      return;
    }

    try {
      const safeLatex = trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const displayLatex = safeLatex.replace(/\*/g, '\\cdot ');
      setDisplayFormula(`\\(${displayLatex}\\)`);
      onFormulaChange(trimmed);
      setFormula('');
    } catch (error) {
      alert('Ошибка в формуле: ' + error.message);
    }
  };

  const clearFormula = () => {
    setFormula('');
    setDisplayFormula('Формула не задана');
    onFormulaChange(null);
  };

  return (
    <div className="formula-section">
      <div className="formula-input-container">
        <h3>Уравнение балки</h3>
        <div className="formula-controls">
          <input
            type="text"
            id="formulaInput"
            placeholder="Введите уравнение (например: y = 2*x^2 + 3*x - 5)"
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                applyFormula();
              }
            }}
          />
          <button id="applyFormula" onClick={applyFormula}>Применить</button>
          <button id="clearFormula" onClick={clearFormula}>Очистить</button>
        </div>
        <div className="formula-preview">
          <div id="formulaDisplay">{displayFormula}</div>
        </div>
        <div className="formula-examples">
          <strong>Примеры:</strong>
          <ul>
            <li>y = 2*x^2 + 3*x - 5</li>
            <li>y = sin(x) + cos(2*x)</li>
            <li>y = 0.001*x^3 - 0.1*x</li>
            <li>y = 0.0001*(x^4 - 2*x^3 + x)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default FormulaSection;

