import { ref } from 'vue'
import * as ort from 'onnxruntime-web'
import { LABELS, type DetectionBox, type ProcessedImage } from './types'

// Định nghĩa label của Model cờ ngửa bạn vừa cung cấp
const LABELS_STANDARD: Record<number, string> = {
  0: 'b_horse', 1: 'b_elephant', 2: 'b_advisor', 3: 'b_general', 
  4: 'b_chariot', 5: 'b_cannon', 6: 'b_soldier', 7: 'r_chariot', 
  8: 'r_horse', 9: 'r_advisor', 10: 'r_general', 11: 'r_elephant', 
  12: 'r_cannon', 13: 'r_soldier', 14: 'empty'
}

export const useImageRecognition = () => {
  const sessionJieqi = ref<ort.InferenceSession | null>(null)
  const sessionStandard = ref<ort.InferenceSession | null>(null)
  const isModelLoading = ref(false)

  const initializeModel = async (): Promise<void> => {
    if (sessionJieqi.value && sessionStandard.value) return
    try {
      isModelLoading.value = true
      const base = (import.meta as any).env?.BASE_URL || '/'
      ort.env.wasm.wasmPaths = base + 'ort/'
      
      // Load đồng thời 2 model
      const [s1, s2] = await Promise.all([
        ort.InferenceSession.create(base + 'models/best.onnx', { executionProviders: ['wasm'] }),
        ort.InferenceSession.create(base + 'models/standard.onnx', { executionProviders: ['wasm'] })
      ])
      sessionJieqi.value = s1
      sessionStandard.value = s2
    } catch (error) {
      console.error('Lỗi tải model:', error)
    } finally {
      isModelLoading.value = false
    }
  }

  // --- Hàm tiền xử lý giữ nguyên ---
  const letterbox = (image: CanvasImageSource, newShape = [640, 640], color = 114): ProcessedImage => {
    const [newH, newW] = newShape
    let imgW = (image as any).videoWidth || (image as any).width || (image as any).naturalWidth
    let imgH = (image as any).videoHeight || (image as any).height || (image as any).naturalHeight
    const r = Math.min(newW / imgW, newH / imgH)
    const newUnpadW = Math.round(imgW * r), newUnpadH = Math.round(imgH * r)
    const dw = (newW - newUnpadW) / 2, dh = (newH - newUnpadH) / 2
    const canvas = document.createElement('canvas')
    canvas.width = newW; canvas.height = newH
    const context = canvas.getContext('2d', { willReadFrequently: true })!
    context.fillStyle = `rgb(${color}, ${color}, ${color})`
    context.fillRect(0, 0, newW, newH)
    context.drawImage(image, 0, 0, imgW, imgH, Math.round(dw), Math.round(dh), newUnpadW, newUnpadH)
    return { canvas, context, meta: { r, dw, dh, newW, newH, imgW, imgH } }
  }

  const preprocess = async (image: CanvasImageSource) => {
    const { canvas, meta } = letterbox(image)
    const data = canvas.getContext('2d')!.getImageData(0, 0, 640, 640).data
    const [red, green, blue] = [new Float32Array(409600), new Float32Array(409600), new Float32Array(409600)]
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      red[p] = data[i] / 255; green[p] = data[i+1] / 255; blue[p] = data[i+2] / 255
    }
    const input = new Float32Array(1228800)
    input.set(red, 0); input.set(green, 409600); input.set(blue, 819200)
    return { tensor: new ort.Tensor('float32', input, [1, 3, 640, 640]), meta }
  }

  // Hậu xử lý cho từng model
  const postprocessModel = (output: any, meta: any, numClasses: number): DetectionBox[] => {
    const boxes: DetectionBox[] = []
    const data = output.data as Float32Array
    const shape = output.dims
    const { r, dw, dh } = meta

    for (let i = 0; i < shape[2]; i++) {
      let maxScore = 0, labelIdx = -1
      for (let c = 0; c < numClasses; c++) {
        const score = data[(4 + c) * shape[2] + i]
        if (score > maxScore) { maxScore = score; labelIdx = c }
      }
      if (maxScore > 0.3) {
        const cx = data[0 * shape[2] + i], cy = data[1 * shape[2] + i]
        const w = data[2 * shape[2] + i], h = data[3 * shape[2] + i]
        boxes.push({
          box: [(cx - w / 2 - dw) / r, (cy - h / 2 - dh) / r, w / r, h / r],
          score: maxScore,
          labelIndex: labelIdx
        })
      }
    }
    return boxes
  }

  const processLiveFrame = async (source: CanvasImageSource): Promise<DetectionBox[]> => {
    if (!sessionJieqi.value || !sessionStandard.value) await initializeModel()
    const prep = await preprocess(source)
    const feeds = { [sessionJieqi.value!.inputNames[0]]: prep.tensor }

    // Chạy song song 2 model
    const [resJieqi, resStandard] = await Promise.all([
      sessionJieqi.value!.run(feeds),
      sessionStandard.value!.run(feeds)
    ])

    // Xử lý kết quả model 1 (34 classes)
    const boxes1 = postprocessModel(resJieqi.output0 || Object.values(resJieqi)[0], prep.meta, 34)
    // Xử lý kết quả model 2 (15 classes)
    const boxes2 = postprocessModel(resStandard.output0 || Object.values(resStandard)[0], prep.meta, 15)

    // CHIẾN THUẬT KẾT HỢP:
    // 1. Lấy "Board" và các quân "dark" (úp) từ Model Jieqi
    const jieqiResult = boxes1.filter(b => LABELS[b.labelIndex].name === 'Board' || LABELS[b.labelIndex].name.startsWith('dark'))
    
    // 2. Lấy các quân ngửa từ Model Standard (vì chính xác cao hơn)
    const standardResult = boxes2.filter(b => LABELS_STANDARD[b.labelIndex] !== 'empty' && LABELS_STANDARD[b.labelIndex] !== 'Board')
    // Ánh xạ labelIndex của Model Standard sang labelIndex chuẩn của hệ thống
    const mappedStandard = standardResult.map(b => {
      const name = LABELS_STANDARD[b.labelIndex]
      const globalIdx = Object.keys(LABELS).find(key => LABELS[Number(key)].name === name)
      return { ...b, labelIndex: Number(globalIdx) }
    })

    return [...jieqiResult, ...mappedStandard]
  }

  const updateBoardGrid = (boxes: DetectionBox[]) => {
    const board = boxes.find(b => LABELS[b.labelIndex].name === 'Board')
    const grid = Array(10).fill(null).map(() => Array(9).fill(null))
    if (!board) return grid
    const [bx, by, bw, bh] = board.box
    boxes.filter(b => LABELS[b.labelIndex].name !== 'Board').forEach(p => {
      const cx = p.box[0] + p.box[2]/2, cy = p.box[1] + p.box[3]/2
      const i = Math.round(((cx - bx) / bw) * 8), j = Math.round(((cy - by) / bh) * 9)
      if (i >= 0 && i < 9 && j >= 0 && j < 10) grid[j][i] = p
    })
    return grid
  }

  return { processLiveFrame, updateBoardGrid, initializeModel, isModelLoading }
}