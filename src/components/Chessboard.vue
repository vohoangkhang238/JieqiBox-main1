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
          <div class="highlight to" :class="getAnnotationClass(lastMovePositions)" :style="{ ...rcStyle(displayRow(lastMovePositions.to.row), displayCol(lastMovePositions.to.col)), width: '10.5%' }">
            <div class="corner top-left"></div><div class="corner top-right"></div>
            <div class="corner bottom-left"></div><div class="corner bottom-right"></div>
          </div>
        </div>

        <div v-if="lastMovePositions && getCurrentMoveAnnotation()" class="annotation-layer">
          <div class="annotation-anchor" :class="getAnnotationClass(lastMovePositions)" :style="rcStyle(displayRow(lastMovePositions.to.row), displayCol(lastMovePositions.to.col))">
            <div class="annotation-badge">{{ getCurrentMoveAnnotation() }}</div>
          </div>
        </div>

        <svg class="user-drawings" viewBox="0 0 100 100" preserveAspectRatio="none">
          <circle v-for="(circle, idx) in userCircles" :key="`circle-${idx}`" :cx="circle.x" :cy="circle.y" :r="circle.radius" fill="none" stroke="#ff6b6b" stroke-width="1" opacity="0.8" />
          <defs>
            <marker id="user-arrow-marker" markerWidth="3" markerHeight="3" refX="2" refY="1.5" orient="auto">
              <polygon points="0 0, 3 1.5, 0 3" fill="#ff6b6b" />
            </marker>
          </defs>
          <line v-for="(arrow, idx) in userArrows" :key="`arrow-${idx}`" :x1="arrow.x1" :y1="arrow.y1" :x2="arrow.x2" :y2="arrow.y2" stroke="#ff6b6b" stroke-width="2" marker-end="url(#user-arrow-marker)" opacity="0.8" />
        </svg>

        <svg class="ar" viewBox="0 0 100 100" preserveAspectRatio="none" v-if="showArrows">
          <defs>
            <marker v-for="(color, idx) in arrowColors" :key="`marker-${idx}`" :id="`ah-${idx}`" markerWidth="2.5" markerHeight="2.5" refX="1.5" refY="1.25" orient="auto"><polygon points="0 0, 2.5 1.25, 0 2.5" :fill="color" /></marker>
            <marker id="ah-selected" markerWidth="2.5" markerHeight="2.5" refX="1.5" refY="1.25" orient="auto"><polygon points="0 0, 2.5 1.25, 0 2.5" fill="#e53935" /></marker>
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

        <div v-if="pendingFlip" class="flip-overlay-fixed" @click.stop></div>

        <div v-if="pendingFlip" class="radial-menu-container"
          :style="{ ...rcStyle(radialMenuPos.row, radialMenuPos.col, 9999), width: '34%', height: 'auto', 'aspect-ratio': '1/1' }">
          <div v-for="(item, index) in flipSelectionPieces" :key="item.name" class="radial-item" 
               :style="getRadialItemStyle(index, flipSelectionPieces.length)" 
               @click.stop="handleFlipSelect(item.name)" @mousedown.stop @touchstart.stop>
            <img :src="getPieceImageUrl(item.name)" class="radial-img" />
            <div class="radial-count">{{ item.count }}</div>
          </div>
          <div v-if="flipSelectionPieces.length === 0" class="radial-error-btn" @click.stop="handleFlipRandom">
              <span>Hết quân! Bỏ qua</span>
          </div>
        </div>
        <ClearHistoryConfirmDialog :visible="showClearHistoryDialog" :onConfirm="onConfirmClearHistory" :onCancel="onCancelClearHistory" />
      </div>

      <div v-if="pendingFlip" class="flip-hint-area">
        <div class="flip-hint-text">
          Vui lòng chọn quân {{ pendingFlip.side === 'red' ? 'Đỏ' : 'Đen' }} cần lật
        </div>
      </div>
    </div>

    <div class="side-panel">
      
      <div class="absolute-pool top-zone">
        <div v-for="item in (isRedOnTop ? redPool : blackPool)" :key="item.char" class="pool-row">
          <div class="pool-img-wrapper">
             <img :src="getPieceImageUrl(item.name)" class="pool-img" />
             <div v-if="item.count > 0" class="pool-num-badge" :class="item.name.startsWith('red') ? 'badge-red' : 'badge-black'">{{ item.count }}</div>
          </div>
          <div class="pool-btns">
             <button class="tiny-btn btn-red" @click="adjustUnrevealedCount(item.char, 1)" :disabled="item.count >= item.max">+</button>
             <button class="tiny-btn btn-red" @click="adjustUnrevealedCount(item.char, -1)" :disabled="item.count <= 0">-</button>
          </div>
        </div>
      </div>

      <div v-if="poolErrorMessage" class="pool-error-floating"><span>{{ poolErrorMessage }}</span></div>

      <div class="absolute-pool bottom-zone">
        <div v-for="item in (isRedOnTop ? blackPool : redPool)" :key="item.char" class="pool-row">
          <div class="pool-img-wrapper">
             <img :src="getPieceImageUrl(item.name)" class="pool-img" />
             <div v-if="item.count > 0" class="pool-num-badge" :class="item.name.startsWith('red') ? 'badge-red' : 'badge-black'">{{ item.count }}</div>
          </div>
          <div class="pool-btns">
             <button class="tiny-btn btn-red" @click="adjustUnrevealedCount(item.char, 1)" :disabled="item.count >= item.max">+</button>
             <button class="tiny-btn btn-red" @click="adjustUnrevealedCount(item.char, -1)" :disabled="item.count <= 0">-</button>
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

