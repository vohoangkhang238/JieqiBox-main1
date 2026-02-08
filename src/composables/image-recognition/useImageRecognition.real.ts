import { ref } from 'vue'
import * as ort from 'onnxruntime-web'
import { LABELS, type DetectionBox, type ProcessedImage } from './types'

// MAPPING NHÃN MỚI CHO MODEL YOLOv5 CỜ NGỬA CỦA BẠN
const LABELS_V5: Record<number, string> = {
  0: 'b_horse', 1: 'b_elephant', 2: 'b_advisor', 3: 'b_general', 
  4: 'b_chariot', 5: 'b_cannon', 6: 'b_soldier', 7: 'r_chariot', 
  8: 'r_horse', 9: 'r_advisor', 10: 'r_general', 11: 'r_elephant', 
  12: 'r_cannon', 13: 'r_soldier', 14: 'Board'
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
      console.log("✅ Đã nạp Hybrid Model: Jieqi (v8/v11) & Standard (v5)");
    } catch (e) { console.error("Lỗi nạp model:", e) }
  }

  // Hàm xử lý output cho YOLOv5 (Model cờ ngửa)
  const parseV5 = (output: any, meta: any): DetectionBox[] => {
    const boxes: DetectionBox[] = []
    const data = output.data as Float32Array
    const [_, numBoxes, rawValues] = output.dims // Thường là [1, 25200, 20]
    const numClasses = 15

    for (let i = 0; i < numBoxes; i++) {
      const offset = i * rawValues
      const confidence = data[offset + 4] // Objectness score
      if (confidence > 0.4) {
        let maxClassScore = 0, labelIdx = -1
        for (let c = 0; c < numClasses; c++) {
          if (data[offset + 5 + c] > maxClassScore) {
            maxClassScore = data[offset + 5 + c]
            labelIdx = c
          }
        }
        if (maxClassScore * confidence > 0.4) {
          const [cx, cy, w, h] = [data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]
          boxes.push({
            box: [(cx - w / 2 - meta.dw) / meta.r, (cy - h / 2 - meta.dh) / meta.r, w / meta.r, h / meta.r],
            score: maxClassScore * confidence,
            labelIndex: labelIdx
          })
        }
      }
    }
    return boxes
  }

  // Hàm xử lý output cho YOLOv8/v11 (Model best.onnx cờ úp)
  const parseV8 = (output: any, meta: any): DetectionBox[] => {
    const boxes: DetectionBox[] = []
    const data = output.data as Float32Array
    const shape = output.dims
    const stride = shape[2]
    for (let i = 0; i < stride; i++) {
      let score = 0, idx = -1
      for (let c = 0; c < 34; c++) {
        if (data[(4 + c) * stride + i] > score) { score = data[(4 + c) * stride + i]; idx = c }
      }
      if (score > 0.4) {
        const [cx, cy, w, h] = [data[0 * stride + i], data[1 * stride + i], data[2 * stride + i], data[3 * stride + i]]
        boxes.push({ box: [(cx - w/2 - meta.dw)/meta.r, (cy - h/2 - meta.dh)/meta.r, w/meta.r, h/meta.r], score, labelIndex: idx })
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

      // GỘP KẾT QUẢ
      const finalJ = bJ.filter(b => LABELS[b.labelIndex].name === 'Board' || LABELS[b.labelIndex].name.includes('dark'))
      const finalS = bS.map(b => {
        const name = LABELS_V5[b.labelIndex]
        const sysIdx = Object.keys(LABELS).find(k => LABELS[Number(k)].name === name)
        return { ...b, labelIndex: Number(sysIdx || 0) }
      }).filter(sb => !finalJ.some(jb => {
        const dist = Math.sqrt(Math.pow((sb.box[0]+sb.box[2]/2)-(jb.box[0]+jb.box[2]/2), 2) + Math.pow((sb.box[1]+sb.box[3]/2)-(jb.box[1]+jb.box[3]/2), 2))
        return dist < (sb.box[2] + jb.box[2]) / 4
      }))

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