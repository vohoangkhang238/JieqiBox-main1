import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import * as ort from 'onnxruntime-web'
import { LABELS, type DetectionBox, type ProcessedImage } from './types'

export const useImageRecognition = () => {
  const { t } = useI18n()
  const session = ref<ort.InferenceSession | null>(null)
  const isModelLoading = ref(false)
  const isProcessing = ref(false)
  const status = ref('')
  const detectedBoxes = ref<DetectionBox[]>([])
  const inputImage = ref<HTMLImageElement | null>(null)
  const outputCanvas = ref<HTMLCanvasElement | null>(null)
  const showBoundingBoxes = ref(true)

  const initializeModel = async (): Promise<void> => {
    if (session.value) return
    try {
      isModelLoading.value = true
      const base = (import.meta as any).env?.BASE_URL || '/'
      ort.env.wasm.wasmPaths = base + 'ort/'
      session.value = await ort.InferenceSession.create(
        base + 'models/best.onnx',
        {
          executionProviders: ['wasm'],
          graphOptimizationLevel: 'all',
        }
      )
    } catch (error) {
      console.error('Model loading failed:', error)
      throw error
    } finally {
      isModelLoading.value = false
    }
  }

  const letterbox = (
    image: CanvasImageSource,
    newShape = [640, 640],
    color = 114
  ): ProcessedImage => {
    const [newH, newW] = newShape
    let imgW: number, imgH: number
    if (image instanceof HTMLVideoElement) {
      imgW = image.videoWidth
      imgH = image.videoHeight
    } else {
      imgW = (image as any).width || (image as any).naturalWidth
      imgH = (image as any).height || (image as any).naturalHeight
    }

    const r = Math.min(newW / imgW, newH / imgH)
    const newUnpadW = Math.round(imgW * r)
    const newUnpadH = Math.round(imgH * r)
    const dw = (newW - newUnpadW) / 2
    const dh = (newH - newUnpadH) / 2

    const canvas = document.createElement('canvas')
    canvas.width = newW
    canvas.height = newH
    const context = canvas.getContext('2d', { willReadFrequently: true })!

    context.fillStyle = `rgb(${color}, ${color}, ${color})`
    context.fillRect(0, 0, newW, newH)
    context.drawImage(image, 0, 0, imgW, imgH, Math.round(dw), Math.round(dh), newUnpadW, newUnpadH)

    return { canvas, context, meta: { r, dw, dh, newW, newH, imgW, imgH } }
  }

  const preprocess = async (image: CanvasImageSource) => {
    const modelW = 640
    const modelH = 640
    const { canvas, meta } = letterbox(image, [modelH, modelW], 114)
    const context = canvas.getContext('2d')!
    const imageData = context.getImageData(0, 0, modelW, modelH)
    const { data } = imageData
    const [red, green, blue] = [new Float32Array(modelW * modelH), new Float32Array(modelW * modelH), new Float32Array(modelW * modelH)]

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      red[p] = data[i] / 255; green[p] = data[i + 1] / 255; blue[p] = data[i + 2] / 255
    }

    const input = new Float32Array(modelW * modelH * 3)
    input.set(red, 0); input.set(green, modelW * modelH); input.set(blue, modelW * modelH * 2)
    return { tensor: new ort.Tensor('float32', input, [1, 3, modelH, modelW]), meta }
  }

  const processLiveFrame = async (source: CanvasImageSource): Promise<DetectionBox[]> => {
    if (!session.value) await initializeModel()
    try {
      const prep = await preprocess(source)
      const inputName = session.value!.inputNames.includes('images') ? 'images' : session.value!.inputNames[0]
      const results = await session.value!.run({ [inputName]: prep.tensor })
      const firstOut = results.output0 || results[Object.keys(results)[0]]
      return postprocess(firstOut.data as any, firstOut.dims as any, prep.meta)
    } catch (e) { return [] }
  }

  const iou = (boxA: DetectionBox, boxB: DetectionBox): number => {
    const [x1A, y1A, wA, hA] = boxA.box, [x1B, y1B, wB, hB] = boxB.box
    const inter = Math.max(0, Math.min(x1A + wA, x1B + wB) - Math.max(x1A, x1B)) * Math.max(0, Math.min(y1A + hA, y1B + hB) - Math.max(y1A, y1B))
    return inter / (wA * hA + wB * hB - inter || 1)
  }

  const nms = (boxes: DetectionBox[], iouThresh = 0.7): DetectionBox[] => {
    boxes.sort((a, b) => b.score - a.score)
    const result: DetectionBox[] = [], removed = new Array(boxes.length).fill(false)
    for (let i = 0; i < boxes.length; i++) {
      if (removed[i]) continue
      result.push(boxes[i])
      for (let j = i + 1; j < boxes.length; j++) if (iou(boxes[i], boxes[j]) > iouThresh) removed[j] = true
    }
    return result
  }

  const postprocess = (data: Float32Array, shape: number[], meta: any): DetectionBox[] => {
    const boxes: DetectionBox[] = [], confThresh = 0.25
    const num_coords = 4, num_classes = 34
    const r = meta.r, dw = meta.dw, dh = meta.dh
    
    // Hỗ trợ định dạng YOLOv11 [1, 38, 8400]
    for (let i = 0; i < shape[2]; i++) {
      let maxScore = -1, maxIdx = -1
      for (let c = 0; c < num_classes; c++) {
        const score = data[(num_coords + c) * shape[2] + i]
        if (score > maxScore) { maxScore = score; maxIdx = c }
      }
      if (maxScore > confThresh) {
        const cx = data[0 * shape[2] + i], cy = data[1 * shape[2] + i]
        const w = data[2 * shape[2] + i], h = data[3 * shape[2] + i]
        boxes.push({ box: [(cx - w / 2 - dw) / r, (cy - h / 2 - dh) / r, w / r, h / r], score: maxScore, labelIndex: maxIdx })
      }
    }
    return nms(boxes)
  }

  const updateBoardGrid = (boxes: DetectionBox[]) => {
    const board = boxes.filter(b => LABELS[b.labelIndex]?.name === 'Board').sort((a, b) => b.score - a.score)[0]
    const grid: (DetectionBox | null)[][] = Array(10).fill(null).map(() => Array(9).fill(null))
    if (!board) return grid
    const [bx, by, bw, bh] = board.box
    boxes.filter(p => LABELS[p.labelIndex]?.name !== 'Board').forEach(p => {
      const [px, py, pw, ph] = p.box, cx = px + pw/2, cy = py + ph/2
      const i = Math.round(((cx - bx) / bw) * 8), j = Math.round(((cy - by) / bh) * 9)
      if (i >= 0 && i < 9 && j >= 0 && j < 10) grid[j][i] = p
    })
    return grid
  }

  return { isModelLoading, status, processLiveFrame, updateBoardGrid, initializeModel }
}