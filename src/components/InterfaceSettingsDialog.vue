<template>
  <Transition name="fade">
    <div v-if="isDialogVisible" class="settings-overlay" @click.self="close">
      <div class="settings-modal">
        
        <div class="modal-header">
          <h3>Cài Đặt Giao Diện</h3>
          <button class="close-btn" @click="close">
            <v-icon icon="mdi-close" />
          </button>
        </div>

        <div class="modal-body">
          
          <div class="setting-group">
            <div class="group-title">Giao diện & Hiển thị</div>
            
            <div class="setting-item">
              <div class="label-box">
                <span class="main-label">Chế độ tối (Dark Mode)</span>
                <span class="sub-label">Giao diện nền tối bảo vệ mắt</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="darkMode">
                <span class="slider round"></span>
              </label>
            </div>

            <div class="setting-item">
              <div class="label-box">
                <span class="main-label">Tọa độ bàn cờ</span>
                <span class="sub-label">Hiện số 1-9 và chữ A-I</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="showCoordinates">
                <span class="slider round"></span>
              </label>
            </div>

            <div class="setting-item">
              <div class="label-box">
                <span class="main-label">Hoạt ảnh (Animation)</span>
                <span class="sub-label">Hiệu ứng quân di chuyển mượt</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="showAnimations">
                <span class="slider round"></span>
              </label>
            </div>

            <div class="setting-item">
              <div class="label-box">
                <span class="main-label">Thanh lợi thế</span>
                <span class="sub-label">Evaluation Bar bên cạnh bàn cờ</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="showEvaluationBar">
                <span class="slider round"></span>
              </label>
            </div>
            
             <div class="setting-item">
              <div class="label-box">
                <span class="main-label">Biểu đồ thế trận</span>
                <span class="sub-label">Hiển thị biểu đồ diễn biến ván đấu</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="showPositionChart">
                <span class="slider round"></span>
              </label>
            </div>
          </div>

          <div class="setting-group">
            <div class="group-title">Hỗ trợ chơi</div>

            <div class="setting-item">
              <div class="label-box">
                <span class="main-label">Gợi ý nước đi (AI)</span>
                <span class="sub-label">Hiển thị mũi tên nước đi tốt nhất</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="showArrows">
                <span class="slider round"></span>
              </label>
            </div>

            <div class="setting-item">
              <div class="label-box">
                <span class="main-label">Ký hiệu Hán văn</span>
                <span class="sub-label">Sử dụng chữ Hán trên quân cờ</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="showChineseNotation">
                <span class="slider round"></span>
              </label>
            </div>

            <div class="setting-item">
              <div class="label-box">
                <span class="main-label">Chỉ số may mắn</span>
                <span class="sub-label">Hiển thị chỉ số Luck Index</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="showLuckIndex">
                <span class="slider round"></span>
              </label>
            </div>
          </div>

          <div class="setting-group">
            <div class="group-title">Âm thanh</div>
            
            <div class="setting-item">
              <div class="label-box">
                <span class="main-label">Hiệu ứng âm thanh</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="enableSoundEffects">
                <span class="slider round"></span>
              </label>
            </div>

            <div class="setting-item volume-item" :class="{ disabled: !enableSoundEffects }">
              <div class="label-box">
                <span class="main-label">Âm lượng ({{ soundVolume }}%)</span>
              </div>
              <div class="slider-container">
                <input type="range" v-model.number="soundVolume" min="0" max="100" step="5" :disabled="!enableSoundEffects">
              </div>
            </div>
          </div>

          <div class="setting-group">
            <div class="group-title">Hệ thống</div>
            <div class="setting-item">
              <div class="label-box">
                <span class="main-label">Tự động lưu (Autosave)</span>
                <span class="sub-label">Lưu ván đấu khi đóng trình duyệt</span>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" v-model="autosave">
                <span class="slider round"></span>
              </label>
            </div>
          </div>

        </div>

        <div class="modal-footer">
          <div class="version-info">UI Version 2.0</div>
          <button class="done-btn" @click="close">Hoàn tất</button>
        </div>

      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
  import { useInterfaceSettings } from '@/composables/useInterfaceSettings'

  // Model binding cho dialog (thay thế cho v-model="isDialogVisible" ở code cũ)
  const isDialogVisible = defineModel<boolean>()

  const {
    showCoordinates,
    showAnimations,
    showPositionChart,
    showEvaluationBar,
    darkMode,
    autosave,
    showChineseNotation,
    showLuckIndex,
    showArrows,
    enableSoundEffects,
    soundVolume,
    // Các biến kỹ thuật như parseUciInfo, engineLogLineLimit... đã bị loại bỏ
  } = useInterfaceSettings()

  const close = () => {
    isDialogVisible.value = false
  }
