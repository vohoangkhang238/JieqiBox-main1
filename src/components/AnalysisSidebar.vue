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

      <div v-if="!isMatchMode" class="custom-analysis-container">
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
      <div class="move-list" ref="moveListElement" :class="{ 'disabled-clicks': isMatchRunning }">
        <div class="move-item" :class="{ 'current-move': currentMoveIndex === 0 }" @click="handleMoveClick(0)">
          <span class="move-number">{{ $t('analysis.opening') }}</span>
        </div>
        <div v-for="(entry, idx) in history" :key="idx" class="move-item" :class="{ 'current-move': currentMoveIndex === idx + 1 }" @click="handleMoveClick(idx + 1)">
          <template v-if="entry.type === 'move'">
            <span class="move-number">{{ getMoveNumber(idx) }}</span>
            <span class="move-uci">{{ isHumanVsAiMode ? entry.data.slice(0, 4) : entry.data }}</span>
            <span v-if="entry.annotation" class="move-annot" :class="annotationClass(entry.annotation)">{{ entry.annotation }}</span>
            <span v-if="showChineseNotation" class="move-chinese">{{ getChineseNotationForMove(idx) }}</span>
            <div v-if="!isHumanVsAiMode && (entry.engineScore !== undefined || entry.engineTime !== undefined)" class="engine-analysis">
              <span v-if="entry.engineScore !== undefined" class="engine-score" :class="getScoreClass(entry.engineScore)">{{ formatScore(entry.engineScore) }}</span>
              <span v-if="entry.engineTime !== undefined" class="engine-time">{{ formatTime(entry.engineTime) }}</span>
            </div>
          </template>
          <template v-else-if="entry.type === 'adjust'">
            <span class="move-adjust">{{ $t('analysis.adjustment') }}: {{ entry.data }}</span>
          </template>
        </div>
      </div>
    </DraggablePanel>

    <AboutDialog ref="aboutDialogRef" />
    <UciTerminalDialog v-model="showUciTerminalDialog" />
    <JaiOptionsDialog v-if="isMatchMode" v-model="showJaiOptionsDialog" :engine-id="currentJaiEngineId" />
    <EloCalculatorDialog v-model="showEloCalculatorDialog" :initial-wins="jaiEngine?.matchWins?.value || 0" :initial-losses="jaiEngine?.matchLosses?.value || 0" :initial-draws="jaiEngine?.matchDraws?.value || 0" />
    <HumanVsAiModeDialog v-model="showHumanVsAiDialog" @confirm="handleHumanVsAiModeConfirm" />
    <OpeningBookDialog v-model="showOpeningBookDetail" />
  </div>
</template>