// --- [CẤU HÌNH] CHỈNH VỊ TRÍ & ĐỘ LỆCH (2 PHE RIÊNG BIỆT) ---
const PAD_X = 17.5; // Lề trái phải
const PAD_Y = 20.5; // Lề trên dưới

// 1. CHỈNH PHE TRÊN (BLACK - Rows 0-4)
// Vì phe trên bị lệch lên cao quá -> Cần số Dương (+) để đẩy xuống
const TOP_OFFSET_X = 0;   
const TOP_OFFSET_Y = 0.0; // <--- TĂNG SỐ NÀY ĐỂ ĐẨY QUÂN TRÊN XUỐNG (Thử 1.5, 2.0, 2.5...)

// 2. CHỈNH PHE DƯỚI (RED - Rows 5-9)
// Phe dưới đã chuẩn thì để 0
const BOTTOM_OFFSET_X = 0;   
const BOTTOM_OFFSET_Y = 0;   
// -------------------------------------------------------------

const COLS = 9, ROWS = 10;
const GX = 100 - PAD_X, GY = 100 - PAD_Y;
const OX = PAD_X / 2, OY = PAD_Y / 2;

const handleChartSeek = (idx: number) => { try { const gsAny: any = gs; if (gsAny?.replayToMove) gsAny.replayToMove(idx) } catch {} }
const { t } = useI18n()

const files = computed(() => { const baseFiles = 'abcdefghi'.split(''); return gs.isBoardFlipped.value ? baseFiles.slice().reverse() : baseFiles })
const ranks = computed(() => { const baseRanks = Array.from({ length: 10 }, (_, i) => 9 - i); return gs.isBoardFlipped.value ? baseRanks.slice().reverse() : baseRanks })
const { showCoordinates, showAnimations, showPositionChart, showEvaluationBar, showArrows } = useInterfaceSettings()
const gs: any = inject('game-state')
const es = inject('engine-state') as { pvMoves: any; bestMove: any; isThinking: any; multiPvMoves: any; stopAnalysis: any; isPondering: any; isInfinitePondering: any; ponderMove: any; ponderhit: any; analysis?: any }
const jaiEngine = inject('jai-engine-state') as any
const isMatchRunning = computed(() => jaiEngine?.isMatchRunning?.value || false)
const { pieces, selectedPieceId, handleBoardClick, isAnimating, lastMovePositions, registerArrowClearCallback, history, currentMoveIndex, unrevealedPieceCounts, adjustUnrevealedCount, getPieceNameFromChar, validationStatus, pendingFlip } = gs

