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
          <div class="corner top-left"></div><div class="corner top-right"></div><div class="corner bottom-left"></div><div class="corner bottom-right"></div>
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
          <template v-if="flipSelectionPieces.length > 0">
            <div v-for="(item, index) in flipSelectionPieces" :key="item.name" 
                 class="radial-item" 
                 :style="getRadialItemStyle(index, flipSelectionPieces.length)" 
                 @click.stop="handleFlipSelect(item.name)"
                 @mousedown.stop @touchstart.stop>
              <img :src="getPieceImageUrl(item.name)" class="radial-img" />
              <div class="radial-count">{{ item.count }}</div>
            </div>
          </template>

          <template v-else>
             <div class="radial-error-btn" @click.stop="forceResolveFlip">
                <span>Trống! Click để bỏ qua</span>
             </div>
          </template>
        </div>
        <ClearHistoryConfirmDialog :visible="showClearHistoryDialog" :onConfirm="onConfirmClearHistory" :onCancel="onCancelClearHistory" />
      </div>

      <div v-if="pendingFlip" class="flip-hint-area">
        <div class="flip-hint-text">
          <v-icon icon="mdi-gesture-tap" size="small" class="mr-1"></v-icon>
          Chọn quân {{ pendingFlip.side === 'red' ? 'Đỏ' : 'Đen' }}
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

  const { t } = useI18n()
  const { showCoordinates, showAnimations, showPositionChart, showEvaluationBar, showArrows } = useInterfaceSettings()
  
  const gs: any = inject('game-state')
  const es = inject('engine-state') as any
  const jaiEngine = inject('jai-engine-state') as any
  
  const { pieces, selectedPieceId, handleBoardClick, isAnimating, lastMovePositions, registerArrowClearCallback, history, currentMoveIndex, unrevealedPieceCounts, adjustUnrevealedCount, getPieceNameFromChar, validationStatus, pendingFlip } = gs
  
  const isMatchRunning = computed(() => jaiEngine?.isMatchRunning?.value || false)
  const selectedPiece = computed(() => { if (!unref(selectedPieceId)) return null; return unref(pieces).find((p: Piece) => p.id === unref(selectedPieceId)) })

  // === CẤU HÌNH BÀN CỜ ===
  const PAD_X = 11, PAD_Y = 11, COLS = 9, ROWS = 10, GX = 100 - PAD_X, GY = 100 - PAD_Y, OX = PAD_X / 2, OY = PAD_Y / 2
  const files = computed(() => { const base = 'abcdefghi'.split(''); return gs.isBoardFlipped.value ? base.slice().reverse() : base })
  const ranks = computed(() => { const base = Array.from({ length: 10 }, (_, i) => 9 - i); return gs.isBoardFlipped.value ? base.slice().reverse() : base })
  
  // === LOGIC MENU VÒNG TRÒN ===
  const flipSelectionPieces = computed(() => {
    if (!pendingFlip.value) return []
    const requiredSide = pendingFlip.value.side
    const counts = unrevealedPieceCounts.value || {}
    return Object.entries(counts)
      .map(([char, count]) => ({ name: getPieceNameFromChar(char), char, count: Number(count) }))
      .filter(item => {
        // Map char to side: r,n,c,a,b,p,k (lowercase) -> black. R,N... -> red
        const charCode = item.char.charCodeAt(0)
        const itemSide = (charCode >= 97) ? 'black' : 'red' // a=97. lowercase is black
        return itemSide === requiredSide && item.count > 0
      })
  })

  const getRadialItemStyle = (index: number, total: number) => {
    const radiusPercent = 37; const angleStep = (2 * Math.PI) / total; const angle = index * angleStep - (Math.PI / 2)
    const x = 50 + radiusPercent * Math.cos(angle); const y = 50 + radiusPercent * Math.sin(angle)
    return { left: `${x}%`, top: `${y}%` }
  }

  const handleFlipSelect = (pieceName: string) => {
    if (pendingFlip.value && pendingFlip.value.callback) { pendingFlip.value.callback(pieceName) }
  }
  
  // FIX LỖI TREO: Nếu danh sách rỗng, click vào nút cứu hộ để tiếp tục
  const forceResolveFlip = () => {
    if (pendingFlip.value && pendingFlip.value.callback) {
       // Chọn đại quân Tốt để game chạy tiếp, tránh crash
       const side = pendingFlip.value.side
       const fallbackName = side === 'red' ? 'red_pawn' : 'black_pawn'
       pendingFlip.value.callback(fallbackName)
    }
  }

  // ... (Các phần helper khác giữ nguyên) ...
  function getPieceImageUrl(pieceName: string): string { return new URL(`../assets/${pieceName}.png`, import.meta.url).href }
  const img = (p: Piece) => new URL(`../assets/${p.isKnown ? p.name : 'dark_piece'}.png`, import.meta.url).href
  const percentFromRC = (row: number, col: number) => ({ x: OX + (col / (COLS - 1)) * GX, y: OY + (row / (ROWS - 1)) * GY })
  const percentToSvgCoords = (row: number, col: number) => ({ x: (OX + (col / (COLS - 1)) * GX) * 0.9, y: OY + (row / (ROWS - 1)) * GY })
  const rcStyle = (r: number, c: number, zIndex?: number) => { const { x, y } = percentFromRC(r, c); return { top: `${y}%`, left: `${x}%`, width: '12%', transform: 'translate(-50%,-50%)', ...(zIndex !== undefined && { zIndex: zIndex }) } }
  
  const poolErrorMessage = computed(() => { if (!validationStatus?.value) return null; let msg = validationStatus.value.replace(/^Error:\s*|^错误:\s*/i, '').trim(); return `Lỗi: ${msg}` })
  const INITIAL_COUNTS: { [k: string]: number } = { r: 2, n: 2, b: 2, a: 2, c: 2, p: 5, k: 1, R: 2, N: 2, B: 2, A: 2, C: 2, P: 5, K: 1 }
  const blackPool = computed(() => ['r', 'n', 'c', 'a', 'b', 'p'].map(c => ({ char: c, name: getPieceNameFromChar(c), count: unrevealedPieceCounts?.value?.[c] || 0, max: INITIAL_COUNTS[c] })))
  const redPool = computed(() => ['R', 'N', 'C', 'A', 'B', 'P'].map(c => ({ char: c, name: getPieceNameFromChar(c), count: unrevealedPieceCounts?.value?.[c] || 0, max: INITIAL_COUNTS[c] })))
  const isRedOnTop = computed(() => !!gs?.isBoardFlipped?.value)

  const showClearHistoryDialog = ref(false); const pendingMove = ref<any>(null)
  const boardClick = (e: MouseEvent) => { if (isMatchRunning.value) return; if (pendingFlip.value) return; const rect = (e.currentTarget as HTMLElement).getBoundingClientRect(); const col = Math.round((((e.clientX - rect.left) / rect.width * 100 - OX) / GX) * (COLS - 1)); const row = Math.round((((e.clientY - rect.top) / rect.height * 100 - OY) / GY) * (ROWS - 1)); const result = handleBoardClick(Math.max(0, Math.min(ROWS - 1, row)), Math.max(0, Math.min(COLS - 1, col))); if (result?.requireClearHistoryConfirm) { pendingMove.value = result.move; showClearHistoryDialog.value = true } }
  const onConfirmClearHistory = () => { if (pendingMove.value) gs.clearHistoryAndMove(pendingMove.value.piece, pendingMove.value.row, pendingMove.value.col); showClearHistoryDialog.value = false; pendingMove.value = null }
  const onCancelClearHistory = () => { showClearHistoryDialog.value = false; pendingMove.value = null }

  const userCircles = ref<any[]>([]); const userArrows = ref<any[]>([]); const arrs = ref<any[]>([])
  const arrowColors = ['#0066cc', '#e53935', '#43a047']; const arrowColor = (i: number) => arrowColors[i % 3]
  const isCurrentPositionInCheck = gs.isCurrentPositionInCheck; const checkedKingId = computed(() => { if (isCurrentPositionInCheck('red')) return gs.pieces.value.find((p: Piece) => p.name === 'red_king')?.id; if (isCurrentPositionInCheck('black')) return gs.pieces.value.find((p: Piece) => p.name === 'black_king')?.id; return null })
  const rankLabelStyle = (i: number) => ({ top: `${percentFromRC(i, 0).y}%`, transform: 'translateY(-50%)' }); const fileLabelStyle = (i: number) => ({ left: `${percentFromRC(0, i).x}%`, transform: 'translateX(-50%)' })
  const displayRow = (r: number) => (gs.isBoardFlipped.value ? 9 - r : r); const displayCol = (c: number) => (gs.isBoardFlipped.value ? 8 - c : c)
  const validMovesForSelectedPiece = computed(() => gs.getValidMovesForSelectedPiece.value)
  const handleChartSeek = (idx: number) => { try { gs.replayToMove && gs.replayToMove(idx) } catch {} }
  const getAnnotationClass = () => ''; const getCurrentMoveAnnotation = () => null
  const { bestMove, multiPvMoves, isThinking, isPondering, isInfinitePondering, ponderMove } = es
  const selectedPvMove = ref<string | null>(null)
  const selectedPvArrow = computed(() => null) // Simplified
  const uciToDisplayRC = (uci: string) => { if (uci.length < 4) return { from: { row: 0, col: 0 }, to: { row: 0, col: 0 } }; const fromCol = uci.charCodeAt(0) - 'a'.charCodeAt(0), fromRow = 9 - +uci[1], toCol = uci.charCodeAt(2) - 'a'.charCodeAt(0), toRow = 9 - +uci[3]; if (!gs.isBoardFlipped.value) return { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } }; else return { from: { row: 9 - fromRow, col: 8 - fromCol }, to: { row: 9 - toRow, col: 8 - toCol } } }
  const updateArrow = () => { if (isThinking.value && multiPvMoves.value.length) { const arrows: any[] = []; multiPvMoves.value.forEach((m: string[]) => { if(m[0]) { const c = uciToDisplayRC(m[0]); const f = percentToSvgCoords(c.from.row, c.from.col); const t = percentToSvgCoords(c.to.row, c.to.col); arrows.push({x1:f.x, y1:f.y, x2:t.x, y2:t.y}) } }); arrs.value = arrows } else if (bestMove.value) { const c = uciToDisplayRC(bestMove.value); const f = percentToSvgCoords(c.from.row, c.from.col); const t = percentToSvgCoords(c.to.row, c.to.col); arrs.value = [{x1:f.x, y1:f.y, x2:t.x, y2:t.y}] } else { arrs.value = [] } }
  watchEffect(() => { void isThinking.value; void multiPvMoves.value; void bestMove.value; updateArrow() })
  const extractCpFromInfoLine = (line: string): number | null => { if (!line) return null; const m = line.match(/score\s+(cp|mate)\s+(-?\d+)/); if (!m) return null; return parseInt(m[2]) }
  const currentEvalPercent = computed(() => 50)
  const clearUserDrawings = () => { userCircles.value = []; userArrows.value = [] }; if (gs) gs.clearUserArrows = clearUserDrawings
  onMounted(() => window.addEventListener('clear-drawings', clearUserDrawings)); onUnmounted(() => window.removeEventListener('clear-drawings', clearUserDrawings))
