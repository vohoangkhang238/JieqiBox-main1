import { ref } from 'vue'
import { useImageRecognition } from './useImageRecognition.real'
import { LABELS } from './types'

export function useLiveScanner() {
  const { processLiveFrame, updateBoardGrid, initializeModel } = useImageRecognition()
  const isScanning = ref(false)
  const lastFen = ref('')
  
  // Lưu trữ các quân cờ do người dùng sửa thủ công: { "row-col": "char" }
  const manualOverrides = ref<Record<string, string>>({})

  const mapLabelToFen = (name: string): string => {
    const map: any = { 
      'r_jiang':'K','r_che':'R','r_ma':'N','r_pao':'C','r_shi':'A','r_xiang':'B','r_bing':'P',
      'b_jiang':'k','b_che':'r','b_ma':'n','b_pao':'c','b_shi':'a','b_xiang':'b','b_bing':'p' 
    }
    if (name.toLowerCase().includes('dark')) return 'X'
    return map[name] || ''
  }

  // Hàm để component bên ngoài gọi khi người dùng chuột phải sửa quân
  const setManualPiece = (row: number, col: number, pieceChar: string) => {
    const key = `${row}-${col}`
    if (pieceChar === 'empty') {
      delete manualOverrides.value[key]
    } else {
      manualOverrides.value[key] = pieceChar
    }
    console.log(`📍 Đã ghi đè ô [${row},${col}] thành: ${pieceChar}`)
  }

  const gridToFen = (grid: any[][]) => {
    let fen = ""
    for (let j = 0; j < 10; j++) {
      let empty = 0
      for (let i = 0; i < 9; i++) {
        const key = `${j}-${i}`
        
        // ƯU TIÊN 1: Lấy từ ghi đè thủ công
        if (manualOverrides.value[key]) {
          if (empty > 0) { fen += empty; empty = 0 }
          fen += manualOverrides.value[key]
        } 
        // ƯU TIÊN 2: Lấy từ AI
        else if (grid[j][i]) {
          if (empty > 0) { fen += empty; empty = 0 }
          fen += mapLabelToFen(LABELS[grid[j][i].labelIndex].name)
        } 
        else {
          empty++
        }
      }
      if (empty > 0) fen += empty
      if (j < 9) fen += "/"
    }
    return fen + " w - - 0 1"
  }

  const startScanning = async (video: HTMLVideoElement, onDetected: (fen: string) => void) => {
    await initializeModel()
    isScanning.value = true
    const loop = async () => {
      if (!isScanning.value) return
      const boxes = await processLiveFrame(video)
      if (boxes.length > 0) {
        const grid = updateBoardGrid(boxes)
        const currentFen = gridToFen(grid)
        if (currentFen !== lastFen.value) {
          lastFen.value = currentFen
          onDetected(currentFen)
        }
      }
      setTimeout(loop, 400)
    }
    loop()
  }

  return { isScanning, startScanning, stopScanning: () => isScanning.value = false, setManualPiece, manualOverrides }
}