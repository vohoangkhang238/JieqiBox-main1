import { ref } from 'vue'
import { useImageRecognition } from './useImageRecognition.real'
import { LABELS } from './types'

export function useLiveScanner() {
  const { processLiveFrame, updateBoardGrid, initializeModel } = useImageRecognition()
  const isScanning = ref(false)
  const lastFen = ref('')

  const mapLabelToFen = (name: string): string => {
    const map: any = { 
      'r_jiang':'K', 'r_general':'K', 'r_che':'R', 'r_ma':'N', 'r_pao':'C', 'r_shi':'A', 'r_xiang':'B', 'r_bing':'P',
      'b_jiang':'k', 'b_general':'k', 'b_che':'r', 'b_ma':'n', 'b_pao':'c', 'b_shi':'a', 'b_xiang':'b', 'b_bing':'p'
    }
    if (name.toLowerCase().includes('dark')) return 'X'
    return map[name] || '' // Trả về rỗng nếu là nhãn không xác định
  }

  const gridToFen = (grid: any[][]) => {
    let fen = ""
    for (let j = 0; j < 10; j++) {
      let empty = 0
      for (let i = 0; i < 9; i++) {
        const piece = grid[j][i]
        const char = piece ? mapLabelToFen(LABELS[piece.labelIndex].name) : ''
        
        // SỬA LỖI: Chỉ khi có quân cờ thực sự (char có giá trị) mới flush biến empty
        if (!char) {
          empty++
        } else {
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
    await initializeModel()
    isScanning.value = true
    const loop = async () => {
      if (!isScanning.value) return
      const boxes = await processLiveFrame(video)
      if (boxes.length > 0) {
        const currentFen = gridToFen(updateBoardGrid(boxes))
        
        // GIẢM ĐỘ TRỄ: Chỉ cần ổn định 1 khung hình là cập nhật luôn cho nhanh
        if (currentFen !== lastFen.value && currentFen.length > 25) {
          lastFen.value = currentFen
          onDetected(currentFen)
        }
      }
      // TĂNG TỐC: Quét sau mỗi 100ms thay vì 400ms
      setTimeout(loop, 100) 
    }
    loop()
  }

  return { isScanning, startScanning, stopScanning: () => isScanning.value = false }
}