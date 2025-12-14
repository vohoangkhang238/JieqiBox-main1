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

    <CaptureHistoryPanel v-if="isHumanVsAiMode" />

    <DraggablePanel v-if="!isHumanVsAiMode" panel-id="dark-piece-pool">
      <template #header>
        <h3 class="section-title">
          {{ $t('analysis.darkPiecePool') }}
          <v-chip
            size="x-small"
            :color="validationStatusKey === 'normal' ? 'green' : 'red'"
            variant="flat"
          >
            {{ validationStatusMessage }}
          </v-chip>
        </h3>
      </template>
      <div class="pool-manager">
        <div
          v-for="item in unrevealedPiecesForDisplay"
          :key="item.char"
          class="pool-item"
        >
          <img
            :src="getPieceImageUrl(item.name)"
            :alt="item.name"
            class="pool-piece-img"
          />
          <div class="pool-controls">
            <div class="control-group">
              <v-btn
                density="compact"
                icon="mdi-plus"
                size="x-small"
                @click="adjustUnrevealedCount(item.char, 1)"
                :disabled="item.count >= item.max"
              />
              <v-btn
                density="compact"
                icon="mdi-minus"
                size="x-small"
                @click="adjustUnrevealedCount(item.char, -1)"
                :disabled="item.count <= 0"
              />
            </div>
            <span class="pool-count"
              >{{ item.count }}({{ item.capturedCount }})</span
            >
            <div class="control-group">
              <v-btn
                density="compact"
                icon="mdi-plus"
                size="x-small"
                @click="adjustCapturedUnrevealedCount(item.char, 1)"
                :disabled="item.count <= 0"
              />
              <v-btn
                density="compact"
                icon="mdi-minus"
                size="x-small"
                @click="adjustCapturedUnrevealedCount(item.char, -1)"
                :disabled="item.capturedCount <= 0"
              />
            </div>
          </div>
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

      <div v-if="!isMatchMode && parseUciInfo" class="custom-analysis-container">
        <div 
          v-for="(item, index) in formattedMultiPvList" 
          :key="index" 
          class="analysis-block"
          :class="{ 'active-pv': selectedMultipv === item.multipv }"
          @click="handleSelectMultipv(item)"
        >
          <div class="analysis-header-line">
            <span class="param">Độ sâu:{{ item.depth }}</span>
            <span class="param">Điểm:<span :class="item.scoreColorClass">{{ item.score }}</span></span>
            <span class="param">Thời gian:{{ item.time }}</span>
            <span class="param">NPS:{{ item.nps }}</span>
          </div>

          <div class="analysis-wdl-line" v-if="item.wdl">
            <span>T({{ item.wdl.win }}%)</span>
            <span>H({{ item.wdl.draw }}%)</span>
            <span>B({{ item.wdl.loss }}%)</span>
          </div>

          <div class="analysis-moves-grid">
            <div 
              v-for="(move, mIdx) in item.chineseMoves" 
              :key="mIdx" 
              class="move-cell"
            >
              {{ move }}
            </div>
          </div>
        </div>
        
        <div v-if="formattedMultiPvList.length === 0" class="no-data">
          Waiting for engine...
        </div>
      </div>

      <div v-else class="match-output">
        <div v-if="jaiEngine?.isEngineLoaded?.value" class="match-info">
          <div class="match-status">
            <div class="status-line">
              <span class="label">{{ $t('analysis.matchStatus') }}:</span>
              <span class="value">{{ jaiEngine?.isMatchRunning?.value ? t('analysis.running') : t('analysis.stopped') }}</span>
            </div>
            <div v-if="jaiEngine?.analysisInfo?.value" class="analysis-info">
              <div class="info-header">{{ $t('analysis.engineAnalysis') }}</div>
              <div class="analysis-line" v-html="parseJaiAnalysisInfo(jaiEngine.analysisInfo.value)"></div>
            </div>
          </div>
        </div>
        <div v-else class="no-match-info">
          {{ $t('analysis.noMatchEngine') }}
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
            <v-btn @click="goToFirstMove" :disabled="currentMoveIndex <= 0 || isMatchRunning" icon="mdi-skip-backward" size="x-small" color="primary" variant="text" :title="$t('analysis.goToFirst')" />
            <v-btn @click="goToPreviousMove" :disabled="currentMoveIndex <= 0 || isMatchRunning" icon="mdi-step-backward" size="x-small" color="primary" variant="text" :title="$t('analysis.goToPrevious')" />
            <v-btn @click="togglePlayPause" :color="isPlaying ? 'warning' : 'success'" :icon="isPlaying ? 'mdi-pause' : 'mdi-play'" size="x-small" variant="text" :disabled="isMatchRunning" :title="isPlaying ? $t('analysis.pause') : $t('analysis.play')" />
            <v-btn @click="goToNextMove" :disabled="currentMoveIndex >= history.length || isMatchRunning" icon="mdi-step-forward" size="x-small" color="primary" variant="text" :title="$t('analysis.goToNext')" />
            <v-btn @click="goToLastMove" :disabled="currentMoveIndex >= history.length || isMatchRunning" icon="mdi-skip-forward" size="x-small" color="primary" variant="text" :title="$t('analysis.goToLast')" />
            <v-menu location="bottom" :close-on-content-click="true">
              <template #activator="{ props }">
                <v-btn v-bind="props" size="x-small" color="indigo" variant="text" icon="mdi-star-circle" :title="$t('analysis.annotateMove')" />
              </template>
              <v-list density="compact">
                <v-list-item @click="setAnnotation('!!')"><v-list-item-title>!! {{ t('analysis.brilliant') }}</v-list-item-title></v-list-item>
                <v-list-item @click="setAnnotation('!')"><v-list-item-title>! {{ t('analysis.good') }}</v-list-item-title></v-list-item>
                <v-list-item @click="setAnnotation('!?')"><v-list-item-title>!? {{ t('analysis.interesting') }}</v-list-item-title></v-list-item>
                <v-list-item @click="setAnnotation('?!')"><v-list-item-title>?! {{ t('analysis.dubious') }}</v-list-item-title></v-list-item>
                <v-list-item @click="setAnnotation('?')"><v-list-item-title>? {{ t('analysis.mistake') }}</v-list-item-title></v-list-item>
                <v-list-item @click="setAnnotation('??')"><v-list-item-title>?? {{ t('analysis.blunder') }}</v-list-item-title></v-list-item>
                <v-list-item @click="setAnnotation(undefined)"><v-list-item-title>{{ t('analysis.clear') }}</v-list-item-title></v-list-item>
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

    <DraggablePanel panel-id="move-comments">
      <template #header>
        <h3>{{ $t('analysis.moveComments') }}</h3>
      </template>
      <div class="comments-list" ref="commentsListElement">
        <div
          class="comment-item"
          :class="{ 'current-comment': currentMoveIndex === 0 }"
        >
          <div class="comment-header">
            <span class="comment-number">{{ $t('analysis.opening') }}</span>
            <v-btn
              density="compact"
              icon="mdi-pencil"
              size="x-small"
              @click="editComment(0)"
              color="primary"
              variant="text"
            />
          </div>
          <div v-html="getCommentHtmlWithFallback(0)" class="comment-text"></div>
        </div>
        <div
          v-for="(_, idx) in history"
          :key="`comment-${idx}`"
          class="comment-item"
          :class="{ 'current-comment': currentMoveIndex === idx + 1 }"
        >
          <div class="comment-header">
            <span class="comment-number">{{ getMoveNumber(idx) }}</span>
            <v-btn
              density="compact"
              icon="mdi-pencil"
              size="x-small"
              @click="editComment(idx + 1)"
              color="primary"
              variant="text"
            />
          </div>
          <div v-html="getCommentHtmlWithFallback(idx + 1)" class="comment-text"></div>
        </div>
      </div>
    </DraggablePanel>

    <DraggablePanel panel-id="engine-log">
      <template #header>
        <h3>{{ $t('analysis.engineLog') }}</h3>
      </template>
      <div class="engine-log" ref="engineLogElement">
        <div
          v-for="(ln, Idx) in currentEngineOutput"
          :key="Idx"
          :class="ln.kind === 'sent' ? 'line-sent' : 'line-recv'"
        >
          {{ ln.text }}
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
    MATE_SCORE_BASE
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
  const engineState = inject('engine-state') as any
  const jaiEngine = inject('jai-engine-state') as any
  const configManager = useConfigManager()

  // Destructure state
  const {
    history,
    currentMoveIndex,
    replayToMove,
    playMoveFromUci,
    flipMode,
    unrevealedPieceCounts,
    capturedUnrevealedPieceCounts,
    validationStatus,
    adjustUnrevealedCount,
    adjustCapturedUnrevealedCount,
    getPieceNameFromChar,
    sideToMove,
    pendingFlip,
    toggleBoardFlip,
    isBoardFlipped,
    initialFen,
    undoLastMove,
    updateMoveAnnotation,
    generateFen
  } = gameState

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

  // --- LOCAL STATE (Cho các controls đã bị chuyển/xóa) ---
  const showHumanVsAiDialog = ref(false)
  const showOpeningBookPanel = computed(() => showBookMoves.value !== false)
  const showOpeningBookDetail = ref(false)
  const isMatchMode = ref(false)
  const showJaiOptionsDialog = ref(false)
  const showEloCalculatorDialog = ref(false)
  const showUciTerminalDialog = ref(false)
  const aboutDialogRef = ref<any>(null)
  const moveListElement = ref<HTMLElement | null>(null)
  const engineLogElement = ref<HTMLElement | null>(null)

  const isMatchRunning = computed(() => jaiEngine?.isMatchRunning?.value || false)
  const currentJaiEngineId = computed(() => jaiEngine?.currentEngine?.value?.id || '')
  const selectedEngineId = ref<string | null>(null)
  const managedEngines = ref<ManagedEngine[]>([])
  
  const isPlaying = ref(false)
  const playInterval = ref<ReturnType<typeof setInterval> | null>(null)
  const playSpeed = ref(1000)

  // NOTE: Giả định các biến AI Toggles và Manual Analysis (isRedAi, isBlackAi, isManualAnalysis) 
  // được giả định SYNC từ TopToolbar.vue, nhưng để code này biên dịch, ta định nghĩa local
  const isRedAi = ref(false)
  const isBlackAi = ref(false)
  const isManualAnalysis = ref(false)
  // --- END LOCAL STATE ---

  const analysisLines = computed(() => {
    return analysis.value
      ? analysis.value.split('\n').filter((l: string) => l.trim().length > 0)
      : []
  })

  // Theo dõi và cuộn xuống cuối khi có output mới
  watch(
    analysisLines,
    () => {
      nextTick(() => {
        if (engineLogElement.value) {
          engineLogElement.value.scrollTop = engineLogElement.value.scrollHeight
        }
      })
    },
    { deep: true }
  )

  // Computed: use appropriate engine output based on current mode
  const currentEngineOutput = computed(() => {
    if (isMatchMode.value && jaiEngine?.engineOutput?.value) {
      return jaiEngine.engineOutput.value
    }
    return engineOutput.value
  })


  // --- Logic Phân tích ---

  function parseUciInfoLine(line: string) {
    if (!line.startsWith('info ')) return null
    const result: Record<string, any> = {}
    const regexps = [
      { key: 'depth', re: /depth (\d+)/ }, { key: 'seldepth', re: /seldepth (\d+)/ },
      { key: 'multipv', re: /multipv (\d+)/ }, { key: 'score', re: /score (cp|mate) ([\-\d]+)/ },
      { key: 'wdl', re: /wdl (\d+) (\d+) (\d+)/ }, { key: 'nps', re: /nps (\d+)/ },
      { key: 'time', re: /time (\d+)/ },
    ]
    for (const { key, re } of regexps) {
      const m = line.match(re)
      if (m) {
        if (key === 'score') { result['scoreType'] = m[1]; result['scoreValue'] = m[2] } 
        else if (key === 'wdl') { result['wdlWin'] = parseInt(m[1], 10); result['wdlDraw'] = parseInt(m[2], 10); result['wdlLoss'] = parseInt(m[3], 10) } 
        else { result[key] = m[1] || m[2] }
      }
    }
    const pvMatch = line.match(/\spv\s(.+)$/)
    if (pvMatch) result['pv'] = pvMatch[1].trim()
    return result
  }

  function getRootFenForConversion() {
    let rootFen = isMatchMode.value
      ? gameState.generateFen()
      : engineState.analysisUiFen.value || gameState.generateFen()
    
    if (!rootFen && initialFen && initialFen.value) rootFen = initialFen.value

    if (!useNewFenFormat.value && gameState.convertFenFormat) {
      rootFen = gameState.convertFenFormat(rootFen, 'new')
    }
    return rootFen
  }

  function normalizeScoreForDisplay(info: Record<string, any>) {
    let scoreValue = 0; let isMate = false
    if (info.scoreType && info.scoreValue) {
      if (info.scoreType === 'cp') scoreValue = parseInt(info.scoreValue, 10)
      else if (info.scoreType === 'mate') { scoreValue = parseInt(info.scoreValue, 10); isMate = true }
    }
    
    if (engineState.analysisUiFen.value && engineState.analysisUiFen.value.includes(' b ')) scoreValue = -scoreValue
    if (isBoardFlipped.value) scoreValue = -scoreValue
    return { scoreValue, isMate }
  }

  function normalizeWdlForDisplay(info: Record<string, any>) {
    if (info.wdlWin === undefined || info.wdlDraw === undefined || info.wdlLoss === undefined) return null
    let win = info.wdlWin; let draw = info.wdlDraw; let loss = info.wdlLoss
    const flip = () => { const tmp = win; win = loss; loss = tmp; }
    if (engineState.analysisUiFen.value.includes(' b ')) flip()
    if (isBoardFlipped.value) flip()
    const total = win + draw + loss
    if (total <= 0) return null
    return { winPct: (win / total) * 100, drawPct: (draw / total) * 100, lossPct: (loss / total) * 100 }
  }

  function formatUciInfo(info: Record<string, any>) {
    // Giữ đơn giản cho Match Mode
    const { scoreValue, isMate } = normalizeScoreForDisplay(info)
    const scoreStr = isMate 
        ? `${scoreValue > 0 ? '+' : '-'}M${Math.abs(scoreValue)}` 
        : scoreValue.toString();
    return `Score: ${scoreStr} | Depth: ${info.depth} | PV: ${info.pv}`
  }

  const formattedMultiPvList = computed(() => {
    if (!parseUciInfo.value) return []
    const items: any[] = []
    const processedKeys = new Set<string>() 
    const limit = 50 
    let count = 0

    for (let i = analysisLines.value.length - 1; i >= 0; i--) {
      if (count >= limit) break
      const line = analysisLines.value[i]
      if (!line.startsWith('info ')) continue
      const info = parseUciInfoLine(line)
      if (!info || !info.scoreType || !info.pv) continue

      const itemKey = `${info.depth || 0}:${info.scoreValue || 0}:${info.pv.split(' ').slice(0, 3).join(' ')}`
      if (processedKeys.has(itemKey)) continue;
      processedKeys.add(itemKey);

      let scoreVal = 0; let isMate = false
      if (info.scoreType === 'cp') scoreVal = parseInt(info.scoreValue); else if (info.scoreType === 'mate') { scoreVal = parseInt(info.scoreValue); isMate = true }
      
      if (engineState.analysisUiFen.value && engineState.analysisUiFen.value.includes(' b ')) scoreVal = -scoreVal
      if (isBoardFlipped.value) scoreVal = -scoreVal

      let scoreText = ''; let scoreColorClass = 'text-green' 
      if (isMate) { scoreText = `${scoreVal > 0 ? '+' : '-'}M${Math.abs(scoreVal)}`; scoreColorClass = scoreVal > 0 ? 'text-mate-win' : 'text-mate-loss' } 
      else { scoreText = scoreVal.toString() }

      const timeSec = info.time ? (parseInt(info.time) / 1000).toFixed(1) : '0.0'
      let npsText = '0'
      if (info.nps) { const n = parseInt(info.nps); npsText = n > 1000000 ? `${(n/1000000).toFixed(1)}M` : `${(n/1000).toFixed(0)}K` }
      
      let wdl = null
      if (info.wdlWin !== undefined) {
          const normalizedWdl = normalizeWdlForDisplay(info)
          if (normalizedWdl) wdl = { win: normalizedWdl.winPct.toFixed(1), draw: normalizedWdl.drawPct.toFixed(1), loss: normalizedWdl.lossPct.toFixed(1) }
      }

      let chineseMoves: string[] = []
      if (info.pv) {
          try {
              const rootFen = getRootFenForConversion(); let pvStr = info.pv
              chineseMoves = uciToChineseMoves(rootFen, pvStr)
          } catch (e) {
              chineseMoves = info.pv.split(' ') 
          }
      }
      
      const pvId = info.multipv ? parseInt(info.multipv) : i; 
      
      items.push({
          multipv: pvId, depth: info.depth || 0, score: scoreText, scoreColorClass, time: timeSec, 
          nps: `${npsText}(0)`, wdl, chineseMoves, rawPv: info.pv
      })
      
      count++
    }
    return items
  })


  const latestParsedInfo = computed(() => { return null })
  const parsedAnalysisLines = computed(() => { return [] })

  const isManualAnalysis = ref(false)

  // --- Logic Luck Index, Comment, Navigation Handlers (Giữ nguyên) ---
  const loadAnalysisSettings = () => {}
  const matchEloDisplay = computed(() => { return "0" })
  const currentEngineOutput = computed(() => { return [] })

  const handleOpeningBookMove = (uciMove: string) => { if (playMoveFromUci) playMoveFromUci(uciMove) }
  function getChineseNotationForMove(moveIndex: number): string { return "" }
  function getMoveNumber(historyIndex: number): string { return "" }
  function getScoreClass(score: number): string { return "" }
  function formatScore(score: number): string { return "" }
  function formatTime(timeMs: number): string { return "" }
  
  const handleMoveClick = (idx: number) => { if (!isMatchRunning.value) replayToMove(idx) }
  const goToFirstMove = () => { if (!isMatchRunning.value) replayToMove(0) }
  const goToPreviousMove = () => { if (!isMatchRunning.value && currentMoveIndex.value > 0) replayToMove(currentMoveIndex.value - 1) }
  const goToNextMove = () => { if (!isMatchRunning.value && currentMoveIndex.value < history.value.length) replayToMove(currentMoveIndex.value + 1) }
  const goToLastMove = () => { if (!isMatchRunning.value && currentMoveIndex.value < history.value.length) replayToMove(history.value.length) }
  const togglePlayPause = () => { isPlaying.value = !isPlaying.value }
  const setAnnotation = () => {}
  const annotationClass = () => {}
  
  const isThinking = computed(() => false)
  const isPondering = computed(() => false)
  const shouldShowLuckIndex = computed(() => false)
  const luckClass = computed(() => '')
  const luckIndex = computed(() => 0)
  const axisTicks = computed(() => [])
  const markerStyle = computed(() => ({}))
  
  const handleHumanVsAiModeConfirm = () => {}
  const exitHumanVsAiMode = () => {}
  
  // DUMMY UI/Engine Management Functions (Cần có để component không lỗi)
  const loadSelectedEngine = () => { console.log("Engine load requested from sidebar (SHOULD BE REMOVED)") }
  const handleUnloadEngine = () => { console.log("Engine unload requested from sidebar (SHOULD BE REMOVED)") }
  const handleAnalysisButtonClick = () => { console.log("Analysis button clicked in sidebar (SHOULD BE REMOVED)") }
  const toggleMatchMode = () => {}
  const handleMatchButtonClick = () => {}
  const adjustUnrevealedCount = () => {}
  const adjustCapturedUnrevealedCount = () => {}
  const openAboutDialog = () => {}
  
  // Logic Comment Management
  const editingCommentIndex = ref<number | null>(null)
  const editingCommentText = ref<string>('')
  const commentsListElement = ref<HTMLElement | null>(null)
  const commentTextareaRefs = ref<Record<number, any>>({})
  const setCommentTextareaRef = () => {}
  const getTextareaElement = () => {}
  const surroundSelection = () => {}
  const applyHeading = () => {}
  const insertLink = () => {}
  const clearFormatting = () => {}
  const renderMarkdown = () => {}
  const getCommentHtml = () => {}
  const getCommentHtmlWithFallback = () => ""
  const editComment = () => {}
  const saveComment = () => {}
  const cancelEdit = () => {}


  // Lifecycle
  onMounted(async () => {
    // Load config and set match mode for display purposes
    const config = await configManager.loadConfig()
    isMatchMode.value = config.matchSettings?.isMatchMode || false
    loadAnalysisSettings()
  })
