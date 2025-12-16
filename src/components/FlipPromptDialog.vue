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
               :class="{ 
                 animated: isAnimating && showAnimations, 
                 inCheck: p.id === checkedKingId,
                 'being-flipped': pendingFlip && ( (pendingFlip.row === p.row && pendingFlip.col === p.col) || (selectedPiece && p.id === selectedPiece.id) )
               }" 
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

        <svg class="ar" viewBox="0 0 90 100" preserveAspectRatio="none" v-if="showArrows">
          <defs>
            <marker v-for="(color, idx) in arrowColors" :key="`marker-${idx}`" :id="`ah-${idx}`" markerWidth="2.5" markerHeight="2.5" refX="1.5" refY="1.25" orient="auto"><polygon points="0 0, 2.5 1.25, 0 2.5" :fill="color" /></marker>
            <marker id="ah-selected" markerWidth="2.5" markerHeight="2.5" refX="1.5" refY="1.25" orient="auto"><polygon points="0 0, 2.5 1.25, 0 2.5" fill="#e53935" /></marker>
          </defs>
          <template v-for="(a, idx) in arrs" :key="`arrow-${idx}`">
            <line :x1="a.x1" :y1="a.y1" :x2="a.x2" :y2="a.y2" :style="{ stroke: arrowColor(idx) }" :marker-end="`url(#ah-${idx % arrowColors.length})`" class="al" />
          </template>
        </svg>

        <div v-if="pendingFlip" class="flip-overlay-fixed" @click.stop></div>

        <div v-if="pendingFlip" class="radial-menu-container"
          :style="{
            ...rcStyle(
               pendingFlip.row !== undefined ? pendingFlip.row : (selectedPiece ? selectedPiece.row : 4), 
               pendingFlip.col !== undefined ? pendingFlip.col : (selectedPiece ? selectedPiece.col : 4), 
               9999
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

          <div v-if="flipSelectionPieces.length === 0" class="radial-error-btn" @click.stop="handleFlipRandom">
             <span>Hết quân! Bấm để bỏ qua</span>
          </div>
        </div>
        <ClearHistoryConfirmDialog :visible="showClearHistoryDialog" :onConfirm="onConfirmClearHistory" :onCancel="onCancelClearHistory" />
      </div>

      <div v-if="pendingFlip" class="flip-hint-area">
        <div class="flip-hint-text">
          <v-icon icon="mdi-gesture-tap" size="small" class="mr-1"></v-icon>
          Vui lòng chọn quân {{ pendingFlip.side === 'red' ? 'Đỏ' : 'Đen' }} cần lật
        </div>
      </div>
    </div>

    <div class="side-panel">
      <div class="pool-section top-pool">
        <div v-for="item in (isRedOnTop ? redPool : blackPool)" :key="item.char" class="pool-row">
          <img :src="getPieceImageUrl(item.name)" class="pool-img" />
          <div class="pool-controls">
             <span class="pool-num" :class="isRedOnTop ? 'red-num' : 'black-num'">{{ item.count }}</span>
             <div class="pool-btns">
                <button class="tiny-btn" @click="adjustUnrevealedCount(item.char, 1)" :disabled="item.count >= item.max">+</button>
                <button class="tiny-btn" @click="adjustUnrevealedCount(item.char, -1)" :disabled="item.count <= 0">-</button>
             </div>
          </div>
        </div>
      </div>
      
      <div class="pool-divider">
        <div v-if="poolErrorMessage" class="pool-error">
          <v-icon icon="mdi-alert-circle" size="x-small" color="error"></v-icon>
          <span>{{ poolErrorMessage }}</span>
        </div>
      </div>

      <div class="pool-section bottom-pool">
        <div v-for="item in (isRedOnTop ? blackPool : redPool)" :key="item.char" class="pool-row">
          <img :src="getPieceImageUrl(item.name)" class="pool-img" />
          <div class="pool-controls">
             <span class="pool-num" :class="isRedOnTop ? 'black-num' : 'red-num'">{{ item.count }}</span>
             <div class="pool-btns">
                <button class="tiny-btn" @click="adjustUnrevealedCount(item.char, 1)" :disabled="item.count >= item.max">+</button>
                <button class="tiny-btn" @click="adjustUnrevealedCount(item.char, -1)" :disabled="item.count <= 0">-</button>
             </div>
          </div>
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

  const { t } = useI18n()
  const { showCoordinates, showAnimations, showPositionChart, showEvaluationBar, showArrows } = useInterfaceSettings()
  
  const gs: any = inject('game-state')
  const es = inject('engine-state') as any
  const jaiEngine = inject('jai-engine-state') as any
  
  const { pieces, selectedPieceId, handleBoardClick, isAnimating, lastMovePositions, registerArrowClearCallback, history, currentMoveIndex, unrevealedPieceCounts, adjustUnrevealedCount, getPieceNameFromChar, validationStatus, pendingFlip } = gs
  
  const isMatchRunning = computed(() => jaiEngine?.isMatchRunning?.value || false)
  const selectedPiece = computed(() => { if (!unref(selectedPieceId)) return null; return unref(pieces).find((p: Piece) => p.id === unref(selectedPieceId)) })

  const flipSelectionPieces = computed(() => {
    if (!pendingFlip.value) return []
    const requiredSide = pendingFlip.value.side
    return Object.entries(unrevealedPieceCounts.value)
      .map(([char, count]) => ({ name: getPieceNameFromChar(char), char, count: Number(count) }))
      .filter(item => {
        const charCode = item.char.charCodeAt(0)
        const itemSide = (charCode >= 97) ? 'black' : 'red'
        return itemSide === requiredSide && item.count > 0
      })
  })

  const getRadialItemStyle = (index: number, total: number) => {
    const radiusPercent = 37 
    const angleStep = (2 * Math.PI) / total
    const angle = index * angleStep - (Math.PI / 2)
    const x = 50 + radiusPercent * Math.cos(angle)
    const y = 50 + radiusPercent * Math.sin(angle)
    return { left: `${x}%`, top: `${y}%` }
  }

  const handleFlipSelect = (pieceName: string) => { if (pendingFlip.value && pendingFlip.value.callback) pendingFlip.value.callback(pieceName) }
  const handleFlipRandom = () => { /* Logic ngẫu nhiên */ }

  const PAD_X = 11, PAD_Y = 11, COLS = 9, ROWS = 10, GX = 100 - PAD_X, GY = 100 - PAD_Y, OX = PAD_X / 2, OY = PAD_Y / 2
  const files = computed(() => { const base = 'abcdefghi'.split(''); return gs.isBoardFlipped.value ? base.slice().reverse() : base })
  const ranks = computed(() => { const base = Array.from({ length: 10 }, (_, i) => 9 - i); return gs.isBoardFlipped.value ? base.slice().reverse() : base })
  const img = (p: Piece) => new URL(`../assets/${p.isKnown ? p.name : 'dark_piece'}.png`, import.meta.url).href
  const getPieceImageUrl = (name: string) => new URL(`../assets/${name}.png`, import.meta.url).href
  const percentFromRC = (row: number, col: number) => ({ x: OX + (col / (COLS - 1)) * GX, y: OY + (row / (ROWS - 1)) * GY })
  const rcStyle = (r: number, c: number, zIndex?: number) => {
    const { x, y } = percentFromRC(r, c)
    return { top: `${y}%`, left: `${x}%`, width: '12%', transform: 'translate(-50%,-50%)', ...(zIndex !== undefined && { zIndex: zIndex }) }
  }
  const displayRow = (r: number) => (gs.isBoardFlipped.value ? 9 - r : r)
  const displayCol = (c: number) => (gs.isBoardFlipped.value ? 8 - c : c)
  const isRedOnTop = computed(() => !!gs?.isBoardFlipped?.value)
  const INITIAL_COUNTS: any = { r: 2, n: 2, b: 2, a: 2, c: 2, p: 5, R: 2, N: 2, B: 2, A: 2, C: 2, P: 5 }
  const blackPool = computed(() => ['r', 'n', 'c', 'a', 'b', 'p'].map(c => ({ char: c, name: getPieceNameFromChar(c), count: unrevealedPieceCounts?.value?.[c] || 0, max: INITIAL_COUNTS[c] })))
  const redPool = computed(() => ['R', 'N', 'C', 'A', 'B', 'P'].map(c => ({ char: c, name: getPieceNameFromChar(c), count: unrevealedPieceCounts?.value?.[c] || 0, max: INITIAL_COUNTS[c] })))
  const poolErrorMessage = computed(() => validationStatus.value?.includes('Error') ? validationStatus.value : null)
  
  const showClearHistoryDialog = ref(false), pendingMove = ref<any>(null)
  const boardClick = (e: MouseEvent) => {
    if (isMatchRunning.value || pendingFlip.value) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const col = Math.round((((e.clientX - rect.left) / rect.width * 100 - OX) / GX) * (COLS - 1))
    const row = Math.round((((e.clientY - rect.top) / rect.height * 100 - OY) / GY) * (ROWS - 1))
    const result = handleBoardClick(Math.max(0, Math.min(ROWS - 1, row)), Math.max(0, Math.min(COLS - 1, col)))
    if (result?.requireClearHistoryConfirm) { pendingMove.value = result.move; showClearHistoryDialog.value = true }
  }
  const onConfirmClearHistory = () => { if (pendingMove.value) gs.clearHistoryAndMove(pendingMove.value.piece, pendingMove.value.row, pendingMove.value.col); showClearHistoryDialog.value = false }
  const onCancelClearHistory = () => { showClearHistoryDialog.value = false }

  const { arrs, arrowColors, arrowColor, currentEvalPercent, checkedKingId, getAnnotationClass, getCurrentMoveAnnotation } = es // Giả định từ engine state
</script>

<style scoped lang="scss">
  .chessboard-wrapper { display: flex; flex-direction: row; justify-content: center; gap: 20px; width: 100%; max-width: 95vmin; margin: 0 auto; padding: 20px; @media (max-width: 768px) { flex-direction: column; padding: 10px; } }
  .chessboard-container { position: relative; width: 100%; aspect-ratio: 9/10; margin: auto; user-select: none; overflow: visible !important; z-index: 1; }
  .bg { width: 100%; height: 100%; display: block; }
  .pieces { position: absolute; inset: 0; z-index: 20; }
  .piece { position: absolute; aspect-ratio: 1; pointer-events: none; &.animated { transition: all 0.2s ease; } &.inCheck { transform: translate(-50%, -50%) scale(1.1); filter: drop-shadow(0 0 10px red); z-index: 100; } }
  
  .flip-overlay-fixed { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.3); z-index: 9000; cursor: not-allowed; }
  .radial-menu-container { position: absolute; transform: translate(-50%, -50%); z-index: 9999; animation: popIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275); pointer-events: auto; width: 0; height: 0; overflow: visible; }
  @keyframes popIn { from { transform: translate(-50%, -50%) scale(0); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
  
  .radial-item {
    position: absolute; width: 45px; height: 45px; border-radius: 50%;
    background: rgba(30, 30, 30, 0.95); border: 2px solid rgba(255, 255, 255, 0.5);
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.6); transition: all 0.1s;
    pointer-events: auto; margin-left: -22.5px; margin-top: -22.5px;
    &:hover { transform: scale(1.2); background: #222; border-color: #00d2ff; z-index: 10000; }
  }
  .radial-img { width: 85%; height: 85%; object-fit: contain; pointer-events: none; }
  .radial-count { position: absolute; top: -5px; right: -5px; background: #f44336; color: white; font-size: 10px; font-weight: bold; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid #fff; }

  .side-panel { display: flex; flex-direction: column; justify-content: space-between; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; min-width: 80px; flex: 1; align-self: stretch; }
  .pool-row { display: flex; align-items: center; background: rgba(255,255,255,0.1); margin-bottom: 4px; padding: 4px; border-radius: 4px; justify-content: center; }
  .pool-num { color: #fff; font-weight: bold; margin-right: 5px; font-size: 1.1rem; }
  .red-num { color: #ff5252; } .black-num { color: #222; text-shadow: 0 0 2px #fff; }
  .tiny-btn { width: 16px; height: 16px; line-height: 12px; font-size: 10px; background: #555; color: #fff; border: none; cursor: pointer; }
</style>