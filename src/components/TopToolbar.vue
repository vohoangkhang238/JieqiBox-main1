<template>
  <div class="toolbar-container">
    <div class="menu-bar">
      <v-menu>
        <template v-slot:activator="{ props }">
          <v-btn v-bind="props" variant="text" size="small" class="menu-btn">
            File
          </v-btn>
        </template>
        <v-list density="compact" width="240">
          <v-list-item @click="setupNewGame" prepend-icon="mdi-chess-king">
            <v-list-item-title>{{ $t('toolbar.newGame') }}</v-list-item-title>
          </v-list-item>
          <v-list-item @click="handleEditPosition" :disabled="isMatchRunning" prepend-icon="mdi-pencil-box">
            <v-list-item-title>{{ $t('toolbar.editPosition') }}</v-list-item-title>
          </v-list-item>
          <v-divider class="my-1"></v-divider>
          <v-list-item @click="handleCopyFen" prepend-icon="mdi-content-copy">
            <v-list-item-title>Sao chép FEN</v-list-item-title>
          </v-list-item>
          <v-list-item @click="showNotationTextDialog = true" :disabled="isMatchRunning" prepend-icon="mdi-content-paste">
            <v-list-item-title>Dán / Nhập FEN</v-list-item-title>
          </v-list-item>
          <v-divider class="my-1"></v-divider>
          <v-list-item @click="handleClearDrawings" prepend-icon="mdi-eraser">
            <v-list-item-title>Xóa hình vẽ</v-list-item-title>
          </v-list-item>
          <v-divider class="my-1"></v-divider>
          <v-list-item @click="handleOpenNotation" prepend-icon="mdi-folder-open">
            <v-list-item-title>{{ $t('toolbar.openNotation') }}</v-list-item-title>
          </v-list-item>
          <v-list-item @click="handleSaveNotation" prepend-icon="mdi-content-save">
            <v-list-item-title>{{ $t('toolbar.saveNotation') }}</v-list-item-title>
          </v-list-item>
          <v-divider class="my-1"></v-divider>
          <v-list-item @click="showReviewDialog = true" prepend-icon="mdi-clipboard-pulse">
            <v-list-item-title>{{ $t('toolbar.reviewAnalysis') }}</v-list-item-title>
          </v-list-item>
          <v-list-item @click="showOpeningBookDialog = true" prepend-icon="mdi-book-open-variant">
            <v-list-item-title>{{ $t('toolbar.openingBook') }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-menu :close-on-content-click="false">
        <template v-slot:activator="{ props }">
          <v-btn v-bind="props" variant="text" size="small" class="menu-btn">
            Engine
          </v-btn>
        </template>
        <v-list density="compact" width="260">
          <v-list-item @click="showEngineManager = true" prepend-icon="mdi-cogs">
            <v-list-item-title>{{ $t('analysis.manageEngines') }}</v-list-item-title>
          </v-list-item>
          <v-divider class="my-1"></v-divider>
          <v-list-item @click="showUciOptionsDialog = true" prepend-icon="mdi-cog">
            <v-list-item-title>{{ $t('toolbar.uciSettings') }}</v-list-item-title>
          </v-list-item>
          <v-list-item @click="showTimeDialog = true" prepend-icon="mdi-timer">
            <v-list-item-title>{{ $t('toolbar.analysisParams') }}</v-list-item-title>
          </v-list-item>
          <v-divider class="my-1"></v-divider>
          <v-list-item @click="toggleFlipMode">
            <template v-slot:prepend>
              <v-icon v-if="flipMode === 'free'" icon="mdi-check" color="success"></v-icon>
              <div v-else style="width: 24px;"></div>
            </template>
            <v-list-item-title>{{ $t('analysis.freeFlipMode') }}</v-list-item-title>
          </v-list-item>
          <v-list-item @click="togglePonder">
            <template v-slot:prepend>
              <v-icon v-if="enablePonder" icon="mdi-check" color="success"></v-icon>
              <div v-else style="width: 24px;"></div>
            </template>
            <v-list-item-title>{{ $t('analysis.ponderMode') }}</v-list-item-title>
          </v-list-item>
          <v-divider class="my-1"></v-divider>
          <v-list-item @click="showInterfaceSettingsDialog = true" prepend-icon="mdi-view-dashboard-outline">
            <v-list-item-title>{{ $t('toolbar.interfaceSettings') }}</v-list-item-title>
          </v-list-item>
          <v-list-item @click="toggleDarkMode">
            <template v-slot:prepend>
               <v-icon v-if="darkMode" icon="mdi-check" color="success"></v-icon>
               <div v-else style="width: 24px;"></div>
            </template>
            <v-list-item-title>{{ $t('toolbar.darkMode') }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>

      <v-menu>
        <template v-slot:activator="{ props }">
          <v-btn v-bind="props" variant="text" size="small" class="menu-btn">
            Language
          </v-btn>
        </template>
        <v-list density="compact" width="160">
          <v-list-item @click="changeLocale('vi')" :active="locale === 'vi'">
            <v-list-item-title>Tiếng Việt</v-list-item-title>
          </v-list-item>
          <v-list-item @click="changeLocale('en')" :active="locale === 'en'">
            <v-list-item-title>English</v-list-item-title>
          </v-list-item>
          <v-list-item @click="changeLocale('zh_cn')" :active="locale === 'zh_cn'">
            <v-list-item-title>简体中文</v-list-item-title>
          </v-list-item>
          <v-list-item @click="changeLocale('zh_tw')" :active="locale === 'zh_tw'">
            <v-list-item-title>繁體中文</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <div class="top-toolbar">
      <div class="toolbar-left">
        <v-btn icon size="small" variant="text" @click="setupNewGame" :disabled="isMatchRunning" :title="$t('toolbar.newGame')">
          <img src="@/assets/new_icon.png" alt="New Game" style="width: 24px; height: 24px; object-fit: contain;" />
        </v-btn>

        <v-divider vertical class="mx-2 my-1"></v-divider>

        <v-btn icon size="small" variant="text" @click="handleUndoMove" :disabled="currentMoveIndex <= 0 || isMatchRunning" title="Lùi một nước">
          <img src="@/assets/prev_icon.png" alt="Undo Move" style="width: 24px; height: 24px; object-fit: contain;" />
        </v-btn>
        
        <v-btn icon size="small" variant="text" @click="toggleBoardFlip" :title="isBoardFlipped ? 'Xoay lại' : 'Lật bàn cờ'">
          <img src="@/assets/reverse_icon.png" alt="Flip Board" style="width: 24px; height: 24px; object-fit: contain;" />
        </v-btn>

        <v-divider vertical class="mx-2 my-1"></v-divider>

        <div v-if="!isMatchRunning" class="d-flex align-center" style="gap: 20px;">
          <v-btn 
            @click="toggleBlackAi" 
            variant="text" 
            icon 
            size="small" 
            density="compact" 
            :disabled="!engineLoaded" 
            :title="isBlackAi ? 'Tắt AI Đen' : 'Bật AI Đen'"
          >
            <img 
              src="@/assets/robotblack.png" 
              alt="Black AI" 
              style="width: 24px; height: 24px; object-fit: contain;" 
              :style="{ opacity: isBlackAi ? 1 : 0.4 }" 
            />
          </v-btn>

          <v-btn 
            @click="toggleRedAi" 
            variant="text" 
            icon 
            size="small" 
            density="compact" 
            :disabled="!engineLoaded" 
            :title="isRedAi ? 'Tắt AI Đỏ' : 'Bật AI Đỏ'"
          >
            <img 
              src="@/assets/robotred.png" 
              alt="Red AI" 
              style="width: 24px; height: 24px; object-fit: contain;" 
              :style="{ opacity: isRedAi ? 1 : 0.4 }" 
            />
          </v-btn>

          <v-btn 
            @click="handleAnalysisButtonClick" 
            variant="text" 
            icon 
            size="small" 
            density="compact" 
            :disabled="!engineLoaded" 
            :title="isThinking || isPondering ? $t('analysis.stopAnalysis') : $t('analysis.startAnalysis')"
          >
            <img 
              src="@/assets/analyze_icon.png" 
              alt="Analyze" 
              style="width: 24px; height: 24px; object-fit: contain;" 
              :style="{ opacity: (isThinking || isPondering) || isManualAnalysis ? 1 : 0.4 }" 
            />
          </v-btn>

          <v-btn 
            icon 
            size="small" 
            variant="text" 
            @click="handleVariation" 
            :disabled="!isVariationAvailable" 
            :title="$t('toolbar.variation')"
          >
            <img 
              src="@/assets/goim.png" 
              alt="Variation" 
              style="width: 24px; height: 24px; object-fit: contain;" 
            />
          </v-btn>
        </div>
      </div>
      
      <div class="toolbar-right"></div>
    </div>

    <UciOptionsDialog v-model="showUciOptionsDialog" :engine-id="currentEngineId" />
    <TimeDialog v-model="showTimeDialog" @settings-changed="handleSettingsChanged" />
    <PositionEditorDialog v-model="showPositionEditor" @position-changed="handlePositionChanged" />
    <InterfaceSettingsDialog v-model="showInterfaceSettingsDialog" />
    <NotationTextDialog v-model="showNotationTextDialog" @apply="handleApplyNotationText" />
    <ReviewAnalysisDialog v-model="showReviewDialog" />
    <OpeningBookDialog v-model="showOpeningBookDialog" />
    <EngineManagerDialog v-model="showEngineManager" />
  </div>
</template>

<script setup lang="ts">
  import { ref, inject, computed, onUnmounted, onMounted, watch, nextTick } from 'vue'
  import { useI18n } from 'vue-i18n'
  import UciOptionsDialog from './UciOptionsDialog.vue'
  import TimeDialog from './TimeDialog.vue'
  import PositionEditorDialog from './PositionEditorDialog.vue'
  import InterfaceSettingsDialog from './InterfaceSettingsDialog.vue'
  import NotationTextDialog from './NotationTextDialog.vue'
  import ReviewAnalysisDialog from './ReviewAnalysisDialog.vue'
  import OpeningBookDialog from './OpeningBookDialog.vue'
  import EngineManagerDialog from './EngineManagerDialog.vue'
  import { useInterfaceSettings } from '../composables/useInterfaceSettings'
  import { useConfigManager } from '../composables/useConfigManager'
  import { useGameSettings } from '../composables/useGameSettings'

  const { t, locale } = useI18n()
  const configManager = useConfigManager()
  const gameState: any = inject('game-state')
  const engineState: any = inject('engine-state')
  const jaiEngine = inject('jai-engine-state') as any
  const { darkMode } = useInterfaceSettings()
  const { enablePonder } = useGameSettings()

  const { 
    sideToMove, playMoveFromUci, pendingFlip, initialFen, history, 
    currentMoveIndex, toggleBoardFlip, isBoardFlipped, undoLastMove,
    flipMode,
    generateFen, 
    clearUserArrows 
  } = gameState

  // --- ENGINE STATE ---
  const { 
    isThinking, isStopping, startAnalysis, stopAnalysis, 
    currentSearchMoves, bestMove, isPondering, stopPonder, loadEngine,
    ponderhit // Added ponderhit from engineState
  } = engineState
  
  const engineLoaded = computed(() => engineState.isEngineLoaded.value)

  // Dialog states
  const showUciOptionsDialog = ref(false)
  const showTimeDialog = ref(false)
  const showPositionEditor = ref(false)
  const showInterfaceSettingsDialog = ref(false)
  const showNotationTextDialog = ref(false)
  const showReviewDialog = ref(false)
  const showOpeningBookDialog = ref(false)
  const showEngineManager = ref(false)

  // Other states
  const isWaitingToRestartForVariation = ref(false)
  const variationRestartData = ref<{ fen: string; moves: string[] } | null>(null)
  const excludedMoves = ref<string[]>([])
  const isSaving = ref(false)
  const isOpening = ref(false)
  const isApplyingText = ref(false)

  const analysisSettings = ref({
    movetime: 1000, maxThinkTime: 5000, maxDepth: 20, maxNodes: 1000000,
    analysisMode: 'movetime', advancedScript: '',
  })

  const isRedAi = ref(false)
  const isBlackAi = ref(false)
  const isManualAnalysis = ref(false)
  const managedEngines = ref<any[]>([])
  const selectedEngineId = ref<string | null>(null)
  
  // Local state for analysis context stability (matching AnalysisSidebar)
  const lastAnalysisFen = ref<string>('')
  const lastAnalysisPrefixMoves = ref<string[]>([])

  // --- Handlers ---
  const handleCopyFen = async () => {
    try {
      const fen = generateFen ? generateFen() : ''
      if (fen) {
        await navigator.clipboard.writeText(fen)
        console.log('FEN copied:', fen)
      }
    } catch (err) {
      console.error('Failed to copy FEN:', err)
    }
  }

  const handleClearDrawings = () => {
    if (gameState.clearUserArrows) {
      gameState.clearUserArrows()
    } else {
      window.dispatchEvent(new CustomEvent('clear-drawings'))
    }
  }

  function changeLocale(lang: string) {
    locale.value = lang
    if (configManager.updateLanguage) {
      configManager.updateLanguage(lang)
    }
  }

  function toggleFlipMode() { flipMode.value = flipMode.value === 'free' ? 'random' : 'free' }
  function togglePonder() { enablePonder.value = !enablePonder.value }
  function toggleDarkMode() { darkMode.value = !darkMode.value }
  function handleUndoMove() { if (!isMatchRunning.value) undoLastMove() }

  // --- ANALYSIS HANDLERS (Updated from AnalysisSidebar) ---
  function handleAnalysisButtonClick() {
    if (isThinking.value || isPondering.value) {
      handleStopAnalysis()
    } else {
      manualStartAnalysis()
    }
  }

  function manualStartAnalysis() {
    // Disable AI auto-play when manual analysis is active
    isRedAi.value = false
    isBlackAi.value = false
    isManualAnalysis.value = true
    
    // NOTE: Avoid overwriting global __MANUAL_ANALYSIS__ with boolean if it's supposed to be a Ref
    // Use local state effectively.

    // Stop any ongoing ponder when starting manual analysis
    if (isPondering.value) {
      stopPonder({ playBestMoveOnStop: false })
    }

    const infiniteSettings = { 
      movetime: 0, 
      maxThinkTime: 0, 
      maxDepth: 0, 
      maxNodes: 0, 
      analysisMode: 'infinite' 
    }
    
    // Record analysis-time context
    lastAnalysisFen.value = baseFenForEngine.value
    lastAnalysisPrefixMoves.value = [...engineMovesSinceLastReveal.value]

    startAnalysis(
      infiniteSettings, 
      engineMovesSinceLastReveal.value, 
      baseFenForEngine.value, 
      currentSearchMoves.value
    )
  }

  function handleStopAnalysis() {
    // If pondering is active, check if it's a ponder hit scenario
    if (isPondering.value) {
      if (ponderhit.value) {
        stopPonder({ playBestMoveOnStop: true })
      } else {
        stopPonder({ playBestMoveOnStop: false })
      }
      return
    }

    // If we are in auto-analysis mode, the stop button should act as a "Move Now" command.
    if (isRedAi.value || isBlackAi.value) {
      stopAnalysis({ playBestMoveOnStop: true })
    } else {
      // If in manual analysis mode, the stop button just cancels the analysis.
      stopAnalysis({ playBestMoveOnStop: false })
    }
    isManualAnalysis.value = false
  }

  function toggleRedAi() {
    if (isRedAi.value && isThinking.value && sideToMove.value === 'red') {
      stopAnalysis({ playBestMoveOnStop: false })
    }
    if (!isRedAi.value) isManualAnalysis.value = false
    isRedAi.value = !isRedAi.value
    nextTick(() => checkAndTriggerAi())
  }

  function toggleBlackAi() {
    if (isBlackAi.value && isThinking.value && sideToMove.value === 'black') {
      stopAnalysis({ playBestMoveOnStop: false })
    }
    if (!isBlackAi.value) isManualAnalysis.value = false
    isBlackAi.value = !isBlackAi.value
    nextTick(() => checkAndTriggerAi())
  }

  function isCurrentAiTurnNow() {
    const redTurn = sideToMove.value === 'red'
    return (redTurn && isRedAi.value) || (!redTurn && isBlackAi.value)
  }

  function countUnknownPieces(fen: string): number {
    const boardPart = fen.split(' ')[0]
    return (boardPart.match(/[xX]/g) || []).length
  }

  const findLastRevealIndex = () => {
    if (currentMoveIndex.value === 0) return -1
    const h = history.value.slice(0, currentMoveIndex.value)
    for (let i = h.length - 1; i >= 0; i--) {
      const entry = h[i]
      if (entry.type === 'adjust') return i
      const prevFen = i === 0 ? initialFen.value : h[i - 1].fen
      const prevUnknown = countUnknownPieces(prevFen)
      const currUnknown = countUnknownPieces(h[i].fen)
      if (prevUnknown !== currUnknown) return i
    }
    return -1
  }

  const baseFenForEngine = computed(() => {
    if (currentMoveIndex.value === 0) return initialFen.value
    const lastRevealIdx = findLastRevealIndex()
    if (lastRevealIdx >= 0) return history.value.slice(0, currentMoveIndex.value)[lastRevealIdx].fen
    return initialFen.value
  })

  const engineMovesSinceLastReveal = computed(() => {
    if (currentMoveIndex.value === 0) return []
    const lastRevealIdx = findLastRevealIndex()
    const h = history.value.slice(0, currentMoveIndex.value)
    const moves: string[] = []
    for (let i = lastRevealIdx + 1; i < h.length; i++) {
      const entry = h[i]
      if (entry.type === 'move') moves.push(entry.data)
    }
    return moves
  })

  async function checkAndTriggerAi() {
    if (isStopping.value) return
    if (isThinking.value && !isCurrentAiTurnNow() && !isManualAnalysis.value) {
      stopAnalysis({ playBestMoveOnStop: false })
      return
    }
    const shouldRunAi = engineLoaded.value && isCurrentAiTurnNow() && !isThinking.value && !pendingFlip.value && !isMatchRunning.value && !isManualAnalysis.value
    if (shouldRunAi) {
      try {
        const enableBook = gameState?.openingBook?.config?.enableInGame
        const getBookMoveFn = gameState?.getOpeningBookMove
        if (enableBook && typeof getBookMoveFn === 'function') {
          const bookMove = await getBookMoveFn()
          if (bookMove) {
            ;(window as any).__LAST_AI_MOVE__ = bookMove
            ;(window as any).__AI_MOVE_FROM_BOOK__ = true
            const ok = playMoveFromUci(bookMove)
            if (ok) {
              nextTick(() => checkAndTriggerAi())
              return
            }
          }
        }
      } catch (e) { console.error(e) }
      startAnalysis(analysisSettings.value, engineMovesSinceLastReveal.value, baseFenForEngine.value, currentSearchMoves.value)
    }
  }

  // Watchers
  watch([sideToMove, isRedAi, isBlackAi, engineLoaded, pendingFlip], () => { nextTick(() => checkAndTriggerAi()) })
  watch(currentMoveIndex, () => {
    if (isManualAnalysis.value && !isThinking.value && engineLoaded.value && !isStopping.value && !isCurrentAiTurnNow()) {
      manualStartAnalysis()
    }
  })
  watch(bestMove, move => {
    if (!move) return
    if (engineLoaded.value && isCurrentAiTurnNow() && !isMatchRunning.value && !isManualAnalysis.value) {
      ;(window as any).__LAST_AI_MOVE__ = move
      setTimeout(() => {
        const ok = playMoveFromUci(move)
        bestMove.value = ''
        if (ok) {
          if (gameState.handlePonderAfterMove) gameState.handlePonderAfterMove(move, true)
          nextTick(() => checkAndTriggerAi())
        }
      }, 50)
    }
  })

  const loadAnalysisSettings = async () => {
    try {
      await configManager.loadConfig()
      const settings = configManager.getAnalysisSettings()
      analysisSettings.value = { ...settings, movetime: settings.movetime || 1000 }
    } catch (error) { console.error(error) }
  }

  const isMatchRunning = computed(() => jaiEngine?.isMatchRunning?.value || false)
  const isAnalyzing = computed(() => engineState.isThinking?.value)
  const currentEngineId = computed(() => engineState.currentEngine?.value?.id || '')
  const isVariationAvailable = computed(() => isAnalyzing.value && engineState.pvMoves?.value?.length > 0 && engineState.pvMoves.value[0])

  const handleVariation = () => {
    if (!isAnalyzing.value || !engineState.pvMoves?.value?.length) return
    const firstPvMove = engineState.pvMoves.value[0]
    if (!firstPvMove) return
    if (!excludedMoves.value.includes(firstPvMove)) excludedMoves.value.push(firstPvMove)
    const allLegalMoves = gameState.getAllLegalMovesForCurrentPosition()
    const allowedMoves = allLegalMoves.filter((move: string) => !excludedMoves.value.includes(move))
    if (allowedMoves.length === 0) { alert(t('toolbar.noMoreVariations')); return }
    variationRestartData.value = { fen: gameState.generateFen(), moves: allowedMoves }
    isWaitingToRestartForVariation.value = true
    engineState.stopAnalysis({ playBestMoveOnStop: false })
  }

  watch(engineState.isThinking, (thinking, wasThinking) => {
    if (wasThinking && !thinking) {
      if (isWaitingToRestartForVariation.value && variationRestartData.value) {
        const { fen, moves } = variationRestartData.value
        engineState.startAnalysis({ ...analysisSettings.value, analysisMode: 'infinite' }, [], fen, moves)
        isWaitingToRestartForVariation.value = false
        variationRestartData.value = null
      } else if (!isWaitingToRestartForVariation.value && !isManualAnalysis.value) {
        resetVariationState()
      }
    }
  })

  const resetVariationState = () => {
    excludedMoves.value = []
    isWaitingToRestartForVariation.value = false
    variationRestartData.value = null
    if (engineState.clearSearchMoves) engineState.clearSearchMoves()
  }

  const handleForceStopAi = () => {
    resetVariationState()
    isRedAi.value = false
    isBlackAi.value = false
    isManualAnalysis.value = false
    // Removed direct window manipulation to prevent state conflicts
  }

  const handleEditPosition = () => { if (!isMatchRunning.value) showPositionEditor.value = true }
  
  const setupNewGame = () => {
    if (isMatchRunning.value) return
    if (engineState.stopAnalysis) engineState.stopAnalysis()
    resetVariationState()
    handleForceStopAi()
    gameState.setupNewGame()
  }

  const handleSaveNotation = async () => {
    isSaving.value = true
    try { await gameState.saveGameNotation() } catch (e) { console.error(e) } finally { isSaving.value = false }
  }

  const handleOpenNotation = () => {
    if (isMatchRunning.value) return
    if (engineState.stopAnalysis) engineState.stopAnalysis()
    handleForceStopAi()
    isOpening.value = true
    try { gameState.openGameNotation() } catch (e) { console.error(e) } finally { isOpening.value = false }
  }

  const handleApplyNotationText = async (text: string) => {
    if (isMatchRunning.value) return
    if (engineState.stopAnalysis) engineState.stopAnalysis()
    handleForceStopAi()
    isApplyingText.value = true
    try { await gameState.loadGameNotationFromText(text) } catch (e) { console.error(e) } finally { isApplyingText.value = false }
  }

  const handleSettingsChanged = async (settings: any) => {
    analysisSettings.value = settings
    try { await configManager.updateAnalysisSettings(settings) } catch (e) { console.error(e) }
  }

  const handlePositionChanged = () => {
    if (engineState.stopAnalysis) engineState.stopAnalysis()
    handleForceStopAi()
  }

  const refreshManagedEngines = async () => {
    await configManager.loadConfig()
    managedEngines.value = configManager.getEngines()
    if (!selectedEngineId.value) {
      selectedEngineId.value = configManager.getLastSelectedEngineId()
    }
  }
  
  // --- CẢI THIỆN: Auto Load Engine ---
  const autoLoadEngine = async () => {
    await refreshManagedEngines()
    if (managedEngines.value.length > 0) {
      const lastId = configManager.getLastSelectedEngineId()
      // Nếu có lastId thì lấy, không thì lấy engine đầu tiên
      const engineToLoad = lastId 
        ? managedEngines.value.find(e => e.id === lastId) 
        : managedEngines.value[0]
      
      if (engineToLoad) {
        selectedEngineId.value = engineToLoad.id
        
        // Kiểm tra xem đang ở chế độ nào để load đúng engine
        if (isMatchMode.value) {
           if (!jaiEngine.isEngineLoaded.value) {
             console.log("Auto-loading Match Engine:", engineToLoad.name)
             jaiEngine.loadEngine(engineToLoad)
           }
        } else {
           // Ở chế độ thường, kiểm tra engineState.isEngineLoaded
           if (!engineState.isEngineLoaded.value) {
             console.log("Auto-loading Analysis Engine:", engineToLoad.name)
             loadEngine(engineToLoad)
           }
        }
      }
    }
  }

  onMounted(async () => {
    loadAnalysisSettings()
    await autoLoadEngine()
    window.addEventListener('force-stop-ai', handleForceStopAi)
  })

  onUnmounted(() => {
    window.removeEventListener('force-stop-ai', handleForceStopAi)
  })
</script>

<style lang="scss" scoped>
  .toolbar-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    background-color: rgb(var(--v-theme-surface));
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }

  .menu-bar {
    display: flex;
    padding: 0 8px;
    height: 30px;
    align-items: center;
    background-color: rgba(var(--v-theme-surface), 0.5);
    border-bottom: 1px solid rgba(var(--v-border-color), 0.1);
  }

  .menu-btn {
    text-transform: none;
    font-weight: 500;
    min-width: 60px;
    letter-spacing: 0;
  }

  .top-toolbar {
    display: flex;
    /* Canh trái */
    justify-content: flex-start; 
    align-items: center;
    padding: 4px 16px;
    height: 48px;

    @media (max-width: 768px) {
      padding: 4px 8px;
      flex-wrap: wrap;
      height: auto;
      gap: 4px;
    }
  }

  .toolbar-left {
    display: flex;
    gap: 4px;
    align-items: center;
    /* Chiếm hết không gian */
    flex-grow: 1; 

    @media (max-width: 768px) {
      gap: 2px;
      .v-btn { font-size: 12px; }
    }
  }

  /* Ẩn toolbar bên phải nhưng giữ class */
  .toolbar-right {
    display: none; 
  }
</style>