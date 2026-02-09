<script setup lang="ts">
import { ref, inject } from 'vue'
import { useLiveScanner } from '@/composables/image-recognition/useLiveScanner'

const gameState = inject<any>('game-state')
const { startScanning, stopScanning, isScanning } = useLiveScanner()

const videoRef = ref<HTMLVideoElement | null>(null)
const mediaStream = ref<MediaStream | null>(null)

const toggle = async () => {
  if (isScanning.value) {
    stopScanning()
    mediaStream.value?.getTracks().forEach(t => t.stop())
  } else {
    try {
      mediaStream.value = await navigator.mediaDevices.getDisplayMedia({ video: true })
      if (videoRef.value) {
        videoRef.value.srcObject = mediaStream.value
        videoRef.value.onloadedmetadata = () => {
          videoRef.value?.play()
          startScanning(videoRef.value!, (fen) => {
            if (gameState?.loadFen) gameState.loadFen(fen)
          })
        }
      }
    } catch (err) {
      console.error("Không thể mở cửa sổ chọn:", err)
    }
  }
}
</script>

<template>
  <v-card class="pa-3" border>
    <video ref="videoRef" v-show="isScanning" style="width: 100%; height: 180px; object-fit: contain;"></video>
    <v-btn @click="toggle" :color="isScanning ? 'error' : 'primary'" block class="mt-2">
      {{ isScanning ? 'Dừng quét' : 'Chọn cửa sổ game' }}
    </v-btn>
  </v-card>
</template>