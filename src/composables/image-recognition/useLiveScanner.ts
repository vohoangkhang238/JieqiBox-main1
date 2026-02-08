import { ref } from 'vue'
import { useImageRecognition } from './useImageRecognition.real'
import { LABELS, type DetectionBox } from './types'

export function useLiveScanner() {
  const { processLiveFrame, updateBoardGrid } = useImageRecognition()
  const isScanning = ref(false)
  const lastFen = ref('')

  // Ánh xạ tên nhãn YOLO sang ký tự FEN tiêu chuẩn của cờ tướng
  const mapLabelToFenChar = (labelName: string): string => {
    const mapping: Record<string, string> = {
      // Quân Đỏ (Chữ hoa)
      'r_general': 'K', 'r_chariot': 'R', 'r_horse': 'N', 'r_cannon': 'C', 
      'r_advisor': 'A', 'r_elephant': 'B', 'r_soldier': 'P',
      // Quân Đen (Chữ thường)
      'b_general': 'k', 'b_chariot': 'r', 'b_horse': 'n', 'b_cannon': 'c', 
      'b_advisor': 'a', 'b_elephant': 'b', 'b_soldier': 'p',
      // Quân Úp (Dùng 'X' cho cờ úp)
      'dark': 'X'
    }
    
    // Nếu là quân úp cụ thể (ví dụ: dark_b_advisor), vẫn coi là 'X'
    if (labelName.startsWith('dark')) return 'X'
    
    return mapping[labelName] || ''
  }

  // Chuyển đổi lưới 10x9 thành chuỗi FEN
  const gridToFen = (grid: (DetectionBox | null)[][]) => {
    let fen = ""
    for (let j = 0; j < 10; j++) {
      let emptyCount = 0
      for (let i = 0; i < 9; i++) {
        const piece = grid[j][i]
        if (!piece) {
          emptyCount++
        } else {
          if (emptyCount > 0) {
            fen += emptyCount
            emptyCount = 0
          }
          const labelName = LABELS[piece.labelIndex].name
          fen += mapLabelToFenChar(labelName)
        }
      }
      if (emptyCount > 0) fen += emptyCount
      if (j < 9) fen += "/"
    }
    // Thêm các thông số mặc định: lượt Đỏ 'w', không nhập thành, không bắt chốt, nước đi 0 1
    return fen + " w - - 0 1"
  }

  // Vòng lặp quét chính
  const startScanning = async (
    videoElement: HTMLVideoElement, 
    onDetected: (fen: string) => void
  ) => {
    if (isScanning.value) return
    isScanning.value = true

    const scan = async () => {
      if (!isScanning.value) return

      try {
        // 1. Nhận diện quân cờ từ khung hình video hiện tại
        const boxes = await processLiveFrame(videoElement)
        
        // 2. Sắp xếp vào lưới 10x9
        const grid = updateBoardGrid(boxes)
        
        // 3. Tạo chuỗi FEN
        const currentFen = gridToFen(grid)

        // 4. Chỉ báo cáo nếu bàn cờ có sự thay đổi (người dùng vừa đi quân)
        if (currentFen !== lastFen.value) {
          console.log("Phát hiện thế cờ mới:", currentFen)
          lastFen.value = currentFen
          onDetected(currentFen)
        }
      } catch (err) {
        console.error("Lỗi trong vòng lặp quét:", err)
      }

      // Đợi 500ms trước khi quét khung hình tiếp theo để tránh quá tải CPU
      setTimeout(() => {
        requestAnimationFrame(scan)
      }, 500)
    }

    scan()
  }

  const stopScanning = () => {
    isScanning.value = false
  }

  return { isScanning, lastFen, startScanning, stopScanning }
}