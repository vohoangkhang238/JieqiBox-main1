<template>
  <div v-if="modelValue" class="engine-dialog-overlay" @click.self="closeDialog">
    <div class="engine-dialog-card">
      <div class="dialog-header">
        <div class="header-title">
          <v-icon icon="mdi-cog-box" color="#1976D2" size="24" class="mr-2"></v-icon>
          <h3>Quản lý Động cơ (Engines)</h3>
        </div>
        <button class="close-btn" @click="closeDialog">
          <v-icon icon="mdi-close" size="20"></v-icon>
        </button>
      </div>

      <div class="dialog-body">
        
        <div v-if="localEngines.length === 0" class="empty-state">
          <v-icon icon="mdi-robot-off" size="64" color="#eee"></v-icon>
          <p>Chưa có Engine nào được thêm</p>
          <button class="btn-primary-outline" @click="triggerAddEngine">
            <v-icon icon="mdi-plus" size="18" class="mr-1"></v-icon> Thêm ngay
          </button>
        </div>

        <div v-else class="engine-list">
          <div 
            v-for="(eng, index) in localEngines" 
            :key="eng.id" 
            class="engine-item"
            :class="{ 'is-editing': editingId === eng.id }"
          >
            <div class="engine-icon">
              <v-icon icon="mdi-cpu-64-bit" color="#455A64"></v-icon>
            </div>

            <div class="engine-info">
              <div v-if="editingId !== eng.id">
                <div class="eng-name">{{ eng.name }}</div>
                <div class="eng-path" :title="eng.path">{{ truncatePath(eng.path) }}</div>
              </div>

              <div v-else class="edit-mode-inputs">
                <input 
                  type="text" 
                  v-model="eng.name" 
                  class="edit-input" 
                  placeholder="Tên hiển thị..." 
                  ref="nameInputRef"
                />
              </div>
            </div>

            <div class="engine-actions">
              <button 
                v-if="editingId !== eng.id" 
                class="action-btn edit" 
                @click="startEdit(eng)"
                title="Đổi tên"
              >
                <v-icon icon="mdi-pencil" size="16"></v-icon>
              </button>
              
              <button 
                v-if="editingId === eng.id" 
                class="action-btn save-mini" 
                @click="stopEdit"
                title="Lưu tên"
              >
                <v-icon icon="mdi-check" size="16"></v-icon>
              </button>

              <button class="action-btn delete" @click="removeEngine(index)" title="Xóa Engine">
                <v-icon icon="mdi-trash-can-outline" size="16"></v-icon>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="dialog-footer">
        <button class="btn-add-new" @click="triggerAddEngine">
          <v-icon icon="mdi-plus" size="18"></v-icon>
          <span>Thêm Engine Mới...</span>
        </button>
        
        <div class="footer-right">
          <button class="btn-cancel" @click="closeDialog">Đóng</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useConfigManager } from '@/composables/useConfigManager'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const configManager = useConfigManager()
const localEngines = ref<any[]>([])
const editingId = ref<string | null>(null)
const nameInputRef = ref<HTMLInputElement | null>(null)

// --- Logic Load/Save ---
watch(() => props.modelValue, async (val) => {
  if (val) {
    await configManager.loadConfig()
    // Clone deep để không ảnh hưởng trực tiếp đến khi chưa save (nếu muốn)
    // Ở đây ta dùng trực tiếp reference cho đơn giản
    localEngines.value = configManager.getEngines()
  }
})

const closeDialog = () => {
  editingId.value = null
  emit('update:modelValue', false)
}

// --- Logic Thêm/Xóa/Sửa ---
const triggerAddEngine = async () => {
  // Giả lập logic mở File Picker
  // Trong thực tế bạn sẽ dùng window.electronAPI.openFile() hoặc tương tự
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.exe' // Chỉ chấp nhận file exe
  
  input.onchange = async (e: any) => {
    const file = e.target.files[0]
    if (file) {
      const newEngine = {
        id: Date.now().toString(),
        name: file.name.replace('.exe', ''), // Tự động lấy tên file làm tên engine
        path: file.path || file.name, // Lưu ý: Trình duyệt web không lấy được full path vì bảo mật. Electron mới lấy được.
        args: ''
      }
      configManager.addEngine(newEngine)
      localEngines.value = configManager.getEngines()
    }
  }
  input.click()
}

