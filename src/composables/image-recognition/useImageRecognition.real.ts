import { ref } from 'vue'
import * as ort from 'onnxruntime-web'
import { LABELS, type DetectionBox, type ProcessedImage } from './types'

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
  const isInferenceBusy = ref(false) // Biến khóa bảo vệ

  const initializeModel = async (): Promise<void> => {
    if (sessionJieqi.value && sessionStandard.value) return
    try {
      isModelLoading.value = true
      const base = (import.meta as any).env?.BASE_URL || '/'
      ort.env.wasm.wasmPaths = base + 'ort/'
      
      const [s1, s2] = await Promise.all([
        ort.InferenceSession.create(base + 'models/best.onnx', { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }),
        ort.InferenceSession.create(base + 'models/standard.onnx', { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
      ])
      sessionJieqi.value = s1
      sessionStandard.value = s2
    } catch (error) {
      console.error('AI: Lỗi tải model:', error)
    } finally {
      isModelLoading.value = false
    }
  }

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

  const parseOutput = (output: any, meta: any, numClasses: number): DetectionBox[] => {
    const boxes: DetectionBox[] = []
    const data = output.data as Float32Array
    const shape = output.dims
    const { r, dw, dh } = meta
    const isV8 = shape[1] < shape[2]
    const numBoxes = isV8 ? shape[2] : shape[1]
    const stride = isV8 ? shape[2] : 1

    for (let i = 0; i < numBoxes; i++) {
      let maxScore = 0, labelIdx = -1
      for (let c = 0; c < numClasses; c++) {
        const scoreIdx = isV8 ? (4 + c) * stride + i : i * (numClasses + 5) + (5 + c)
        if (data[scoreIdx] > maxScore) { maxScore = data[scoreIdx]; labelIdx = c }
      }
      if (maxScore > 0.3) {
        const cx = isV8 ? data[0 * stride + i] : data[i * (numClasses + 5) + 0]
        const cy = isV8 ? data[1 * stride + i] : data[i * (numClasses + 5) + 1]
        const w = isV8 ? data[2 * stride + i] : data[i * (numClasses + 5) + 2]
        const h = isV8 ? data[3 * stride + i] : data[i * (numClasses + 5) + 3]
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
    
    // NẾU AI ĐANG BẬN, THOÁT LUÔN KHÔNG CHẠY TRÙNG
    if (isInferenceBusy.value) return []
    
    try {
      isInferenceBusy.value = true // Đóng khóa
      const prep = await preprocess(source)
      
      // Chạy tuần tự thay vì Promise.all để tránh lỗi Session already started trong WASM
      const resJieqi = await sessionJieqi.value!.run({ [sessionJieqi.value!.inputNames[0]]: prep.tensor })
      const resStandard = await sessionStandard.value!.run({ [sessionStandard.value!.inputNames[0]]: prep.tensor })

      const boxesJieqi = parseOutput(resJieqi.output0 || Object.values(resJieqi)[0], prep.meta, 34)
      const boxesStandard = parseOutput(resStandard.output0 || Object.values(resStandard)[0], prep.meta, 15)

      const jieqiRes = boxesJieqi.filter(b => {
        const name = LABELS[b.labelIndex].name
        return name === 'Board' || name.toLowerCase().includes('dark')
      })

      const standardRes = boxesStandard
        .filter(b => LABELS_STANDARD[b.labelIndex] !== 'empty')
        .map(b => {
          const name = LABELS_STANDARD[b.labelIndex]
          const globalIdx = Object.keys(LABELS).find(k => LABELS[Number(k)].name === name)
          return { ...b, labelIndex: Number(globalIdx || b.labelIndex) }
        })

      return [...jieqiRes, ...standardRes]
    } catch (e) {
      console.error("Lỗi Inference:", e)
      return []
    } finally {
      isInferenceBusy.value = false // Mở khóa cho lượt sau
    }
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