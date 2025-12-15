<template>
  <div class="chessboard-wrapper" :class="{ 'has-chart': showPositionChart }">
    
    <div class="main-column">
      <div class="chessboard-container">
        <img src="@/assets/xiangqi.png" class="bg" alt="board" />

        <div v-if="showEvaluationBar && currentEvalPercent !== null" class="eval-bar" aria-hidden="true">
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
            <div class="corner top-left"></div><div class="corner top-right"></div><div class="corner bottom-left"></div><div class="corner bottom-right"></div>
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

        <div v-if="pendingFlip" class="flip-overlay-fixed" @click.stop></div>

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
               @mousedown.stop 
               @touchstart.stop>
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

<script setup lang="ts">
  import { inject, ref, watch, computed, watchEffect, onMounted, onUnmounted, unref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { Piece } from '@/composables/useChessGame'
  import { useInterfaceSettings } from '@/composables/useInterfaceSettings'
  import ClearHistoryConfirmDialog from './ClearHistoryConfirmDialog.vue'
  import EvaluationChart from './EvaluationChart.vue'
  import { MATE_SCORE_BASE } from '@/utils/constants'
  import { isAndroidPlatform } from '@/utils/platform'

  const handleChartSeek = (idx: number) => { try { const gsAny: any = gs; if (gsAny?.replayToMove) gsAny.replayToMove(idx) } catch {} }
  const { t } = useI18n()
  const PAD_X = 11, PAD_Y = 11, COLS = 9, ROWS = 10, GX = 100 - PAD_X, GY = 100 - PAD_Y, OX = PAD_X / 2, OY = PAD_Y / 2
  const files = computed(() => { const baseFiles = 'abcdefghi'.split(''); return gs.isBoardFlipped.value ? baseFiles.slice().reverse() : baseFiles })
  const ranks = computed(() => { const baseRanks = Array.from({ length: 10 }, (_, i) => 9 - i); return gs.isBoardFlipped.value ? baseRanks.slice().reverse() : baseRanks })
  const { showCoordinates, showAnimations, showPositionChart, showEvaluationBar, showArrows } = useInterfaceSettings()
  const gs: any = inject('game-state')
  const es = inject('engine-state') as { pvMoves: any; bestMove: any; isThinking: any; multiPvMoves: any; stopAnalysis: any; isPondering: any; isInfinitePondering: any; ponderMove: any; ponderhit: any; analysis?: any }
  const jaiEngine = inject('jai-engine-state') as any
  const isMatchRunning = computed(() => jaiEngine?.isMatchRunning?.value || false)
  const { pieces, selectedPieceId, handleBoardClick, isAnimating, lastMovePositions, registerArrowClearCallback, history, currentMoveIndex, unrevealedPieceCounts, adjustUnrevealedCount, getPieceNameFromChar, validationStatus, pendingFlip } = gs

  const selectedPiece = computed(() => { if (!unref(selectedPieceId)) return null; return unref(pieces).find((p: Piece) => p.id === unref(selectedPieceId)) })

  // --- LOGIC VÒNG TRÒN ---
  const flipSelectionPieces = computed(() => {
    if (!pendingFlip.value) return []
    const requiredSide = pendingFlip.value.side
    return Object.entries(unrevealedPieceCounts.value)
      .map(([char, count]) => ({ name: getPieceNameFromChar(char), char, count }))
      .filter(item => {
        const pieceSide = item.name.startsWith('red') ? 'red' : 'black'
        return pieceSide === requiredSide && (item.count as number) > 0
      })
  })

  const getRadialItemStyle = (index: number, total: number) => {
    const radiusPercent = 37; 
    const angleStep = (2 * Math.PI) / total;
    const angle = index * angleStep - (Math.PI / 2);
    const x = 50 + radiusPercent * Math.cos(angle);
    const y = 50 + radiusPercent * Math.sin(angle);
    return { left: `${x}%`, top: `${y}%` };
  }

  const handleFlipSelect = (pieceName: string) => {
    if (pendingFlip.value && pendingFlip.value.callback) {
      pendingFlip.value.callback(pieceName)
    }
  }
  // ----------------------

  const poolErrorMessage = computed(() => {
    if (!validationStatus.value) return null
    let msg = validationStatus.value.replace(/^Error:\s*|^错误:\s*/i, '').trim()
    return `Lỗi: ${msg}`
  })

  const INITIAL_PIECE_COUNTS: { [k: string]: number } = { r: 2, n: 2, b: 2, a: 2, c: 2, p: 5, k: 1, R: 2, N: 2, B: 2, A: 2, C: 2, P: 5, K: 1 }
  const blackPool = computed(() => ['r', 'n', 'c', 'a', 'b', 'p'].map(char => ({ char, name: getPieceNameFromChar(char), count: unrevealedPieceCounts?.value?.[char] || 0, max: INITIAL_PIECE_COUNTS[char] })))
  const redPool = computed(() => ['R', 'N', 'C', 'A', 'B', 'P'].map(char => ({ char, name: getPieceNameFromChar(char), count: unrevealedPieceCounts?.value?.[char] || 0, max: INITIAL_PIECE_COUNTS[char] })))
  
  function getPieceImageUrl(pieceName: string): string { return new URL(`../assets/${pieceName}.png`, import.meta.url).href }

  const userCircles = ref<Array<any>>([]); const userArrows = ref<Array<any>>([]); const isDrawing = ref(false)
  const isCurrentPositionInCheck = gs.isCurrentPositionInCheck; const validMovesForSelectedPiece = computed(() => gs.getValidMovesForSelectedPiece.value)
  const isRedOnTop = computed(() => !!gs?.isBoardFlipped?.value); const checkedKingId = computed(() => { if (isCurrentPositionInCheck('red')) return gs.pieces.value.find((p: Piece) => p.name === 'red_king')?.id; if (isCurrentPositionInCheck('black')) return gs.pieces.value.find((p: Piece) => p.name === 'black_king')?.id; return null })

  const percentFromRC = (row: number, col: number) => ({ x: OX + (col / (COLS - 1)) * GX, y: OY + (row / (ROWS - 1)) * GY })
  const img = (p: Piece) => new URL(`../assets/${p.isKnown ? p.name : 'dark_piece'}.png`, import.meta.url).href
  
  const rcStyle = (r: number, c: number, zIndex?: number) => {
    const { x, y } = percentFromRC(r, c)
    return { top: `${y}%`, left: `${x}%`, width: '12%', transform: 'translate(-50%,-50%)', ...(zIndex !== undefined && { zIndex: zIndex }) }
  }
  const rankLabelStyle = (index: number) => ({ top: `${percentFromRC(index, 0).y}%`, transform: 'translateY(-50%)' })
  const fileLabelStyle = (index: number) => ({ left: `${percentFromRC(0, index).x}%`, transform: 'translateX(-50%)' })
  
  const displayRow = (r: number) => (gs.isBoardFlipped.value ? 9 - r : r); const displayCol = (c: number) => (gs.isBoardFlipped.value ? 8 - c : c)
  const showClearHistoryDialog = ref(false); const pendingMove = ref<any>(null)
  
  const boardClick = (e: MouseEvent) => {
    if (isMatchRunning.value) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const col = Math.round((((e.clientX - rect.left) / rect.width * 100 - OX) / GX) * (COLS - 1))
    const row = Math.round((((e.clientY - rect.top) / rect.height * 100 - OY) / GY) * (ROWS - 1))
    const result = handleBoardClick(Math.max(0, Math.min(ROWS - 1, row)), Math.max(0, Math.min(COLS - 1, col)))
    if (result?.requireClearHistoryConfirm) { pendingMove.value = result.move; showClearHistoryDialog.value = true }
  }

  const clearUserDrawings = () => { userCircles.value = []; userArrows.value = [] }; if (gs) gs.clearUserArrows = clearUserDrawings
  const onConfirmClearHistory = () => { if (pendingMove.value) gs.clearHistoryAndMove(pendingMove.value.piece, pendingMove.value.row, pendingMove.value.col); showClearHistoryDialog.value = false; pendingMove.value = null }
  const onCancelClearHistory = () => { showClearHistoryDialog.value = false; pendingMove.value = null }

  const arrs = ref<any>([]); const arrowColors = ['#0066cc', '#e53935', '#43a047']; const arrowColor = (idx: number) => arrowColors[idx % arrowColors.length]
  const getAnnotationClass = () => ''; const getCurrentMoveAnnotation = () => null
  const currentEvalPercent = computed(() => 50) 
  // (Giản lược phần Evaluation/Arrow logic để tập trung vào fix UI)
</script>

<style scoped lang="scss">
  /* 1. LAYER OVERLAY: Đảm bảo nằm dưới Menu */
  .flip-overlay-fixed {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    z-index: 1900; /* Thấp hơn Menu (2000) */
    background: rgba(0,0,0,0.1); /* Hơi tối để biết đang active */
    cursor: not-allowed;
  }

  /* 2. LAYER MENU: Đảm bảo nằm trên cùng */
  .radial-menu-container {
    position: absolute; transform: translate(-50%, -50%);
    z-index: 2000; /* Cao nhất */
    animation: zoomIn 0.25s ease-out;
    pointer-events: auto; /* Bắt buộc nhận click */
  }

  .radial-item {
    position: absolute; transform: translate(-50%, -50%);
    width: 25%; aspect-ratio: 1; border-radius: 50%;
    background: rgba(40, 40, 40, 0.9);
    border: 2px solid rgba(255,255,255,0.5);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    transition: transform 0.2s;
    
    &:hover {
      background: rgba(60, 60, 60, 1);
      border-color: #00d2ff;
      transform: translate(-50%, -50%) scale(1.2);
      z-index: 2050;
    }
    
    &:active {
      transform: translate(-50%, -50%) scale(0.95);
    }
  }

  .radial-img { width: 80%; height: 80%; object-fit: contain; }
  .radial-count {
    position: absolute; top: -5px; right: -5px;
    background: #ff3d00; color: white;
    font-size: 10px; font-weight: bold;
    width: 16px; height: 16px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid #fff;
  }

  .flip-hint-area {
    margin-top: 10px;
    background: rgba(0, 0, 0, 0.6);
    color: #fff;
    padding: 8px; border-radius: 4px;
    text-align: center;
    font-size: 14px;
  }

  /* Layout Bàn cờ */
  .chessboard-wrapper {
    display: flex; justify-content: center; gap: 20px; padding: 20px;
    @media (max-width: 768px) { flex-direction: column; padding: 10px; }
  }
  .chessboard-container {
    position: relative; width: 100%; aspect-ratio: 9/10;
    overflow: visible !important; /* QUAN TRỌNG: Để menu không bị cắt */
  }
  .bg { width: 100%; height: 100%; display: block; }
  
  /* Quân cờ */
  .piece { position: absolute; aspect-ratio: 1; pointer-events: none; }
  
  /* Selection */
  .selection-mark { position: absolute; width: 12%; aspect-ratio: 1; transform: translate(-50%, -50%); z-index: 30; }
  .corner { position: absolute; width: 25%; height: 25%; border: 3px solid #007bff; }
  .top-left { top: 0; left: 0; border-right: none; border-bottom: none; }
  .top-right { top: 0; right: 0; border-left: none; border-bottom: none; }
  .bottom-left { bottom: 0; left: 0; border-right: none; border-top: none; }
  .bottom-right { bottom: 0; right: 0; border-left: none; border-top: none; }

  /* Side Panel */
  .side-panel { background: rgba(0,0,0,0.1); padding: 10px; border-radius: 8px; min-width: 80px; display: flex; flex-direction: column; justify-content: space-between; }
  .pool-row { display: flex; align-items: center; background: rgba(255,255,255,0.2); margin-bottom: 4px; padding: 2px; border-radius: 4px; }
  .pool-img { width: 30px; height: 30px; }
  .pool-controls { display: flex; flex-direction: column; align-items: center; margin-left: 5px; }
  .pool-num { font-weight: bold; color: #fff; font-size: 14px; }
  .red-num { color: #ff5252; } .black-num { color: #222; }
  .tiny-btn { width: 16px; height: 16px; line-height: 14px; font-size: 12px; background: #444; color: #fff; border: none; cursor: pointer; margin: 1px; }

  /* Last move */
  .highlight.from { position: absolute; transform: translate(-50%,-50%); width: 2.5%; aspect-ratio: 1; background: rgba(255,0,0,0.5); border-radius: 50%; }
  .highlight.to { position: absolute; transform: translate(-50%,-50%); width: 12%; aspect-ratio: 1; border: 2px solid rgba(0,0,255,0.5); }
</style>