const removeEngine = (index: number) => {
  if (confirm('Bạn có chắc chắn muốn xóa engine này?')) {
    configManager.removeEngine(index)
    localEngines.value = configManager.getEngines()
  }
}

const startEdit = (eng: any) => {
  editingId.value = eng.id
  nextTick(() => {
    // Focus vào input (cần xử lý mảng refs nếu dùng v-for, ở đây demo đơn giản)
  })
}

const stopEdit = () => {
  editingId.value = null
  configManager.saveConfig() // Lưu lại tên mới đổi
}

// --- Utilities ---
const truncatePath = (path: string) => {
  if (!path) return ''
  if (path.length > 45) {
    return '...' + path.substring(path.length - 42)
  }
  return path
}
</script>

<style scoped>
/* --- Overlay & Layout --- */
.engine-dialog-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}

.engine-dialog-card {
  width: 550px;
  max-width: 90vw;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  display: flex; flex-direction: column;
  overflow: hidden;
  max-height: 80vh;
}

/* --- Header --- */
.dialog-header {
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  display: flex; justify-content: space-between; align-items: center;
  background-color: #fcfcfc;
}
.header-title { display: flex; align-items: center; }
.header-title h3 { margin: 0; font-size: 16px; font-weight: 600; color: #333; }
.close-btn {
  background: none; border: none; cursor: pointer; color: #999;
  transition: color 0.2s;
}
.close-btn:hover { color: #333; }

/* --- Body --- */
.dialog-body {
  padding: 20px;
  overflow-y: auto;
  min-height: 200px;
  background-color: #fff;
}

/* Empty State */
.empty-state {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100%; color: #999; gap: 10px; margin-top: 40px;
}
.btn-primary-outline {
  border: 1px solid #1976D2; color: #1976D2; background: white;
  padding: 8px 16px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;
  font-weight: 500; transition: all 0.2s;
}
.btn-primary-outline:hover { background: #e3f2fd; }

/* Engine List Item */
.engine-list { display: flex; flex-direction: column; gap: 10px; }

.engine-item {
  display: flex; align-items: center;
  padding: 10px 15px;
  border: 1px solid #eee;
  border-radius: 6px;
  transition: all 0.2s;
  background-color: #fafafa;
}
.engine-item:hover {
  border-color: #bbb;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  background-color: white;
}

.engine-icon {
  width: 40px; height: 40px;
  background: #eceff1; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  margin-right: 15px; flex-shrink: 0;
}

.engine-info { flex-grow: 1; overflow: hidden; }
.eng-name { font-weight: 600; font-size: 14px; color: #333; margin-bottom: 2px; }
.eng-path { font-size: 12px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* Edit Input */
.edit-input {
  width: 100%; padding: 4px 8px; border: 1px solid #1976D2;
  border-radius: 4px; outline: none; font-size: 14px;
}

/* Actions */
.engine-actions { display: flex; gap: 6px; }
.action-btn {
  width: 32px; height: 32px; border-radius: 4px; border: none;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: background 0.2s;
}
.action-btn.edit { background: transparent; color: #1976D2; }
.action-btn.edit:hover { background: #e3f2fd; }
.action-btn.save-mini { background: #4CAF50; color: white; }
.action-btn.delete { background: transparent; color: #bdbdbd; }
.action-btn.delete:hover { background: #ffebee; color: #d32f2f; }

/* --- Footer --- */
.dialog-footer {
  padding: 15px 20px;
  border-top: 1px solid #eee;
  background-color: #f9f9f9;
  display: flex; justify-content: space-between; align-items: center;
}

.btn-add-new {
  display: flex; align-items: center; gap: 6px;
  background-color: #1976D2; color: white; border: none;
  padding: 8px 16px; border-radius: 4px; font-weight: 500; cursor: pointer;
  box-shadow: 0 2px 4px rgba(25, 118, 210, 0.3);
  transition: background 0.2s;
}
.btn-add-new:hover { background-color: #1565C0; }

.btn-cancel {
  background: white; border: 1px solid #ccc; color: #555;
  padding: 8px 16px; border-radius: 4px; cursor: pointer;
  transition: background 0.2s;
}
.btn-cancel:hover { background-color: #eee; }

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
</style>