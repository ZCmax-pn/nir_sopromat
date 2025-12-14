import React, { useEffect, useCallback, useRef } from 'react';

function ConstructionCanvas({ construction, formula, calculationResults }) {
  const canvasRef = construction.canvasRef;
  const animationIdRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !construction) return;

    // Обновляем размеры canvas если нужно
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Проверяем, нужно ли обновить размеры canvas
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      
      // Обновляем координаты начала системы координат
      if (construction.coordinateOriginRef) {
        construction.coordinateOriginRef.current.screenX = width / 2;
        construction.coordinateOriginRef.current.screenY = height / 2;
      }
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);

    // Рисуем систему координат
    if (construction.coordinateOriginRef?.current) {
      drawCoordinateSystem(ctx, width, height, construction.coordinateOriginRef.current);
    }

    // Рисуем балки
    if (construction.beams) {
      construction.beams.forEach(beam => drawBeam(ctx, beam, construction.hoveredBeam === beam));
    }

    // Рисуем опоры
    if (construction.supports && construction.points) {
      construction.supports.forEach(support => {
        const point = construction.points.find(p => p.id === support.pointId);
        if (point && construction.supportImagesRef) {
          drawSupport(ctx, support, point, construction.supportImagesRef.current);
        }
      });
    }

    // Рисуем силы реакции на опорах если есть результаты расчета
    if (calculationResults && calculationResults.reactionForces && construction.supports && construction.points) {
      construction.supports.forEach((support, index) => {
        const point = construction.points.find(p => p.id === support.pointId);
        if (point) {
          // Определяем какая сила соответствует опоре
          let forceValue = 0;
          if (index === 0) {
            forceValue = calculationResults.reactionForces.RA || 0;
          } else if (index === 1) {
            forceValue = calculationResults.reactionForces.RB || 0;
          }
          
          if (forceValue !== 0) {
            drawReactionForce(ctx, point, forceValue, support.type, calculationResults.reactionForces.MA);
          }
        }
      });
    }

    // Рисуем точки
    if (construction.points) {
      construction.points.forEach(point => {
        drawPoint(ctx, point, construction.currentTimeRef?.current || performance.now());
      });
    }

    // Рисуем предпросмотр точки
    if (construction.tempPoint) {
      drawTempPoint(ctx, construction.tempPoint);
    }

    // Рисуем выделение
    if (construction.selectedPoint) {
      drawSelection(ctx, construction.selectedPoint);
    }

    if (construction.hoveredPoint) {
      drawHoverEffect(ctx, construction.hoveredPoint);
    }

    // Рисуем координаты точек
    if (construction.points) {
      construction.points.forEach(point => drawCoordinates(ctx, point));
    }

    // Рисуем длину балки
    if (construction.beams && construction.beams.length > 0 && construction.points && construction.points.length >= 2) {
      const beam = construction.beams[0];
      drawBeamLength(ctx, beam.start, beam.end, construction);
    }

    ctx.restore();
    if (construction.currentTimeRef) {
      construction.currentTimeRef.current = performance.now();
    }
    animationIdRef.current = requestAnimationFrame(draw);
  }, [canvasRef, construction]);

  useEffect(() => {
    if (!construction) return;
    
    draw();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [draw, construction, construction.formulaPoints, calculationResults]);

  return (
    <canvas
      ref={canvasRef}
      id="constructionCanvas"
      style={{
        background: 'white',
        border: '2px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '8px',
        cursor: construction.isPanning ? 'grabbing' : 
                construction.isDraggingPoint ? 'grabbing' : 
                construction.hoveredPoint ? 'grab' : 
                construction.hoveredBeam ? 'pointer' : 
                construction.ctrlPressed ? 'crosshair' : 
                (construction.points && construction.points.length < 2) ? 'crosshair' : 'default',
        width: '100%',
        height: '100%',
        touchAction: 'none'
      }}
      onMouseDown={(e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Проверяем, нажата ли средняя кнопка мыши или Shift для панорамирования
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
          e.preventDefault();
          e.stopPropagation();
          construction.setIsPanning(true);
          construction.setPanStart({ x: e.clientX, y: e.clientY });
          return;
        }
        
        // Если не панорамирование, обрабатываем как обычно
        if (!construction.isPanning) {
          handleMouseDown(x, y, construction);
        }
      }}
      onMouseMove={(e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Проверяем, зажат ли Shift для панорамирования
        if (e.shiftKey && !construction.isPanning) {
          construction.setIsPanning(true);
          construction.setPanStart({ x: e.clientX, y: e.clientY });
        }
        
        if (construction.isPanning) {
          const deltaX = e.clientX - construction.panStart.x;
          const deltaY = e.clientY - construction.panStart.y;
          
          if (construction.coordinateOriginRef) {
            construction.coordinateOriginRef.current.screenX += deltaX;
            construction.coordinateOriginRef.current.screenY += deltaY;
          }
          
          construction.setPanStart({ x: e.clientX, y: e.clientY });
        } else {
          handleMouseMove(x, y, construction);
        }
      }}
      onMouseUp={(e) => {
        construction.setIsDraggingPoint(false);
        construction.setDraggingPoint(null);
        // Отключаем панорамирование только если Shift не зажат
        if (!e.shiftKey) {
          construction.setIsPanning(false);
        }
      }}
      onMouseLeave={(e) => {
        construction.setIsDraggingPoint(false);
        construction.setDraggingPoint(null);
        construction.setIsPanning(false);
      }}
      onContextMenu={(e) => {
        e.preventDefault(); // Предотвращаем контекстное меню при правом клике
      }}
      onClick={(e) => {
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        handleCanvasClick(x, y, e, construction);
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        const rect = canvasRef.current.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        handleMouseDown(x, y, construction);
      }}
      onTouchMove={(e) => {
        e.preventDefault();
        const rect = canvasRef.current.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        handleMouseMove(x, y, construction);
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        construction.setIsDraggingPoint(false);
        construction.setDraggingPoint(null);
      }}
    />
  );
}

