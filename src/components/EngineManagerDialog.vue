<template>
  <v-dialog 
    v-model="isVisible" 
    max-width="650px" 
    persistent
    class="engine-manager-dialog"
    transition="dialog-bottom-transition"
  >
    <div class="custom-dialog-card">
      
      <div class="dialog-header">
        <div class="header-left">
          <div class="header-icon-bg">
            <v-icon icon="mdi-server-network" color="primary" size="20"></v-icon>
          </div>
          <span class="header-title">{{ $t('engineManager.title') }}</span>
        </div>
        <v-btn icon variant="text" density="comfortable" color="grey-darken-1" @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>

      <div class="dialog-body">
        <div v-if="engines.length === 0" class="empty-state">
          <v-icon icon="mdi-robot-off" size="64" color="grey-lighten-2" class="mb-3"></v-icon>
          <div class="text-grey-darken-1 font-weight-medium">{{ $t('engineManager.noEngines') || 'Chưa có Engine nào' }}</div>
          <div class="text-caption text-grey">Thêm Engine mới để bắt đầu phân tích</div>
        </div>

        <div v-else class="engine-list">
          <div 
            v-for="item in engines" 
            :key="item.id" 
            class="engine-item-card"
          >
            <div class="engine-icon-box">
              <v-icon icon="mdi-chess-knight" color="white" size="24"></v-icon>
            </div>

            <div class="engine-info">
              <div class="engine-name">{{ item.name }}</div>
              <div class="engine-path" :title="item.path">
                <v-icon size="12" class="mr-1" color="grey">mdi-folder-outline</v-icon>
                {{ truncatePath(item.path) }}
              </div>
              <div v-if="item.args" class="engine-args">
                <span class="args-label">Args:</span> {{ item.args }}
              </div>
            </div>

            <div class="engine-actions">
              <v-tooltip location="top" text="Cấu hình UCI">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon variant="text" density="comfortable" color="blue-darken-1" @click="openUciOptionsEditor(item)">
                    <v-icon>mdi-tune</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>

              <v-tooltip location="top" text="Sửa">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon variant="text" density="comfortable" color="grey-darken-2" @click="editEngine(item)">
                    <v-icon>mdi-pencil-outline</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>

              <v-tooltip location="top" text="Xóa">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon variant="text" density="comfortable" color="red-lighten-1" @click="prepareToDeleteEngine(item)">
                    <v-icon>mdi-trash-can-outline</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <v-btn
          v-if="isAndroidPlatform"
          color="primary"
          prepend-icon="mdi-android"
          variant="flat"
          @click="addEngineAndroid"
          class="add-btn"
        >
          {{ $t('engineManager.addEngineAndroid') }}
        </v-btn>
        
        <v-btn 
          v-else 
          color="primary" 
          prepend-icon="mdi-plus"
          variant="flat"
          @click="addEngineDesktop"
          class="add-btn"
        >
          {{ $t('engineManager.addEngine') }}
        </v-btn>
      </div>

    </div>

    <v-dialog v-model="editDialog" max-width="450px" persistent>
      <v-card class="rounded-lg elevation-4">
        <v-card-title class="pa-4 d-flex align-center border-bottom">
          <span class="text-subtitle-1 font-weight-bold">{{ formTitle }}</span>
        </v-card-title>
        <v-card-text class="pa-4 pt-5">
          <v-text-field
            v-model="editedEngine.name"
            :label="$t('engineManager.engineName')"
            :rules="[rules.required, rules.unique]"
            variant="outlined" density="compact" color="primary" class="mb-3"
            prepend-inner-icon="mdi-label-outline"
          ></v-text-field>
          <v-text-field
            v-model="editedEngine.path"
            :label="$t('engineManager.enginePath')"
            disabled variant="filled" density="compact" class="mb-3"
            prepend-inner-icon="mdi-folder-outline"
          ></v-text-field>
          <v-text-field
            v-model="editedEngine.args"
            :label="$t('engineManager.arguments')"
            variant="outlined" density="compact" color="primary"
            prepend-inner-icon="mdi-code-braces"
            hint="Ví dụ: --threads 4" persistent-hint
          ></v-text-field>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer></v-spacer>
          <v-btn variant="text" color="grey-darken-1" @click="closeEditDialog">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="primary" variant="flat" @click="saveEngine" class="px-6">{{ $t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="uciDialogVisible" max-width="700px" scrollable transition="dialog-bottom-transition">
      <div class="custom-dialog-card uci-dialog">
        
        <div class="dialog-header bg-blue-grey-lighten-5">
          <div class="header-left">
            <v-icon icon="mdi-tune-vertical" color="blue-grey-darken-1" class="mr-2"></v-icon>
            <div class="d-flex flex-column">
              <span class="header-title text-blue-grey-darken-3">Cấu hình UCI</span>
              <span class="text-caption text-blue-grey">{{ selectedEngineForOptions?.name }}</span>
            </div>
          </div>
          <v-btn icon variant="text" density="compact" @click="closeUciDialog">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>
        
        <div class="dialog-body bg-grey-lighten-5 pa-2">
          
          <div v-if="uciRows.length === 0" class="d-flex flex-column align-center justify-center py-12 text-grey">
             <v-icon icon="mdi-cogs" size="48" class="mb-3 opacity-50"></v-icon>
             <span class="text-body-2">{{ $t('uciEditor.noSaved') || 'Chưa có tùy chỉnh nào' }}</span>
             <v-btn variant="text" color="primary" class="mt-2" @click="addUciRow">Thêm tham số đầu tiên</v-btn>
          </div>

          <div class="uci-options-grid">
             <div
              v-for="(row, idx) in uciRows"
              :key="idx"
              class="uci-option-card"
            >
              <div class="uci-card-header">
                <div class="uci-key-input">
                  <input type="text" v-model="row.key" :placeholder="$t('uciEditor.optionName')" class="clean-input font-weight-bold" />
                </div>
                
                <div class="uci-meta-controls">
                  <div class="uci-type-select">
                    <select v-model="row.type">
                      <option v-for="t in typeItems" :key="t.value" :value="t.value">{{ t.label }}</option>
                    </select>
                    <v-icon icon="mdi-chevron-down" size="12" class="select-arrow"></v-icon>
                  </div>
                  <button class="uci-delete-btn" @click="removeUciRow(idx)">
                    <v-icon icon="mdi-close" size="14"></v-icon>
                  </button>
                </div>
              </div>
              
              <div class="uci-card-body">
                
                <div v-if="row.type === 'string' || row.type === 'number'" class="uci-input-wrapper">
                  <input 
                    v-model="row.value" 
                    :type="row.type === 'number' ? 'number' : 'text'" 
                    :placeholder="$t('uciEditor.optionValue')"
                    class="clean-input value-input"
                  />
                </div>

                <div v-else-if="row.type === 'combo'" class="uci-select-wrapper">
                  <select v-model="row.value" class="clean-select">
                    <option v-for="opt in (row.vars || [])" :key="opt" :value="opt">{{ opt }}</option>
                  </select>
                  <v-icon icon="mdi-menu-down" class="select-icon"></v-icon>
                </div>

                <div v-else-if="row.type === 'boolean'" class="uci-switch-wrapper">
                  <label class="modern-toggle">
                    <input type="checkbox" v-model="row.value">
                    <span class="slider round"></span>
                  </label>
                  <span class="switch-label">{{ row.value ? 'ON' : 'OFF' }}</span>
                </div>

                <v-btn
                  v-else-if="row.type === 'button'"
                  variant="tonal" color="primary" block density="compact" height="32"
                  @click="toggleButtonFlag(row)"
                  class="text-none"
                >
                  <v-icon icon="mdi-play-circle-outline" class="mr-1" size="16"></v-icon>
                  {{ row.value ? $t('uciEditor.willExecute') : $t('uciEditor.noExecute') }}
                </v-btn>

              </div>
            </div>
          </div>
        </div>

        <div class="dialog-footer bg-white border-top">
          <v-btn color="primary" variant="text" prepend-icon="mdi-plus" @click="addUciRow" class="text-none">
             {{ $t('uciEditor.addOption') }}
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn color="error" variant="text" class="text-none mr-2" @click="onClearUciOptions">
            {{ $t('uciOptions.clearSettings') }}
          </v-btn>
          <v-btn color="blue-grey-darken-3" variant="flat" class="px-6 text-none font-weight-bold" @click="saveUciOptions">
            {{ $t('common.save') }}
          </v-btn>
        </div>
      </div>
    </v-dialog>

    <v-dialog v-model="confirmDeleteDialog" max-width="400px">
      <v-card class="rounded-lg text-center pa-4">
        <v-icon icon="mdi-alert-circle-outline" color="error" size="48" class="mb-2"></v-icon>
        <div class="text-h6 font-weight-bold">{{ $t('engineManager.confirmDeleteTitle') }}</div>
        <div class="text-body-2 text-grey-darken-1 my-3">
          {{ $t('engineManager.confirmDeleteMessage', { name: engineToDelete?.name }) }}
        </div>
        <div class="d-flex justify-center gap-2 mt-2">
          <v-btn variant="outlined" color="grey" @click="cancelDelete" class="px-6">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="error" variant="flat" @click="confirmDelete" class="px-6">{{ $t('common.delete') }}</v-btn>
        </div>
      </v-card>
    </v-dialog>

  </v-dialog>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import {
    useConfigManager,
    type ManagedEngine,
  } from '../composables/useConfigManager'
  import { open } from '@tauri-apps/plugin-dialog'
  import { invoke } from '@tauri-apps/api/core'
  import type { UnlistenFn } from '@tauri-apps/api/event'
  import { isAndroidPlatform as checkAndroidPlatform } from '../utils/platform'

  const props = defineProps<{ modelValue: boolean }>()
  const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

  const { t } = useI18n()
  const configManager = useConfigManager()

  const engines = ref<ManagedEngine[]>([])
  const editDialog = ref(false)
  const isEditing = ref(false)
  const editedEngine = ref<ManagedEngine>({ id: '', name: '', path: '', args: '' })
  const defaultEngine: ManagedEngine = { id: '', name: '', path: '', args: '' }
  let unlistenAndroidAdd: Promise<UnlistenFn> | null = null
  let unlistenNnueRequest: Promise<UnlistenFn> | null = null

  const confirmDeleteDialog = ref(false)
  const engineToDelete = ref<ManagedEngine | null>(null)

  const uciDialogVisible = ref(false)
  const selectedEngineForOptions = ref<ManagedEngine | null>(null)
  
  type RowType = 'string' | 'number' | 'boolean' | 'combo' | 'button'
  
  interface UciRow {
    key: string
    value: any
    type: RowType
    vars?: string[]
    varsCsv?: string
  }
  
  const uciRows = ref<UciRow[]>([])
  const typeItems = [
    { label: 'String', value: 'string' },
    { label: 'Number', value: 'number' },
    { label: 'Switch', value: 'boolean' },
    { label: 'Combo', value: 'combo' },
    { label: 'Button', value: 'button' },
  ]

  const isVisible = computed({
    get: () => props.modelValue,
    set: value => emit('update:modelValue', value),
  })

  const formTitle = computed(() => isEditing.value ? t('engineManager.editEngine') : t('engineManager.addEngine'))
  const isAndroidPlatform = computed(() => checkAndroidPlatform())

  const rules = {
    required: (value: string) => !!value || t('common.required'),
    unique: (value: string) => {
      if (isEditing.value) {
        return (!engines.value.some((e: ManagedEngine) => e.name === value && e.id !== editedEngine.value.id) || t('engineManager.nameExists'))
      }
      return (!engines.value.some((e: ManagedEngine) => e.name === value) || t('engineManager.nameExists'))
    },
  }

  const truncatePath = (path: string) => {
    if (!path) return ''
    if (path.length > 40) return '...' + path.substring(path.length - 37)
    return path
  }

  const loadEnginesFromConfig = async () => {
    await configManager.loadConfig()
    engines.value = configManager.getEngines()
  }

  const saveEnginesToConfig = async () => {
    await configManager.saveEngines(engines.value)
  }

  const addEngineDesktop = async () => {
    const selectedPath = await open({ multiple: false, title: 'Select UCI Engine' })
    if (typeof selectedPath === 'string' && selectedPath) {
      const newId = `engine_${Date.now()}`
      editedEngine.value = {
        id: newId,
        name: `Engine ${engines.value.length + 1}`,
        path: selectedPath,
        args: '',
      }
      isEditing.value = false
      editDialog.value = true
    }
  }

  const addEngineAndroid = () => {
    const name = prompt(t('engineManager.promptEngineName'))
    if (!name) return
    if (engines.value.some((e: ManagedEngine) => e.name === name)) {
      alert(t('engineManager.nameExists'))
      return
    }
    const args = prompt(t('engineManager.promptEngineArgs'), '') ?? ''
    const hasNnue = prompt(t('engineManager.promptHasNnue'), 'n')?.toLowerCase() === 'y'
    const engineData = { name, args, hasNnue }

    if (typeof window !== 'undefined' && (window as any).SafFileInterface) {
      ;(window as any).SafFileInterface.startFileSelection()
      const handleSafResult = (event: Event) => {
        const customEvent = event as CustomEvent
        const { filename, result } = customEvent.detail
        if (result && result !== 'File selection cancelled' && result !== 'No URI returned' && result !== 'No data returned') {
          invoke('handle_saf_file_result', {
            tempFilePath: result,
            filename: filename,
            name: engineData.name,
            args: engineData.args,
            hasNnue: engineData.hasNnue,
          }).catch(err => {
            alert(t('errors.failedToProcessEngine') + ': ' + err)
          })
        }
        window.removeEventListener('saf-file-result', handleSafResult)
      }
      window.addEventListener('saf-file-result', handleSafResult)
    } else {
      invoke('request_saf_file_selection', { name, args, hasNnue }).catch(
        err => alert(t('errors.failedToOpenFileSelector'))
      )
    }
  }

  const editEngine = (engine: ManagedEngine) => {
    isEditing.value = true
    editedEngine.value = { ...engine }
    editDialog.value = true
  }

  const openUciOptionsEditor = async (engine: ManagedEngine) => {
    await configManager.loadConfig()
    selectedEngineForOptions.value = engine
    const saved = configManager.getUciOptions(engine.id)
    uciRows.value = Object.entries(saved).map(([key, value]) => {
      let type: RowType = 'string'
      if (typeof value === 'boolean') type = 'boolean'
      else if (typeof value === 'number') type = 'number'
      else if (value === '__button__') type = 'button'
      return { key, value, type }
    })
    uciDialogVisible.value = true
  }

  const addUciRow = () => {
    uciRows.value.push({ key: '', value: '', type: 'string', vars: [], varsCsv: '' })
  }

  const removeUciRow = (index: number) => {
    uciRows.value.splice(index, 1)
  }

  const closeUciDialog = () => {
    uciDialogVisible.value = false
    selectedEngineForOptions.value = null
    uciRows.value = []
  }

  const saveUciOptions = async () => {
    if (!selectedEngineForOptions.value) return
    const obj: Record<string, any> = {}
    for (const row of uciRows.value) {
      if (!row.key) continue
      let v: any = row.value
      if (row.type === 'number') {
        const n = Number(v)
        v = isNaN(n) ? 0 : n
      } else if (row.type === 'boolean') {
        v = Boolean(v)
      } else if (row.type === 'button') {
        v = v ? '__button__' : undefined
        if (v === undefined) continue
      } else {
        v = String(v ?? '')
      }
      obj[row.key] = v
    }
    await configManager.updateUciOptions(selectedEngineForOptions.value.id, obj)
    closeUciDialog()
  }

  const onClearUciOptions = async () => {
    if (!selectedEngineForOptions.value) return
    if (confirm(t('uciOptions.confirmClearSettings'))) {
      await configManager.clearUciOptions(selectedEngineForOptions.value.id)
      uciRows.value = []
      alert(t('uciOptions.settingsCleared'))
    }
  }

  const toggleButtonFlag = (row: UciRow) => {
    row.value = !row.value
  }

  const prepareToDeleteEngine = (engine: ManagedEngine) => {
    engineToDelete.value = engine
    confirmDeleteDialog.value = true
  }

  const confirmDelete = () => {
    if (!engineToDelete.value) return
    engines.value = engines.value.filter(e => e.id !== engineToDelete.value!.id)
    saveEnginesToConfig()
    const lastSelectedId = configManager.getLastSelectedEngineId()
    if (lastSelectedId === engineToDelete.value.id) {
      configManager.clearLastSelectedEngineId()
    }
    cancelDelete()
  }

  const cancelDelete = () => {
    confirmDeleteDialog.value = false
    engineToDelete.value = null
  }

  const saveEngine = () => {
    if (isEditing.value) {
      const index = engines.value.findIndex(e => e.id === editedEngine.value.id)
      if (index > -1) {
        const oldEngine = engines.value[index]
        engines.value.splice(index, 1, { ...editedEngine.value })
        if (oldEngine.name !== editedEngine.value.name) {
          configManager.clearLastSelectedEngineId()
        }
      }
    } else {
      if (engines.value.some(e => e.name === editedEngine.value.name)) {
        alert(t('engineManager.nameExists'))
        return
      }
      engines.value.push({ ...editedEngine.value })
    }
    saveEnginesToConfig()
    closeEditDialog()
  }

  const closeDialog = () => { isVisible.value = false }
  
  const closeEditDialog = () => {
    editDialog.value = false
    editedEngine.value = { ...defaultEngine }
    isEditing.value = false
  }

  onMounted(async () => {
    loadEnginesFromConfig()
    if (engines.value.length === 0) configManager.clearLastSelectedEngineId()
    
    if (isAndroidPlatform.value) {
      const { listen } = await import('@tauri-apps/api/event')
      unlistenAndroidAdd = listen('android-engine-added', event => {
        const payload = event.payload as ManagedEngine
        engines.value.push(payload)
        saveEnginesToConfig()
        alert(t('engineManager.engineAddedSuccess', { name: payload.name }))
      })
      unlistenNnueRequest = listen('request-nnue-file', event => {
         const payload = event.payload as any
         if (confirm(t('engineManager.promptNnueFile'))) {
             // Logic NNUE
         }
      })
    }
  })

  onUnmounted(async () => {
    if (unlistenAndroidAdd) (await unlistenAndroidAdd)()
    if (unlistenNnueRequest) (await unlistenNnueRequest)()
  })

  watch(isVisible, newValue => {
    if (newValue) {
      loadEnginesFromConfig()
      if (engines.value.length === 0) configManager.clearLastSelectedEngineId()
    }
  })
</script>

<style scoped lang="scss">
/* --- SHARED DIALOG STYLES --- */
.custom-dialog-card {
  background: white;
  display: flex; flex-direction: column;
  height: 100%;
  max-height: 85vh;
  overflow: hidden;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.2);
}

.dialog-header {
  padding: 12px 20px;
  background-color: #fff;
  border-bottom: 1px solid #f0f0f0;
  display: flex; justify-content: space-between; align-items: center;
}
.header-left { display: flex; align-items: center; gap: 12px; }
.header-icon-bg {
  width: 36px; height: 36px; background: #e3f2fd; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.header-title { font-size: 1.1rem; font-weight: 700; color: #1a237e; letter-spacing: 0.5px; }

.dialog-body { flex-grow: 1; overflow-y: auto; padding: 16px; background-color: #fafafa; }
.dialog-footer { padding: 12px 24px; border-top: 1px solid #f0f0f0; background-color: white; display: flex; align-items: center; gap: 10px; }

/* --- ENGINE LIST --- */
.engine-list { display: flex; flex-direction: column; gap: 12px; }
.engine-item-card {
  display: flex; align-items: center;
  background: white; border: 1px solid #e0e0e0;
  border-radius: 10px; padding: 12px 16px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  &:hover {
    border-color: #2196f3; box-shadow: 0 4px 12px rgba(33, 150, 243, 0.15); transform: translateY(-2px);
  }
}
.engine-icon-box {
  width: 44px; height: 44px; background: linear-gradient(135deg, #607d8b, #455a64);
  border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-right: 16px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
}
.engine-info { flex-grow: 1; overflow: hidden; }
.engine-name { font-weight: 700; font-size: 1rem; color: #263238; margin-bottom: 2px; }
.engine-path { font-size: 0.8rem; color: #78909c; display: flex; align-items: center; }
.engine-args { margin-top: 4px; font-size: 0.75rem; color: #546e7a; background: #eceff1; display: inline-block; padding: 2px 8px; border-radius: 4px; font-family: monospace; }
.engine-actions { display: flex; gap: 4px; }
.add-btn { box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3); }

/* --- UCI OPTIONS EDITOR STYLES --- */
.uci-dialog { height: 100%; }
.uci-options-grid {
  display: grid; grid-template-columns: 1fr; gap: 12px;
  /* On desktop, maybe 2 cols if wide enough */
  @media (min-width: 600px) { grid-template-columns: 1fr 1fr; }
}

.uci-option-card {
  background: white; border: 1px solid #e0e0e0;
  border-radius: 8px; overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  display: flex; flex-direction: column;
}

.uci-card-header {
  padding: 8px 12px; background: #f5f7fa; border-bottom: 1px solid #edf2f7;
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
}

.uci-key-input input {
  width: 100%; border: none; background: transparent; outline: none;
  font-size: 0.9rem; color: #37474f; font-family: 'Roboto Mono', monospace;
}

.uci-meta-controls { display: flex; align-items: center; gap: 6px; }

/* Mini Select for Type */
.uci-type-select { position: relative; }
.uci-type-select select {
  appearance: none; background: #e0e0e0; border: none; border-radius: 12px;
  padding: 2px 18px 2px 8px; font-size: 0.7rem; color: #424242; outline: none; cursor: pointer;
}
.select-arrow { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); pointer-events: none; opacity: 0.6; }

.uci-delete-btn {
  background: transparent; border: none; cursor: pointer; color: #b0bec5;
  display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%;
  &:hover { background: #ffebee; color: #ef5350; }
}

.uci-card-body { padding: 12px; }

/* Input Styles */
.clean-input {
  width: 100%; border: 1px solid #e0e0e0; border-radius: 4px; padding: 6px 10px;
  font-size: 0.9rem; color: #424242; transition: border 0.2s;
  &:focus { border-color: #2196f3; outline: none; }
}

.clean-select {
  width: 100%; appearance: none; border: 1px solid #e0e0e0; border-radius: 4px;
  padding: 6px 10px; background: white; font-size: 0.9rem; outline: none;
}
.uci-select-wrapper { position: relative; }
.select-icon { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); pointer-events: none; color: #757575; }

/* Modern Toggle Switch */
.uci-switch-wrapper { display: flex; align-items: center; gap: 10px; }
.modern-toggle { position: relative; display: inline-block; width: 40px; height: 20px; }
.modern-toggle input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; inset: 0; background-color: #ccc; transition: .4s; border-radius: 20px; }
.slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 2px; bottom: 2px; background-color: white; transition: .4s; border-radius: 50%; }
input:checked + .slider { background-color: #2196f3; }
input:checked + .slider:before { transform: translateX(20px); }
.switch-label { font-size: 0.85rem; font-weight: 600; color: #546e7a; }

/* Empty State */
.empty-state { text-align: center; }
</style>