const selectedPiece = computed(() => { if (!unref(selectedPieceId)) return null; return unref(pieces).find((p: Piece) => p.id === unref(selectedPieceId)) })

const lastClickPos = ref({ row: 4, col: 4 })
const radialMenuPos = computed(() => {
  if (pendingFlip.value && typeof pendingFlip.value.row === 'number' && typeof pendingFlip.value.col === 'number') {
    return { row: pendingFlip.value.row, col: pendingFlip.value.col }
  }
  if (selectedPiece.value) return { row: selectedPiece.value.row, col: selectedPiece.value.col }
  if (lastClickPos.value) return lastClickPos.value
  return { row: 4, col: 4 }
})

const flipSelectionPieces = computed(() => {
  if (!pendingFlip.value) return []
  const requiredSide = pendingFlip.value.side
  return Object.entries(unrevealedPieceCounts.value)
    .map(([char, count]) => {
      const name = getPieceNameFromChar(char)
      return { name, char, count: Number(count) }
    })
    .filter(item => {
      const pieceSide = item.name.startsWith('red') ? 'red' : 'black'
      return pieceSide === requiredSide && item.count > 0
    })
})

const getRadialItemStyle = (index: number, total: number) => {
  const radiusPercent = 30
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

const handleFlipRandom = () => {
  if (pendingFlip.value && pendingFlip.value.callback) {
    const pieces = flipSelectionPieces.value
    if (pieces.length === 0) {
      const side = pendingFlip.value.side
      pendingFlip.value.callback(side === 'red' ? 'red_pawn' : 'black_pawn')
      return
    }
    const pool: string[] = []
    pieces.forEach((p: any) => {
      for(let i=0; i < (p.count as number); i++) { pool.push(p.name) }
    })
    if (pool.length > 0) {
      const randomIndex = Math.floor(Math.random() * pool.length)
      pendingFlip.value.callback(pool[randomIndex])
    }
  }
}

const poolErrorMessage = computed(() => {
  if (!validationStatus.value) return null
  const s = validationStatus.value
  if (s.includes('正常') || s.toLowerCase().includes('normal')) return null
  let msg = s.replace(/^Error:\s*|^错误:\s*/i, '').trim()
  return `Lỗi: ${msg}`
})

const INITIAL_PIECE_COUNTS: { [k: string]: number } = { r: 2, n: 2, b: 2, a: 2, c: 2, p: 5, k: 1, R: 2, N: 2, B: 2, A: 2, C: 2, P: 5, K: 1 }
const blackPool = computed(() => { const chars = ['r', 'n', 'c', 'a', 'b', 'p']; return chars.map(char => ({ char, name: getPieceNameFromChar(char), count: unrevealedPieceCounts?.value?.[char] || 0, max: INITIAL_PIECE_COUNTS[char] })) })
const redPool = computed(() => { const chars = ['R', 'N', 'C', 'A', 'B', 'P']; return chars.map(char => ({ char, name: getPieceNameFromChar(char), count: unrevealedPieceCounts?.value?.[char] || 0, max: INITIAL_PIECE_COUNTS[char] })) })

function getPieceImageUrl(pieceName: string): string { 
  return new URL(`../assets/${pieceName}.png`, import.meta.url).href 
}

const userCircles = ref<Array<any>>([])
const userArrows = ref<Array<any>>([])
const { bestMove, isThinking, multiPvMoves, isPondering, isInfinitePondering, ponderMove, ponderhit } = es
const isCurrentPositionInCheck = gs.isCurrentPositionInCheck
const validMovesForSelectedPiece = computed(() => gs.getValidMovesForSelectedPiece.value)
const isRedOnTop = computed(() => { try { return !!gs?.isBoardFlipped?.value } catch { return false } })
const checkedKingId = computed(() => {
  if (isCurrentPositionInCheck('red')) { const king = gs.pieces.value.find((p: Piece) => p.isKnown && p.name === 'red_king'); return king ? king.id : null }
  if (isCurrentPositionInCheck('black')) { const king = gs.pieces.value.find((p: Piece) => p.isKnown && p.name === 'black_king'); return king ? king.id : null }
  return null
})

// 1. Hàm tính tọa độ quân cờ (CSS) + TỰ ĐỘNG CHỈNH LỆCH THEO PHE
const percentFromRC = (row: number, col: number) => { 
  let x = OX + (col / (COLS - 1)) * GX;
  let y = OY + (row / (ROWS - 1)) * GY;

  // Logic: Nếu hàng < 5 (Nửa trên) -> Dùng offset của phe trên
  // Nếu hàng >= 5 (Nửa dưới) -> Dùng offset của phe dưới
  // Điều này giúp khắc phục lỗi ảnh nền không đối xứng
  if (row < 5) {
     x += TOP_OFFSET_X;
     y += TOP_OFFSET_Y;
  } else {
     x += BOTTOM_OFFSET_X;
     y += BOTTOM_OFFSET_Y;
  }

  return { x, y };
}

// 2. Hàm mũi tên (SVG) - Gọi hàm trên để đồng bộ vị trí
const percentToSvgCoords = (row: number, col: number) => {
  return percentFromRC(row, col);
}

const img = (p: Piece) => new URL(`../assets/${p.isKnown ? p.name : 'dark_piece'}.png`, import.meta.url).href

// Kích thước quân cờ: 10.5%
const rcStyle = (r: number, c: number, zIndex?: number) => {
  const { x, y } = percentFromRC(r, c)
  return { top: `${y}%`, left: `${x}%`, width: '10.5%', transform: 'translate(-50%,-50%)', ...(zIndex !== undefined && { zIndex: zIndex }) }
}
const rankLabelStyle = (index: number) => ({ top: `${percentFromRC(index, 0).y}%`, transform: 'translateY(-50%)' })
const fileLabelStyle = (index: number) => ({ left: `${percentFromRC(0, index).x}%`, transform: 'translateX(-50%)' })
const displayRow = (r: number) => (gs.isBoardFlipped.value ? 9 - r : r)
const displayCol = (c: number) => (gs.isBoardFlipped.value ? 8 - c : c)

const showClearHistoryDialog = ref(false)
const pendingMove = ref<any>(null)

const boardClick = (e: MouseEvent) => {
  if (isMatchRunning.value || pendingFlip.value) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const xp = ((e.clientX - rect.left) / rect.width) * 100
  const yp = ((e.clientY - rect.top) / rect.height) * 100
  const col = Math.round(((xp - OX) / GX) * (COLS - 1))
  const row = Math.round(((yp - OY) / GY) * (ROWS - 1))
  const finalRow = Math.max(0, Math.min(ROWS - 1, row))
  const finalCol = Math.max(0, Math.min(COLS - 1, col))
  lastClickPos.value = { row: finalRow, col: finalCol }
  const result = handleBoardClick(finalRow, finalCol)
  if (result && result.requireClearHistoryConfirm) { pendingMove.value = result.move; showClearHistoryDialog.value = true }
}

const clearUserDrawings = () => { userCircles.value = []; userArrows.value = [] }
if (gs) gs.clearUserArrows = clearUserDrawings

const handleForceStopAi = (e: CustomEvent) => { if (e.detail?.reason === 'new-game') clearUserDrawings() }
const handleClearDrawingsEvent = () => clearUserDrawings()

onMounted(() => {
  window.addEventListener('force-stop-ai', handleForceStopAi as EventListener)
  window.addEventListener('clear-drawings', handleClearDrawingsEvent)
})
onUnmounted(() => {
  window.removeEventListener('force-stop-ai', handleForceStopAi as EventListener)
  window.removeEventListener('clear-drawings', handleClearDrawingsEvent)
})

const onConfirmClearHistory = () => { if (pendingMove.value) gs.clearHistoryAndMove(pendingMove.value.piece, pendingMove.value.row, pendingMove.value.col); showClearHistoryDialog.value = false; pendingMove.value = null }
const onCancelClearHistory = () => { showClearHistoryDialog.value = false; pendingMove.value = null }

interface Arrow { x1: number; y1: number; x2: number; y2: number; pv: number }
const arrs = ref<Arrow[]>([]); const selectedPvMove = ref<string | null>(null)
const uciToDisplayRC = (uci: string) => {
  const fromCol = uci.charCodeAt(0) - 'a'.charCodeAt(0), fromRow = 9 - +uci[1], toCol = uci.charCodeAt(2) - 'a'.charCodeAt(0), toRow = 9 - +uci[3]
  return !gs.isBoardFlipped.value ? { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } } : { from: { row: 9-fromRow, col: 8-fromCol }, to: { row: 9-toRow, col: 8-toCol } }
}
const updateArrow = () => {
  if (isThinking.value && multiPvMoves.value.length) {
    arrs.value = multiPvMoves.value.map((m: any, i: number) => {
      const c = uciToDisplayRC(m[0]); const f = percentToSvgCoords(c.from.row, c.from.col), t = percentToSvgCoords(c.to.row, c.to.col)
      return { x1: f.x, y1: f.y, x2: t.x, y2: t.y, pv: i + 1 }
    })
  } else if (bestMove.value) {
    const c = uciToDisplayRC(bestMove.value); const f = percentToSvgCoords(c.from.row, c.from.col), t = percentToSvgCoords(c.to.row, c.to.col)
    arrs.value = [{ x1: f.x, y1: f.y, x2: t.x, y2: t.y, pv: 1 }]
  } else arrs.value = []
}
watchEffect(() => { void isThinking.value; void multiPvMoves.value; void bestMove.value; updateArrow() })
const arrowColors = ['#0066cc', '#e53935', '#43a047']; const arrowColor = (idx: number) => arrowColors[idx % 3]
const selectedPvArrow = computed(() => null)
const getAnnotationClass = () => ''
const getCurrentMoveAnnotation = () => null
const currentEvalPercent = computed(() => 50)
</script>

