<template>
  <div class="chessboard-wrapper" :class="{ 'has-chart': showPositionChart }">
    
    <div class="main-column">
      <div class="chessboard-container">
        <img src="@/assets/xiangqi.png" class="bg" alt="board" />

        <div v-if="showEvaluationBar && currentEvalPercent !== null" class="eval-bar">
          <div class="eval-top" :style="{ height: currentEvalPercent + '%', background: isRedOnTop ? '#e53935' : '#333' }"></div>
          <div class="eval-bottom" :style="{ height: 100 - (currentEvalPercent as number) + '%', background: isRedOnTop ? '#333' : '#e53935' }"></div>
          <div class="eval-marker" :style="{ top: currentEvalPercent + '%' }"></div>
        </div>

        <div class="pieces" @click="boardClick" @contextmenu.prevent>
          <img v-for="p in pieces" :key="p.id" :src="img(p)" class="piece" 
               :class="{ animated: isAnimating && showAnimations, inCheck: p.id === checkedKingId }" 
               :style="rcStyle(p.row, p.col, p.zIndex)" />
        </div>

        <div v-if="selectedPiece && !pendingFlip" class="selection-mark" :style="rcStyle(selectedPiece.row, selectedPiece.col, 30)">
          <div class="corner top-left"></div><div class="corner top-right"></div>
          <div class="corner bottom-left"></div><div class="corner bottom-right"></div>
        </div>

        <div class="last-move-highlights" v-if="lastMovePositions">
          <div class="highlight from" :class="getAnnotationClass(lastMovePositions)" :style="{ ...rcStyle(displayRow(lastMovePositions.from.row), displayCol(lastMovePositions.from.col)), width: '2.5%' }"></div>
          <div class="highlight to" :class="getAnnotationClass(lastMovePositions)" :style="{ ...rcStyle(displayRow(lastMovePositions.to.row), displayCol(lastMovePositions.to.col)), width: '12%' }">
            <div class="corner top-left"></div><div class="corner top-right"></div>
            <div class="corner bottom-left"></div><div class="corner bottom-right"></div>
          </div>
        </div>

        <div v-if="lastMovePositions && getCurrentMoveAnnotation()" class="annotation-layer">
          <div class="annotation-anchor" :class="getAnnotationClass(lastMovePositions)" :style="rcStyle(displayRow(lastMovePositions.to.row), displayCol(lastMovePositions.to.col))">
            <div class="annotation-badge">{{ getCurrentMoveAnnotation() }}</div>
          </div>
        </div>

        <svg class="user-drawings" viewBox="0 0 90 100" preserveAspectRatio="none">
          <circle v-for="(circle, idx) in userCircles" :key="`circle-${idx}`" :cx="circle.x" :cy="circle.y" :r="circle.radius" fill="none" stroke="#ff6b6b" stroke-width="1" opacity="0.8" />
          <line v-for="(arrow, idx) in userArrows" :key="`arrow-${idx}`" :x1="arrow.x1" :y1="arrow.y1" :x2="arrow.x2" :y2="arrow.y2" stroke="#ff6b6b" stroke-width="2" opacity="0.8" />
        </svg>

        <svg class="ar" viewBox="0 0 90 100" preserveAspectRatio="none" v-if="showArrows">
           <defs>
            <marker v-for="(color, idx) in arrowColors" :key="`marker-${idx}`" :id="`ah-${idx}`" markerWidth="2.5" markerHeight="2.5" refX="1.5" refY="1.25" orient="auto"><polygon points="0 0, 2.5 1.25, 0 2.5" :fill="color" /></marker>
          </defs>
          <template v-for="(a, idx) in arrs" :key="`arrow-${idx}`">
            <line :x1="a.x1" :y1="a.y1" :x2="a.x2" :y2="a.y2" :style="{ stroke: arrowColor(idx) }" :marker-end="`url(#ah-${idx % arrowColors.length})`" class="al" />
          </template>
        </svg>

        <div class="valid-moves-indicators" v-if="validMovesForSelectedPiece.length > 0 && !pendingFlip">
          <div v-for="(move, index) in validMovesForSelectedPiece" :key="`valid-move-${index}`" class="valid-move-dot" :style="{ ...rcStyle(move.row, move.col), width: '2.5%' }"></div>
        </div>

        <div class="board-labels" v-if="showCoordinates">
          <div class="rank-labels"><span v-for="(rank, index) in ranks" :key="rank" :style="rankLabelStyle(index)">{{ rank }}</span></div>
          <div class="file-labels"><span v-for="(file, index) in files" :key="file" :style="fileLabelStyle(index)">{{ file }}</span></div>
        </div>

        <div v-if="pendingFlip" class="flip-overlay-absolute" @click.stop></div>

        <div 
          v-if="pendingFlip" 
          class="radial-menu-container"
          :style="{
            ...rcStyle(
               pendingFlip.row !== undefined ? pendingFlip.row : (selectedPiece ? selectedPiece.row : 4), 
               pendingFlip.col !== undefined ? pendingFlip.col : (selectedPiece ? selectedPiece.col : 4), 
               2500
            ),
            width: '34%', height: 'auto', 'aspect-ratio': '1/1'
          }"
        >
          <div v-for="(item, index) in flipSelectionPieces" :key="item.name" 
               class="radial-item" 
               :style="getRadialItemStyle(index, flipSelectionPieces.length)" 
               @click.stop="handleFlipSelect(item.name)"
               @mousedown.stop @touchstart.stop>
            <img :src="getPieceImageUrl(item.name)" class="radial-img" />
            <div class="radial-count">{{ item.count }}</div>
          </div>
        </div>
        <ClearHistoryConfirmDialog :visible="showClearHistoryDialog" :onConfirm="onConfirmClearHistory" :onCancel="onCancelClearHistory" />
      </div>

      <div v-if="pendingFlip" class="flip-hint-area">
        <div class="flip-hint-text">
          <v-icon icon="mdi-gesture-tap" size="small" class="mr-1"></v-icon>
          Vui lòng chọn quân {{ pendingFlip.side === 'red' ? 'Đỏ' : 'Đen' }}
        </div>
      </div>
    </div>

    <div class="side-panel">
      <div class="pool-section top-pool">
        <div v-for="item in (isRedOnTop ? redPool : blackPool)" :key="item.char" class="pool-row">
          <img :src="getPieceImageUrl(item.name)" class="pool-img" />
          <div class="pool-controls"><span class="pool-num" :class="isRedOnTop ? 'red-num' : 'black-num'">{{ item.count }}</span><div class="pool-btns"><button class="tiny-btn" @click="adjustUnrevealedCount(item.char, 1)">+</button><button class="tiny-btn" @click="adjustUnrevealedCount(item.char, -1)">-</button></div></div>
        </div>
      </div>
      <div class="pool-divider"><div v-if="poolErrorMessage" class="pool-error"><span>{{ poolErrorMessage }}</span></div></div>
      <div class="pool-section bottom-pool">
        <div v-for="item in (isRedOnTop ? blackPool : redPool)" :key="item.char" class="pool-row">
          <img :src="getPieceImageUrl(item.name)" class="pool-img" />
          <div class="pool-controls"><span class="pool-num" :class="isRedOnTop ? 'black-num' : 'red-num'">{{ item.count }}</span><div class="pool-btns"><button class="tiny-btn" @click="adjustUnrevealedCount(item.char, 1)">+</button><button class="tiny-btn" @click="adjustUnrevealedCount(item.char, -1)">-</button></div></div>
        </div>
      </div>
    </div>
    
    <EvaluationChart v-if="showPositionChart" :history="history" :current-move-index="currentMoveIndex" :initial-fen="unref(gs?.initialFen)" @seek="handleChartSeek" />
  </div>
