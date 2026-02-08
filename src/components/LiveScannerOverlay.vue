<script setup lang="ts">
import { ref, onUnmounted, inject } from 'vue'
import { useLiveScanner } from '@/composables/image-recognition/useLiveScanner'

// Lấy trạng thái game và engine từ hệ thống provide của App.vue
const gameState = inject<any>('game-state')
const engineState = inject<any>('engine-state')

const { startScanning, stopScanning, isScanning } = useLiveScanner()

const videoRef = ref<HTMLVideoElement | null>(null)
const mediaStream = ref<MediaStream | null>(null)

const toggleScanner = async () => {
  if (isScanning.value) {
    stopScanning()
    mediaStream.value?.getTracks().forEach(track => track.stop())
  } else {
    try {
      // 1. Mở cửa sổ chọn màn hình
      mediaStream.value = await navigator.mediaDevices.getDisplayMedia({ 
        video: { cursor: 'never' }, 
        audio: false 
      })
      
      if (videoRef.value) {
        videoRef.value.srcObject = mediaStream.value
        videoRef.value.play()

        // 2. Bắt đầu quét
        startScanning(videoRef.value, (newFen) => {
          // CẬP NHẬT TRỰC TIẾP VÀO BÀN CỜ CỦA APP
          if (gameState && gameState.loadFen) {
            gameState.loadFen(newFen) 
          } else if (gameState && gameState.confirmFenInput) {
            gameState.confirmFenInput(newFen)
          }

          // Gửi vào Engine để AI phân tích nước đi tiếp theo
          if (engineState && engineState.startAnalysis) {
            engineState.startAnalysis({}, [], newFen)
          }
        })
      }
    } catch (err) {
      console.error("Lỗi khi mở quay màn hình:", err)
    }
  }
}

onUnmounted(() => {
  stopScanning()
  mediaStream.value?.getTracks().forEach(t => t.stop())
})
</script>

<template>
  <v-card class="scanner-card pa-3 mb-4" elevation="3">
    <div class="d-flex align-center mb-2">
      <v-icon color="primary" class="mr-2">mdi-camera-iris</v-icon>
      <span class="text-subtitle-2">Máy quét bàn cờ AI</span>
    </div>

    <div class="video-preview-wrapper mb-3">
      <video ref="videoRef" v-show="isScanning" class="video-element"></video>
      <div v-if="!isScanning" class="placeholder-box d-flex flex-column align-center justify-center">
        <v-icon size="48" color="grey-lighten-1">mdi-monitor-screenshot</v-icon>
        <div class="text-caption mt-2">Chưa chọn nguồn phát</div>
      </div>
      <div v-else class="scanning-indicator">
        <span class="dot"></span> ĐANG QUÉT TRỰC TIẾP
      </div>
    </div>

    <v-btn 
      @click="toggleScanner" 
      :color="isScanning ? 'error' : 'primary'" 
      block 
      rounded="lg"
    >
      <v-icon left class="mr-1">{{ isScanning ? 'mdi-stop' : 'mdi-target' }}</v-icon>
      {{ isScanning ? 'Dừng quét' : 'Chọn cửa sổ cờ' }}
    </v-btn>
  </v-card>
</template>

<style scoped>
.video-preview-wrapper {
  width: 100%;
  height: 180px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(255,255,255,0.1);
}
.video-element {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.placeholder-box {
  height: 100%;
  background: #1e1e1e;
}
.scanning-indicator {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0,0,0,0.6);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  color: #fff;
  display: flex;
  align-center;
}
.dot {
  width: 8px;
  height: 8px;
  background: red;
  border-radius: 50%;
  display: inline-block;
  margin-right: 5px;
  animation: pulse 1s infinite;
}
@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
</style>