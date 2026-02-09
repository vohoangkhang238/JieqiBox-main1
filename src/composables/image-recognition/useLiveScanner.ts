import { ref } from 'vue'
import { useImageRecognition } from './useImageRecognition.real'
import { LABELS } from './types'

export function useLiveScanner() {
  const { processLiveFrame, updateBoardGrid, initializeModel } = useImageRecognition()
  const isScanning = ref(false); const lastFen = ref('')
  
  // Lưu trữ các quân cờ do bạn sửa: { "row-col": "K" }
  const manualOverrides = ref<Record<string, string>>({})

  const setManualPiece = (row: number, col: number, char: string) => {
    const key = `${row}-${col}`
    if (char === 'auto') delete manualOverrides.value[key]
    else manualOverrides.value[key] = char
    console.log(`📍 Đã sửa ô [${row},${col}] thành: ${char}`)
  }

  const gridToFen = (grid: any[][]) => {
    let fen = ""
    const map: any = { 'r_jiang':'K','r_che':'R','r_ma':'N','r_pao':'C','r_shi':'A','r_xiang':'B','r_bing':'P','b_jiang':'k','b_che':'r','b_ma':'n','b_pao':'c','b_shi':'a','b_xiang':'b','b_bing':'p' }
    
    for (let j=0; j<10; j++) {
      let empty = 0
      for (let i=0; i<9; i++) {
        const key = `${j}-${i}`
        let char = ''
        
        // ƯU TIÊN 1: Lấy từ bạn sửa
        if (manualOverrides.value[key]) {
          char = manualOverrides.value[key] === 'empty' ? '' : manualOverrides.value[key]
        } 
        // ƯU TIÊN 2: Lấy từ AI
        else if (grid[j][i]) {
          const name = LABELS[grid[j][i].labelIndex].name
          char = name.toLowerCase().includes('dark') ? 'X' : (map[name] || '')
        }

        if (!char) empty++
        else {
          if (empty > 0) { fen += empty; empty = 0 }
          fen += char
        }
      }
      if (empty > 0) fen += empty
      if (j < 9) fen += "/"
    }
    return fen + " w - - 0 1"
  }

  const startScanning = async (video: HTMLVideoElement, onDetected: (fen: string) => void) => {
    await initializeModel(); isScanning.value = true
    const loop = async () => {
      if (!isScanning.value) return
      const boxes = await processLiveFrame(video)
      const fen = gridToFen(updateBoardGrid(boxes))
      if (fen !== lastFen.value) { lastFen.value = fen; onDetected(fen) }
      setTimeout(loop, 400)
    }
    loop()
  }

  return { isScanning, startScanning, stopScanning: () => isScanning.value = false, setManualPiece }
}