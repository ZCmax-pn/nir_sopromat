import React from 'react';
import './ResultsSection.css';

function ResultsSection({ results }) {
  if (!results || !results.visible) return null;

  const { success, message, reactionForces, calculationResults, beamLength } = results;

  return (
    <div className="results-section visible">
      <h3>Результаты расчета</h3>
      <div className="results-content">
        {success ? (
          <>
            {message && (
              <div className="result-feedback">{message}</div>
            )}
            <div className="result-item">
              <strong>Длина балки:</strong> {beamLength} мм
            </div>
            <div className="result-item">
              <strong>Тип нагрузки:</strong> {reactionForces.loadType}
            </div>
            <div className="result-item">
              <strong>Интенсивность нагрузки:</strong> {reactionForces.loadValue} Н/м
            </div>
            <div className="result-item">
              <strong>Суммарная нагрузка:</strong> {reactionForces.totalLoad} Н
            </div>
            {reactionForces.RA !== 0 && (
              <div className="result-item">
                <strong>Реакция опоры A:</strong> {reactionForces.RA} Н
              </div>
            )}
            {reactionForces.RB !== 0 && (
              <div className="result-item">
                <strong>Реакция опоры B:</strong> {reactionForces.RB} Н
              </div>
            )}
            {reactionForces.MA !== 0 && (
              <div className="result-item">
                <strong>Момент в заделке:</strong> {reactionForces.MA} Н·м
              </div>
            )}
            <div className="result-item">
              <strong>Максимальная поперечная сила:</strong> {calculationResults.maxShearForce} Н
            </div>
            <div className="result-item">
              <strong>Максимальный изгибающий момент:</strong> {calculationResults.maxBendingMoment} Н·м
            </div>
            <div className="forces-diagram">
              <div className="diagram-title">Эпюра поперечных сил:</div>
              <div>Максимум: {calculationResults.maxShearForce} Н</div>
            </div>
            <div className="forces-diagram">
              <div className="diagram-title">Эпюра изгибающих моментов:</div>
              <div>Максимум: {calculationResults.maxBendingMoment} Н·м</div>
            </div>
          </>
        ) : (
          <div className="result-error">{message || 'Ошибка расчета'}</div>
        )}
      </div>
    </div>
  );
}

export default ResultsSection;

