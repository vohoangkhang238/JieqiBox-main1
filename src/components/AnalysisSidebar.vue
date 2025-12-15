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
        <label for="engine-switch" :title="isEngineActive ? $t('analysis.unloadEngine') : $t('analysis.loadEngine')"></label>
      </div>

      <div class="engine-info-box engine-name">
        <select v-model="selectedEngineId" @change="handleEngineChange" class="pika-select" :disabled="!isEngineLoaded && isEngineLoading">
          <option 
            v-if="isEngineActive && selectedEngineId" 
            :value="selectedEngineId" 
            class="custom-display-name"
          >
            Pikafish - JieQ
          </option>
          
          <option v-for="eng in managedEngines" :key="eng.id" :value="eng.id">
            {{ eng.name }}
          </option>
        </select>
      </div>

      <div class="engine-info-box threads" title="Số luồng (Threads)">
        <input 
          type="number" 
          v-model.lazy="actualThreads" 
          min="1" 
          max="128" 
          class="pika-input" 
          :disabled="!isEngineLoaded"
        />
      </div>

      <div class="engine-info-box hash" title="Bộ nhớ Hash (MB)">
        <select v-model="actualHash" class="pika-select-small" :disabled="!isEngineLoaded">
          <option value="16">16 MB</option>
          <option value="64">64 MB</option>
          <option value="128">128 MB</option>
          <option value="256">256 MB</option>
          <option value="512">512 MB</option>
          <option value="1024">1024 MB</option>
          <option value="2048">2048 MB</option>
          <option value="4096">4096 MB</option>
          <option value="8192">8192 MB</option>
        </select>
      </div>

      <button class="pika-settings-btn" @click="showEngineManager = true" :title="$t('analysis.manageEngines')">
        <v-icon icon="mdi-cog" size="18" color="#666"></v-icon>
      </button>
    </div>

    <DraggablePanel panel-id="engine-log" class="mt-2">
      <template #header>
        <div class="panel-title-text">
          <h3>{{ $t('analysis.engineAnalysis') }}</h3>
        </div>
      </template>
      <div class="pikafish-log-container resizable-log" ref="logContainer">
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
    </DraggablePanel>

    <DraggablePanel panel-id="notation" class="mt-2 flex-grow-1">
      <template #header>
        <div class="notation-header">
          <h3>{{ $t('analysis.notation') }}</h3>
        </div>
      </template>
      <div
        class="move-list flex-grow-1"
        ref="moveListElement"
        :class="{ 'disabled-clicks': isMatchRunning }"
      >
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
import EngineManagerDialog from './EngineManagerDialog.vue'
import DraggablePanel from './DraggablePanel.vue'
import { uciToChineseMoves } from '@/utils/chineseNotation'

const { t } = useI18n()
const configManager = useConfigManager()

// --- Injects ---
const gameState = inject('game-state') as any
const engineState = inject('engine-state') as any
const jaiEngine = inject('jai-engine-state') as any 

// Lấy các state từ engineState (yêu cầu useUciEngine.ts đã được update)
const { 
  engineOutput, isEngineLoaded, isEngineLoading, isThinking, 
  loadEngine, unloadEngine, startAnalysis, stopAnalysis, 
  uciOptions, setOption 
} = engineState

const { 
  history, currentMoveIndex, initialFen, generateFen, replayToMove,
} = gameState

// --- State UI ---
const showEngineManager = ref(false)
const managedEngines = ref<any[]>([])
const selectedEngineId = ref<string | null>(null)
const moveListElement = ref<HTMLElement | null>(null)

// Computed trạng thái
const isEngineActive = computed(() => isEngineLoaded.value || isThinking.value)
const isMatchRunning = computed(() => jaiEngine?.isMatchRunning?.value || false)

// --- KẾT NỐI DỮ LIỆU ENGINE (THREADS & HASH) ---

// 1. Threads
const actualThreads = computed({
  get: () => {
    if (!uciOptions?.value) return 1
    const opt = uciOptions.value.find((o: any) => o.name?.toLowerCase() === 'threads')
    return opt ? parseInt(opt.value) : 1
  },
  set: (val) => {
    if (isEngineLoaded.value && setOption) {
      setOption('Threads', val)
    }
  }
})

