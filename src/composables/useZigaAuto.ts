// src/composables/useZigaAuto.ts
import { ref, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';

export function useZigaAuto(gameState: any) {
  const isAutoActive = ref(false);
  let intervalId: any = null;

  // Hàm bắt đầu quét liên tục
  const startScanning = () => {
    if (intervalId) return;
    
    console.log("Bắt đầu quét Ziga...");
    intervalId = setInterval(async () => {
      try {
        // 1. Gọi lệnh Rust để quét màn hình lấy chuỗi FEN
        const fen = await invoke<string>('scan_ziga_board');
        
        // 2. Kiểm tra nếu FEN hợp lệ và khác với bàn cờ hiện tại
        if (fen && fen.includes('/') && fen !== gameState.currentFen.value) {
            console.log("Phát hiện thay đổi từ Ziga:", fen);
            
            // 3. Cập nhật bàn cờ SW y hệt Ziga
            gameState.loadFen(fen);
            
            // (Tùy chọn) Tự động bật phân tích nếu chưa bật
            // if (!gameState.isThinking.value) {
            //    gameState.analyze(); 
            // }
        }
      } catch (error) {
        // Lỗi này thường do chưa mở MuMu hoặc sai tọa độ
        console.error("Lỗi Auto Ziga (kiểm tra MuMu/Tọa độ):", error);
      }
    }, 1000); // Quét mỗi 1 giây (đủ nhanh và nhẹ máy)
  };

  // Hàm dừng quét
  const stopScanning = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    console.log("Đã dừng quét Ziga.");
  };

  // Hàm bật/tắt (dùng cho nút bấm)
  const toggleAuto = () => {
    isAutoActive.value = !isAutoActive.value;
    if (isAutoActive.value) {
      startScanning();
    } else {
      stopScanning();
    }
  };

  // Tự động tắt khi đóng bàn cờ
  onUnmounted(() => {
    stopScanning();
  });

  return {
    isAutoActive,
    toggleAuto
  };
}