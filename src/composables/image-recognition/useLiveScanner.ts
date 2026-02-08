import { ref } from 'vue'
import { useImageRecognition } from './useImageRecognition.real'
import { LABELS } from './types'

export function useLiveScanner() {
  const { processLiveFrame, updateBoardGrid, isModelLoading } = useImageRecognition()
  const isScanning = ref(false)
  const lastFen = ref('')

  const mapLabelToFen = (name: string): string => {
    const map: Record<string, string> = {
      'r_general': 'K', 'r_chariot': 'R', 'r_horse': 'N', 'r_cannon': 'C', 'r_advisor': 'A', 'r_elephant': 'B', 'r_soldier': 'P',
      'b_general': 'k', 'b_chariot': 'r', 'b_horse': 'n', 'b_cannon': 'c', 'b_advisor': 'a', 'b_elephant': 'b', 'b_soldier': 'p'
    }
    return name.startsWith('dark') ? 'X' : (map[name] || '')
  }

  const gridToFen = (grid: any[][]) => {
    let fen = ""
    for (let j = 0; j < 10; j++) {
      let empty = 0
      for (let i = 0; i < 9; i++) {
        if (!grid[j][i]) empty++
        else {
          if (empty > 0) { fen += empty; empty = 0 }
          fen += mapLabelToFen(LABELS[grid[j][i].labelIndex].name)
        }
      }
      if (empty > 0) fen += empty
      if (j < 9) fen += "/"
    }
    return fen + " w - - 0 1"
  }

  const startScanning = async (video: HTMLVideoElement, onDetected: (fen: string) => void) => {
    isScanning.value = true
    const loop = async () => {
      if (!isScanning.value) return
      const boxes = await processLiveFrame(video)
      const fen = gridToFen(updateBoardGrid(boxes))
      if (fen !== lastFen.value && fen.length > 25) {
        lastFen.value = fen
        onDetected(fen)
      }
      setTimeout(() => requestAnimationFrame(loop), 500)
    }
    loop()
  }

  return { isScanning, startScanning, stopScanning: () => isScanning.value = false, isModelLoading }
}