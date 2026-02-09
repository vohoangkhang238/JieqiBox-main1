import { ref } from 'vue'
import { useImageRecognition } from './useImageRecognition.real'
import { LABELS } from './types'

export function useLiveScanner() {
  const { processLiveFrame, updateBoardGrid, initializeModel } = useImageRecognition()
  const isScanning = ref(false); const lastFen = ref('')

  const mapLabelToFen = (name: string, row: number, col: number): string => {
    const map: any = { 'r_general':'K','r_chariot':'R','r_horse':'N','r_cannon':'C','r_advisor':'A','r_elephant':'B','r_soldier':'P','b_general':'k','b_chariot':'r','b_horse':'n','b_cannon':'c','b_advisor':'a','b_elephant':'b','b_soldier':'p' }
    
    // RÀNG BUỘC VỊ TRÍ (CẢI THIỆN ĐỘ CHÍNH XÁC):
    // Tướng và Sĩ đỏ chỉ được ở hàng 7,8,9 và cột 3,4,5
    if ((name === 'r_general' || name === 'r_advisor') && (row < 7 || col < 3 || col > 5)) return ''
    // Tướng và Sĩ đen chỉ được ở hàng 0,1,2 và cột 3,4,5
    if ((name === 'b_general' || name === 'b_advisor') && (row > 2 || col < 3 || col > 5)) return ''

    if (name.toLowerCase().includes('dark')) return 'X'
    return map[name] || ''
  }

  const startScanning = async (video: HTMLVideoElement, onDetected: (fen: string) => void) => {
    await initializeModel(); isScanning.value = true
    const loop = async () => {
      if (!isScanning.value) return
      const boxes = await processLiveFrame(video)
      const grid = updateBoardGrid(boxes)
      
      let fen = ""
      for (let j = 0; j < 10; j++) {
        let empty = 0
        for (let i = 0; i < 9; i++) {
          const piece = grid[j][i]
          const char = piece ? mapLabelToFen(LABELS[piece.labelIndex].name, j, i) : ''
          if (!char) empty++
          else {
            if (empty > 0) { fen += empty; empty = 0 }
            fen += char
          }
        }
        if (empty > 0) fen += empty
        if (j < 9) fen += "/"
      }
      
      const finalFen = fen + " w - - 0 1"
      if (finalFen !== lastFen.value && finalFen.length > 25) {
        lastFen.value = finalFen; onDetected(finalFen)
      }
      setTimeout(loop, 350)
    }
    loop()
  }

  return { isScanning, startScanning, stopScanning: () => isScanning.value = false }
}