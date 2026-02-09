import { ref } from 'vue'
import { useImageRecognition } from './useImageRecognition.real'
import { LABELS } from './types'

export function useLiveScanner() {
  const { processLiveFrame, updateBoardGrid, initializeModel } = useImageRecognition()
  const isScanning = ref(false); const lastFen = ref('')

  // HÀM SỬA LỖI NHẬN DIỆN DỰA TRÊN LUẬT CỜ TƯỚNG
  const mapLabelToFen = (name: string, row: number, col: number): string => {
    const map: any = { 
      'r_jiang':'K', 'r_che':'R', 'r_ma':'N', 'r_pao':'C', 'r_shi':'A', 'r_xiang':'B', 'r_bing':'P',
      'b_jiang':'k', 'b_che':'r', 'b_ma':'n', 'b_pao':'c', 'b_shi':'a', 'b_xiang':'b', 'b_bing':'p' 
    }

    // --- LOGIC CHIẾN THUẬT SỬA LỖI QUÂN ĐỎ ---
    // 1. Sửa lỗi Tướng đỏ bị nhận nhầm thành Tượng: Tướng đỏ chỉ ở trong Cung (Hàng 7-9, Cột 3-5)
    if (name === 'r_xiang' && row >= 7 && row <= 9 && col >= 3 && col <= 5) return 'K';
    
    // 2. Sửa lỗi Xe đỏ bị nhận nhầm thành Tượng: Tượng đỏ không được qua sông (Hàng 0-4)
    if (name === 'r_xiang' && row <= 4) return 'R';

    // 3. Kiểm tra 7 điểm đứng cố định của Tượng đỏ
    const validElephantSpots = [[9,2], [9,6], [7,0], [7,4], [7,8], [5,2], [5,6]];
    const isValidElephant = validElephantSpots.some(s => s[0] === row && s[1] === col);
    if (name === 'r_xiang' && !isValidElephant) return 'R'; // Nếu không phải điểm Tượng, mặc định là Xe

    if (name.toLowerCase().includes('dark')) return 'X';
    return map[name] || ''
  }

  const gridToFen = (grid: any[][]) => {
    let fen = ""
    for (let j=0; j<10; j++) {
      let empty = 0
      for (let i=0; i<9; i++) {
        const char = grid[j][i] ? mapLabelToFen(LABELS[grid[j][i].labelIndex].name, j, i) : ''
        if (!char) empty++
        else {
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
    await initializeModel(); isScanning.value = true
    const loop = async () => {
      if (!isScanning.value) return
      const boxes = await processLiveFrame(video)
      if (boxes.length > 0) {
        const fen = gridToFen(updateBoardGrid(boxes))
        if (fen !== lastFen.value && fen.length > 20) {
          lastFen.value = fen; onDetected(fen)
        }
      }
      setTimeout(loop, 400)
    }
    loop()
  }

  return { isScanning, startScanning, stopScanning: () => isScanning.value = false }
}