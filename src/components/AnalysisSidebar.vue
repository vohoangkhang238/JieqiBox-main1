<template>
  <div 
    class="sidebar pikafish-theme" 
    :style="{ width: sidebarWidth + 'px' }"
  >
    <div class="resize-handle-left" @mousedown.prevent="startResizeWidth"></div>

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

      <div class="engine-info-box engine-name static-name">
        <v-icon icon="mdi-robot" size="16" color="#555" class="mr-1"></v-icon>
        <span class="custom-display-name">Pikafish</span>
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

      </div>

    <DraggablePanel panel-id="engine-log" class="mt-2" :no-resize="true">
      <template #header>
        <div class="panel-title-text">
          <h3>{{ $t('analysis.engineAnalysis') }}</h3>
        </div>
      </template>
      
      <div 
        class="pikafish-log-container" 
        ref="logContainer"
        :style="{ height: logHeight + 'px' }"
      >
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
      
      <div class="resize-handle-bottom" @mousedown.prevent="startResizeHeight">
        <div class="handle-grip"></div>
      </div>
    </DraggablePanel>

    <DraggablePanel panel-id="notation" class="mt-2 flex-grow-1" :no-resize="true">
      <template #header>
        <div class="notation-header">
          <h3>{{ $t('analysis.notation') }}</h3>
        </div>
      </template>
      
      <div
        class="notation-table-container flex-grow-1"
        :class="{ 'disabled-clicks': isMatchRunning }"
        ref="moveListElement"
      >
        <div class="notation-row header">
          <div class="col-num">#</div>
          <div class="col-move">Đỏ</div>
          <div class="col-move">Đen</div>
        </div>

        <div class="notation-body">
          <div 
            v-for="pair in formattedHistory" 
            :key="pair.moveNumber" 
            class="notation-row"
            :class="{ 'active-row': currentMoveIndex === pair.redIndex || currentMoveIndex === pair.blackIndex }"
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
            Chưa có nước đi nào
          </div>
        </div>
      </div>
    </DraggablePanel>

    </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch, nextTick, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfigManager } from '@/composables/useConfigManager'
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
  uciOptions, setOption, currentEngine 
} = engineState

const { 
  history, currentMoveIndex, initialFen, generateFen, replayToMove,
} = gameState

// --- State UI ---
const moveListElement = ref<HTMLElement | null>(null)

// --- KÍCH THƯỚC ĐỘNG ---
const sidebarWidth = ref(420)
const logHeight = ref(250)

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

// --- LOGIC MỚI: FORMAT BIÊN BẢN DẠNG BẢNG (Formatted History) ---
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
      redIndex: i + 1, // Index để replay (1-based)
      blackMove: blackEntry ? blackEntry.data : '',
      blackIndex: blackEntry ? i + 2 : null
    })
  }
  return moves
})

// --- TỰ ĐỘNG CUỘN BIÊN BẢN ---
watch(currentMoveIndex, () => {
  nextTick(() => {
    const activeEl = document.querySelector('.col-move.current-move')
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  })
})

// --- KẾT NỐI ENGINE ---
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

// Hàm bật tắt Engine đã được đơn giản hóa vì chỉ có 1 engine
const toggleEngineState = async (e: Event) => {
  const isChecked = (e.target as HTMLInputElement).checked
  if (isChecked) {
    // Logic Auto-load engine đã nằm trong useUciEngine.ts
    // Ở đây ta chỉ cần gọi load nếu chưa load, nhưng thực tế app sẽ tự load khi mở.
    // Nếu người dùng tắt rồi bật lại:
    if (!isEngineLoaded.value) {
       // Thử gọi lại autoLoadLastEngine hoặc autoLoadBuiltInEngine từ state nếu có
       // Tuy nhiên, đơn giản nhất là thông báo người dùng hoặc trigger lại flow
       // Vì useUciEngine đã handle việc này, ở đây ta giả định engine luôn sẵn sàng 
       // hoặc sẽ tự load lại nếu cần.
       
       // Tạm thời nếu engine chưa load, ta không làm gì cả (vì auto-load chạy ở background)
       // Hoặc reload window để kích hoạt lại auto-load
       alert("Engine sẽ tự động tải lại...")
       window.location.reload()
    } else {
        const currentFen = generateFen()
        startAnalysis({ movetime: 0, analysisMode: 'infinite' }, [], currentFen, [])
    }
  } else {
    if (isThinking.value) stopAnalysis({ playBestMoveOnStop: false })
    // Không unload hoàn toàn process để tránh phải load lại, chỉ stop phân tích
    // Nhưng nếu muốn tắt hẳn:
    if (isEngineLoaded.value) await unloadEngine()
  }
}

// --- LOG PARSING ---
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
})

