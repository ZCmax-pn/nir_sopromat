class ConstructionApp {
    constructor() {
        this.canvas = document.getElementById('constructionCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.buttonsOpora = document.getElementById('point-controls');
        
        // Элементы для системы координат и меню
        this.coordinatesIndicator = document.getElementById('coordinatesIndicator');
        this.burgerMenu = document.getElementById('burgerMenu');
        this.mobileMenu = document.getElementById('mobileMenu');
        this.mobileMenuClose = document.getElementById('mobileMenuClose');
        
        this.points = [];
        this.beams = [];
        this.supports = [];
        this.selectedPoint = null;
        this.tempPoint = null;
        this.supportImages = {};
        this.hoveredPoint = null;
        this.hoveredBeam = null;
        this.currentTime = 0;
        
        // Настройки - теперь в миллиметрах
        this.beamLength = 400; // мм
        this.supportHeight = 40; // мм
        this.isDraggingPoint = false;
        this.draggingPoint = null;
        this.dragFixedX = null;
        this.isDraggingBeam = false;
        this.ctrlPressed = false;
        
        // Коэффициент масштабирования: 1 мм = 2 пикселя (для лучшей видимости)
        this.scale = 2;
        
        // Переменные для формулы
        this.currentFormula = null;
        this.formulaFunction = null;
        this.formulaPoints = [];
        
        // Результаты расчета
        this.calculationResults = null;
        this.reactionForces = null;
        this.bendingMoments = null;
        this.shearForces = null;
        this.feedbackMessage = null;
        
        // Начальная точка системы координат (0,0)
        this.coordinateOrigin = { 
            x: 0, 
            y: 0,
            screenX: 0, // будет установлено в handleResize
            screenY: 0  // будет установлено в handleResize
        };
        
        // Для изменения размера балки
        this.resizingBeam = false;
        this.resizeHandle = null;
        this.resizeStartPoint = null;
        this.resizeStartMouse = null;
        
        this.init();
    }
    
    async init() {
        this.setupCanvasQuality();
        await this.preloadSupportImages();
        this.setupEventListeners();
        this.setupMobileMenu();
        this.handleResize();
        this.createInitialOriginPoint();
        this.startRenderLoop();
    }
    
    setupMobileMenu() {
        // Обработчики для мобильного меню
        if (this.burgerMenu) {
            this.burgerMenu.addEventListener('click', () => {
                this.mobileMenu.classList.add('active');
            });
        }
        
        if (this.mobileMenuClose) {
            this.mobileMenuClose.addEventListener('click', () => {
                this.mobileMenu.classList.remove('active');
            });
        }
        
        // Закрытие меню при клике вне его
        document.addEventListener('click', (e) => {
            if (this.mobileMenu && this.mobileMenu.classList.contains('active')) {
                if (!e.target.closest('.mobile-menu') && 
                    !e.target.closest('.burger-menu') &&
                    e.target !== this.burgerMenu) {
                    this.mobileMenu.classList.remove('active');
                }
            }
        });
    }
    
    setupCanvasQuality() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.ctx.scale(dpr, dpr);
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        // Устанавливаем начальную точку (0,0) в центре canvas
        this.coordinateOrigin.screenX = rect.width / 2;
        this.coordinateOrigin.screenY = rect.height / 2;
    }
    
    async preloadSupportImages() {
        const supportTypes = {
            'support1': './images/black/Group%201.svg',
            'support2': './images/black/Group%202.svg', 
            'support3': './images/black/Group%203.svg',
            'support4': './images/black/Ellipse%203.svg'
        };
        
        const loadImage = (src) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => {
                    console.warn('Failed to load image:', src);
                    // Создаем fallback изображение
                    const fallbackImg = new Image();
                    fallbackImg.width = 40;
                    fallbackImg.height = 40;
                    resolve(fallbackImg);
                };
                img.src = src;
            });
        };
        
        for (const [type, src] of Object.entries(supportTypes)) {
            this.supportImages[type] = await loadImage(src);
        }
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        window.addEventListener('resize', () => this.handleResize());
        
        // Обработка нажатия Ctrl
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Control') {
                this.ctrlPressed = true;
                this.canvas.style.cursor = 'crosshair';
            }
            if (e.key === 'Escape') {
                this.hidePointControls();
                this.draw();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key === 'Control') {
                this.ctrlPressed = false;
                this.updateCursor();
            }
        });
        
        document.querySelectorAll('.opora-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.selectedPoint) {
                    if (btn.dataset.type === 'beam') {
                        this.addBeam();
                    } else {
                        this.addOrUpdateSupport(this.selectedPoint, btn.dataset.type);
                    }
                    this.hidePointControls();
                    this.draw();
                }
            });
        });
        
        // Скрываем меню при клике на canvas
        document.addEventListener('click', (e) => {
            // Если клик не на меню и не на кнопку меню
            if (!e.target.closest('.buttons-opora') && 
                !e.target.closest('#constructionCanvas')) {
                this.hidePointControls();
            }
        });
        
        // Обработчики для формулы
        document.getElementById('applyFormula').addEventListener('click', () => this.applyFormula());
        document.getElementById('clearFormula').addEventListener('click', () => this.clearFormula());
        document.getElementById('formulaInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.applyFormula();
            }
        });
        
    }
    
    escapeHtml(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    escapeLatex(str) {
        // Экраним только HTML-символы, backslash оставляем для LaTeX
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    
    renderMath(elements) {
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise(elements).catch(err => console.error(err));
        }
    }
    
    // Конвертация мм в пиксели с учетом начала координат
    mmToPx(mm, isX = true) {
        if (isX) {
            return this.coordinateOrigin.screenX + mm * this.scale;
        } else {
            return this.coordinateOrigin.screenY - mm * this.scale; // Инвертируем Y для правильного отображения
        }
    }
    
    // Конвертация пикселей в мм с учетом начала координат
    pxToMm(px, isX = true) {
        if (isX) {
            return (px - this.coordinateOrigin.screenX) / this.scale;
        } else {
            return (this.coordinateOrigin.screenY - px) / this.scale; // Инвертируем Y
        }
    }
    
    // Преобразование экранных координат в мировые (мм)
    screenToWorld(screenX, screenY) {
        return {
            x: this.pxToMm(screenX, true),
            y: this.pxToMm(screenY, false)
        };
    }
    
    // Преобразование мировых координат (мм) в экранные
    worldToScreen(worldX, worldY) {
        return {
            x: this.mmToPx(worldX, true),
            y: this.mmToPx(worldY, false)
        };
    }
    
    updateSupportPosition(point) {
        const support = this.supports.find(s => s.pointId === point.id);
        if (support) {
            // Обновляем позицию опоры относительно точки
            support.x = point.x;
            support.y = point.y + this.supportHeight;
            support.pointY = point.y;
        }
    }
    
    updateAllSupportsPosition() {
        this.supports.forEach(support => {
            const point = this.points.find(p => p.id === support.pointId);
            if (point) {
                support.x = point.x;
                support.y = point.y + this.supportHeight;
                support.pointY = point.y;
            }
        });
    }
    
    handleResize() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.ctx.scale(dpr, dpr);
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        
        // Обновляем позицию начала координат (в центре)
        this.coordinateOrigin.screenX = rect.width / 2;
        this.coordinateOrigin.screenY = rect.height / 2;
        
        // Обновляем позиции всех точек при изменении размера
        this.updateAllPointsPosition();
        
        this.draw();
    }
    
    updateAllPointsPosition() {
        // Обновляем все точки при изменении размера canvas
        // Это нужно для корректного отображения при ресайзе
        this.points.forEach(point => {
            // Если точка была создана до установки координат, пересчитываем
            if (point.worldX !== undefined && point.worldY !== undefined) {
                const screenPos = this.worldToScreen(point.worldX, point.worldY);
                point.x = screenPos.x;
                point.y = screenPos.y;
            }
        });
    }
    
    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    handleMouseDown(e) {
        const { x, y } = this.getCanvasCoordinates(e);
        
        // Проверяем, кликнули ли на точку изменения размера балки
        const resizeHandle = this.getResizeHandleAt(x, y);
        if (resizeHandle) {
            this.resizingBeam = true;
            this.resizeHandle = resizeHandle.handle;
            this.resizeStartPoint = resizeHandle.point;
            this.resizeStartMouse = { x, y };
            this.canvas.style.cursor = 'col-resize';
            return;
        }
        
        // Проверяем, кликнули ли на точку (даже с опорой)
        const clickedPoint = this.getPointAt(x, y);
        if (clickedPoint) {
            this.isDraggingPoint = true;
            this.draggingPoint = clickedPoint;
            this.dragFixedX = clickedPoint.x; // фиксируем X для ограничения перемещения второй точки
            this.canvas.style.cursor = 'grabbing';
        }
    }
    
    handleMouseUp(e) {
        if (this.isDraggingPoint) {
            this.isDraggingPoint = false;
            this.draggingPoint = null;
            this.dragFixedX = null;
            this.updateCursor();
        }
        
        if (this.resizingBeam) {
            this.resizingBeam = false;
            this.resizeHandle = null;
            this.resizeStartPoint = null;
            this.resizeStartMouse = null;
            this.updateCursor();
        }
        
        if (this.isDraggingBeam) {
            this.isDraggingBeam = false;
            this.updateCursor();
        }
    }
    
    handleDoubleClick(e) {
        const { x, y } = this.getCanvasCoordinates(e);
        
        // Проверяем, кликнули ли на балку для изменения размера
        const clickedBeam = this.getBeamAt(x, y);
        if (clickedBeam) {
            this.showBeamLengthEditor(clickedBeam);
        }
    }
    
    showBeamLengthEditor(beam) {
        // Удаляем предыдущие редакторы, если есть
        document.querySelectorAll('.beam-length-editor').forEach(el => el.remove());
        
        // Создаем редактор длины балки прямо на canvas
        const editor = document.createElement('div');
        editor.className = 'beam-length-editor';
        editor.innerHTML = `
            <input type="number" value="${beam.length}" min="100" max="5000" step="10">
            <span>мм</span>
            <button class="apply-btn">✓</button>
            <button class="cancel-btn">✗</button>
        `;
        
        // Позиционируем редактор рядом с балкой
        const midX = (beam.start.x + beam.end.x) / 2;
        const midY = (beam.start.y + beam.end.y) / 2;
        
        editor.style.position = 'absolute';
        editor.style.left = (midX - 100) + 'px';
        editor.style.top = (midY - 40) + 'px';
        editor.style.zIndex = '1000';
        
        document.body.appendChild(editor);
        
        // Фокус на поле ввода
        const input = editor.querySelector('input');
        input.focus();
        input.select();
        
        // Обработчики событий
        const applyBtn = editor.querySelector('.apply-btn');
        const cancelBtn = editor.querySelector('.cancel-btn');
        
        const apply = () => {
            const newLength = parseInt(input.value);
            if (!isNaN(newLength) && newLength > 0) {
                this.updateBeamLength(beam, newLength);
            }
            editor.remove();
            this.draw();
        };
        
        const cancel = () => {
            editor.remove();
            this.draw();
        };
        
        applyBtn.addEventListener('click', apply);
        cancelBtn.addEventListener('click', cancel);
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') apply();
            if (e.key === 'Escape') cancel();
        });
        
        // Закрытие при клике вне редактора
        const closeOnClickOutside = (event) => {
            if (!editor.contains(event.target)) {
                cancel();
                document.removeEventListener('click', closeOnClickOutside);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', closeOnClickOutside);
        }, 0);
    }
    
    updateBeamLength(beam, newLength) {
        if (!beam || !beam.start || !beam.end) return;
        
        const startPoint = beam.start;
        const endPoint = beam.end;
        
        // Рассчитываем угол балки
        const angle = Math.atan2(endPoint.y - startPoint.y, endPoint.x - startPoint.x);
        
        // Рассчитываем новую позицию конечной точки в мировых координатах
        const worldStart = this.screenToWorld(startPoint.x, startPoint.y);
        const worldEndX = worldStart.x + newLength * Math.cos(angle);
        const worldEndY = worldStart.y + newLength * Math.sin(angle);
        
        // Преобразуем обратно в экранные координаты
        const screenEnd = this.worldToScreen(worldEndX, worldEndY);
        
        // Обновляем конечную точку
        endPoint.x = screenEnd.x;
        endPoint.y = screenEnd.y;
        
        // Обновляем мировые координаты
        endPoint.worldX = worldEndX;
        endPoint.worldY = worldEndY;
        
        // Обновляем длину балки
        this.beamLength = newLength;
        beam.length = newLength;
        
        // Обновляем позицию опоры для конечной точки
        this.updateSupportPosition(endPoint);
        
        // Обновляем точки формулы
        if (this.formulaFunction) {
            this.generateFormulaPoints();
        }
    }
    
    updateLengthFromPoints() {
        if (this.points.length === 2) {
            const startPoint = this.points[0];
            const endPoint = this.points[1];
            
            // Рассчитываем длину в мировых координатах
            const worldStart = this.screenToWorld(startPoint.x, startPoint.y);
            const worldEnd = this.screenToWorld(endPoint.x, endPoint.y);
            
            const dx = worldEnd.x - worldStart.x;
            const dy = worldEnd.y - worldStart.y;
            this.beamLength = Math.round(Math.sqrt(dx * dx + dy * dy));
            
            // Обновляем длину в балке
            if (this.beams.length > 0) {
                this.beams[0].length = this.beamLength;
            }
        }
    }
    
    handleCanvasClick(e) {
        if (this.isDraggingPoint || this.resizingBeam || this.isDraggingBeam) return;
        
        const { x, y } = this.getCanvasCoordinates(e);
        
        const clickedPoint = this.getPointAt(x, y);
        const clickedBeam = this.getBeamAt(x, y);
        
        if (clickedPoint) {
            this.showPointControls(e.clientX, e.clientY);
            this.selectedPoint = clickedPoint;
        } else if (clickedBeam) {
            this.selectedBeam = clickedBeam;
            this.showBeamLengthEditor(clickedBeam);
        } else {
            // Добавление новой точки
            if (this.ctrlPressed || this.points.length < 2) {
                const worldCoords = this.screenToWorld(x, y);
                this.addPoint(x, y, worldCoords.x, worldCoords.y);
                this.hidePointControls();
            }
        }
        
        this.draw();
    }
    
    handleMouseMove(e) {
        const { x, y } = this.getCanvasCoordinates(e);
        
        // Обновляем индикатор координат
        const worldCoords = this.screenToWorld(x, y);
        this.coordinatesIndicator.textContent = `X: ${Math.round(worldCoords.x)} мм, Y: ${Math.round(worldCoords.y)} мм`;
        
        // Обработка изменения размера балки через маркер
        if (this.resizingBeam && this.resizeHandle && this.resizeStartPoint && this.resizeStartMouse) {
            const deltaX = x - this.resizeStartMouse.x;
            const deltaY = y - this.resizeStartMouse.y;
            
            if (this.beams.length > 0) {
                const beam = this.beams[0];
                const startPoint = beam.start;
                const endPoint = beam.end;
                
                // Определяем, какую точку перемещаем
                const movingPoint = this.resizeHandle === 'start' ? startPoint : endPoint;
                
                // Обновляем позицию точки
                movingPoint.x = this.resizeStartPoint.x + deltaX;
                movingPoint.y = this.resizeStartPoint.y + deltaY;
                
                // Обновляем мировые координаты
                const worldPos = this.screenToWorld(movingPoint.x, movingPoint.y);
                movingPoint.worldX = worldPos.x;
                movingPoint.worldY = worldPos.y;
                
                // Обновляем длину балки
                this.updateLengthFromPoints();
                
                // Обновляем позицию опоры для перемещаемой точки
                this.updateSupportPosition(movingPoint);
            }
        }
        
        // Обработка перетаскивания точки (даже с опорой)
        if (this.isDraggingPoint && this.draggingPoint) {
            // Если это вторая точка и Ctrl не зажат, двигаем только по Y
            const targetX = (this.draggingPoint.id === 2 && !this.ctrlPressed && this.dragFixedX !== null)
                ? this.dragFixedX
                : x;
            
            this.draggingPoint.x = targetX;
            this.draggingPoint.y = y;
            
            // Обновляем мировые координаты
            const worldPos = this.screenToWorld(targetX, y);
            this.draggingPoint.worldX = worldPos.x;
            this.draggingPoint.worldY = worldPos.y;
            
            // Обновляем позицию опоры для перемещаемой точки
            this.updateSupportPosition(this.draggingPoint);
            
            // Если балка существует, обновляем ее длину
            if (this.beams.length > 0) {
                this.updateLengthFromPoints();
            }
        }
        
        // Предпросмотр точки
        if ((this.points.length < 2 || this.ctrlPressed) && !this.isDraggingPoint && !this.resizingBeam) {
            if (this.points.length === 1 && !this.ctrlPressed) {
                // Предпросмотр второй точки под углом (в мм)
                const startPoint = this.points[0];
                const angle = Math.atan2(y - startPoint.y, x - startPoint.x);
                this.tempPoint = {
                    x: startPoint.x + this.mmToPx(this.beamLength) * Math.cos(angle),
                    y: startPoint.y + this.mmToPx(this.beamLength) * Math.sin(angle)
                };
            } else {
                this.tempPoint = { x, y };
            }
        } else {
            this.tempPoint = null;
        }
        
        // Определяем, наведена ли мышь на точку, балку или маркер изменения размера
        this.hoveredPoint = this.getPointAt(x, y);
        this.hoveredBeam = this.getBeamAt(x, y);
        this.hoveredResizeHandle = this.getResizeHandleAt(x, y);
        
        this.updateCursor();
        this.draw();
    }
    
    updateCursor() {
        if (this.isDraggingPoint) {
            this.canvas.style.cursor = 'grabbing';
        } else if (this.resizingBeam) {
            this.canvas.style.cursor = 'col-resize';
        } else if (this.hoveredResizeHandle) {
            this.canvas.style.cursor = 'col-resize';
        } else if (this.hoveredPoint) {
            this.canvas.style.cursor = 'grab';
        } else if (this.hoveredBeam) {
            this.canvas.style.cursor = 'pointer';
        } else if (this.ctrlPressed) {
            this.canvas.style.cursor = 'crosshair';
        } else if (this.points.length < 2) {
            this.canvas.style.cursor = 'crosshair';
        } else {
            this.canvas.style.cursor = 'default';
        }
    }
    
    getPointAt(x, y) {
        return this.points.find(point => {
            const distance = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
            return distance <= point.radius + 10;
        });
    }
    
    getBeamAt(x, y) {
        if (this.beams.length === 0) return null;
        
        const beam = this.beams[0];
        const start = beam.start;
        const end = beam.end;
        
        // Вычисляем расстояние от точки до линии балки
        const A = x - start.x;
        const B = y - start.y;
        const C = end.x - start.x;
        const D = end.y - start.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = start.x;
            yy = start.y;
        } else if (param > 1) {
            xx = end.x;
            yy = end.y;
        } else {
            xx = start.x + param * C;
            yy = start.y + param * D;
        }
        
        const dx = x - xx;
        const dy = y - yy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        return distance <= 8 ? beam : null;
    }
    
    getResizeHandleAt(x, y) {
        if (this.beams.length === 0) return null;
        
        const beam = this.beams[0];
        const start = beam.start;
        const end = beam.end;
        
        // Проверяем маркер изменения размера у начальной точки
        const startDistance = Math.sqrt((start.x - x) ** 2 + (start.y - y) ** 2);
        if (startDistance <= 15) {
            return {
                handle: 'start',
                point: { x: start.x, y: start.y }
            };
        }
        
        // Проверяем маркер изменения размера у конечной точки
        const endDistance = Math.sqrt((end.x - x) ** 2 + (end.y - y) ** 2);
        if (endDistance <= 15) {
            return {
                handle: 'end',
                point: { x: end.x, y: end.y }
            };
        }
        
        return null;
    }
    
    showPointControls(x, y) {
        const menu = this.buttonsOpora;
        const menuWidth = menu.offsetWidth;
        const menuHeight = menu.offsetHeight;
        
        let left = x + 10;
        let top = y + 10;
        
        if (left + menuWidth > window.innerWidth) {
            left = x - menuWidth - 10;
        }
        if (top + menuHeight > window.innerHeight) {
            top = y - menuHeight - 10;
        }
        
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
        menu.classList.add('visible');
    }
    
    hidePointControls() {
        this.buttonsOpora.classList.remove('visible');
        this.selectedPoint = null;
    }
    
    createInitialOriginPoint() {
        if (this.points.length > 0) return;
        const screenPos = this.worldToScreen(0, 0);
        const originPoint = this.addPoint(screenPos.x, screenPos.y, 0, 0);
        this.selectedPoint = originPoint;
    }
    
    addPoint(x, y, worldX, worldY) {
        // Если мировые координаты не переданы, вычисляем их
        if (worldX === undefined || worldY === undefined) {
            const worldCoords = this.screenToWorld(x, y);
            worldX = worldCoords.x;
            worldY = worldCoords.y;
        }
        
        const newPoint = {
            id: this.points.length + 1,
            x: x,
            y: y,
            worldX: worldX,
            worldY: worldY,
            radius: 8,
            appearedAt: performance.now()
        };
        
        this.points.push(newPoint);
        
        // Если добавляется вторая точка и нет балки, обновляем beamLength
        if (this.points.length === 2 && this.beams.length === 0) {
            const startPoint = this.points[0];
            const dx = worldX - startPoint.worldX;
            const dy = worldY - startPoint.worldY;
            this.beamLength = Math.round(Math.sqrt(dx * dx + dy * dy));
        }
        
        return newPoint;
    }
    
    addOrUpdateSupport(point, type) {
        // Удаляем существующую опору для этой точки
        this.supports = this.supports.filter(support => support.pointId !== point.id);
        
        // Добавляем новую опору
        this.supports.push({
            id: this.supports.length + 1,
            pointId: point.id,
            x: point.x,
            y: point.y + this.supportHeight,
            type: type,
            pointY: point.y,
            worldX: point.worldX,
            worldY: point.worldY
        });
    }
    
    addBeam() {
        if (this.points.length < 2) {
            alert('Для создания балки нужно минимум 2 точки');
            return;
        }
        
        // Если точек больше 2, предлагаем выбрать какие точки соединить
        if (this.points.length > 2) {
            this.showBeamPointSelector();
            return;
        }
        
        // Для 2 точек - просто соединяем первую и вторую
        const startPoint = this.points[0];
        const endPoint = this.points[1];
        
        const beamExists = this.beams.some(beam => 
            (beam.start.id === startPoint.id && beam.end.id === endPoint.id) ||
            (beam.start.id === endPoint.id && beam.end.id === startPoint.id)
        );
        
        if (!beamExists) {
            this.beams.push({
                id: this.beams.length + 1,
                start: startPoint,
                end: endPoint,
                length: this.beamLength
            });
            this.syncBeamLengthInput();
        }
    }
    
    showBeamPointSelector() {
        // Создаем простой селектор для выбора точек
        let pointOptions = this.points.map((p, i) => 
            `${i + 1}. Точка (${Math.round(p.worldX)}, ${Math.round(p.worldY)}) мм`
        ).join('\n');
        
        const input = prompt(
            `Выберите номера точек для соединения (например: "1-2")\n\n${pointOptions}`
        );
        
        if (input) {
            const match = input.match(/^(\d+)\s*-\s*(\d+)$/);
            if (match) {
                const startIdx = parseInt(match[1]) - 1;
                const endIdx = parseInt(match[2]) - 1;
                
                if (startIdx >= 0 && startIdx < this.points.length && 
                    endIdx >= 0 && endIdx < this.points.length && 
                    startIdx !== endIdx) {
                    
                    const startPoint = this.points[startIdx];
                    const endPoint = this.points[endIdx];
                    
                    const beamExists = this.beams.some(beam => 
                        (beam.start.id === startPoint.id && beam.end.id === endPoint.id) ||
                        (beam.start.id === endPoint.id && beam.end.id === startPoint.id)
                    );
                    
                    if (!beamExists) {
                        // Рассчитываем длину между выбранными точками
                        const dx = endPoint.worldX - startPoint.worldX;
                        const dy = endPoint.worldY - startPoint.worldY;
                        const lengthMm = Math.round(Math.sqrt(dx * dx + dy * dy));
                        
                        this.beams.push({
                            id: this.beams.length + 1,
                            start: startPoint,
                            end: endPoint,
                            length: lengthMm
                        });
                        
                        // Обновляем beamLength для совместимости
                        this.beamLength = lengthMm;
                    }
                } else {
                    alert('Некорректные номера точек');
                }
            } else {
                alert('Введите в формате "номер-номер", например: "1-2"');
            }
        }
    }
    
    // Методы для работы с формулой
    applyFormula() {
        const formulaInput = document.getElementById('formulaInput');
        const formulaDisplay = document.getElementById('formulaDisplay');
        const formula = formulaInput.value.trim();
        
        if (!formula) {
            alert('Введите уравнение');
            return;
        }
        
        try {
            // Парсим формулу
            this.currentFormula = formula;
            this.formulaFunction = this.parseFormula(formula);
            const safeLatex = this.escapeLatex(formula);
            // Заменяем * на · для корректного отображения умножения в LaTeX
            const displayLatex = safeLatex.replace(/\*/g, '\\cdot ');
            formulaDisplay.innerHTML = `\\(${displayLatex}\\)`;
            formulaDisplay.style.color = '#333';
            formulaInput.value = '';
            
            // Применяем MathJax рендеринг LaTeX
            this.renderMath([formulaDisplay]);
            
            // Генерируем точки для отображения графика
            this.generateFormulaPoints();
            this.draw();
            
        } catch (error) {
            alert('Ошибка в формуле: ' + error.message);
            console.error('Formula error:', error);
        }
    }
    
    parseFormula(formula) {
        // Упрощенный парсер математических выражений
        // Поддерживает: +, -, *, /, ^, sin, cos, tan, log, sqrt, константы pi, e
        formula = formula.toLowerCase().replace(/\s/g, '');
        
        // Проверяем формат y = ...
        if (!formula.startsWith('y=')) {
            throw new Error('Формула должна начинаться с "y ="');
        }
        
        const expression = formula.substring(2);
        
        // Создаем безопасную функцию
        return (x) => {
            try {
                // Заменяем математические функции и константы
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
                
                // Заменяем x на значение
                expr = expr.replace(/x/g, `(${x})`);
                
                // Вычисляем выражение
                const result = eval(expr);
                
                if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
                    throw new Error('Некорректный результат');
                }
                
                return result;
            } catch (e) {
                throw new Error('Ошибка вычисления при x=' + x + ': ' + e.message);
            }
        };
    }
    
    generateFormulaPoints() {
        if (!this.formulaFunction || this.points.length < 2) return;
        
        this.formulaPoints = [];
        const startPoint = this.points[0];
        const endPoint = this.points[1];
        
        const startX = startPoint.worldX;
        const endX = endPoint.worldX;
        const step = (endX - startX) / 100; // 100 точек для гладкого графика
        
        for (let x = startX; x <= endX; x += step) {
            try {
                const y = this.formulaFunction(x);
                // Конвертируем обратно в пиксели для отрисовки
                const screenPos = this.worldToScreen(x, y);
                
                this.formulaPoints.push({ 
                    x: screenPos.x, 
                    y: screenPos.y,
                    worldX: x,
                    worldY: y
                });
            } catch (e) {
                console.warn('Error calculating point at x=' + x, e);
            }
        }
    }
    
    clearFormula() {
        this.currentFormula = null;
        this.formulaFunction = null;
        this.formulaPoints = [];
        document.getElementById('formulaDisplay').textContent = 'Формула не задана';
        document.getElementById('formulaDisplay').style.color = '#666';
        this.draw();
    }
    
    // Методы для расчета
    performCalculation() {
        if (this.points.length < 2) {
            this.feedbackMessage = 'Подумай еще';
            this.showError('Подумай еще');
            return false;
        }
        
        if (this.beams.length === 0) {
            this.feedbackMessage = 'Подумай еще';
            this.showError('Подумай еще');
            return false;
        }
        
        try {
            // Анализ опор
            const supportAnalysis = this.analyzeSupports();
            if (!supportAnalysis.isStaticallyDeterminate) {
                this.feedbackMessage = 'Подумай еще';
                this.showWarning('Подумай еще');
                return false;
            }
            
            this.feedbackMessage = 'Молодец, все правильно';
            
            // Расчет реакций опор
            this.reactionForces = this.calculateReactionForces();
            
            // Расчет внутренних усилий
            this.calculateInternalForces();
            
            // Отображение результатов
            this.displayResults();
            
            return true;
            
        } catch (error) {
            this.showError('Ошибка расчета: ' + error.message);
            console.error('Calculation error:', error);
            return false;
        }
    }
    
    analyzeSupports() {
        const supportsCount = this.supports.length;
        const equationsAvailable = 3; // ΣFx=0, ΣFy=0, ΣM=0
        
        let isStaticallyDeterminate = false;
        let message = '';
        
        if (supportsCount === 0) {
            message = 'Нет опор - система неустойчива';
        } else if (supportsCount === 1) {
            const support = this.supports[0];
            if (support.type === 'support3') { // Жесткая заделка
                isStaticallyDeterminate = true;
                message = 'Жесткая заделка - система статически определима';
            } else {
                message = 'Одна шарнирная опора - система неустойчива';
            }
        } else if (supportsCount === 2) {
            const supportTypes = this.supports.map(s => s.type);
            const hasFixedSupport = supportTypes.includes('support3');
            const hasHingeSupport = supportTypes.includes('support1') || supportTypes.includes('support2');
            
            if (hasFixedSupport && hasHingeSupport) {
                isStaticallyDeterminate = true;
                message = 'Жесткая заделка + шарнирная опора - система статически определима';
            } else if (supportTypes.filter(t => t === 'support1' || t === 'support2').length === 2) {
                isStaticallyDeterminate = true;
                message = 'Две шарнирные опоры - система статически определима';
            } else {
                message = 'Неподходящая комбинация опор';
            }
        } else {
            message = 'Слишком много опор - система статически неопределима';
        }
        
        return {
            isStaticallyDeterminate,
            message,
            supportsCount,
            equationsAvailable
        };
    }
    
    calculateReactionForces() {
        const L = this.beamLength;
        const startPoint = this.points[0];
        const endPoint = this.points[1];
        
        // Для простоты примера - равномерно распределенная нагрузка
        const q = 1000; // Н/м (равномерно распределенная нагрузка)
        const totalLoad = q * (L / 1000); // Переводим мм в метры
        
        let RA, RB, MA;
        
        if (this.supports.length === 2) {
            // Две опоры - шарнирные
            RA = totalLoad / 2;
            RB = totalLoad / 2;
            MA = 0;
        } else if (this.supports.length === 1 && this.supports[0].type === 'support3') {
            // Жесткая заделка
            RA = totalLoad;
            RB = 0;
            MA = totalLoad * (L / 1000) / 2; // Момент в заделке
        } else {
            // По умолчанию - консольная балка
            RA = totalLoad;
            RB = 0;
            MA = 0;
        }
        
        return {
            RA: Math.round(RA),
            RB: Math.round(RB),
            MA: Math.round(MA),
            totalLoad: Math.round(totalLoad),
            loadType: 'равномерно распределенная',
            loadValue: q
        };
    }
    
    calculateInternalForces() {
        const L = this.beamLength;
        const q = 1000; // Н/м
        const pointsCount = 50;
        
        this.shearForces = [];
        this.bendingMoments = [];
        
        for (let i = 0; i <= pointsCount; i++) {
            const x = (i / pointsCount) * L;
            const x_m = x / 1000; // в метрах
            
            let V, M;
            
            if (this.supports.length === 2) {
                // Две опоры
                V = this.reactionForces.RA - q * x_m;
                M = this.reactionForces.RA * x_m - (q * x_m * x_m) / 2;
            } else {
                // Консоль
                V = -q * x_m;
                M = -(q * x_m * x_m) / 2;
            }
            
            this.shearForces.push({
                x: x,
                value: Math.round(V)
            });
            
            this.bendingMoments.push({
                x: x,
                value: Math.round(M)
            });
        }
        
        // Находим максимальные значения
        const maxShear = Math.max(...this.shearForces.map(f => Math.abs(f.value)));
        const maxMoment = Math.max(...this.bendingMoments.map(m => Math.abs(m.value)));
        
        this.calculationResults = {
            maxShearForce: maxShear,
            maxBendingMoment: maxMoment,
            calculationPoints: pointsCount
        };
    }
    
    displayResults() {
        const resultsSection = document.getElementById('resultsSection');
        const resultsContent = document.getElementById('resultsContent');
        
        let html = '';
        
        if (this.feedbackMessage) {
            html += `<div class="result-feedback">${this.feedbackMessage}</div>`;
        }
        
        html += `
            <div class="result-item">
                <strong>Длина балки:</strong> ${this.beamLength} мм
            </div>
            <div class="result-item">
                <strong>Тип нагрузки:</strong> ${this.reactionForces.loadType}
            </div>
            <div class="result-item">
                <strong>Интенсивность нагрузки:</strong> ${this.reactionForces.loadValue} Н/м
            </div>
            <div class="result-item">
                <strong>Суммарная нагрузка:</strong> ${this.reactionForces.totalLoad} Н
            </div>
        `;
        
        if (this.reactionForces.RA !== 0) {
            html += `<div class="result-item">
                <strong>Реакция опоры A:</strong> ${this.reactionForces.RA} Н
            </div>`;
        }
        
        if (this.reactionForces.RB !== 0) {
            html += `<div class="result-item">
                <strong>Реакция опоры B:</strong> ${this.reactionForces.RB} Н
            </div>`;
        }
        
        if (this.reactionForces.MA !== 0) {
            html += `<div class="result-item">
                <strong>Момент в заделке:</strong> ${this.reactionForces.MA} Н·м
            </div>`;
        }
        
        html += `
            <div class="result-item">
                <strong>Максимальная поперечная сила:</strong> ${this.calculationResults.maxShearForce} Н
            </div>
            <div class="result-item">
                <strong>Максимальный изгибающий момент:</strong> ${this.calculationResults.maxBendingMoment} Н·м
            </div>
        `;
        
        // Диаграммы
        html += `
            <div class="forces-diagram">
                <div class="diagram-title">Эпюра поперечных сил:</div>
                <div>Максимум: ${this.calculationResults.maxShearForce} Н</div>
            </div>
            <div class="forces-diagram">
                <div class="diagram-title">Эпюра изгибающих моментов:</div>
                <div>Максимум: ${this.calculationResults.maxBendingMoment} Н·м</div>
            </div>
        `;
        
        resultsContent.innerHTML = html;
        resultsSection.classList.add('visible');
    }
    
    showError(message) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsContent = document.getElementById('resultsContent');
        
        resultsContent.innerHTML = `<div class="result-error">${message}</div>`;
        resultsSection.classList.add('visible');
    }
    
    showWarning(message) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsContent = document.getElementById('resultsContent');
        
        resultsContent.innerHTML = `<div class="result-warning">${message}</div>`;
        resultsSection.classList.add('visible');
    }
    
    draw() {
        // timestamp задается в рендер-цикле
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуем систему координат
        this.drawCoordinateSystem();
        
        // Рисуем график формулы если есть
        if (this.formulaPoints.length > 0) {
            this.drawFormulaGraph();
        }
        
        // Рисуем балки (черные) - только если есть балка
        this.beams.forEach(beam => this.drawBeam(beam));
        
        // Рисуем опоры
        this.supports.forEach(support => this.drawSupport(support));
        
        // Рисуем точки (все точки видны и перемещаются)
        this.points.forEach(point => {
            this.drawPoint(point);
        });
        
        // Рисуем предпросмотр точки
        if (this.tempPoint && (this.points.length < 2 || this.ctrlPressed)) {
            this.drawTempPoint(this.tempPoint);
        }
        
        // Рисуем маркеры изменения размера балки
        if (this.beams.length > 0 && (this.hoveredBeam || this.resizingBeam)) {
            this.drawResizeHandles();
        }
        
        // Рисуем ховер-эффект для точек
        if (this.hoveredPoint) {
            this.drawHoverEffect(this.hoveredPoint);
        }
        
        // Рисуем выделение выбранной точки
        if (this.selectedPoint) {
            this.drawSelection(this.selectedPoint);
        }
        
        // Рисуем координаты точек
        this.points.forEach(point => {
            this.drawCoordinates(point);
        });
        
        // Рисуем длину балки только если есть балка
        if (this.beams.length > 0 && this.points.length >= 2) {
            const beam = this.beams[0];
            this.drawBeamLength(beam.start, beam.end);
        }
        
        // Рисуем результаты расчета если есть
        if (this.calculationResults) {
            this.drawCalculationResults();
        }
    }
    
    drawCoordinateSystem() {
        const centerX = this.coordinateOrigin.screenX;
        const centerY = this.coordinateOrigin.screenY;
        
        // Сетка координат
        this.ctx.strokeStyle = 'rgba(45, 140, 140, 0.1)';
        this.ctx.lineWidth = 1;
        
        // Горизонтальные линии
        const gridSize = 50; // пикселей между линиями сетки
        for (let i = -Math.floor(centerY / gridSize); i < Math.floor((this.canvas.width / (window.devicePixelRatio || 1) - centerY) / gridSize); i++) {
            const y = centerY + i * gridSize;
            if (y >= 0 && y <= this.canvas.height / (window.devicePixelRatio || 1)) {
                this.ctx.beginPath();
                this.ctx.moveTo(0, y);
                this.ctx.lineTo(this.canvas.width / (window.devicePixelRatio || 1), y);
                this.ctx.stroke();
            }
        }
        
        // Вертикальные линии
        for (let i = -Math.floor(centerX / gridSize); i < Math.floor((this.canvas.width / (window.devicePixelRatio || 1) - centerX) / gridSize); i++) {
            const x = centerX + i * gridSize;
            if (x >= 0 && x <= this.canvas.width / (window.devicePixelRatio || 1)) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.canvas.height / (window.devicePixelRatio || 1));
                this.ctx.stroke();
            }
        }
        
        // Оси координат
        this.ctx.strokeStyle = 'rgba(45, 140, 140, 0.5)';
        this.ctx.lineWidth = 2;
        
        // Ось X
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY);
        this.ctx.lineTo(this.canvas.width / (window.devicePixelRatio || 1), centerY);
        this.ctx.stroke();
        
        // Ось Y
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, 0);
        this.ctx.lineTo(centerX, this.canvas.height / (window.devicePixelRatio || 1));
        this.ctx.stroke();
        
        // Стрелки осей
        this.ctx.fillStyle = '#2D8C8C';
        
        // Стрелка оси X
        this.ctx.beginPath();
        this.ctx.moveTo(this.canvas.width / (window.devicePixelRatio || 1) - 10, centerY - 5);
        this.ctx.lineTo(this.canvas.width / (window.devicePixelRatio || 1), centerY);
        this.ctx.lineTo(this.canvas.width / (window.devicePixelRatio || 1) - 10, centerY + 5);
        this.ctx.fill();
        
        // Стрелка оси Y
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - 5, 10);
        this.ctx.lineTo(centerX, 0);
        this.ctx.lineTo(centerX + 5, 10);
        this.ctx.fill();
        
        // Подписи осей
        this.ctx.fillStyle = '#2D8C8C';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.fillText('X', this.canvas.width / (window.devicePixelRatio || 1) - 5, centerY - 10);
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Y', centerX + 15, 20);
        
        // Начало координат (0,0)
        this.ctx.fillStyle = '#000000';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Подпись начала координат
        this.ctx.fillStyle = '#000000';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'right';
        this.ctx.fillText('(0,0)', centerX - 10, centerY - 10);
    }
    
    drawResizeHandles() {
        if (this.beams.length === 0) return;
        
        const beam = this.beams[0];
        const start = beam.start;
        const end = beam.end;
        
        // Маркер у начальной точки
        this.ctx.fillStyle = this.hoveredResizeHandle && this.hoveredResizeHandle.handle === 'start' ? '#007bff' : '#ff9900';
        this.ctx.beginPath();
        this.ctx.arc(start.x, start.y, 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Внутренний кружок
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.arc(start.x, start.y, 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Значок изменения размера у начальной точки
        this.ctx.strokeStyle = this.hoveredResizeHandle && this.hoveredResizeHandle.handle === 'start' ? '#007bff' : '#ff9900';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(start.x - 4, start.y);
        this.ctx.lineTo(start.x + 4, start.y);
        this.ctx.moveTo(start.x, start.y - 4);
        this.ctx.lineTo(start.x, start.y + 4);
        this.ctx.stroke();
        
        // Маркер у конечной точки
        this.ctx.fillStyle = this.hoveredResizeHandle && this.hoveredResizeHandle.handle === 'end' ? '#007bff' : '#ff9900';
        this.ctx.beginPath();
        this.ctx.arc(end.x, end.y, 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Внутренний кружок
        this.ctx.fillStyle = 'white';
        this.ctx.beginPath();
        this.ctx.arc(end.x, end.y, 4, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Значок изменения размера у конечной точки
        this.ctx.strokeStyle = this.hoveredResizeHandle && this.hoveredResizeHandle.handle === 'end' ? '#007bff' : '#ff9900';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(end.x - 4, end.y);
        this.ctx.lineTo(end.x + 4, end.y);
        this.ctx.moveTo(end.x, end.y - 4);
        this.ctx.lineTo(end.x, end.y + 4);
        this.ctx.stroke();
        
        // Подсказка при наведении на маркер
        if (this.hoveredResizeHandle) {
            const handle = this.hoveredResizeHandle.handle;
            const point = handle === 'start' ? start : end;
            
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                'Перетащите для изменения длины', 
                point.x, 
                point.y - 20
            );
        }
    }
    
    drawFormulaGraph() {
        if (this.formulaPoints.length < 2) return;
        
        this.ctx.strokeStyle = '#e74c3c';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        
        this.ctx.moveTo(this.formulaPoints[0].x, this.formulaPoints[0].y);
        
        for (let i = 1; i < this.formulaPoints.length; i++) {
            this.ctx.lineTo(this.formulaPoints[i].x, this.formulaPoints[i].y);
        }
        
        this.ctx.stroke();
        
        // Подпись графика
        if (this.currentFormula) {
            this.ctx.fillStyle = '#e74c3c';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(this.currentFormula, 20, 30);
        }
    }
    
    drawCalculationResults() {
        if (!this.reactionForces || !this.shearForces) return;
        
        // Рисуем реакции опор
        this.supports.forEach(support => {
            const point = this.points.find(p => p.id === support.pointId);
            if (point) {
                this.drawReactionForce(point, support);
            }
        });
    }
    
    drawReactionForce(point, support) {
        const forceValue = support.type === 'support1' || support.type === 'support2' ? 
            this.reactionForces.RA : this.reactionForces.RB;
            
        if (forceValue === 0) return;
        
        const arrowLength = Math.min(100, Math.abs(forceValue) / 10);
        const direction = forceValue > 0 ? -1 : 1;
        
        this.ctx.strokeStyle = '#007bff';
        this.ctx.lineWidth = 3;
        this.ctx.fillStyle = '#007bff';
        
        // Стрелка реакции
        this.ctx.beginPath();
        this.ctx.moveTo(point.x, point.y);
        this.ctx.lineTo(point.x, point.y + direction * arrowLength);
        this.ctx.stroke();
        
        // Наконечник стрелки
        this.ctx.beginPath();
        this.ctx.moveTo(point.x, point.y + direction * arrowLength);
        this.ctx.lineTo(point.x - 5, point.y + direction * (arrowLength - 10));
        this.ctx.lineTo(point.x + 5, point.y + direction * (arrowLength - 10));
        this.ctx.closePath();
        this.ctx.fill();
        
        // Текст с значением реакции
        this.ctx.fillStyle = '#007bff';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            `${Math.abs(forceValue)} Н`, 
            point.x, 
            point.y + direction * (arrowLength + 15)
        );
    }
    
    drawPoint(point) {
        const now = this.currentTime || performance.now();
        const elapsed = point.appearedAt ? Math.max(0, now - point.appearedAt) : 300;
        const duration = 200;
        const t = Math.min(1, elapsed / duration);
        // ease-out
        const scale = 0.6 + 0.4 * (1 - Math.pow(1 - t, 2));
        const alpha = 0.3 + 0.7 * t;
        
        this.ctx.save();
        this.ctx.translate(point.x, point.y);
        this.ctx.scale(scale, scale);
        this.ctx.globalAlpha = alpha;
        
        // Рисуем точку с дыркой (кольцо)
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, point.radius, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Внутренняя дырка
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, point.radius - 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    drawSelection(point) {
        this.ctx.strokeStyle = '#007bff';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 3]);
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, point.radius + 6, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }
    
    drawHoverEffect(point) {
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 3]);
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, point.radius + 4, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }
    
    drawTempPoint(point) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        this.ctx.beginPath();
        this.ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawCoordinates(point) {
        const mmX = Math.round(point.worldX);
        const mmY = Math.round(point.worldY);
        
        this.ctx.fillStyle = '#333333';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            `(${mmX}, ${mmY}) мм`, 
            point.x, 
            point.y - 15
        );
    }
    
    drawSupport(support) {
        const img = this.supportImages[support.type];
        const supportWidth = 40; // Фиксированная ширина
        const supportHeight = 40; // Фиксированная высота
        
        if (img) {
            this.ctx.save();
            // Рисуем изображение с фиксированными размерами, не вытягивая
            this.ctx.drawImage(
                img, 
                support.x - supportWidth / 2, 
                support.pointY, 
                supportWidth, 
                supportHeight
            );
            this.ctx.restore();
        } else {
            // Fallback - простой прямоугольник
            this.ctx.fillStyle = '#333333';
            this.ctx.fillRect(
                support.x - supportWidth / 2, 
                support.pointY, 
                supportWidth, 
                supportHeight
            );
            
            // Верхняя линия крепления
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(support.x - 15, support.pointY);
            this.ctx.lineTo(support.x + 15, support.pointY);
            this.ctx.stroke();
            
            // Текст с типом опоры
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                support.type.replace('support', 'O'), 
                support.x, 
                support.pointY + supportHeight / 2
            );
        }
    }
    
    drawBeam(beam) {
        // Черная балка
        this.ctx.strokeStyle = this.hoveredBeam === beam ? '#007bff' : '#000000';
        this.ctx.lineWidth = this.hoveredBeam === beam ? 4 : 3;
        this.ctx.lineCap = 'round';
        this.ctx.beginPath();
        this.ctx.moveTo(beam.start.x, beam.start.y);
        this.ctx.lineTo(beam.end.x, beam.end.y);
        this.ctx.stroke();
    }
    
    drawBeamLength(startPoint, endPoint) {
        if (startPoint && endPoint) {
            const midX = (startPoint.x + endPoint.x) / 2;
            const midY = (startPoint.y + endPoint.y) / 2;
            
            // Рассчитываем длину балки в мировых координатах
            const worldStart = this.screenToWorld(startPoint.x, startPoint.y);
            const worldEnd = this.screenToWorld(endPoint.x, endPoint.y);
            
            const dx = worldEnd.x - worldStart.x;
            const dy = worldEnd.y - worldStart.y;
            const lengthMm = Math.round(Math.sqrt(dx * dx + dy * dy));
            
            // Линия размера
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 1;
            this.ctx.setLineDash([2, 2]);
            
            const offset = 20;
            this.ctx.beginPath();
            this.ctx.moveTo(startPoint.x, startPoint.y - offset);
            this.ctx.lineTo(startPoint.x, startPoint.y - offset - 15);
            this.ctx.moveTo(endPoint.x, endPoint.y - offset);
            this.ctx.lineTo(endPoint.x, endPoint.y - offset - 15);
            this.ctx.stroke();
            
            this.ctx.beginPath();
            this.ctx.moveTo(startPoint.x, startPoint.y - offset - 10);
            this.ctx.lineTo(endPoint.x, endPoint.y - offset - 10);
            this.ctx.stroke();
            
            this.ctx.setLineDash([]);
            
            // Текст с длиной в мм
            this.ctx.fillStyle = '#000000';
            this.ctx.font = 'bold 14px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${lengthMm} мм`, midX, startPoint.y - offset - 25);
            
            this.beamLength = lengthMm;
        }
    }
    
    clearAll() {
        this.points = [];
        this.beams = [];
        this.supports = [];
        this.hidePointControls();
        this.tempPoint = null;
        this.hoveredPoint = null;
        this.hoveredBeam = null;
        this.hoveredResizeHandle = null;
        this.isDraggingPoint = false;
        this.resizingBeam = false;
        this.isDraggingBeam = false;
        this.beamLength = 400;
        this.clearFormula();
        this.clearResults();
        this.updateCursor();
        this.createInitialOriginPoint();
    }
    
    startRenderLoop() {
        const loop = (timestamp) => {
            this.currentTime = timestamp || performance.now();
            this.draw();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
    
    clearResults() {
        this.calculationResults = null;
        this.reactionForces = null;
        this.bendingMoments = null;
        this.shearForces = null;
        this.feedbackMessage = null;
        document.getElementById('resultsSection').classList.remove('visible');
    }
    
}

document.addEventListener('DOMContentLoaded', () => {
    const app = new ConstructionApp();
    
    // Рендерим примеры формул LaTeX
    const examplesBlock = document.querySelector('.formula-examples');
    if (examplesBlock) {
        app.renderMath([examplesBlock]);
    }
    
    // Подключаем все кнопки (десктоп + мобильные)
    document.querySelectorAll('.clean').forEach(btn => {
        btn.addEventListener('click', () => {
            app.clearAll();
            app.mobileMenu?.classList.remove('active');
        });
    });
    
    document.querySelectorAll('.calculation').forEach(btn => {
        btn.addEventListener('click', () => {
            app.performCalculation();
            app.mobileMenu?.classList.remove('active');
        });
    });
    
    document.querySelectorAll('.text-download-json').forEach(btn => {
        btn.addEventListener('click', () => {
            const data = {
                construction: {
                    points: app.points.map(p => ({
                        id: p.id,
                        x: Math.round(p.worldX),
                        y: Math.round(p.worldY)
                    })),
                    beams: app.beams.map(b => ({
                        id: b.id,
                        startId: b.start.id,
                        endId: b.end.id,
                        length: b.length
                    })),
                    supports: app.supports.map(s => ({
                        id: s.id,
                        pointId: s.pointId,
                        type: s.type,
                        x: Math.round(s.worldX),
                        y: Math.round(s.worldY)
                    })),
                    beamLength: app.beamLength,
                    formula: app.currentFormula,
                    coordinateSystem: {
                        origin: { x: 0, y: 0 },
                        scale: app.scale
                    }
                },
                calculation: app.calculationResults ? {
                    reactionForces: app.reactionForces,
                    maxShearForce: app.calculationResults.maxShearForce,
                    maxBendingMoment: app.calculationResults.maxBendingMoment,
                    shearForces: app.shearForces,
                    bendingMoments: app.bendingMoments,
                    calculationDate: new Date().toISOString()
                } : null
            };
            
            const json = JSON.stringify(data, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'construction_calculation.json';
            a.click();
            URL.revokeObjectURL(url);
            app.mobileMenu?.classList.remove('active');
        });
    });
});