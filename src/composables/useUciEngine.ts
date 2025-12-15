import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
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

interface UciOption {
  name: string
  type: string
  default: string
  min?: string
  max?: string
  vars?: string[]
  value: string
}

const parseUciOptions = (rawText: string): UciOption[] => {
  const options: UciOption[] = []
  const lines = rawText.trim().split('\n')
  const optionMap: Record<string, UciOption> = {}

  lines.forEach(line => {
    if (!line.startsWith('option name ')) return
    const parts = line.split(/\s+/)
    const nameIndex = parts.indexOf('name') + 1
    const typeIndex = parts.indexOf('type', nameIndex)
    if (typeIndex === -1) return
    const name = parts.slice(nameIndex, typeIndex).join(' ')
    let type = parts[typeIndex + 1]
    let defaultVal = ''
    let min = undefined
    let max = undefined
    let vars: string[] = []
    const defaultIndex = parts.indexOf('default', typeIndex)
    if (defaultIndex !== -1) defaultVal = parts[defaultIndex + 1]
    let currentIndex = defaultIndex !== -1 ? defaultIndex + 2 : typeIndex + 2
    while (currentIndex < parts.length) {
      const keyword = parts[currentIndex]
      if (keyword === 'min') min = parts[currentIndex + 1]
      else if (keyword === 'max') max = parts[currentIndex + 1]
      else if (keyword === 'var') vars.push(parts[currentIndex + 1])
      currentIndex += 2
    }
    if (!optionMap[name]) {
      optionMap[name] = { name, type, default: defaultVal, min, max, vars, value: defaultVal === '<empty>' ? '' : defaultVal }
      options.push(optionMap[name])
    }
  })
  return options
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
  const overriddenOptions = ref<Record<string, string>>({}) 
  const currentEnginePath = ref('')
  const currentSearchMoves = ref<string[]>([])
  const analysisStartTime = ref<number | null>(null)
  const lastAnalysisTime = ref<number>(0)
  const lastRequestedLimits = ref<{ movetime?: number, depth?: number, nodes?: number, maxThinkTime?: number }>({})
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

  const uciOptions = computed<UciOption[]>(() => {
    const opts = parseUciOptions(uciOptionsText.value)
    return opts.map(o => {
      const overrideKey = Object.keys(overriddenOptions.value).find(k => k.toLowerCase() === o.name.toLowerCase())
      if (overrideKey) return { ...o, value: overriddenOptions.value[overrideKey] }
      return o
    })
  })

  const setOption = (name: string, value: any) => {
    const command = `setoption name ${name} value ${value}`
    send(command)
    overriddenOptions.value[name] = String(value)
  }

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
    const piece = gameState.pieces.value.find((p: any) => p.row === displayFromRow && p.col === displayFromCol)
    return !!piece && !piece.isKnown
  }

  const hasMateScore = () => analysisLines.some(line => line.includes('score mate'))
  const getThrottleDelay = () => hasMateScore() ? MATE_OUTPUT_THROTTLE_DELAY : OUTPUT_THROTTLE_DELAY

  const processPendingOutput = () => {
    if (pendingOutputLines.length === 0) return
    const currentTime = Date.now()
    const throttleDelay = getThrottleDelay()
    if (currentTime - lastProcessedTime < throttleDelay) {
      if (outputThrottleTimer) clearTimeout(outputThrottleTimer)
      outputThrottleTimer = setTimeout(processPendingOutput, throttleDelay - (currentTime - lastProcessedTime))
      return
    }

    pendingOutputLines.forEach(raw_ln => {
      engineOutput.value.push({ text: raw_ln, kind: 'recv' })
      if (engineOutput.value.length > 1000) engineOutput.value = engineOutput.value.slice(-500)
      const ln = raw_ln.trim()
      if (!ln) return

      const mpvMatch = ln.match(/\bmultipv\s+(\d+)/)
      const mpvIndex = mpvMatch ? parseInt(mpvMatch[1], 10) - 1 : 0
      const idx = ln.indexOf(' pv ')
      if (idx !== -1) {
        const mvStr = ln.slice(idx + 4).trim()
        const movesArr = mvStr.split(/\s+/)
        if (mpvIndex === 0) pvMoves.value = movesArr
        if (mpvIndex >= multiPvMoves.value.length) multiPvMoves.value.push(movesArr)
        else multiPvMoves.value.splice(mpvIndex, 1, movesArr)
      }
      if (ln.startsWith('info') && ln.includes('score')) {
        analysisLines[mpvIndex] = ln
        analysis.value = analysisLines.filter(Boolean).join('\n')
      }

      // --- XỬ LÝ BESTMOVE (LOGIC QUAN TRỌNG ĐÃ FIX) ---
      if (ln.startsWith('bestmove')) {
        const parts = ln.split(/\s+/)
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
          nextTick(() => window.dispatchEvent(new CustomEvent('engine-stopped-and-ready')))
          
          if (!bestMove.value) return 
        }

        if (!isThinking.value && !isPondering.value && !playOnStop.value && !isStopping.value) return

        if (isPondering.value) {
          isPondering.value = false
          isInfinitePondering.value = false
          ponderhit.value = false
          return
        }

        isThinking.value = false 
        const analysisTime = analysisStartTime.value ? Date.now() - analysisStartTime.value : 0
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
              if (!useNewFenFormat.value) rootFen = convertFenFormat(rootFen, 'new')
              const chineseMoves = uciToChineseMoves(rootFen, mv)
              analysis.value = t('uci.bestMove', { move: chineseMoves[0] || mv })
            } catch (error) { analysis.value = t('uci.bestMove', { move: mv }) }
          } else {
            analysis.value = mv ? t('uci.bestMove', { move: mv }) : t('uci.noMoves')
          }

          // === LOGIC XỬ LÝ QUÂN ÚP (AI ĐÁNH CỜ ZIGA) ===
          if (mv) {
            const from = { 
              col: mv.charCodeAt(0) - 'a'.charCodeAt(0), 
              row: 9 - parseInt(mv[1]) 
            }
            const to = { 
              col: mv.charCodeAt(2) - 'a'.charCodeAt(0), 
              row: 9 - parseInt(mv[3]) 
            }

            const pieces = gameState.pieces.value
            const movingPiece = pieces.find((p: any) => p.row === from.row && p.col === from.col)
            const targetPiece = pieces.find((p: any) => p.row === to.row && p.col === to.col)

            console.log(`[AI] Intent: ${mv} | Moving: ${movingPiece?.name} -> Target: ${targetPiece?.name || 'Empty'}`)

            const doFinalMove = () => {
              console.log("✅ AI Executing Move")
              gameState.move(from, to)
              // Reset selection để tắt vòng tròn sau khi đi xong
              gameState.selectedPieceId.value = null 
            }

            // Sử dụng nextTick để đảm bảo UI không bị lock bởi update trước đó
            nextTick(() => {
                
                // === CASE 1: AI CẦM QUÂN ÚP ĐI ===
                if (movingPiece && !movingPiece.isKnown) {
                    console.log("🛑 AI moves Hidden Piece. Asking User...")
                    
                    // 1. Force Select quân nguồn để vòng tròn hiện đúng chỗ
                    gameState.selectedPieceId.value = movingPiece.id
                    
                    // 2. Lấy phe của quân đang đi (AI side)
                    const side = movingPiece.name.startsWith('red') ? 'red' : 'black'

                    gameState.pendingFlip.value = {
                        side: side,
                        callback: (selectedName: string) => {
                            // Update logic
                            movingPiece.name = selectedName
                            movingPiece.isKnown = true
                            gameState.adjustUnrevealedCount(gameState.getCharFromPieceName(selectedName), -1)
                            gameState.pendingFlip.value = null
                            
                            // Check tiếp xem có ăn quân không
                            if (targetPiece && !targetPiece.isKnown) {
                                // Delay nhỏ để UI cập nhật xong bước 1
                                setTimeout(() => handleTargetFlip(), 50)
                            } else {
                                doFinalMove()
                            }
                        }
                    }
                    return // Dừng flow
                }

                // === CASE 2: AI ĂN QUÂN ÚP ===
                if (targetPiece && !targetPiece.isKnown) {
                    handleTargetFlip()
                    return // Dừng flow
                }

                // === CASE 3: BÌNH THƯỜNG ===
                doFinalMove()
            })

            // Hàm xử lý lật quân đích (bị ăn)
            const handleTargetFlip = () => {
                console.log("🛑 AI captures Hidden Piece. Asking User...")
                
                // 1. Force Select quân BỊ ĂN để vòng tròn hiện ở đó
                gameState.selectedPieceId.value = targetPiece.id

                // 2. Lấy phe của quân BỊ ĂN
                // Logic: Quân bị ăn luôn khác phe với quân đang đi (AI)
                // Lấy phe của AI hiện tại
                const aiSide = gameState.sideToMove.value // 'red' or 'black'
                const targetSide = aiSide === 'red' ? 'black' : 'red'

                gameState.pendingFlip.value = {
                    side: targetSide,
                    callback: (selectedName: string) => {
                        targetPiece.name = selectedName
                        targetPiece.isKnown = true
                        gameState.adjustUnrevealedCount(gameState.getCharFromPieceName(selectedName), -1)
                        gameState.pendingFlip.value = null
                        
                        doFinalMove()
                    }
                }
            }
          }
        }

        bestMove.value = mv
        if (ponderMoveFromEngine) ponderMove.value = ponderMoveFromEngine
        else ponderMove.value = ''
        pvMoves.value = []
        multiPvMoves.value = []
        analysisLines.length = 0
        isInfinitePondering.value = false
      }
      
      if (ln === 'uciok' && !(window as any).__UCI_TERMINAL_ACTIVE__) send('isready')
      if (ln === 'readyok') analysis.value = t('uci.engineReady')
      if (ln.startsWith('option name ')) uciOptionsText.value += ln + '\n'
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

  const loadEngine = async (engine: ManagedEngine) => {
    if (isEngineLoading.value) return
    isEngineLoading.value = true
    isEngineLoaded.value = false
    currentEngine.value = null
    engineOutput.value = []
    uciOptionsText.value = ''
    overriddenOptions.value = {}
    playSoundLoop('loading')
    if (isThinking.value) stopAnalysis({ playBestMoveOnStop: false })
    if (isPondering.value) stopPonder({ playBestMoveOnStop: false })
    await invoke('kill_engine').catch(e => console.warn('Failed to kill previous engine:', e))
    uciOkReceived.value = false
    const uciOkPromise = new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error(`Validation timeout`)), validationTimeout.value)
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
      await invoke('spawn_engine', { path: engine.path, args: engine.args.split(' ').filter(Boolean) })
      send('uci')
      await uciOkPromise
      stopSoundLoop()
      currentEngine.value = engine
      analysis.value = t('uci.engineReady')
      const configManager = useConfigManager()
      await configManager.saveLastSelectedEngineId(engine.id)
      setTimeout(async () => {
        await applySavedSettings()
        try { await sendUciNewGame() } catch (error) { console.error(error) }
        isEngineLoaded.value = true
      }, 100)
    } catch (e: any) {
      stopSoundLoop()
      console.error(e)
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
      if (engineToLoad) await loadEngine(engineToLoad)
      else await configManager.clearLastSelectedEngineId()
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
      const timeoutId = setTimeout(() => reject(new Error('ucinewgame timeout')), 5000)
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

  const startAnalysis = (settings: any = {}, moves: string[] = [], baseFen: string | null = null, searchmoves: string[] = []) => {
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
    const fenToUse = gameState.generateFenForEngine ? gameState.generateFenForEngine(baseFen) : (baseFen ?? generateFen())
    const defaultSettings = { movetime: 1000, maxThinkTime: 5000, maxDepth: 20, maxNodes: 1000000, analysisMode: 'movetime' }
    const finalSettings = { ...defaultSettings, ...settings }
    analysisBaseFen.value = fenToUse
    analysisPrefixMoves.value = [...moves]
    try { analysisUiFen.value = gameState.generateFen() } catch (_) { analysisUiFen.value = '' }
    const pos = `position fen ${fenToUse}${moves.length ? ' moves ' + moves.join(' ') : ''}`
    send(pos)
    const searchMovesStr = searchmoves.length > 0 ? ` searchmoves ${searchmoves.join(' ')}` : ''
    let goCommand = ''
    if (finalSettings.analysisMode === 'advanced') {
      if (finalSettings.movetime > 0) goCommand = `go movetime ${finalSettings.movetime}${searchMovesStr}`
      else goCommand = `go infinite${searchMovesStr}`
    } else {
      switch (finalSettings.analysisMode) {
        case 'depth': goCommand = `go depth ${finalSettings.maxDepth}${searchMovesStr}`; break;
        case 'nodes': goCommand = `go nodes ${finalSettings.maxNodes}${searchMovesStr}`; break;
        case 'maxThinkTime': 
          if (finalSettings.maxThinkTime > 0) goCommand = `go wtime ${finalSettings.maxThinkTime} btime ${finalSettings.maxThinkTime} movestogo 1${searchMovesStr}`;
          else goCommand = `go infinite${searchMovesStr}`;
          break;
        case 'movetime': default:
          if (finalSettings.movetime > 0) goCommand = `go movetime ${finalSettings.movetime}${searchMovesStr}`;
          else goCommand = `go infinite${searchMovesStr}`;
          break;
      }
    }
    send(goCommand)
  }

  const stopAnalysis = (options: { playBestMoveOnStop: boolean } = { playBestMoveOnStop: false }) => {
    if (!isEngineLoaded.value || !isThinking.value || isStopping.value) return
    isStopping.value = true
    playOnStop.value = options.playBestMoveOnStop
    isInfinitePondering.value = false
    resetThrottling()
    send('stop')
  }

  const clearSearchMoves = () => { currentSearchMoves.value = [] }

  const startPonder = (fen: string, moves: string[], expectedMove: string, settings: any = {}) => {
    isInfinitePondering.value = false
    if (!isEngineLoaded.value || isPondering.value) return
    const fenForEngine = gameState.generateFenForEngine ? gameState.generateFenForEngine(fen) : fen
    try { analysisUiFen.value = gameState.generateFen(); analysisPrefixMoves.value = [...moves]; analysisBaseFen.value = fenForEngine } catch (_) { analysisUiFen.value = '' }
    const moveToPonder = expectedMove || ponderMove.value
    if (!isDarkPieceMove(moveToPonder) && moveToPonder) {
      isPondering.value = true
      ponderhit.value = false
      const allMoves = [...moves, expectedMove]
      const pos = `position fen ${fenForEngine}${allMoves.length ? ' moves ' + allMoves.join(' ') : ''}`
      send(pos)
      send('go ponder infinite')
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

  const isPonderMoveMatch = (actualMove: string): boolean => (!ponderMove.value) ? false : actualMove === ponderMove.value

  const unloadEngine = async () => {
    if (!isEngineLoaded.value) return
    if (isThinking.value) stopAnalysis({ playBestMoveOnStop: false })
    if (isPondering.value) stopPonder({ playBestMoveOnStop: false })
    try {
      send('quit')
      await new Promise(resolve => setTimeout(resolve, 100))
      await invoke('kill_engine')
    } catch (error) { console.error(error) }
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
    overriddenOptions.value = {}
    currentEnginePath.value = ''
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
        if (value === '__button__') { send(`setoption name ${name}`); return }
        const command = `setoption name ${name} value ${value}`
        send(command)
        overriddenOptions.value[name] = String(value)
      })
    } catch (error) { console.error(error) }
  }

  onMounted(async () => {
    unlisten = await listen<string>('engine-output', ev => { queueOutputLine(ev.payload) })
    const configManager = useConfigManager()
    await configManager.loadConfig()
    const engines = configManager.getEngines()
    if (engines.length === 0) await configManager.clearLastSelectedEngineId()
    const isMatchMode = (window as any).__MATCH_MODE__ || false
    if (!isMatchMode) autoLoadLastEngine()
    window.addEventListener('match-mode-changed', (event: Event) => {
      const customEvent = event as CustomEvent
      const newMatchMode = customEvent.detail?.isMatchMode || false
      const isStartup = customEvent.detail?.isStartup || false
      if (newMatchMode) {
        if (isEngineLoaded.value && !isStartup) unloadEngine()
      }
    })
  })
  
  onUnmounted(() => {
    unlisten?.()
    invoke('kill_engine')
    resetThrottling()
  })

  return {
    engineOutput, isEngineLoaded, isEngineLoading, bestMove, analysis, isThinking, isStopping, pvMoves, multiPvMoves, analysisBaseFen, analysisPrefixMoves, analysisUiFen, loadEngine, unloadEngine, startAnalysis, stopAnalysis, uciOptionsText, send, sendUciNewGame, currentEnginePath, applySavedSettings, currentSearchMoves, clearSearchMoves, bundleIdentifier, analysisStartTime, lastAnalysisTime, lastRequestedLimits, isPondering, isInfinitePondering, ponderMove, ponderhit, startPonder, handlePonderHit, stopPonder, isPonderMoveMatch, isDarkPieceMove, currentEngine, showChineseNotation, setShowChineseNotation: (value: boolean) => { showChineseNotation.value = value }, uciOptions, setOption,
  }
}