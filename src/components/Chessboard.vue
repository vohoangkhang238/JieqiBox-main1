<template>
  <div class="chessboard-wrapper" :class="{ 'has-chart': showPositionChart }">
    <div class="chessboard-container">
      <img src="@/assets/xiangqi.png" class="bg" alt="board" />

      <div
        v-if="showEvaluationBar && currentEvalPercent !== null"
        class="eval-bar"
        aria-hidden="true"
      >
        <div
          class="eval-top"
          :style="{
            height: currentEvalPercent + '%',
            background: isRedOnTop ? '#e53935' : '#333',
          }"
        ></div>
        <div
          class="eval-bottom"
          :style="{
            height: 100 - (currentEvalPercent as number) + '%',
            background: isRedOnTop ? '#333' : '#e53935',
          }"
        ></div>
        <div
          class="eval-marker"
          :style="{ top: currentEvalPercent + '%' }"
        ></div>
      </div>

      <div
        class="pieces"
        @click="boardClick"
        @mousedown.right="handleRightMouseDown"
        @mouseup.right="handleRightMouseUp"
        @contextmenu.prevent
      >
        <img
          v-for="p in pieces"
          :key="p.id"
          :src="img(p)"
          class="piece"
          :class="{
            animated: isAnimating && showAnimations,
            inCheck: p.id === checkedKingId,
          }"
          :style="rcStyle(p.row, p.col, p.zIndex)"
        />
      </div>

      <div 
        v-if="selectedPiece" 
        class="selection-mark"
        :style="rcStyle(selectedPiece.row, selectedPiece.col, 100)"
      >
        <div class="corner top-left"></div>
        <div class="corner top-right"></div>
        <div class="corner bottom-left"></div>
        <div class="corner bottom-right"></div>
      </div>

      <div class="last-move-highlights" v-if="lastMovePositions">
        <div
          class="highlight from"
          :class="getAnnotationClass(lastMovePositions)"
          :style="
            rcStyle(
              displayRow(lastMovePositions.from.row),
              displayCol(lastMovePositions.from.col)
            )
          "
        ></div>
        <div
          class="highlight to"
          :class="getAnnotationClass(lastMovePositions)"
          :style="
            rcStyle(
              displayRow(lastMovePositions.to.row),
              displayCol(lastMovePositions.to.col)
            )
          "
        ></div>
      </div>

      <div
        v-if="lastMovePositions && getCurrentMoveAnnotation()"
        class="annotation-layer"
      >
        <div
          class="annotation-anchor"
          :class="getAnnotationClass(lastMovePositions)"
          :style="
            rcStyle(
              displayRow(lastMovePositions.to.row),
              displayCol(lastMovePositions.to.col)
            )
          "
        >
          <div class="annotation-badge">{{ getCurrentMoveAnnotation() }}</div>
        </div>
      </div>

      <svg
        class="user-drawings"
        viewBox="0 0 90 100"
        preserveAspectRatio="none"
      >
        <circle
          v-for="(circle, idx) in userCircles"
          :key="`circle-${idx}`"
          :cx="circle.x"
          :cy="circle.y"
          :r="circle.radius"
          fill="none"
          stroke="#ff6b6b"
          stroke-width="1"
          opacity="0.8"
        />
        <defs>
          <marker
            id="user-arrow-marker"
            markerWidth="3"
            markerHeight="3"
            refX="2"
            refY="1.5"
            orient="auto"
          >
            <polygon points="0 0, 3 1.5, 0 3" fill="#ff6b6b" />
          </marker>
        </defs>
        <line
          v-for="(arrow, idx) in userArrows"
          :key="`arrow-${idx}`"
          :x1="arrow.x1"
          :y1="arrow.y1"
          :x2="arrow.x2"
          :y2="arrow.y2"
          stroke="#ff6b6b"
          stroke-width="2"
          marker-end="url(#user-arrow-marker)"
          opacity="0.8"
        />
      </svg>

      <div
        class="valid-moves-indicators"
        v-if="validMovesForSelectedPiece.length > 0"
      >
        <div
          v-for="(move, index) in validMovesForSelectedPiece"
          :key="`valid-move-${index}`"
          class="valid-move-dot"
          :style="rcStyle(move.row, move.col)"
        ></div>
      </div>

      <div class="board-labels" v-if="showCoordinates">
        <div class="rank-labels">
          <span
            v-for="(rank, index) in ranks"
            :key="rank"
            :style="rankLabelStyle(index)"
            >{{ rank }}</span
          >
        </div>
        <div class="file-labels">
          <span
            v-for="(file, index) in files"
            :key="file"
            :style="fileLabelStyle(index)"
            >{{ file }}</span
          >
        </div>
      </div>

      <svg
        class="ar"
        viewBox="0 0 90 100"
        preserveAspectRatio="none"
        v-if="showArrows"
      >
        <defs>
          <marker
            v-for="(color, idx) in arrowColors"
            :key="`marker-${idx}`"
            :id="`ah-${idx}`"
            markerWidth="2.5"
            markerHeight="2.5"
            refX="1.5"
            refY="1.25"
            orient="auto"
          >
            <polygon points="0 0, 2.5 1.25, 0 2.5" :fill="color" />
          </marker>
          <marker
            id="ah-selected"
            markerWidth="2.5"
            markerHeight="2.5"
            refX="1.5"
            refY="1.25"
            orient="auto"
          >
            <polygon points="0 0, 2.5 1.25, 0 2.5" fill="#e53935" />
          </marker>
        </defs>
        <template v-for="(a, idx) in arrs" :key="`arrow-${idx}`">
          <line
            :x1="a.x1"
            :y1="a.y1"
            :x2="a.x2"
            :y2="a.y2"
            :style="{ stroke: arrowColor(idx) }"
            :marker-end="`url(#ah-${idx % arrowColors.length})`"
            class="al"
          />
          <text
            v-if="arrs.length > 1"
            :x="(a.x1 + a.x2) / 2"
            :y="(a.y1 + a.y2) / 2"
            :fill="arrowColor(idx)"
            class="arrow-label"
          >
            {{ a.pv }}
          </text>
        </template>
        <template v-if="selectedPvArrow">
          <line
            :x1="selectedPvArrow.x1"
            :y1="selectedPvArrow.y1"
            :x2="selectedPvArrow.x2"
            :y2="selectedPvArrow.y2"
            marker-end="url(#ah-selected)"
            class="al selected-arrow-shadow"
          />
          <line
            :x1="selectedPvArrow.x1"
            :y1="selectedPvArrow.y1"
            :x2="selectedPvArrow.x2"
            :y2="selectedPvArrow.y2"
            marker-end="url(#ah-selected)"
            class="al selected-arrow"
          />
        </template>
      </svg>

      <ClearHistoryConfirmDialog
        :visible="showClearHistoryDialog"
        :onConfirm="onConfirmClearHistory"
        :onCancel="onCancelClearHistory"
      />
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

    <EvaluationChart
      v-if="showPositionChart"
      :history="history"
      :current-move-index="currentMoveIndex"
      :initial-fen="unref(gs?.initialFen)"
      @seek="handleChartSeek"
    />
  </div>
