<script setup lang="ts">
import { ref, onUnmounted } from 'vue'
import { useLiveScanner } from '@/composables/image-recognition/useLiveScanner'
import { useUciEngine } from '@/composables/useUciEngine'

const props = defineProps(['gameState'])
const { startScanning, stopScanning, isScanning } = useLiveScanner()
const uciEngine = useUciEngine(() => "", props.gameState)

const videoRef = ref<HTMLVideoElement | null>(null)
const mediaStream = ref<MediaStream | null>(null)

const toggle = async () => {
  if (isScanning.value) {
    stopScanning()
    mediaStream.value?.getTracks().forEach(t => t.stop())
  } else {
    mediaStream.value = await navigator.mediaDevices.getDisplayMedia({ video: true })
    if (videoRef.value) {
      videoRef.value.srcObject = mediaStream.value
      videoRef.value.play()
      startScanning(videoRef.value, (fen) => uciEngine.startAnalysis({}, [], fen))
    }
  }
}
onUnmounted(() => stopScanning())
</script>

<template>
  <v-card class="pa-3 mb-4" elevation="2" border>
    <div class="text-subtitle-2 mb-2">Live Screen Scanner</div>
    <video ref="videoRef" v-show="isScanning" class="w-100 mb-2 border-sm"></video>
    <v-btn @click="toggle" :color="isScanning ? 'error' : 'primary'" block size="small">
      {{ isScanning ? 'Stop Scanning' : 'Select Game Window' }}
    </v-btn>
    <v-alert v-if="uciEngine.bestMove.value" density="compact" type="success" class="mt-2 py-1 text-caption">
      AI: {{ uciEngine.bestMove.value }}
    </v-alert>
  </v-card>
</template>

<style scoped> .w-100 { width: 100%; max-height: 200px; object-fit: contain; } </style>