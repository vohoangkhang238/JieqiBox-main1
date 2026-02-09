import { ref } from 'vue'
import * as ort from 'onnxruntime-web'
import { LABELS, type DetectionBox, type ProcessedImage } from './types'

export const useImageRecognition = () => {
  const session = ref<ort.InferenceSession | null>(null)
  const isBusy = ref(false)

  const initializeModel = async () => {
    if (session.value) return
    const base = (import.meta as any).env?.BASE_URL || '/'
    ort.env.wasm.wasmPaths = base + 'ort/'
    session.value = await ort.InferenceSession.create(base + 'models/best.onnx', { 
      executionProviders: ['wasm'], 
      graphOptimizationLevel: 'all' 
    })
  }

  // Thuật toán NMS để loại bỏ các Box trùng lặp
  const nms = (boxes: DetectionBox[]) => {
    const sorted = [...boxes].sort((a, b) => b.score - a.score)
    const result: DetectionBox[] = []
    while (sorted.length > 0) {
      const best = sorted.shift()!
      result.push(best)
      for (let i = 0; i < sorted.length; i++) {
        const iou = calculateIoU(best.box, sorted[i].box)
        if (iou > 0.45) { sorted.splice(i, 1); i-- }
      }
    }
    return result
  }

  const calculateIoU = (b1: any, b2: any) => {
    const x1 = Math.max(b1[0], b2[0]), y1 = Math.max(b1[1], b2[1])
    const x2 = Math.min(b1[0] + b1[2], b2[0] + b2[2]), y2 = Math.min(b1[1] + b1[3], b2[1] + b2[3])
    const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
    return inter / (b1[2] * b1[3] + b2[2] * b2[3] - inter)
  }

  const processLiveFrame = async (source: HTMLVideoElement): Promise<DetectionBox[]> => {
    if (isBusy.value || !session.value) return []
    isBusy.value = true
    try {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 640
      const ctx = canvas.getContext('2d')!; ctx.drawImage(source, 0, 0, 640, 640)
      const imgD = ctx.getImageData(0,0,640,640).data
      const input = new Float32Array(1228800)
      for(let i=0; i<409600; i++) { input[i]=imgD[i*4]/255; input[i+409600]=imgD[i*4+1]/255; input[i+819200]=imgD[i*4+2]/255 }
      const tensor = new ort.Tensor('float32', input, [1,3,640,640])
      const meta = { r: 640/source.videoWidth, dw: 0, dh: 0 }

      const results = await session.value.run({ [session.value.inputNames[0]]: tensor })
      const data = results.output0.data as Float32Array
      const stride = results.output0.dims[2]
      
      const boxes: DetectionBox[] = []
      for (let i = 0; i < stride; i++) {
        let score = 0, idx = -1
        for (let c = 0; c < 34; c++) {
          if (data[(4 + c) * stride + i] > score) { score = data[(4 + c) * stride + i]; idx = c }
        }
        if (score > 0.4) {
          const [cx, cy, w, h] = [data[0*stride+i], data[1*stride+i], data[2*stride+i], data[3*stride+i]]
          boxes.push({ box: [(cx-w/2)/meta.r, (cy-h/2)/meta.r, w/meta.r, h/meta.r], score, labelIndex: idx })
        }
      }
      return nms(boxes)
    } catch (e) { return [] } finally { isBusy.value = false }
  }

  const updateBoardGrid = (boxes: DetectionBox[]) => {
    const board = boxes.find(b => LABELS[b.labelIndex].name === 'Board')
    const grid = Array(10).fill(null).map(() => Array(9).fill(null))
    if (!board) return grid

    const [bx, by, bw, bh] = board.box
    const cellW = bw / 8, cellH = bh / 9

    boxes.filter(b => LABELS[b.labelIndex].name !== 'Board').forEach(p => {
      const cx = p.box[0] + p.box[2]/2, cy = p.box[1] + p.box[3]/2
      const i = Math.round((cx - bx) / cellW), j = Math.round((cy - by) / cellH)
      
      // RÀNG BUỘC LOGIC: Quân cờ phải nằm trong lưới 10x9
      if (i >= 0 && i <= 8 && j >= 0 && j <= 9) {
        if (!grid[j][i] || p.score > grid[j][i].score) grid[j][i] = p
      }
    })
    return grid
  }

  return { processLiveFrame, updateBoardGrid, initializeModel }
}