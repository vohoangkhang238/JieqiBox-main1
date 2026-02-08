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

  // Khởi tạo model ONNX
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

  // CẬP NHẬT: Letterbox chấp nhận CanvasImageSource (Video, Canvas, Image)
  const letterbox = (
    image: CanvasImageSource,
    newShape = [640, 640],
    color = 114
  ): ProcessedImage => {
    const [newH, newW] = newShape
    
    // Lấy kích thước thực tế từ nguồn đầu vào
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

    context.drawImage(
      image,
      0, 0, imgW, imgH,
      Math.round(dw), Math.round(dh), newUnpadW, newUnpadH
    )

    return {
      canvas,
      context,
      meta: { r, dw, dh, newW, newH, imgW, imgH },
    }
  }

  // CẬP NHẬT: Preprocess chấp nhận CanvasImageSource
  const preprocess = async (
    image: CanvasImageSource
  ): Promise<{ tensor: ort.Tensor; meta: ProcessedImage['meta'] }> => {
    const modelW = 640
    const modelH = 640

    const { canvas, meta } = letterbox(image, [modelH, modelW], 114)
    const context = canvas.getContext('2d')!
    const imageData = context.getImageData(0, 0, modelW, modelH)
    const { data } = imageData

    const red = new Float32Array(modelW * modelH)
    const green = new Float32Array(modelW * modelH)
    const blue = new Float32Array(modelW * modelH)

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      red[p] = data[i] / 255
      green[p] = data[i + 1] / 255
      blue[p] = data[i + 2] / 255
    }

    const input = new Float32Array(modelW * modelH * 3)
    input.set(red, 0)
    input.set(green, modelW * modelH)
    input.set(blue, modelW * modelH * 2)

    const tensor = new ort.Tensor('float32', input, [1, 3, modelH, modelW])
    return { tensor, meta }
  }

  // BỔ SUNG: Hàm xử lý nhận diện cho một khung hình duy nhất
  const processLiveFrame = async (source: CanvasImageSource): Promise<DetectionBox[]> => {
    if (!session.value) await initializeModel()

    try {
      // 1. Tiền xử lý khung hình hiện tại
      const prep = await preprocess(source)

      // 2. Chạy model inference
      const inputName = session.value!.inputNames.includes('images')
        ? 'images'
        : session.value!.inputNames[0]
      const feeds = { [inputName]: prep.tensor }
      const results = await session.value!.run(feeds)

      const firstOut = results.output0 || results[Object.keys(results)[0]]
      const outputData = firstOut.data as unknown as number[]
      const outShape = firstOut.dims as number[]

      // 3. Hậu xử lý (postprocess có sẵn trong project)
      return postprocess(outputData, outShape, prep.meta)
    } catch (error) {
      console.error('Lỗi khi nhận diện khung hình:', error)
      return []
    }
  }

  // --- Các hàm tiện ích NMS, IOU, Postprocess giữ nguyên như code cũ của bạn ---
  const sigmoid = (x: number): number => 1 / (1 + Math.exp(-x))
  const iou = (boxA: DetectionBox, boxB: DetectionBox): number => { /* ... giữ nguyên ... */ }
  const nms = (boxes: DetectionBox[], iouThresh = 0.7, classAgnostic = false): DetectionBox[] => { /* ... giữ nguyên ... */ }
  const doBoxesOverlap = (boxA: [number, number, number, number], boxB: [number, number, number, number]): boolean => { /* ... giữ nguyên ... */ }
  const postprocess = (outputDataRaw: any, outShape: number[], meta: ProcessedImage['meta']): DetectionBox[] => { /* ... giữ nguyên ... */ }
  const updateBoardGrid = (boxes: DetectionBox[]): (DetectionBox | null)[][] => { /* ... giữ nguyên ... */ }

  return {
    session,
    isModelLoading,
    isProcessing,
    status,
    detectedBoxes,
    inputImage,
    outputCanvas,
    showBoundingBoxes,
    processImage: async (file: File) => { /* ... hàm cũ dùng cho ảnh tĩnh ... */ },
    processLiveFrame, // Xuất hàm mới để dùng cho quét liên tục
    updateBoardGrid,
    initializeModel,
  }
}