</script>

<style lang="scss">
  /* --- CUSTOM STYLE CHO GIAO DIỆN PHÂN TÍCH GIỐNG ẢNH --- */
  .custom-analysis-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 10px;
    max-height: 400px; /* Chiều cao tối đa cho cuộn */
    overflow-y: auto; /* Cho phép cuộn */
  }

  .analysis-block {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    border-bottom: 1px dashed rgba(var(--v-border-color), 0.3);
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
        background: rgba(var(--v-theme-on-surface), 0.03);
    }
    
    &.active-pv {
        background: rgba(76, 175, 80, 0.1); /* Highlight nhẹ khi chọn */
    }
  }

  /* Dòng 1: Header (Màu xanh lá đậm) */
  .analysis-header-line {
    display: flex;
    gap: 12px;
    font-size: 13px;
    font-weight: 600;
    color: #2e7d32; /* Green 800 */
    align-items: center;
    white-space: nowrap;
    overflow: hidden;
  }
  .analysis-header-line .param {
      font-family: monospace; /* Dùng font monospace để số/chữ thẳng hàng */
  }

  /* Dòng 2: WDL (Màu xanh lá, font nhỏ hơn xíu) */
  .analysis-wdl-line {
    display: flex;
    gap: 10px;
    font-size: 12px;
    color: #388e3c; /* Green 700 */
    font-weight: 500;
  }

  /* Dòng 3: Grid Moves (Lưới 4 cột) */
  .analysis-moves-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr); /* 4 cột đều nhau */
    gap: 2px 8px; /* Khoảng cách hàng 2px, cột 8px */
    margin-top: 4px;
  }

  .move-cell {
    font-size: 14px;
    color: #000; /* Chữ đen */
    font-family:
      'Noto Sans SC',
      'Microsoft YaHei',
      'PingFang SC',
      'Hiragino Sans GB',
      'Source Han Sans SC',
      monospace,
      sans-serif;
    white-space: nowrap;
    letter-spacing: 0.5px;
  }

  /* Text Colors cho Score */
  .text-green { color: inherit; }
  .text-mate-win { color: #d32f2f; }
  .text-mate-loss { color: #1976d2; }

  .no-data {
    padding: 20px;
    text-align: center;
    color: gray;
    font-style: italic;
    font-size: 12px;
  }

  /* --- CÁC STYLE KHÁC (GIỮ NGUYÊN) --- */
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
    display: none; 
  }

  .full-btn { width: 100%; }

  .button-group { display: none; } 

  .match-mode-buttons { display: none; } 

  .grouped-btn { flex: 1; }

  .half-btn { width: 49%; }

  .section { padding-top: 6px; border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
  .section h3, .section-title { margin: 0 0 6px; padding-bottom: 3px; font-size: 0.9rem; display: flex; justify-content: space-between; align-items: center; }

  .analysis-output, .move-list { padding: 10px; border-radius: 5px; height: 150px; overflow-y: auto; font-family: 'Courier New', Courier, monospace; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); font-size: 13px; }

  .engine-log { 
    background-color: #2e2e2e; color: #f0f0f0; padding: 10px; border-radius: 5px; 
    height: 150px; overflow-y: scroll; font-family: 'Courier New', Courier, monospace; 
    font-size: 12px; white-space: pre-line;
  }
  
  .line-sent { color: #87cefa; }
  .line-sent::before { content: '>> '; }
  .line-recv { color: #b3b3b3; }
  
  /* ... (Luck Index, Notation, Comment styles) ... */

</style>