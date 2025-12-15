<template>
  <div class="sidebar pikafish-theme">
    <div class="pikafish-toolbar">
      <div class="engine-toggle">
        <input 
          type="checkbox" 
          id="engine-switch" 
          :checked="isEngineActive" 
          @change="toggleEngineState"
        />
        <label for="engine-switch" :title="isEngineActive ? 'Tắt động cơ' : 'Bật động cơ'"></label>
      </div>

      <div class="engine-info-box engine-name">
        <select v-model="selectedEngineId" @change="handleEngineChange" class="pika-select">
          <option v-for="eng in managedEngines" :key="eng.id" :value="eng.id">
            {{ eng.name }}
          </option>
        </select>
      </div>

      <div class="engine-info-box threads">
        <input type="number" v-model="tempThreads" min="1" max="128" class="pika-input" title="Threads" />
      </div>

      <div class="engine-info-box hash">
        <select v-model="tempHash" class="pika-select-small" title="Hash Size">
          <option value="16">16 MB</option>
          <option value="64">64 MB</option>
          <option value="128">128 MB</option>
          <option value="256">256 MB</option>
          <option value="512">512 MB</option>
          <option value="1024">1024 MB</option>
        </select>
      </div>

      <button class="pika-settings-btn" @click="showEngineManager = true" title="Cài đặt Engine">
        <v-icon icon="mdi-cog" size="18" color="#666"></v-icon>
      </button>
    </div>

    <div class="pikafish-log-container" ref="logContainer">
      <div v-if="!isEngineActive && parsedLogList.length === 0" class="log-placeholder">
        Động cơ chưa được kích hoạt
      </div>
      
      <div v-for="(line, index) in parsedLogList" :key="index" class="log-entry">
        <div class="log-header">
          <span class="p-item">Độ sâu:{{ line.depth }}</span>
          <span class="p-item">Điểm:{{ line.scoreText }}</span>
          <span class="p-item">Thời gian:{{ line.timeText }}</span>
          <span class="p-item">NPS:{{ line.npsText }}</span>
          <span class="p-item" v-if="line.wdlText">{{ line.wdlText }}</span>
        </div>
        <div class="log-pv">
          {{ line.chinesePv }}
        </div>
      </div>
    </div>

    <DraggablePanel panel-id="notation" class="mt-2">
      <template #header><h3>{{ $t('analysis.notation') }}</h3></template>
      <div class="move-list" ref="moveListElement">
        <div
          v-for="(entry, idx) in history"
          :key="idx"
          class="move-item"
          :class="{ 'current-move': currentMoveIndex === idx + 1 }"
          @click="replayToMove(idx + 1)"
        >
          <span class="move-number">{{ Math.floor(idx / 2) + 1 }}.</span>
          <span class="move-uci">{{ entry.data }}</span>
        </div>
      </div>
    </DraggablePanel>

    <EngineManagerDialog v-model="showEngineManager" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfigManager } from '@/composables/useConfigManager'
import { useInterfaceSettings } from '@/composables/useInterfaceSettings'
import EngineManagerDialog from './EngineManagerDialog.vue'
import DraggablePanel from './DraggablePanel.vue'
import { uciToChineseMoves } from '@/utils/chineseNotation'

// --- Imports & Injects (Giữ nguyên từ code gốc của bạn) ---
const { t } = useI18n()
const configManager = useConfigManager()
const gameState = inject('game-state') as any
const engineState = inject('engine-state') as any

const { 
  history, currentMoveIndex, initialFen, generateFen, replayToMove
} = gameState

const { 
  engineOutput, isEngineLoaded, isThinking, loadEngine, unloadEngine, 
  startAnalysis, stopAnalysis, analysisUiFen
} = engineState

// --- State cho Giao diện Pikafish ---
const showEngineManager = ref(false)
const managedEngines = ref<any[]>([])
const selectedEngineId = ref<string | null>(null)
const tempThreads = ref(16) // Default visual value
const tempHash = ref(1024)  // Default visual value

