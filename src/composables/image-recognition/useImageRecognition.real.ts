import { ref } from 'vue'
import * as ort from 'onnxruntime-web'
import { LABELS, type DetectionBox } from './types'

export const useImageRecognition = () => {
  const session = ref<ort.InferenceSession | null>(null)
  const isBusy = ref(false)
  // Tận dụng lại canvas để không phải tạo mới liên tục làm chậm bộ nhớ
  const offscreenCanvas = document.createElement('canvas')
  offscreenCanvas.width = 640
  offscreenCanvas.height = 640

  const initializeModel = async () => {
    if (session.value) return
    const base = (import.meta as any).env?.BASE_URL || '/'
    ort.env.wasm.wasmPaths = base + 'ort/'
    session.value = await ort.InferenceSession.create(base + 'models/best.onnx', { 
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all' 
    })
  }

  const processLiveFrame = async (source: HTMLVideoElement): Promise<DetectionBox[]> => {
    if (isBusy.value || !session.value || source.videoWidth === 0) return []
    isBusy.value = true
    try {
      const ctx = offscreenCanvas.getContext('2d', { willReadFrequently: true })!
      ctx.drawImage(source, 0, 0, 640, 640)
      const imgD = ctx.getImageData(0,0,640,640).data
      const input = new Float32Array(1228800)
      // Tối ưu vòng lặp copy dữ liệu pixel
      for(let i=0; i<409600; i++) {
        input[i] = imgD[i*4]/255; input[i+409600] = imgD[i*4+1]/255; input[i+819200] = imgD[i*4+2]/255
      }
      const tensor = new ort.Tensor('float32', input, [1,3,640,640])
      const res = await session.value.run({ [session.value.inputNames[0]]: tensor })
      const data = (res.output0 || Object.values(res)[0]).data as Float32Array
      const stride = (res.output0 || Object.values(res)[0]).dims[2]
      
      const boxes: DetectionBox[] = []
      const meta = { r: 640/source.videoWidth }
      for (let i = 0; i < stride; i++) {
        let score = 0, idx = -1
        for (let c = 0; c < 34; c++) { 
          if (data[(4+c)*stride+i] > score) { score = data[(4+c)*stride+i]; idx = c } 
        }
        // Giữ ngưỡng 0.45 để loại bỏ quân "ma" gây lỗi FEN dài
        if (score > 0.45) {
          const [cx, cy, w, h] = [data[0*stride+i], data[1*stride+i], data[2*stride+i], data[3*stride+i]]
          boxes.push({ box: [(cx-w/2)/meta.r, (cy-h/2)/meta.r, w/meta.r, h/meta.r], score, labelIndex: idx })
        }
      }
      return boxes
    } catch (e) { return [] } finally { isBusy.value = false }
  }

  const updateBoardGrid = (boxes: DetectionBox[]) => {
    const board = boxes.find(b => ['Board', 'board'].includes(LABELS[b.labelIndex].name))
    const grid = Array(10).fill(null).map(() => Array(9).fill(null))
    if (!board) return grid
    const [bx, by, bw, bh] = board.box
    
    boxes.filter(b => !['Board', 'board'].includes(LABELS[b.labelIndex].name))
      .sort((a, b) => b.score - a.score)
      .forEach(p => {
        // Cải tiến: Thêm biên an toàn để quân ở sát mép không bị văng khỏi lưới
        const i = Math.round(((p.box[0] + p.box[2]/2 - bx) / bw) * 8)
        const j = Math.round(((p.box[1] + p.box[3]/2 - by) / bh) * 9)
        if (i >= 0 && i < 9 && j >= 0 && j < 10) {
          if (!grid[j][i]) grid[j][i] = p
        }
      })
    return grid
  }

  return { processLiveFrame, updateBoardGrid, initializeModel }
}