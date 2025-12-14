import React, { useState } from 'react';
import Header from './components/Header';
import Workspace from './components/Workspace';
import FormulaSection from './components/FormulaSection';
import ResultsSection from './components/ResultsSection';
import CoordinateSystem from './components/CoordinateSystem';
import './App.css';

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [calculationResults, setCalculationResults] = useState(null);
  const [formula, setFormula] = useState(null);

  return (
    <div className="App">
      <Header />
      <div className="main-container">
        <CoordinateSystem />
        <Workspace 
          onCalculationComplete={(result) => {
            setCalculationResults({ ...result, visible: true });
          }}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          formula={formula}
          calculationResults={calculationResults}
        />
        <FormulaSection 
          onFormulaChange={setFormula}
        />
        <ResultsSection 
          results={calculationResults}
        />
      </div>
    </div>
  );
}

export default App;

