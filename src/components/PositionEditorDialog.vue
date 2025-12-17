<template>
  <v-dialog
    v-model="isVisible"
    persistent
    max-width="900px"
    :fullscreen="$vuetify.display.smAndDown"
  >
    <v-card class="position-editor-card">
      <v-card-title class="d-flex align-center py-2 px-4 bg-surface-variant">
        <v-icon icon="mdi-chessboard" class="mr-2"></v-icon>
        <span class="text-h6">{{ $t('positionEditor.title') }}</span>
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" variant="text" density="compact" @click="cancelEdit"></v-btn>
      </v-card-title>

      <v-card-text class="pa-0">
        <v-container fluid class="pa-2 position-editor-container">
          <v-row no-gutters class="mb-2">
            <v-col cols="12">
              <v-sheet class="d-flex gap-2 flex-wrap action-buttons pa-2 rounded border">
                <v-btn
                  @click="flipBoard"
                  color="primary"
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-flip-vertical"
                >
                  {{ $t('positionEditor.flipBoard') }}
                </v-btn>
                <v-btn
                  @click="mirrorLeftRight"
                  color="primary"
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-flip-horizontal"
                >
                  {{ $t('positionEditor.mirrorLeftRight') }}
                </v-btn>
                <v-btn
                  @click="switchSide"
                  color="secondary"
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-swap-horizontal"
                >
                  {{ $t('positionEditor.switchSide') }}
                </v-btn>
                <v-btn
                  @click="resetOrClearPosition"
                  color="warning"
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-refresh"
                >
                  {{
                    isInitialPosition
                      ? $t('positionEditor.clearPosition')
                      : $t('positionEditor.resetPosition')
                  }}
                </v-btn>
                <v-btn
                  @click="openImageRecognition"
                  color="info"
                  variant="tonal"
                  size="small"
                  prepend-icon="mdi-camera"
                  :disabled="isProcessing"
                >
                  {{ $t('positionEditor.recognizeImage') }}
                </v-btn>
              </v-sheet>
            </v-col>
          </v-row>

          <v-row no-gutters class="mb-2">
            <v-col cols="12">
              <v-sheet class="d-flex align-center justify-space-between px-3 py-1 rounded border bg-grey-lighten-4">
                <div class="d-flex align-center">
                  <span class="text-caption mr-2 font-weight-bold text-uppercase text-grey-darken-1">{{ $t('positionEditor.currentSide') }}:</span>
                  <v-chip
                    :color="editingSideToMove === 'red' ? 'red-darken-1' : 'grey-darken-4'"
                    variant="flat"
                    size="small"
                    class="font-weight-bold px-3"
                  >
                    {{
                      editingSideToMove === 'red'
                        ? $t('positionEditor.redToMove')
                        : $t('positionEditor.blackToMove')
                    }}
                  </v-chip>
                </div>
                <v-switch
                  v-model="preserveDarkPools"
                  :label="$t('positionEditor.preserveDarkPools')"
                  color="primary"
                  density="compact"
                  hide-details
                  class="ml-4"
                ></v-switch>
              </v-sheet>
            </v-col>
          </v-row>

          <v-expand-transition>
            <v-row v-if="showImageRecognition" class="mb-2">
              <v-col cols="12">
                <v-card variant="outlined" class="mb-2">
                  <v-card-title class="text-subtitle-2 bg-grey-lighten-3 py-1 px-3">
                    {{ $t('positionEditor.imageRecognition') }}
                    <v-spacer></v-spacer>
                    <v-btn icon="mdi-close" size="x-small" variant="text" @click="closeImageRecognition"></v-btn>
                  </v-card-title>
                  <v-card-text class="pa-2">
                    <div class="image-recognition-container">
                      <div
                        class="upload-area"
                        :class="{ 'drag-over': isDragOver }"
                        @dragover.prevent
                        @dragleave.prevent="isDragOver = false"
                        @drop.prevent="handleDrop"
                        @click="triggerFileInput"
                      >
                        <input
                          ref="fileInputRef"
                          type="file"
                          accept="image/*"
                          @change="handleFileSelect"
                          style="display: none"
                        />
                        <div v-if="!inputImage" class="upload-placeholder">
                          <v-icon size="40" color="primary" class="mb-2">mdi-cloud-upload</v-icon>
                          <p class="text-body-2 font-weight-medium">{{ $t('positionEditor.clickOrDragImage') }}</p>
                        </div>
                        <div v-else class="image-preview">
                          <div class="image-stage">
                            <img
                              ref="imageDisplayRef"
                              :src="inputImage.src"
                              class="preview-image"
                              alt="Chessboard image"
                            />
                            <canvas ref="canvasRef" class="overlay-canvas"></canvas>
                          </div>
                        </div>
                      </div>

                      <div class="recognition-controls mt-2">
                        <v-alert
                          v-if="recognitionStatus"
                          :type="recognitionStatus.includes('失败') || recognitionStatus.includes('错误') ? 'error' : 'info'"
                          variant="tonal"
                          density="compact"
                          class="mb-2 text-caption"
                        >
                          {{ recognitionStatus }}
                        </v-alert>

                        <div class="d-flex gap-2 flex-wrap align-center">
                          <v-btn
                            @click="processCurrentImage"
                            color="primary"
                            size="small"
                            :disabled="!inputImage || isProcessing"
                            :loading="isProcessing"
                          >
                            {{ $t('positionEditor.startRecognition') }}
                          </v-btn>
                          <v-btn
                            @click="applyRecognitionResults"
                            color="success"
                            size="small"
                            :disabled="detectedBoxes.length === 0 || isProcessing"
                          >
                            {{ $t('positionEditor.applyResults') }}
                          </v-btn>
                          <v-btn
                            @click="clearRecognition"
                            color="error"
                            variant="outlined"
                            size="small"
                            :disabled="isProcessing"
                          >
                            {{ $t('positionEditor.clear') }}
                          </v-btn>
                          <v-checkbox
                            v-model="showBoundingBoxes"
                            :label="$t('positionEditor.showBoundingBoxes')"
                            color="primary"
                            density="compact"
                            hide-details
                            class="ml-2"
                            @change="onBoundingBoxToggle"
                          ></v-checkbox>
                        </div>
                      </div>
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </v-expand-transition>

          <v-row class="fill-height-row">
            <v-col cols="12" md="8" class="pa-1 board-col d-flex flex-column">
              <v-sheet class="position-editor-board-wrapper elevation-2 rounded">
                <div class="position-editor-board">
                  <img src="@/assets/xiangqi.png" class="board-bg" alt="board" />

                  <div class="pieces">
                    <img
                      v-for="piece in editingPieces"
                      :key="piece.id"
                      :src="getPieceImageUrl(piece.name)"
                      class="piece"
                      :class="{
                        selected: selectedPiece && selectedPiece.id === piece.id,
                      }"
                      :style="rcStyle(piece.row, piece.col)"
                      @click="selectPiece(piece)"
                    />
                  </div>

                  <div class="board-click-area" @click="handleBoardClick"></div>
                </div>
              </v-sheet>
            </v-col>

            <v-col cols="12" md="4" class="pa-1 selector-col">
              <v-card variant="outlined" class="h-100 d-flex flex-column piece-selector-card">
                
                <div v-if="selectedPiece" class="selected-piece-panel pa-3 bg-blue-lighten-5 border-b">
                  <div class="d-flex align-center gap-3">
                    <div class="selected-piece-preview elevation-2 rounded-circle bg-white">
                      <img :src="getPieceImageUrl(selectedPiece.name)" class="piece-img-large" />
                    </div>
                    <div>
                      <div class="text-subtitle-2 font-weight-bold">{{ getPieceDisplayName(selectedPiece.name) }}</div>
                      <div class="text-caption text-grey-darken-1">{{ $t('positionEditor.clickToPlace') }}</div>
                    </div>
                    <v-spacer></v-spacer>
                    <v-btn
                      @click="removePieceById(selectedPiece.id)"
                      color="error"
                      variant="text"
                      icon="mdi-delete"
                      density="comfortable"
                      :title="$t('common.delete')"
                    ></v-btn>
                  </div>
                </div>

                <div class="piece-library pa-2 flex-grow-1 overflow-y-auto">
                  
                  <div class="piece-group mb-3">
                    <div class="text-caption font-weight-bold text-red mb-1 ml-1">{{ $t('positionEditor.revealedPieces') }} ({{ $t('common.red') }})</div>
                    <div class="piece-grid">
                      <div
                        v-for="piece in redPieceOptions"
                        :key="piece.name"
                        class="piece-option red-option"
                        v-ripple
                        @click="selectPieceType(piece.name, true)"
                      >
                        <img :src="getPieceImageUrl(piece.name)" class="piece-img" />
                      </div>
                    </div>
                  </div>

                  <div class="piece-group mb-3">
                    <div class="text-caption font-weight-bold text-black mb-1 ml-1">{{ $t('positionEditor.revealedPieces') }} ({{ $t('common.black') }})</div>
                    <div class="piece-grid">
                      <div
                        v-for="piece in blackPieceOptions"
                        :key="piece.name"
                        class="piece-option black-option"
                        v-ripple
                        @click="selectPieceType(piece.name, true)"
                      >
                        <img :src="getPieceImageUrl(piece.name)" class="piece-img" />
                      </div>
                    </div>
                  </div>

                  <div class="piece-group">
                    <div class="text-caption font-weight-bold text-grey-darken-2 mb-1 ml-1">{{ $t('positionEditor.darkPieces') }}</div>
                    <div class="piece-grid">
                      <div
                        v-for="piece in unknownPieces"
                        :key="piece.name"
                        class="piece-option dark-option"
                        v-ripple
                        @click="selectPieceType(piece.name, false)"
                      >
                        <img :src="getPieceImageUrl('dark_piece')" class="piece-img" />
                        <span class="text-caption text-center mt-1">{{ piece.displayName }}</span>
                      </div>
                    </div>
                  </div>

                </div>
              </v-card>
            </v-col>
          </v-row>

          <v-row no-gutters class="mt-2">
            <v-col cols="12">
              <v-alert
                :type="validationStatus.type as 'success' | 'error'"
                variant="tonal"
                density="compact"
                class="mb-0 py-2 text-caption font-weight-medium"
              >
                <template v-slot:prepend>
                  <v-icon :icon="validationStatus.type === 'success' ? 'mdi-check-circle' : 'mdi-alert-circle'" size="small"></v-icon>
                </template>
                {{ validationStatus.message }}
              </v-alert>
            </v-col>
          </v-row>
        </v-container>
      </v-card-text>

      <v-divider></v-divider>

      <v-card-actions class="pa-2 bg-grey-lighten-5">
        <v-spacer></v-spacer>
        <v-btn color="grey-darken-1" variant="text" @click="cancelEdit">
          {{ $t('positionEditor.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          variant="flat"
          @click="applyChanges"
          class="px-4"
          :disabled="validationStatus.type !== 'success'"
        >
          {{ $t('positionEditor.applyChanges') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
  import { ref, computed, inject, watch, nextTick } from 'vue'
  import { useI18n } from 'vue-i18n'
  import MersenneTwister from 'mersenne-twister'
  import type { Piece } from '@/composables/useChessGame'
  import { START_FEN, INITIAL_PIECE_COUNTS, FEN_MAP } from '@/utils/constants'
  import {
    useImageRecognition,
    type DetectionBox,
    LABELS,
  } from '@/composables/image-recognition'

  // Create a global instance of Mersenne Twister
  const mt = new MersenneTwister()
  mt.init_seed(new Date().getTime())
  const mtRandom = (): number => mt.random()

  interface Props {
    modelValue: boolean
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'position-changed', pieces: Piece[], sideToMove: 'red' | 'black'): void
  }

  const props = defineProps<Props>()
  const emit = defineEmits<Emits>()

  const { t } = useI18n()
  const gameState: any = inject('game-state')

  // Layout constants
  const PAD_X = 11, PAD_Y = 11, COLS = 9, ROWS = 10, GX = 100 - PAD_X, GY = 100 - PAD_Y, OX = PAD_X / 2, OY = PAD_Y / 2

  const isVisible = computed({
    get: () => props.modelValue,
    set: value => emit('update:modelValue', value),
  })

  // Editing state
  const editingPieces = ref<Piece[]>([])
  const editingSideToMove = ref<'red' | 'black'>('red')
  const selectedPiece = ref<Piece | null>(null)
  const preserveDarkPools = ref(false)

  // Image recognition state
  const showImageRecognition = ref(false)
  const isDragOver = ref(false)
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const imageDisplayRef = ref<HTMLImageElement | null>(null)
  const canvasRef = ref<HTMLCanvasElement | null>(null)
  const inputImage = ref<HTMLImageElement | null>(null)
  const detectedBoxes = ref<DetectionBox[]>([])
  const boardGrid = ref<(DetectionBox | null)[][] | null>(null)

  const {
    isProcessing,
    status: recognitionStatus,
    detectedBoxes: recognitionDetectedBoxes,
    showBoundingBoxes,
    processImage,
    drawBoundingBoxes,
    updateBoardGrid,
  } = useImageRecognition()

  // Calculate row/col to percentage
  const percentFromRC = (row: number, col: number) => ({
    x: OX + (col / (COLS - 1)) * GX,
    y: OY + (row / (ROWS - 1)) * GY,
  })

  const rcStyle = (r: number, c: number) => {
    const { x, y } = percentFromRC(r, c)
    return {
      top: `${y}%`,
      left: `${x}%`,
      transform: 'translate(-50%,-50%)',
    }
  }

  // --- REFACTORED PIECE OPTIONS (Grouped) ---
  const redPieceOptions = computed(() => [
    { name: 'red_king', displayName: t('positionEditor.pieces.red_king') },
    { name: 'red_advisor', displayName: t('positionEditor.pieces.red_advisor') },
    { name: 'red_elephant', displayName: t('positionEditor.pieces.red_elephant') },
    { name: 'red_horse', displayName: t('positionEditor.pieces.red_horse') },
    { name: 'red_chariot', displayName: t('positionEditor.pieces.red_chariot') },
    { name: 'red_cannon', displayName: t('positionEditor.pieces.red_cannon') },
    { name: 'red_pawn', displayName: t('positionEditor.pieces.red_pawn') },
  ])

  const blackPieceOptions = computed(() => [
    { name: 'black_king', displayName: t('positionEditor.pieces.black_king') },
    { name: 'black_advisor', displayName: t('positionEditor.pieces.black_advisor') },
    { name: 'black_elephant', displayName: t('positionEditor.pieces.black_elephant') },
    { name: 'black_horse', displayName: t('positionEditor.pieces.black_horse') },
    { name: 'black_chariot', displayName: t('positionEditor.pieces.black_chariot') },
    { name: 'black_cannon', displayName: t('positionEditor.pieces.black_cannon') },
    { name: 'black_pawn', displayName: t('positionEditor.pieces.black_pawn') },
  ])

  const unknownPieces = computed(() => [
    { name: 'unknown', displayName: t('positionEditor.pieces.unknown') },
  ])

  // Combined for logic usage
  const knownPieces = computed(() => [...redPieceOptions.value, ...blackPieceOptions.value])

  const isInitialPosition = computed(() => {
    if (editingPieces.value.length !== 32) return false
    const initialBoard = Array(10).fill(null).map(() => Array(9).fill(null))
    const fenParts = START_FEN.split(' ')
    const boardPart = fenParts[0]

    boardPart.split('/').forEach((rowStr, rowIndex) => {
      let colIndex = 0
      for (const char of rowStr) {
        if (/\d/.test(char)) {
          colIndex += parseInt(char, 10)
        } else {
          const isRed = char.toUpperCase() === char
          if (char.toLowerCase() === 'x') {
            const tempName = isRed ? 'red_unknown' : 'black_unknown'
            initialBoard[rowIndex][colIndex] = { name: tempName, isKnown: false }
          } else {
            const pieceName = getPieceNameFromChar(char)
            initialBoard[rowIndex][colIndex] = { name: pieceName, isKnown: true }
          }
          colIndex++
        }
      }
    })

    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const currentPiece = getPieceAt(row, col)
        const initialPiece = initialBoard[row][col]
        if (!currentPiece && !initialPiece) continue
        if (!currentPiece || !initialPiece) return false
        if (currentPiece.name !== initialPiece.name) return false
        if (currentPiece.isKnown !== initialPiece.isKnown) return false
      }
    }
    return editingSideToMove.value === 'red'
  })

  watch(isVisible, visible => {
    if (visible) {
      editingPieces.value = gameState.pieces.value.map((piece: any) => ({
        ...piece,
        id: piece.id,
        isKnown: piece.isKnown,
        name: piece.isKnown ? piece.name : piece.row >= 5 ? 'red_unknown' : 'black_unknown',
        initialRole: gameState.getRoleByPosition ? gameState.getRoleByPosition(piece.row, piece.col) : piece.initialRole,
        initialRow: piece.row,
        initialCol: piece.col,
      }))
      reclassifyAllDarkPieces()
      editingSideToMove.value = gameState.sideToMove.value
      selectedPiece.value = null
      preserveDarkPools.value = false
    }
  })

  const getPieceNameFromChar = (char: string): string => {
    const isRed = char === char.toUpperCase()
    const pieceType = char.toLowerCase()
    const typeMap: { [key: string]: string } = {
      r: 'chariot', n: 'horse', b: 'elephant', a: 'advisor', k: 'king', c: 'cannon', p: 'pawn',
    }
    return `${isRed ? 'red' : 'black'}_${typeMap[pieceType]}`
  }

  const getPieceAt = (row: number, col: number): Piece | null => {
    return editingPieces.value.find(p => p.row === row && p.col === col) || null
  }

  const getDarkRowsByKings = () => {
    const topRegion = [0, 1, 2, 3, 4]
    const bottomRegion = [5, 6, 7, 8, 9]
    const redKing = editingPieces.value.find(p => p.isKnown && p.name === 'red_king')
    const blackKing = editingPieces.value.find(p => p.isKnown && p.name === 'black_king')
    let redRows = bottomRegion.slice()
    let blackRows = topRegion.slice()
    const isInTop = (row: number) => topRegion.includes(row)
    const isInBottom = (row: number) => bottomRegion.includes(row)

    if (redKing) {
      if (isInTop(redKing.row)) { redRows = topRegion.slice(); blackRows = bottomRegion.slice() }
      else if (isInBottom(redKing.row)) { redRows = bottomRegion.slice(); blackRows = topRegion.slice() }
      else if (blackKing) {
        if (isInTop(blackKing.row)) { blackRows = topRegion.slice(); redRows = bottomRegion.slice() }
        else if (isInBottom(blackKing.row)) { blackRows = bottomRegion.slice(); redRows = topRegion.slice() }
      }
    } else if (blackKing) {
      if (isInTop(blackKing.row)) { blackRows = topRegion.slice(); redRows = bottomRegion.slice() }
      else if (isInBottom(blackKing.row)) { blackRows = bottomRegion.slice(); redRows = topRegion.slice() }
    }
    return { redRows, blackRows }
  }

  const classifyUnknownByKings = (row: number): 'red_unknown' | 'black_unknown' => {
    const { redRows } = getDarkRowsByKings()
    return redRows.includes(row) ? 'red_unknown' : 'black_unknown'
  }

  const reclassifyAllDarkPieces = () => {
    const { redRows } = getDarkRowsByKings()
    editingPieces.value = editingPieces.value.map(p => {
      if (p.isKnown) return p
      const newName = redRows.includes(p.row) ? 'red_unknown' : 'black_unknown'
      if (p.name === newName) return p
      return { ...p, name: newName }
    })
  }

  const selectPiece = (piece: Piece) => { selectedPiece.value = piece }

  const selectPieceType = (pieceName: string, isKnown: boolean) => {
    selectedPiece.value = {
      id: Date.now() + mtRandom(),
      name: pieceName,
      row: -1, col: -1,
      isKnown,
      initialRole: '', initialRow: -1, initialCol: -1,
    }
  }

  const handleBoardClick = (event: MouseEvent) => {
    if (!selectedPiece.value) return
    const boardElement = event.currentTarget as HTMLElement
    const rect = boardElement.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const boardWidth = rect.width
    const boardHeight = rect.height
    const percentX = (x / boardWidth) * 100
    const percentY = (y / boardHeight) * 100
    const col = Math.round(((percentX - OX) / GX) * (COLS - 1))
    const row = Math.round(((percentY - OY) / GY) * (ROWS - 1))
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return
    placePiece(row, col)
  }

  const placePiece = (row: number, col: number) => {
    if (!selectedPiece.value) return
    const existingPiece = getPieceAt(row, col)
    if (existingPiece) return

    if (selectedPiece.value.row !== -1) {
      selectedPiece.value.row = row
      selectedPiece.value.col = col
      if (gameState.getRoleByPosition) {
        selectedPiece.value.initialRole = gameState.getRoleByPosition(row, col) || ''
      }
      selectedPiece.value.initialRow = row
      selectedPiece.value.initialCol = col
      if (!selectedPiece.value.isKnown) {
        selectedPiece.value.name = classifyUnknownByKings(row)
      }
      if (selectedPiece.value.name === 'red_king' || selectedPiece.value.name === 'black_king') {
        reclassifyAllDarkPieces()
      }
    } else {
      let finalPieceName = selectedPiece.value.name
      if (selectedPiece.value.name === 'unknown') {
        finalPieceName = classifyUnknownByKings(row)
      }
      const newPiece: Piece = {
        id: Date.now() + mtRandom(),
        name: finalPieceName,
        row, col,
        isKnown: selectedPiece.value.isKnown,
        initialRole: gameState.getRoleByPosition ? gameState.getRoleByPosition(row, col) : '',
        initialRow: row, initialCol: col,
      }
      editingPieces.value.push(newPiece)
    }
    selectedPiece.value = null
  }

  const removePieceById = (pieceId: number | string) => {
    editingPieces.value = editingPieces.value.filter(p => p.id !== pieceId)
    selectedPiece.value = null
  }

  const flipBoard = () => {
    editingPieces.value = editingPieces.value.map(piece => {
      const flippedRow = 9 - piece.row
      const flippedCol = 8 - piece.col
      return {
        ...piece,
        row: flippedRow,
        col: flippedCol,
        initialRow: 9 - piece.initialRow,
        initialCol: 8 - piece.initialCol,
        initialRole: gameState.getRoleByPosition ? gameState.getRoleByPosition(flippedRow, flippedCol) : piece.initialRole,
      }
    })
    reclassifyAllDarkPieces()
    if (gameState.toggleBoardFlip) gameState.toggleBoardFlip()
  }

  const mirrorLeftRight = () => {
    editingPieces.value = editingPieces.value.map(piece => {
      const mirroredCol = 8 - piece.col
      return {
        ...piece,
        col: mirroredCol,
        initialCol: 8 - piece.initialCol,
        initialRole: gameState.getRoleByPosition ? gameState.getRoleByPosition(piece.row, mirroredCol) : piece.initialRole,
      }
    })
    reclassifyAllDarkPieces()
  }

  const switchSide = () => { editingSideToMove.value = editingSideToMove.value === 'red' ? 'black' : 'red' }

  const resetOrClearPosition = () => {
    if (isInitialPosition.value) {
      editingPieces.value = []
      editingSideToMove.value = 'red'
    } else {
      if (gameState.loadFen) {
        gameState.loadFen(START_FEN, false)
        setTimeout(() => {
          editingPieces.value = gameState.pieces.value.map((piece: any) => ({
            ...piece,
            id: piece.id,
            isKnown: piece.isKnown,
            name: piece.isKnown ? piece.name : piece.row >= 5 ? 'red_unknown' : 'black_unknown',
          }))
          reclassifyAllDarkPieces()
          editingSideToMove.value = 'red'
        }, 0)
      }
    }
    selectedPiece.value = null
  }

  const validationStatus = computed(() => {
    try {
      const positions = editingPieces.value.map(p => `${p.row},${p.col}`)
      if (positions.length !== new Set(positions).size) return { type: 'error', message: t('positionEditor.validationStatus.duplicatePosition') }

      const redKings = editingPieces.value.filter(p => p.isKnown && p.name === 'red_king')
      const blackKings = editingPieces.value.filter(p => p.isKnown && p.name === 'black_king')

      if (redKings.length === 0) return { type: 'error', message: t('positionEditor.validationStatus.noRedKing') }
      if (blackKings.length === 0) return { type: 'error', message: t('positionEditor.validationStatus.noBlackKing') }
      if (redKings.length > 1 || blackKings.length > 1) return { type: 'error', message: t('positionEditor.validationStatus.tooManyPieces') }

      const redKing = redKings[0], blackKing = blackKings[0]
      const isInRedPalace = (r: number, c: number) => r >= 7 && r <= 9 && c >= 3 && c <= 5
      const isInBlackPalace = (r: number, c: number) => r >= 0 && r <= 2 && c >= 3 && c <= 5

      const redKingInWrongPalace = !isInRedPalace(redKing.row, redKing.col) && isInBlackPalace(redKing.row, redKing.col)
      const blackKingInWrongPalace = !isInBlackPalace(blackKing.row, blackKing.col) && isInRedPalace(blackKing.row, blackKing.col)

      if (!isInRedPalace(redKing.row, redKing.col) && !redKingInWrongPalace) return { type: 'error', message: t('positionEditor.validationStatus.kingOutOfPalace') }
      if (!isInBlackPalace(blackKing.row, blackKing.col) && !blackKingInWrongPalace) return { type: 'error', message: t('positionEditor.validationStatus.kingOutOfPalace') }

      if (redKing.col === blackKing.col) {
        const minRow = Math.min(redKing.row, blackKing.row), maxRow = Math.max(redKing.row, blackKing.row)
        const piecesBetween = editingPieces.value.filter(p => p.col === redKing.col && p.row > minRow && p.row < maxRow)
        if (piecesBetween.length === 0) return { type: 'error', message: t('positionEditor.validationStatus.kingFacing') }
      }

      const pieceCounts: { [key: string]: number } = {}
      editingPieces.value.forEach(piece => {
        if (piece.isKnown) {
          const char = FEN_MAP[piece.name]
          if (char) pieceCounts[char] = (pieceCounts[char] || 0) + 1
        }
      })
      for (const [char, count] of Object.entries(pieceCounts)) {
        if (count > INITIAL_PIECE_COUNTS[char]) return { type: 'error', message: t('positionEditor.validationStatus.tooManyPieces') }
      }

      const redPieces = editingPieces.value.filter(p => p.name.startsWith('red'))
      const blackPieces = editingPieces.value.filter(p => p.name.startsWith('black'))
      if (redPieces.length > 16 || blackPieces.length > 16) return { type: 'error', message: t('positionEditor.validationStatus.tooManyTotalPieces') }

      const darkPieces = editingPieces.value.filter(p => !p.isKnown)
      const { redRows, blackRows } = getDarkRowsByKings()
      for (const piece of darkPieces) {
        const validRows = piece.name.startsWith('red') ? redRows : blackRows
        if (!validRows.includes(piece.row)) return { type: 'error', message: t('positionEditor.validationStatus.darkPieceInvalidPosition') }
      }

      const originalPieces = gameState.pieces.value
      try {
        gameState.pieces.value = editingPieces.value
        const currentKing = editingSideToMove.value === 'red' ? 'black' : 'red'
        if (gameState.isCurrentPositionInCheck && gameState.isCurrentPositionInCheck(currentKing)) {
          return { type: 'error', message: t('positionEditor.validationStatus.inCheck') }
        }
      } finally {
        gameState.pieces.value = originalPieces
      }

      return { type: 'success', message: t('positionEditor.validationStatus.normal') }
    } catch (error) {
      return { type: 'error', message: t('positionEditor.validationStatus.error') }
    }
  })

  // --- FIX: USE PNG IMAGES ---
  const getPieceImageUrl = (pieceName: string): string => {
    const imageName = (pieceName === 'red_unknown' || pieceName === 'black_unknown' || pieceName === 'unknown') ? 'dark_piece' : pieceName
    return new URL(`../assets/${imageName}.png`, import.meta.url).href
  }

  const getPieceDisplayName = (pieceName: string): string => {
    const knownPiece = knownPieces.value.find((p: any) => p.name === pieceName)
    if (knownPiece) return knownPiece.displayName
    if (pieceName === 'red_unknown') return t('positionEditor.pieces.red_unknown')
    if (pieceName === 'black_unknown') return t('positionEditor.pieces.black_unknown')
    if (pieceName === 'unknown') return t('positionEditor.pieces.unknown')
    return pieceName
  }

  const cancelEdit = () => { selectedPiece.value = null; closeImageRecognition(); isVisible.value = false }
  const openImageRecognition = () => { showImageRecognition.value = true }
  const closeImageRecognition = () => { showImageRecognition.value = false; clearRecognition() }
  const triggerFileInput = () => { fileInputRef.value?.click() }

  const handleFileSelect = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (file) loadImage(file)
  }

  const handleDrop = (event: DragEvent) => {
    isDragOver.value = false
    const files = event.dataTransfer?.files
    if (files && files[0].type.startsWith('image/')) loadImage(files[0])
  }

  window.addEventListener('paste', (e: ClipboardEvent) => {
    if (!showImageRecognition.value) return
    const item = e.clipboardData?.items[0]
    if (item?.type.startsWith('image/')) loadImage(item.getAsFile()!)
  })

  const loadImage = async (file: File) => {
    try {
      const img = new Image()
      const imageUrl = URL.createObjectURL(file)
      if (canvasRef.value) canvasRef.value.getContext('2d')?.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
      await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = reject; img.src = imageUrl })
      inputImage.value = img; detectedBoxes.value = []; boardGrid.value = null
    } catch (error) { console.error(error) }
  }

  const processCurrentImage = async () => {
    if (!inputImage.value) return
    try {
      const canvas = document.createElement('canvas')
      canvas.width = inputImage.value.naturalWidth; canvas.height = inputImage.value.naturalHeight
      canvas.getContext('2d')?.drawImage(inputImage.value, 0, 0)
      canvas.toBlob(async blob => {
        if (!blob) return
        await processImage(new File([blob], 'chessboard.jpg', { type: 'image/jpeg' }))
        await nextTick()
        detectedBoxes.value = recognitionDetectedBoxes.value
        boardGrid.value = updateBoardGrid(detectedBoxes.value)
        await nextTick()
        if (imageDisplayRef.value && canvasRef.value) drawBoundingBoxes(detectedBoxes.value, imageDisplayRef.value, canvasRef.value)
      }, 'image/jpeg')
    } catch (error) { console.error(error) }
  }

  const applyRecognitionResults = () => {
    if (!boardGrid.value) return
    editingPieces.value = []
    for (let row = 0; row < boardGrid.value.length; row++) {
      for (let col = 0; col < boardGrid.value[row].length; col++) {
        const detection = boardGrid.value[row][col]
        if (detection) {
          const pieceName = convertDetectionToPieceName(detection)
          if (pieceName) {
            editingPieces.value.push({
              id: Date.now() + mtRandom(),
              name: pieceName, row, col,
              isKnown: !pieceName.includes('unknown'),
              initialRole: '', initialRow: row, initialCol: col,
            })
          }
        }
      }
    }
    reclassifyAllDarkPieces()
  }

  const convertDetectionToPieceName = (detection: DetectionBox): string | null => {
    const label = LABELS[detection.labelIndex]; if (!label) return null
    const name = label.name
    const map: any = { r_general: 'red_king', r_advisor: 'red_advisor', r_elephant: 'red_elephant', r_horse: 'red_horse', r_chariot: 'red_chariot', r_cannon: 'red_cannon', r_soldier: 'red_pawn', b_general: 'black_king', b_advisor: 'black_advisor', b_elephant: 'black_elephant', b_horse: 'black_horse', b_chariot: 'black_chariot', b_cannon: 'black_cannon', b_soldier: 'black_pawn' }
    if (map[name]) return map[name]
    if (name.startsWith('dark_')) {
      const base = name.substring(5)
      return base.startsWith('r_') ? 'red_unknown' : 'black_unknown'
    }
    return name === 'dark' ? 'red_unknown' : null
  }

  const clearRecognition = () => {
    inputImage.value = null; detectedBoxes.value = []; boardGrid.value = null
    canvasRef.value?.getContext('2d')?.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  }

  const onBoundingBoxToggle = async () => {
    if (imageDisplayRef.value && canvasRef.value && detectedBoxes.value.length > 0) {
      await nextTick()
      drawBoundingBoxes(detectedBoxes.value, imageDisplayRef.value, canvasRef.value)
    }
  }

  const applyChanges = () => {
    if (validationStatus.value.type !== 'success') return
    const redKing = editingPieces.value.find(p => p.isKnown && p.name === 'red_king')
    const blackKing = editingPieces.value.find(p => p.isKnown && p.name === 'black_king')
    let needsAutoFlip = false
    if (redKing && blackKing) {
      const redKingTop = redKing.row < 5, blackKingBottom = blackKing.row >= 5
      if ((redKing.row > 4 && redKing.row < 7) || (blackKing.row < 5 && blackKing.row > 2) || (redKingTop && blackKingBottom)) needsAutoFlip = true
    }

    const newUnrevealedCounts: any = {}; 'RNBAKCP rnbakcp'.split('').filter(c => c !== ' ').forEach(c => newUnrevealedCounts[c] = 0)
    const knownPiecesOnBoard: any = {}, darkPiecesOnBoard = { red: 0, black: 0 }
    editingPieces.value.forEach(p => {
      if (p.isKnown) { const c = FEN_MAP[p.name]; if(c) knownPiecesOnBoard[c] = (knownPiecesOnBoard[c]||0)+1 }
      else { if(p.name.startsWith('red')) darkPiecesOnBoard.red++; else darkPiecesOnBoard.black++ }
    })
    for (const [char, max] of Object.entries(INITIAL_PIECE_COUNTS)) {
      const rem = max - (knownPiecesOnBoard[char]||0)
      if (rem > 0) newUnrevealedCounts[char] = rem
    }
    if (darkPiecesOnBoard.red === 0) 'RNBAKCP'.split('').forEach(c => newUnrevealedCounts[c] = 0)
    if (darkPiecesOnBoard.black === 0) 'rnbakcp'.split('').forEach(c => newUnrevealedCounts[c] = 0)

    gameState.pieces.value = editingPieces.value
    gameState.sideToMove.value = editingSideToMove.value
    if (needsAutoFlip && gameState.toggleBoardFlip) gameState.toggleBoardFlip()
    if (!preserveDarkPools.value && gameState.unrevealedPieceCounts) gameState.unrevealedPieceCounts.value = newUnrevealedCounts
    if (!preserveDarkPools.value && gameState.capturedUnrevealedPieceCounts) {
      const resetC: any = {}; 'RNBAKCP rnbakcp'.split('').filter(c => c !== ' ').forEach(c => resetC[c] = 0)
      gameState.capturedUnrevealedPieceCounts.value = resetC
    }
    
    if (gameState.recordAndFinalize) gameState.recordAndFinalize('adjust', `position_edit:${editingPieces.value.length}_pieces`)
    gameState.pieces.value.forEach((p: any) => p.zIndex = undefined)
    if (gameState.updateAllPieceZIndexes) gameState.updateAllPieceZIndexes()
    if (gameState.triggerArrowClear) gameState.triggerArrowClear()
    window.dispatchEvent(new CustomEvent('force-stop-ai', { detail: { reason: 'position-edit' } }))
    emit('position-changed', editingPieces.value, editingSideToMove.value)
    selectedPiece.value = null; isVisible.value = false
  }
