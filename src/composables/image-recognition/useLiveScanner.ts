import { ref } from 'vue'
import { useImageRecognition } from './useImageRecognition.real'
import { LABELS } from './types'

export function useLiveScanner() {
  const { processLiveFrame, updateBoardGrid, initializeModel } = useImageRecognition()
  const isScanning = ref(false)
  const lastFen = ref('')
  
  const pendingFen = ref('')
  const stableCount = ref(0)
  const REQUIRED_STABILITY = 2 

  // MỞ RỘNG MAP NHÃN: Đảm bảo mọi kiểu tên nhãn đều được hỗ trợ
  const mapLabelToFen = (name: string): string => {
    const map: any = { 
      'r_jiang':'K', 'r_general':'K', 'r_king':'K',
      'r_che':'R', 'r_chariot':'R',
      'r_ma':'N', 'r_horse':'N',
      'r_pao':'C', 'r_cannon':'C',
      'r_shi':'A', 'r_advisor':'A',
      'r_xiang':'B', 'r_elephant':'B',
      'r_bing':'P', 'r_soldier':'P', 'r_pawn':'P',
      
      'b_jiang':'k', 'b_general':'k', 'b_king':'k',
      'b_che':'r', 'b_chariot':'r',
      'b_ma':'n', 'b_horse':'n',
      'b_pao':'c', 'b_cannon':'c',
      'b_shi':'a', 'b_advisor':'a',
      'b_xiang':'b', 'b_elephant':'b',
      'b_bing':'p', 'b_soldier':'p', 'b_pawn':'p'
    }
    if (name.toLowerCase().includes('dark')) return 'X'
    return map[name] || ''
  }

  // SỬA LỖI FEN "DÀI THÒN": Đảm bảo số lượng ô trống được cộng dồn chuẩn xác
  const gridToFen = (grid: any[][]) => {
    let fen = ""
    for (let j = 0; j < 10; j++) {
      let empty = 0
      for (let i = 0; i < 9; i++) {
        const piece = grid[j][i]
        const char = piece ? mapLabelToFen(LABELS[piece.labelIndex].name) : ''
        
        if (!char) {
          empty++ // Nếu không có quân hoặc nhãn lạ, coi là ô trống
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
        
        // Cơ chế ổn định bàn cờ
        if (currentFen === pendingFen.value) {
          stableCount.value++
        } else {
          pendingFen.value = currentFen
          stableCount.value = 0
        }

        if (stableCount.value >= REQUIRED_STABILITY && currentFen !== lastFen.value && currentFen.length > 25) {
          lastFen.value = currentFen
          onDetected(currentFen)
          console.log("♟️ FEN CHUẨN:", currentFen)
        }
      } 
      setTimeout(loop, 400)
    }
    loop()
  }

  return { isScanning, startScanning, stopScanning: () => isScanning.value = false }
}