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
          <img v-for="p in pieces" :key="p.id" :src="img(p)" class="piece" :class="{ animated: isAnimating && showAnimations, inCheck: p.id === checkedKingId }" :style="rcStyle(p.row, p.col, p.zIndex)" />
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
          <div 
            v-for="(item, index) in flipSelectionPieces" 
            :key="item.name" 
            class="radial-item" 
            :style="getRadialItemStyle(index, flipSelectionPieces.length)" 
            @click.stop="handleFlipSelect(item.name)"
            @mousedown.stop
            @touchstart.stop
          >
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
          <img :src="getPieceImageUrl(item.name)" class="pool-img" /><div class="pool-controls"><span class="pool-num" :class="isRedOnTop ? 'red-num' : 'black-num'">{{ item.count }}</span><div class="pool-btns"><button class="tiny-btn" @click="adjustUnrevealedCount(item.char, 1)">+</button><button class="tiny-btn" @click="adjustUnrevealedCount(item.char, -1)">-</button></div></div>
        </div>
      </div>
      <div class="pool-divider"><div v-if="poolErrorMessage" class="pool-error"><span>{{ poolErrorMessage }}</span></div></div>
      <div class="pool-section bottom-pool">
        <div v-for="item in (isRedOnTop ? blackPool : redPool)" :key="item.char" class="pool-row">
          <img :src="getPieceImageUrl(item.name)" class="pool-img" /><div class="pool-controls"><span class="pool-num" :class="isRedOnTop ? 'black-num' : 'red-num'">{{ item.count }}</span><div class="pool-btns"><button class="tiny-btn" @click="adjustUnrevealedCount(item.char, 1)">+</button><button class="tiny-btn" @click="adjustUnrevealedCount(item.char, -1)">-</button></div></div>
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
  const flipSelectionPieces = computed(() => {
    if (!pendingFlip.value) return []
    const requiredSide = pendingFlip.value.side
    return Object.entries(unrevealedPieceCounts.value)
      .map(([char, count]) => {
        const name = getPieceNameFromChar(char)
        return { name, char, count }
      })
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
  const handleFlipRandom = () => {}

  const poolErrorMessage = computed(() => {
    if (!validationStatus.value) return null
    let msg = validationStatus.value.replace(/^Error:\s*|^错误:\s*/i, '').trim()
    return `Lỗi: ${msg}`
  })

  const INITIAL_PIECE_COUNTS: { [k: string]: number } = { r: 2, n: 2, b: 2, a: 2, c: 2, p: 5, k: 1, R: 2, N: 2, B: 2, A: 2, C: 2, P: 5, K: 1 }
  const blackPool = computed(() => { const chars = ['r', 'n', 'c', 'a', 'b', 'p']; return chars.map(char => ({ char, name: getPieceNameFromChar(char), count: unrevealedPieceCounts?.value?.[char] || 0, max: INITIAL_PIECE_COUNTS[char] })) })
  const redPool = computed(() => { const chars = ['R', 'N', 'C', 'A', 'B', 'P']; return chars.map(char => ({ char, name: getPieceNameFromChar(char), count: unrevealedPieceCounts?.value?.[char] || 0, max: INITIAL_PIECE_COUNTS[char] })) })
  
  function getPieceImageUrl(pieceName: string): string { return new URL(`../assets/${pieceName}.png`, import.meta.url).href }

  const userCircles = ref<Array<{ x: number; y: number; radius: number; row: number; col: number }>>([])
  const userArrows = ref<Array<{ x1: number; y1: number; x2: number; y2: number; fromRow: number; fromCol: number; toRow: number; toCol: number }>>([])
  const isDrawing = ref(false); const drawingStart = ref<any>(null); const drawingStartRC = ref<any>(null)
  const isCurrentPositionInCheck = gs.isCurrentPositionInCheck; const validMovesForSelectedPiece = computed(() => gs.getValidMovesForSelectedPiece.value)
  const isRedOnTop = computed(() => { try { return !!gs?.isBoardFlipped?.value } catch { return false } }); const isAndroid = computed(() => isAndroidPlatform())
  const checkedKingId = computed(() => { if (isCurrentPositionInCheck('red')) { const k = gs.pieces.value.find((p: Piece) => p.name === 'red_king'); return k?.id } if (isCurrentPositionInCheck('black')) { const k = gs.pieces.value.find((p: Piece) => p.name === 'black_king'); return k?.id } return null })

  const percentFromRC = (row: number, col: number) => ({ x: OX + (col / (COLS - 1)) * GX, y: OY + (row / (ROWS - 1)) * GY })
  const percentToSvgCoords = (row: number, col: number) => ({ x: (OX + (col / (COLS - 1)) * GX) * 0.9, y: OY + (row / (ROWS - 1)) * GY })
  const img = (p: Piece) => new URL(`../assets/${p.isKnown ? p.name : 'dark_piece'}.png`, import.meta.url).href
  const rcStyle = (r: number, c: number, zIndex?: number) => { const { x, y } = percentFromRC(r, c); return { top: `${y}%`, left: `${x}%`, width: '12%', transform: 'translate(-50%,-50%)', ...(zIndex !== undefined && { zIndex: zIndex }) } }
  const rankLabelStyle = (index: number) => { const { y } = percentFromRC(index, 0); return { top: `${y}%`, transform: 'translateY(-50%)' } }
  const fileLabelStyle = (index: number) => { const { x } = percentFromRC(0, index); return { left: `${x}%`, transform: 'translateX(-50%)' } }
  const displayRow = (r: number) => (gs.isBoardFlipped.value ? 9 - r : r); const displayCol = (c: number) => (gs.isBoardFlipped.value ? 8 - c : c)
  const showClearHistoryDialog = ref(false); const pendingMove = ref<{ piece: Piece; row: number; col: number } | null>(null)
  
  const boardClick = (e: MouseEvent) => {
    if (isMatchRunning.value) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const col = Math.round((((e.clientX - rect.left) / rect.width * 100 - OX) / GX) * (COLS - 1))
    const row = Math.round((((e.clientY - rect.top) / rect.height * 100 - OY) / GY) * (ROWS - 1))
    const result = handleBoardClick(Math.max(0, Math.min(ROWS - 1, row)), Math.max(0, Math.min(COLS - 1, col)))
    if (result && result.requireClearHistoryConfirm) { pendingMove.value = result.move; showClearHistoryDialog.value = true }
  }

  const clearUserDrawings = () => { userCircles.value = []; userArrows.value = [] }; if (gs) gs.clearUserArrows = clearUserDrawings
  const flipUserDrawings = () => { userCircles.value = userCircles.value.map(c => { const { x, y } = percentToSvgCoords(9-c.row, 8-c.col); return { ...c, row: 9-c.row, col: 8-c.col, x, y } }); userArrows.value = userArrows.value.map(a => { const ffr = 9-a.fromRow, ffc = 8-a.fromCol, ftr = 9-a.toRow, ftc = 8-a.toCol; const { x: x1, y: y1 } = percentToSvgCoords(ffr, ffc); const { x: x2, y: y2 } = percentToSvgCoords(ftr, ftc); return { ...a, fromRow: ffr, fromCol: ffc, toRow: ftr, toCol: ftc, x1, y1, x2, y2 } }) }
  const handleForceStopAi = (e: CustomEvent) => { try { if ((e as any)?.detail?.reason === 'new-game') { clearUserDrawings(); selectedPvMove.value = null } } catch {} }
  const handleHighlightMultipv = (e: CustomEvent) => { try { const uci = (e as any)?.detail?.uci as string; if (!uci || uci.length < 4) return; selectedPvMove.value = uci } catch (error) { console.warn(error) } }
  const handleClearDrawingsEvent = () => clearUserDrawings()
  onMounted(() => { window.addEventListener('force-stop-ai', handleForceStopAi as EventListener); window.addEventListener('highlight-multipv', handleHighlightMultipv as EventListener); window.addEventListener('clear-drawings', handleClearDrawingsEvent) })
  onUnmounted(() => { window.removeEventListener('force-stop-ai', handleForceStopAi as EventListener); window.removeEventListener('highlight-multipv', handleHighlightMultipv as EventListener); window.removeEventListener('clear-drawings', handleClearDrawingsEvent) })
  try { const provider = () => userArrows.value.map(a => ({ fromRow: a.fromRow, fromCol: a.fromCol, toRow: a.toRow, toCol: a.toCol })); gs?.registerUserArrowProvider?.(provider) } catch {}
  try { gs?.registerUserDrawingsFlipFunction?.(flipUserDrawings) } catch {}
  const onConfirmClearHistory = () => { if (pendingMove.value) gs.clearHistoryAndMove(pendingMove.value.piece, pendingMove.value.row, pendingMove.value.col); showClearHistoryDialog.value = false; pendingMove.value = null }; const onCancelClearHistory = () => { showClearHistoryDialog.value = false; pendingMove.value = null }
  interface Arrow { x1: number; y1: number; x2: number; y2: number; pv: number }; const arrs = ref<Arrow[]>([]); const selectedPvMove = ref<string | null>(null); const uciToDisplayRC = (uci: string) => { if (uci.length < 4) return { from: { row: 0, col: 0 }, to: { row: 0, col: 0 } }; const fromCol = uci.charCodeAt(0) - 'a'.charCodeAt(0), fromRow = 9 - +uci[1], toCol = uci.charCodeAt(2) - 'a'.charCodeAt(0), toRow = 9 - +uci[3]; if (!gs.isBoardFlipped.value) return { from: { row: fromRow, col: fromCol }, to: { row: toRow, col: toCol } }; else return { from: { row: 9 - fromRow, col: 8 - fromCol }, to: { row: 9 - toRow, col: 8 - toCol } } }
  const parseJaiAnalysisInfoForPV = (analysisInfo: string): string[][] => { if (!analysisInfo) return []; const pvMoves: string[][] = []; const lines = analysisInfo.split('\n').filter(line => line.trim().length > 0); lines.forEach(line => { const pvIndex = line.indexOf(' pv '); if (pvIndex !== -1) { const moves = line.slice(pvIndex + 4).trim().split(/\s+/).filter(move => move.length >= 4); if (moves.length > 0) pvMoves.push(moves) } }); return pvMoves }
  const updateArrow = () => { const isMatchMode = (window as any).__MATCH_MODE__ || false; const jaiAnalysisInfo = jaiEngine?.analysisInfo?.value || ''; const isHumanVsAiMode = (window as any).__HUMAN_VS_AI_MODE__ || false; if (isHumanVsAiMode) { arrs.value = []; return } if (isMatchMode && isMatchRunning.value && jaiAnalysisInfo) { const jaiPvMoves = parseJaiAnalysisInfoForPV(jaiAnalysisInfo); if (jaiPvMoves.length > 0) { const arrows: Arrow[] = []; jaiPvMoves.forEach((moves: string[], idx: number) => { if (!moves || !moves.length) return; const mv = moves[0]; if (mv && mv.length >= 4) { const coords = uciToDisplayRC(mv); const f = percentToSvgCoords(coords.from.row, coords.from.col), t = percentToSvgCoords(coords.to.row, coords.to.col); arrows.push({ x1: f.x, y1: f.y, x2: t.x, y2: t.y, pv: idx + 1 }) } }); arrs.value = arrows; return } } if (isPondering.value && !isInfinitePondering.value && !ponderhit.value && ponderMove.value) { const mv = ponderMove.value; if (mv && mv.length >= 4) { const coords = uciToDisplayRC(mv); const f = percentToSvgCoords(coords.from.row, coords.from.col), t = percentToSvgCoords(coords.to.row, coords.to.col); arrs.value = [{ x1: f.x, y1: f.y, x2: t.x, y2: t.y, pv: 1 }]; return } } if ((isThinking.value || (isPondering.value && isInfinitePondering.value)) && multiPvMoves.value.length) { const arrows: Arrow[] = []; multiPvMoves.value.forEach((moves: string[], idx: number) => { if (!moves || !moves.length) return; const mv = moves[0]; if (mv && mv.length >= 4) { const coords = uciToDisplayRC(mv); const f = percentToSvgCoords(coords.from.row, coords.from.col), t = percentToSvgCoords(coords.to.row, coords.to.col); arrows.push({ x1: f.x, y1: f.y, x2: t.x, y2: t.y, pv: idx + 1 }) } }); arrs.value = arrows; return } if (!isThinking.value && !isPondering.value && bestMove.value) { const mv = bestMove.value; if (mv.length >= 4) { const coords = uciToDisplayRC(mv); const f = percentToSvgCoords(coords.from.row, coords.from.col), t = percentToSvgCoords(coords.to.row, coords.to.col); arrs.value = [{ x1: f.x, y1: f.y, x2: t.x, y2: t.y, pv: 1 }]; return } } arrs.value = [] }
  watchEffect(() => { void isThinking.value; void isPondering.value; void isInfinitePondering.value; void ponderMove.value; void ponderhit.value; void multiPvMoves.value.map((m: string[]) => m.join(',')); void jaiEngine?.analysisInfo?.value; void (window as any).__MATCH_MODE__; void isMatchRunning.value; updateArrow() }); watch(() => gs.isBoardFlipped.value, updateArrow); registerArrowClearCallback(() => { arrs.value = []; selectedPvMove.value = null })
  const arrowColors = ['#0066cc', '#e53935', '#43a047', '#ffb300', '#8e24aa', '#00897b']; const arrowColor = (idx: number) => arrowColors[idx % arrowColors.length]
  const selectedPvArrow = computed(() => { if (!selectedPvMove.value) return null; const coords = uciToDisplayRC(selectedPvMove.value); const f = percentToSvgCoords(coords.from.row, coords.from.col), t = percentToSvgCoords(coords.to.row, coords.to.col); const exists = arrs.value.some(a => Math.abs(a.x1 - f.x) < 0.0001 && Math.abs(a.y1 - f.y) < 0.0001 && Math.abs(a.x2 - t.x) < 0.0001 && Math.abs(a.y2 - t.y) < 0.0001); return exists ? { x1: f.x, y1: f.y, x2: t.x, y2: t.y } : null })
  const getAnnotationClass = (_positions: any) => { const currentAnnotation = getCurrentMoveAnnotation(); if (!currentAnnotation) return ''; switch (currentAnnotation) { case '!!': return 'annot-brilliant'; case '!': return 'annot-good'; case '!?': return 'annot-interesting'; case '?!': return 'annot-dubious'; case '?': return 'annot-mistake'; case '??': return 'annot-blunder'; default: return '' } }
  const getCurrentMoveAnnotation = () => { try { if (gs?.pendingFlip?.value) return null } catch {} if (currentMoveIndex.value <= 0 || currentMoveIndex.value > history.value.length) return null; const moveEntry = history.value[currentMoveIndex.value - 1]; return moveEntry?.annotation || null }
  const extractCpFromInfoLine = (line: string): number | null => { if (!line) return null; const m = line.match(/score\s+(cp|mate)\s+(-?\d+)/); if (!m) return null; const type = m[1], val = parseInt(m[2]); if (Number.isNaN(val)) return null; if (type === 'mate') { const ply = Math.abs(val), sign = val >= 0 ? 1 : -1; return sign * (MATE_SCORE_BASE - ply) } return val }
  const lastAnalysisInfo = ref<string>(''), lastJaiAnalysisInfo = ref<string>(''), lastEvalCp = ref<number | null>(null), lastAnalysisSideToMove = ref<string | null>(null)
  const currentEvalCp = computed<number | null>(() => { const isMatchMode = (window as any).__MATCH_MODE__ || false; const jaiInfo: string | undefined = jaiEngine?.analysisInfo?.value; if (isMatchMode && jaiInfo) { if (jaiInfo !== lastJaiAnalysisInfo.value) { lastJaiAnalysisInfo.value = jaiInfo; const lines = jaiInfo.split('\n').map(l => l.trim()).filter(Boolean); for (let i = lines.length - 1; i >= 0; i--) { const cp = extractCpFromInfoLine(lines[i]); if (cp !== null) { let val = cp; if (isPondering.value && !isInfinitePondering.value) val = -val; try { lastAnalysisSideToMove.value = gs?.sideToMove?.value || null } catch {} if (lastAnalysisSideToMove.value === 'black') val = -val; lastEvalCp.value = val; return val } } } else return lastEvalCp.value } const analysis: string | undefined = (es as any)?.analysis?.value; if (analysis) { if (analysis !== lastAnalysisInfo.value) { lastAnalysisInfo.value = analysis; const lines = analysis.split('\n').map((l: string) => l.trim()).filter(Boolean); for (let i = lines.length - 1; i >= 0; i--) { const cp = extractCpFromInfoLine(lines[i]); if (cp !== null) { let val = cp; if (isPondering.value && !isInfinitePondering.value) val = -val; try { lastAnalysisSideToMove.value = gs?.sideToMove?.value || null } catch {} if (lastAnalysisSideToMove.value === 'black') val = -val; lastEvalCp.value = val; return val } } } else return lastEvalCp.value } lastAnalysisInfo.value = ''; lastJaiAnalysisInfo.value = ''; lastEvalCp.value = null; lastAnalysisSideToMove.value = null; return null })
  const currentEvalPercent = computed<number | null>(() => { let cp = currentEvalCp.value; if (cp === null || cp === undefined) return null; const m = Math.tanh(cp / 600), redPct = Math.max(0, Math.min(100, Math.round((m + 1) * 50))); return isRedOnTop.value ? redPct : 100 - redPct })
</script>

<style scoped lang="scss">
  /* 1. SELECTION MARK */
  .selection-mark { position: absolute; width: 12%; aspect-ratio: 1; transform: translate(-50%, -50%); pointer-events: none; z-index: 30; }
  .selection-mark .corner { border-color: #007bff; } 

  /* 2. HIGHLIGHT TO */
  .highlight.to { position: absolute; width: 12%; aspect-ratio: 1; transform: translate(-50%, -50%); pointer-events: none; z-index: 25; }
  .highlight.to .corner { border-color: #4ecdc4; }

  /* CORNER STYLE */
  .corner { position: absolute; width: 25%; height: 25%; border-style: solid; border-width: 3px; }
  .top-left { top: 0; left: 0; border-right: none; border-bottom: none; border-top-left-radius: 6px; }
  .top-right { top: 0; right: 0; border-left: none; border-bottom: none; border-top-right-radius: 6px; }
  .bottom-left { bottom: 0; left: 0; border-right: none; border-top: none; border-bottom-left-radius: 6px; }
  .bottom-right { bottom: 0; right: 0; border-left: none; border-top: none; border-bottom-right-radius: 6px; }

  /* 3. HIGHLIGHT FROM */
  .highlight.from {
    position: absolute;
    aspect-ratio: 1;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background-color: rgba(255, 107, 107, 0.8);
    box-shadow: 0 0 4px rgba(255, 107, 107, 0.5);
    z-index: 10;
    pointer-events: none;
  }

  /* 4. VALID MOVE */
  .valid-move-dot {
    position: absolute;
    width: 2.5%; 
    aspect-ratio: 1;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: #4caf50; 
    border: 1px solid #2e7d32;
    box-shadow: 0 0 4px rgba(0,0,0,0.3);
    user-select: none;
    z-index: 15;
    pointer-events: none;
  }

  /* --- LAYOUT CHÍNH: HÀNG NGANG (ROW) --- */
  /* Bàn cờ bên trái, Kho quân bên phải */
  .chessboard-wrapper {
    display: flex;
    flex-direction: row; /* Xếp ngang */
    align-items: flex-start;
    justify-content: center;
    gap: 20px;
    width: 100%;
    max-width: 95vmin;
    margin: 0 auto;
    
    /* PADDING ĐỂ TRÁNH BỊ CẮT KHI MENU BUNG RA */
    padding: 20px; 
    
    @media (max-width: 768px) {
      flex-direction: column; /* Mobile thì xếp dọc lại */
      gap: 12px;
      padding: 10px;
    }
  }

  /* CỘT CHÍNH (CHỨA BÀN CỜ + FLIP PROMPT) */
  .main-column {
    display: flex;
    flex-direction: column; /* Bàn cờ trên, Flip Prompt dưới */
    flex: 0 0 auto;
    width: 80%; /* Bàn cờ chiếm phần lớn */
    gap: 12px;
    
    @media (max-width: 768px) {
      width: 100%;
    }
  }

  .chessboard-container {
    position: relative;
    width: 100%;
    aspect-ratio: 9/10;
    margin: auto;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    /* QUAN TRỌNG: Cho phép tràn ra ngoài để menu không bị cắt */
    overflow: visible !important;
  }

  /* KHO QUÂN (SIDE PANEL) - NẰM BÊN PHẢI */
  .side-panel {
    display: flex;
    flex-direction: column; /* Hai phe Đỏ/Đen xếp dọc */
    justify-content: space-between;
    align-items: center;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    padding: 8px;
    gap: 10px;
    min-width: 70px;
    flex: 1; /* Chiếm phần còn lại */
    align-self: stretch; /* Cao bằng bàn cờ */
    
    @media (max-width: 768px) {
      width: 100%;
      flex-direction: row; /* Mobile: kho quân nằm ngang bên dưới */
      min-height: auto;
      align-self: auto;
    }
  }

  /* CÁC STYLE CHO KHO QUÂN */
  .pool-section {
    display: flex;
    flex-direction: column; /* Các quân xếp dọc */
    gap: 4px;
    width: 100%;
    align-items: center;
    
    @media (max-width: 768px) {
      flex-direction: row; /* Mobile: xếp ngang */
      flex-wrap: wrap;
      justify-content: center;
    }
  }

  .pool-row {
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 4px;
    position: relative;
    gap: 2px;
    width: 100%;
    
    @media (max-width: 768px) {
      width: auto;
      min-width: 45px;
    }
  }

  .pool-img {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }

  .pool-controls {
    display: flex;
    align-items: center;
    flex-direction: row;
    gap: 2px;
  }

  .pool-num {
    font-size: 1.1rem;
    font-weight: bold;
    color: #fff;
    line-height: 1;
    margin-right: 2px;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  }

  .red-num { color: #ff5252; }
  .black-num { color: #000000; text-shadow: 0 0 1px #fff; }

  .pool-btns {
    display: flex;
    flex-direction: column;
    gap: 1px;
    
    @media (max-width: 768px) {
      display: none; /* Ẩn nút trên mobile */
    }
  }

  .tiny-btn {
    width: 14px;
    height: 12px;
    line-height: 10px;
    font-size: 10px;
    font-weight: bold;
    background: #555;
    color: #fff;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 2px;
    cursor: pointer;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    &:hover:not(:disabled) { background: #777; }
    &:disabled { opacity: 0.3; cursor: default; border-color: transparent; }
  }

  .pool-divider {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  .pool-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    background: #ffffff;
    border: 1px solid #d32f2f;
    border-radius: 4px;
    padding: 4px;
    color: #d32f2f;
    font-weight: bold;
    font-size: 10px;
    text-align: center;
    word-break: break-word;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    max-width: 100%;
  }

  /* --- CẤU HÌNH LỚP MỜ VÀ MENU VÒNG TRÒN (ĐÃ SỬA LỖI CLICK) --- */
  
  /* Lớp mờ: absolute (theo bàn cờ) thay vì fixed (toàn màn hình) để không che menu */
  .flip-overlay-absolute {
    position: absolute; /* Bao phủ bàn cờ */
    inset: 0; /* top:0, left:0, right:0, bottom:0 */
    background: rgba(0,0,0,0.2); /* Mờ nhẹ */
    z-index: 1900; /* Thấp hơn menu */
    cursor: not-allowed;
  }

  /* Menu Vòng Tròn */
  .radial-menu-container {
    position: absolute;
    transform: translate(-50%, -50%); /* Căn giữa vào quân cờ */
    z-index: 2000; /* Cao nhất */
    /* width/height sẽ được ghi đè bằng inline style */
    animation: zoomIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    pointer-events: auto; /* Đảm bảo nhận click */
  }

  @keyframes zoomIn {
    from { transform: translate(-50%, -50%) scale(0); opacity: 0; }
    to { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  }

  /* Các vệ tinh (Quân cờ) */
  .radial-item {
    position: absolute;
    transform: translate(-50%, -50%);
    width: 25%; aspect-ratio: 1; border-radius: 50%;
    background: rgba(40, 40, 40, 0.95);
    backdrop-filter: blur(4px);
    border: 2px solid rgba(255,255,255,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    transition: all 0.2s;
    
    /* Chặn sự kiện click lan xuống dưới */
    pointer-events: auto; 

    &:hover {
      background: rgba(60, 60, 60, 1);
      border-color: #00d2ff;
      transform: translate(-50%, -50%) scale(1.15);
      z-index: 2050;
      box-shadow: 0 0 15px rgba(0, 210, 255, 0.6);
    }
    
    &:active {
      transform: translate(-50%, -50%) scale(0.95);
    }
  }

  .radial-img {
    width: 85%; height: 85%;
    object-fit: contain;
    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5));
  }

  .radial-count {
    position: absolute;
    top: -4px; right: -4px;
    background: #ff3d00;
    color: white;
    font-size: 10px; font-weight: bold;
    width: 16px; height: 16px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid #fff;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }

  /* VÙNG THÔNG BÁO DƯỚI BÀN CỜ */
  .flip-hint-area {
    margin-top: 8px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 6px 12px;
    text-align: center;
  }
  .flip-hint-text {
    font-size: 12px;
    color: #e0e0e0;
    display: flex; align-items: center; justify-content: center;
  }
</style>