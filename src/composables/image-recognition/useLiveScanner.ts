import { ref } from 'vue'
import { useImageRecognition } from './useImageRecognition.real'
import { LABELS } from './types'

export function useLiveScanner() {
  const { processLiveFrame, updateBoardGrid, initializeModel } = useImageRecognition()
  const isScanning = ref(false); const lastFen = ref('')

  const startScanning = async (video: HTMLVideoElement, onDetected: (fen: string) => void) => {
    await initializeModel(); isScanning.value = true
    const loop = async () => {
      if (!isScanning.value) return
      const boxes = await processLiveFrame(video)
      if (boxes.length > 0) {
        const grid = updateBoardGrid(boxes)
        let fen = ""
        for (let j=0; j<10; j++) {
          let empty = 0
          for (let i=0; i<9; i++) {
            if (!grid[j][i]) empty++
            else {
              if (empty > 0) { fen += empty; empty = 0 }
              const name = LABELS[grid[j][i].labelIndex].name
              const map: any = { 'r_general':'K','r_chariot':'R','r_horse':'N','r_cannon':'C','r_advisor':'A','r_elephant':'B','r_soldier':'P','b_general':'k','b_chariot':'r','b_horse':'n','b_cannon':'c','b_advisor':'a','b_elephant':'b','b_soldier':'p' }
              fen += name.includes('dark') ? 'X' : (map[name] || '')
            }
          }
          if (empty > 0) fen += empty
          if (j < 9) fen += "/"
        }
        const finalFen = fen + " w - - 0 1"
        if (finalFen !== lastFen.value && finalFen.length > 25) {
          lastFen.value = finalFen; onDetected(finalFen)
          console.log("♟️ Bàn cờ cập nhật:", finalFen)
        }
      }
      setTimeout(loop, 250) // Quét 4 lần mỗi giây
    }
    loop()
  }
  return { isScanning, startScanning, stopScanning: () => isScanning.value = false }
}