import { ref } from 'vue'
import { useImageRecognition } from './useImageRecognition.real'
import { LABELS, type DetectionBox } from './types'

export function useLiveScanner() {
  const { processLiveFrame, updateBoardGrid } = useImageRecognition()
  const isScanning = ref(false)
  const lastFen = ref('')

  const mapLabelToFenChar = (labelName: string): string => {
    const mapping: Record<string, string> = {
      'r_general': 'K', 'r_chariot': 'R', 'r_horse': 'N', 'r_cannon': 'C', 'r_advisor': 'A', 'r_elephant': 'B', 'r_soldier': 'P',
      'b_general': 'k', 'b_chariot': 'r', 'b_horse': 'n', 'b_cannon': 'c', 'b_advisor': 'a', 'b_elephant': 'b', 'b_soldier': 'p'
    }
    return labelName.startsWith('dark') ? 'X' : (mapping[labelName] || '')
  }

  const gridToFen = (grid: (DetectionBox | null)[][]) => {
    let fen = ""
    for (let j = 0; j < 10; j++) {
      let empty = 0
      for (let i = 0; i < 9; i++) {
        if (!grid[j][i]) empty++
        else {
          if (empty > 0) { fen += empty; empty = 0 }
          fen += mapLabelToFenChar(LABELS[grid[j][i]!.labelIndex].name)
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
      if (fen !== lastFen.value && fen.length > 20) {
        lastFen.value = fen
        onDetected(fen)
      }
      setTimeout(() => requestAnimationFrame(loop), 500)
    }
    loop()
  }

  return { isScanning, stopScanning: () => isScanning.value = false, startScanning }
}