<style scoped lang="scss">
/* --- LAYOUT --- */
.chessboard-wrapper {
  width: 100%;
  height: 100%;
  max-width: 98vmin;
  max-height: 98vmin;
  margin: 0 auto;
  aspect-ratio: 1.2 / 1; 
  display: flex;
  flex-direction: row;
  align-items: stretch;
  gap: 0.5vmin; 
  padding: 0.8vmin;
}

.main-column {
  flex: 1; 
  display: flex;
  flex-direction: column;
  position: relative;
}

.chessboard-container {
  width: 100%;
  aspect-ratio: 9/10;
  position: relative;
  user-select: none;
  z-index: 1;
}

.side-panel {
  flex: 0 0 16%; 
  min-width: 0;
  height: 100%; 
  position: relative; 
  background: transparent; 
  border: none;
  padding: 0;
  overflow: visible;
}

.absolute-pool {
  position: absolute; 
  left: 0;
  width: 100%; 
  display: flex;
  flex-direction: column;
}

/* --- KHỐI TRÊN (QUÂN ĐEN) --- */
.top-zone {
  top: 5%; 
  bottom: 47%; 
  justify-content: space-between;
  gap: 0;
}

/* --- KHỐI DƯỚI (QUÂN ĐỎ) --- */
.bottom-zone {
  top: 61%; 
  bottom: -12%; 
  justify-content: space-between; 
  gap: 0; 
}

