<script setup lang="ts">
  import { provide, computed, watch, onMounted, onUnmounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useTheme } from 'vuetify'
  import TopToolbar from './components/TopToolbar.vue'
  import Chessboard from './components/Chessboard.vue'
  import AnalysisSidebar from './components/AnalysisSidebar.vue'
  import FenInputDialog from './components/FenInputDialog.vue'
  import GameEndDialog from './components/GameEndDialog.vue'
  import FlipPromptDialog from './components/FlipPromptDialog.vue'

  import { useChessGame } from './composables/useChessGame'
  import { useUciEngine } from './composables/useUciEngine'
  import { useJaiEngine } from './composables/useJaiEngine'
  import { useInterfaceSettings } from './composables/useInterfaceSettings'
  import { useConfigManager } from './composables/useConfigManager'
  import { useAutosave } from './composables/useAutosave'
  import { useWindowManager } from './composables/useWindowManager'
  import { LANGUAGE_TO_HTML_LANG } from './utils/constants'

  const { locale } = useI18n()
  const configManager = useConfigManager()
  const theme = useTheme()

  // Get interface settings including dark mode
  const { showPositionChart, darkMode } = useInterfaceSettings()

  // Watch for dark mode changes and update theme
  watch(
    darkMode,
    newDarkMode => {
      theme.global.name.value = newDarkMode ? 'dark' : 'light'
    },
    { immediate: true }
  )

  // Set HTML lang attribute based on current language
  const htmlLang = computed(() => {
    return LANGUAGE_TO_HTML_LANG[locale.value] || 'en-US'
  })

  // Watch for language changes and update HTML lang attribute
  watch(
    locale,
    newLocale => {
      const htmlLang = LANGUAGE_TO_HTML_LANG[newLocale] || 'en-US'
      document.documentElement.lang = htmlLang
      document.documentElement.setAttribute('lang', htmlLang)
    },
    { immediate: true }
  )

  const game = useChessGame()

  // Pass generateFen and gameState to ensure engine receives correct FEN format and can access game state
  const engine = useUciEngine(game.generateFen, game)
  const jaiEngine = useJaiEngine(game.generateFen, game)

  // Provide global state
  provide('game-state', game)
  provide('engine-state', engine)
  provide('jai-engine-state', jaiEngine)

  // Provide the FEN input dialog state from game state
  provide('fen-input-dialog-visible', game.isFenInputDialogVisible)

  // Set global engine state for useChessGame to access
  ;(window as any).__ENGINE_STATE__ = engine
  ;(window as any).__JAI_ENGINE__ = jaiEngine

  // Initialize autosave functionality after providing game state
  const autosave = useAutosave()

  // Initialize window manager for window size persistence
  const windowManager = useWindowManager()

  // Load configuration when app mounts
  onMounted(async () => {
    try {
      await configManager.loadConfig()

      // Restore window state immediately after config is loaded for faster startup
      windowManager.restoreWindowState()

      // Set locale from config
      const savedLocale = configManager.getLocale()
      if (
        savedLocale &&
        ['zh_cn', 'zh_tw', 'en', 'vi', 'ja'].includes(savedLocale)
      ) {
        locale.value = savedLocale
      }

      // Check if engine list is empty and clear last selected engine ID if needed
      const engines = configManager.getEngines()
      if (engines.length === 0) {
        console.log(
          `[DEBUG] App: Engine list is empty on startup, clearing last selected engine ID`
        )
        await configManager.clearLastSelectedEngineId()
      }

      // Initialize autosave after configuration is loaded
      await autosave.initializeAutosave(game)
    } catch (error) {
      console.error('Failed to load configuration on app startup:', error)
    }
  })

  // Clean up autosave timer when app unmounts
  onUnmounted(() => {
    autosave.stopAutosaveTimer()
    // Window manager cleanup is handled automatically by its own onUnmounted hook
  })
</script>

<template>
  <div class="app-container" :lang="htmlLang">
    <TopToolbar />
    <div class="main-layout">
      <div class="chessboard-area" :class="{ 'with-chart': showPositionChart }">
        <Chessboard />
      </div>
      <AnalysisSidebar />
      <FenInputDialog
        v-model="game.isFenInputDialogVisible.value"
        @confirm="game.confirmFenInput"
      />
      <GameEndDialog
        :visible="game.isGameEndDialogVisible.value"
        :game-result="game.gameEndResult.value"
        :on-close="() => (game.isGameEndDialogVisible.value = false)"
      />
      <FlipPromptDialog />
    </div>
  </div>
</template>

<style lang="scss" scoped>
  .app-container {
    display: flex;
    flex-direction: column;
    height: 100vh; /* Cố định chiều cao bằng màn hình */
    overflow: hidden; /* Ngăn cuộn trang chính */
    background-color: rgb(var(--v-theme-background));
  }

  .main-layout {
    display: flex;
    flex-direction: row;
    flex: 1; /* Chiếm toàn bộ không gian còn lại dưới Toolbar */
    width: 100%;
    padding: 10px;
    gap: 10px;
    box-sizing: border-box;
    overflow: hidden; /* Quan trọng để nội dung con không phá vỡ bố cục */

    // Mobile responsive layout
    @media (max-width: 768px) {
      flex-direction: column;
      overflow-y: auto; /* Trên mobile cho phép cuộn dọc */
      padding: 5px;
    }
  }

  .chessboard-area {
    flex: 1; /* Tự động chiếm không gian còn thừa */
    display: flex;
    justify-content: center;
    align-items: flex-start; /* Căn lên trên để bàn cờ không bị lơ lửng giữa màn hình */
    overflow: auto; /* Cho phép cuộn nếu bàn cờ quá lớn so với màn hình nhỏ */
    min-width: 0; /* Fix lỗi flexbox không co lại được */
    
    /* XÓA BỎ class .with-chart cũ dùng transform: scale */
    &.with-chart {
      /* Không cần style gì đặc biệt, flexbox sẽ tự chia lại không gian */
    }
  }
</style>