</script>

<style lang="scss" scoped>
  .position-editor-card {
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 90vh; /* Giới hạn chiều cao */
  }

  .position-editor-container {
    height: 100%;
    overflow-y: auto;
  }

  .fill-height-row {
    min-height: 450px; /* Đảm bảo đủ chỗ cho bàn cờ */
  }

  .position-editor-board-wrapper {
    position: relative;
    width: 100%;
    max-width: 450px;
    margin: 0 auto;
    aspect-ratio: 9/10;
    overflow: hidden;
  }

  .position-editor-board {
    position: relative;
    width: 100%;
    height: 100%;
    user-select: none;
  }

  .board-bg {
    width: 100%; height: 100%; display: block;
  }

  .pieces {
    position: absolute; inset: 0; z-index: 10; pointer-events: none;
  }

  .piece {
    position: absolute; width: 11.5%; /* Tinh chỉnh kích thước */
    cursor: pointer; transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1); z-index: 10;
    pointer-events: auto;
    filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3)); /* Bóng đổ cho PNG */

    &:hover { transform: translate(-50%, -50%) scale(1.15); z-index: 30; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4)); }
    &.selected { transform: translate(-50%, -50%) scale(1.2); filter: drop-shadow(0 0 8px rgba(33, 150, 243, 0.8)); z-index: 40; }
  }

  .board-click-area {
    position: absolute; inset: 0; z-index: 5; cursor: crosshair;
  }

  /* Piece Selector Styling */
  .piece-selector-card {
    background-color: #fafafa;
  }

  .piece-library {
    /* Custom Scrollbar */
    &::-webkit-scrollbar { width: 6px; }
    &::-webkit-scrollbar-track { background: #f1f1f1; }
    &::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 3px; }
    &::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
  }

  .piece-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr); /* 7 cột cho 7 loại quân */
    gap: 4px;
  }

  .piece-option {
    aspect-ratio: 1;
    display: flex; align-items: center; justify-content: center;
    border-radius: 4px; cursor: pointer;
    background: white; border: 1px solid #e0e0e0;
    transition: all 0.1s;

    &:hover { transform: scale(1.1); z-index: 2; box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
    &:active { transform: scale(0.95); }

    .piece-img { width: 85%; height: 85%; object-fit: contain; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2)); }
  }

  .red-option:hover { border-color: #e53935; background-color: #ffebee; }
  .black-option:hover { border-color: #333; background-color: #eceff1; }
  .dark-option { 
    grid-column: span 1; 
    flex-direction: column;
    &:hover { border-color: #757575; background-color: #f5f5f5; }
  }

  .selected-piece-preview {
    width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;
    border: 1px solid #ddd;
  }
  .piece-img-large { width: 85%; height: 85%; object-fit: contain; }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .position-editor-card { max-height: 100vh; }
    .position-editor-board-wrapper { max-width: 100%; aspect-ratio: 9/10; margin-bottom: 8px; }
    .fill-height-row { min-height: auto; flex-direction: column; }
    .piece-selector-card { height: auto !important; max-height: 250px; }
    .piece-grid { grid-template-columns: repeat(7, 1fr); gap: 2px; }
    .piece-option { border-radius: 3px; }
    .action-buttons .v-btn { flex: 1 0 auto; }
  }

  /* Image Recognition Styles */
  .upload-area {
    border: 2px dashed #bdbdbd; border-radius: 8px; padding: 20px;
    text-align: center; transition: all 0.3s; cursor: pointer; min-height: 150px;
    display: flex; align-items: center; justify-content: center; background: #fafafa;
    &:hover, &.drag-over { border-color: #1976d2; background: #e3f2fd; }
  }
  .preview-image { max-width: 100%; max-height: 300px; border-radius: 4px; display: block; margin: 0 auto; }
  .image-stage { position: relative; display: inline-block; }
  .overlay-canvas { position: absolute; inset: 0; pointer-events: none; }
</style>