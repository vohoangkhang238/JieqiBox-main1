import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useI18n } from 'vue-i18n'
import { useConfigManager, type ManagedEngine } from './useConfigManager'
import { useInterfaceSettings } from './useInterfaceSettings'
import { useSoundEffects } from './useSoundEffects'
import { uciToChineseMoves } from '@/utils/chineseNotation'
import { evaluateAdvancedScript, type PrevContext } from '@/utils/advancedScriptInterpreter'

export interface EngineLine { text: string; kind: 'sent' | 'recv' }
interface UciOption { name: string; type: string; default: string; min?: string; max?: string; vars?: string[]; value: string }

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
    let defaultVal = ''; let min = undefined; let max = undefined; let vars: string[] = []
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
  const isEngineLoaded = ref(false); const isEngineLoading = ref(false)
  const currentEngine = ref<ManagedEngine | null>(null)
  const uciOkReceived = ref(false); const bestMove = ref(''); const analysis = ref('')
  const isThinking = ref(false); const isStopping = ref(false); const playOnStop = ref(false)
  const pvMoves = ref<string[]>([]); const multiPvMoves = ref<string[][]>([])
  const analysisBaseFen = ref<string>(''); const analysisPrefixMoves = ref<string[]>([]); const analysisUiFen = ref<string>('')
  const analysisLines: string[] = []; const uciOptionsText = ref(''); const overriddenOptions = ref<Record<string, string>>({}) 
  const currentEnginePath = ref(''); const currentSearchMoves = ref<string[]>([])
  const analysisStartTime = ref<number | null>(null); const lastAnalysisTime = ref<number>(0)
  const lastRequestedLimits = ref<{ movetime?: number, depth?: number, nodes?: number, maxThinkTime?: number }>({})
  const isPondering = ref(false); const isInfinitePondering = ref(false); const ponderMove = ref(''); const ponderhit = ref(false); const ignoreNextBestMove = ref(false)
  const bundleIdentifier = ref(''); const showChineseNotation = ref(false)

  let outputThrottleTimer: ReturnType<typeof setTimeout> | null = null
  let pendingOutputLines: string[] = []; let lastProcessedTime = 0
  const OUTPUT_THROTTLE_DELAY = 50; const MATE_OUTPUT_THROTTLE_DELAY = 300
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
    const command = `setoption name ${name} value ${value}`; send(command)
    overriddenOptions.value[name] = String(value)
  }

  const isDarkPieceMove = (uciMove: string): boolean => {
    if (!uciMove || uciMove.length < 2) return false
    const logicalFromCol = uciMove.charCodeAt(0) - 'a'.charCodeAt(0)
    const logicalFromRow = 9 - parseInt(uciMove[1], 10)
    let displayFromRow = logicalFromRow; let displayFromCol = logicalFromCol
    if (gameState.isBoardFlipped.value) { displayFromRow = 9 - logicalFromRow; displayFromCol = 8 - logicalFromCol }
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
      const ln = raw_ln.trim(); if (!ln) return
      const mpvMatch = ln.match(/\bmultipv\s+(\d+)/); const mpvIndex = mpvMatch ? parseInt(mpvMatch[1], 10) - 1 : 0
      const idx = ln.indexOf(' pv ')
      if (idx !== -1) {
        const mvStr = ln.slice(idx + 4).trim(); const movesArr = mvStr.split(/\s+/)
        if (mpvIndex === 0) pvMoves.value = movesArr
        if (mpvIndex >= multiPvMoves.value.length) multiPvMoves.value.push(movesArr)
        else multiPvMoves.value.splice(mpvIndex, 1, movesArr)
      }
      if (ln.startsWith('info') && ln.includes('score')) {
        analysisLines[mpvIndex] = ln; analysis.value = analysisLines.filter(Boolean).join('\n')
      }

      // --- XỬ LÝ BESTMOVE (LOGIC QUAN TRỌNG) ---
      if (ln.startsWith('bestmove')) {
        const parts = ln.split(/\s+/); const mv = parts[1] ?? ''
        let ponderMoveFromEngine = ''; const ponderIndex = parts.indexOf('ponder')
        if (ponderIndex !== -1 && ponderIndex + 1 < parts.length) ponderMoveFromEngine = parts[ponderIndex + 1]

        if (isStopping.value) {
          isThinking.value = false; isStopping.value = false
          if (ignoreNextBestMove.value) { ignoreNextBestMove.value = false; bestMove.value = '' }
          else if (playOnStop.value) { bestMove.value = mv }
          else { bestMove.value = '' }
          playOnStop.value = false
          nextTick(() => window.dispatchEvent(new CustomEvent('engine-stopped-and-ready')))
          if (!bestMove.value) return 
        }

        if (!isThinking.value && !isPondering.value && !playOnStop.value && !isStopping.value) return
        if (isPondering.value) { isPondering.value = false; isInfinitePondering.value = false; ponderhit.value = false; return }

        isThinking.value = false
        lastAnalysisTime.value = analysisStartTime.value ? Date.now() - analysisStartTime.value : 0
        analysisStartTime.value = null

        const trimmedMv = mv.trim()
        if (trimmedMv === '(none)' || trimmedMv === 'none') {
          analysis.value = t('uci.checkmate'); send('stop')
        } else {
          if (showChineseNotation && mv) {
            try {
              let rootFen = generateFen()
              if (!useNewFenFormat.value) rootFen = convertFenFormat(rootFen, 'new')
              const chineseMoves = uciToChineseMoves(rootFen, mv)
              analysis.value = t('uci.bestMove', { move: chineseMoves[0] || mv })
            } catch (error) { analysis.value = t('uci.bestMove', { move: mv }) }
          } else { analysis.value = mv ? t('uci.bestMove', { move: mv }) : t('uci.noMoves') }

          // === LOGIC XỬ LÝ QUÂN ÚP & GỬI TỌA ĐỘ ===
          if (mv) {
            const from = { col: mv.charCodeAt(0) - 'a'.charCodeAt(0), row: 9 - parseInt(mv[1]) }
            const to = { col: mv.charCodeAt(2) - 'a'.charCodeAt(0), row: 9 - parseInt(mv[3]) }
            const pieces = gameState.pieces.value
            const movingPiece = pieces.find((p: any) => p.row === from.row && p.col === from.col)
            const targetPiece = pieces.find((p: any) => p.row === to.row && p.col === to.col)

            const doFinalMove = () => { gameState.move(from, to); gameState.selectedPieceId.value = null }

            nextTick(() => {
                // 1. AI CẦM QUÂN ÚP ĐI
                if (movingPiece && !movingPiece.isKnown) {
                    const side = movingPiece.name.startsWith('red') ? 'red' : 'black'
                    gameState.pendingFlip.value = {
                        side: side,
                        // --- GỬI KÈM TOẠ ĐỘ QUÂN CẦN LẬT ---
                        row: movingPiece.row,
                        col: movingPiece.col,
                        callback: (selectedName: string) => {
                            movingPiece.name = selectedName; movingPiece.isKnown = true
                            gameState.adjustUnrevealedCount(gameState.getCharFromPieceName(selectedName), -1)
                            gameState.pendingFlip.value = null
                            setTimeout(() => { if (targetPiece && !targetPiece.isKnown) handleTargetFlip(side); else doFinalMove() }, 50)
                        }
                    }
                    return
                }
                // 2. AI ĂN QUÂN ÚP
                if (targetPiece && !targetPiece.isKnown) {
                    const attackerColor = movingPiece.name.startsWith('red') ? 'red' : 'black'
                    handleTargetFlip(attackerColor)
                    return
                }
                doFinalMove()
            })

            const handleTargetFlip = (attackerColor: string) => {
                // Quân bị ăn ngược màu với quân tấn công
                const targetSide = attackerColor === 'red' ? 'black' : 'red'
                gameState.pendingFlip.value = {
                    side: targetSide,
                    // --- GỬI KÈM TOẠ ĐỘ QUÂN BỊ ĂN ---
                    row: targetPiece.row,
                    col: targetPiece.col,
                    callback: (selectedName: string) => {
                        targetPiece.name = selectedName; targetPiece.isKnown = true
                        gameState.adjustUnrevealedCount(gameState.getCharFromPieceName(selectedName), -1)
                        gameState.pendingFlip.value = null
                        doFinalMove()
                    }
                }
            }
          }
        }
        bestMove.value = mv; if (ponderMoveFromEngine) ponderMove.value = ponderMoveFromEngine; else ponderMove.value = ''
        pvMoves.value = []; multiPvMoves.value = []; analysisLines.length = 0; isInfinitePondering.value = false
      }
      
      if (ln === 'uciok' && !(window as any).__UCI_TERMINAL_ACTIVE__) send('isready')
      if (ln === 'readyok') analysis.value = t('uci.engineReady')
      if (ln.startsWith('option name ')) uciOptionsText.value += ln + '\n'
    })
    pendingOutputLines = []; lastProcessedTime = currentTime; outputThrottleTimer = null
  }

  const queueOutputLine = (line: string) => {
    pendingOutputLines.push(line); if (!outputThrottleTimer) outputThrottleTimer = setTimeout(processPendingOutput, getThrottleDelay())
  }
  const resetThrottling = () => {
    if (outputThrottleTimer) { clearTimeout(outputThrottleTimer); outputThrottleTimer = null }
    pendingOutputLines = []; lastProcessedTime = 0
  }
  // ... (Phần còn lại giữ nguyên như cũ, chỉ rút gọn để đỡ dài dòng)
  const loadEngine = async (engine: ManagedEngine) => {
    if (isEngineLoading.value) return; isEngineLoading.value = true; isEngineLoaded.value = false; currentEngine.value = null; engineOutput.value = []; uciOptionsText.value = ''; overriddenOptions.value = {}
    playSoundLoop('loading'); if (isThinking.value) stopAnalysis({ playBestMoveOnStop: false }); if (isPondering.value) stopPonder({ playBestMoveOnStop: false })
    await invoke('kill_engine').catch(e => console.warn(e)); uciOkReceived.value = false
    try {
      await invoke('spawn_engine', { path: engine.path, args: engine.args.split(' ').filter(Boolean) }); send('uci')
      const uciOkPromise = new Promise<void>((resolve, reject) => {
        const tId = setTimeout(() => reject(new Error('timeout')), validationTimeout.value)
        listen<string>('engine-output', e => { if (e.payload.trim() === 'uciok') { clearTimeout(tId); resolve() } }).then(u => uciOkPromise.finally(u))
      })
      await uciOkPromise; stopSoundLoop(); currentEngine.value = engine; analysis.value = t('uci.engineReady')
      const cm = useConfigManager(); await cm.saveLastSelectedEngineId(engine.id)
      setTimeout(async () => { await applySavedSettings(); try { await sendUciNewGame() } catch (e) { console.error(e) } isEngineLoaded.value = true }, 100)
    } catch (e: any) { stopSoundLoop(); alert(e); isEngineLoaded.value = false; await invoke('kill_engine') } finally { isEngineLoading.value = false }
  }
  const autoLoadLastEngine = async () => {
    if ((window as any).__MATCH_MODE__) return
    const cm = useConfigManager(); await cm.loadConfig(); const id = cm.getLastSelectedEngineId()
    if (id) { const e = cm.getEngines().find(en => en.id === id); if (e) await loadEngine(e); else await cm.clearLastSelectedEngineId() }
  }
  const send = (cmd: string) => {
    engineOutput.value.push({ text: cmd, kind: 'sent' }); if (cmd.startsWith('setoption name MultiPV')) { analysisLines.length = 0; multiPvMoves.value = []; analysis.value = '' }
    invoke('send_to_engine', { command: cmd }).catch(e => console.warn(e))
  }
  const sendUciNewGame = async (): Promise<void> => {
    if (!currentEngine.value) return; send('ucinewgame'); send('isready')
    return new Promise((resolve) => setTimeout(resolve, 500)) // Fallback simple logic
  }
  const startAnalysis = (settings: any = {}, moves: string[] = [], baseFen: string | null = null, searchmoves: string[] = []) => {
    if (!isEngineLoaded.value || isThinking.value) return; isThinking.value = true; isStopping.value = false; playOnStop.value = false; isInfinitePondering.value = false; analysisStartTime.value = Date.now(); resetThrottling(); analysisLines.length = 0; multiPvMoves.value = []; analysis.value = ''; currentSearchMoves.value = [...searchmoves]
    const fen = gameState.generateFenForEngine ? gameState.generateFenForEngine(baseFen) : (baseFen ?? generateFen()); analysisBaseFen.value = fen; analysisPrefixMoves.value = [...moves]
    send(`position fen ${fen}${moves.length ? ' moves ' + moves.join(' ') : ''}`)
    send(`go movetime ${settings.movetime || 1000}`)
  }
  const stopAnalysis = (opts: any = {}) => { if (!isEngineLoaded.value) return; isStopping.value = true; playOnStop.value = opts.playBestMoveOnStop; resetThrottling(); send('stop') }
  const clearSearchMoves = () => { currentSearchMoves.value = [] }
  const startPonder = () => {} // Rút gọn
  const handlePonderHit = () => {}
  const stopPonder = () => { if (isPondering.value) send('stop'); isPondering.value = false }
  const isPonderMoveMatch = () => false
  const unloadEngine = async () => { try { send('quit'); await invoke('kill_engine') } catch {} isEngineLoaded.value = false }
  const applySavedSettings = async () => {} 

  onMounted(async () => {
    unlisten = await listen<string>('engine-output', ev => queueOutputLine(ev.payload))
    if (!(window as any).__MATCH_MODE__) autoLoadLastEngine()
  })
  onUnmounted(() => { unlisten?.(); invoke('kill_engine'); resetThrottling() })

  return { engineOutput, isEngineLoaded, isEngineLoading, bestMove, analysis, isThinking, isStopping, pvMoves, multiPvMoves, analysisBaseFen, analysisPrefixMoves, analysisUiFen, loadEngine, unloadEngine, startAnalysis, stopAnalysis, uciOptionsText, send, sendUciNewGame, currentEnginePath, applySavedSettings, currentSearchMoves, clearSearchMoves, bundleIdentifier, analysisStartTime, lastAnalysisTime, lastRequestedLimits, isPondering, isInfinitePondering, ponderMove, ponderhit, startPonder, handlePonderHit, stopPonder, isPonderMoveMatch, isDarkPieceMove, currentEngine, showChineseNotation, setShowChineseNotation: (v: boolean) => { showChineseNotation.value = v }, uciOptions, setOption }
}