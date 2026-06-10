<template>
  <!-- 独立全局弹窗：Teleport 到 body，z-index 99999 -->
  <Teleport to="body">
    <div
      v-if="visible"
      class="app-dialog-overlay"
      @click.self="closeOnClickOverlay && close()"
      @keydown.esc="closeOnEsc && close()"
    >
      <div
        class="app-dialog"
        :style="{
          width: typeof width === 'number' ? width + 'px' : width,
          maxWidth: 'calc(100vw - 40px)'
        }"
      >
        <!-- 标题栏 -->
        <div class="app-dialog-header">
          <span class="app-dialog-title">{{ title }}</span>
          <button class="app-dialog-close-btn" @click="close" type="button">✕</button>
        </div>

        <!-- 内容区：可滚动 -->
        <div class="app-dialog-body">
          <slot />
        </div>

        <!-- 底部按钮区 -->
        <div v-if="$slots.footer" class="app-dialog-footer">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: [Number, String], default: 480 },
  closeOnClickOverlay: { type: Boolean, default: true },
  closeOnEsc: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

function close() {
  emit('update:modelValue', false)
}

// ESC 键关闭
function onKeydown(e) {
  if (e.key === 'Escape' && props.closeOnEsc && props.modelValue) {
    close()
  }
}

watch(() => props.modelValue, val => {
  if (val) {
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<style scoped>
/* ─── 遮罩层 ─── */
.app-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow-y: auto;
}

/* ─── 对话框本体 ─── */
.app-dialog {
  background: var(--bg-primary);
  border: 1px solid var(--border-glass);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  width: 100%;
  animation: dialogIn 0.2s ease;
  position: relative;
}

@keyframes dialogIn {
  from { opacity: 0; transform: scale(0.95) translateY(-10px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

/* ─── 标题栏 ─── */
.app-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
  flex-shrink: 0;
}

.app-dialog-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.app-dialog-close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.app-dialog-close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* ─── 内容区 ─── */
.app-dialog-body {
  padding: 20px 24px;
  overflow-y: auto;
  overflow-x: hidden;
  flex: 1 1 auto;
  color: var(--text-primary);
}

/* ─── 底部 ─── */
.app-dialog-footer {
  padding: 0 24px 20px;
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
