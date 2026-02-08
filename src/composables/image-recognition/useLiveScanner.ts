import { ref } from 'vue'
import { useImageRecognition } from './useImageRecognition.real'
import { LABELS } from './types'

export function useLiveScanner() {
  const { processLiveFrame, updateBoardGrid } = useImageRecognition()
  const isScanning = ref(false)
  const lastFen = ref('')

  const mapLabelToFen = (name: string): string => {
    const map: Record<string, string> = {
      'r_general': 'K', 'r_chariot': 'R', 'r_horse': 'N', 'r_cannon': 'C', 'r_advisor': 'A', 'r_elephant': 'B', 'r_soldier': 'P',
      'b_general': 'k', 'b_chariot': 'r', 'b_horse': 'n', 'b_cannon': 'c', 'b_advisor': 'a', 'b_elephant': 'b', 'b_soldier': 'p'
    }
    if (name.toLowerCase().includes('dark')) return 'X'
    return map[name] || ''
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
    if (isScanning.value) return // Không cho phép chạy 2 vòng lặp
    isScanning.value = true

    const loop = async () => {
      if (!isScanning.value) return

      try {
        const boxes = await processLiveFrame(video)
        
        // Chỉ xử lý nếu kết quả trả về hợp lệ (không bị khóa bởi isInferenceBusy)
        if (boxes.length > 0) {
          const grid = updateBoardGrid(boxes)
          const currentFen = gridToFen(grid)
          
          if (currentFen !== lastFen.value && currentFen.length > 20) {
            lastFen.value = currentFen
            onDetected(currentFen)
          }
        }
      } catch (e) {
        console.error("Scanner Error:", e)
      }

      // Đợi lượt này xong mới lên lịch lượt tiếp theo
      if (isScanning.value) {
        setTimeout(loop, 100) // 100ms nghỉ giữa các lần quét thành công
      }
    }

    loop()
  }

  const stopScanning = () => {
    isScanning.value = false
  }

  return { isScanning, startScanning, stopScanning }
}