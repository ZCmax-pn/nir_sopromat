import React, { useEffect, useRef } from 'react';
import { useConstruction } from '../hooks/useConstruction';
import ConstructionCanvas from './ConstructionCanvas';
import PointControls from './PointControls';
import CoordinatesIndicator from './CoordinatesIndicator';
import BurgerMenu from './BurgerMenu';
import MobileMenu from './MobileMenu';
import './Workspace.css';

function Workspace({ onCalculationComplete, mobileMenuOpen, setMobileMenuOpen, formula, calculationResults }) {
  const construction = useConstruction();
  const workspaceRef = useRef(null);

  useEffect(() => {
    if (!construction || !construction.setCtrlPressed) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'Control') {
        construction.setCtrlPressed(true);
      }
      if (e.key === 'Escape') {
        construction.setShowPointControls(false);
        setMobileMenuOpen(false);
      }
      // Включаем панорамирование при нажатии Shift
      if (e.key === 'Shift' && !construction.isPanning) {
        construction.setIsPanning(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Control') {
        construction.setCtrlPressed(false);
      }
      // Отключаем панорамирование при отпускании Shift
      if (e.key === 'Shift') {
        construction.setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [construction, setMobileMenuOpen]);

  // Сохраняем ссылку на construction для FormulaSection
  React.useEffect(() => {
    window.constructionRef = construction;
    return () => {
      window.constructionRef = null;
    };
  }, [construction]);
  
  // Обработка формулы
  React.useEffect(() => {
    if (!construction || !construction.parseFormula) return;
    
    if (formula) {
      try {
        const formulaFunc = construction.parseFormula(formula);
        if (formulaFunc) {
          construction.setFormulaFunction(formulaFunc);
          // Генерируем точки только если есть минимум 2 точки с валидными координатами
          if (construction.points && construction.points.length >= 2) {
            const startPoint = construction.points[0];
            const endPoint = construction.points[1];
            if (startPoint && endPoint && 
                startPoint.worldX !== undefined && endPoint.worldX !== undefined &&
                isFinite(startPoint.worldX) && isFinite(endPoint.worldX) &&
                Math.abs(startPoint.worldX) <= 1e6 && Math.abs(endPoint.worldX) <= 1e6) {
              try {
                construction.generateFormulaPoints(formulaFunc);
              } catch (e) {
                console.error('Error generating formula points:', e);
                construction.setFormulaPoints([]);
              }
            } else {
              construction.setFormulaPoints([]);
            }
          } else {
            construction.setFormulaPoints([]);
          }
        }
      } catch (error) {
        console.error('Formula parsing error:', error);
        construction.setFormulaFunction(null);
        construction.setFormulaPoints([]);
      }
    } else {
      construction.setFormulaFunction(null);
      construction.setFormulaPoints([]);
    }
  }, [formula, construction]);
  
  // Обновляем график формулы при изменении точек
  React.useEffect(() => {
    if (!construction || !construction.formulaFunction) {
      if (construction) {
        construction.setFormulaPoints([]);
      }
      return;
    }
    
    if (construction.points && construction.points.length >= 2) {
      const startPoint = construction.points[0];
      const endPoint = construction.points[1];
      
      // Проверяем валидность координат перед генерацией
      if (startPoint && endPoint && 
          startPoint.worldX !== undefined && endPoint.worldX !== undefined &&
          isFinite(startPoint.worldX) && isFinite(endPoint.worldX) &&
          Math.abs(startPoint.worldX) <= 1e6 && Math.abs(endPoint.worldX) <= 1e6) {
        try {
          construction.generateFormulaPoints(construction.formulaFunction);
        } catch (error) {
          console.error('Error generating formula points:', error);
          construction.setFormulaPoints([]);
        }
      } else {
        construction.setFormulaPoints([]);
      }
    } else {
      construction.setFormulaPoints([]);
    }
  }, [construction?.points, construction?.formulaFunction]);

  const handleCalculation = () => {
    if (!construction || !construction.performCalculation) return;
    const result = construction.performCalculation();
    if (result) {
      onCalculationComplete(result);
    }
  };

  const handleSave = () => {
    if (!construction || !construction.points || !construction.beams || !construction.supports) return;
    
    const data = {
      construction: {
        points: (construction.points || []).map(p => ({
          id: p.id,
          x: Math.round(p.worldX),
          y: Math.round(p.worldY)
        })),
        beams: (construction.beams || []).map(b => ({
          id: b.id,
          startId: b.start.id,
          endId: b.end.id,
          length: b.length
        })),
        supports: (construction.supports || []).map(s => ({
          id: s.id,
          pointId: s.pointId,
          type: s.type,
          x: Math.round(s.worldX),
          y: Math.round(s.worldY)
        })),
        beamLength: construction.beamLengthRef?.current || 400
      }
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'construction_calculation.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="workspace" ref={workspaceRef}>
        <BurgerMenu 
          isOpen={mobileMenuOpen}
          onToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <ConstructionCanvas 
          construction={construction}
          formula={formula}
          calculationResults={calculationResults}
        />
        <CoordinatesIndicator coordinates={construction?.coordinates || { x: 0, y: 0 }} />
        {construction?.showPointControls && construction?.pointControlsPosition && (
          <PointControls
            position={construction.pointControlsPosition}
            selectedPoint={construction.selectedPoint}
            onSupportSelect={(type) => {
              if (construction.selectedPoint) {
                if (type === 'beam' && construction.addBeam) {
                  construction.addBeam();
                } else if (construction.addOrUpdateSupport) {
                  construction.addOrUpdateSupport(construction.selectedPoint, type);
                }
                if (construction.setShowPointControls) {
                  construction.setShowPointControls(false);
                }
                if (construction.setSelectedPoint) {
                  construction.setSelectedPoint(null);
                }
              }
            }}
          />
        )}
      </div>
      <MobileMenu
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onClear={construction?.clearAll || (() => {})}
        onCalculate={handleCalculation}
        onSave={handleSave}
      />
    </>
  );
}

export default Workspace;

