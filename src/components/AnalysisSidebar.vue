<template>
  <div class="sidebar">
    <DraggablePanel v-if="shouldShowLuckIndex" panel-id="luck-index">
      <template #header>
        <h3 class="section-title">{{ $t('analysis.luckIndex') }}</h3>
      </template>
      <div class="luck-index-panel">
        <div class="luck-description">
          {{ $t('analysis.luckIndexBasedOnFlipSequence') }}
        </div>
        <div class="luck-row">
          <span class="label">{{ $t('analysis.currentValue') }}</span>
          <span class="luck-value" :class="luckClass">{{ luckIndex }}</span>
        </div>
        <div class="luck-axis">
          <div class="axis-track"></div>
          <div
            class="axis-tick"
            v-for="tick in axisTicks"
            :key="tick.pos"
            :style="{ left: tick.pos + '%' }"
          >
            <span class="tick-label">{{ tick.label }}</span>
          </div>
          <div class="axis-zero" :style="{ left: '50%' }"></div>
          <div class="axis-marker" :class="luckClass" :style="markerStyle">
            <span class="marker-value">{{ luckIndex }}</span>
          </div>
        </div>
        <div class="luck-legend">
          <span>{{ $t('analysis.blackFavor') }}</span>
          <span>{{ $t('analysis.redFavor') }}</span>
        </div>
      </div>
    </DraggablePanel>

    <DraggablePanel
      v-if="!isHumanVsAiMode || showEngineAnalysis"
      panel-id="engine-analysis"
    >
      <template #header>
        <h3>
          {{
            isMatchMode
              ? $t('analysis.matchInfo')
              : $t('analysis.engineAnalysis')
          }}
        </h3>
      </template>

      <div v-if="isMatchMode" class="match-output">
        <div v-if="jaiEngine?.isEngineLoaded?.value" class="match-info">
          <div class="match-status">
            <div class="status-line">
              <span class="label">{{ $t('analysis.matchStatus') }}:</span>
              <span class="value">{{
                jaiEngine?.isMatchRunning?.value
                  ? $t('analysis.running')
                  : $t('analysis.stopped')
              }}</span>
            </div>
            <div v-if="jaiEngine?.currentGame?.value > 0" class="status-line">
              <span class="label">{{ $t('analysis.gameProgress') }}:</span>
              <span class="value"
                >{{ jaiEngine.currentGame.value }} /
                {{ jaiEngine.totalGames.value }}</span
              >
            </div>
            <div v-if="jaiEngine?.analysisInfo?.value" class="analysis-info">
              <div class="info-header">{{ $t('analysis.engineAnalysis') }}</div>
              <div
                class="analysis-line"
                v-html="parseJaiAnalysisInfo(jaiEngine.analysisInfo.value)"
              ></div>
            </div>
          </div>
        </div>
        <div v-else class="no-match-info">
          {{ $t('analysis.noMatchEngine') }}
        </div>
      </div>

      <div v-else>
        <div v-if="parseUciInfo && latestParsedInfo" class="analysis-modern">
          <div class="analysis-card">
            <div class="analysis-core">
              <div class="score-badge" :class="scoreDisplay.className">
                {{ scoreDisplay.text }}
              </div>
              <div class="best-move-box">
                <div class="best-move-label">{{ $t('analysis.bestMove') }}</div>
                <div class="best-move-value">{{ bestMoveDisplay }}</div>
              </div>
            </div>

            <div class="analysis-hud">
              <div class="hud-item">
                <v-icon size="16" class="hud-icon" icon="mdi-timer-outline" />
                <span>{{ hudDisplay.time }}</span>
              </div>
              <div class="hud-item">
                <v-icon size="16" class="hud-icon" icon="mdi-flash" />
                <span>{{ hudDisplay.nps }}</span>
              </div>
              <div class="hud-item">
                <v-icon size="16" class="hud-icon" icon="mdi-stairs" />
                <span>{{ hudDisplay.depth }}</span>
              </div>
            </div>

            <div v-if="wdlBar" class="wdl-bar">
              <div
                class="wdl-segment win"
                :style="{ width: wdlBar.win + '%' }"
                :title="`${wdlBar.win.toFixed(1)}%`"
              ></div>
              <div
                class="wdl-segment draw"
                :style="{ width: wdlBar.draw + '%' }"
                :title="`${wdlBar.draw.toFixed(1)}%`"
              ></div>
              <div
                class="wdl-segment loss"
                :style="{ width: wdlBar.loss + '%' }"
                :title="`${wdlBar.loss.toFixed(1)}%`"
              ></div>
            </div>

            <div v-if="multiPvInfos.length > 1" class="multipv-list">
              <div class="multipv-title">{{ $t('analysis.multiPv') }}</div>
              <div class="multipv-rows">
                <div
                  class="multipv-row"
                  v-for="item in multiPvInfos"
                  :key="`mpv-${item.multipv}`"
                  :class="{ active: selectedMultipv === item.multipv }"
                  @click="handleSelectMultipv(item)"
                >
                  <div class="multipv-col multipv-idx">#{{ item.multipv }}</div>
                  <div
                    class="multipv-col multipv-score"
                    :class="item.scoreClass"
                  >
                    {{ item.scoreText }}
                  </div>
                  <div class="multipv-col multipv-move">
                    {{ item.bestMove }}
                  </div>
                  <div class="multipv-col multipv-mini">
                    {{ item.depthText }}
                  </div>
                </div>
              </div>
            </div>

            <div class="analysis-pv-block">
              <div class="pv-header">
                <div class="pv-title">{{ $t('analysis.fullLine') }}</div>
                <v-btn
                  class="pv-toggle-btn"
                  size="x-small"
                  variant="text"
                  icon
                  @click="isFullLineCollapsed = !isFullLineCollapsed"
                >
                  <v-icon
                    size="18"
                    :icon="
                      isFullLineCollapsed
                        ? 'mdi-chevron-down'
                        : 'mdi-chevron-up'
                    "
                  />
                </v-btn>
              </div>
              <div v-show="!isFullLineCollapsed" class="pv-body">
                <div class="pv-text">{{ pvDisplay }}</div>
                <div v-if="extraInfoDisplay" class="extra-info">
                  {{ extraInfoDisplay }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="analysis-output">
          <div
            v-for="(ln, idx) in parsedAnalysisLines"
            :key="`an-${idx}`"
            v-html="ln"
          ></div>
        </div>
      </div>
    </DraggablePanel>

    <DraggablePanel v-if="showOpeningBookPanel" panel-id="opening-book">
      <template #header>
        <h3>{{ $t('openingBook.title') }}</h3>
      </template>
      <OpeningBookPanel
        :show-panel="true"
        @open-detail-dialog="showOpeningBookDetail = true"
        @play-move="handleOpeningBookMove"
      />
    </DraggablePanel>

    <DraggablePanel panel-id="notation">
      <template #header>
        <div class="notation-header">
          <h3>{{ $t('analysis.notation') }}</h3>
          <div class="notation-controls">
            <v-btn
              @click="goToFirstMove"
              :disabled="currentMoveIndex <= 0 || isMatchRunning"
              icon="mdi-skip-backward"
              size="x-small"
              color="primary"
              variant="text"
              :title="$t('analysis.goToFirst')"
            />
            <v-btn
              @click="goToPreviousMove"
              :disabled="currentMoveIndex <= 0 || isMatchRunning"
              icon="mdi-step-backward"
              size="x-small"
              color="primary"
              variant="text"
              :title="$t('analysis.goToPrevious')"
            />
            <v-btn
              @click="togglePlayPause"
              :color="isPlaying ? 'warning' : 'success'"
              :icon="isPlaying ? 'mdi-pause' : 'mdi-play'"
              size="x-small"
              variant="text"
              :disabled="isMatchRunning"
              :title="isPlaying ? $t('analysis.pause') : $t('analysis.play')"
            />
            <v-btn
              @click="goToNextMove"
              :disabled="currentMoveIndex >= history.length || isMatchRunning"
              icon="mdi-step-forward"
              size="x-small"
              color="primary"
              variant="text"
              :title="$t('analysis.goToNext')"
            />
            <v-btn
              @click="goToLastMove"
              :disabled="currentMoveIndex >= history.length || isMatchRunning"
              icon="mdi-skip-forward"
              size="x-small"
              color="primary"
              variant="text"
              :title="$t('analysis.goToLast')"
            />
            <v-menu location="bottom" :close-on-content-click="true">
              <template #activator="{ props }">
                <v-btn
                  v-bind="props"
                  size="x-small"
                  color="indigo"
                  variant="text"
                  icon="mdi-star-circle"
                  :title="$t('analysis.annotateMove')"
                />
              </template>
              <v-list density="compact">
                <v-list-item @click="setAnnotation('!!')"><v-list-item-title>!! {{ $t('analysis.brilliant') }}</v-list-item-title></v-list-item>
                <v-list-item @click="setAnnotation('!')"><v-list-item-title>! {{ $t('analysis.good') }}</v-list-item-title></v-list-item>
                <v-list-item @click="setAnnotation('!?')"><v-list-item-title>!? {{ $t('analysis.interesting') }}</v-list-item-title></v-list-item>
                <v-list-item @click="setAnnotation('?!')"><v-list-item-title>?! {{ $t('analysis.dubious') }}</v-list-item-title></v-list-item>
                <v-list-item @click="setAnnotation('?')"><v-list-item-title>? {{ $t('analysis.mistake') }}</v-list-item-title></v-list-item>
                <v-list-item @click="setAnnotation('??')"><v-list-item-title>?? {{ $t('analysis.blunder') }}</v-list-item-title></v-list-item>
                <v-list-item @click="setAnnotation(undefined)"><v-list-item-title>{{ $t('analysis.clear') }}</v-list-item-title></v-list-item>
              </v-list>
            </v-menu>
          </div>
        </div>
      </template>
      <div
        class="move-list"
        ref="moveListElement"
        :class="{ 'disabled-clicks': isMatchRunning }"
      >
        <div
          class="move-item"
          :class="{ 'current-move': currentMoveIndex === 0 }"
          @click="handleMoveClick(0)"
        >
          <span class="move-number">{{ $t('analysis.opening') }}</span>
        </div>
        <div
          v-for="(entry, idx) in history"
          :key="idx"
          class="move-item"
          :class="{ 'current-move': currentMoveIndex === idx + 1 }"
          @click="handleMoveClick(idx + 1)"
        >
          <template v-if="entry.type === 'move'">
            <span class="move-number">{{ getMoveNumber(idx) }}</span>
            <span class="move-uci">{{
              isHumanVsAiMode ? entry.data.slice(0, 4) : entry.data
            }}</span>
            <span
              v-if="entry.annotation"
              class="move-annot"
              :class="annotationClass(entry.annotation)"
              >{{ entry.annotation }}</span
            >
            <span v-if="showChineseNotation" class="move-chinese">
              {{ getChineseNotationForMove(idx) }}
            </span>
            <div
              v-if="
                !isHumanVsAiMode &&
                (entry.engineScore !== undefined ||
                  entry.engineTime !== undefined)
              "
              class="engine-analysis"
            >
              <span
                v-if="entry.engineScore !== undefined"
                class="engine-score"
                :class="getScoreClass(entry.engineScore)"
              >
                {{ formatScore(entry.engineScore) }}
              </span>
              <span v-if="entry.engineTime !== undefined" class="engine-time">
                {{ formatTime(entry.engineTime) }}
              </span>
            </div>
          </template>
          <template v-else-if="entry.type === 'adjust'">
            <span class="move-adjust"
              >{{ $t('analysis.adjustment') }}: {{ entry.data }}</span
            >
          </template>
        </div>
      </div>
    </DraggablePanel>

    <AboutDialog ref="aboutDialogRef" />
    <UciTerminalDialog v-model="showUciTerminalDialog" />
    <JaiOptionsDialog
      v-if="isMatchMode"
      v-model="showJaiOptionsDialog"
      :engine-id="currentJaiEngineId"
    />
    <EloCalculatorDialog
      v-model="showEloCalculatorDialog"
      :initial-wins="jaiEngine?.matchWins?.value || 0"
      :initial-losses="jaiEngine?.matchLosses?.value || 0"
      :initial-draws="jaiEngine?.matchDraws?.value || 0"
    />
    <HumanVsAiModeDialog
      v-model="showHumanVsAiDialog"
      @confirm="handleHumanVsAiModeConfirm"
    />
    <OpeningBookDialog v-model="showOpeningBookDetail" />
  </div>
</template>

<script setup lang="ts">
  import {
    computed,
    inject,
    ref,
    watch,
    nextTick,
    onMounted,
    onUnmounted,
  } from 'vue'
  import { useI18n } from 'vue-i18n'
  import type { HistoryEntry } from '@/composables/useChessGame'
  import { useInterfaceSettings } from '@/composables/useInterfaceSettings'
  import { uciToChineseMoves } from '@/utils/chineseNotation'
  import { useGameSettings } from '@/composables/useGameSettings'
  import { useHumanVsAiSettings } from '@/composables/useHumanVsAiSettings'
  import AboutDialog from './AboutDialog.vue'
  import UciTerminalDialog from './UciTerminalDialog.vue'
  import JaiOptionsDialog from './JaiOptionsDialog.vue'
  import EloCalculatorDialog from './EloCalculatorDialog.vue'
  import HumanVsAiModeDialog from './HumanVsAiModeDialog.vue'
  import CaptureHistoryPanel from './CaptureHistoryPanel.vue'
  import OpeningBookPanel from './OpeningBookPanel.vue'
  import OpeningBookDialog from './OpeningBookDialog.vue'
  import {
    useConfigManager,
    type ManagedEngine,
  } from '@/composables/useConfigManager'
  import DraggablePanel from './DraggablePanel.vue'
  import { usePanelManager } from '@/composables/usePanelManager'
  import {
    calculateEloRating,
    formatEloRating,
    formatErrorMargin,
  } from '@/utils/eloCalculator'
  import { marked } from 'marked'
  import DOMPurify from 'dompurify'
  import {
    START_FEN,
    JIEQI_MODEL_FEATURE_DIM as FEATURE_DIM,
    JIEQI_MODEL_INTERCEPT as MODEL_INTERCEPT,
    JIEQI_MODEL_WEIGHTS as MODEL_WEIGHTS,
    JIEQI_MODEL_SCALER_MEANS as SCALER_MEANS,
    JIEQI_MODEL_SCALER_SCALES as SCALER_SCALES,
    JIEQI_MODEL_PIECE_TO_INDEX as PIECE_TO_INDEX,
  } from '@/utils/constants'

  const { t } = useI18n()
  const { restoreDefaultLayout } = usePanelManager()

  // Get interface settings
  const {
    parseUciInfo,
    engineLogLineLimit,
    showChineseNotation,
    showLuckIndex,
    showBookMoves,
    useNewFenFormat,
  } = useInterfaceSettings()

  const { enablePonder } = useGameSettings()
  const { isHumanVsAiMode, showEngineAnalysis } = useHumanVsAiSettings()

  const gameState = inject('game-state') as any
  const {
    history,
    currentMoveIndex,
    replayToMove,
    playMoveFromUci,
    flipMode,
    // [ĐÃ XÓA] unrevealedPieceCounts, capturedUnrevealedPieceCounts...
    sideToMove,
    pendingFlip,
    toggleBoardFlip,
    isBoardFlipped,
    initialFen,
    undoLastMove,
    updateMoveAnnotation,
  } = gameState

  const engineState = inject('engine-state') as any
  const {
    engineOutput,
    isEngineLoaded,
    isEngineLoading,
    analysis,
    bestMove,
    isThinking,
    isStopping,
    loadEngine,
    unloadEngine,
    startAnalysis,
    stopAnalysis,
    currentSearchMoves,
    isPondering,
    isInfinitePondering,
    ponderMove,
    ponderhit,
    handlePonderHit,
    stopPonder,
    isPonderMoveMatch,
    isDarkPieceMove,
    setShowChineseNotation,
  } = engineState

  const jaiEngine = inject('jai-engine-state') as any

  const configManager = useConfigManager()
  // const showEngineManager = ref(false)
  const showHumanVsAiDialog = ref(false)
  const managedEngines = ref<ManagedEngine[]>([])
  const selectedEngineId = ref<string | null>(null)

  const showOpeningBookPanel = computed(() => showBookMoves.value !== false)
  const showOpeningBookDetail = ref(false)

  const isMatchMode = ref(false)
  const showJaiOptionsDialog = ref(false)
  const showEloCalculatorDialog = ref(false)
  const showUciTerminalDialog = ref(false)

  const isMatchRunning = computed(
    () => jaiEngine?.isMatchRunning?.value || false
  )
  const currentJaiEngineId = computed(
    () => jaiEngine?.currentEngine?.value?.id || ''
  )

  const matchEloDisplay = computed<string | null>(() => {
    const w = jaiEngine?.matchWins?.value || 0
    const l = jaiEngine?.matchLosses?.value || 0
    const d = jaiEngine?.matchDraws?.value || 0
    const res = calculateEloRating(w, l, d)
    if (!res) return null
    const perf = formatEloRating(res)
    const err = formatErrorMargin(res)
    return `${perf} ${err}`.trim()
  })

  const lastAnalysisFen = ref<string>('')
  const lastAnalysisPrefixMoves = ref<string[]>([])

  const moveListElement = ref<HTMLElement | null>(null)
  const engineLogElement = ref<HTMLElement | null>(null)
  const aboutDialogRef = ref<InstanceType<typeof AboutDialog> | null>(null)

  const editingCommentIndex = ref<number | null>(null)
  const editingCommentText = ref<string>('')
  const commentsListElement = ref<HTMLElement | null>(null)
  const commentTextareaRefs = ref<Record<number, any>>({})

  const isPlaying = ref(false)
  const playInterval = ref<ReturnType<typeof setInterval> | null>(null)
  const playSpeed = ref(1000)

  const analysisLines = computed(() => {
    return analysis.value
      ? analysis.value.split('\n').filter((l: string) => l.trim().length > 0)
      : []
  })

  const currentEngineOutput = computed(() => {
    if (isMatchMode.value && jaiEngine?.engineOutput?.value) {
      return jaiEngine.engineOutput.value
    }
    return engineOutput.value
  })

  watch(
    () => engineState?.analysisUiFen?.value,
    val => {
      if (val) lastAnalysisFen.value = val
    }
  )
  watch(
    () => engineState?.analysisPrefixMoves?.value,
    val => {
      if (val) lastAnalysisPrefixMoves.value = [...val]
    }
  )

  watch(
    showChineseNotation,
    newValue => {
      setShowChineseNotation(newValue)
    },
    { immediate: true }
  )

  function countUnknownPieces(fen: string): number {
    const boardPart = fen.split(' ')[0]
    return (boardPart.match(/[xX]/g) || []).length
  }

  const findLastRevealIndex = () => {
    if (currentMoveIndex.value === 0) {
      return -1
    }
    const h = history.value.slice(0, currentMoveIndex.value)
    for (let i = h.length - 1; i >= 0; i--) {
      const entry = h[i]
      if (entry.type === 'adjust') {
        return i
      }
      const prevFen = i === 0 ? initialFen.value : h[i - 1].fen
      const prevUnknown = countUnknownPieces(prevFen)
      const currUnknown = countUnknownPieces(h[i].fen)
      if (prevUnknown !== currUnknown) {
        return i
      }
    }
    return -1
  }

  const baseFenForEngine = computed(() => {
    if (currentMoveIndex.value === 0) {
      return initialFen.value
    }
    const lastRevealIdx = findLastRevealIndex()
    if (lastRevealIdx >= 0) {
      return history.value.slice(0, currentMoveIndex.value)[lastRevealIdx].fen
    }
    return initialFen.value
  })

  const engineMovesSinceLastReveal = computed(() => {
    if (currentMoveIndex.value === 0) {
      return []
    }
    const lastRevealIdx = findLastRevealIndex()
    const h = history.value.slice(0, currentMoveIndex.value)
    const moves: string[] = []
    for (let i = lastRevealIdx + 1; i < h.length; i++) {
      const entry = h[i]
      if (entry.type === 'move') {
        moves.push(entry.data)
      }
    }
    return moves
  })

  // [ĐÃ XÓA] unrevealedPiecesForDisplay, getPieceImageUrl...

  function getMoveNumber(historyIndex: number): string {
    const moveCount = history.value
      .slice(0, historyIndex + 1)
      .filter((e: HistoryEntry) => e.type === 'move').length
    if (moveCount === 0) return ''
    const moveNumber = Math.floor((moveCount - 1) / 2) + 1
    const isSecondMove = (moveCount - 1) % 2 === 1
    return `${moveNumber}${isSecondMove ? '...' : '.'}`
  }

  function handleMoveClick(moveIndex: number) {
    if (isMatchRunning.value) {
      return
    }
    replayToMove(moveIndex)
  }

  function setAnnotation(a: '!!' | '!' | '!?' | '?!' | '?' | '??' | undefined) {
    if (isMatchRunning.value) return
    const idx = currentMoveIndex.value - 1
    if (
      idx >= 0 &&
      idx < history.value.length &&
      history.value[idx].type === 'move'
    ) {
      updateMoveAnnotation(idx, a)
    }
  }

  function annotationClass(a: NonNullable<HistoryEntry['annotation']>) {
    switch (a) {
      case '!!': return 'annot-brilliant'
      case '!': return 'annot-good'
      case '!?': return 'annot-interesting'
      case '?!': return 'annot-dubious'
      case '?': return 'annot-mistake'
      case '??': return 'annot-blunder'
    }
  }

  function goToFirstMove() {
    if (isMatchRunning.value) return
    if (currentMoveIndex.value > 0) {
      replayToMove(0)
      stopPlayback()
    }
  }

  function goToPreviousMove() {
    if (isMatchRunning.value) return
    if (currentMoveIndex.value > 0) {
      replayToMove(currentMoveIndex.value - 1)
      stopPlayback()
    }
  }

  function goToNextMove() {
    if (isMatchRunning.value) return
    if (currentMoveIndex.value < history.value.length) {
      replayToMove(currentMoveIndex.value + 1)
      stopPlayback()
    }
  }

  function goToLastMove() {
    if (isMatchRunning.value) return
    if (currentMoveIndex.value < history.value.length) {
      replayToMove(history.value.length)
      stopPlayback()
    }
  }

  function togglePlayPause() {
    if (isMatchRunning.value) return
    if (isPlaying.value) {
      stopPlayback()
    } else {
      startPlayback()
    }
  }

  function startPlayback() {
    if (isMatchRunning.value) return
    if (isPlaying.value) return

    isPlaying.value = true
    playInterval.value = setInterval(() => {
      if (currentMoveIndex.value < history.value.length) {
        replayToMove(currentMoveIndex.value + 1)
      } else {
        stopPlayback()
      }
    }, playSpeed.value)
  }

  function stopPlayback() {
    if (playInterval.value) {
      clearInterval(playInterval.value)
      playInterval.value = null
    }
    isPlaying.value = false
  }

  function openAboutDialog() {
    aboutDialogRef.value?.openDialog()
  }

  // --- Handlers đã ẩn (Match, Human vs AI) ---
  const handleHumanVsAiModeConfirm = async (settings: any) => {
    // Keep function for dialog confirm
    const { toggleHumanVsAiMode, setAiSide, toggleShowEngineAnalysis } =
      useHumanVsAiSettings()
    toggleHumanVsAiMode()
    ;(window as any).__HUMAN_VS_AI_MODE__ = true
    setAiSide(settings.aiSide)
    if (settings.showEngineAnalysis !== showEngineAnalysis.value) {
      toggleShowEngineAnalysis()
    }
    if (flipMode.value !== 'random') {
      flipMode.value = 'random'
    }
  }

  // function getCommentText, etc... - Already removed Move Comments panel but kept functions if needed for future
  // Removing Move Comment Panel html also means we can remove these if not used elsewhere.
  // For safety, keeping helpers if they are small.

  onMounted(async () => {
    try {
      await configManager.loadConfig()
      const matchSettings = configManager.getMatchSettings()
      isMatchMode.value = matchSettings.isMatchMode || false
      ;(window as any).__MATCH_MODE__ = isMatchMode.value
      window.dispatchEvent(
        new CustomEvent('match-mode-changed', {
          detail: { isMatchMode: isMatchMode.value, isStartup: true },
        })
      )
    } catch (error) {
      console.error('Failed to load match mode settings:', error)
    }
  })

  watch(
    history,
    () => {
      nextTick(() => {
        if (moveListElement.value) {
          moveListElement.value.scrollTop = moveListElement.value.scrollHeight
        }
      })
    },
    { deep: true }
  )

  watch(
    currentEngineOutput,
    () => {
      nextTick(() => {
        if (engineLogElement.value) {
          engineLogElement.value.scrollTop = engineLogElement.value.scrollHeight
        }
      })
    },
    { deep: true }
  )

  watch(
    currentEngineOutput,
    newOutput => {
      if (newOutput.length > engineLogLineLimit.value) {
        if (isMatchMode.value && jaiEngine?.engineOutput?.value) {
          jaiEngine.engineOutput.value = []
        } else {
          engineOutput.value = []
        }
      }
    },
    { deep: true }
  )

  function parseUciInfoLine(line: string) {
    if (!line.startsWith('info ')) return null
    const result: Record<string, any> = {}
    const regexps = [
      { key: 'depth', re: /depth (\d+)/ },
      { key: 'seldepth', re: /seldepth (\d+)/ },
      { key: 'multipv', re: /multipv (\d+)/ },
      { key: 'score', re: /score (cp|mate) ([\-\d]+)/ },
      { key: 'wdl', re: /wdl (\d+) (\d+) (\d+)/ },
      { key: 'nodes', re: /nodes (\d+)/ },
      { key: 'nps', re: /nps (\d+)/ },
      { key: 'hashfull', re: /hashfull (\d+)/ },
      { key: 'tbhits', re: /tbhits (\d+)/ },
      { key: 'time', re: /time (\d+)/ },
    ]
    for (const { key, re } of regexps) {
      const m = line.match(re)
      if (m) {
        if (key === 'score') {
          result['scoreType'] = m[1]
          result['scoreValue'] = m[2]
        } else if (key === 'wdl') {
          result['wdlWin'] = parseInt(m[1], 10)
          result['wdlDraw'] = parseInt(m[2], 10)
          result['wdlLoss'] = parseInt(m[3], 10)
        } else {
          result[key] = m[1] || m[2]
        }
      }
    }
    const pvMatch = line.match(/\spv\s(.+)$/)
    if (pvMatch) {
      result['pv'] = pvMatch[1].trim()
    }
    return result
  }

  function normalizeScoreForDisplay(info: Record<string, any>) {
    let scoreValue = 0
    let isMate = false
    if (info.scoreType && info.scoreValue) {
      if (info.scoreType === 'cp') {
        scoreValue = parseInt(info.scoreValue, 10)
      } else if (info.scoreType === 'mate') {
        scoreValue = parseInt(info.scoreValue, 10)
        isMate = true
      }
    }
    if (isPondering.value && !isInfinitePondering.value) {
      scoreValue = -scoreValue
    }
    if (engineState.analysisUiFen.value.includes(' b ')) {
      scoreValue = -scoreValue
    }
    if (isBoardFlipped.value) {
      scoreValue = -scoreValue
    }
    return { scoreValue, isMate }
  }

  function normalizeWdlForDisplay(info: Record<string, any>) {
    if (
      info.wdlWin === undefined ||
      info.wdlDraw === undefined ||
      info.wdlLoss === undefined
    ) {
      return null
    }
    let win = info.wdlWin
    let draw = info.wdlDraw
    let loss = info.wdlLoss
    const flip = () => {
      const tmp = win
      win = loss
      loss = tmp
    }
    if (isPondering.value && !isInfinitePondering.value) flip()
    if (engineState.analysisUiFen.value.includes(' b ')) flip()
    if (isBoardFlipped.value) flip()
    const total = win + draw + loss
    if (total <= 0) return null
    return {
      winPct: (win / total) * 100,
      drawPct: (draw / total) * 100,
      lossPct: (loss / total) * 100,
    }
  }

  function formatUciInfo(info: Record<string, any>) {
    if (!info) return ''
    const { scoreValue, isMate } = normalizeScoreForDisplay(info)
    const getScoreColorClass = () => {
      if (isMate) {
        return scoreValue > 0 ? 'score-mate-positive' : 'score-mate-negative'
      } else {
        if (scoreValue > 50) return 'score-positive'
        if (scoreValue < -50) return 'score-negative'
        return 'score-neutral'
      }
    }
    const formatWdl = () => {
      if (
        info.wdlWin !== undefined &&
        info.wdlDraw !== undefined &&
        info.wdlLoss !== undefined
      ) {
        const total = info.wdlWin + info.wdlDraw + info.wdlLoss
        if (total > 0) {
          const winPercent = ((info.wdlWin / total) * 100).toFixed(1)
          const drawPercent = ((info.wdlDraw / total) * 100).toFixed(1)
          const lossPercent = ((info.wdlLoss / total) * 100).toFixed(1)
          return `<span class="wdl-info">${t('uci.wdl')}: ${winPercent}%/${drawPercent}%/${lossPercent}%</span>`
        }
      }
      return null
    }
    const formatPv = () => {
      if (!info.pv) return null
      if (showChineseNotation.value) {
        try {
          let rootFen = isMatchMode.value
            ? gameState.generateFen()
            : engineState.analysisUiFen.value || gameState.generateFen()
          if (!useNewFenFormat.value && gameState.convertFenFormat) {
            rootFen = gameState.convertFenFormat(rootFen, 'new')
          }
          let pvToConvert: string = info.pv
          if (
            isPondering.value &&
            !isInfinitePondering.value &&
            ponderMove.value &&
            !pvToConvert.startsWith(ponderMove.value)
          ) {
            pvToConvert = `${ponderMove.value} ${pvToConvert}`
          }
          const chineseMoves = uciToChineseMoves(rootFen, pvToConvert)
          const chinesePv = chineseMoves.join(' ')
          return `<span class="pv-line">${t('uci.pv')}: ${chinesePv}</span>`
        } catch (error) {
          return `<span class="pv-line">${t('uci.pv')}: ${info.pv}</span>`
        }
      }
      return `<span class="pv-line">${t('uci.pv')}: ${info.pv}</span>`
    }
    const fields = [
      info.depth && `${t('uci.depth')}: ${info.depth}`,
      info.seldepth && `${t('uci.seldepth')}: ${info.seldepth}`,
      info.multipv && `${t('uci.multipv')}: ${info.multipv}`,
      info.scoreType &&
        info.scoreValue &&
        (() => {
          if (info.scoreType === 'cp') {
            return `<span class="${getScoreColorClass()}">${t('uci.score')}: ${scoreValue}</span>`
          }
          const sign = scoreValue > 0 ? '+' : '-'
          const ply = Math.abs(scoreValue)
          return `<span class="${getScoreColorClass()}">${t('uci.mate')}: ${sign}M${ply}</span>`
        })(),
      formatWdl(),
      info.nodes && `${t('uci.nodes')}: ${info.nodes}`,
      info.nps &&
        `${t('uci.nps')}: ${(parseInt(info.nps, 10) / 1000).toFixed(1)}K`,
      info.hashfull && `${t('uci.hashfull')}: ${info.hashfull}‰`,
      info.tbhits && `${t('uci.tbhits')}: ${info.tbhits}`,
      info.time &&
        `${t('uci.time')}: ${(parseInt(info.time, 10) / 1000).toFixed(2)}s`,
      formatPv(),
    ].filter(Boolean)
    return fields.join(' | ')
  }

  const parsedAnalysisLines = computed(() => {
    return analysisLines.value.map((line: string) => {
      if (line.startsWith('info ')) {
        if (parseUciInfo.value) {
          const info = parseUciInfoLine(line)
          if (info) return formatUciInfo(info)
        }
        return line
      }
      return line
    })
  })

  const selectedMultipv = ref<number | null>(null)
  const isFullLineCollapsed = ref(false)

  const latestParsedInfo = computed(() => {
    return activeMultipvInfo.value?.info || null
  })

  const latestParsedMultiPv = computed(() => {
    if (!parseUciInfo.value) return []
    const map = new Map<number, Record<string, any>>()
    for (let i = analysisLines.value.length - 1; i >= 0; i--) {
      const line = analysisLines.value[i]
      if (!line.startsWith('info ')) continue
      const info = parseUciInfoLine(line)
      if (!info) continue
      const pvIndex = info.multipv ? parseInt(info.multipv, 10) : 1
      if (!map.has(pvIndex)) {
        map.set(pvIndex, info)
      }
    }
    return Array.from(map.entries())
      .map(([multipv, info]) => ({ multipv, info }))
      .sort((a, b) => a.multipv - b.multipv)
  })

  const activeMultipvInfo = computed(() => {
    const list = latestParsedMultiPv.value
    if (!list.length) return null
    if (selectedMultipv.value) {
      return (
        list.find(item => item.multipv === selectedMultipv.value) || list[0]
      )
    }
    return list[0]
  })

  const scoreDisplay = computed(() => {
    const info = latestParsedInfo.value
    if (!info) return { text: '--', className: 'score-neutral' }
    const { scoreValue, isMate } = normalizeScoreForDisplay(info)
    if (isMate) {
      const sign = scoreValue > 0 ? '+' : '-'
      return {
        text: `${sign}M${Math.abs(scoreValue)}`,
        className:
          scoreValue > 0 ? 'score-mate-positive' : 'score-mate-negative',
      }
    }
    const className =
      scoreValue > 50
        ? 'score-positive'
        : scoreValue < -50
          ? 'score-negative'
          : 'score-neutral'
    return {
      text:
        scoreValue === 0
          ? '0'
          : scoreValue > 0
            ? `+${scoreValue}`
            : `${scoreValue}`,
      className,
    }
  })

  const wdlBar = computed(() => {
    const info = latestParsedInfo.value
    if (!info) return null
    const normalized = normalizeWdlForDisplay(info)
    if (!normalized) return null
    const { winPct, drawPct, lossPct } = normalized
    const clampPct = (v: number) => Math.max(0, Math.min(100, v))
    const win = clampPct(winPct)
    const draw = clampPct(drawPct)
    const loss = clampPct(lossPct)
    return { win, draw, loss }
  })

  const hudDisplay = computed(() => {
    const info = latestParsedInfo.value
    const time = info?.time
      ? `${(parseInt(info.time, 10) / 1000).toFixed(1)}s`
      : '--'
    const nps = info?.nps
      ? `${(parseInt(info.nps, 10) / 1_000_000).toFixed(1)}M`
      : info?.nodes
        ? `${(parseInt(info.nodes, 10) / 1_000_000).toFixed(1)}M`
        : '--'
    const depth = info?.depth
      ? `${info.depth}${info.seldepth ? `/${info.seldepth}` : ''}`
      : '--'
    return { time, nps, depth }
  })

  function getRootFenForConversion() {
    let rootFen = isMatchMode.value
      ? gameState.generateFen()
      : engineState.analysisUiFen.value || gameState.generateFen()
    if (!useNewFenFormat.value && gameState.convertFenFormat) {
      rootFen = gameState.convertFenFormat(rootFen, 'new')
    }
    return rootFen
  }

  function buildPvText(info: Record<string, any> | null) {
    if (!info || !info.pv) return ''
    if (showChineseNotation.value) {
      try {
        const rootFen = getRootFenForConversion()
        let pvToConvert: string = info.pv
        if (
          isPondering.value &&
          !isInfinitePondering.value &&
          ponderMove.value &&
          !pvToConvert.startsWith(ponderMove.value)
        ) {
          pvToConvert = `${ponderMove.value} ${pvToConvert}`
        }
        const chineseMoves = uciToChineseMoves(rootFen, pvToConvert)
        return chineseMoves.join(' ')
      } catch (error) {
        console.warn('Failed to convert PV to Chinese notation:', error)
      }
    }
    return info.pv
  }

  const pvDisplay = computed(() => buildPvText(latestParsedInfo.value) || '--')

  const extraInfoDisplay = computed(() => {
    const info = latestParsedInfo.value
    if (!info) return ''
    const parts = [
      info.multipv && `${t('uci.multipv')}: ${info.multipv}`,
      info.wdlWin !== undefined &&
        info.wdlDraw !== undefined &&
        info.wdlLoss !== undefined &&
        (() => {
          const total = info.wdlWin + info.wdlDraw + info.wdlLoss
          if (total > 0) {
            const winPercent = ((info.wdlWin / total) * 100).toFixed(1)
            const drawPercent = ((info.wdlDraw / total) * 100).toFixed(1)
            const lossPercent = ((info.wdlLoss / total) * 100).toFixed(1)
            return `${t('uci.wdl')}: ${winPercent}%/${drawPercent}%/${lossPercent}%`
          }
          return null
        })(),
      info.nodes && `${t('uci.nodes')}: ${info.nodes}`,
      info.nps &&
        `${t('uci.nps')}: ${(parseInt(info.nps, 10) / 1000).toFixed(1)}K`,
      info.hashfull && `${t('uci.hashfull')}: ${info.hashfull}‰`,
      info.tbhits && `${t('uci.tbhits')}: ${info.tbhits}`,
    ].filter(Boolean)
    return parts.join(' | ')
  })

  function formatMoveForDisplay(uciMove: string) {
    if (!uciMove) return '--'
    if (showChineseNotation.value) {
      try {
        const rootFen = getRootFenForConversion()
        const moves = uciToChineseMoves(rootFen, uciMove)
        return moves[0] || uciMove
      } catch (error) {
        console.warn('Failed to convert best move to Chinese notation:', error)
      }
    }
    return uciMove
  }

  const bestMoveDisplay = computed(() => {
    const move = bestMove.value?.trim()
    if (move) return formatMoveForDisplay(move)
    const primaryInfo = latestParsedInfo.value
    if (!primaryInfo?.pv) return '--'
    const pvMoves = primaryInfo.pv.split(' ').filter(Boolean)
    const firstPvMove = pvMoves.length > 0 ? pvMoves[0] : ''
    return firstPvMove ? formatMoveForDisplay(firstPvMove) : '--'
  })

  const multiPvInfos = computed(() => {
    return latestParsedMultiPv.value.map(({ multipv, info }) => {
      const { scoreValue, isMate } = normalizeScoreForDisplay(info)
      const scoreClass =
        scoreValue > 50
          ? 'score-positive'
          : scoreValue < -50
            ? 'score-negative'
            : 'score-neutral'
      const scoreText = isMate
        ? `${scoreValue > 0 ? '+' : '-'}M${Math.abs(scoreValue)}`
        : scoreValue === 0
          ? '0'
          : scoreValue > 0
            ? `+${scoreValue}`
            : `${scoreValue}`
      const pvMoves = info.pv ? info.pv.split(' ').filter(Boolean) : []
      const bestMove = pvMoves[0] ? formatMoveForDisplay(pvMoves[0]) : '--'
      const depthText = info.depth
        ? `${info.depth}${info.seldepth ? `/${info.seldepth}` : ''}`
        : '--'
      return {
        multipv,
        scoreClass,
        scoreText,
        bestMove,
        depthText,
        pvMoves,
      }
    })
  })

  const activePvInfo = computed(() => {
    const active = activeMultipvInfo.value
    return active || null
  })

  function highlightMultipvMove(uciMove?: string) {
    if (!uciMove || uciMove.length < 4) return
    window.dispatchEvent(
      new CustomEvent('highlight-multipv', { detail: { uci: uciMove } })
    )
  }

  function handleSelectMultipv(item: { multipv: number; pvMoves: string[] }) {
    selectedMultipv.value = item.multipv
    if (item.pvMoves?.length) {
      highlightMultipvMove(item.pvMoves[0])
    }
  }

  watch(
    latestParsedMultiPv,
    list => {
      if (!list.length) {
        selectedMultipv.value = null
        return
      }
      if (!selectedMultipv.value) {
        selectedMultipv.value = list[0].multipv
      } else {
        const exists = list.some(item => item.multipv === selectedMultipv.value)
        if (!exists) {
          selectedMultipv.value = list[0].multipv
        }
      }
    },
    { immediate: true }
  )

  watch(
    activePvInfo,
    info => {
      const mv = info?.info?.pv?.split(' ').filter(Boolean)?.[0]
      if (mv) highlightMultipvMove(mv)
    },
    { immediate: true }
  )

  function parseJaiAnalysisInfo(analysisInfo: string): string {
    if (!analysisInfo) return ''
    const lines = analysisInfo
      .split('\n')
      .filter(line => line.trim().length > 0)
    return lines
      .map(line => {
        if (line.startsWith('info ')) {
          if (parseUciInfo.value) {
            const info = parseUciInfoLine(line)
            if (info) return formatUciInfo(info)
          }
          return line
        }
        return line
      })
      .join('<br>')
  }

  import { MATE_SCORE_BASE } from '@/utils/constants'
  function getScoreClass(score: number): string {
    if (score >= MATE_SCORE_BASE - 999) return 'score-mate-positive'
    if (score <= -(MATE_SCORE_BASE - 999)) return 'score-mate-negative'
    if (score > 50) return 'score-positive'
    if (score < -50) return 'score-negative'
    return 'score-neutral'
  }

  function formatScore(score: number): string {
    if (Math.abs(score) >= MATE_SCORE_BASE - 999) {
      const sign = score > 0 ? '+' : '-'
      const ply = Math.max(
        0,
        MATE_SCORE_BASE - Math.min(MATE_SCORE_BASE - 1, Math.abs(score))
      )
      return `${sign}M${ply}`
    }
    return score.toString()
  }

  function formatTime(timeMs: number): string {
    if (timeMs < 1000) return `${timeMs}ms`
    return `${(timeMs / 1000).toFixed(1)}s`
  }

  const hasPositionEdit = computed(() => {
    const end = currentMoveIndex.value
    const h = history.value.slice(0, end)
    return h.some(
      (e: HistoryEntry) =>
        e.type === 'adjust' &&
        typeof e.data === 'string' &&
        e.data.startsWith('position_edit:')
    )
  })

  const isStandardStart = computed(() => {
    return (initialFen.value || '').trim() === START_FEN.trim()
  })

  const shouldShowLuckIndex = computed(() => {
    return (
      isStandardStart.value && !hasPositionEdit.value && showLuckIndex.value
    )
  })

  const revealSequence = computed(() => {
    if (!shouldShowLuckIndex.value) return ''
    const seqChars: string[] = []
    const limit = currentMoveIndex.value
    for (let i = 0; i < limit; i++) {
      const entry = history.value[i]
      if (!entry || entry.type !== 'move') continue
      const uci = (entry.data || '').trim()
      if (uci.length <= 4) continue
      const flipInfo = uci.substring(4)
      const moverIsRed = i % 2 === 0
      for (const ch of flipInfo) {
        const isLetter = ch.toLowerCase() !== ch.toUpperCase()
        if (!isLetter) continue
        const isUpper = ch === ch.toUpperCase()
        const isRevealed = (moverIsRed && isUpper) || (!moverIsRed && !isUpper)
        if (isRevealed) seqChars.push(ch)
      }
    }
    return seqChars.join('')
  })

  function sequenceToFeatures(sequence: string): number[] {
    const features: number[] = []
    const counts = new Array(12).fill(0)
    const timings = new Array(12).fill(0)
    for (let i = 0; i < sequence.length; i++) {
      const piece = sequence[i]
      const idx = PIECE_TO_INDEX[piece]
      if (idx == null) continue
      counts[idx] += 1
      if (timings[idx] === 0) timings[idx] = i + 1
    }
    const totalMoves = sequence.length
    features.push(...counts)
    features.push(...timings)
    features.push(totalMoves)
    return features
  }

  function sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z))
  }

  const luckWinRate = computed(() => {
    if (!shouldShowLuckIndex.value) return 0.5
    const seq = revealSequence.value
    const feats = sequenceToFeatures(seq)
    if (feats.length !== FEATURE_DIM) return 0.5
    const scaled = new Array(FEATURE_DIM)
    for (let i = 0; i < FEATURE_DIM; i++) {
      const scale = (SCALER_SCALES as readonly number[])[i]
      const mean = (SCALER_MEANS as readonly number[])[i]
      scaled[i] = scale !== 0 ? (feats[i] - mean) / scale : feats[i] - mean
    }
    let z = MODEL_INTERCEPT
    for (let i = 0; i < FEATURE_DIM; i++) {
      z += scaled[i] * (MODEL_WEIGHTS as readonly number[])[i]
    }
    return sigmoid(z)
  })

  const luckIndex = computed(() => {
    const v = Math.round((luckWinRate.value - 0.5) * 200)
    return Math.max(-100, Math.min(100, v))
  })

  const luckClass = computed(() => {
    if (luckIndex.value > 5) return 'luck-positive'
    if (luckIndex.value < -5) return 'luck-negative'
    return 'luck-neutral'
  })

  const axisTicks = computed(() => {
    return [
      { pos: 0, label: '-100' },
      { pos: 25, label: '-50' },
      { pos: 50, label: '0' },
      { pos: 75, label: '50' },
      { pos: 100, label: '100' },
    ]
  })

  const markerStyle = computed(() => {
    const pos = (luckIndex.value + 100) / 2
    return {
      left: `calc(${pos}% )`,
    } as Record<string, string>
  })

  function handlePonderAfterMove(uciMove: string, isAiMove: boolean) {
    if ((window as any).__AI_MOVE_FROM_BOOK__) {
      ;(window as any).__AI_MOVE_FROM_BOOK__ = false
      return
    }
    if (isInfinitePondering.value) {
      stopPonder({ playBestMoveOnStop: false })
      return
    }
    if (!enablePonder.value || !isEngineLoaded.value) return
    if (isAiMove) {
      if (pendingFlip.value) {
        return
      }
      setTimeout(() => {
        startPonderAfterAiMove()
      }, 100)
    } else {
      if (isPondering.value) {
        if (isDarkPieceMove(uciMove)) {
          stopPonder({ playBestMoveOnStop: false })
        } else if (isPonderMoveMatch(uciMove)) {
          handlePonderHit()
        } else {
          stopPonder({ playBestMoveOnStop: false })
        }
      }
    }
  }

  function startPonderAfterAiMove() {
    if (!isEngineLoaded.value || isPondering.value) return
    if (!enablePonder.value) return
  }

  const handleOpeningBookMove = (uciMove: string) => {
    if (playMoveFromUci) {
      playMoveFromUci(uciMove)
    }
  }

  function getChineseNotationForMove(moveIndex: number): string {
    if (moveIndex < 0 || moveIndex >= history.value.length) return ''
    const entry = history.value[moveIndex]
    if (entry.type !== 'move') return ''
    try {
      const fenBeforeMove =
        moveIndex === 0 ? initialFen.value : history.value[moveIndex - 1].fen
      const uciMove = isHumanVsAiMode.value
        ? entry.data.slice(0, 4)
        : entry.data
      const chineseMoves = uciToChineseMoves(fenBeforeMove, uciMove)
      return chineseMoves[0] || ''
    } catch (error) {
      return ''
    }
  }
