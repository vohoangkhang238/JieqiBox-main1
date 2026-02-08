import { ref } from 'vue'
import { useImageRecognition } from './useImageRecognition.real'
import { LABELS, PIECE_MAP } from './types' //

export function useLiveScanner() {
  const { preprocess, postprocess, updateBoardGrid, session } = useImageRecognition()
  const isScanning = ref(false)
  const lastFen = ref('')

  // Hàm chuyển đổi lưới 10x9 sang FEN
  const gridToFen = (grid: any[][]) => {
    let fen = ""
    for (let r = 0; r < 10; r++) {
      let empty = 0
      for (let c = 0; c < 9; c++) {
        const p = grid[r][c]
        if (!p) {
          empty++
        } else {
          if (empty > 0) { fen += empty; empty = 0 }
          const labelName = LABELS[p.labelIndex].name
          // Logic ánh xạ labelName sang ký tự FEN (ví dụ: r_chariot -> R)
          // Bạn có thể dựa vào PIECE_MAP
          fen += mapLabelToFenChar(labelName)
        }
      }
      if (empty > 0) fen += empty
      if (r < 9) fen += "/"
    }
    return fen + " w - - 0 1" // Giả định đỏ đi trước
  }

  return { isScanning, gridToFen, lastFen }
}