// 2. Hash
const actualHash = computed({
  get: () => {
    if (!uciOptions?.value) return 16
    const opt = uciOptions.value.find((o: any) => o.name?.toLowerCase() === 'hash')
    return opt ? parseInt(opt.value) : 16
  },
  set: (val) => {
    if (isEngineLoaded.value && setOption) {
      setOption('Hash', val)
    }
  }
})

// --- Logic Bật/Tắt Engine (Checkbox) ---
const toggleEngineState = async (e: Event) => {
  const isChecked = (e.target as HTMLInputElement).checked
  
  if (isChecked) {
    // BẬT ENGINE
    if (!selectedEngineId.value) {
      if (managedEngines.value.length > 0) selectedEngineId.value = managedEngines.value[0].id
      else return alert('Vui lòng thêm engine trước')
    }
    
    const engineToLoad = managedEngines.value.find((e: any) => e.id === selectedEngineId.value)
    if (engineToLoad) {
      if (!isEngineLoaded.value) {
        await loadEngine(engineToLoad)
      }
      // Tự động chạy Infinite Analysis
      const currentFen = generateFen()
      startAnalysis(
        { movetime: 0, analysisMode: 'infinite' }, 
        [], currentFen, []
      )
    }
  } else {
    // TẮT ENGINE
    if (isThinking.value) stopAnalysis({ playBestMoveOnStop: false })
    if (isEngineLoaded.value) await unloadEngine()
  }
}

// Xử lý khi thay đổi Engine trong Dropdown
const handleEngineChange = async () => {
  if (selectedEngineId.value) {
      configManager.setLastSelectedEngineId(selectedEngineId.value)
  }

  if (isEngineActive.value) {
    // Restart nếu đang chạy
    if (isThinking.value) stopAnalysis({ playBestMoveOnStop: false })
    await unloadEngine()
    nextTick(() => {
        const event = { target: { checked: true } } as any
        toggleEngineState(event)
    })
  }
}

// --- Logic Phân tích Log ---
function parseInfoLine(line: string) {
  if (!line.startsWith('info') || !line.includes('depth')) return null
  
  const extract = (key: string) => {
    const match = line.match(new RegExp(`${key}\\s+([^\\s]+)`))
    return match ? match[1] : null
  }

  const depth = parseInt(extract('depth') || '0')
  const scoreType = extract('score') 
  const scoreVal = parseInt(line.match(/score\s+(cp|mate)\s+([\-\d]+)/)?.[2] || '0')
  const time = parseInt(extract('time') || '0')
  const nodes = extract('nodes')
  const nps = extract('nps')
  const pvMatch = line.match(/\spv\s+(.*)/)
  const pv = pvMatch ? pvMatch[1] : ''

  // Parse WDL
  const wdlMatch = line.match(/wdl\s+(\d+)\s+(\d+)\s+(\d+)/)
  let wdlText = ''
  if (wdlMatch) {
    const total = parseInt(wdlMatch[1]) + parseInt(wdlMatch[2]) + parseInt(wdlMatch[3])
    if (total > 0) {
      const w = (parseInt(wdlMatch[1]) / total * 100).toFixed(1)
      const d = (parseInt(wdlMatch[2]) / total * 100).toFixed(1)
      const l = (parseInt(wdlMatch[3]) / total * 100).toFixed(1)
      wdlText = `T(${w}%)H(${d}%)B(${l}%)`
    }
  }

  let scoreText = scoreVal.toString()
  if (scoreType === 'mate') scoreText = `M${Math.abs(scoreVal)}`
  
  let timeText = (time / 1000).toFixed(1) 
  
  let npsText = '0'
  if (nps) npsText = `${(parseInt(nps)/1000).toFixed(0)}K`
  else if (nodes) npsText = `${(parseInt(nodes)/1000).toFixed(0)}K`

  return { raw: line, depth, scoreText, timeText, npsText, wdlText, pv }
}

const parsedLogList = computed(() => {
  const rawLines = engineState.engineOutput.value
    .filter((l: any) => l.kind === 'recv' && l.text.startsWith('info depth'))
    .map((l: any) => l.text)
    .reverse() // Mới nhất lên đầu
  
  const displayLines = rawLines.slice(0, 20)
  const currentFen = generateFen()
  
  return displayLines.map((lineStr: string) => {
    const info = parseInfoLine(lineStr)
    if (!info) return null

    let chinesePv = info.pv
    try {
      const moves = uciToChineseMoves(currentFen, info.pv)
      chinesePv = moves.join(' ')
    } catch (e) {}

    return { ...info, chinesePv }
  }).filter((x: any) => x !== null)
})