// Computed: Trạng thái engine hoạt động (dùng cho Checkbox)
const isEngineActive = computed(() => isEngineLoaded.value || isThinking.value)

// --- Logic Xử lý Engine (Checkbox) ---
const toggleEngineState = async (e: Event) => {
  const isChecked = (e.target as HTMLInputElement).checked
  
  if (isChecked) {
    // BẬT: Load Engine -> Start Analysis
    if (!selectedEngineId.value) {
      if (managedEngines.value.length > 0) selectedEngineId.value = managedEngines.value[0].id
      else return alert('Vui lòng thêm engine trước')
    }
    
    const engineToLoad = managedEngines.value.find(e => e.id === selectedEngineId.value)
    if (engineToLoad) {
      if (!isEngineLoaded.value) {
        await loadEngine(engineToLoad)
      }
      // Start Infinite Analysis
      startAnalysis(
        { movetime: 0, analysisMode: 'infinite' }, 
        [], // moves
        gameState.generateFen(), 
        []
      )
    }
  } else {
    // TẮT: Stop Analysis -> Unload
    if (isThinking.value) stopAnalysis({ playBestMoveOnStop: false })
    if (isEngineLoaded.value) await unloadEngine()
  }
}

const handleEngineChange = async () => {
  if (isEngineActive.value) {
    // Nếu đang chạy mà đổi engine -> restart
    if (isThinking.value) stopAnalysis({ playBestMoveOnStop: false })
    await unloadEngine()
    // Load engine mới
    const event = { target: { checked: true } } as any
    toggleEngineState(event)
  }
}

// --- Logic Parse Log (Quan trọng nhất để giống ảnh) ---

// Helper parse dòng UCI
function parseInfoLine(line: string) {
  if (!line.startsWith('info') || !line.includes('depth')) return null
  
  const extract = (key: string) => {
    const match = line.match(new RegExp(`${key}\\s+([^\\s]+)`))
    return match ? match[1] : null
  }

  // Parse MultiPV và Depth để sort
  const depth = parseInt(extract('depth') || '0')
  const scoreType = extract('score') // cp or mate
  const scoreVal = parseInt(line.match(/score\s+(cp|mate)\s+([\-\d]+)/)?.[2] || '0')
  const time = parseInt(extract('time') || '0')
  const nodes = extract('nodes') // Dùng làm NPS nếu ko có nps
  const nps = extract('nps')
  const pvMatch = line.match(/\spv\s+(.*)/)
  const pv = pvMatch ? pvMatch[1] : ''

  // Parse WDL (Win/Draw/Loss) nếu có
  // Format UCI thường là: wdl 500 300 200 (trên 1000)
  const wdlMatch = line.match(/wdl\s+(\d+)\s+(\d+)\s+(\d+)/)
  let wdlText = ''
  if (wdlMatch) {
    const w = (parseInt(wdlMatch[1]) / 10).toFixed(1)
    const d = (parseInt(wdlMatch[2]) / 10).toFixed(1)
    const l = (parseInt(wdlMatch[3]) / 10).toFixed(1)
    wdlText = `T(${w}%)H(${d}%)B(${l}%)`
  }

  // Format Text
  let scoreText = scoreVal.toString()
  if (scoreType === 'mate') scoreText = `M${Math.abs(scoreVal)}`
  
  let timeText = (time / 1000).toFixed(1) // giây
  
  let npsText = '0'
  if (nps) npsText = `${(parseInt(nps)/1000).toFixed(0)}K`
  else if (nodes) npsText = `${(parseInt(nodes)/1000).toFixed(0)}K`

  return {
    raw: line,
    depth,
    scoreText,
    timeText,
    npsText,
    wdlText, // Thắng/Hòa/Bại
    pv
  }
}