/* --- DÒNG QUÂN --- */
.pool-row {
  display: flex;
  align-items: center; 
  gap: 1.3vmin; 
  justify-content: center; 
  background: transparent;
  padding: 0;
  width: 100%;
  height: 5vmin; 
  min-height: 0;
}

/* --- ẢNH & BADGE --- */
.pool-img-wrapper {
  width: 45%; 
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center; 
  position: relative; 
  overflow: visible; 
}

/* BADGE CƠ BẢN */
.pool-num-badge {
  position: absolute;
  top: -0.2vmin;
  right: -0.2vmin;
  width: 1.8vmin;
  height: 1.8vmin;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1vmin;
  font-weight: bold;
  line-height: 1;
  border: 0.15vmin solid #fff;
  box-shadow: 0 0.2vmin 0.4vmin rgba(0,0,0,0.3);
  z-index: 10;
}

/* BADGE ĐỎ */
.badge-red {
  background-color: #f44336; 
  color: white;
}

/* BADGE ĐEN */
.badge-black {
  background-color: #000000; 
  color: white;
  border-color: #666;
}

.top-zone .pool-row:first-child .pool-img-wrapper { align-items: flex-start; }
.bottom-zone .pool-row:last-child .pool-img-wrapper { align-items: flex-end; transform: none; }