</script>

<style lang="scss">
  .sidebar {
    width: 420px;
    height: calc(100vh - 120px);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-sizing: border-box;
    border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    overflow-y: auto;
    background-color: rgb(var(--v-theme-surface));

    @media (max-width: 768px) {
      width: 100%;
      max-width: 500px;
      height: auto;
      max-height: 60vh;
      border-left: none;
      border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
      margin-top: 20px;
      padding: 10px;
      gap: 6px;
    }
  }

  .engine-management {
    display: flex;
    gap: 8px;
    align-items: center;
    width: 100%;

    .engine-select {
      flex-grow: 1;
    }

    .action-btn {
      flex-shrink: 0;
    }
  }

  .full-btn {
    width: 100%;
  }

  .button-group {
    display: flex;
    gap: 6px;
    width: 100%;

    @media (max-width: 768px) {
      gap: 4px;
    }
  }

  .match-mode-buttons {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;

    @media (max-width: 768px) {
      gap: 4px;
    }
  }

  .grouped-btn {
    flex: 1;

    @media (max-width: 768px) {
      font-size: 11px;
    }
  }

  .half-btn {
    width: 49%;

    @media (max-width: 768px) {
      width: 48%;
      font-size: 11px;
    }
  }
  .section {
    padding-top: 6px;
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }
  .section h3,
  .section-title {
    margin: 0 0 6px;
    padding-bottom: 3px;
    font-size: 0.9rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .analysis-output,
  .move-list {
    padding: 10px;
    border-radius: 5px;
    height: 150px;
    overflow-y: auto;
    font-family: 'Courier New', Courier, monospace;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    font-size: 13px;

    @media (max-width: 768px) {
      height: 120px;
      font-size: 12px;
    }
  }

  .undocked-panel-content .analysis-output,
  .undocked-panel-content .move-list,
  .undocked-panel-content .comments-list,
  .undocked-panel-content .engine-log {
    height: 100% !important;
    max-height: none;
  }

  .analysis-modern {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .analysis-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    background: rgba(var(--v-theme-surface), 0.6);
  }

  .analysis-core {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .score-badge {
    min-width: 80px;
    text-align: center;
    font-size: 28px;
    font-weight: 800;
    padding: 6px 10px;
    border-radius: 10px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    background: rgba(var(--v-theme-surface), 0.8);
  }

  .best-move-box {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .best-move-label {
    font-size: 12px;
    color: rgba(var(--v-theme-on-surface), 0.75);
  }

  .best-move-value {
    font-size: 18px;
    font-weight: 700;
  }

  .analysis-hud {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    padding: 10px;
    border-radius: 8px;
    border: 1px dashed rgba(var(--v-border-color), var(--v-border-opacity));
    background: rgba(var(--v-theme-surface), 0.5);
    font-weight: 600;
  }

  .hud-item {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: center;
  }

  .hud-icon {
    font-size: 14px;
  }

  .wdl-bar {
    position: relative;
    display: flex;
    width: 100%;
    height: 16px;
    border-radius: 8px;
    overflow: visible;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    background: rgba(var(--v-theme-surface), 0.5);
    margin-top: 8px;
  }

  .wdl-segment {
    height: 100%;
  }

  .wdl-segment.win {
    background: #e53935;
  }

  .wdl-segment.draw {
    background: rgba(var(--v-theme-on-surface), 0.35);
  }

  .wdl-segment.loss {
    background: #333;
  }

  .wdl-label {
    position: absolute;
    display: flex;
    flex-direction: column;
    align-items: center;
    transform: translateX(-50%);
    bottom: 100%;
    gap: 2px;
    z-index: 2;
  }

  .wdl-label-text {
    background: rgba(var(--v-theme-surface), 0.9);
    color: rgba(var(--v-theme-on-surface), 0.9);
    padding: 2px 4px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    white-space: nowrap;
  }

  .wdl-label-line {
    width: 1px;
    height: 8px;
    background: rgba(var(--v-theme-on-surface), 0.55);
  }

  .analysis-pv-block {
    border-radius: 8px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    padding: 8px;
    background: rgba(var(--v-theme-surface), 0.45);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .pv-title {
    font-weight: 700;
    font-size: 12px;
  }

  .pv-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .pv-toggle-btn {
    min-width: 28px;
    height: 28px;
  }

  .pv-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .pv-text {
    font-size: 12px;
    line-height: 1.4;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 140px;
    overflow-y: auto;
  }

  .extra-info {
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.8);
    white-space: pre-wrap;
  }

  .multipv-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .multipv-title {
    font-weight: 700;
    font-size: 12px;
  }

  .multipv-rows {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 140px;
    overflow-y: auto;
  }

  .multipv-row {
    display: grid;
    grid-template-columns: 48px 70px 1fr 0.6fr;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    border-radius: 6px;
    background: rgba(var(--v-theme-surface), 0.5);
    font-size: 12px;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .multipv-col {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .multipv-row.active {
    border-color: rgba(var(--v-theme-primary), 0.6);
    background: rgba(var(--v-theme-primary), 0.08);
  }

  .multipv-row:hover {
    border-color: rgba(var(--v-theme-primary), 0.45);
    background: rgba(var(--v-theme-primary), 0.06);
  }

  .multipv-idx {
    font-weight: 700;
    text-align: center;
  }

  .multipv-score {
    font-weight: 700;
  }

  .multipv-move {
    font-weight: 600;
  }

  .multipv-mini {
    font-size: 11px;
    color: rgba(var(--v-theme-on-surface), 0.8);
    text-align: right;
  }

  .score-positive {
    color: #c62828;
    font-weight: bold;
  }

  .score-negative {
    color: #2e7d32;
    font-weight: bold;
  }

  .score-neutral {
    color: rgb(var(--v-theme-on-surface));
  }

  .score-mate-positive {
    color: #b71c1c;
    font-weight: bold;
    background-color: #ffcdd2;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .score-mate-negative {
    color: #1b5e20;
    font-weight: bold;
    background-color: #c8e6c9;
    padding: 1px 4px;
    border-radius: 3px;
  }

  .pv-line {
    color: #1976d2;
    font-weight: normal;
    font-family:
      'Noto Sans SC',
      'Microsoft YaHei',
      'PingFang SC',
      'Hiragino Sans GB',
      'Source Han Sans SC',
      'WenQuanYi Micro Hei',
      'Heiti SC',
      system-ui,
      -apple-system,
      'Segoe UI',
      Roboto,
      Arial,
      sans-serif;
  }

  /* ---------- Luck Index Styles ---------- */
  .luck-index-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .luck-description {
    font-size: 12px;
    color: rgb(var(--v-theme-on-surface));
    opacity: 0.7;
    margin-bottom: 4px;
  }
  .luck-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .luck-row .label {
    font-weight: 600;
    color: rgb(var(--v-theme-on-surface));
    opacity: 0.8;
  }
  .luck-value {
    font-weight: 700;
    font-size: 18px;
  }
  .luck-positive {
    color: #d32f2f;
  }
  .luck-negative {
    color: #2e7d32;
  }
  .luck-neutral {
    color: rgb(var(--v-theme-on-surface));
    opacity: 0.85;
  }
  .luck-axis {
    position: relative;
    height: 42px;
    padding: 10px 0 14px 0;
    margin: 0 4px;
  }
  .axis-track {
    position: absolute;
    left: 4px;
    right: 4px;
    top: 18px;
    height: 6px;
    border-radius: 3px;
    background: linear-gradient(90deg, #2e7d32, #9e9e9e, #d32f2f);
    opacity: 0.9;
  }
  .axis-tick {
    position: absolute;
    top: 10px;
    width: 0;
    height: 18px;
  }
  .axis-tick::before {
    content: '';
    position: absolute;
    left: -1px;
    top: 8px;
    width: 2px;
    height: 12px;
    background: rgba(var(--v-border-color), var(--v-border-opacity));
  }
  .tick-label {
    position: absolute;
    top: 22px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    color: rgb(var(--v-theme-on-surface));
    opacity: 0.8;
    white-space: nowrap;
  }
  .axis-zero {
    position: absolute;
    top: 12px;
    width: 0;
    height: 30px;
    border-left: 2px dashed rgba(var(--v-border-color), var(--v-border-opacity));
  }
  .axis-marker {
    position: absolute;
    top: 2px;
    transform: translateX(-50%);
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 700;
    background: rgba(var(--v-theme-surface), 0.9);
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  }
  .marker-value {
    font-family: 'Courier New', Courier, monospace;
  }
  .luck-legend {
    display: flex;
    justify-content: space-between;
    font-size: 12px;
    color: rgb(var(--v-theme-on-surface));
    opacity: 0.8;
  }

  .wdl-info {
    color: #9c27b0;
    font-weight: bold;
  }
  .move-item {
    display: flex;
    gap: 10px;
    padding: 3px 5px;
    cursor: pointer;
    border-radius: 3px;
  }
  .move-item:hover {
    background-color: rgba(var(--v-theme-primary), 0.1);
  }
  .move-item.current-move {
    background-color: rgba(var(--v-theme-primary), 0.2);
    font-weight: bold;
  }
  .move-number {
    font-weight: bold;
    width: 40px;
    text-align: right;
    white-space: nowrap;
  }
  .move-uci {
    flex: 1;
  }

  .move-chinese {
    font-family:
      'Noto Sans SC',
      'Microsoft YaHei',
      'PingFang SC',
      'Hiragino Sans GB',
      'Source Han Sans SC',
      'WenQuanYi Micro Hei',
      'Heiti SC',
      system-ui,
      -apple-system,
      'Segoe UI',
      Roboto,
      Arial,
      sans-serif;
    font-size: 0.85rem;
    color: rgb(var(--v-theme-secondary));
    font-weight: normal;
    margin-left: 8px;
  }

  .move-annot {
    font-weight: bold;
    font-size: 0.8rem;
    margin-left: 4px;
    padding: 1px 3px;
    border-radius: 2px;
    white-space: nowrap;
  }

  .annot-brilliant {
    color: #0066cc;
  }

  .annot-good {
    color: #00bcd4;
  }

  .annot-interesting {
    color: #8bc34a;
  }

  .annot-dubious {
    color: #ff9800;
  }

  .annot-mistake {
    color: #ff5722;
  }

  .annot-blunder {
    color: #f44336;
  }

  .engine-analysis {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-left: 8px;
    font-size: 11px;
  }

  .engine-score {
    font-weight: bold;
    padding: 1px 3px;
    border-radius: 2px;
    white-space: nowrap;
  }

  .engine-time {
    font-size: 10px;
    white-space: nowrap;
  }
  .move-adjust {
    font-style: italic;
    font-size: 12px;
    width: 100%;
    text-align: center;
  }
  .autoplay-settings {
    display: flex;
    justify-content: space-between;
    gap: 6px;

    @media (max-width: 768px) {
      gap: 4px;
    }
  }

  .switch-row {
    display: flex;
    gap: 8px;
    margin-bottom: 4px;
  }

  .compact-switch {
    flex: 1;
    margin-top: -6px;
    margin-bottom: -4px;
  }

  .compact-switch .v-label {
    font-size: 0.85rem !important;
  }

  .custom-switch {
    margin-top: -6px;
    margin-bottom: -4px;
  }
  .notation-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .notation-header h3 {
    margin: 0;
    font-size: 0.9rem;
  }

  .notation-controls {
    display: flex;
    gap: 2px;
    align-items: center;
  }

  .notation-controls .v-btn {
    min-width: 28px;
    height: 28px;
  }

  .disabled-clicks .move-item {
    pointer-events: none;
    opacity: 0.6;
  }

  .engine-log {
    background-color: #2e2e2e;
    color: #f0f0f0;
    padding: 10px;
    border-radius: 5px;
    height: 150px;
    overflow-y: scroll;
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    white-space: pre-line;

    @media (max-width: 768px) {
      height: 120px;
      font-size: 11px;
    }
  }

  .notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #333;
    color: white;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    z-index: 1000;
    opacity: 0;
    transform: translateY(-20px);
    transition: all 0.3s ease;

    &.show {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .line-sent {
    color: #87cefa;
  }
  .line-sent::before {
    content: '>> ';
  }
  .line-recv {
    color: #b3b3b3;
  }

  .about-section {
    margin-top: auto;
    padding-top: 8px;
    border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }

  .comments-list {
    padding: 10px;
    border-radius: 5px;
    height: 200px;
    overflow-y: auto;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    font-size: 13px;

    @media (max-width: 768px) {
      height: 150px;
      font-size: 12px;
    }
  }

  .comment-item {
    margin-bottom: 8px;
    padding: 8px;
    border-radius: 4px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    background-color: rgba(var(--v-theme-surface), 0.8);
  }

  .comment-item.current-comment {
    background-color: rgba(var(--v-theme-primary), 0.1);
    border-color: rgb(var(--v-theme-primary));
  }

  .comment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 4px;
  }

  .comment-number {
    font-weight: bold;
    font-size: 12px;
  }

  .comment-text {
    font-size: 13px;
    line-height: 1.4;
    word-wrap: break-word;
  }

  .comment-edit {
    margin-top: 4px;
  }

  .comment-toolbar {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }

  .comment-text :deep(h1),
  .comment-text :deep(h2),
  .comment-text :deep(h3),
  .comment-text :deep(h4) {
    margin: 6px 0 4px;
    line-height: 1.2;
  }
  .comment-text :deep(p) {
    margin: 4px 0;
  }
  .comment-text :deep(a) {
    color: rgb(var(--v-theme-primary));
    text-decoration: underline;
  }

  .comment-edit-buttons {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }

  .panel-header .section-title {
    margin: 0;
    padding-left: 8px;
    font-size: 0.9rem;
    flex-grow: 1;
  }

  .match-output {
    padding: 8px;
    font-family: monospace;
    font-size: 12px;
    line-height: 1.4;
  }

  .match-info {
    border-radius: 6px;
    padding: 12px;
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }

  .match-status {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .status-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-line .label {
    font-weight: 600;
    color: rgb(var(--v-theme-on-surface));
    opacity: 0.8;
  }

  .status-line .value {
    font-weight: 500;
    color: rgb(var(--v-theme-primary));
  }

  .no-match-info {
    padding: 20px;
    text-align: center;
    color: rgb(var(--v-theme-on-surface));
    opacity: 0.6;
    font-style: italic;
  }

  .analysis-info {
    margin-top: 12px;
    padding: 8px;
    border-radius: 4px;
    background-color: rgba(var(--v-theme-surface), 0.8);
    border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }

  .info-header {
    font-weight: bold;
    font-size: 12px;
    margin-bottom: 6px;
    color: rgb(var(--v-theme-primary));
  }

  .analysis-line {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    line-height: 1.3;
    white-space: pre-line;
  }

  .notation-controls {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
  }

  .notation-btn {
    flex: 1;
  }

  .notation-info {
    background-color: rgb(var(--v-theme-surface));
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 12px;
    color: rgb(var(--v-theme-on-surface));

    p {
      margin: 4px 0;
      line-height: 1.4;
    }
  }

  .uci-terminal-section {
    margin-top: 8px;
  }
</style>