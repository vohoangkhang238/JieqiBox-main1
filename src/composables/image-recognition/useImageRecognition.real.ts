import { ref } from 'vue'
import * as ort from 'onnxruntime-web'
import { LABELS, type DetectionBox, type ProcessedImage } from './types'

export const useImageRecognition = () => {
  const session = ref<ort.InferenceSession | null>(null)
  const isModelLoading = ref(false)
  const isInferenceBusy = ref(false)

  const initializeModel = async (): Promise<void> => {
    if (session.value) return
    try {
      isModelLoading.value = true
      const base = (import.meta as any).env?.BASE_URL || '/'
      ort.env.wasm.wasmPaths = base + 'ort/'
      session.value = await ort.InferenceSession.create(
        base + 'models/best.onnx',
        { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }
      )
      console.log("AI: Model best.onnx đã sẵn sàng");
    } catch (error) {
      console.error('AI: Lỗi tải model:', error)
    } finally {
      isModelLoading.value = false
    }
  }

  const letterbox = (image: CanvasImageSource): ProcessedImage => {
    const [newH, newW] = [640, 640]
    let imgW = (image as any).videoWidth || (image as any).width || 640
    let imgH = (image as any).videoHeight || (image as any).height || 640
    const r = Math.min(newW / imgW, newH / imgH)
    const newUnpadW = Math.round(imgW * r), newUnpadH = Math.round(imgH * r)
    const dw = (newW - newUnpadW) / 2, dh = (newH - newUnpadH) / 2
    const canvas = document.createElement('canvas')
    canvas.width = 640; canvas.height = 640
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.fillStyle = 'rgb(114,114,114)'; ctx.fillRect(0, 0, 640, 640)
    ctx.drawImage(image, 0, 0, imgW, imgH, Math.round(dw), Math.round(dh), newUnpadW, newUnpadH)
    return { canvas, context: ctx, meta: { r, dw, dh, newW: 640, newH: 640, imgW, imgH } }
  }

  const preprocess = async (image: CanvasImageSource) => {
    const { canvas, meta } = letterbox(image)
    const data = canvas.getContext('2d')!.getImageData(0, 0, 640, 640).data
    const input = new Float32Array(1228800)
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      input[p] = data[i] / 255; input[p + 409600] = data[i+1] / 255; input[p + 819200] = data[i+2] / 255
    }
    return { tensor: new ort.Tensor('float32', input, [1, 3, 640, 640]), meta }
  }

  const parseOutput = (output: any, meta: any): DetectionBox[] => {
    const boxes: DetectionBox[] = [], data = output.data as Float32Array, shape = output.dims
    const { r, dw, dh } = meta
    const stride = shape[2] 
    for (let i = 0; i < stride; i++) {
      let maxScore = 0, labelIdx = -1
      for (let c = 0; c < 34; c++) { 
        const score = data[(4 + c) * stride + i]
        if (score > maxScore) { maxScore = score; labelIdx = c }
      }
      if (maxScore > 0.4) {
        const cx = data[0 * stride + i], cy = data[1 * stride + i]
        const w = data[2 * stride + i], h = data[3 * stride + i]
        boxes.push({
          box: [(cx - w / 2 - dw) / r, (cy - h / 2 - dh) / r, w / r, h / r],
          score: maxScore,
          labelIndex: labelIdx
        })
      }
    }
    return boxes
  }

  const processLiveFrame = async (source: HTMLVideoElement): Promise<DetectionBox[]> => {
    if (!session.value) await initializeModel()
    if (isInferenceBusy.value) return []
    try {
      isInferenceBusy.value = true
      const prep = await preprocess(source)
      const results = await session.value!.run({ [session.value!.inputNames[0]]: prep.tensor })
      return parseOutput(results.output0 || Object.values(results)[0], prep.meta)
    } catch (e) {
      console.error("Inference Error:", e)
      return []
    } finally {
      isInferenceBusy.value = false
    }
  }

  const updateBoardGrid = (boxes: DetectionBox[]) => {
    const board = boxes.find(b => LABELS[b.labelIndex].name === 'Board')
    const grid = Array(10).fill(null).map(() => Array(9).fill(null))
    if (!board) return grid
    const [bx, by, bw, bh] = board.box
    boxes.filter(b => LABELS[b.labelIndex].name !== 'Board').forEach(p => {
      const i = Math.round(((p.box[0] + p.box[2]/2 - bx) / bw) * 8)
      const j = Math.round(((p.box[1] + p.box[3]/2 - by) / bh) * 9)
      if (i >= 0 && i < 9 && j >= 0 && j < 10) grid[j][i] = p
    })
    return grid
  }

  return { processLiveFrame, updateBoardGrid, initializeModel, isModelLoading }
}