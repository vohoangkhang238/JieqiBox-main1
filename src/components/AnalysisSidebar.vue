<template>
  <div 
    class="sidebar pikafish-theme" 
    :style="{ width: sidebarWidth + 'px' }"
  >
    <div class="resize-handle-left" @mousedown.prevent="startResizeWidth"></div>

    <div class="pikafish-toolbar">
      <div class="engine-toggle-wrapper">
        <input 
          type="checkbox" 
          id="engine-switch" 
          :checked="isEngineActive" 
          @change="toggleEngineState"
          class="custom-switch"
        />
        <label for="engine-switch" class="switch-label" :title="isEngineActive ? $t('analysis.unloadEngine') : $t('analysis.loadEngine')"></label>
      </div>

      <div class="control-group expanded">
        <select v-model="selectedEngineId" @change="handleEngineChange" class="styled-input engine-select" :disabled="!isEngineLoaded && isEngineLoading">
          <option 
            v-if="isEngineActive && selectedEngineId" 
            :value="selectedEngineId" 
            class="active-engine-option"
          >
            ⚡ Pikafish
          </option>
          <option v-for="eng in managedEngines" :key="eng.id" :value="eng.id">
            {{ eng.name }}
          </option>
        </select>
        <v-icon icon="mdi-chevron-down" size="12" class="select-arrow"></v-icon>
      </div>

      <div class="control-group small" title="Số luồng (Threads)">
        <span class="input-label">Th</span>
        <input 
          type="number" 
          v-model.lazy="actualThreads" 
          min="1" 
          max="128" 
          class="styled-input" 
          :disabled="!isEngineLoaded"
        />
      </div>

      <div class="control-group medium" title="Bộ nhớ Hash (MB)">
         <span class="input-label">Ha</span>
        <select v-model="actualHash" class="styled-input" :disabled="!isEngineLoaded">
          <option value="16">16M</option>
          <option value="64">64M</option>
          <option value="128">128M</option>
          <option value="256">256M</option>
          <option value="512">512M</option>
          <option value="1024">1G</option>
          <option value="2048">2G</option>
          <option value="4096">4G</option>
          <option value="8192">8G</option>
        </select>
        <v-icon icon="mdi-chevron-down" size="12" class="select-arrow"></v-icon>
      </div>

      <button class="settings-btn" @click="showEngineManager = true" :title="$t('analysis.manageEngines')">
        <v-icon icon="mdi-cog" size="18"></v-icon>
      </button>
    </div>

    <DraggablePanel panel-id="engine-log" class="panel-container mt-2" :no-resize="true">
      <template #header>
        <div class="panel-header">
          <v-icon icon="mdi-text-box-search-outline" size="16" class="mr-1"></v-icon>
          <h3>{{ $t('analysis.engineAnalysis') }}</h3>
        </div>
      </template>
      
      <div 
        class="log-content custom-scrollbar" 
        ref="logContainer"
        :style="{ height: logHeight + 'px' }"
      >
        <div v-if="!isEngineActive && parsedLogList.length === 0" class="log-placeholder">
          <span>Engine đang tắt</span>
        </div>
        
        <div v-for="(line, index) in parsedLogList" :key="index" class="log-line">
          <div class="line-meta">
            <span class="meta-tag depth">D:{{ line.depth }}</span>
            <span class="meta-tag score" :class="getScoreClass(line.scoreText)">{{ line.scoreText }}</span>
            <span class="meta-info">{{ line.timeText }}s</span>
            <span class="meta-info">{{ line.npsText }}</span>
            <span class="meta-info wdl" v-if="line.wdlText">{{ line.wdlText }}</span>
          </div>
          <div class="line-pv">
            {{ line.chinesePv }}
          </div>
        </div>
      </div>
      
      <div class="resize-handle-bottom" @mousedown.prevent="startResizeHeight">
        <div class="handle-bar"></div>
      </div>
    </DraggablePanel>

    <DraggablePanel panel-id="notation" class="panel-container mt-2 flex-grow-1" :no-resize="true">
      <template #header>
        <div class="panel-header">
          <v-icon icon="mdi-file-document-edit-outline" size="16" class="mr-1"></v-icon>
          <h3>{{ $t('analysis.notation') }}</h3>
        </div>
      </template>
      
      <div
        class="notation-box flex-grow-1 custom-scrollbar"
        :class="{ 'disabled-clicks': isMatchRunning }"
        ref="moveListElement"
      >
        <div class="notation-table-header">
          <div class="col-num">#</div>
          <div class="col-move">Đỏ</div>
          <div class="col-move">Đen</div>
        </div>

        <div class="notation-list">
          <div 
            v-for="pair in formattedHistory" 
            :key="pair.moveNumber" 
            class="notation-row"
            :class="{ 'highlight-row': currentMoveIndex === pair.redIndex || currentMoveIndex === pair.blackIndex }"
          >
            <div class="col-num">{{ pair.moveNumber }}.</div>
            
            <div 
              class="col-move clickable" 
              :class="{ 'current-move': currentMoveIndex === pair.redIndex }"
              @click="replayToMove(pair.redIndex)"
            >
              {{ pair.redMove }}
            </div>
            
            <div 
              class="col-move clickable" 
              :class="{ 'current-move': currentMoveIndex === pair.blackIndex }"
              @click="pair.blackIndex ? replayToMove(pair.blackIndex) : null"
            >
              {{ pair.blackMove }}
            </div>
          </div>
          
          <div v-if="formattedHistory.length === 0" class="empty-notation">
            ---
          </div>
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

