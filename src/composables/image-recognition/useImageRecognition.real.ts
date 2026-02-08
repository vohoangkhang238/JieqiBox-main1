import { ref } from 'vue'
import * as ort from 'onnxruntime-web'
import { LABELS, type DetectionBox, type ProcessedImage } from './types'

// Mapping nhãn cho Model YOLOv5 cờ ngửa của bạn
const LABELS_V5: Record<number, string> = {
  0: 'b_horse', 1: 'b_xiang', 2: 'b_shi', 3: 'b_jiang', 
  4: 'b_che', 5: 'b_pao', 6: 'b_bing', 7: 'r_che', 
  8: 'r_ma', 9: 'r_shi', 10: 'r_jiang', 11: 'r_xiang', 
  12: 'r_pao', 13: 'r_bing', 14: 'board'
}

export const useImageRecognition = () => {
  const sJieqi = ref<ort.InferenceSession | null>(null)
  const sStand = ref<ort.InferenceSession | null>(null)
  const isBusy = ref(false)

  const initializeModel = async () => {
    if (sJieqi.value) return
    const base = (import.meta as any).env?.BASE_URL || '/'
    ort.env.wasm.wasmPaths = base + 'ort/'
    try {
      sJieqi.value = await ort.InferenceSession.create(base + 'models/best.onnx', { executionProviders: ['wasm'] })
      sStand.value = await ort.InferenceSession.create(base + 'models/standard.onnx', { executionProviders: ['wasm'] })
      console.log("✅ Hệ thống Hybrid (v8 & v5) đã sẵn sàng.");
    } catch (e) { console.error("Lỗi nạp model:", e) }
  }

  // Parse YOLOv5 (Cờ ngửa)
  const parseV5 = (output: any, meta: any): DetectionBox[] => {
    const boxes: DetectionBox[] = [], data = output.data as Float32Array
    const [_, numBoxes, rawValues] = output.dims
    for (let i = 0; i < numBoxes; i++) {
      const off = i * rawValues, conf = data[off + 4]
      if (conf > 0.45) { // Tăng ngưỡng tin cậy cho cờ ngửa
        let maxS = 0, idx = -1
        for (let c = 0; c < 15; c++) { if (data[off + 5 + c] > maxS) { maxS = data[off + 5 + c]; idx = c } }
        if (maxS * conf > 0.45) {
          const [cx, cy, w, h] = [data[off], data[off+1], data[off+2], data[off+3]]
          boxes.push({ box: [(cx-w/2-meta.dw)/meta.r, (cy-h/2-meta.dh)/meta.r, w/meta.r, h/meta.r], score: maxS*conf, labelIndex: idx })
        }
      }
    }
    return boxes
  }

  // Parse YOLOv8/v11 (Cờ úp)
  const parseV8 = (output: any, meta: any): DetectionBox[] => {
    const boxes: DetectionBox[] = [], data = output.data as Float32Array, shape = output.dims
    const stride = shape[2]
    for (let i = 0; i < stride; i++) {
      let score = 0, idx = -1
      for (let c = 0; c < 34; c++) { if (data[(4 + c) * stride + i] > score) { score = data[(4 + c) * stride + i]; idx = c } }
      if (score > 0.4) {
        const [cx, cy, w, h] = [data[stride*0+i], data[stride*1+i], data[stride*2+i], data[stride*3+i]]
        boxes.push({ box: [(cx-w/2-meta.dw)/meta.r, (cy-h/2-meta.dh)/meta.r, w/meta.r, h/meta.r], score, labelIndex: idx })
      }
    }
    return boxes
  }

  const processLiveFrame = async (source: HTMLVideoElement): Promise<DetectionBox[]> => {
    if (isBusy.value || !sJieqi.value) return []
    isBusy.value = true
    try {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 640
      const ctx = canvas.getContext('2d')!; ctx.drawImage(source, 0, 0, 640, 640)
      const imgD = ctx.getImageData(0,0,640,640).data
      const input = new Float32Array(1228800)
      for(let i=0; i<409600; i++) { input[i]=imgD[i*4]/255; input[i+409600]=imgD[i*4+1]/255; input[i+819200]=imgD[i*4+2]/255 }
      const tensor = new ort.Tensor('float32', input, [1,3,640,640])
      const meta = { r: 640/source.videoWidth, dw: 0, dh: 0 }

      const [rJ, rS] = await Promise.all([
        sJieqi.value.run({ [sJieqi.value.inputNames[0]]: tensor }),
        sStand.value!.run({ [sStand.value!.inputNames[0]]: tensor })
      ])

      const bJ = parseV8(rJ.output0 || Object.values(rJ)[0], meta)
      const bS = parseV5(rS.output0 || Object.values(rS)[0], meta)

      // --- CHIẾN THUẬT GỘP ---
      // 1. Lấy Board từ Jieqi
      const board = bJ.find(b => LABELS[b.labelIndex].name === 'Board')
      
      // 2. Chuyển đổi nhãn Stand sang nhãn hệ thống
      const standardPieces = bS.filter(b => LABELS_V5[b.labelIndex] !== 'board').map(b => {
        const name = LABELS_V5[b.labelIndex].replace('ma', 'horse').replace('xiang', 'elephant').replace('shi', 'advisor').replace('jiang', 'general').replace('che', 'chariot').replace('pao', 'cannon').replace('bing', 'soldier')
        const sysIdx = Object.keys(LABELS).find(k => LABELS[Number(k)].name === name)
        return { ...b, labelIndex: Number(sysIdx || 0) }
      })

      // 3. Lấy quân Úp từ Jieqi
      const darkPieces = bJ.filter(b => LABELS[b.labelIndex].name.includes('dark'))

      // 4. Lọc: Nếu một vị trí có cả quân ngửa và quân úp, ưu tiên quân ngửa (vì nó đã lật mặt)
      const filteredDark = darkPieces.filter(db => !standardPieces.some(sb => {
        const dist = Math.sqrt(Math.pow((sb.box[0]+sb.box[2]/2)-(db.box[0]+db.box[2]/2), 2) + Math.pow((sb.box[1]+sb.box[3]/2)-(db.box[1]+db.box[3]/2), 2))
        return dist < (sb.box[2] + db.box[2]) / 4
      }))

      const results = [...standardPieces, ...filteredDark]
      if (board) results.push(board)
      return results
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