function handleMouseDown(x, y, construction) {
  if (!construction || !construction.points) return;
  const clickedPoint = getPointAt(x, y, construction.points);
  if (clickedPoint && construction.setIsDraggingPoint && construction.setDraggingPoint) {
    construction.setIsDraggingPoint(true);
    construction.setDraggingPoint(clickedPoint);
  }
}

function handleMouseMove(x, y, construction) {
  if (!construction || !construction.screenToWorld || !construction.setCoordinates) return;
  
  const worldCoords = construction.screenToWorld(x, y);
  construction.setCoordinates({ x: Math.round(worldCoords.x), y: Math.round(worldCoords.y) });

  if (construction.isDraggingPoint && construction.draggingPoint) {
    const point = construction.draggingPoint;
    point.x = x;
    point.y = y;
    const worldPos = construction.screenToWorld(x, y);
    point.worldX = worldPos.x;
    point.worldY = worldPos.y;
    if (construction.setPoints) {
      construction.setPoints([...construction.points]);
    }
  }

  const hovered = getPointAt(x, y, construction.points || []);
  if (construction.setHoveredPoint) {
    construction.setHoveredPoint(hovered);
  }

  if ((construction.points && construction.points.length < 2) || construction.ctrlPressed) {
    if (construction.setTempPoint) {
      construction.setTempPoint({ x, y });
    }
  } else {
    if (construction.setTempPoint) {
      construction.setTempPoint(null);
    }
  }
}

function handleCanvasClick(x, y, e, construction) {
  if (!construction) return;
  if (construction.isDraggingPoint) return;

  const clickedPoint = getPointAt(x, y, construction.points || []);
  if (clickedPoint) {
    if (construction.setPointControlsPosition && construction.setSelectedPoint && construction.setShowPointControls) {
      const rect = construction.canvasRef.current?.getBoundingClientRect();
      if (rect) {
        construction.setPointControlsPosition({ x: e.clientX, y: e.clientY });
      }
      construction.setSelectedPoint(clickedPoint);
      construction.setShowPointControls(true);
    }
  } else {
    if ((construction.ctrlPressed || (construction.points && construction.points.length < 2)) && 
        construction.screenToWorld && construction.addPoint) {
      const worldCoords = construction.screenToWorld(x, y);
      construction.addPoint(x, y, worldCoords.x, worldCoords.y);
      if (construction.setShowPointControls) {
        construction.setShowPointControls(false);
      }
    }
  }
}

function getPointAt(x, y, points) {
  return points.find(point => {
    const distance = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
    return distance <= point.radius + 10;
  });
}