<script setup lang="ts">
  import { computed, inject, ref, watch, nextTick, onMounted, onUnmounted, unref } from 'vue'
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
  import { useConfigManager, type ManagedEngine } from '@/composables/useConfigManager'
  import DraggablePanel from './DraggablePanel.vue'
  import { usePanelManager } from '@/composables/usePanelManager'
  import { calculateEloRating, formatEloRating, formatErrorMargin } from '@/utils/eloCalculator'
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
    getPieceNameFromChar,
    sideToMove,
    pendingFlip,
    toggleBoardFlip,
    isBoardFlipped,
    initialFen,
    undoLastMove,
    updateMoveAnnotation,
    generateFen // Cần dùng để lấy FEN cho convert
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

  const showHumanVsAiDialog = ref(false)
  const showOpeningBookPanel = computed(() => showBookMoves.value !== false)
  const showOpeningBookDetail = ref(false)
  const isMatchMode = ref(false)
  const showJaiOptionsDialog = ref(false)
  const showEloCalculatorDialog = ref(false)
  const showUciTerminalDialog = ref(false)
  const aboutDialogRef = ref<any>(null)
  const moveListElement = ref<HTMLElement | null>(null)

  const isMatchRunning = computed(() => jaiEngine?.isMatchRunning?.value || false)
  const currentJaiEngineId = computed(() => jaiEngine?.currentEngine?.value?.id || '')
  const analysisLines = computed(() => {
    return analysis.value
      ? analysis.value.split('\n').filter((l: string) => l.trim().length > 0)
      : []
  })

  // --- LOGIC PARSING MỚI ---

  function parseUciInfoLine(line: string) {
    if (!line.startsWith('info ')) return null
    const result: Record<string, any> = {}
    const regexps = [
      { key: 'depth', re: /depth (\d+)/ },
      { key: 'seldepth', re: /seldepth (\d+)/ },
      { key: 'multipv', re: /multipv (\d+)/ },
      { key: 'score', re: /score (cp|mate) ([\-\d]+)/ },
      { key: 'wdl', re: /wdl (\d+) (\d+) (\d+)/ },
      { key: 'nps', re: /nps (\d+)/ },
      { key: 'time', re: /time (\d+)/ },
    ]
    for (const { key, re } of regexps) {
      const m = line.match(re)
      if (m) {
        if (key === 'score') {
          result['scoreType'] = m[1]; result['scoreValue'] = m[2]
        } else if (key === 'wdl') {
          result['wdlWin'] = parseInt(m[1], 10); result['wdlDraw'] = parseInt(m[2], 10); result['wdlLoss'] = parseInt(m[3], 10)
        } else {
          result[key] = m[1] || m[2]
        }
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
    
    // Fallback nếu không lấy được
    if (!rootFen && initialFen && initialFen.value) rootFen = initialFen.value

    if (!useNewFenFormat.value && gameState.convertFenFormat) {
      rootFen = gameState.convertFenFormat(rootFen, 'new')
    }
    return rootFen
  }

  // --- Computed quan trọng để tạo list data cho giao diện mới ---
  const formattedMultiPvList = computed(() => {
    if (!parseUciInfo.value) return []
    const map = new Map<number, Record<string, any>>()
    
    // Parse ngược để lấy info mới nhất
    for (let i = analysisLines.value.length - 1; i >= 0; i--) {
      const line = analysisLines.value[i]
      if (!line.startsWith('info ')) continue
      const info = parseUciInfoLine(line)
      if (!info) continue
      
      // Nếu không có multipv thì mặc định là 1
      const pvIndex = info.multipv ? parseInt(info.multipv, 10) : 1
      if (!map.has(pvIndex)) {
        map.set(pvIndex, info)
      }
    }

    // Convert map to array and sort by ID
    const items = Array.from(map.values()).sort((a, b) => {
        const idA = a.multipv ? parseInt(a.multipv) : 1
        const idB = b.multipv ? parseInt(b.multipv) : 1
        return idA - idB
    })

    return items.map(info => {
        // 1. Score Processing
        let scoreVal = 0
        let isMate = false
        if (info.scoreType === 'cp') scoreVal = parseInt(info.scoreValue)
        else if (info.scoreType === 'mate') { scoreVal = parseInt(info.scoreValue); isMate = true }
        
        // Flip score logic (giống logic cũ)
        if (isPondering.value && !isInfinitePondering.value) scoreVal = -scoreVal
        if (engineState.analysisUiFen.value.includes(' b ')) scoreVal = -scoreVal
        if (isBoardFlipped.value) scoreVal = -scoreVal

        let scoreText = ''
        let scoreColorClass = 'text-green' // Mặc định xanh theo ảnh
        if (isMate) {
            scoreText = `${scoreVal > 0 ? '+' : '-'}M${Math.abs(scoreVal)}`
            scoreColorClass = scoreVal > 0 ? 'text-mate-win' : 'text-mate-loss'
        } else {
            // Hiển thị điểm số. 
            scoreText = scoreVal.toString()
             // Nếu muốn đổi màu theo điểm (dương/âm) như cũ thì uncomment dòng dưới
             // scoreColorClass = scoreVal > 0 ? 'text-pos' : (scoreVal < 0 ? 'text-neg' : 'text-green')
        }

        // 2. Time (s)
        const timeSec = info.time ? (parseInt(info.time) / 1000).toFixed(1) : '0.0'

        // 3. NPS
        let npsText = '0'
        if (info.nps) {
            const n = parseInt(info.nps)
            npsText = n > 1000000 ? `${(n/1000000).toFixed(1)}M` : `${(n/1000).toFixed(0)}K`
        }

        // 4. WDL (%)
        let wdl = null
        if (info.wdlWin !== undefined) {
            const total = info.wdlWin + info.wdlDraw + info.wdlLoss
            if (total > 0) {
                // Flip WDL if needed
                let w = info.wdlWin, d = info.wdlDraw, l = info.wdlLoss
                const needFlip = (isPondering.value && !isInfinitePondering.value) || engineState.analysisUiFen.value.includes(' b ') || isBoardFlipped.value
                if (needFlip) { const tmp = w; w = l; l = tmp; }
                
                wdl = {
                    win: ((w / total) * 100).toFixed(1),
                    draw: ((d / total) * 100).toFixed(1),
                    loss: ((l / total) * 100).toFixed(1)
                }
            }
        }

        // 5. Moves (Chinese Notation)
        let chineseMoves: string[] = []
        if (info.pv) {
            try {
                const rootFen = getRootFenForConversion()
                let pvStr = info.pv
                // Xử lý ponder move nếu có
                if (isPondering.value && ponderMove.value && !pvStr.startsWith(ponderMove.value)) {
                    pvStr = `${ponderMove.value} ${pvStr}`
                }
                
                // Convert sang tiếng Trung
                chineseMoves = uciToChineseMoves(rootFen, pvStr)
            } catch (e) {
                // Fallback nếu lỗi
                chineseMoves = info.pv.split(' ') 
            }
        }

        return {
            multipv: info.multipv ? parseInt(info.multipv) : 1,
            depth: info.depth || 0,
            score: scoreText,
            scoreColorClass,
            time: timeSec,
            nps: `${npsText}(0)`, // Thêm (0) giả lập hashfull hoặc nút biến thể như ảnh
            wdl,
            chineseMoves,
            rawPv: info.pv
        }
    })
  })

  const selectedMultipv = ref<number | null>(null)
  function handleSelectMultipv(item: any) {
      selectedMultipv.value = item.multipv
      const firstMove = item.rawPv ? item.rawPv.split(' ')[0] : null
      if (firstMove) {
          window.dispatchEvent(new CustomEvent('highlight-multipv', { detail: { uci: firstMove } }))
      }
  }

  // ... (Helper Functions cũ) ...
  function parseJaiAnalysisInfo(info:string) { 
      if (!info) return ''
      return info.split('\n').filter(l=>l.trim()).map(l=>l.startsWith('info ')?l:l).join('<br>') 
  }
  function handleOpeningBookMove(move:string) { if(playMoveFromUci) playMoveFromUci(move) }
  function handleMoveClick(idx:number) { if(!isMatchRunning.value) replayToMove(idx) }
  
  function getMoveNumber(historyIndex: number): string {
    const moveCount = history.value.slice(0, historyIndex + 1).filter((e: any) => e.type === 'move').length
    if (moveCount === 0) return ''
    const moveNumber = Math.floor((moveCount - 1) / 2) + 1
    const isSecondMove = (moveCount - 1) % 2 === 1
    return `${moveNumber}${isSecondMove ? '...' : '.'}`
  }

  function getChineseNotationForMove(moveIndex: number): string {
    if (moveIndex < 0 || moveIndex >= history.value.length) return ''
    const entry = history.value[moveIndex]
    if (entry.type !== 'move') return ''
    try {
      const fenBeforeMove = moveIndex === 0 ? initialFen.value : history.value[moveIndex - 1].fen
      const uciMove = isHumanVsAiMode.value ? entry.data.slice(0, 4) : entry.data
      const chineseMoves = uciToChineseMoves(fenBeforeMove, uciMove)
      return chineseMoves[0] || ''
    } catch (error) { return '' }
  }

  // --- Logic Luck Index ---
  const hasPositionEdit = computed(() => {
    const end = currentMoveIndex.value
    const h = history.value.slice(0, end)
    return h.some((e: any) => e.type === 'adjust' && typeof e.data === 'string' && e.data.startsWith('position_edit:'))
  })
  const isStandardStart = computed(() => (initialFen.value || '').trim() === START_FEN.trim())
  const shouldShowLuckIndex = computed(() => isStandardStart.value && !hasPositionEdit.value && showLuckIndex.value)
  
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
    features.push(...counts, ...timings, sequence.length)
    return features
  }

  function sigmoid(z: number): number { return 1 / (1 + Math.exp(-z)) }

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
    for (let i = 0; i < FEATURE_DIM; i++) { z += scaled[i] * (MODEL_WEIGHTS as readonly number[])[i] }
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

  const axisTicks = computed(() => [
    { pos: 0, label: '-100' }, { pos: 25, label: '-50' }, { pos: 50, label: '0' }, { pos: 75, label: '50' }, { pos: 100, label: '100' }
  ])
  const markerStyle = computed(() => ({ left: `calc(${(luckIndex.value + 100) / 2}% )` }))

  // --- Handlers & Lifecycle ---
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
      const ply = Math.max(0, MATE_SCORE_BASE - Math.min(MATE_SCORE_BASE - 1, Math.abs(score)))
      return `${sign}M${ply}`
    }
    return score.toString()
  }
  function formatTime(ms: number) { return ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s` }

  const handleHumanVsAiModeConfirm = async (settings: any) => {
    const { toggleHumanVsAiMode, setAiSide, toggleShowEngineAnalysis } = useHumanVsAiSettings()
    toggleHumanVsAiMode()
    ;(window as any).__HUMAN_VS_AI_MODE__ = true
    setAiSide(settings.aiSide)
    if (settings.showEngineAnalysis !== showEngineAnalysis.value) toggleShowEngineAnalysis()
    if (flipMode.value !== 'random') flipMode.value = 'random'
  }

  onMounted(async () => {
    try {
      await configManager.loadConfig()
      const matchSettings = configManager.getMatchSettings()
      isMatchMode.value = matchSettings.isMatchMode || false
      ;(window as any).__MATCH_MODE__ = isMatchMode.value
      window.dispatchEvent(new CustomEvent('match-mode-changed', { detail: { isMatchMode: isMatchMode.value, isStartup: true } }))
    } catch (error) { console.error(error) }
  })

  watch(history, () => { nextTick(() => { if (moveListElement.value) moveListElement.value.scrollTop = moveListElement.value.scrollHeight }) }, { deep: true })
</script>

<style lang="scss">
  /* --- CUSTOM STYLE CHO GIAO DIỆN PHÂN TÍCH GIỐNG ẢNH --- */
  .custom-analysis-container {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-bottom: 10px;
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
    /* font-family: 'SimSun', 'Microsoft YaHei', sans-serif;  Font TQ cổ điển */
    font-family: monospace, sans-serif;
    white-space: nowrap;
    letter-spacing: 0.5px;
  }

  /* Text Colors cho Score */
  .text-green { color: inherit; }
  .text-mate-win { color: #d32f2f; }
  .text-mate-loss { color: #1976d2; }
  .text-pos { color: #c62828; }
  .text-neg { color: #2e7d32; }

  .no-data {
    padding: 20px;
    text-align: center;
    color: gray;
    font-style: italic;
    font-size: 12px;
  }

  /* --- CÁC STYLE CŨ --- */
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
      border-left: none;
      margin-top: 10px;
    }
  }

  /* ... (Luck Index styles giữ nguyên) ... */
  .luck-index-panel { display: flex; flex-direction: column; gap: 8px; }
  .luck-description { font-size: 12px; opacity: 0.7; margin-bottom: 4px; }
  .luck-row { display: flex; justify-content: space-between; align-items: center; }
  .luck-value { font-weight: 700; font-size: 18px; }
  .luck-axis { position: relative; height: 42px; padding: 10px 0 14px 0; margin: 0 4px; }
  .axis-track { position: absolute; left: 4px; right: 4px; top: 18px; height: 6px; border-radius: 3px; background: linear-gradient(90deg, #2e7d32, #9e9e9e, #d32f2f); opacity: 0.9; }
  .axis-tick { position: absolute; top: 10px; width: 0; height: 18px; }
  .axis-tick::before { content: ''; position: absolute; left: -1px; top: 8px; width: 2px; height: 12px; background: rgba(var(--v-border-color), var(--v-border-opacity)); }
  .tick-label { position: absolute; top: 22px; left: 50%; transform: translateX(-50%); font-size: 10px; opacity: 0.8; white-space: nowrap; }
  .axis-zero { position: absolute; top: 12px; width: 0; height: 30px; border-left: 2px dashed rgba(var(--v-border-color), var(--v-border-opacity)); }
  .axis-marker { position: absolute; top: 2px; transform: translateX(-50%); padding: 2px 6px; border-radius: 10px; font-size: 12px; font-weight: 700; background: rgba(var(--v-theme-surface), 0.9); border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1); }
  .luck-legend { display: flex; justify-content: space-between; font-size: 12px; opacity: 0.8; }
  .luck-positive { color: #d32f2f; }
  .luck-negative { color: #2e7d32; }
  .luck-neutral { opacity: 0.85; }

  /* ... (Notation styles giữ nguyên) ... */
  .move-list { padding: 5px; height: 150px; overflow-y: auto; border: 1px solid rgba(var(--v-border-color), 0.2); font-size: 13px; }
  .move-item { display: flex; gap: 8px; padding: 2px 4px; cursor: pointer; &.current-move { background: rgba(var(--v-theme-primary), 0.2); font-weight: bold; } }
  .move-number { width: 30px; text-align: right; font-weight: bold; }
  .move-chinese { color: #555; }
  .section h3 { margin: 0; font-size: 0.9rem; }
  .notation-header { display: flex; justify-content: space-between; align-items: center; width: 100%; }
  .notation-controls { display: flex; gap: 2px; align-items: center; }
</style>