</script>

<style scoped lang="scss">
/* --- ANIMATION --- */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* --- LAYOUT --- */
.settings-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5px);
  display: flex; align-items: center; justify-content: center;
  padding: 15px;
}

.settings-modal {
  width: 100%; max-width: 420px;
  background: #1e1e1e;
  color: #fff;
  border-radius: 16px;
  box-shadow: 0 15px 40px rgba(0,0,0,0.5);
  border: 1px solid rgba(255,255,255,0.08);
  display: flex; flex-direction: column;
  overflow: hidden;
  max-height: 85vh;
}

/* --- HEADER --- */
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px;
  background: rgba(255,255,255,0.03);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  
  h3 { margin: 0; font-size: 18px; font-weight: 600; letter-spacing: 0.5px; }
}
.close-btn {
  background: transparent; border: none; color: #888; cursor: pointer;
  padding: 6px; border-radius: 50%; display: flex;
  transition: all 0.2s;
  &:hover { background: rgba(255,255,255,0.1); color: #fff; }
}

/* --- BODY --- */
.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  
  /* Scrollbar đẹp */
  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
  &::-webkit-scrollbar-track { background: transparent; }
}

.setting-group { margin-bottom: 24px; }
.setting-group:last-child { margin-bottom: 0; }

.group-title {
  color: #00d2ff;
  font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700;
  margin-bottom: 12px;
}

.setting-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.03);
  &:last-child { border-bottom: none; }
}

.label-box { display: flex; flex-direction: column; padding-right: 15px; }
.main-label { font-size: 15px; font-weight: 500; color: #f0f0f0; }
.sub-label { font-size: 12px; color: #888; margin-top: 3px; }

/* --- TOGGLE SWITCH --- */
.toggle-switch {
  position: relative; display: inline-block; width: 46px; height: 26px; flex-shrink: 0;
}
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute; cursor: pointer; inset: 0;
  background-color: #3a3a3a; transition: .3s;
}
.slider:before {
  position: absolute; content: "";
  height: 20px; width: 20px; left: 3px; bottom: 3px;
  background-color: white; transition: .3s;
  box-shadow: 0 2px 5px rgba(0,0,0,0.3);
}
.slider.round { border-radius: 34px; }
.slider.round:before { border-radius: 50%; }

input:checked + .slider { background-color: #007bff; }
input:checked + .slider:before { transform: translateX(20px); }

/* --- VOLUME SLIDER --- */
.volume-item { flex-direction: column; align-items: flex-start; gap: 10px; }
.volume-item.disabled { opacity: 0.5; pointer-events: none; }
.slider-container { width: 100%; }
input[type=range] {
  width: 100%; height: 4px; background: #444; border-radius: 2px; outline: none; -webkit-appearance: none;
}
input[type=range]::-webkit-slider-thumb {
  -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #007bff; cursor: pointer;
}

/* --- FOOTER --- */
.modal-footer {
  padding: 16px 24px;
  background: rgba(0,0,0,0.2);
  border-top: 1px solid rgba(255,255,255,0.05);
  display: flex; align-items: center; justify-content: space-between;
}
.version-info { font-size: 12px; color: #555; font-family: monospace; }
.done-btn {
  background: #007bff; color: #fff;
  border: none; padding: 8px 24px; border-radius: 8px;
  font-weight: 600; font-size: 14px; cursor: pointer;
  transition: transform 0.1s, background 0.2s;
  &:hover { background: #0056b3; }
  &:active { transform: scale(0.96); }
}
</style>