</template>

<script setup lang="ts">
  import {
    inject,
    ref,
    watch,
    computed,
    watchEffect,
    onMounted,
    onUnmounted,
    unref,
  } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { Piece } from '@/composables/useChessGame'
  import { useInterfaceSettings } from '@/composables/useInterfaceSettings'
  import ClearHistoryConfirmDialog from './ClearHistoryConfirmDialog.vue'
  import EvaluationChart from './EvaluationChart.vue'
  import { MATE_SCORE_BASE } from '@/utils/constants'
  import { isAndroidPlatform } from '@/utils/platform'

  const handleChartSeek = (idx: number) => {
    try {
      const gsAny: any = gs
      if (gsAny?.replayToMove) gsAny.replayToMove(idx)
    } catch {}
  }

  const { t } = useI18n()

  const PAD_X = 11,
    PAD_Y = 11,
    COLS = 9,
    ROWS = 10,
    GX = 100 - PAD_X,
    GY = 100 - PAD_Y,
    OX = PAD_X / 2,
    OY = PAD_Y / 2
  const files = computed(() => {
    const baseFiles = 'abcdefghi'.split('')
    return gs.isBoardFlipped.value ? baseFiles.slice().reverse() : baseFiles
  })

  const ranks = computed(() => {
    const baseRanks = Array.from({ length: 10 }, (_, i) => 9 - i)
    return gs.isBoardFlipped.value ? baseRanks.slice().reverse() : baseRanks
  })

  const {
    showCoordinates,
    showAnimations,
    showPositionChart,
    showEvaluationBar,
    showArrows,
  } = useInterfaceSettings()

  const gs: any = inject('game-state')
  const es = inject('engine-state') as {
    pvMoves: any
    bestMove: any
    isThinking: any
    multiPvMoves: any
    stopAnalysis: any
    isPondering: any
    isInfinitePondering: any
    ponderMove: any
    ponderhit: any
    analysis?: any
  }

  const jaiEngine = inject('jai-engine-state') as any

  const isMatchRunning = computed(() => {
    return jaiEngine?.isMatchRunning?.value || false
  })

  const {
    pieces,
    selectedPieceId,
    handleBoardClick,
    isAnimating,
    lastMovePositions,
    registerArrowClearCallback,
    history,
    currentMoveIndex,
    unrevealedPieceCounts,
    adjustUnrevealedCount,
    getPieceNameFromChar,
    validationStatus,
  } = gs

  // --- LOGIC MỚI: TÌM QUÂN ĐANG CHỌN ĐỂ VẼ KHUNG ---
  const selectedPiece = computed(() => {
    if (!unref(selectedPieceId)) return null
    return unref(pieces).find((p: Piece) => p.id === unref(selectedPieceId))
  })

  // --- Logic hiển thị lỗi ---
  const poolErrorMessage = computed(() => {
    if (!validationStatus.value) return null
    const s = validationStatus.value
    if (s.includes('正常') || s.toLowerCase().includes('normal')) {
      return null
    }

    let msg = s.replace(/^Error:\s*|^错误:\s*/i, '').trim()

    const matchMismatch = msg.match(/(红方|黑方)(\d+)暗子\s*>\s*(\d+)池/)
    if (matchMismatch) {
        const side = matchMismatch[1] === '红方' ? 'Đỏ' : 'Đen'
        const count = matchMismatch[2]
        const pool = matchMismatch[3]
        return `Lỗi: ${side} dư quân (${count} > ${pool} trong kho)`
    }

    msg = msg.replace(/红方/g, 'Bên Đỏ ')
             .replace(/黑方/g, 'Bên Đen ')
             .replace(/暗子/g, ' quân úp')
             .replace(/池/g, ' trong kho')
             .replace(/Piece Count Exceeded/i, 'Quá số lượng cho phép')
             .replace(/Total/i, 'Tổng')
             .replace(/\s*>\s*/g, ' > ')

    return `Lỗi: ${msg}`
  })

  // --- Logic Pool ---
  const INITIAL_PIECE_COUNTS: { [k: string]: number } = {
    r: 2, n: 2, b: 2, a: 2, c: 2, p: 5, k: 1,
    R: 2, N: 2, B: 2, A: 2, C: 2, P: 5, K: 1,
  }

  const blackPool = computed(() => {
    const chars = ['r', 'n', 'c', 'a', 'b', 'p'] 
    return chars.map(char => ({
        char,
        name: getPieceNameFromChar(char),
        count: unrevealedPieceCounts?.value?.[char] || 0,
        max: INITIAL_PIECE_COUNTS[char]
    }))
  })

  const redPool = computed(() => {
    const chars = ['R', 'N', 'C', 'A', 'B', 'P']
    return chars.map(char => ({
        char,
        name: getPieceNameFromChar(char),
        count: unrevealedPieceCounts?.value?.[char] || 0,
        max: INITIAL_PIECE_COUNTS[char]
    }))
  })

  function getPieceImageUrl(pieceName: string): string {
    return new URL(`../assets/${pieceName}.svg`, import.meta.url).href
  }

  const userCircles = ref<
    Array<{ x: number; y: number; radius: number; row: number; col: number }>
  >([])
  const userArrows = ref<
    Array<{
      x1: number
      y1: number
      x2: number
      y2: number
      fromRow: number
      fromCol: number
      toRow: number
      toCol: number
    }>
  >([])
  const isDrawing = ref(false)
  const drawingStart = ref<{ x: number; y: number } | null>(null)
  const drawingStartRC = ref<{ row: number; col: number } | null>(null)
  const {
    bestMove,
    isThinking,
    multiPvMoves,
    isPondering,
    isInfinitePondering,
    ponderMove,
    ponderhit,
  } = es

  const isCurrentPositionInCheck = gs.isCurrentPositionInCheck

  const validMovesForSelectedPiece = computed(() => {
    return gs.getValidMovesForSelectedPiece.value
  })

  const isRedOnTop = computed(() => {
    try {
      return !!gs?.isBoardFlipped?.value
    } catch {
      return false
    }
  })

  const isAndroid = computed(() => {
    return isAndroidPlatform()
  })

  const checkedKingId = computed(() => {
    if (isCurrentPositionInCheck('red')) {
      const king = gs.pieces.value.find(
        (p: Piece) => p.isKnown && p.name === 'red_king'
      )
      return king ? king.id : null
    }
    if (isCurrentPositionInCheck('black')) {
      const king = gs.pieces.value.find(
        (p: Piece) => p.isKnown && p.name === 'black_king'
      )
      return king ? king.id : null
    }
    return null
  })

  const percentFromRC = (row: number, col: number) => ({
    x: OX + (col / (COLS - 1)) * GX,
    y: OY + (row / (ROWS - 1)) * GY,
  })

  const percentToSvgCoords = (row: number, col: number) => ({
    x: (OX + (col / (COLS - 1)) * GX) * 0.9,
    y: OY + (row / (ROWS - 1)) * GY,
  })

  const img = (p: Piece) =>
    new URL(
      `../assets/${p.isKnown ? p.name : 'dark_piece'}.svg`,
      import.meta.url
    ).href

  const rcStyle = (r: number, c: number, zIndex?: number) => {
    const { x, y } = percentFromRC(r, c)
    return {
      top: `${y}%`,
      left: `${x}%`,
      width: '12%',
      transform: 'translate(-50%,-50%)',
      ...(zIndex !== undefined && { zIndex: zIndex }),
    }
  }

  const rankLabelStyle = (index: number) => {
    const { y } = percentFromRC(index, 0)
    return { top: `${y}%`, transform: 'translateY(-50%)' }
  }

  const fileLabelStyle = (index: number) => {
    const { x } = percentFromRC(0, index)
    return { left: `${x}%`, transform: 'translateX(-50%)' }
  }

  const showClearHistoryDialog = ref(false)
  const pendingMove = ref<{ piece: Piece; row: number; col: number } | null>(
    null
  )

  const boardClick = (e: MouseEvent) => {
    if (isMatchRunning.value) {
      return
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const xp = ((e.clientX - rect.left) / rect.width) * 100,
      yp = ((e.clientY - rect.top) / rect.height) * 100
    const col = Math.round(((xp - OX) / GX) * (COLS - 1))
    const row = Math.round(((yp - OY) / GY) * (ROWS - 1))
    const result = handleBoardClick(
      Math.max(0, Math.min(ROWS - 1, row)),
      Math.max(0, Math.min(COLS - 1, col))
    )
    if (result && result.requireClearHistoryConfirm) {
      pendingMove.value = result.move
      showClearHistoryDialog.value = true
    }
  }

  const snapPercentToRC = (xp: number, yp: number) => {
    const colFloat = ((xp - OX) / GX) * (COLS - 1)
    const rowFloat = ((yp - OY) / GY) * (ROWS - 1)
    const col = Math.max(0, Math.min(COLS - 1, Math.round(colFloat)))
    const row = Math.max(0, Math.min(ROWS - 1, Math.round(rowFloat)))
    return { row, col }
  }

  const handleRightMouseDown = (e: MouseEvent) => {
    e.preventDefault()
    if (isMatchRunning.value) return

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const xp = ((e.clientX - rect.left) / rect.width) * 100
    const yp = ((e.clientY - rect.top) / rect.height) * 100

    const { row, col } = snapPercentToRC(xp, yp)
    const snapped = percentFromRC(row, col)
    drawingStart.value = { x: snapped.x, y: snapped.y }
    drawingStartRC.value = { row, col }
    isDrawing.value = true
  }

  const handleRightMouseUp = (e: MouseEvent) => {
    if (!isDrawing.value || !drawingStart.value) return

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const xp = ((e.clientX - rect.left) / rect.width) * 100
    const yp = ((e.clientY - rect.top) / rect.height) * 100
    const { row, col } = snapPercentToRC(xp, yp)
    const endCenter = percentFromRC(row, col)

    const svgX = drawingStart.value.x * 0.9
    const svgY = drawingStart.value.y
    const endSvgX = endCenter.x * 0.9
    const endSvgY = endCenter.y

    if (
      drawingStartRC.value &&
      (row !== drawingStartRC.value.row || col !== drawingStartRC.value.col)
    ) {
      const fromRow = drawingStartRC.value.row
      const fromCol = drawingStartRC.value.col
      const toRow = row
      const toCol = col

      const existingIdx = userArrows.value.findIndex(
        a =>
          a.fromRow === fromRow &&
          a.fromCol === fromCol &&
          a.toRow === toRow &&
          a.toCol === toCol
      )

      if (existingIdx >= 0) {
        userArrows.value.splice(existingIdx, 1)
      } else {
        userArrows.value.push({
          x1: svgX,
          y1: svgY,
          x2: endSvgX,
          y2: endSvgY,
          fromRow,
          fromCol,
          toRow,
          toCol,
        })
      }
    } else {
      const cellW = GX / (COLS - 1)
      const cellH = GY / (ROWS - 1)
      const radiusSvg = Math.max(
        3,
        Math.min(8, Math.min(0.9 * cellW, cellH) * 0.5)
      )

      const cRow = drawingStartRC.value?.row ?? 0
      const cCol = drawingStartRC.value?.col ?? 0
      const existingIdx = userCircles.value.findIndex(
        c => c.row === cRow && c.col === cCol
      )

      if (existingIdx >= 0) {
        userCircles.value.splice(existingIdx, 1)
      } else {
        userCircles.value.push({
          x: svgX,
          y: svgY,
          radius: radiusSvg,
          row: cRow,
          col: cCol,
        })
      }
    }

    isDrawing.value = false
    drawingStart.value = null
    drawingStartRC.value = null
  }

  const clearUserDrawings = () => {
    userCircles.value = []
    userArrows.value = []
  }

  if (gs) {
    gs.clearUserArrows = clearUserDrawings
  }

  const flipUserDrawings = () => {
    userCircles.value = userCircles.value.map(circle => {
      const flippedRow = 9 - circle.row
      const flippedCol = 8 - circle.col
      const { x, y } = percentToSvgCoords(flippedRow, flippedCol)
      return {
        ...circle,
        row: flippedRow,
        col: flippedCol,
        x,
        y,
      }
    })

    userArrows.value = userArrows.value.map(arrow => {
      const flippedFromRow = 9 - arrow.fromRow
      const flippedFromCol = 8 - arrow.fromCol
      const flippedToRow = 9 - arrow.toRow
      const flippedToCol = 8 - arrow.toCol
      const { x: x1, y: y1 } = percentToSvgCoords(
        flippedFromRow,
        flippedFromCol
      )
      const { x: x2, y: y2 } = percentToSvgCoords(flippedToRow, flippedToCol)
      return {
        ...arrow,
        fromRow: flippedFromRow,
        fromCol: flippedFromCol,
        toRow: flippedToRow,
        toCol: flippedToCol,
        x1,
        y1,
        x2,
        y2,
      }
    })
  }

  const handleForceStopAi = (e: CustomEvent) => {
    try {
      const reason = (e as any)?.detail?.reason
      if (reason === 'new-game') {
        clearUserDrawings()
        selectedPvMove.value = null
      }
    } catch {}
  }

  const handleHighlightMultipv = (e: CustomEvent) => {
    try {
      const uci = (e as any)?.detail?.uci as string
      if (!uci || uci.length < 4) return
      selectedPvMove.value = uci
    } catch (error) {
      console.warn('Failed to highlight multipv move:', error)
    }
  }

  const handleClearDrawingsEvent = () => {
    clearUserDrawings()
  }

  onMounted(() => {
    window.addEventListener('force-stop-ai', handleForceStopAi as EventListener)
    window.addEventListener(
      'highlight-multipv',
      handleHighlightMultipv as EventListener
    )
    window.addEventListener('clear-drawings', handleClearDrawingsEvent)
  })
  onUnmounted(() => {
    window.removeEventListener(
      'force-stop-ai',
      handleForceStopAi as EventListener
    )
    window.removeEventListener(
      'highlight-multipv',
      handleHighlightMultipv as EventListener
    )
    window.removeEventListener('clear-drawings', handleClearDrawingsEvent)
  })

  try {
    const provider = () =>
      userArrows.value.map(a => ({
        fromRow: a.fromRow,
        fromCol: a.fromCol,
        toRow: a.toRow,
        toCol: a.toCol,
      }))
    gs?.registerUserArrowProvider?.(provider)
  } catch {}

  try {
    gs?.registerUserDrawingsFlipFunction?.(flipUserDrawings)
  } catch {}

  const onConfirmClearHistory = () => {
    if (pendingMove.value) {
      gs.clearHistoryAndMove(
        pendingMove.value.piece,
        pendingMove.value.row,
        pendingMove.value.col
      )
    }
    showClearHistoryDialog.value = false
    pendingMove.value = null
  }
  const onCancelClearHistory = () => {
    showClearHistoryDialog.value = false
    pendingMove.value = null
  }

  /* ===== Arrow ===== */
  interface Arrow {
    x1: number
    y1: number
    x2: number
    y2: number
    pv: number
  }
  const arrs = ref<Arrow[]>([])
  const selectedPvMove = ref<string | null>(null)

  const uciToDisplayRC = (uci: string) => {
    if (uci.length < 4)
      return { from: { row: 0, col: 0 }, to: { row: 0, col: 0 } }

    const fromCol = uci.charCodeAt(0) - 'a'.charCodeAt(0)
    const fromRow = 9 - +uci[1]
    const toCol = uci.charCodeAt(2) - 'a'.charCodeAt(0)
    const toRow = 9 - +uci[3]

    if (!gs.isBoardFlipped.value) {
      return {
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
      }
    } else {
      return {
        from: { row: 9 - fromRow, col: 8 - fromCol },
        to: { row: 9 - toRow, col: 8 - toCol },
      }
    }
  }

  const parseJaiAnalysisInfoForPV = (analysisInfo: string): string[][] => {
    if (!analysisInfo) return []

    const pvMoves: string[][] = []
    const lines = analysisInfo
      .split('\n')
      .filter(line => line.trim().length > 0)

    lines.forEach(line => {
      const pvIndex = line.indexOf(' pv ')
      if (pvIndex !== -1) {
        const pvString = line.slice(pvIndex + 4).trim()
        const moves = pvString.split(/\s+/).filter(move => move.length >= 4)

        if (moves.length > 0) {
          pvMoves.push(moves)
        }
      }
    })

    return pvMoves
  }

  const updateArrow = () => {
    const isMatchMode = (window as any).__MATCH_MODE__ || false
    const jaiAnalysisInfo = jaiEngine?.analysisInfo?.value || ''

    const isHumanVsAiMode = (window as any).__HUMAN_VS_AI_MODE__ || false
    if (isHumanVsAiMode) {
      arrs.value = []
      return
    }

    if (isMatchMode && isMatchRunning.value && jaiAnalysisInfo) {
      const jaiPvMoves = parseJaiAnalysisInfoForPV(jaiAnalysisInfo)
      if (jaiPvMoves.length > 0) {
        const arrows: Arrow[] = []
        jaiPvMoves.forEach((moves: string[], idx: number) => {
          if (!moves || !moves.length) return
          const mv = moves[0]
          if (mv && mv.length >= 4) {
            const coords = uciToDisplayRC(mv)
            const f = percentToSvgCoords(coords.from.row, coords.from.col),
              t = percentToSvgCoords(coords.to.row, coords.to.col)
            arrows.push({ x1: f.x, y1: f.y, x2: t.x, y2: t.y, pv: idx + 1 })
          }
        })
        arrs.value = arrows
        return
      }
    }

    if (
      isPondering.value &&
      !isInfinitePondering.value &&
      !ponderhit.value &&
      ponderMove.value
    ) {
      const mv = ponderMove.value
      if (mv && mv.length >= 4) {
        const coords = uciToDisplayRC(mv)
        const f = percentToSvgCoords(coords.from.row, coords.from.col),
          t = percentToSvgCoords(coords.to.row, coords.to.col)
        arrs.value = [{ x1: f.x, y1: f.y, x2: t.x, y2: t.y, pv: 1 }]
        return
      }
    }

    if (
      (isThinking.value || (isPondering.value && isInfinitePondering.value)) &&
      multiPvMoves.value.length
    ) {
      const arrows: Arrow[] = []
      multiPvMoves.value.forEach((moves: string[], idx: number) => {
        if (!moves || !moves.length) return
        const mv = moves[0]
        if (mv && mv.length >= 4) {
          const coords = uciToDisplayRC(mv)
          const f = percentToSvgCoords(coords.from.row, coords.from.col),
            t = percentToSvgCoords(coords.to.row, coords.to.col)
          arrows.push({ x1: f.x, y1: f.y, x2: t.x, y2: t.y, pv: idx + 1 })
        }
      })
      arrs.value = arrows
      return
    }

    if (!isThinking.value && !isPondering.value && bestMove.value) {
      const mv = bestMove.value
      if (mv.length >= 4) {
        const coords = uciToDisplayRC(mv)
        const f = percentToSvgCoords(coords.from.row, coords.from.col),
          t = percentToSvgCoords(coords.to.row, coords.to.col)
        arrs.value = [{ x1: f.x, y1: f.y, x2: t.x, y2: t.y, pv: 1 }]
        return
      }
    }
    arrs.value = []
  }

  watchEffect(() => {
    void isThinking.value
    void isPondering.value
    void isInfinitePondering.value
    void ponderMove.value
    void ponderhit.value
    void multiPvMoves.value.map((m: string[]) => m.join(','))
    void jaiEngine?.analysisInfo?.value
    void (window as any).__MATCH_MODE__
    void isMatchRunning.value
    updateArrow()
  })

  watch(() => gs.isBoardFlipped.value, updateArrow)

  registerArrowClearCallback(() => {
    arrs.value = []
    selectedPvMove.value = null
  })

  const arrowColors = [
    '#0066cc',
    '#e53935',
    '#43a047',
    '#ffb300',
    '#8e24aa',
    '#00897b',
  ]
  const arrowColor = (idx: number) => arrowColors[idx % arrowColors.length]

  const selectedPvArrow = computed(() => {
    if (!selectedPvMove.value) return null
    const coords = uciToDisplayRC(selectedPvMove.value)
    const f = percentToSvgCoords(coords.from.row, coords.from.col)
    const t = percentToSvgCoords(coords.to.row, coords.to.col)

    const exists = arrs.value.some(
      a =>
        Math.abs(a.x1 - f.x) < 0.0001 &&
        Math.abs(a.y1 - f.y) < 0.0001 &&
        Math.abs(a.x2 - t.x) < 0.0001 &&
        Math.abs(a.y2 - t.y) < 0.0001
    )
    return exists
      ? {
          x1: f.x,
          y1: f.y,
          x2: t.x,
          y2: t.y,
        }
      : null
  })

  const displayRow = (r: number) => (gs.isBoardFlipped.value ? 9 - r : r)
  const displayCol = (c: number) => (gs.isBoardFlipped.value ? 8 - c : c)

  const getAnnotationClass = (_positions: any) => {
    const currentAnnotation = getCurrentMoveAnnotation()
    if (!currentAnnotation) return ''

    switch (currentAnnotation) {
      case '!!':
        return 'annot-brilliant'
      case '!':
        return 'annot-good'
      case '!?':
        return 'annot-interesting'
      case '?!':
        return 'annot-dubious'
      case '?':
        return 'annot-mistake'
      case '??':
        return 'annot-blunder'
      default:
        return ''
    }
  }

  const getCurrentMoveAnnotation = () => {
    try {
      if (gs?.pendingFlip?.value) return null
    } catch {}
    if (
      currentMoveIndex.value <= 0 ||
      currentMoveIndex.value > history.value.length
    ) {
      return null
    }
    const moveEntry = history.value[currentMoveIndex.value - 1]
    return moveEntry?.annotation || null
  }

  /* ===== Evaluation Bar ===== */
  const extractCpFromInfoLine = (line: string): number | null => {
    if (!line) return null
    const m = line.match(/score\s+(cp|mate)\s+(-?\d+)/)
    if (!m) return null
    const type = m[1]
    const val = parseInt(m[2])
    if (Number.isNaN(val)) return null
    if (type === 'mate') {
      const ply = Math.abs(val)
      const sign = val >= 0 ? 1 : -1
      return sign * (MATE_SCORE_BASE - ply)
    }
    return val
  }

  const lastAnalysisInfo = ref<string>('')
  const lastJaiAnalysisInfo = ref<string>('')
  const lastEvalCp = ref<number | null>(null)
  const lastAnalysisSideToMove = ref<string | null>(null)

  const currentEvalCp = computed<number | null>(() => {
    const isMatchMode = (window as any).__MATCH_MODE__ || false
    const jaiInfo: string | undefined = jaiEngine?.analysisInfo?.value

    if (isMatchMode && jaiInfo) {
      if (jaiInfo !== lastJaiAnalysisInfo.value) {
        lastJaiAnalysisInfo.value = jaiInfo

        const lines = jaiInfo
          .split('\n')
          .map(l => l.trim())
          .filter(Boolean)
        for (let i = lines.length - 1; i >= 0; i--) {
          const cp = extractCpFromInfoLine(lines[i])
          if (cp !== null) {
            let val = cp
            if (isPondering.value && !isInfinitePondering.value) val = -val

            try {
              lastAnalysisSideToMove.value = gs?.sideToMove?.value || null
            } catch {}

            if (lastAnalysisSideToMove.value === 'black') {
              val = -val
            }

            lastEvalCp.value = val
            return val
          }
        }
      } else {
        return lastEvalCp.value
      }
    }

    const analysis: string | undefined = (es as any)?.analysis?.value
    if (analysis) {
      if (analysis !== lastAnalysisInfo.value) {
        lastAnalysisInfo.value = analysis

        const lines = analysis
          .split('\n')
          .map((l: string) => l.trim())
          .filter(Boolean)
        for (let i = lines.length - 1; i >= 0; i--) {
          const cp = extractCpFromInfoLine(lines[i])
          if (cp !== null) {
            let val = cp
            if (isPondering.value && !isInfinitePondering.value) val = -val

            try {
              lastAnalysisSideToMove.value = gs?.sideToMove?.value || null
            } catch {}

            if (lastAnalysisSideToMove.value === 'black') {
              val = -val
            }

            lastEvalCp.value = val
            return val
          }
        }
      } else {
        return lastEvalCp.value
      }
    }

    lastAnalysisInfo.value = ''
    lastJaiAnalysisInfo.value = ''
    lastEvalCp.value = null
    lastAnalysisSideToMove.value = null
    return null
  })

  const currentEvalPercent = computed<number | null>(() => {
    let cp = currentEvalCp.value
    if (cp === null || cp === undefined) return null
    const m = Math.tanh(cp / 600)
    const redPct = Math.max(0, Math.min(100, Math.round((m + 1) * 50)))
    const topPct = isRedOnTop.value ? redPct : 100 - redPct
    return topPct
  })
</script>

<style scoped lang="scss">
  /* --- HIỆU ỨNG 4 GÓC (BRACKET) --- */
  .selection-mark {
    position: absolute;
    width: 12%; 
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
    pointer-events: none;
    z-index: 30;
  }

  .corner {
    position: absolute;
    width: 20%; 
    height: 20%;
    border-style: solid;
    border-color: #007bff; /* Màu xanh dương */
    border-width: 2px;
  }

  .top-left { top: 0; left: 0; border-right: none; border-bottom: none; }
  .top-right { top: 0; right: 0; border-left: none; border-bottom: none; }
  .bottom-left { bottom: 0; left: 0; border-right: none; border-top: none; }
  .bottom-right { bottom: 0; right: 0; border-left: none; border-top: none; }

  /* --- CÁC STYLE KHÁC GIỮ NGUYÊN --- */
  .chessboard-wrapper {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    justify-content: center;
    gap: 1.5%; 
    width: 100%;
    max-width: 95vmin; 
    margin: 0 auto;

    &.has-chart {
      flex-wrap: wrap;
    }

    @media (max-width: 768px) {
      flex-direction: column;
      gap: 12px;
    }
  }

  .chessboard-container {
    position: relative;
    flex: 0 0 84%; 
    aspect-ratio: 9/10;
    margin: auto;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;

    @media (max-width: 768px) {
      width: 100%;
      flex: none;
    }
  }

  /* --- SIDE PANEL --- */
  .side-panel {
    flex: 1; 
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    padding: 0.5%;
    align-self: stretch; 
    min-width: 70px; 
  }

  .pool-section {
    display: flex;
    flex-direction: column;
    gap: 2%;
    flex: 0 0 auto; 
    justify-content: flex-start;
  }

  .pool-row {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 4px 2px;
    position: relative;
    gap: 4px;
  }

  .pool-img {
    width: 40px; 
    height:40px;
    object-fit: contain;
  }

  .pool-controls {
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: flex-start;
    gap: 2px;
    width: auto;
  }

  .pool-num {
    font-size: 1.4rem; 
    font-weight: normal; 
    color: #fff;
    text-align: right;
    min-width: auto;
    line-height: 1;
    margin-right: 4px;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
  }
  
  .red-num {
    color: #ff5252;
  }

  .black-num {
    color: #000000;
    text-shadow: 0 0 1px #fff;
  }

  .pool-btns {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tiny-btn {
    width: 16px;
    height: 14px;
    line-height: 12px;
    font-size: 12px;
    font-weight: bold;
    background: #555;
    color: #fff;
    border: 1px solid rgba(255,255,255,0.2);
    border-radius: 3px;
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
    min-height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pool-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    background: #ffffff; 
    border: 1px solid #d32f2f; 
    border-radius: 4px;
    padding: 6px 4px;
    color: #d32f2f; 
    font-weight: bold; 
    font-size: 11px;
    text-align: center;
    word-break: break-word;
    max-width: 95%;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2); 
  }

  @media (max-width: 768px) {
    .side-panel {
      width: 100%;
      height: auto;
      flex-direction: row; 
      align-items: center;
      padding: 8px;
    }

    .pool-section {
      flex-direction: row; 
      flex-wrap: wrap;
      gap: 4px;
    }
    
    .pool-divider {
      width: 20px;
      height: auto;
    }

    .pool-row {
      flex-direction: column; 
      width: 40px;
      padding: 2px;
    }
    
    .pool-img {
      width: 100%;
    }
    
    .pool-controls {
      width: 100%;
      flex-direction: column-reverse;
    }
    
    .pool-btns {
      display: none; 
    }
  }

  .eval-bar {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -12px;
    width: 8px;
    border-radius: 4px;
    overflow: hidden;
    background: #ddd;
    box-shadow: 0 0 2px rgba(0, 0, 0, 0.2);
    z-index: 5;
    pointer-events: none;

    @media (max-width: 768px) {
      left: -10px;
      width: 6px;
    }
  }
  .eval-top {
    width: 100%;
    background: #e53935;
    transition: height 0.15s ease;
    pointer-events: none;
  }
  .eval-bottom {
    width: 100%;
    background: #333;
    transition: height 0.15s ease;
    pointer-events: none;
  }
  .eval-marker {
    position: absolute;
    left: -3px;
    right: -3px;
    height: 2px;
    background: #ffffff;
    opacity: 0.9;
    pointer-events: none;
  }

  .bg {
    width: 100%;
    height: 100%;
    display: block;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  .pieces {
    position: absolute;
    inset: 0;
    z-index: 20;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  .piece {
    position: absolute;
    aspect-ratio: 1;
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    &.animated {
      transition: all 0.2s ease;
    }

    &.inCheck {
      transform: translate(-50%, -50%) scale(1.13);
      filter: drop-shadow(0 0 0 #f00) drop-shadow(0 0 16px #ff2222)
        drop-shadow(0 0 32px #ff2222);
      z-index: 1100;
    }
  }

  .ar {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 30;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }

  .user-drawings {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 35;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  .al {
    stroke-width: 1;
    stroke-opacity: 0.9;
  }

  .selected-arrow-shadow {
    stroke: #e53935;
    stroke-width: 1.6;
    stroke-opacity: 0.22;
    filter: drop-shadow(0 0 4px #ff2222) drop-shadow(0 0 8px #ff2222);
  }

  .selected-arrow {
    stroke: #e53935;
    stroke-width: 1;
    stroke-opacity: 0.95;
    filter: drop-shadow(0 0 4px #ff2222) drop-shadow(0 0 8px #ff2222);
  }

  .last-move-highlights {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 10;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  .highlight {
    position: absolute;
    width: 12%;
    aspect-ratio: 1;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  .highlight.from {
    border: 3px solid #ff6b6b;
    background: rgba(255, 107, 107, 0.2);
  }

  .highlight.from.annot-brilliant {
    background: rgba(0, 102, 204, 0.2);
  }
  .highlight.from.annot-good {
    background: rgba(0, 188, 212, 0.2);
  }
  .highlight.from.annot-interesting {
    background: rgba(139, 195, 74, 0.2);
  }
  .highlight.from.annot-dubious {
    background: rgba(255, 152, 0, 0.2);
  }
  .highlight.from.annot-mistake {
    background: rgba(255, 87, 34, 0.2);
  }
  .highlight.from.annot-blunder {
    background: rgba(244, 67, 54, 0.2);
  }
  .highlight.to {
    border: 3px solid #4ecdc4;
    background: rgba(78, 205, 196, 0.2);
    position: relative;
  }

  .annotation-badge {
    position: absolute;
    top: -12px;
    right: -12px;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: bold;
    color: white;
    border: 2px solid white;
  }

  .annot-brilliant {
    border-color: #0066cc !important;
  }
  .annot-brilliant .annotation-badge {
    background: #0066cc;
  }

  .annot-good {
    border-color: #00bcd4 !important;
  }
  .annot-good .annotation-badge {
    background: #00bcd4;
  }

  .annot-interesting {
    border-color: #8bc34a !important;
  }
  .annot-interesting .annotation-badge {
    background: #8bc34a;
  }

  .annot-dubious {
    border-color: #ff9800 !important;
  }
  .annot-dubious .annotation-badge {
    background: #ff9800;
  }

  .annot-mistake {
    border-color: #ff5722 !important;
  }
  .annot-mistake .annotation-badge {
    background: #ff5722;
  }

  .annot-blunder {
    border-color: #f44336 !important;
  }
  .annot-blunder .annotation-badge {
    background: #f44336;
  }

  .annotation-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 3000;
  }
  .annotation-anchor {
    position: absolute;
    width: 12%;
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
  }

  .valid-moves-indicators {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 15;
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  .valid-move-dot {
    position: absolute;
    width: 8%;
    aspect-ratio: 1;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: rgba(76, 175, 80, 0.6);
    border: 2px solid #4caf50;
    box-shadow: 0 0 8px rgba(76, 175, 80, 0.4);
    user-select: none;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }

  .arrow-label {
    fill: #0066cc;
    font-size: 3px;
    font-weight: bold;
    pointer-events: none;
    user-select: none;
  }

  .board-labels {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: visible;

    .rank-labels,
    .file-labels {
      span {
        position: absolute;
        color: #666;
        font-size: 14px;
        font-weight: bold;
        user-select: none;
      }
    }

    .rank-labels span {
      right: -10px;
    }

    .file-labels span {
      bottom: -17px;
    }
  }
</style>