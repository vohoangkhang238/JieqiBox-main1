import { ref } from 'vue'
import { useImageRecognition } from './useImageRecognition.real'
import { LABELS, type DetectionBox } from './types'

export function useLiveScanner() {
  const { processLiveFrame, updateBoardGrid } = useImageRecognition()
  const isScanning = ref(false)
  const lastFen = ref('')

  // Ánh xạ quân cờ từ YOLO sang ký tự FEN tiêu chuẩn
  const mapLabelToFenChar = (labelName: string): string => {
    const mapping: Record<string, string> = {
      'r_general': 'K', 'r_chariot': 'R', 'r_horse': 'N', 'r_cannon': 'C', 'r_advisor': 'A', 'r_elephant': 'B', 'r_soldier': 'P',
      'b_general': 'k', 'b_chariot': 'r', 'b_horse': 'n', 'b_cannon': 'c', 'b_advisor': 'a', 'b_elephant': 'b', 'b_soldier': 'p'
    }
    // Nếu là quân úp, trả về 'X' (đặc thù của JieqiBox)
    return labelName.startsWith('dark') ? 'X' : (mapping[labelName] || '')
  }

  // Chuyển lưới 10x9 thành chuỗi FEN để app hiểu
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
    // w: lượt đỏ, - -: không có khả năng đặc biệt, 0 1: số nước đi
    return fen + " w - - 0 1" 
  }

  // Vòng lặp quét liên tục
  const startScanning = async (video: HTMLVideoElement, onDetected: (fen: string) => void) => {
    isScanning.value = true
    const loop = async () => {
      if (!isScanning.value) return
      
      const boxes = await processLiveFrame(video)
      const currentGrid = updateBoardGrid(boxes)
      const currentFen = gridToFen(currentGrid)

      // Kiểm tra nếu thế cờ thực sự thay đổi và hợp lệ
      if (currentFen !== lastFen.value && currentFen.length > 20) {
        lastFen.value = currentFen
        onDetected(currentFen) // Gọi hàm cập nhật bàn cờ
      }
      
      // Tốc độ quét: 500ms một lần để mượt mà nhưng không nóng máy
      setTimeout(() => requestAnimationFrame(loop), 500)
    }
    loop()
  }

  const stopScanning = () => {
    isScanning.value = false
  }

  return { isScanning, startScanning, stopScanning }
}