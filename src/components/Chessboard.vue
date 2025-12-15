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
          <div class="corner top-left"></div>
          <div class="corner top-right"></div>
          <div class="corner bottom-left"></div>
          <div class="corner bottom-right"></div>
        </div>

        <div class="last-move-highlights" v-if="lastMovePositions">
          <div class="highlight from" :class="getAnnotationClass(lastMovePositions)" :style="{ ...rcStyle(displayRow(lastMovePositions.from.row), displayCol(lastMovePositions.from.col)), width: '2.5%' }"></div>
          <div class="highlight to" :class="getAnnotationClass(lastMovePositions)" :style="{ ...rcStyle(displayRow(lastMovePositions.to.row), displayCol(lastMovePositions.to.col)), width: '12%' }">
            <div class="corner top-left"></div>
            <div class="corner top-right"></div>
            <div class="corner bottom-left"></div>
            <div class="corner bottom-right"></div>
          </div>
        </div>

        <div v-if="lastMovePositions && getCurrentMoveAnnotation()" class="annotation-layer">
          <div class="annotation-anchor" :class="getAnnotationClass(lastMovePositions)" :style="rcStyle(displayRow(lastMovePositions.to.row), displayCol(lastMovePositions.to.col))">
            <div class="annotation-badge">{{ getCurrentMoveAnnotation() }}</div>
          </div>
        </div>

        <svg class="user-drawings" viewBox="0 0 90 100" preserveAspectRatio="none">
          <circle v-for="(circle, idx) in userCircles" :key="`circle-${idx}`" :cx="circle.x" :cy="circle.y" :r="circle.radius" fill="none" stroke="#ff6b6b" stroke-width="1" opacity="0.8" />
          <line v-for="(arrow, idx) in userArrows" :key="`arrow-${idx}`" :x1="arrow.x1" :y1="arrow.y1" :x2="arrow.x2" :y2="arrow.y2" stroke="#ff6b6b" stroke-width="2" marker-end="url(#user-arrow-marker)" opacity="0.8" />
          <defs>
            <marker id="user-arrow-marker" markerWidth="3" markerHeight="3" refX="2" refY="1.5" orient="auto">
              <polygon points="0 0, 3 1.5, 0 3" fill="#ff6b6b" />
            </marker>
          </defs>
        </svg>

        <svg class="ar" viewBox="0 0 90 100" preserveAspectRatio="none" v-if="showArrows">
           <defs>
            <marker v-for="(color, idx) in arrowColors" :key="`marker-${idx}`" :id="`ah-${idx}`" markerWidth="2.5" markerHeight="2.5" refX="1.5" refY="1.25" orient="auto"><polygon points="0 0, 2.5 1.25, 0 2.5" :fill="color" /></marker>
            <marker id="ah-selected" markerWidth="2.5" markerHeight="2.5" refX="1.5" refY="1.25" orient="auto"><polygon points="0 0, 2.5 1.25, 0 2.5" fill="#e53935" /></marker>
          </defs>
          <template v-for="(a, idx) in arrs" :key="`arrow-${idx}`">
            <line :x1="a.x1" :y1="a.y1" :x2="a.x2" :y2="a.y2" :style="{ stroke: arrowColor(idx) }" :marker-end="`url(#ah-${idx % arrowColors.length})`" class="al" />
            <text v-if="arrs.length > 1" :x="(a.x1 + a.x2) / 2" :y="(a.y1 + a.y2) / 2" :fill="arrowColor(idx)" class="arrow-label">{{ a.pv }}</text>
          </template>
          <template v-if="selectedPvArrow">
            <line :x1="selectedPvArrow.x1" :y1="selectedPvArrow.y1" :x2="selectedPvArrow.x2" :y2="selectedPvArrow.y2" marker-end="url(#ah-selected)" class="al selected-arrow-shadow" />
            <line :x1="selectedPvArrow.x1" :y1="selectedPvArrow.y1" :x2="selectedPvArrow.x2" :y2="selectedPvArrow.y2" marker-end="url(#ah-selected)" class="al selected-arrow" />
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

  const { t } = useI18n()
  const { showCoordinates, showAnimations, showPositionChart, showEvaluationBar, showArrows } = useInterfaceSettings()
  
  // Inject Game State
  const gs: any = inject('game-state')
  const es = inject('engine-state') as { pvMoves: any; bestMove: any; isThinking: any; multiPvMoves: any; stopAnalysis: any; isPondering: any; isInfinitePondering: any; ponderMove: any; ponderhit: any; analysis?: any }
  const jaiEngine = inject('jai-engine-state') as any
  
  // Unwrap refs safely
  const { pieces, selectedPieceId, handleBoardClick, isAnimating, lastMovePositions, registerArrowClearCallback, history, currentMoveIndex, unrevealedPieceCounts, adjustUnrevealedCount, getPieceNameFromChar, validationStatus, pendingFlip } = gs
  
  const isMatchRunning = computed(() => jaiEngine?.isMatchRunning?.value || false)
  const selectedPiece = computed(() => { 
    if (!unref(selectedPieceId)) return null
    return unref(pieces).find((p: Piece) => p.id === unref(selectedPieceId)) 
  })

  // === CẤU HÌNH BÀN CỜ ===
  const PAD_X = 11, PAD_Y = 11, COLS = 9, ROWS = 10, GX = 100 - PAD_X, GY = 100 - PAD_Y, OX = PAD_X / 2, OY = PAD_Y / 2
  const files = computed(() => { const base = 'abcdefghi'.split(''); return gs.isBoardFlipped.value ? base.slice().reverse() : base })
  const ranks = computed(() => { const base = Array.from({ length: 10 }, (_, i) => 9 - i); return gs.isBoardFlipped.value ? base.slice().reverse() : base })
  
  // === LOGIC MENU VÒNG TRÒN (RADIAL MENU) ===
  const flipSelectionPieces = computed(() => {
    if (!pendingFlip.value) return []
    const requiredSide = pendingFlip.value.side
    // Lấy danh sách quân chưa lật từ kho
    const counts = unrevealedPieceCounts.value || {}
    return Object.entries(counts)
      .map(([char, count]) => ({ name: getPieceNameFromChar(char), char, count: Number(count) }))
      .filter(item => {
        const pieceSide = item.name.startsWith('red') ? 'red' : 'black'
        return pieceSide === requiredSide && item.count > 0
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

  const handleFlipSelect = (pieceName: string) => {
    if (pendingFlip.value && pendingFlip.value.callback) {
      pendingFlip.value.callback(pieceName)
    }
  }
  // ==========================================

  // Helper hiển thị ảnh
  function getPieceImageUrl(pieceName: string): string { 
    return new URL(`../assets/${pieceName}.png`, import.meta.url).href 
  }
  const img = (p: Piece) => new URL(`../assets/${p.isKnown ? p.name : 'dark_piece'}.png`, import.meta.url).href

  // Helper tính tọa độ CSS
  const percentFromRC = (row: number, col: number) => ({ x: OX + (col / (COLS - 1)) * GX, y: OY + (row / (ROWS - 1)) * GY })
  const percentToSvgCoords = (row: number, col: number) => ({ x: (OX + (col / (COLS - 1)) * GX) * 0.9, y: OY + (row / (ROWS - 1)) * GY })
  
  const rcStyle = (r: number, c: number, zIndex?: number) => {
    const { x, y } = percentFromRC(r, c)
    return { top: `${y}%`, left: `${x}%`, width: '12%', transform: 'translate(-50%,-50%)', ...(zIndex !== undefined && { zIndex: zIndex }) }
  }
  
  // Kho quân (Pool)
  const poolErrorMessage = computed(() => {
    if (!validationStatus?.value) return null
    let msg = validationStatus.value.replace(/^Error:\s*|^错误:\s*/i, '').trim()
    const matchMismatch = msg.match(/(红方|黑方)(\d+)暗子\s*>\s*(\d+)池/)
    if (matchMismatch) { 
        const side = matchMismatch[1] === '红方' ? 'Đỏ' : 'Đen'; 
        const count = matchMismatch[2]; const pool = matchMismatch[3]; 
        return `Lỗi: ${side} dư quân (${count} > ${pool} trong kho)` 
    }
    msg = msg.replace(/红方/g, 'Bên Đỏ ').replace(/黑方/g, 'Bên Đen ').replace(/暗子/g, ' quân úp').replace(/池/g, ' trong kho').replace(/Piece Count Exceeded/i, 'Quá số lượng cho phép').replace(/Total/i, 'Tổng').replace(/\s*>\s*/g, ' > ')
    return `Lỗi: ${msg}`
  })
  
  const INITIAL_COUNTS: { [k: string]: number } = { r: 2, n: 2, b: 2, a: 2, c: 2, p: 5, k: 1, R: 2, N: 2, B: 2, A: 2, C: 2, P: 5, K: 1 }
  const blackPool = computed(() => ['r', 'n', 'c', 'a', 'b', 'p'].map(c => ({ char: c, name: getPieceNameFromChar(c), count: unrevealedPieceCounts?.value?.[c] || 0, max: INITIAL_COUNTS[c] })))
  const redPool = computed(() => ['R', 'N', 'C', 'A', 'B', 'P'].map(c => ({ char: c, name: getPieceNameFromChar(c), count: unrevealedPieceCounts?.value?.[c] || 0, max: INITIAL_COUNTS[c] })))
  const isRedOnTop = computed(() => !!gs?.isBoardFlipped?.value)

  // Logic Click Bàn cờ
  const showClearHistoryDialog = ref(false)
  const pendingMove = ref<{ piece: Piece; row: number; col: number } | null>(null)
  
  const boardClick = (e: MouseEvent) => {
    if (isMatchRunning.value) return
    if (pendingFlip.value) return // Chặn click khi đang lật quân

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const col = Math.round((((e.clientX - rect.left) / rect.width * 100 - OX) / GX) * (COLS - 1))
    const row = Math.round((((e.clientY - rect.top) / rect.height * 100 - OY) / GY) * (ROWS - 1))
    const result = handleBoardClick(Math.max(0, Math.min(ROWS - 1, row)), Math.max(0, Math.min(COLS - 1, col)))
    if (result && result.requireClearHistoryConfirm) { 
      pendingMove.value = result.move
      showClearHistoryDialog.value = true 
    }
  }

  const onConfirmClearHistory = () => { if (pendingMove.value) gs.clearHistoryAndMove(pendingMove.value.piece, pendingMove.value.row, pendingMove.value.col); showClearHistoryDialog.value = false; pendingMove.value = null }
  const onCancelClearHistory = () => { showClearHistoryDialog.value = false; pendingMove.value = null }

  // Các computed phụ trợ
  const userCircles = ref<any[]>([]); const userArrows = ref<any[]>([]); const arrs = ref<any[]>([])
  const arrowColors = ['#0066cc', '#e53935', '#43a047', '#ffb300', '#8e24aa', '#00897b']; const arrowColor = (i: number) => arrowColors[i % arrowColors.length]
  const isCurrentPositionInCheck = gs.isCurrentPositionInCheck
  const checkedKingId = computed(() => {
    if (isCurrentPositionInCheck('red')) return gs.pieces.value.find((p: Piece) => p.name === 'red_king')?.id
    if (isCurrentPositionInCheck('black')) return gs.pieces.value.find((p: Piece) => p.name === 'black_king')?.id
    return null
  })
  
  const rankLabelStyle = (i: number) => ({ top: `${percentFromRC(i, 0).y}%`, transform: 'translateY(-50%)' })
  const fileLabelStyle = (i: number) => ({ left: `${percentFromRC(0, i).x}%`, transform: 'translateX(-50%)' })
  const displayRow = (r: number) => (gs.isBoardFlipped.value ? 9 - r : r)
  const displayCol = (c: number) => (gs.isBoardFlipped.value ? 8 - c : c)
  const validMovesForSelectedPiece = computed(() => gs.getValidMovesForSelectedPiece.value)
  const handleChartSeek = (idx: number) => { try { gs.replayToMove && gs.replayToMove(idx) } catch {} }
  
  const getAnnotationClass = (_positions: any) => { 
    const currentAnnotation = getCurrentMoveAnnotation(); if (!currentAnnotation) return ''
    switch (currentAnnotation) { case '!!': return 'annot-brilliant'; case '!': return 'annot-good'; case '!?': return 'annot-interesting'; case '?!': return 'annot-dubious'; case '?': return 'annot-mistake'; case '??': return 'annot-blunder'; default: return '' } 
  }
  const getCurrentMoveAnnotation = () => { try { if (gs?.pendingFlip?.value) return null } catch {} if (currentMoveIndex.value <= 0 || currentMoveIndex.value > history.value.length) return null; const moveEntry = history.value[currentMoveIndex.value - 1]; return moveEntry?.annotation || null }
  
  // Logic mũi tên & Engine
  const { bestMove, isThinking, multiPvMoves, isPondering, isInfinitePondering, ponderMove, ponderhit } = es
  const selectedPvMove = ref<string | null>(null)
  const selectedPvArrow = computed(() => {
    if (!selectedPvMove.value) return null
    const uci = selectedPvMove.value
    if (uci.length < 4) return null
    const fromCol = uci.charCodeAt(0) - 'a'.charCodeAt(0), fromRow = 9 - +uci[1], toCol = uci.charCodeAt(2) - 'a'.charCodeAt(0), toRow = 9 - +uci[3]
    const r1 = gs.isBoardFlipped.value ? 9 - fromRow : fromRow; const c1 = gs.isBoardFlipped.value ? 8 - fromCol : fromCol
    const r2 = gs.isBoardFlipped.value ? 9 - toRow : toRow; const c2 = gs.isBoardFlipped.value ? 8 - toCol : toCol
    const f = percentToSvgCoords(r1, c1); const t = percentToSvgCoords(r2, c2)
    return { x1: f.x, y1: f.y, x2: t.x, y2: t.y }
  })

  const uciToDisplayRC = (uci: string) => {
    if (uci.length < 4) return { from: { row: 0, col: 0 }, to: { row: 0, col: 0 } }
    const fromCol = uci.charCodeAt(0) - 'a'.charCodeAt(0), fromRow = 9 - +uci[1], toCol = uci.charCodeAt(2) - 'a'.charCodeAt(0), toRow = 9 - +uci[3]
    if (!gs.isBoardFlipped.value) return { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } }
    else return { from: { row: 9 - fromRow, col: 8 - fromCol }, to: { row: 9 - toRow, col: 8 - toCol } }
  }

  const updateArrow = () => {
    const isHumanVsAiMode = (window as any).__HUMAN_VS_AI_MODE__ || false; if (isHumanVsAiMode) { arrs.value = []; return }
    if ((isThinking.value || (isPondering.value && isInfinitePondering.value)) && multiPvMoves.value.length) {
      const arrows: any[] = []
      multiPvMoves.value.forEach((moves: string[], idx: number) => { if (!moves || !moves.length) return; const mv = moves[0]; if (mv && mv.length >= 4) { const coords = uciToDisplayRC(mv); const f = percentToSvgCoords(coords.from.row, coords.from.col), t = percentToSvgCoords(coords.to.row, coords.to.col); arrows.push({ x1: f.x, y1: f.y, x2: t.x, y2: t.y, pv: idx + 1 }) } })
      arrs.value = arrows; return
    }
    if (!isThinking.value && !isPondering.value && bestMove.value) {
      const mv = bestMove.value; if (mv.length >= 4) { const coords = uciToDisplayRC(mv); const f = percentToSvgCoords(coords.from.row, coords.from.col), t = percentToSvgCoords(coords.to.row, coords.to.col); arrs.value = [{ x1: f.x, y1: f.y, x2: t.x, y2: t.y, pv: 1 }]; return }
    }
    arrs.value = []
  }
  
  watchEffect(() => { void isThinking.value; void isPondering.value; void isInfinitePondering.value; void ponderMove.value; void ponderhit.value; void multiPvMoves.value; updateArrow() })
  watch(() => gs.isBoardFlipped.value, updateArrow)
  registerArrowClearCallback(() => { arrs.value = []; selectedPvMove.value = null })

  // Eval calculation
  const extractCpFromInfoLine = (line: string): number | null => {
    if (!line) return null; const m = line.match(/score\s+(cp|mate)\s+(-?\d+)/); if (!m) return null; const type = m[1], val = parseInt(m[2]); if (Number.isNaN(val)) return null
    if (type === 'mate') { const ply = Math.abs(val), sign = val >= 0 ? 1 : -1; return sign * (MATE_SCORE_BASE - ply) } return val
  }
  const lastAnalysisInfo = ref<string>(''); const lastEvalCp = ref<number | null>(null); const lastAnalysisSideToMove = ref<string | null>(null)
  const currentEvalCp = computed<number | null>(() => {
    const analysis: string | undefined = (es as any)?.analysis?.value
    if (analysis) {
      if (analysis !== lastAnalysisInfo.value) {
        lastAnalysisInfo.value = analysis; const lines = analysis.split('\n').map((l: string) => l.trim()).filter(Boolean)
        for (let i = lines.length - 1; i >= 0; i--) {
          const cp = extractCpFromInfoLine(lines[i])
          if (cp !== null) { let val = cp; if (isPondering.value && !isInfinitePondering.value) val = -val; try { lastAnalysisSideToMove.value = gs?.sideToMove?.value || null } catch {} if (lastAnalysisSideToMove.value === 'black') val = -val; lastEvalCp.value = val; return val }
        }
      } else return lastEvalCp.value
    }
    return null
  })
  const currentEvalPercent = computed<number | null>(() => { let cp = currentEvalCp.value; if (cp === null || cp === undefined) return null; const m = Math.tanh(cp / 600), redPct = Math.max(0, Math.min(100, Math.round((m + 1) * 50))); return isRedOnTop.value ? redPct : 100 - redPct })

  // Clear Drawings
  const clearUserDrawings = () => { userCircles.value = []; userArrows.value = [] }
  if (gs) gs.clearUserArrows = clearUserDrawings
  const flipUserDrawings = () => { userCircles.value = userCircles.value.map(c => { const { x, y } = percentToSvgCoords(9-c.row, 8-c.col); return { ...c, row: 9-c.row, col: 8-c.col, x, y } }); userArrows.value = userArrows.value.map(a => { const ffr = 9-a.fromRow, ffc = 8-a.fromCol, ftr = 9-a.toRow, ftc = 8-a.toCol; const { x: x1, y: y1 } = percentToSvgCoords(ffr, ffc); const { x: x2, y: y2 } = percentToSvgCoords(ftr, ftc); return { ...a, fromRow: ffr, fromCol: ffc, toRow: ftr, toCol: ftc, x1, y1, x2, y2 } }) }
  onMounted(() => { window.addEventListener('clear-drawings', clearUserDrawings) })
  onUnmounted(() => { window.removeEventListener('clear-drawings', clearUserDrawings) })
  try { gs?.registerUserDrawingsFlipFunction?.(flipUserDrawings) } catch {}
</script>

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
  .eval-bar { position: absolute; top: 0; bottom: 0; left: -12px; width: 8px; background: #ddd; border-radius: 4px; overflow: hidden; z-index: 5; }
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

  .radial-img { width: 80%; height: 80%; object-fit: contain; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5)); }
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
  .side-panel { display: flex; flex-direction: column; justify-content: space-between; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; min-width: 80px; flex: 1; align-self: stretch; }
  .pool-row { display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.1); margin-bottom: 4px; padding: 4px; border-radius: 4px; }
  .pool-img { width: 32px; height: 32px; object-fit: contain; }
  .pool-controls { display: flex; align-items: center; margin-left: 5px; }
  .pool-num { color: #fff; font-weight: bold; margin-right: 5px; font-size: 1.1rem; }
  .red-num { color: #ff5252; } .black-num { color: #222; text-shadow: 0 0 2px #fff; }
  .pool-btns { display: flex; flex-direction: column; gap: 1px; }
  .tiny-btn { width: 14px; height: 12px; line-height: 10px; font-size: 10px; background: #555; color: #fff; border: none; cursor: pointer; border-radius: 2px; display: flex; align-items: center; justify-content: center; }
  
  /* Các lớp khác (Drawing, Arrow) */
  .ar, .user-drawings, .board-labels { position: absolute; inset: 0; pointer-events: none; }
  .annotation-layer { position: absolute; inset: 0; pointer-events: none; z-index: 50; }
  .annotation-badge { position: absolute; top: -10px; right: -10px; width: 20px; height: 20px; background: #007bff; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid #fff; }
  .board-labels { overflow: visible; .rank-labels span { position: absolute; right: -10px; color: #666; font-weight: bold; } .file-labels span { position: absolute; bottom: -17px; color: #666; font-weight: bold; } }
  .al { stroke-width: 1; stroke-opacity: 0.9; }
</style>