// --- KÍCH THƯỚC ĐỘNG ---
const sidebarWidth = ref(400)
const logHeight = ref(220)

// --- LOGIC KÉO DÃN ---
const startResizeWidth = (e: MouseEvent) => {
  const startX = e.clientX
  const startWidth = sidebarWidth.value
  const onMouseMove = (e: MouseEvent) => {
    const delta = startX - e.clientX
    const newWidth = startWidth + delta
    if (newWidth >= 300 && newWidth <= 800) sidebarWidth.value = newWidth
  }
  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

const startResizeHeight = (e: MouseEvent) => {
  const startY = e.clientY
  const startHeight = logHeight.value
  const onMouseMove = (e: MouseEvent) => {
    const delta = e.clientY - startY
    const newHeight = startHeight + delta
    if (newHeight >= 100 && newHeight <= 600) logHeight.value = newHeight
  }
  const onMouseUp = () => {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

// Computed trạng thái
const isEngineActive = computed(() => isEngineLoaded.value || isThinking.value)
const isMatchRunning = computed(() => jaiEngine?.isMatchRunning?.value || false)

// --- FORMAT BIÊN BẢN ---
const formattedHistory = computed(() => {
  const moves: any[] = []
  const hist = history.value || []
  
  for (let i = 0; i < hist.length; i += 2) {
    const moveNumber = Math.floor(i / 2) + 1
    const redEntry = hist[i]
    const blackEntry = hist[i + 1]
    
    moves.push({
      moveNumber,
      redMove: redEntry ? redEntry.data : '',
      redIndex: i + 1, 
      blackMove: blackEntry ? blackEntry.data : '',
      blackIndex: blackEntry ? i + 2 : null
    })
  }
  return moves
})

// --- AUTO SCROLL ---
watch(currentMoveIndex, () => {
  nextTick(() => {
    const activeEl = document.querySelector('.col-move.current-move')
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  })
})

// --- ENGINE CONTROLS ---
const actualThreads = computed({
  get: () => {
    if (!uciOptions?.value) return 1
    const opt = uciOptions.value.find((o: any) => o.name?.toLowerCase() === 'threads')
    return opt ? parseInt(opt.value) : 1
  },
  set: (val) => {
    if (isEngineLoaded.value && setOption) setOption('Threads', val)
  }
})

const actualHash = computed({
  get: () => {
    if (!uciOptions?.value) return 16
    const opt = uciOptions.value.find((o: any) => o.name?.toLowerCase() === 'hash')
    return opt ? parseInt(opt.value) : 16
  },
  set: (val) => {
    if (isEngineLoaded.value && setOption) setOption('Hash', val)
  }
})

const toggleEngineState = async (e: Event) => {
  const isChecked = (e.target as HTMLInputElement).checked
  if (isChecked) {
    if (!selectedEngineId.value) {
      if (managedEngines.value.length > 0) selectedEngineId.value = managedEngines.value[0].id
      else return alert('Vui lòng thêm engine trước')
    }
    const engineToLoad = managedEngines.value.find((e: any) => e.id === selectedEngineId.value)
    if (engineToLoad) {
      if (!isEngineLoaded.value) await loadEngine(engineToLoad)
      const currentFen = generateFen()
      startAnalysis({ movetime: 0, analysisMode: 'infinite' }, [], currentFen, [])
    }
  } else {
    if (isThinking.value) stopAnalysis({ playBestMoveOnStop: false })
    if (isEngineLoaded.value) await unloadEngine()
  }
}

const handleEngineChange = async () => {
  if (selectedEngineId.value) configManager.setLastSelectedEngineId(selectedEngineId.value)
  if (isEngineActive.value) {
    if (isThinking.value) stopAnalysis({ playBestMoveOnStop: false })
    await unloadEngine()
    nextTick(() => {
        const event = { target: { checked: true } } as any
        toggleEngineState(event)
    })
  }
}

// --- LOG PARSING ---
// Hàm helper để tô màu điểm số
function getScoreClass(scoreText: string) {
    if (scoreText.startsWith('M')) return 'mate-score'
    const val = parseInt(scoreText)
    if (isNaN(val)) return ''
    if (val > 50) return 'pos-score'
    if (val < -50) return 'neg-score'
    return 'draw-score'
}

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
  const wdlMatch = line.match(/wdl\s+(\d+)\s+(\d+)\s+(\d+)/)
  let wdlText = ''
  if (wdlMatch) {
    const total = parseInt(wdlMatch[1]) + parseInt(wdlMatch[2]) + parseInt(wdlMatch[3])
    if (total > 0) {
      const w = (parseInt(wdlMatch[1]) / total * 100).toFixed(0)
      const d = (parseInt(wdlMatch[2]) / total * 100).toFixed(0)
      const l = (parseInt(wdlMatch[3]) / total * 100).toFixed(0)
      wdlText = `W:${w}% D:${d}%`
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
    .reverse() 
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

onMounted(async () => {
  await configManager.loadConfig()
  managedEngines.value = configManager.getEngines()
  const lastSelectedId = configManager.getLastSelectedEngineId()
  if (lastSelectedId) selectedEngineId.value = lastSelectedId
  else if (managedEngines.value.length > 0) selectedEngineId.value = managedEngines.value[0].id
})

watch(parsedLogList, () => {
  nextTick(() => {
    const container = document.querySelector('.log-content');
    if (container && container.scrollTop === 0) container.scrollTop = 0; 
  })
}, { deep: true })
</script>

<style lang="scss">
/* --- Sidebar Base --- */
.sidebar.pikafish-theme {
    height: calc(100vh - 80px); 
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background-color: #f5f5f5; /* Nền xám nhẹ */
    border-left: 1px solid #ddd;
    font-family: 'Roboto', sans-serif;
    position: relative;
}

/* Resize Handle */
.resize-handle-left {
  position: absolute; top: 0; left: -5px; bottom: 0; width: 10px;
  cursor: ew-resize; z-index: 100; background: transparent;
}

/* --- New Toolbar Styling --- */
.pikafish-toolbar {
  background: #ffffff;
  display: flex; align-items: center; padding: 6px 8px;
  gap: 8px; border-bottom: 1px solid #ddd;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  height: 44px; flex-shrink: 0;
}

/* Switch */
.custom-switch { width: 16px; height: 16px; accent-color: #2196f3; cursor: pointer; }

/* Control Groups */
.control-group {
  position: relative;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #f9f9f9;
  display: flex; align-items: center;
  height: 28px;
  transition: all 0.2s;
  padding: 0 4px;
}
.control-group:hover { border-color: #bdbdbd; background: #fff; }
.control-group.expanded { flex-grow: 1; }
.control-group.small { width: 50px; }
.control-group.medium { width: 75px; }

.input-label {
    font-size: 9px; color: #999; text-transform: uppercase; margin-right: 2px; font-weight: bold;
}

.styled-input {
  border: none; width: 100%; height: 100%; outline: none; background: transparent;
  font-size: 13px; font-family: inherit; color: #333; padding: 0;
  appearance: none; -webkit-appearance: none;
}
.select-arrow { pointer-events: none; position: absolute; right: 2px; color: #777; }

/* Buttons */
.settings-btn {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  border: none; background: transparent; cursor: pointer; color: #666;
  border-radius: 4px; transition: 0.2s;
}
.settings-btn:hover { background: #eee; color: #2196f3; }

/* --- Panel Styling --- */
.panel-container {
  background: white; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  border: 1px solid #e0e0e0; overflow: hidden; display: flex; flex-direction: column;
  margin: 0 8px;
}
.panel-header {
  background: #fafafa; padding: 6px 10px; border-bottom: 1px solid #eee;
  display: flex; align-items: center; color: #555;
}
.panel-header h3 { font-size: 12px; font-weight: 700; margin: 0; text-transform: uppercase; }

/* --- Log Content --- */
.log-content {
  padding: 6px; overflow-y: auto; background: #fff;
}
.log-placeholder { text-align: center; color: #aaa; padding: 20px; font-size: 13px; font-style: italic; }
.log-line {
  margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px dashed #f0f0f0;
}
.line-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
.meta-tag { font-size: 10px; padding: 1px 4px; border-radius: 3px; font-weight: bold; }
.meta-tag.depth { background: #e3f2fd; color: #1565c0; }
.meta-tag.score { min-width: 30px; text-align: center; }

/* Score Colors */
.pos-score { color: #2e7d32; background: #e8f5e9; }
.neg-score { color: #c62828; background: #ffebee; }
.draw-score { color: #616161; background: #f5f5f5; }
.mate-score { color: #fff; background: #9c27b0; }

.meta-info { font-size: 11px; color: #757575; }
.line-pv { font-size: 13px; color: #212121; line-height: 1.4; }

/* --- Notation Table --- */
.notation-box {
  display: flex; flex-direction: column; height: 100%;
}
.notation-table-header {
  display: flex; background: #f5f5f5; padding: 6px 0; border-bottom: 1px solid #eee;
  font-size: 11px; font-weight: bold; color: #616161; text-transform: uppercase;
}
.col-num { width: 40px; text-align: center; color: #9e9e9e; }
.col-move { flex: 1; text-align: center; }

.notation-list { overflow-y: auto; flex: 1; }
.notation-row {
  display: flex; align-items: center; padding: 4px 0; border-bottom: 1px solid #fafafa;
  font-size: 13px; transition: 0.1s;
}
.notation-row:hover { background: #f5f5f5; }
.notation-row.highlight-row { background: #fffde7; }

.clickable { cursor: pointer; border-radius: 4px; margin: 0 4px; }
.clickable:hover { background: rgba(0,0,0,0.05); }
.current-move { background: #fff176; color: #000; font-weight: bold; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }

/* Scrollbar đẹp */
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #e0e0e0; border-radius: 3px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #bdbdbd; }

.resize-handle-bottom {
  height: 8px; cursor: ns-resize; background: #f5f5f5; border-top: 1px solid #eee;
  display: flex; align-items: center; justify-content: center;
}
.handle-bar { width: 24px; height: 3px; background: #ccc; border-radius: 2px; }

.disabled-clicks { pointer-events: none; opacity: 0.8; }
</style>