// --- Lifecycle ---
onMounted(async () => {
  await configManager.loadConfig()
  managedEngines.value = configManager.getEngines()
  const lastSelectedId = configManager.getLastSelectedEngineId()
  
  if (lastSelectedId) {
      selectedEngineId.value = lastSelectedId
  } else if (managedEngines.value.length > 0) {
      selectedEngineId.value = managedEngines.value[0].id
  }
})

// Auto scroll log (chỉ khi user đang ở gần đáy hoặc chưa cuộn)
watch(parsedLogList, () => {
  nextTick(() => {
    const container = document.querySelector('.pikafish-log-container');
    if (container && container.scrollTop === 0) { // Log mới nằm trên cùng nên có thể muốn scroll lên top
       container.scrollTop = 0; 
    }
  })
}, { deep: true })
</script>

<style lang="scss">
/* Reset & Base */
.sidebar {
    width: 420px;
    height: calc(100vh - 120px); 
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-sizing: border-box;
    border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    overflow-y: auto;
    background-color: rgb(var(--v-theme-surface));
    font-family: 'Noto Sans SC', sans-serif;
}

/* Pikafish Theme */
.sidebar.pikafish-theme {
  font-family: 'Consolas', 'Monaco', monospace;
  background-color: #f5f5f5;
  padding: 8px;
  overflow-y: hidden; /* Ẩn scroll chính để dùng scroll của từng panel */
}

/* 1. TOOLBAR */
.pikafish-toolbar {
  background: #e0e0e0;
  display: flex;
  align-items: center;
  padding: 4px 6px;
  gap: 6px;
  border: 1px solid #ccc;
  height: 38px;
  flex-shrink: 0;
}

/* Checkbox */
.engine-toggle {
  display: flex;
  align-items: center;
}
.engine-toggle input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: #6a1b9a; 
  cursor: pointer;
}

/* Input/Select Box */
.engine-info-box {
  background: white;
  border: 1px solid #aaa;
  padding: 2px 4px;
  font-size: 13px;
  height: 24px;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.engine-name { flex-grow: 1; min-width: 100px; }
.threads { width: 50px; }
.hash { width: 70px; }

/* Custom Select Style */
.pika-select, .pika-select-small, .pika-input {
  border: none;
  width: 100%;
  outline: none;
  font-family: inherit;
  font-size: 12px;
  background: transparent;
  padding: 0;
  margin: 0;
}

/* Styling for the custom display name option */
.custom-display-name {
  font-weight: bold;
  color: #000;
  background-color: #e0e0e0;
}

.pika-settings-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  min-width: 24px;
}
.pika-settings-btn:hover { background: #ddd; border-radius: 4px; }

/* 2. LOG DISPLAY (Cho phép resize dọc) */
.pikafish-log-container {
  /* Chiều cao mặc định */
  height: 250px; 
  /* Quan trọng để resize hoạt động */
  resize: vertical; 
  overflow: auto;
  
  flex-shrink: 0;
  background: white;
  padding: 5px;
  border: 1px solid #ccc;
  min-height: 100px; /* Chiều cao tối thiểu */
  max-height: 80vh;
}

.log-entry {
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px dotted #f0f0f0;
}

.log-header {
  color: #008000; 
  font-size: 12px;
  font-weight: bold;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.p-item { margin-right: 8px; }

.log-pv {
  color: #000;
  font-size: 14px;
  line-height: 1.4;
  word-wrap: break-word; 
  font-family: 'Noto Sans SC', sans-serif;
}

.log-placeholder {
  text-align: center;
  color: #999;
  margin-top: 20px;
  font-style: italic;
}

/* 3. NOTATION */
.mt-2 { margin-top: 8px !important; }

.move-list {
  padding: 10px;
  border-radius: 5px;
  height: 100%; 
  min-height: 100px;
  overflow-y: auto;
  font-family: 'Courier New', Courier, monospace;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  font-size: 13px;
  background-color: white;
}
.move-item { display: flex; padding: 2px 4px; cursor: pointer; }
.move-item:hover { background: #eee; }
.move-item.current-move { background: #d1c4e9; font-weight: bold; }
.move-number { width: 30px; color: #666; }

/* Tùy chỉnh tiêu đề panel */
.panel-title-text h3, .notation-header h3 {
  font-size: 13px;
  margin: 0;
  color: #333;
  font-weight: bold;
}
</style>