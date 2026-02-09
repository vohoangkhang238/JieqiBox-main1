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

  const processLiveFrame = async (source: HTMLVideoElement): Promise<DetectionBox[]> => {
    if (isBusy.value || !session.value) return []
    isBusy.value = true
    try {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 640
      const ctx = canvas.getContext('2d')!; ctx.drawImage(source, 0, 0, 640, 640)
      const imgD = ctx.getImageData(0,0,640,640).data
      const input = new Float32Array(1228800)
      for(let i=0, p=0; i<imgD.length; i+=4, p++) { 
        input[p]=imgD[i]/255; input[p+409600]=imgD[i+1]/255; input[p+819200]=imgD[i+2]/255 
      }
      const tensor = new ort.Tensor('float32', input, [1,3,640,640])
      const res = await session.value.run({ [session.value.inputNames[0]]: tensor })
      const data = (res.output0 || Object.values(res)[0]).data as Float32Array
      const stride = (res.output0 || Object.values(res)[0]).dims[2]
      
      const boxes: DetectionBox[] = []
      const meta = { r: 640/source.videoWidth, dw: 0, dh: 0 }
      for (let i = 0; i < stride; i++) {
        let score = 0, idx = -1
        for (let c = 0; c < 34; c++) { if (data[(4+c)*stride+i] > score) { score = data[(4+c)*stride+i]; idx = c } }
        
        // ĐƯA VỀ MẶC ĐỊNH 50% NHƯ BẠN YÊU CẦU
        if (score > 0.5) {
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
    boxes.filter(b => !['Board', 'board'].includes(LABELS[b.labelIndex].name)).forEach(p => {
      const i = Math.round(((p.box[0] + p.box[2]/2 - bx) / bw) * 8)
      const j = Math.round(((p.box[1] + p.box[3]/2 - by) / bh) * 9)
      if (i>=0 && i<9 && j>=0 && j<10) {
        if (!grid[j][i] || p.score > grid[j][i].score) grid[j][i] = p
      }
    })
    return grid
  }

  return { processLiveFrame, updateBoardGrid, initializeModel }
}