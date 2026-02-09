<script setup lang="ts">
import { ref, onUnmounted, inject, nextTick } from 'vue'
import { useLiveScanner } from '@/composables/image-recognition/useLiveScanner'
import { LABELS } from '@/composables/image-recognition/types'

const gameState = inject<any>('game-state')
const engineState = inject<any>('engine-state')
const { startScanning, stopScanning, isScanning } = useLiveScanner()

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const mediaStream = ref<MediaStream | null>(null)

// Hàm vẽ khung nhận diện để debug độ chính xác
const drawDetections = (boxes: any[]) => {
  if (!canvasRef.value || !videoRef.value) return
  const ctx = canvasRef.value.getContext('2d')!
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  
  boxes.forEach(b => {
    const [x, y, w, h] = b.box
    const label = LABELS[b.labelIndex].name
    
    ctx.strokeStyle = label === 'Board' ? '#00FF00' : '#FF0000'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, h)
    
    ctx.fillStyle = ctx.strokeStyle
    ctx.font = '10px Arial'
    ctx.fillText(`${label} (${Math.round(b.score * 100)}%)`, x, y > 10 ? y - 5 : y + 15)
  })
}

const toggle = async () => {
  if (isScanning.value) {
    stopScanning(); mediaStream.value?.getTracks().forEach(t => t.stop())
  } else {
    mediaStream.value = await navigator.mediaDevices.getDisplayMedia({ video: true })
    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream.value
      await videoRef.value.play()
      
      // Đồng bộ kích thước canvas với video
      canvasRef.value!.width = videoRef.value.clientWidth
      canvasRef.value!.height = videoRef.value.clientHeight

      startScanning(videoRef.value, (fen, boxes) => {
        drawDetections(boxes) // Vẽ khung mỗi khi quét xong
        if (gameState?.loadFen) gameState.loadFen(fen)
        if (engineState?.startAnalysis) engineState.startAnalysis({}, [], fen)
      })
    }
  }
}
</script>

<template>
  <v-card class="pa-3" border elevation="4">
    <div class="video-container">
      <video ref="videoRef" v-show="isScanning" class="main-video"></video>
      <canvas ref="canvasRef" v-show="isScanning" class="overlay-canvas"></canvas>
      <div v-if="!isScanning" class="d-flex align-center justify-center bg-grey-darken-4 rounded" style="height: 180px">
        <v-icon size="48">mdi-monitor-screenshot</v-icon>
      </div>
    </div>
    <v-btn @click="toggle" :color="isScanning ? 'error' : 'primary'" block class="mt-3">
      {{ isScanning ? 'Dừng quét' : 'Chọn cửa sổ game' }}
    </v-btn>
  </v-card>
</template>

<style scoped>
.video-container { position: relative; width: 100%; height: 180px; overflow: hidden; }
.main-video { width: 100%; height: 100%; object-fit: contain; }
.overlay-canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
</style>