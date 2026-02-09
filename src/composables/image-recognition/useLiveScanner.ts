import { ref } from 'vue'
import { useImageRecognition } from './useImageRecognition.real'
import { LABELS } from './types'

export function useLiveScanner() {
  const { processLiveFrame, updateBoardGrid, initializeModel } = useImageRecognition()
  const isScanning = ref(false)
  const lastFen = ref('')

  // Ánh xạ tên nhãn từ model sang ký tự FEN chuẩn
  const mapLabelToFen = (name: string): string => {
    const map: Record<string, string> = {
      'r_general': 'K', 'r_chariot': 'R', 'r_horse': 'N', 'r_cannon': 'C', 'r_advisor': 'A', 'r_elephant': 'B', 'r_soldier': 'P',
      'b_general': 'k', 'b_chariot': 'r', 'b_horse': 'n', 'b_cannon': 'c', 'b_advisor': 'a', 'b_elephant': 'b', 'b_soldier': 'p'
    }
    // Nếu là quân chưa lật (có chữ dark trong nhãn), trả về X
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
    if (isScanning.value) return
    await initializeModel()
    isScanning.value = true
    console.log("Scanner: Bắt đầu vòng lặp quét");

    const loop = async () => {
      if (!isScanning.value) return
      
      const boxes = await processLiveFrame(video)
      if (boxes.length > 0) {
        const grid = updateBoardGrid(boxes)
        const currentFen = gridToFen(grid)
        
        // Chỉ cập nhật nếu thế cờ thực sự thay đổi
        if (currentFen !== lastFen.value && currentFen.length > 20) {
          lastFen.value = currentFen
          onDetected(currentFen)
          console.log("Scanner: Đã đồng bộ bàn cờ ->", currentFen);
        }
      }
      
      // Đợi 300ms rồi quét tiếp để ổn định hiệu năng
      if (isScanning.value) {
        setTimeout(loop, 300)
      }
    }
    loop()
  }

  return { isScanning, startScanning, stopScanning: () => isScanning.value = false }
}