function drawCoordinateSystem(ctx, width, height, origin) {
  const centerX = origin.screenX;
  const centerY = origin.screenY;
  const axisLength = 150;
  const gridSize = 50;

  // Сетка
  ctx.strokeStyle = 'rgba(45, 140, 140, 0.1)';
  ctx.lineWidth = 1;

  for (let i = -Math.floor(centerY / gridSize); i < Math.floor((height - centerY) / gridSize); i++) {
    const y = centerY + i * gridSize;
    if (y >= 0 && y <= height) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  for (let i = -Math.floor(centerX / gridSize); i < Math.floor((width - centerX) / gridSize); i++) {
    const x = centerX + i * gridSize;
    if (x >= 0 && x <= width) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }

  // Оси
  ctx.strokeStyle = 'rgba(45, 140, 140, 0.5)';
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(centerX - axisLength, centerY);
  ctx.lineTo(centerX + axisLength, centerY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX, centerY - axisLength);
  ctx.lineTo(centerX, centerY + axisLength);
  ctx.stroke();

  // Стрелки
  ctx.fillStyle = '#2D8C8C';
  ctx.beginPath();
  ctx.moveTo(centerX + axisLength - 10, centerY - 5);
  ctx.lineTo(centerX + axisLength, centerY);
  ctx.lineTo(centerX + axisLength - 10, centerY + 5);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(centerX - 5, centerY - axisLength + 10);
  ctx.lineTo(centerX, centerY - axisLength);
  ctx.lineTo(centerX + 5, centerY - axisLength + 10);
  ctx.fill();

  // Подписи
  ctx.fillStyle = '#2D8C8C';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('X', centerX + axisLength - 5, centerY - 10);
  ctx.textAlign = 'center';
  ctx.fillText('Y', centerX + 15, centerY - axisLength + 10);

  // Начало координат
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'right';
  ctx.fillText('(0,0)', centerX - 8, centerY - 10);
}

function drawBeam(ctx, beam, isHovered) {
  ctx.strokeStyle = isHovered ? '#007bff' : '#000000';
  ctx.lineWidth = isHovered ? 4 : 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(beam.start.x, beam.start.y);
  ctx.lineTo(beam.end.x, beam.end.y);
  ctx.stroke();
}

function drawSupport(ctx, support, point, supportImages) {
  const supportWidth = 40;
  const supportHeight = 40;
  const x = point.x;
  const y = point.y;

  // Обновляем позицию опоры относительно точки
  support.x = x;
  support.y = y + supportHeight;
  support.pointY = y;

  // Используем SVG изображения если они загружены
  const img = supportImages?.[support.type];
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.save();
    ctx.drawImage(
      img,
      x - supportWidth / 2,
      y,
      supportWidth,
      supportHeight
    );
    ctx.restore();
  } else {
    // Fallback - рисуем простые опоры
    ctx.save();
    ctx.translate(x, y);

    if (support.type === 'support1') {
      // Шарнирно-неподвижная опора
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-supportWidth / 2, 0);
      ctx.lineTo(0, supportHeight);
      ctx.lineTo(supportWidth / 2, 0);
      ctx.closePath();
      ctx.fillStyle = '#cccccc';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
    } else if (support.type === 'support2') {
      // Шарнирно-подвижная опора
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.fillStyle = '#cccccc';
      ctx.fillRect(-supportWidth / 2, 0, supportWidth, supportHeight / 2);
      ctx.strokeRect(-supportWidth / 2, 0, supportWidth, supportHeight / 2);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(i * 12, supportHeight / 2, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#666666';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
    } else if (support.type === 'support3') {
      // Жесткая заделка
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.fillStyle = '#888888';
      ctx.fillRect(-supportWidth / 2, 0, supportWidth, supportHeight);
      ctx.strokeRect(-supportWidth / 2, 0, supportWidth, supportHeight);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 8, 0);
        ctx.lineTo(i * 8, -8);
        ctx.stroke();
      }
    } else if (support.type === 'support4') {
      // Врезанный шарнир
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#000000';
      ctx.fill();
    }

    ctx.restore();
  }
}

function drawFormulaGraph(ctx, formulaPoints) {
  if (!formulaPoints || formulaPoints.length < 2) return;
  
  ctx.strokeStyle = '#e74c3c';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  
  ctx.moveTo(formulaPoints[0].x, formulaPoints[0].y);
  
  for (let i = 1; i < formulaPoints.length; i++) {
    ctx.lineTo(formulaPoints[i].x, formulaPoints[i].y);
  }
  
  ctx.stroke();
}