.pool-img { height: auto; width: auto; max-height: 100%; max-width: 100%; object-fit: contain; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5)); }

/* --- NÚT BẤM (CONTAINER) --- */
.pool-btns {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.5vmin; 
  background: transparent; 
  height: 40%; 
  width: 20%; 
  margin-right: 0;
}

/* --- STYLE NÚT BẤM --- */
.tiny-btn {
  flex: 1;
  width: 100%;
  border: none;
  border-radius: 0.5vmin; 
  font-size: 2.2vmin; 
  font-weight: 900;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  line-height: 0.8;
  text-shadow: none;

  &:hover:not(:disabled) { transform: scale(1.1); box-shadow: 0 0.3vmin 0.8vmin rgba(0,0,0,0.3); }
  &:active:not(:disabled) { transform: scale(0.95); }
  &:disabled { opacity: 0.5; cursor: default; }
}

/* NÚT ĐỎ (Dùng chung cho cả 2 phe) */
.tiny-btn.btn-red {
  background-color: #ffffff !important;
  color: #e53935 !important;
  box-shadow: 0 0.2vmin 0.5vmin rgba(0,0,0,0.2); 
}

/* --- CÁC PHẦN KHÁC --- */
.pool-error-floating { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 1.5vmin; color: #ffeb3b; background: rgba(0,0,0,0.8); padding: 0.5vmin 1vmin; border-radius: 0.5vmin; white-space: nowrap; pointer-events: none; z-index: 10; }
.bg { width: 100%; height: 100%; display: block; }
.pieces { position: absolute; inset: 0; z-index: 20; }
.piece { position: absolute; aspect-ratio: 1; pointer-events: none; &.animated { transition: all 0.2s ease; } &.inCheck { transform: translate(-50%, -50%) scale(1.1); filter: drop-shadow(0 0 10px red); z-index: 100; } &.being-flipped { opacity: 0.3; filter: grayscale(1); } }
.flip-overlay-fixed { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.3); z-index: 9000; cursor: not-allowed; }
.selection-mark { position: absolute; width: 12%; aspect-ratio: 1; transform: translate(-50%, -50%); z-index: 30; pointer-events: none; }
.corner { position: absolute; width: 25%; height: 25%; border: 3px solid #007bff; box-shadow: 0 0 4px rgba(0, 123, 255, 0.6); }
.top-left { top: 0; left: 0; border-right: none; border-bottom: none; border-top-left-radius: 10px; }
.top-right { top: 0; right: 0; border-left: none; border-bottom: none; border-top-right-radius: 10px; }
.bottom-left { bottom: 0; left: 0; border-right: none; border-top: none; border-bottom-left-radius: 10px; }
.bottom-right { bottom: 0; right: 0; border-left: none; border-top: none; border-bottom-right-radius: 10px; }
.highlight.from { position: absolute; transform: translate(-50%,-50%); width: 2.5%; aspect-ratio: 1; background: rgba(255,0,0,0.5); border-radius: 50%; pointer-events: none; }
.highlight.to { position: absolute; transform: translate(-50%,-50%); width: 12%; aspect-ratio: 1; border: 2px solid rgba(0,255,255,0.7); pointer-events: none; border-radius: 8px; }
.valid-move-dot { position: absolute; transform: translate(-50%,-50%); width: 2.5%; aspect-ratio: 1; background: #4caf50; border-radius: 50%; pointer-events: none; z-index: 15; box-shadow: 0 0 5px #4caf50; }
.eval-bar { position: absolute; top: 0; bottom: 0; left: -1.5vmin; width: 1vmin; background: #ddd; border-radius: 0.5vmin; overflow: hidden; z-index: 5; border: 1px solid #999; }
.eval-top { width: 100%; transition: height 0.5s ease-in-out; }
.eval-bottom { width: 100%; transition: height 0.5s ease-in-out; }
.eval-marker { position: absolute; left: 0; right: 0; height: 2px; background: #fff; box-shadow: 0 0 2px #000; }
.flip-hint-area { margin-top: 10px; background: rgba(0,0,0,0.7); color: #fff; padding: 8px; border-radius: 6px; text-align: center; font-size: 14px; backdrop-filter: blur(4px); }
.ar, .user-drawings, .board-labels { position: absolute; inset: 0; pointer-events: none; }
.annotation-layer { position: absolute; inset: 0; pointer-events: none; z-index: 50; }
.annotation-badge { position: absolute; top: -1vmin; right: -1vmin; width: 2.5vmin; height: 2.5vmin; background: #007bff; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2vmin; border: 0.2vmin solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
.board-labels { overflow: visible; .rank-labels span { position: absolute; right: -1.5vmin; color: #888; font-weight: bold; font-size: 1.5vmin; } .file-labels span { position: absolute; bottom: -2vmin; color: #888; font-weight: bold; font-size: 1.5vmin; } }
.al { stroke-width: 1.5; stroke-opacity: 0.8; }

/* --- MENU LẬT QUÂN --- */
.radial-menu-container {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 9999;
  animation: popIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  pointer-events: auto;
  width: 0;
  height: 0;
  overflow: visible;
}

@keyframes popIn {
  from { transform: translate(-50%, -50%) scale(0); opacity: 0; }
  to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
}

.radial-item {
  position: absolute;
  width: 4.5vmin; 
  height: 4.5vmin;
  margin-left: -2.25vmin; 
  margin-top: -2.25vmin;
  border-radius: 50%;
  background: rgba(30, 30, 30, 0.95);
  border: 0.2vmin solid rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 0.5vmin 1.5vmin rgba(0,0,0,0.6);
  transition: all 0.1s;
  pointer-events: auto;

  &:hover {
    transform: scale(1.2);
    background: #222;
    border-color: #00d2ff;
    z-index: 10000;
  }
  
  &:active {
    transform: scale(0.95);
    background: #000;
  }
}

.radial-img {
  width: 85%;
  height: 85%;
  object-fit: contain;
  pointer-events: none;
}

.radial-count {
  position: absolute;
  top: -0.5vmin;
  right: -0.5vmin;
  background: #f44336;
  color: white;
  font-size: 1vmin; 
  width: 1.8vmin;
  height: 1.8vmin;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0.15vmin solid #fff;
  pointer-events: none;
  font-weight: bold;
}

.radial-error-btn {
  position: absolute;
  transform: translate(-50%, -50%);
  background: #f44336;
  color: white;
  padding: 1vmin 2vmin; 
  border-radius: 0.8vmin;
  font-weight: bold;
  font-size: 1.8vmin; 
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 0.5vmin 1.5vmin rgba(0,0,0,0.5);
  pointer-events: auto;
  z-index: 10001;
}
</style>