</template>
<style scoped lang="scss">
  /* --- LAYOUT CHÍNH --- */
  .chessboard-wrapper {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    justify-content: center;
    gap: 20px;
    width: 100%;
    max-width: 95vmin;
    margin: 0 auto;
    padding: 20px;
    
    @media (max-width: 768px) {
      flex-direction: column;
      padding: 10px;
      gap: 12px;
    }
  }

  .main-column {
    display: flex; flex-direction: column; flex: 0 0 auto; width: 80%; gap: 12px;
    @media (max-width: 768px) { width: 100%; }
  }

  .chessboard-container {
    position: relative;
    width: 100%;
    aspect-ratio: 9/10;
    margin: auto;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    /* QUAN TRỌNG: Để menu vòng tròn không bị cắt khi tràn ra */
    overflow: visible !important;
  }

  .bg { width: 100%; height: 100%; display: block; }

  /* --- CÁC LỚP TRÊN BÀN CỜ --- */
  .pieces { position: absolute; inset: 0; z-index: 20; }
  .piece { position: absolute; aspect-ratio: 1; pointer-events: none; 
    &.animated { transition: all 0.2s ease; }
    &.inCheck { transform: translate(-50%, -50%) scale(1.1); filter: drop-shadow(0 0 10px red); z-index: 100; }
  }

  /* Selection Mark */
  .selection-mark { position: absolute; width: 12%; aspect-ratio: 1; transform: translate(-50%, -50%); z-index: 30; pointer-events: none; }
  .corner { position: absolute; width: 25%; height: 25%; border: 3px solid #007bff; }
  .top-left { top: 0; left: 0; border-right: none; border-bottom: none; }
  .top-right { top: 0; right: 0; border-left: none; border-bottom: none; }
  .bottom-left { bottom: 0; left: 0; border-right: none; border-top: none; }
  .bottom-right { bottom: 0; right: 0; border-left: none; border-top: none; }

  /* Highlight Last Move */
  .highlight.from { position: absolute; transform: translate(-50%,-50%); width: 2.5%; aspect-ratio: 1; background: rgba(255,0,0,0.5); border-radius: 50%; pointer-events: none; }
  .highlight.to { position: absolute; transform: translate(-50%,-50%); width: 12%; aspect-ratio: 1; border: 2px solid rgba(0,0,255,0.5); pointer-events: none; 
    .corner { border-color: #4ecdc4; }
  }

  /* Valid Move Dots */
  .valid-move-dot { position: absolute; transform: translate(-50%,-50%); width: 2.5%; aspect-ratio: 1; background: #4caf50; border-radius: 50%; pointer-events: none; z-index: 15; }

  /* Eval Bar */
  .eval-bar { position: absolute; top: 0; bottom: 0; left: -12px; width: 8px; background: #ddd; border-radius: 4px; overflow: hidden; }
  .eval-top { width: 100%; transition: height 0.2s; }
  .eval-bottom { width: 100%; transition: height 0.2s; }
  .eval-marker { position: absolute; left: 0; right: 0; height: 2px; background: #fff; }

  /* --- CẤU HÌNH LẬT QUÂN (FIXED) --- */
  
  /* 1. Lớp phủ mờ (Overlay) - Dùng absolute để chỉ phủ bàn cờ, không phủ menu */
  .flip-overlay-absolute {
    position: absolute;
    inset: 0; /* Phủ kín bàn cờ */
    background: rgba(0, 0, 0, 0.3); /* Màu đen mờ */
    z-index: 1900; /* Cao hơn quân cờ (20) nhưng thấp hơn Menu (2000) */
    cursor: not-allowed;
  }

  /* 2. Menu Vòng Tròn */
  .radial-menu-container {
    position: absolute;
    transform: translate(-50%, -50%);
    z-index: 2000; /* Cao nhất */
    animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    /* Quan trọng: Cho phép nhận click */
    pointer-events: auto; 
  }

  @keyframes popIn {
    from { transform: translate(-50%, -50%) scale(0); opacity: 0; }
    to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  }

  .radial-item {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 25%; aspect-ratio: 1;
    border-radius: 50%;
    background: rgba(30, 30, 30, 0.95);
    border: 2px solid rgba(255, 255, 255, 0.5);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
    transition: transform 0.2s, background 0.2s;
    
    /* Đảm bảo click được */
    pointer-events: auto;

    &:hover {
      transform: translate(-50%, -50%) scale(1.2);
      background: #222;
      border-color: #00d2ff;
      z-index: 2050;
    }
    
    &:active {
      transform: translate(-50%, -50%) scale(0.95);
    }
  }

  .radial-img { width: 80%; height: 80%; object-fit: contain; }
  .radial-count {
    position: absolute; top: -5px; right: -5px;
    background: #f44336; color: white;
    font-size: 10px; font-weight: bold;
    width: 18px; height: 18px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #fff;
  }

  .flip-hint-area {
    margin-top: 10px;
    background: rgba(0,0,0,0.6);
    color: #fff;
    padding: 8px; border-radius: 6px;
    text-align: center;
    font-size: 14px;
  }

  /* KHO QUÂN (SIDE PANEL) */
  .side-panel { display: flex; flex-direction: column; justify-content: space-between; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; }
  .pool-row { display: flex; align-items: center; background: rgba(255,255,255,0.1); margin-bottom: 4px; padding: 2px; border-radius: 4px; }
  .pool-img { width: 30px; height: 30px; }
  .pool-controls { display: flex; align-items: center; margin-left: 5px; }
  .pool-num { color: #fff; font-weight: bold; margin-right: 5px; }
  .red-num { color: #ff5252; } .black-num { color: #222; text-shadow: 0 0 2px #fff; }
  .pool-btns { display: flex; flex-direction: column; gap: 1px; }
  .tiny-btn { width: 16px; height: 16px; line-height: 12px; font-size: 10px; background: #555; color: #fff; border: none; cursor: pointer; }
  
  /* Các lớp khác (Drawing, Arrow) */
  .ar, .user-drawings, .board-labels { position: absolute; inset: 0; pointer-events: none; }
  .annotation-layer { position: absolute; inset: 0; pointer-events: none; z-index: 50; }
  .annotation-badge { position: absolute; top: -10px; right: -10px; width: 20px; height: 20px; background: #007bff; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid #fff; }
</style>