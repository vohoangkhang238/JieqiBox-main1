import { ref } from 'vue'
import * as ort from 'onnxruntime-web'
import { LABELS, type DetectionBox, type ProcessedImage } from './types'

// Mapping nhãn cờ ngửa theo mảng: {'n','b','a','k','r','c','p','R','N','A','K','B','C','P','0'}
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
  const isInferenceBusy = ref(false)

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
      console.log("AI: Hệ thống Hybrid 2 Model đã sẵn sàng.");
    } catch (e) { console.error('AI Error:', e) } finally { isModelLoading.value = false }
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

  const parseOutput = (output: any, meta: any, numClasses: number): DetectionBox[] => {
    const boxes: DetectionBox[] = [], data = output.data as Float32Array, shape = output.dims
    const { r, dw, dh } = meta
    const isV8 = shape[1] < shape[2], stride = isV8 ? shape[2] : 1
    for (let i = 0; i < (isV8 ? shape[2] : shape[1]); i++) {
      let maxS = 0, idx = -1
      for (let c = 0; c < numClasses; c++) {
        const s = data[isV8 ? (4 + c) * stride + i : i * (numClasses + 5) + (5 + c)]
        if (s > maxS) { maxS = s; idx = c }
      }
      if (maxS > 0.3) {
        const cx = isV8 ? data[0 * stride + i] : data[i * (numClasses + 5) + 0]
        const cy = isV8 ? data[1 * stride + i] : data[i * (numClasses + 5) + 1]
        const w = isV8 ? data[2 * stride + i] : data[i * (numClasses + 5) + 2]
        const h = isV8 ? data[3 * stride + i] : data[i * (numClasses + 5) + 3]
        boxes.push({ box: [(cx - w / 2 - dw) / r, (cy - h / 2 - dh) / r, w / r, h / r], score: maxS, labelIndex: idx })
      }
    }
    return boxes
  }

  const processLiveFrame = async (source: CanvasImageSource): Promise<DetectionBox[]> => {
    if (!sessionJieqi.value || !sessionStandard.value) await initializeModel()
    if (isInferenceBusy.value) return []
    try {
      isInferenceBusy.value = true
      const prep = await preprocess(source)
      const inputName = sessionJieqi.value!.inputNames[0]
      const [resJ, resS] = await Promise.all([
        sessionJieqi.value!.run({ [inputName]: prep.tensor }),
        sessionStandard.value!.run({ [sessionStandard.value!.inputNames[0]]: prep.tensor })
      ])
      const bJ = parseOutput(resJ.output0 || Object.values(resJ)[0], prep.meta, 34)
      const bS = parseOutput(resS.output0 || Object.values(resS)[0], prep.meta, 15)

      const finalJieqi = bJ.filter(b => LABELS[b.labelIndex].name === 'Board' || LABELS[b.labelIndex].name.includes('dark'))
      const finalStandard = bS.filter(b => LABELS_STANDARD[b.labelIndex] !== 'empty').map(b => {
        const name = LABELS_STANDARD[b.labelIndex]
        const sysIdx = Object.keys(LABELS).find(k => LABELS[Number(k)].name === name)
        return { ...b, labelIndex: Number(sysIdx || 0) }
      })

      // Loại bỏ quân ngửa nếu vị trí đó Jieqi đã báo là quân Úp
      const filteredStandard = finalStandard.filter(sb => !finalJieqi.some(jb => {
        const dist = Math.sqrt(Math.pow((sb.box[0]+sb.box[2]/2)-(jb.box[0]+jb.box[2]/2), 2) + Math.pow((sb.box[1]+sb.box[3]/2)-(jb.box[1]+jb.box[3]/2), 2))
        return dist < (sb.box[2] + jb.box[2]) / 3 // Tăng độ bao phủ để lọc tốt hơn
      }))

      return [...finalJieqi, ...filteredStandard]
    } catch (e) { return [] } finally { isInferenceBusy.value = false }
  }

  const updateBoardGrid = (boxes: DetectionBox[]) => {
    const board = boxes.find(b => LABELS[b.labelIndex].name === 'Board')
    const grid = Array(10).fill(null).map(() => Array(9).fill(null))
    if (!board) return grid
    const [bx, by, bw, bh] = board.box
    boxes.filter(b => LABELS[b.labelIndex].name !== 'Board').forEach(p => {
      const i = Math.round(((p.box[0] + p.box[2]/2 - bx) / bw) * 8), j = Math.round(((p.box[1] + p.box[3]/2 - by) / bh) * 9)
      if (i >= 0 && i < 9 && j >= 0 && j < 10) grid[j][i] = p
    })
    return grid
  }

  return { processLiveFrame, updateBoardGrid, initializeModel, isModelLoading }
}