function drawPoint(ctx, point, currentTime) {
  const now = currentTime || performance.now();
  const elapsed = point.appearedAt ? Math.max(0, now - point.appearedAt) : 300;
  const duration = 200;
  const t = Math.min(1, elapsed / duration);
  const scale = 0.6 + 0.4 * (1 - Math.pow(1 - t, 2));
  const alpha = 0.3 + 0.7 * t;

  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, point.radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, point.radius - 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawSelection(ctx, point) {
  ctx.strokeStyle = '#007bff';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.arc(point.x, point.y, point.radius + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawHoverEffect(ctx, point) {
  ctx.strokeStyle = '#ff0000';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.arc(point.x, point.y, point.radius + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawTempPoint(ctx, point) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawCoordinates(ctx, point) {
  const mmX = Math.round(point.worldX);
  const mmY = Math.round(point.worldY);

  ctx.fillStyle = '#333333';
  ctx.font = '12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`(${mmX}, ${mmY}) мм`, point.x, point.y - 15);
}

function drawBeamLength(ctx, startPoint, endPoint, construction) {
  if (!construction || !construction.screenToWorld) return;
  
  const midX = (startPoint.x + endPoint.x) / 2;

  const worldStart = construction.screenToWorld(startPoint.x, startPoint.y);
  const worldEnd = construction.screenToWorld(endPoint.x, endPoint.y);

  const dx = worldEnd.x - worldStart.x;
  const dy = worldEnd.y - worldStart.y;
  const lengthMm = Math.round(Math.sqrt(dx * dx + dy * dy));

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);

  const offset = 20;
  ctx.beginPath();
  ctx.moveTo(startPoint.x, startPoint.y - offset);
  ctx.lineTo(startPoint.x, startPoint.y - offset - 15);
  ctx.moveTo(endPoint.x, endPoint.y - offset);
  ctx.lineTo(endPoint.x, endPoint.y - offset - 15);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(startPoint.x, startPoint.y - offset - 10);
  ctx.lineTo(endPoint.x, endPoint.y - offset - 10);
  ctx.stroke();

  ctx.setLineDash([]);

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${lengthMm} мм`, midX, startPoint.y - offset - 25);
}

function drawReactionForce(ctx, point, forceValue, supportType, momentValue) {
  if (!forceValue || forceValue === 0) return;
  
  const arrowLength = Math.min(80, Math.max(30, Math.abs(forceValue) / 20));
  const direction = forceValue > 0 ? -1 : 1; // Вверх если положительная, вниз если отрицательная
  
  ctx.save();
  
  // Стрелка силы реакции (вертикальная)
  ctx.strokeStyle = '#007bff';
  ctx.fillStyle = '#007bff';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  
  const startY = point.y;
  const endY = startY + direction * arrowLength;
  
  // Линия стрелки
  ctx.beginPath();
  ctx.moveTo(point.x, startY);
  ctx.lineTo(point.x, endY);
  ctx.stroke();
  
  // Наконечник стрелки
  const arrowSize = 8;
  ctx.beginPath();
  ctx.moveTo(point.x, endY);
  ctx.lineTo(point.x - arrowSize / 2, endY - direction * arrowSize);
  ctx.lineTo(point.x + arrowSize / 2, endY - direction * arrowSize);
  ctx.closePath();
  ctx.fill();
  
  // Текст с значением силы
  ctx.fillStyle = '#007bff';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${Math.abs(forceValue)} Н`, 
    point.x, 
    endY - direction * (arrowSize + 15)
  );
  
  // Для жесткой заделки рисуем также момент
  if (supportType === 'support3' && momentValue && momentValue !== 0) {
    drawMoment(ctx, point, momentValue);
  }
  
  ctx.restore();
}

function drawMoment(ctx, point, momentValue) {
  const radius = 25;
  const centerX = point.x + 50;
  const centerY = point.y;
  
  ctx.strokeStyle = '#28a745';
  ctx.fillStyle = '#28a745';
  ctx.lineWidth = 2;
  
  // Рисуем дугу (круг) для обозначения момента
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();
  
  // Стрелка по дуге
  const arrowAngle = Math.PI / 4;
  const arrowX = centerX + radius * Math.cos(arrowAngle);
  const arrowY = centerY + radius * Math.sin(arrowAngle);
  
  ctx.beginPath();
  ctx.moveTo(arrowX, arrowY);
  ctx.lineTo(arrowX - 5, arrowY - 5);
  ctx.lineTo(arrowX - 2, arrowY - 8);
  ctx.closePath();
  ctx.fill();
  
  // Текст с моментом
  ctx.fillStyle = '#28a745';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${Math.abs(momentValue)} Н·м`, 
    centerX, 
    centerY + radius + 20
  );
}

export default ConstructionCanvas;

