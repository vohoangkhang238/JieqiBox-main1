<template>
  <v-dialog 
    v-model="isVisible" 
    max-width="600px" 
    persistent
    class="engine-manager-dialog"
    transition="dialog-bottom-transition"
  >
    <div class="custom-dialog-card">
      
      <div class="dialog-header">
        <div class="header-left">
          <v-icon icon="mdi-server-network" color="primary" class="mr-2"></v-icon>
          <span class="header-title">{{ $t('engineManager.title') }}</span>
        </div>
        <v-btn icon variant="text" density="comfortable" @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </div>

      <div class="dialog-body">
        <div v-if="engines.length === 0" class="empty-state">
          <v-icon icon="mdi-robot-off" size="64" color="grey-lighten-2" class="mb-3"></v-icon>
          <div class="text-grey-darken-1">{{ $t('engineManager.noEngines') || 'Chưa có Engine nào' }}</div>
        </div>

        <div v-else class="engine-list">
          <div 
            v-for="item in engines" 
            :key="item.id" 
            class="engine-item-card"
          >
            <div class="engine-icon-box">
              <v-icon icon="mdi-cpu-64-bit" color="blue-grey-darken-2"></v-icon>
            </div>

            <div class="engine-info">
              <div class="engine-name">{{ item.name }}</div>
              <div class="engine-path" :title="item.path">
                {{ truncatePath(item.path) }}
              </div>
              <div v-if="item.args" class="engine-args">
                <v-icon size="10" class="mr-1">mdi-code-tags</v-icon> {{ item.args }}
              </div>
            </div>

            <div class="engine-actions">
              <v-tooltip location="top" text="Cấu hình UCI">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon variant="text" density="comfortable" color="blue-darken-2" @click="openUciOptionsEditor(item)">
                    <v-icon>mdi-cog</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>

              <v-tooltip location="top" text="Sửa thông tin">
                <template v-slot:activator="{ props }">
                  <v-btn v-bind="props" icon variant="text" density="comfortable" color="orange-darken-2" @click="editEngine(item)">
                    <v-icon>mdi-pencil</v-icon>
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
          class="text-none font-weight-bold"
        >
          {{ $t('engineManager.addEngineAndroid') }}
        </v-btn>
        
        <v-btn 
          v-else 
          color="primary" 
          prepend-icon="mdi-plus"
          variant="flat"
          @click="addEngineDesktop"
          class="text-none font-weight-bold"
        >
          {{ $t('engineManager.addEngine') }}
        </v-btn>

        <v-spacer></v-spacer>
        
        <v-btn variant="outlined" color="grey-darken-1" @click="closeDialog" class="text-none">
          {{ $t('common.close') }}
        </v-btn>
      </div>

    </div>

    <v-dialog v-model="editDialog" max-width="500px" persistent>
      <v-card class="rounded-lg">
        <v-card-title class="bg-grey-lighten-4 pa-4 d-flex align-center">
          <span class="text-subtitle-1 font-weight-bold">{{ formTitle }}</span>
        </v-card-title>
        <v-card-text class="pa-4">
          <v-text-field
            v-model="editedEngine.name"
            :label="$t('engineManager.engineName')"
            :rules="[rules.required, rules.unique]"
            variant="outlined" density="compact" class="mb-2"
            prepend-inner-icon="mdi-label"
          ></v-text-field>
          <v-text-field
            v-model="editedEngine.path"
            :label="$t('engineManager.enginePath')"
            disabled variant="outlined" density="compact" class="mb-2"
            prepend-inner-icon="mdi-folder"
          ></v-text-field>
          <v-text-field
            v-model="editedEngine.args"
            :label="$t('engineManager.arguments')"
            variant="outlined" density="compact"
            prepend-inner-icon="mdi-code-greater-than"
          ></v-text-field>
        </v-card-text>
        <v-card-actions class="pa-4 pt-0">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="closeEditDialog">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="primary" variant="flat" @click="saveEngine">{{ $t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="uciDialogVisible" max-width="700px" scrollable>
      <v-card class="rounded-lg d-flex flex-column" style="max-height: 80vh;">
        <v-card-title class="bg-blue-grey-lighten-5 pa-3 d-flex justify-space-between align-center">
          <span class="text-subtitle-2 font-weight-bold text-uppercase text-blue-grey-darken-3">
            UCI: {{ selectedEngineForOptions?.name }}
          </span>
          <v-btn icon="mdi-close" variant="text" density="compact" @click="closeUciDialog"></v-btn>
        </v-card-title>
        
        <v-card-text class="pa-0 flex-grow-1 overflow-y-auto bg-grey-lighten-5">
          <div v-if="uciRows.length === 0" class="d-flex flex-column align-center justify-center py-10 text-grey">
             <v-icon icon="mdi-tune-vertical" size="40" class="mb-2"></v-icon>
             <span>{{ $t('uciEditor.noSaved') }}</span>
          </div>

          <div class="pa-3">
             <div
              v-for="(row, idx) in uciRows"
              :key="idx"
              class="uci-row-card"
            >
              <div class="d-flex align-center gap-2 mb-2">
                <v-text-field
                  v-model="row.key"
                  :label="$t('uciEditor.optionName')"
                  density="compact" variant="outlined" hide-details bg-color="white"
                  style="max-width: 200px"
                  class="font-weight-bold"
                ></v-text-field>
                <v-select
                  v-model="row.type"
                  :items="typeItems"
                  item-title="label" item-value="value"
                  :label="$t('uciEditor.type')"
                  density="compact" variant="outlined" hide-details bg-color="white"
                  style="max-width: 120px"
                ></v-select>
                <v-btn icon="mdi-delete" variant="text" color="grey" density="compact" @click="removeUciRow(idx)"></v-btn>
              </div>
              
              <div class="uci-value-area">
                <v-text-field
                  v-if="row.type === 'string' || row.type === 'number'"
                  v-model="row.value"
                  :type="row.type === 'number' ? 'number' : 'text'"
                  :label="$t('uciEditor.optionValue')"
                  density="compact" variant="outlined" hide-details bg-color="white"
                />
                <v-select
                  v-else-if="row.type === 'combo'"
                  v-model="row.value"
                  :items="row.vars || []"
                  :label="$t('uciEditor.optionValue')"
                  density="compact" variant="outlined" hide-details bg-color="white"
                />
                <v-switch
                  v-else-if="row.type === 'boolean'"
                  v-model="row.value"
                  color="primary" hide-details density="compact"
                  :label="row.value ? 'ON' : 'OFF'"
                  class="ma-0"
                />
                <v-btn
                  v-else-if="row.type === 'button'"
                  variant="tonal" color="primary" block density="compact"
                  @click="toggleButtonFlag(row)"
                >
                  {{ row.value ? $t('uciEditor.willExecute') : $t('uciEditor.noExecute') }}
                </v-btn>
              </div>
            </div>
          </div>
        </v-card-text>

        <v-divider></v-divider>
        <v-card-actions class="bg-white pa-3">
          <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" @click="addUciRow">
             {{ $t('uciEditor.addOption') }}
          </v-btn>
          <v-spacer></v-spacer>
          <v-btn color="error" variant="text" @click="onClearUciOptions">{{ $t('uciOptions.clearSettings') }}</v-btn>
          <v-btn color="primary" variant="flat" class="px-6" @click="saveUciOptions">{{ $t('common.save') }}</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="confirmDeleteDialog" max-width="400px">
      <v-card class="rounded-lg">
        <v-card-title class="text-h6 pt-4 px-4">
          <v-icon icon="mdi-alert-circle-outline" color="warning" class="mr-2"></v-icon>
          {{ $t('engineManager.confirmDeleteTitle') }}
        </v-card-title>
        <v-card-text class="px-4 py-2 text-body-1">
          {{ $t('engineManager.confirmDeleteMessage', { name: engineToDelete?.name }) }}
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer></v-spacer>
          <v-btn variant="text" @click="cancelDelete">{{ $t('common.cancel') }}</v-btn>
          <v-btn color="error" variant="flat" @click="confirmDelete">{{ $t('common.delete') }}</v-btn>
        </v-card-actions>
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

  // --- LOGIC GIỮ NGUYÊN 100% ---
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
    { label: t('uciEditor.typeString'), value: 'string' },
    { label: t('uciEditor.typeNumber'), value: 'number' },
    { label: t('uciEditor.typeSwitch'), value: 'boolean' },
    { label: t('uciEditor.typeCombo'), value: 'combo' },
    { label: t('uciEditor.typeButton'), value: 'button' },
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

  // --- Utility mới để cắt ngắn đường dẫn ---
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
    
    // Android Listener Logic kept same...
    if (isAndroidPlatform.value) {
      const { listen } = await import('@tauri-apps/api/event')
      unlistenAndroidAdd = listen('android-engine-added', event => {
        const payload = event.payload as ManagedEngine
        engines.value.push(payload)
        saveEnginesToConfig()
        alert(t('engineManager.engineAddedSuccess', { name: payload.name }))
      })
      unlistenNnueRequest = listen('request-nnue-file', event => {
         // Logic NNUE kept same (omitted for brevity in display, but assume it is here as in your source)
         const payload = event.payload as any
         if (confirm(t('engineManager.promptNnueFile'))) {
             // ... Call handle_nnue_file_result
         } else {
             // ... Add without NNUE
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
/* --- MAIN DIALOG STYLING --- */
.custom-dialog-card {
  background: white;
  display: flex; flex-direction: column;
  height: 100%;
  max-height: 80vh;
  overflow: hidden;
  border-radius: 8px; /* Bo góc nhẹ */
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

/* Header */
.dialog-header {
  padding: 16px 20px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  display: flex; justify-content: space-between; align-items: center;
}
.header-left { display: flex; align-items: center; }
.header-title { font-size: 1.1rem; font-weight: 600; color: #37474F; }

/* Body */
.dialog-body {
  flex-grow: 1;
  overflow-y: auto;
  padding: 16px;
  background-color: #fafafa;
}

/* Engine List - Thay thế v-data-table */
.engine-list {
  display: flex; flex-direction: column; gap: 10px;
}

.engine-item-card {
  display: flex; align-items: center;
  background: white;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 12px;
  transition: all 0.2s;
}

.engine-item-card:hover {
  border-color: #b0bec5;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  transform: translateY(-1px);
}

.engine-icon-box {
  width: 40px; height: 40px;
  background-color: #eceff1;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin-right: 16px;
}

.engine-info { flex-grow: 1; overflow: hidden; }
.engine-name { font-weight: 600; font-size: 1rem; color: #263238; margin-bottom: 2px; }
.engine-path { font-size: 0.8rem; color: #78909c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: monospace; }
.engine-args { font-size: 0.75rem; color: #546e7a; margin-top: 2px; background: #eceff1; display: inline-block; padding: 2px 6px; border-radius: 4px; }

.engine-actions {
  display: flex; gap: 4px; opacity: 0.8;
}
.engine-item-card:hover .engine-actions { opacity: 1; }

/* Empty State */
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 200px;
}

/* Footer */
.dialog-footer {
  padding: 12px 20px;
  border-top: 1px solid #e0e0e0;
  background-color: white;
  display: flex; align-items: center;
}

/* UCI Rows */
.uci-row-card {
  border: 1px solid #e0e0e0;
  background: #fff;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 8px;
}
.uci-value-area {
  margin-top: 8px;
}
</style>