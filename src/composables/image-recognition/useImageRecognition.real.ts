import { ref } from 'vue'
import * as ort from 'onnxruntime-web'
import { LABELS, type DetectionBox } from './types'

const LABELS_S: Record<number, string> = {
  0:'b_horse', 1:'b_elephant', 2:'b_advisor', 3:'b_general', 4:'b_chariot', 
  5:'b_cannon', 6:'b_soldier', 7:'r_chariot', 8:'r_horse', 9:'r_advisor', 
  10:'r_general', 11:'r_elephant', 12:'r_cannon', 13:'r_soldier', 14:'empty'
}

export const useImageRecognition = () => {
  const sJieqi = ref<any>(null); const sStand = ref<any>(null)
  const isBusy = ref(false)

  const initializeModel = async () => {
    if (sJieqi.value) return
    const base = (import.meta as any).env?.BASE_URL || '/'
    ort.env.wasm.wasmPaths = base + 'ort/'
    sJieqi.value = await ort.InferenceSession.create(base + 'models/best.onnx', { executionProviders: ['wasm'] })
    sStand.value = await ort.InferenceSession.create(base + 'models/standard.onnx', { executionProviders: ['wasm'] })
    console.log("👉 Đã nạp 2 Model thành công!");
  }

  const parse = (out: any, meta: any, numCls: number) => {
    const boxes: DetectionBox[] = []; const d = out.data; const shp = out.dims
    const isV8 = shp[1] < shp[2]; const numB = isV8 ? shp[2] : shp[1]; const strd = isV8 ? shp[2] : 1
    for (let i = 0; i < numB; i++) {
      let score = 0, idx = -1
      for (let c = 0; c < numCls; c++) {
        const s = d[isV8 ? (4+c)*strd+i : i*(numCls+5)+5+c]
        if (s > score) { score = s; idx = c }
      }
      if (score > 0.4) {
        const cx = isV8 ? d[0*strd+i] : d[i*(numCls+5)+0]
        const cy = isV8 ? d[1*strd+i] : d[i*(numCls+5)+1]
        const w = isV8 ? d[2*strd+i] : d[i*(numCls+5)+2]
        const h = isV8 ? d[3*strd+i] : d[i*(numCls+5)+3]
        boxes.push({ box: [(cx-w/2-meta.dw)/meta.r, (cy-h/2-meta.dh)/meta.r, w/meta.r, h/meta.r], score, labelIndex: idx })
      }
    }
    return boxes
  }

  const processLiveFrame = async (source: any): Promise<DetectionBox[]> => {
    if (isBusy.value || !sJieqi.value) return []
    isBusy.value = true
    try {
      // 1. Tiền xử lý (Viết gọn lại để tránh lỗi)
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 640
      const ctx = canvas.getContext('2d')!; ctx.drawImage(source, 0, 0, 640, 640)
      const imgD = ctx.getImageData(0,0,640,640).data
      const input = new Float32Array(1228800)
      for(let i=0; i<409600; i++) { input[i]=imgD[i*4]/255; input[i+409600]=imgD[i*4+1]/255; input[i+819200]=imgD[i*4+2]/255 }
      const tensor = new ort.Tensor('float32', input, [1,3,640,640])
      const meta = { r: 640/source.videoWidth, dw: 0, dh: 0 }

      // 2. Chạy 2 model (Tuần tự để không bị lỗi Session)
      const rJ = await sJieqi.value.run({ [sJieqi.value.inputNames[0]]: tensor })
      const rS = await sStand.value.run({ [sStand.value.inputNames[0]]: tensor })

      const bJ = parse(rJ.output0 || Object.values(rJ)[0], meta, 34)
      const bS = parse(rS.output0 || Object.values(rS)[0], meta, 15)

      // 3. Gộp: Ưu tiên Board và Dark từ Model 1, Quân ngửa từ Model 2
      const finalJ = bJ.filter(b => LABELS[b.labelIndex].name === 'Board' || LABELS[b.labelIndex].name.includes('dark'))
      const finalS = bS.map(b => {
        const name = LABELS_S[b.labelIndex]
        const sysIdx = Object.keys(LABELS).find(k => LABELS[Number(k)].name === name)
        return { ...b, labelIndex: Number(sysIdx || 0) }
      })

      return [...finalJ, ...finalS]
    } catch (e) { return [] } finally { isBusy.value = false }
  }

  return { processLiveFrame, initializeModel, updateBoardGrid: (boxes: any) => {
    const board = boxes.find((b: any) => LABELS[b.labelIndex].name === 'Board')
    const grid = Array(10).fill(null).map(() => Array(9).fill(null))
    if (!board) return grid
    boxes.filter((b: any) => LABELS[b.labelIndex].name !== 'Board').forEach((p: any) => {
      const i = Math.round(((p.box[0] + p.box[2]/2 - board.box[0]) / board.box[2]) * 8)
      const j = Math.round(((p.box[1] + p.box[3]/2 - board.box[1]) / board.box[3]) * 9)
      if (i>=0 && i<9 && j>=0 && j<10) grid[j][i] = p
    })
    return grid
  }}
}