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
                 // Hiệu ứng mờ quân cờ khi đang hiện menu vòng tròn bên trên
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

        <div v-if="lastMovePositions && getCurrentMoveAnnotation()" class="annotation-layer">
          <div class="annotation-anchor" :class="getAnnotationClass(lastMovePositions)" :style="rcStyle(displayRow(lastMovePositions.to.row), displayCol(lastMovePositions.to.col))">
            <div class="annotation-badge">{{ getCurrentMoveAnnotation() }}</div>
          </div>
        </div>

        <svg class="user-drawings" viewBox="0 0 90 100" preserveAspectRatio="none">
          <circle v-for="(circle, idx) in userCircles" :key="`circle-${idx}`" :cx="circle.x" :cy="circle.y" :r="circle.radius" fill="none" stroke="#ff6b6b" stroke-width="1" opacity="0.8" />
          <defs>
            <marker id="user-arrow-marker" markerWidth="3" markerHeight="3" refX="2" refY="1.5" orient="auto">
              <polygon points="0 0, 3 1.5, 0 3" fill="#ff6b6b" />
            </marker>
          </defs>
          <line v-for="(arrow, idx) in userArrows" :key="`arrow-${idx}`" :x1="arrow.x1" :y1="arrow.y1" :x2="arrow.x2" :y2="arrow.y2" stroke="#ff6b6b" stroke-width="2" marker-end="url(#user-arrow-marker)" opacity="0.8" />
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

        <div v-if="pendingFlip" class="flip-overlay-fixed" @click.stop></div>

        <div 
          v-if="pendingFlip" 
          class="radial-menu-container"
          :style="{
            ...rcStyle(
               radialMenuPos.row, 
               radialMenuPos.col, 
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

  // --- LOGIC: FLIP SELECTION & RADIAL MENU ---
  
  // FIX: Lưu tọa độ click cuối cùng để menu không bị nhảy về (4,4)
  const lastClickPos = ref({ row: 4, col: 4 })
  
  const radialMenuPos = computed(() => {
    // Ưu tiên dùng tọa độ click chuột gần nhất
    if (lastClickPos.value) return lastClickPos.value
    // Nếu không thì dùng vị trí quân đang chọn
    if (selectedPiece.value) return { row: selectedPiece.value.row, col: selectedPiece.value.col }
    // Fallback
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
  // -------------------------

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

  const percentFromRC = (row: number, col: number) => ({ x: OX + (col / (COLS - 1)) * GX, y: OY + (row / (ROWS - 1)) * GY })
  const percentToSvgCoords = (row: number, col: number) => ({ x: (OX + (col / (COLS - 1)) * GX) * 0.9, y: OY + (row / (ROWS - 1)) * GY })
  const img = (p: Piece) => new URL(`../assets/${p.isKnown ? p.name : 'dark_piece'}.png`, import.meta.url).href
  const rcStyle = (r: number, c: number, zIndex?: number) => {
    const { x, y } = percentFromRC(r, c)
    return { top: `${y}%`, left: `${x}%`, width: '12%', transform: 'translate(-50%,-50%)', ...(zIndex !== undefined && { zIndex: zIndex }) }
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
    
    // Calculate final coordinates
    const finalRow = Math.max(0, Math.min(ROWS - 1, row))
    const finalCol = Math.max(0, Math.min(COLS - 1, col))
    
    // FIX: Cập nhật vị trí click ngay lập tức
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
  /* --- LAYOUT CHÍNH --- */
  .chessboard-wrapper {
    display: flex;
    flex-direction: row;
    /* Căn giữa và giới hạn chiều cao tối đa là 95% màn hình */
    align-items: center; 
    justify-content: center;
    width: 100%;
    height: 95vh; /* Bắt buộc chiều cao wrapper theo màn hình */
    max-height: 95vh;
    gap: 1vh; /* Khoảng cách cũng tính theo chiều cao màn hình */
    margin: 0 auto;
    padding: 10px;
    box-sizing: border-box;
    
    @media (max-width: 768px) {
      flex-direction: column;
      height: auto;
      max-height: none;
    }
  }

  .main-column {
    display: flex;
    flex-direction: column;
    height: 100%; /* Ăn theo wrapper */
    justify-content: center;
    /* Quan trọng: để bàn cờ quyết định width dựa trên aspect-ratio */
    width: auto; 
    aspect-ratio: 9/10;
  }

  .chessboard-container {
    position: relative;
    width: 100%;
    height: 100%; /* Full chiều cao của main-column */
    aspect-ratio: 9/10;
    margin: auto;
    user-select: none;
    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
  }

  /* --- SIDE PANEL / KHO QUÂN ÚP (CO GIÃN THEO CHIỀU CAO) --- */
  .side-panel {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    
    /* Chiều cao bằng đúng bàn cờ */
    height: 100%; 
    max-height: 100%;
    
    /* Width tương đối */
    width: 14vh; 
    min-width: 80px;
    
    background: rgba(0,0,0,0.25);
    /* Padding tính theo vh để co giãn */
    padding: 1vh; 
    border-radius: 12px;
    backdrop-filter: blur(5px);
    
    /* Nếu màn hình quá bé, cho phép cuộn để không vỡ layout */
    overflow-y: auto; 

    @media (max-width: 768px) {
      width: 100%;
      height: auto;
      flex-direction: row;
      overflow-x: auto;
      padding: 5px;
    }
  }

  .pool-section {
    display: flex;
    flex-direction: column;
    flex: 1; 
    justify-content: space-evenly; /* Chia đều khoảng cách */
    gap: 0.5vh; /* Gap co giãn */
    
    @media (max-width: 768px) {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
    }
  }
  
  .top-pool {
    border-bottom: 1px solid rgba(255,255,255,0.15);
    padding-bottom: 0.5vh;
    margin-bottom: 0.5vh;
    @media (max-width: 768px) {
      border-bottom: none;
      padding-bottom: 0; margin-bottom: 0;
      border-right: 1px solid rgba(255,255,255,0.15);
      padding-right: 5px; margin-right: 5px;
    }
  }

  .pool-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: rgba(255,255,255,0.1);
    
    /* Chiều cao dòng tính theo vh */
    height: 4.5vh; 
    /* Giới hạn min/max pixel để không quá xấu */
    min-height: 25px; 
    
    padding: 0 0.8vh;
    border-radius: 6px;
    
    &:hover { background: rgba(255,255,255,0.2); }
    @media (max-width: 768px) {
       width: 48%; height: 35px; margin-bottom: 2px;
    }
  }

  /* ẢNH QUÂN CỜ: Dùng vh để scale */
  .pool-img {
    height: 80%; /* 80% của dòng */
    width: auto;
    aspect-ratio: 1/1;
    object-fit: contain;
    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));
  }

  .pool-controls {
    display: flex; align-items: center; gap: 0.5vh; height: 100%;
  }
  
  /* SỐ LƯỢNG: Dùng vh để scale chữ */
  .pool-num {
    color: #fff; font-weight: bold; 
    /* Cực kỳ quan trọng: Font size ăn theo chiều cao màn hình */
    font-size: 2.2vh; 
    line-height: 1;
    min-width: 2vh; text-align: center;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  }
  
  .red-num { color: #ff6b6b; }
  .black-num { color: #eee; }

  .pool-btns {
    display: flex; flex-direction: column; 
    justify-content: center;
    gap: 1px;
    height: 100%; 
  }

  .tiny-btn {
    height: 40%; 
    aspect-ratio: 1.2/1;
    display: flex; align-items: center; justify-content: center;
    /* Font nút bấm cũng scale */
    font-size: 1.2vh; 
    font-weight: bold;
    background: rgba(0,0,0,0.5);
    color: #fff; border: 1px solid rgba(255,255,255,0.2);
    cursor: pointer; border-radius: 2px;
    &:hover:not(:disabled) { background: #007bff; border-color: #007bff; }
    &:disabled { opacity: 0.3; cursor: default; }
  }

  .pool-divider {
    flex: 0 0 auto;
    display: flex; align-items: center; justify-content: center;
    min-height: 1vh;
  }
  .pool-error {
    display: flex; align-items: center; gap: 0.5vh;
    font-size: 1.5vh; 
    color: #ff5252; text-align: center;
    line-height: 1; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
  }

  /* --- CÁC PHẦN KHÁC GIỮ NGUYÊN --- */
  .bg { width: 100%; height: 100%; display: block; }
  .pieces { position: absolute; inset: 0; z-index: 20; }
  .piece { position: absolute; aspect-ratio: 1; pointer-events: none; &.animated { transition: all 0.2s ease; } &.inCheck { transform: translate(-50%, -50%) scale(1.1); filter: drop-shadow(0 0 10px red); z-index: 100; } &.being-flipped { opacity: 0.3; filter: grayscale(1); } }
  .flip-overlay-fixed { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.3); z-index: 9000; cursor: not-allowed; }
  .radial-menu-container { position: absolute; transform: translate(-50%, -50%); z-index: 9999; animation: popIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275); pointer-events: auto; width: 0; height: 0; overflow: visible; }
  @keyframes popIn { from { transform: translate(-50%, -50%) scale(0); opacity: 0; } to { transform: translate(-50%, -50%) scale(1); opacity: 1; } }
  .radial-item { position: absolute; width: 45px; height: 45px; border-radius: 50%; background: rgba(30, 30, 30, 0.95); border: 2px solid rgba(255, 255, 255, 0.5); display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.6); transition: all 0.1s; pointer-events: auto; margin-left: -22.5px; margin-top: -22.5px; &:hover { transform: scale(1.2); background: #222; border-color: #00d2ff; z-index: 10000; } &:active { transform: scale(0.95); background: #000; } }
  .radial-img { width: 85%; height: 85%; object-fit: contain; pointer-events: none; }
  .radial-count { position: absolute; top: -5px; right: -5px; background: #f44336; color: white; font-size: 10px; font-weight: bold; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 1px solid #fff; pointer-events: none; }
  .radial-error-btn { position: absolute; transform: translate(-50%, -50%); background: #f44336; color: white; padding: 10px; border-radius: 8px; font-weight: bold; font-size: 12px; cursor: pointer; white-space: nowrap; box-shadow: 0 4px 10px rgba(0,0,0,0.5); pointer-events: auto; z-index: 10001; }
  .selection-mark { position: absolute; width: 12%; aspect-ratio: 1; transform: translate(-50%, -50%); z-index: 30; pointer-events: none; }
  .corner { position: absolute; width: 25%; height: 25%; border: 3px solid #007bff; box-shadow: 0 0 4px rgba(0, 123, 255, 0.6); }
  .top-left { top: 0; left: 0; border-right: none; border-bottom: none; border-top-left-radius: 10px; }
  .top-right { top: 0; right: 0; border-left: none; border-bottom: none; border-top-right-radius: 10px; }
  .bottom-left { bottom: 0; left: 0; border-right: none; border-top: none; border-bottom-left-radius: 10px; }
  .bottom-right { bottom: 0; right: 0; border-left: none; border-top: none; border-bottom-right-radius: 10px; }
  .highlight.from { position: absolute; transform: translate(-50%,-50%); width: 2.5%; aspect-ratio: 1; background: rgba(255,0,0,0.5); border-radius: 50%; pointer-events: none; }
  .highlight.to { position: absolute; transform: translate(-50%,-50%); width: 12%; aspect-ratio: 1; border: 2px solid rgba(0,255,255,0.7); pointer-events: none; border-radius: 8px; }
  .valid-move-dot { position: absolute; transform: translate(-50%,-50%); width: 2.5%; aspect-ratio: 1; background: #4caf50; border-radius: 50%; pointer-events: none; z-index: 15; box-shadow: 0 0 5px #4caf50; }
  .eval-bar { position: absolute; top: 0; bottom: 0; left: -12px; width: 8px; background: #ddd; border-radius: 4px; overflow: hidden; z-index: 5; border: 1px solid #999; }
  .eval-top { width: 100%; transition: height 0.5s ease-in-out; }
  .eval-bottom { width: 100%; transition: height 0.5s ease-in-out; }
  .eval-marker { position: absolute; left: 0; right: 0; height: 2px; background: #fff; box-shadow: 0 0 2px #000; }
  .flip-hint-area { margin-top: 10px; background: rgba(0,0,0,0.7); color: #fff; padding: 8px; border-radius: 6px; text-align: center; font-size: 14px; backdrop-filter: blur(4px); }
  .ar, .user-drawings, .board-labels { position: absolute; inset: 0; pointer-events: none; }
  .annotation-layer { position: absolute; inset: 0; pointer-events: none; z-index: 50; }
  .annotation-badge { position: absolute; top: -10px; right: -10px; width: 22px; height: 22px; background: #007bff; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
  .board-labels { overflow: visible; .rank-labels span { position: absolute; right: -15px; color: #888; font-weight: bold; font-size: 12px; } .file-labels span { position: absolute; bottom: -20px; color: #888; font-weight: bold; font-size: 12px; } }
  .al { stroke-width: 1.5; stroke-opacity: 0.8; }
</style>