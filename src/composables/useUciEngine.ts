import { ref, onUnmounted } from 'vue'

export function useUciEngine(generateFen: () => string, gameState: any) {
  // --- TRẠNG THÁI CỦA ENGINE ---
  const isThinking = ref(false)
  const isReady = ref(false)
  const analysis = ref('') // Thông tin phân tích (info depth ...)
  const bestMove = ref('') // Nước đi tốt nhất hiện tại
  const ponderMove = ref('') // Nước đi dự đoán tiếp theo
  const pvMoves = ref<string[][]>([]) // Các biến thể nước đi (PV)
  const multiPvMoves = ref<string[][]>([]) // MultiPV nếu bật

  // Worker của Stockfish/Pikafish
  let worker: Worker | null = null

  // --- KHỞI TẠO ENGINE ---
  const initWorker = () => {
    if (worker) return

    // Đường dẫn tới file worker (bạn cần đảm bảo file này tồn tại trong public/)
    worker = new Worker(new URL('/pikafish.js', import.meta.url))

    worker.onmessage = (e) => {
      const line = e.data
      // console.log('Engine:', line) // Bật dòng này nếu muốn debug

      if (line === 'readyok') {
        isReady.value = true
      } 
      else if (line.startsWith('info')) {
        parseInfoLine(line)
      } 
      else if (line.startsWith('bestmove')) {
        handleBestMove(line)
      }
    }

    worker.onerror = (err) => {
      console.error('Engine Worker Error:', err)
    }

    // Gửi lệnh khởi động UCI
    postMessage('uci')
  }

  // --- GỬI LỆNH XUỐNG WORKER ---
  const postMessage = (cmd: string) => {
    if (worker) {
      worker.postMessage(cmd)
    }
  }

  // --- XỬ LÝ THÔNG TIN PHÂN TÍCH (INFO) ---
  const parseInfoLine = (line: string) => {
    analysis.value = line
    
    // Đọc MultiPV (nếu có)
    if (line.includes(' multipv ')) {
      // Logic xử lý multipv phức tạp có thể thêm ở đây nếu cần
    }
  }

  // --- XỬ LÝ NƯỚC ĐI TỐT NHẤT (BESTMOVE) - TRỌNG TÂM SỬA ĐỔI ---
  const handleBestMove = (line: string) => {
    isThinking.value = false
    const parts = line.split(' ')
    const move = parts[1] // Ví dụ: "h2e2"
    const ponder = parts[3] // Nước ponder (nếu có)

    bestMove.value = move
    if (ponder) ponderMove.value = ponder

    if (move && move !== '(none)') {
      // 1. Phân giải tọa độ từ (from) và đến (to)
      const from = { 
        col: move.charCodeAt(0) - 'a'.charCodeAt(0), 
        row: 9 - parseInt(move[1]) 
      }
      const to = { 
        col: move.charCodeAt(2) - 'a'.charCodeAt(0), 
        row: 9 - parseInt(move[3]) 
      }

      // === LOGIC MỚI: QUY TRÌNH ĐI QUÂN CÓ HỎI NGƯỜI DÙNG ===
      const executeMoveSequence = () => {
        // Lấy thông tin quân tại thời điểm hiện tại
        // (Dùng .value vì pieces là Ref)
        const movingPiece = gameState.pieces.value.find(
          (p: any) => p.row === from.row && p.col === from.col
        )
        const targetPiece = gameState.pieces.value.find(
          (p: any) => p.row === to.row && p.col === to.col
        )

        // --- TRƯỜNG HỢP 1: AI DI CHUYỂN QUÂN ÚP (VÍ DỤ: TỐT ÚP ĐI) ---
        // -> Hỏi người dùng xem lật ra con gì
        if (movingPiece && !movingPiece.isKnown) {
          console.log("[AI] Đi quân úp -> Chờ người dùng chọn...")
          
          // Xác định phe (đỏ/đen) để hiện chữ màu tương ứng
          const side = movingPiece.name.startsWith('red') ? 'red' : 'black'
          
          // Kích hoạt bảng chọn
          gameState.pendingFlip.value = {
            side: side,
            callback: (selectedName: string) => {
              // Người dùng chọn xong:
              
              // a. Cập nhật quân nguồn thành quân thật
              movingPiece.name = selectedName
              movingPiece.isKnown = true
              
              // b. Trừ kho quân
              gameState.adjustUnrevealedCount(gameState.getCharFromPieceName(selectedName), -1)
              
              // c. Đóng bảng chọn
              gameState.pendingFlip.value = null
              
              // d. ĐỆ QUY: Gọi lại hàm này để kiểm tra tiếp trường hợp ăn quân
              // (Vì quân vừa lật có thể nhảy vào ăn một quân úp khác)
              executeMoveSequence()
            }
          }
          return // DỪNG LẠI, CHỜ NGƯỜI DÙNG
        }

        // --- TRƯỜNG HỢP 2: AI ĂN VÀO QUÂN ÚP CỦA ĐỐI PHƯƠNG ---
        // -> Hỏi người dùng xem con bị ăn là con gì
        if (targetPiece && !targetPiece.isKnown) {
          console.log("[AI] Ăn quân úp -> Chờ người dùng chọn...")
          
          const side = targetPiece.name.startsWith('red') ? 'red' : 'black'
          
          gameState.pendingFlip.value = {
            side: side,
            callback: (selectedName: string) => {
              // a. Cập nhật quân đích thành quân thật
              targetPiece.name = selectedName
              targetPiece.isKnown = true
              
              // b. Trừ kho quân
              gameState.adjustUnrevealedCount(gameState.getCharFromPieceName(selectedName), -1)
              
              // c. Đóng bảng chọn
              gameState.pendingFlip.value = null
              
              // d. Mọi thứ đã rõ ràng (cả nguồn và đích đều là quân ngửa)
              // -> Thực hiện nước đi vật lý trên bàn cờ
              gameState.move(from, to)
            }
          }
          return // DỪNG LẠI, CHỜ NGƯỜI DÙNG
        }

        // --- TRƯỜNG HỢP 3: KHÔNG CÓ GÌ BÍ ẨN (QUÂN NGỬA ĐI/ĂN QUÂN NGỬA HOẶC ĐI VÀO Ô TRỐNG) ---
        // -> AI đi luôn
        gameState.move(from, to)
      }

      // Kích hoạt quy trình
      executeMoveSequence()
    }
  }

  // --- CÁC HÀM ĐIỀU KHIỂN ---
  
  const startAnalysis = () => {
    // Gửi FEN hiện tại xuống engine
    const fen = generateFen()
    postMessage(`position fen ${fen}`)
    postMessage('go infinite') // Phân tích vô tận
    isThinking.value = true
  }

  const stopAnalysis = () => {
    postMessage('stop')
    isThinking.value = false
  }

  const makeMove = (depth = 15, time = 1000) => {
    // Yêu cầu engine tìm nước đi (theo độ sâu hoặc thời gian)
    const fen = generateFen()
    postMessage(`position fen ${fen}`)
    // Ví dụ: Tìm trong 1 giây (movetime) hoặc độ sâu cụ thể
    // Bạn có thể tùy chỉnh lệnh go ở đây
    postMessage(`go movetime ${time}`) 
    isThinking.value = true
  }

  const setOption = (name: string, value: string | number | boolean) => {
    postMessage(`setoption name ${name} value ${value}`)
  }

  const newGame = () => {
    postMessage('ucinewgame')
    isThinking.value = false
  }

  // Tự động tắt worker khi component bị hủy
  onUnmounted(() => {
    if (worker) {
      worker.terminate()
      worker = null
    }
  })

  // Khởi động worker ngay khi gọi composable
  initWorker()

  return {
    isThinking,
    isReady,
    analysis,
    bestMove,
    ponderMove,
    pvMoves,
    multiPvMoves,
    
    // Methods
    startAnalysis,
    stopAnalysis,
    makeMove,
    setOption,
    newGame,
    
    // Nếu cần public worker để thao tác sâu hơn
    postMessage
  }
}