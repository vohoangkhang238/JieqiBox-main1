<script setup lang="ts">
  import { provide, watch, onMounted, onUnmounted } from 'vue'
  import { useTheme } from 'vuetify'
  import TopToolbar from './components/TopToolbar.vue'
  import Chessboard from './components/Chessboard.vue'
  import AnalysisSidebar from './components/AnalysisSidebar.vue'
  import FenInputDialog from './components/FenInputDialog.vue'
  import GameEndDialog from './components/GameEndDialog.vue'
  import LiveScannerOverlay from './components/LiveScannerOverlay.vue'
  import { useChessGame } from './composables/useChessGame'
  import { useUciEngine } from './composables/useUciEngine'
  import { useInterfaceSettings } from './composables/useInterfaceSettings'
  import { useConfigManager } from './composables/useConfigManager'

  const theme = useTheme()
  const { darkMode, showPositionChart } = useInterfaceSettings()
  const game = useChessGame()
  const engine = useUciEngine(game.generateFen, game)

  watch(darkMode, v => theme.global.name.value = v ? 'dark' : 'light', { immediate: true })
  provide('game-state', game); provide('engine-state', engine)

  onMounted(async () => {
    const config = useConfigManager()
    await config.loadConfig()
  })
</script>

<template>
  <div class="app-container" :lang="htmlLang">
    <TopToolbar />
    <div class="main-layout">
      <div class="side-controls mr-4" style="width: 320px">
        <LiveScannerOverlay /> <AnalysisSidebar />
      </div>

      <div class="chessboard-area" :class="{ 'with-chart': showPositionChart }">
        <Chessboard />
      </div>

      <FenInputDialog v-model="game.isFenInputDialogVisible.value" @confirm="game.confirmFenInput" />
      <GameEndDialog :visible="game.isGameEndDialogVisible.value" />
    </div>
  </div>
</template>

<style scoped>
  .app-container { display: flex; flex-direction: column; min-height: 100vh; }
  .main-layout { display: flex; padding: 20px; justify-content: center; }
  .chessboard-area { display: flex; flex-direction: column; align-items: center; }
</style>