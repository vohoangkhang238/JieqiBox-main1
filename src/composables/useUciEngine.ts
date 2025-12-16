import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useI18n } from 'vue-i18n'
import { useConfigManager, type ManagedEngine } from './useConfigManager'
import { useInterfaceSettings } from './useInterfaceSettings'
import { useSoundEffects } from './useSoundEffects'
import { uciToChineseMoves } from '@/utils/chineseNotation'
import {
  evaluateAdvancedScript,
  type PrevContext,
} from '@/utils/advancedScriptInterpreter'

export interface EngineLine {
  text: string
  kind: 'sent' | 'recv'
}

// Định nghĩa interface cho Option để TypeScript hiểu
interface UciOptionObj {
  name: string
  value: string | number | boolean
  defaultValue?: string | number | boolean
}

export function useUciEngine(generateFen: () => string, gameState: any) {
  const { t } = useI18n()
  const { useNewFenFormat, validationTimeout } = useInterfaceSettings()
  const { playSoundLoop, stopSoundLoop } = useSoundEffects()
  const { convertFenFormat } = gameState
  const engineOutput = ref<EngineLine[]>([])
  const isEngineLoaded = ref(false)
  const isEngineLoading = ref(false)
  const currentEngine = ref<ManagedEngine | null>(null)
  const uciOkReceived = ref(false)
  const bestMove = ref('')
  const analysis = ref('')
  const isThinking = ref(false)
  const isStopping = ref(false)
  const playOnStop = ref(false)
  const pvMoves = ref<string[]>([])
  const multiPvMoves = ref<string[][]>([])
  const analysisBaseFen = ref<string>('')
  const analysisPrefixMoves = ref<string[]>([])
  const analysisUiFen = ref<string>('')
  const analysisLines: string[] = []
  const uciOptionsText = ref('')
  
  // Bổ sung state uciOptions để Sidebar sử dụng
  const uciOptions = ref<UciOptionObj[]>([])

  const currentEnginePath = ref('')
  const currentSearchMoves = ref<string[]>([])
  const analysisStartTime = ref<number | null>(null)
  const lastAnalysisTime = ref<number>(0)
  const lastRequestedLimits = ref<{
    movetime?: number
    depth?: number
    nodes?: number
    maxThinkTime?: number
  }>({})

  const isPondering = ref(false)
  const isInfinitePondering = ref(false)
  const ponderMove = ref('')
  const ponderhit = ref(false)
  const ignoreNextBestMove = ref(false)

  const bundleIdentifier = ref('')
  const showChineseNotation = ref(false)

  let outputThrottleTimer: ReturnType<typeof setTimeout> | null = null
  let pendingOutputLines: string[] = []
  let lastProcessedTime = 0
  const OUTPUT_THROTTLE_DELAY = 50
  const MATE_OUTPUT_THROTTLE_DELAY = 300

  let unlisten: (() => void) | null = null

  /* ---------- Helper Functions ---------- */
  const isDarkPieceMove = (uciMove: string): boolean => {
    if (!uciMove || uciMove.length < 2) return false
    const logicalFromCol = uciMove.charCodeAt(0) - 'a'.charCodeAt(0)
    const logicalFromRow = 9 - parseInt(uciMove[1], 10)
    let displayFromRow = logicalFromRow
    let displayFromCol = logicalFromCol

    if (gameState.isBoardFlipped.value) {
      displayFromRow = 9 - logicalFromRow
      displayFromCol = 8 - logicalFromCol
    }

    const piece = gameState.pieces.value.find(
      (p: any) => p.row === displayFromRow && p.col === displayFromCol
    )
    const result = !!piece && !piece.isKnown
    return result
  }

  /* ---------- Options Parsing Logic ---------- */
  // Hàm này phân tích chuỗi options text thành mảng object
  const parseUciOptionsToState = () => {
    const lines = uciOptionsText.value.split('\n')
    const opts: UciOptionObj[] = []
    
    for (const line of lines) {
      // Regex đơn giản để lấy name và default
      const nameMatch = line.match(/option name (.+?) type/)
      if (nameMatch) {
        const name = nameMatch[1]
        // Lấy giá trị default
        const defaultMatch = line.match(/default (.+?)(\s+min|\s+max|\s+var|$)/)
        const val = defaultMatch ? defaultMatch[1] : ''
        
        opts.push({
          name: name,
          value: val, // Giá trị hiện tại ban đầu bằng default
          defaultValue: val
        })
      }
    }
    uciOptions.value = opts
  }

  /* ---------- setOption Function ---------- */
  // Hàm này được AnalysisSidebar gọi để set Threads/Hash
  const setOption = (name: string, value: string | number | boolean) => {
    send(`setoption name ${name} value ${value}`)
    
    // Cập nhật state nội bộ để UI phản hồi ngay lập tức
    const opt = uciOptions.value.find(o => o.name === name)
    if (opt) {
      opt.value = value
    }
  }

  /* ---------- Output Throttling Functions ---------- */
  const hasMateScore = () => {
    return analysisLines.some(line => line.includes('score mate'))
  }

  const getThrottleDelay = () => {
    return hasMateScore() ? MATE_OUTPUT_THROTTLE_DELAY : OUTPUT_THROTTLE_DELAY
  }

  const processPendingOutput = () => {
    if (pendingOutputLines.length === 0) return

    const currentTime = Date.now()
    const throttleDelay = getThrottleDelay()

    if (currentTime - lastProcessedTime < throttleDelay) {
      if (outputThrottleTimer) {
        clearTimeout(outputThrottleTimer)
      }
      outputThrottleTimer = setTimeout(
        processPendingOutput,
        throttleDelay - (currentTime - lastProcessedTime)
      )
      return
    }

    pendingOutputLines.forEach(raw_ln => {
      engineOutput.value.push({ text: raw_ln, kind: 'recv' })

      if (engineOutput.value.length > 1000) {
        engineOutput.value = engineOutput.value.slice(-500)
      }

      const ln = raw_ln.trim()
      if (!ln) return

      const mpvMatch = ln.match(/\bmultipv\s+(\d+)/)
      const mpvIndex = mpvMatch ? parseInt(mpvMatch[1], 10) - 1 : 0

      const idx = ln.indexOf(' pv ')
      if (idx !== -1) {
        const mvStr = ln.slice(idx + 4).trim()
        const movesArr = mvStr.split(/\s+/)
        if (mpvIndex === 0) {
          pvMoves.value = movesArr
        }
        if (mpvIndex >= multiPvMoves.value.length) {
          multiPvMoves.value.push(movesArr)
        } else {
          multiPvMoves.value.splice(mpvIndex, 1, movesArr)
        }
      }
      
      if (ln.startsWith('info') && ln.includes('score')) {
        analysisLines[mpvIndex] = ln
        analysis.value = analysisLines.filter(Boolean).join('\n')
      }

      if (ln.startsWith('bestmove')) {
        const parts = ln.split(' ')
        const mv = parts[1] ?? ''
        let ponderMoveFromEngine = ''
        const ponderIndex = parts.indexOf('ponder')
        if (ponderIndex !== -1 && ponderIndex + 1 < parts.length) {
          ponderMoveFromEngine = parts[ponderIndex + 1]
        }

        if (isStopping.value) {
          isThinking.value = false
          isStopping.value = false
          if (ignoreNextBestMove.value) {
            ignoreNextBestMove.value = false
            bestMove.value = ''
          } else if (playOnStop.value) {
            bestMove.value = mv
          } else {
            bestMove.value = ''
          }
          playOnStop.value = false
          nextTick(() => {
            window.dispatchEvent(new CustomEvent('engine-stopped-and-ready'))
          })
          return
        }

        if (!isThinking.value && !isPondering.value) return

        if (isPondering.value) {
          isPondering.value = false
          isInfinitePondering.value = false
          ponderhit.value = false
          return
        }

        isThinking.value = false
        const analysisTime = analysisStartTime.value
          ? Date.now() - analysisStartTime.value
          : 0
        lastAnalysisTime.value = analysisTime
        analysisStartTime.value = null

        const trimmedMv = mv.trim()
        if (trimmedMv === '(none)' || trimmedMv === 'none') {
          analysis.value = t('uci.checkmate')
          send('stop')
        } else {
          if (showChineseNotation && mv) {
            try {
              let rootFen = generateFen()
              if (!useNewFenFormat.value) {
                rootFen = convertFenFormat(rootFen, 'new')
              }
              const chineseMoves = uciToChineseMoves(rootFen, mv)
              const chineseMove = chineseMoves[0] || mv
              analysis.value = t('uci.bestMove', { move: chineseMove })
            } catch (error) {
              analysis.value = t('uci.bestMove', { move: mv })
            }
          } else {
            analysis.value = mv
              ? t('uci.bestMove', { move: mv })
              : t('uci.noMoves')
          }
        }

        bestMove.value = mv
        if (ponderMoveFromEngine) {
          ponderMove.value = ponderMoveFromEngine
        } else {
          ponderMove.value = ''
        }

        pvMoves.value = []
        multiPvMoves.value = []
        analysisLines.length = 0
        isInfinitePondering.value = false
      }
      
      // Khi nhận uciok, thực hiện parse options để cập nhật state
      if (ln === 'uciok') {
        parseUciOptionsToState() // Parse options here
        if (!(window as any).__UCI_TERMINAL_ACTIVE__)
          send('isready')
      }
      
      if (ln === 'readyok') analysis.value = t('uci.engineReady')

      if (ln.startsWith('option name ')) {
        uciOptionsText.value += ln + '\n'
      }
    })

    pendingOutputLines = []
    lastProcessedTime = currentTime
    outputThrottleTimer = null
  }

  const queueOutputLine = (line: string) => {
    pendingOutputLines.push(line)
    if (!outputThrottleTimer) {
      outputThrottleTimer = setTimeout(processPendingOutput, getThrottleDelay())
    }
  }

  const resetThrottling = () => {
    if (outputThrottleTimer) {
      clearTimeout(outputThrottleTimer)
      outputThrottleTimer = null
    }
    pendingOutputLines = []
    lastProcessedTime = 0
  }

  /* ---------- Engine Loading and Validation ---------- */
  const loadEngine = async (engine: ManagedEngine) => {
    if (isEngineLoading.value) return
    isEngineLoading.value = true
    isEngineLoaded.value = false
    currentEngine.value = null
    engineOutput.value = []
    uciOptionsText.value = ''
    uciOptions.value = [] // Reset options

    playSoundLoop('loading')

    if (isThinking.value) stopAnalysis({ playBestMoveOnStop: false })
    if (isPondering.value) stopPonder({ playBestMoveOnStop: false })
    await invoke('kill_engine').catch(e => console.warn(e))

    uciOkReceived.value = false

    const uciOkPromise = new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Validation timeout`))
      }, validationTimeout.value)

      listen<string>('engine-output', event => {
        if (event.payload.trim() === 'uciok') {
          uciOkReceived.value = true
          clearTimeout(timeoutId)
          resolve()
        }
      }).then(unsub => {
        const cleanup = () => unsub()
        uciOkPromise.finally(cleanup)
      })
    })

    try {
      await invoke('spawn_engine', {
        path: engine.path,
        args: engine.args.split(' ').filter(Boolean),
      })

      send('uci')
      await uciOkPromise

      stopSoundLoop()

      currentEngine.value = engine
      analysis.value = t('uci.engineReady')

      const configManager = useConfigManager()
      await configManager.saveLastSelectedEngineId(engine.id)

      setTimeout(async () => {
        await applySavedSettings()

        try {
          await sendUciNewGame()
        } catch (error) {
          console.error(error)
        }

        isEngineLoaded.value = true
      }, 100)
    } catch (e: any) {
      stopSoundLoop()
      alert(t('errors.engineLoadFailed', { name: engine.name, error: e.message || e }))
      isEngineLoaded.value = false
      const configManager = useConfigManager()
      await configManager.clearLastSelectedEngineId()
      await invoke('kill_engine')
    } finally {
      isEngineLoading.value = false
    }
  }

  const autoLoadLastEngine = async () => {
    const matchMode = (window as any).__MATCH_MODE__
    if (matchMode) return

    const configManager = useConfigManager()
    await configManager.loadConfig()
    const lastEngineId = configManager.getLastSelectedEngineId()
    if (lastEngineId) {
      const engines = configManager.getEngines()
      const engineToLoad = engines.find(e => e.id === lastEngineId)
      if (engineToLoad) {
        await loadEngine(engineToLoad)
      } else {
        await configManager.clearLastSelectedEngineId()
      }
    }
  }

  const send = (cmd: string) => {
    engineOutput.value.push({ text: cmd, kind: 'sent' })

    if (cmd.startsWith('setoption name MultiPV value ')) {
      analysisLines.length = 0
      multiPvMoves.value = []
      analysis.value = ''
    }

    invoke('send_to_engine', { command: cmd }).catch(e => console.warn(e))
  }

  const sendUciNewGame = async (): Promise<void> => {
    if (!currentEngine.value) return
    send('ucinewgame')
    send('isready')

    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('ucinewgame timeout'))
      }, 5000)

      listen<string>('engine-output', event => {
        if (event.payload.trim() === 'readyok') {
          clearTimeout(timeoutId)
          resolve()
        }
      }).then(unlisten => {
          timeoutId && clearTimeout(timeoutId)
          return unlisten
      }).catch(e => {
          clearTimeout(timeoutId)
          reject(e)
      })
    })
  }

  const startAnalysis = (
    settings: any = {},
    moves: string[] = [],
    baseFen: string | null = null,
    searchmoves: string[] = []
  ) => {
    if (!isEngineLoaded.value || isThinking.value) return

    isThinking.value = true
    isStopping.value = false
    playOnStop.value = false
    isInfinitePondering.value = false
    analysisStartTime.value = Date.now()

    resetThrottling()

    analysisLines.length = 0
    multiPvMoves.value = []
    analysis.value = ''

    currentSearchMoves.value = [...searchmoves]

    const fenToUse = gameState.generateFenForEngine
      ? gameState.generateFenForEngine(baseFen)
      : (baseFen ?? generateFen())

    const defaultSettings = {
      movetime: 1000,
      maxThinkTime: 5000,
      maxDepth: 20,
      maxNodes: 1000000,
      analysisMode: 'movetime',
    }

    const finalSettings = { ...defaultSettings, ...settings }

    analysisBaseFen.value = fenToUse
    analysisPrefixMoves.value = [...moves]
    try {
      analysisUiFen.value = gameState.generateFen()
    } catch (_) {
      analysisUiFen.value = ''
    }

    const pos = `position fen ${fenToUse}${moves.length ? ' moves ' + moves.join(' ') : ''}`
    send(pos)

    const searchMovesStr = searchmoves.length > 0 ? ` searchmoves ${searchmoves.join(' ')}` : ''
    let goCommand = ''

    if (finalSettings.analysisMode === 'advanced') {
      try {
        const history = gameState.history?.value || []
        const idx = gameState.currentMoveIndex?.value || history.length
        const getPrevWrapper = (offset: number): PrevContext => {
          const i = idx - 1 - offset
          const exists = i >= 0 && i < history.length && history[i]?.type === 'move'
          const entry = exists ? history[i] : undefined
          return {
            exists: () => !!exists,
            get movetime() { return (entry?.engineRequestedMovetime ?? 0) * 1.0 },
            get depth() { return (entry?.engineDepth ?? 0) * 1.0 },
            get nodes() { return (entry?.engineNodes ?? 0) * 1.0 },
            get score() { return (entry?.engineScore ?? 0) * 1.0 },
            get timeUsed() { return (entry?.engineTime ?? 0) * 1.0 },
            get prev() { return getPrevWrapper(offset + 1) },
          }
        }

        const prevCtx = getPrevWrapper(0)
        const code: string = String(finalSettings.advancedScript || '')
        const result = evaluateAdvancedScript(code, prevCtx) || {}

        const advMovetime = result.movetime || 0
        const advDepth = result.depth || 0
        const advNodes = result.nodes || 0
        const advMaxThinkTime = result.maxThinkTime || 0

        const parts: string[] = []
        if (advDepth > 0) parts.push(`depth ${Math.floor(advDepth)}`)
        if (advNodes > 0) parts.push(`nodes ${Math.floor(advNodes)}`)
        if (advMovetime > 0) parts.push(`movetime ${Math.floor(advMovetime)}`)
        if (advMaxThinkTime > 0) {
          parts.push(`wtime ${Math.floor(advMaxThinkTime)} btime ${Math.floor(advMaxThinkTime)} movestogo 1`)
        }
        lastRequestedLimits.value = {
          movetime: advMovetime > 0 ? Math.floor(advMovetime) : undefined,
          depth: advDepth > 0 ? Math.floor(advDepth) : undefined,
          nodes: advNodes > 0 ? Math.floor(advNodes) : undefined,
          maxThinkTime: advMaxThinkTime > 0 ? Math.floor(advMaxThinkTime) : undefined,
        }
        const searchMovesStr2 = searchmoves.length > 0 ? ` searchmoves ${searchmoves.join(' ')}` : ''
        goCommand = `go ${parts.join(' ')}${searchMovesStr2}`.trim()
        if (goCommand === 'go') goCommand = `go infinite${searchMovesStr2}`
      } catch (e) {
        const searchMovesStr2 = searchmoves.length > 0 ? ` searchmoves ${searchmoves.join(' ')}` : ''
        if (finalSettings.movetime > 0) {
          lastRequestedLimits.value = { movetime: Math.floor(finalSettings.movetime) }
          goCommand = `go movetime ${finalSettings.movetime}${searchMovesStr2}`
        } else {
          lastRequestedLimits.value = {}
          goCommand = `go infinite${searchMovesStr2}`
        }
      }
    } else
      switch (finalSettings.analysisMode) {
        case 'depth':
          lastRequestedLimits.value = { depth: Math.floor(finalSettings.maxDepth) }
          goCommand = `go depth ${finalSettings.maxDepth}${searchMovesStr}`
          break
        case 'nodes':
          lastRequestedLimits.value = { nodes: Math.floor(finalSettings.maxNodes) }
          goCommand = `go nodes ${finalSettings.maxNodes}${searchMovesStr}`
          break
        case 'maxThinkTime':
          if (finalSettings.maxThinkTime > 0) {
            lastRequestedLimits.value = { maxThinkTime: Math.floor(finalSettings.maxThinkTime) }
            goCommand = `go wtime ${finalSettings.maxThinkTime} btime ${finalSettings.maxThinkTime} movestogo 1${searchMovesStr}`
          } else {
            lastRequestedLimits.value = {}
            goCommand = `go infinite${searchMovesStr}`
          }
          break
        case 'movetime':
        default:
          if (finalSettings.movetime > 0) {
            lastRequestedLimits.value = { movetime: Math.floor(finalSettings.movetime) }
            goCommand = `go movetime ${finalSettings.movetime}${searchMovesStr}`
          } else {
            lastRequestedLimits.value = {}
            goCommand = `go infinite${searchMovesStr}`
          }
          break
      }
    send(goCommand)
  }

  const stopAnalysis = (
    options: { playBestMoveOnStop: boolean } = { playBestMoveOnStop: false }
  ) => {
    if (!isEngineLoaded.value || !isThinking.value || isStopping.value) return
    isStopping.value = true
    playOnStop.value = options.playBestMoveOnStop
    isInfinitePondering.value = false
    resetThrottling()
    send('stop')
  }

  const clearSearchMoves = () => {
    currentSearchMoves.value = []
  }

  const startPonder = (
    fen: string,
    moves: string[],
    expectedMove: string,
    settings: any = {}
  ) => {
    isInfinitePondering.value = false
    if (!isEngineLoaded.value || isPondering.value) return

    const fenForEngine = gameState.generateFenForEngine
      ? gameState.generateFenForEngine(fen)
      : fen

    try {
      analysisUiFen.value = gameState.generateFen()
      analysisPrefixMoves.value = [...moves]
      analysisBaseFen.value = fenForEngine
    } catch (_) {
      analysisUiFen.value = ''
    }

    const moveToPonder = expectedMove || ponderMove.value
    if (!isDarkPieceMove(moveToPonder) && moveToPonder) {
      isPondering.value = true
      ponderhit.value = false
      const allMoves = [...moves, expectedMove]
      const pos = `position fen ${fenForEngine}${allMoves.length ? ' moves ' + allMoves.join(' ') : ''}`
      send(pos)

      const defaultSettings = { movetime: 1000, maxThinkTime: 5000, maxDepth: 20, maxNodes: 1000000, analysisMode: 'movetime' }
      const finalSettings = { ...defaultSettings, ...settings }

      let goCommand = 'go ponder'
      switch (finalSettings.analysisMode) {
        case 'depth': goCommand = `go ponder depth ${finalSettings.maxDepth}`; break;
        case 'nodes': goCommand = `go ponder nodes ${finalSettings.maxNodes}`; break;
        case 'maxThinkTime':
          goCommand = finalSettings.maxThinkTime > 0 
            ? `go ponder wtime ${finalSettings.maxThinkTime} btime ${finalSettings.maxThinkTime} movestogo 1`
            : `go ponder infinite`;
          break;
        case 'movetime':
        default:
          goCommand = finalSettings.movetime > 0
            ? `go ponder movetime ${finalSettings.movetime}`
            : `go ponder infinite`;
          break;
      }
      send(goCommand)
    } else {
      isInfinitePondering.value = true
      isPondering.value = true
      const pos = `position fen ${fenForEngine}${moves.length ? ' moves ' + moves.join(' ') : ''}`
      send(pos)
      send('go infinite')
    }
  }

  const handlePonderHit = () => {
    if (!isPondering.value) return
    ponderhit.value = true
    isInfinitePondering.value = false
    isPondering.value = false
    isThinking.value = true
    analysisStartTime.value = Date.now()
    send('ponderhit')
  }

  const stopPonder = (options: { playBestMoveOnStop?: boolean } = {}) => {
    if (!isPondering.value) return
    const { playBestMoveOnStop = false } = options
    isPondering.value = false
    isStopping.value = true
    isInfinitePondering.value = false

    if (ponderhit.value && playBestMoveOnStop) {
      ignoreNextBestMove.value = false
      playOnStop.value = true
    } else {
      ignoreNextBestMove.value = true
      bestMove.value = ''
      playOnStop.value = false
    }
    ponderhit.value = false
    ponderMove.value = ''
    send('stop')
  }

  const isPonderMoveMatch = (actualMove: string): boolean => {
    if (!ponderMove.value) return false
    return actualMove === ponderMove.value
  }

  const unloadEngine = async () => {
    if (!isEngineLoaded.value) return
    if (isThinking.value) stopAnalysis({ playBestMoveOnStop: false })
    if (isPondering.value) stopPonder({ playBestMoveOnStop: false })

    try {
      send('quit')
      await new Promise(resolve => setTimeout(resolve, 100))
      await invoke('kill_engine')
    } catch (error) {
      console.error(error)
    }

    isEngineLoaded.value = false
    isEngineLoading.value = false
    currentEngine.value = null
    isThinking.value = false
    isPondering.value = false
    isInfinitePondering.value = false
    bestMove.value = ''
    analysis.value = ''
    engineOutput.value = []
    pvMoves.value = []
    multiPvMoves.value = []
    analysisLines.length = 0
    ponderMove.value = ''
    ponderhit.value = false
    isStopping.value = false
    playOnStop.value = false
    ignoreNextBestMove.value = false
    analysisStartTime.value = null
    lastAnalysisTime.value = 0
    currentSearchMoves.value = []
    uciOptionsText.value = ''
    currentEnginePath.value = ''
    uciOptions.value = [] // clear options

    const configManager = useConfigManager()
    await configManager.clearLastSelectedEngineId()
  }

  const applySavedSettings = async () => {
    if (!currentEngine.value) return
    try {
      const configManager = useConfigManager()
      await configManager.loadConfig()
      const savedUciOptions = configManager.getUciOptions(currentEngine.value.id)
      if (Object.keys(savedUciOptions).length === 0) return

      Object.entries(savedUciOptions).forEach(([name, value]) => {
        if (value === '__button__') {
          const command = `setoption name ${name}`
          send(command)
          return
        }
        // Sử dụng hàm setOption để cập nhật cả local state
        setOption(name, value) 
      })
    } catch (error) {
      console.error(error)
    }
  }

  onMounted(async () => {
    unlisten = await listen<string>('engine-output', ev => {
      const raw_ln = ev.payload
      queueOutputLine(raw_ln)
    })

    const configManager = useConfigManager()
    await configManager.loadConfig()
    const engines = configManager.getEngines()
    if (engines.length === 0) {
      await configManager.clearLastSelectedEngineId()
    }

    const isMatchMode = (window as any).__MATCH_MODE__ || false
    if (!isMatchMode) {
      autoLoadLastEngine()
    }

    window.addEventListener('match-mode-changed', (event: Event) => {
      const customEvent = event as CustomEvent
      const newMatchMode = customEvent.detail?.isMatchMode || false
      const isStartup = customEvent.detail?.isStartup || false
      if (newMatchMode && isEngineLoaded.value && !isStartup) {
        unloadEngine()
      }
    })
  })

  onUnmounted(() => {
    unlisten?.()
    invoke('kill_engine')
    resetThrottling()
  })

  return {
    engineOutput,
    isEngineLoaded,
    isEngineLoading,
    bestMove,
    analysis,
    isThinking,
    isStopping,
    pvMoves,
    multiPvMoves,
    analysisBaseFen,
    analysisPrefixMoves,
    analysisUiFen,
    loadEngine,
    unloadEngine,
    startAnalysis,
    stopAnalysis,
    uciOptionsText,
    send,
    sendUciNewGame,
    currentEnginePath,
    applySavedSettings,
    currentSearchMoves,
    clearSearchMoves,
    bundleIdentifier,
    analysisStartTime,
    lastAnalysisTime,
    lastRequestedLimits,
    isPondering,
    isInfinitePondering,
    ponderMove,
    ponderhit,
    startPonder,
    handlePonderHit,
    stopPonder,
    isPonderMoveMatch,
    isDarkPieceMove,
    currentEngine,
    showChineseNotation,
    setShowChineseNotation: (value: boolean) => {
      showChineseNotation.value = value
    },
    // Export các thành phần mới thêm
    uciOptions,
    setOption,
  }
}