</script>

<style scoped lang="scss">
  /* --- LAYOUT CHÍNH --- */
  .chessboard-wrapper { display: flex; flex-direction: row; justify-content: center; gap: 20px; width: 100%; max-width: 95vmin; margin: 0 auto; padding: 20px; @media (max-width: 768px) { flex-direction: column; padding: 10px; gap: 12px; } }
  .main-column { display: flex; flex-direction: column; flex: 0 0 auto; width: 80%; gap: 12px; @media (max-width: 768px) { width: 100%; } }
  .chessboard-container { position: relative; width: 100%; aspect-ratio: 9/10; margin: auto; user-select: none; overflow: visible !important; z-index: 1; }
  .bg { width: 100%; height: 100%; display: block; }
  .pieces { position: absolute; inset: 0; z-index: 20; }
  .piece { position: absolute; aspect-ratio: 1; pointer-events: none; &.animated { transition: all 0.2s ease; } &.inCheck { transform: translate(-50%, -50%) scale(1.1); filter: drop-shadow(0 0 10px red); z-index: 100; } }
  .selection-mark { position: absolute; width: 12%; aspect-ratio: 1; transform: translate(-50%, -50%); z-index: 30; pointer-events: none; }
  .corner { position: absolute; width: 25%; height: 25%; border: 3px solid #007bff; }
  .top-left { top: 0; left: 0; border-right: none; border-bottom: none; } .top-right { top: 0; right: 0; border-left: none; border-bottom: none; } .bottom-left { bottom: 0; left: 0; border-right: none; border-top: none; } .bottom-right { bottom: 0; right: 0; border-left: none; border-top: none; }
  .highlight.from { position: absolute; transform: translate(-50%,-50%); width: 2.5%; aspect-ratio: 1; background: rgba(255,0,0,0.5); border-radius: 50%; pointer-events: none; }
  .highlight.to { position: absolute; transform: translate(-50%,-50%); width: 12%; aspect-ratio: 1; border: 2px solid rgba(0,0,255,0.5); pointer-events: none; .corner { border-color: #4ecdc4; } }
  .valid-move-dot { position: absolute; transform: translate(-50%,-50%); width: 2.5%; aspect-ratio: 1; background: #4caf50; border-radius: 50%; pointer-events: none; z-index: 15; }
  .eval-bar { position: absolute; top: 0; bottom: 0; left: -12px; width: 8px; background: #ddd; border-radius: 4px; overflow: hidden; z-index: 5; }
  .eval-top { width: 100%; transition: height 0.2s; } .eval-bottom { width: 100%; transition: height 0.2s; } .eval-marker { position: absolute; left: 0; right: 0; height: 2px; background: #fff; }

  /* --- FIXED: OVERLAY & MENU --- */
  .flip-overlay-absolute { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.3); z-index: 1900; cursor: not-allowed; }
  .radial-menu-container { position: absolute; transform: translate(-50%, -50%); z-index: 9999; animation: popIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275); pointer-events: auto; width: 0; height: 0; overflow: visible; }
  @keyframes popIn { from { transform: translate(-50%, -50%) scale(0); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
  
  .radial-item { position: absolute; width: 45px; height: 45px; border-radius: 50%; background: rgba(40, 40, 40, 0.95); border: 2px solid rgba(255, 255, 255, 0.6); display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.6); transition: transform 0.1s; pointer-events: auto; margin-left: -22.5px; margin-top: -22.5px; &:hover { transform: scale(1.2); background: #222; border-color: #00d2ff; z-index: 10000; } &:active { transform: scale(0.95); background: #000; } }
  .radial-img { width: 80%; height: 80%; object-fit: contain; pointer-events: none; }
  .radial-count { position: absolute; top: -5px; right: -5px; background: #f44336; color: white; font-size: 10px; font-weight: bold; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #fff; pointer-events: none; }
  
  /* Nút Cứu Hộ khi danh sách rỗng */
  .radial-error-btn { position: absolute; transform: translate(-50%, -50%); background: #f44336; color: white; padding: 10px; border-radius: 8px; font-weight: bold; font-size: 12px; cursor: pointer; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.5); pointer-events: auto; z-index: 10001; }

  .flip-hint-area { margin-top: 10px; background: rgba(0,0,0,0.6); color: #fff; padding: 8px; border-radius: 6px; text-align: center; font-size: 14px; }
  
  /* Side Panel */
  .side-panel { display: flex; flex-direction: column; justify-content: space-between; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; min-width: 80px; flex: 1; align-self: stretch; }
  .pool-row { display: flex; align-items: center; background: rgba(255,255,255,0.1); margin-bottom: 4px; padding: 2px; border-radius: 4px; justify-content: center; }
  .pool-img { width: 30px; height: 30px; } .pool-controls { display: flex; align-items: center; margin-left: 5px; } .pool-num { color: #fff; font-weight: bold; margin-right: 5px; font-size: 1.1rem; }
  .red-num { color: #ff5252; } .black-num { color: #222; text-shadow: 0 0 2px #fff; }
  .pool-btns { display: flex; flex-direction: column; gap: 1px; }
  .tiny-btn { width: 16px; height: 16px; line-height: 12px; font-size: 10px; background: #555; color: #fff; border: none; cursor: pointer; }
  
  .ar, .user-drawings, .board-labels { position: absolute; inset: 0; pointer-events: none; }
  .annotation-layer { position: absolute; inset: 0; pointer-events: none; z-index: 50; }
  .annotation-badge { position: absolute; top: -10px; right: -10px; width: 20px; height: 20px; background: #007bff; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid #fff; }
  .board-labels { overflow: visible; .rank-labels span { position: absolute; right: -10px; color: #666; font-weight: bold; } .file-labels span { position: absolute; bottom: -17px; color: #666; font-weight: bold; } }
  .al { stroke-width: 1; stroke-opacity: 0.9; }
</style>