watch(parsedLogList, () => {
  nextTick(() => {
    const container = document.querySelector('.pikafish-log-container');
    if (container && container.scrollTop === 0) container.scrollTop = 0; 
  })
}, { deep: true })
</script>

<style lang="scss">
/* --- Sidebar Base --- */
.sidebar {
    height: calc(100vh - 120px); 
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-sizing: border-box;
    border-left: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
    overflow-y: hidden;
    background-color: rgb(var(--v-theme-surface));
    font-family: 'Noto Sans SC', sans-serif;
    position: relative;
    min-width: 300px;
}

.resize-handle-left {
  position: absolute; top: 0; left: 0; bottom: 0; width: 5px;
  cursor: ew-resize; z-index: 100; background-color: transparent;
  transition: background-color 0.2s;
}
.resize-handle-left:hover { background-color: rgba(0, 123, 255, 0.3); }

.resize-handle-bottom {
  width: 100%; height: 8px; cursor: ns-resize;
  background-color: #f0f0f0; display: flex; align-items: center; justify-content: center;
  border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; margin-top: -1px;
}
.resize-handle-bottom:hover { background-color: #e0e0e0; }
.handle-grip { width: 30px; height: 3px; background-color: #bbb; border-radius: 2px; }

.sidebar.pikafish-theme {
  font-family: 'Consolas', 'Monaco', monospace;
  background-color: #f5f5f5;
  padding: 8px;
}

/* --- Toolbar --- */
.pikafish-toolbar {
  background: #e0e0e0; display: flex; align-items: center; padding: 4px 6px;
  gap: 6px; border: 1px solid #ccc; height: 38px; flex-shrink: 0;
}
.engine-toggle input[type="checkbox"] { width: 18px; height: 18px; accent-color: #6a1b9a; cursor: pointer; }
.engine-info-box {
  background: white; border: 1px solid #aaa; padding: 2px 4px; font-size: 13px;
  height: 24px; display: flex; align-items: center; overflow: hidden;
}
/* Style cho tên Engine tĩnh */
.engine-info-box.static-name {
  background-color: #e0e0e0;
  border: 1px solid #bbb;
  cursor: default;
}

.engine-name { flex-grow: 1; min-width: 100px; }
.threads { width: 50px; }
.hash { width: 70px; }
.pika-select, .pika-select-small, .pika-input {
  border: none; width: 100%; outline: none; font-family: inherit; font-size: 12px;
  background: transparent; padding: 0; margin: 0;
}
.custom-display-name { font-weight: bold; color: #333; font-size: 13px; }

/* --- Log Display --- */
.pikafish-log-container {
  flex-shrink: 0; background: white; overflow-y: auto; padding: 5px;
  border: 1px solid #ccc; border-bottom: none;
}
.log-entry { margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px dotted #f0f0f0; }
.log-header {
  color: #008000; font-size: 12px; font-weight: bold; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px;
}
.p-item { margin-right: 8px; }
.log-pv { color: #000; font-size: 14px; line-height: 1.4; word-wrap: break-word; font-family: 'Noto Sans SC', sans-serif; }
.log-placeholder { text-align: center; color: #999; margin-top: 20px; font-style: italic; }

/* --- Notation Table Style --- */
.notation-table-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
  background-color: white;
  overflow: hidden;
  font-family: 'Roboto Mono', monospace;
  font-size: 14px;
}

/* Header */
.notation-row.header {
  background-color: #e0e0e0;
  font-weight: bold;
  border-bottom: 1px solid #ccc;
  color: #333;
}

/* Row chung */
.notation-row {
  display: flex;
  width: 100%;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;
}

.notation-body {
  flex-grow: 1;
  overflow-y: auto;
}

/* Cột */
.col-num {
  width: 40px;
  text-align: center;
  border-right: 1px solid #eee;
  color: #666;
  background-color: #f9f9f9;
  padding: 4px 0;
  font-size: 12px;
}

.col-move {
  flex: 1;
  text-align: center;
  padding: 4px 0;
  cursor: pointer;
  transition: background 0.1s;
}

.col-move:hover {
  background-color: #eaeaea;
}

/* Highlight nước đi hiện tại */
.col-move.current-move {
  background-color: #ffeb3b; /* Vàng sáng */
  color: #000;
  font-weight: bold;
  box-shadow: inset 0 0 0 1px #fbc02d;
}

/* Dòng active (đang xem) */
.notation-row.active-row {
  background-color: #fff9c4;
}

.empty-notation {
  text-align: center;
  padding: 20px;
  color: #999;
  font-style: italic;
  font-size: 13px;
}

.panel-title-text h3, .notation-header h3 {
  font-size: 13px; margin: 0; color: #333; font-weight: bold;
}
</style>