// Computed: Biến đổi engineOutput thành danh sách hiển thị giống ảnh
const parsedLogList = computed(() => {
  // Lấy các dòng info từ engineOutput (dạng mảng các object {kind, text})
  // Chúng ta muốn hiển thị mới nhất lên trên
  const rawLines = engineState.engineOutput.value
    .filter((l: any) => l.kind === 'recv' && l.text.startsWith('info depth'))
    .map((l: any) => l.text)
    .reverse() // Mới nhất lên đầu

  // Chỉ lấy tối đa 20 dòng để hiển thị cho đỡ lag
  const displayLines = rawLines.slice(0, 20)
  
  return displayLines.map((lineStr: string) => {
    const info = parseInfoLine(lineStr)
    if (!info) return null

    // Convert PV sang Tiếng Trung
    let chinesePv = info.pv
    try {
      // Cần FEN gốc để convert move uci sang tiếng trung
      const currentFen = gameState.generateFen()
      const moves = uciToChineseMoves(currentFen, info.pv)
      chinesePv = moves.join(' ')
    } catch (e) {
      // Fallback nếu lỗi
    }

    return { ...info, chinesePv }
  }).filter((x: any) => x !== null)
})

// --- Lifecycle ---
onMounted(async () => {
  await configManager.loadConfig()
  managedEngines.value = configManager.getEngines()
  selectedEngineId.value = configManager.getLastSelectedEngineId()
})

</script>

<style scoped>
/* Reset & Base */
.sidebar.pikafish-theme {
  font-family: 'Consolas', 'Monaco', monospace; /* Font giống console/ảnh */
  background-color: #f5f5f5;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

/* 1. TOOLBAR STYLES */
.pikafish-toolbar {
  background: #e0e0e0; /* Màu nền xám nhẹ của toolbar */
  display: flex;
  align-items: center;
  padding: 4px 8px;
  gap: 8px;
  border-bottom: 1px solid #ccc;
  height: 40px;
  flex-shrink: 0;
}

/* Custom Checkbox */
.engine-toggle {
  display: flex;
  align-items: center;
}
.engine-toggle input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #6a1b9a; /* Màu tím deep-purple khi active */
  cursor: pointer;
}

/* Input Fields */
.engine-info-box {
  background: white;
  border: 1px solid #aaa;
  padding: 2px 4px;
  font-size: 13px;
  height: 24px;
  display: flex;
  align-items: center;
}

.engine-name { flex-grow: 1; min-width: 100px; }
.threads { width: 50px; }
.hash { width: 70px; }

.pika-select, .pika-select-small, .pika-input {
  border: none;
  width: 100%;
  outline: none;
  font-family: inherit;
  font-size: 12px;
  background: transparent;
}

.pika-settings-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
}
.pika-settings-btn:hover { background: #ddd; border-radius: 4px; }

/* 2. LOG DISPLAY STYLES */
.pikafish-log-container {
  flex-grow: 1;
  background: white;
  overflow-y: auto;
  padding: 5px;
  border-bottom: 1px solid #eee;
}

.log-entry {
  margin-bottom: 6px;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 4px;
}

/* Header line (Xanh lá) */
.log-header {
  color: #008000; /* Màu xanh lá giống ảnh */
  font-size: 13px;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.p-item {
  margin-right: 8px;
}

/* PV Line (Đen, Nước đi) */
.log-pv {
  color: #000;
  font-size: 14px;
  line-height: 1.4;
  word-wrap: break-word; /* Xuống dòng nếu dài */
}

.log-placeholder {
  text-align: center;
  color: #999;
  margin-top: 20px;
  font-style: italic;
}

/* Scrollbar đẹp hơn */
.pikafish-log-container::-webkit-scrollbar { width: 6px; }
.pikafish-log-container::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }

/* Styles cho Notation Panel (Move list) để không bị vỡ layout */
.move-list {
  height: 150px;
  overflow-y: auto;
  font-size: 13px;
}
.move-item { display: flex; padding: 2px 4px; cursor: pointer; }
.move-item:hover { background: #eee; }
.move-item.current-move { background: #d1c4e9; font-weight: bold; }
.move-number { width: 30px; color: #666; }
</style>