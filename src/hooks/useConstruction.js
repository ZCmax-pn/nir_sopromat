import { useState, useRef, useEffect, useCallback } from 'react';

export function useConstruction() {
  const canvasRef = useRef(null);
  const [points, setPoints] = useState([]);
  const [beams, setBeams] = useState([]);
  const [supports, setSupports] = useState([]);
  const [selectedPoint, setSelectedPoint] = useState(null);
  const [tempPoint, setTempPoint] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [hoveredBeam, setHoveredBeam] = useState(null);
  const [isDraggingPoint, setIsDraggingPoint] = useState(false);
  const [draggingPoint, setDraggingPoint] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [ctrlPressed, setCtrlPressed] = useState(false);
  const [coordinates, setCoordinates] = useState({ x: 0, y: 0 });
  const [showPointControls, setShowPointControls] = useState(false);
  const [pointControlsPosition, setPointControlsPosition] = useState({ x: 0, y: 0 });
  const [formulaFunction, setFormulaFunction] = useState(null);
  const [formulaPoints, setFormulaPoints] = useState([]);
  
  const supportImagesRef = useRef({});
  const coordinateOriginRef = useRef({ screenX: 0, screenY: 0 });
  const beamLengthRef = useRef(400);
  const scaleRef = useRef(2);
  const supportHeightRef = useRef(40);
  const currentTimeRef = useRef(0);

  // Загрузка изображений опор
  useEffect(() => {
    const loadImages = async () => {
      const supportTypes = {
        'support1': '/images/black/Group%201.svg',
        'support2': '/images/black/Group%202.svg',
        'support3': '/images/black/Group%203.svg',
        'support4': '/images/black/Ellipse%203.svg'
      };

      const loadImage = (src) => {
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => {
            const fallbackImg = new Image();
            fallbackImg.width = 40;
            fallbackImg.height = 40;
            resolve(fallbackImg);
          };
          img.src = src;
        });
      };

      for (const [type, src] of Object.entries(supportTypes)) {
        supportImagesRef.current[type] = await loadImage(src);
      }
    };

    loadImages();
  }, []);


  // Конвертация координат (объявляем первыми, так как используются другими функциями)
  const mmToPx = useCallback((mm, isX = true) => {
    if (isX) {
      return coordinateOriginRef.current.screenX + mm * scaleRef.current;
    } else {
      return coordinateOriginRef.current.screenY - mm * scaleRef.current;
    }
  }, []);

  const pxToMm = useCallback((px, isX = true) => {
    if (isX) {
      return (px - coordinateOriginRef.current.screenX) / scaleRef.current;
    } else {
      return (coordinateOriginRef.current.screenY - px) / scaleRef.current;
    }
  }, []);

  const screenToWorld = useCallback((screenX, screenY) => {
    return {
      x: pxToMm(screenX, true),
      y: pxToMm(screenY, false)
    };
  }, [pxToMm]);

  const worldToScreen = useCallback((worldX, worldY) => {
    return {
      x: mmToPx(worldX, true),
      y: mmToPx(worldY, false)
    };
  }, [mmToPx]);

  // Добавление точки (объявляем до использования в useEffect)
  const addPoint = useCallback((x, y, worldX, worldY) => {
    const newPoint = {
      id: Date.now() + Math.random(),
      x: x,
      y: y,
      worldX: worldX,
      worldY: worldY,
      radius: 8,
      appearedAt: performance.now()
    };
    setPoints(prev => [...prev, newPoint]);
    return newPoint;
  }, []);

  // Настройка canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const setupCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      coordinateOriginRef.current.screenX = rect.width / 2;
      coordinateOriginRef.current.screenY = rect.height / 2;
    };

    setupCanvas();
    window.addEventListener('resize', setupCanvas);
    
    return () => window.removeEventListener('resize', setupCanvas);
  }, []);

  // Создаем начальную точку (0,0) после инициализации
  useEffect(() => {
    if (points.length === 0 && coordinateOriginRef.current.screenX > 0 && addPoint) {
      const timer = setTimeout(() => {
        const screenPos = {
          x: coordinateOriginRef.current.screenX,
          y: coordinateOriginRef.current.screenY
        };
        if (addPoint && points.length === 0) {
          addPoint(screenPos.x, screenPos.y, 0, 0);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [points.length, addPoint]);

  // Добавление опоры
  const addOrUpdateSupport = useCallback((point, type) => {
    setSupports(prev => {
      const filtered = prev.filter(s => s.pointId !== point.id);
      return [...filtered, {
        id: filtered.length + 1,
        pointId: point.id,
        x: point.x,
        y: point.y + supportHeightRef.current,
        type: type,
        pointY: point.y,
        worldX: point.worldX,
        worldY: point.worldY
      }];
    });
  }, []);

  // Добавление балки
  const addBeam = useCallback(() => {
    if (points.length < 2) {
      alert('Для создания балки нужно минимум 2 точки');
      return;
    }

    if (points.length === 2) {
      const startPoint = points[0];
      const endPoint = points[1];
      
      const beamExists = beams.some(beam => 
        (beam.start.id === startPoint.id && beam.end.id === endPoint.id) ||
        (beam.start.id === endPoint.id && beam.end.id === startPoint.id)
      );
      
      if (!beamExists) {
        const dx = endPoint.worldX - startPoint.worldX;
        const dy = endPoint.worldY - startPoint.worldY;
        const lengthMm = Math.round(Math.sqrt(dx * dx + dy * dy));
        
        setBeams(prev => [...prev, {
          id: prev.length + 1,
          start: startPoint,
          end: endPoint,
          length: lengthMm
        }]);
        beamLengthRef.current = lengthMm;
      }
    }
  }, [points, beams]);

  // Очистка всего
  const clearAll = useCallback(() => {
    setPoints([]);
    setBeams([]);
    setSupports([]);
    setSelectedPoint(null);
    setTempPoint(null);
    setHoveredPoint(null);
    setHoveredBeam(null);
    setShowPointControls(false);
    setFormulaFunction(null);
    setFormulaPoints([]);
    beamLengthRef.current = 400;
  }, []);

  // Парсинг формулы
  const parseFormula = useCallback((formulaStr) => {
    try {
      formulaStr = formulaStr.toLowerCase().replace(/\s/g, '');
      
      if (!formulaStr.startsWith('y=')) {
        throw new Error('Формула должна начинаться с "y ="');
      }
      
      const expression = formulaStr.substring(2);
      
      return (x) => {
        // Проверяем входное значение x - возвращаем NaN вместо throw
        if (!isFinite(x) || Math.abs(x) > 1e6) {
          return NaN;
        }
        
        try {
          let expr = expression
            .replace(/sin\(/g, 'Math.sin(')
            .replace(/cos\(/g, 'Math.cos(')
            .replace(/tan\(/g, 'Math.tan(')
            .replace(/log\(/g, 'Math.log10(')
            .replace(/ln\(/g, 'Math.log(')
            .replace(/sqrt\(/g, 'Math.sqrt(')
            .replace(/pi/g, Math.PI.toString())
            .replace(/e/g, Math.E.toString())
            .replace(/\^/g, '**');
          
          expr = expr.replace(/x/g, `(${x})`);
          const result = eval(expr);
          
          // Проверяем результат и возвращаем NaN вместо throw
          if (typeof result !== 'number' || isNaN(result) || !isFinite(result) || Math.abs(result) > 1e6) {
            return NaN;
          }
          
          return result;
        } catch (e) {
          // Не выбрасываем ошибку, просто возвращаем NaN для обработки в generateFormulaPoints
          return NaN;
        }
      };
    } catch (error) {
      throw error;
    }
  }, []);

  // Генерация точек для графика формулы
  const generateFormulaPoints = useCallback((formulaFunc) => {
    if (!formulaFunc) {
      setFormulaPoints([]);
      return;
    }
    
    if (!points || points.length < 2) {
      setFormulaPoints([]);
      return;
    }
    
    const startPoint = points[0];
    const endPoint = points[1];
    
    if (!startPoint || !endPoint) {
      setFormulaPoints([]);
      return;
    }
    
    const startX = startPoint.worldX;
    const endX = endPoint.worldX;
    
    // Проверяем валидность координат
    if (startX === undefined || endX === undefined || 
        !isFinite(startX) || !isFinite(endX) || 
        Math.abs(startX) > 1e6 || Math.abs(endX) > 1e6) {
      setFormulaPoints([]);
      return;
    }
    
    // Убеждаемся, что startX < endX
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const range = maxX - minX;
    
    // Ограничиваем диапазон разумными значениями (от 0.1 мм до 10000 мм)
    if (range > 10000 || range < 0.1 || !isFinite(range)) {
      setFormulaPoints([]);
      return;
    }
    
    const step = Math.max(0.1, range / 200);
    const newPoints = [];
    
    for (let x = minX; x <= maxX; x += step) {
      // Проверяем, что x в разумных пределах
      if (!isFinite(x) || Math.abs(x) > 1e6) {
        continue;
      }
      
      // Вычисляем y без try-catch, так как функция уже обрабатывает ошибки
      const y = formulaFunc(x);
      
      // Проверяем результат
      if (!isFinite(y) || Math.abs(y) > 1e6 || isNaN(y)) {
        continue;
      }
      
      try {
        const screenPos = worldToScreen(x, y);
        
        // Проверяем экранные координаты
        if (isFinite(screenPos.x) && isFinite(screenPos.y) && 
            !isNaN(screenPos.x) && !isNaN(screenPos.y)) {
          newPoints.push({ 
            x: screenPos.x, 
            y: screenPos.y,
            worldX: x,
            worldY: y
          });
        }
      } catch (e) {
        // Игнорируем ошибки преобразования координат
        continue;
      }
    }
    setFormulaPoints(newPoints);
  }, [points, worldToScreen]);

  // Расчет
  const performCalculation = useCallback(() => {
    if (points.length < 2 || beams.length === 0) {
      return { success: false, message: 'Подумай еще' };
    }

    const supportsCount = supports.length;
    let isStaticallyDeterminate = false;

    if (supportsCount === 0) {
      return { success: false, message: 'Нет опор - система неустойчива' };
    } else if (supportsCount === 1) {
      const support = supports[0];
      if (support.type === 'support3') {
        isStaticallyDeterminate = true;
      } else {
        return { success: false, message: 'Одна шарнирная опора - система неустойчива' };
      }
    } else if (supportsCount === 2) {
      const supportTypes = supports.map(s => s.type);
      const hasFixedSupport = supportTypes.includes('support3');
      const hasHingeSupport = supportTypes.includes('support1') || supportTypes.includes('support2');
      
      if (hasFixedSupport && hasHingeSupport) {
        isStaticallyDeterminate = true;
      } else if (supportTypes.filter(t => t === 'support1' || t === 'support2').length === 2) {
        isStaticallyDeterminate = true;
      } else {
        return { success: false, message: 'Неподходящая комбинация опор' };
      }
    } else {
      return { success: false, message: 'Слишком много опор - система статически неопределима' };
    }

    if (!isStaticallyDeterminate) {
      return { success: false, message: 'Подумай еще' };
    }

    // Расчет реакций
    const L = beamLengthRef.current;
    const L_m = L / 1000;
    const q = 1000; // Н/м
    const totalLoad = q * L_m;

    let RA = 0, RB = 0, MA = 0;

    if (supports.length === 2) {
      RA = totalLoad / 2;
      RB = totalLoad / 2;
      MA = 0;
    } else if (supports.length === 1 && supports[0].type === 'support3') {
      RA = totalLoad;
      RB = 0;
      MA = (q * L_m * L_m) / 2;
    }

    const reactionForces = {
      RA: Math.round(RA),
      RB: Math.round(RB),
      MA: Math.round(MA),
      totalLoad: Math.round(totalLoad),
      loadType: 'равномерно распределенная',
      loadValue: q
    };

    // Расчет внутренних усилий
    const pointsCount = 50;
    const shearForces = [];
    const bendingMoments = [];

    for (let i = 0; i <= pointsCount; i++) {
      const x = (i / pointsCount) * L;
      const x_m = x / 1000;
      
      let V, M;
      
      if (supports.length === 2) {
        V = reactionForces.RA - q * x_m;
        M = reactionForces.RA * x_m - (q * x_m * x_m) / 2;
      } else if (supports.length === 1 && supports[0].type === 'support3') {
        V = -q * x_m;
        M = -(q * x_m * x_m) / 2;
      } else {
        V = 0;
        M = 0;
      }
      
      shearForces.push({ x: x, value: Math.round(V) });
      bendingMoments.push({ x: x, value: Math.round(M) });
    }

    const maxShear = Math.max(...shearForces.map(f => Math.abs(f.value)));
    const maxMoment = Math.max(...bendingMoments.map(m => Math.abs(m.value)));

    return {
      success: true,
      message: 'Молодец, все правильно',
      reactionForces,
      calculationResults: {
        maxShearForce: maxShear,
        maxBendingMoment: maxMoment,
        calculationPoints: pointsCount
      },
      shearForces,
      bendingMoments,
      beamLength: L
    };
  }, [points, beams, supports]);

  // Убеждаемся, что все функции определены перед возвратом
  const result = {
    canvasRef,
    points: points || [],
    beams: beams || [],
    supports: supports || [],
    selectedPoint,
    tempPoint,
    hoveredPoint,
    hoveredBeam,
    isDraggingPoint,
    draggingPoint,
    isPanning,
    panStart,
    ctrlPressed,
    coordinates: coordinates || { x: 0, y: 0 },
    showPointControls,
    pointControlsPosition: pointControlsPosition || { x: 0, y: 0 },
    formulaFunction,
    formulaPoints,
    supportImagesRef,
    coordinateOriginRef,
    beamLengthRef,
    scaleRef,
    supportHeightRef,
    currentTimeRef,
    setPoints,
    setBeams,
    setSupports,
    setSelectedPoint,
    setTempPoint,
    setHoveredPoint,
    setHoveredBeam,
    setIsDraggingPoint,
    setDraggingPoint,
    setIsPanning,
    setPanStart,
    setCtrlPressed,
    setCoordinates,
    setShowPointControls,
    setPointControlsPosition,
    setFormulaFunction,
    setFormulaPoints,
    parseFormula,
    generateFormulaPoints,
    mmToPx: mmToPx || (() => 0),
    pxToMm: pxToMm || (() => 0),
    screenToWorld: screenToWorld || (() => ({ x: 0, y: 0 })),
    worldToScreen: worldToScreen || (() => ({ x: 0, y: 0 })),
    addPoint: addPoint || (() => null),
    addOrUpdateSupport: addOrUpdateSupport || (() => {}),
    addBeam: addBeam || (() => {}),
    clearAll: clearAll || (() => {}),
    performCalculation: performCalculation || (() => ({ success: false, message: 'Не инициализировано' }))
  };

  return result;
}

