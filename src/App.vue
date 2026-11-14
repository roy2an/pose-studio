<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import TopBar from './components/TopBar.vue'
import BoneTree from './components/BoneTree.vue'
import Inspector from './components/Inspector.vue'
import StatusBar from './components/StatusBar.vue'
import HelpDialog from './components/HelpDialog.vue'
import Icon from './components/Icon.vue'
import {
  state,
  initEditor,
  disposeEditor,
  selectBone,
  undo,
  redo,
  toggleSkeleton,
  toggleGrid,
  focusSelected,
  frameAll,
  applyPosePreset,
} from './store.js'
import { MANNEQUIN_POSE_PRESETS } from './pose.js'
import { t } from './i18n.js'

const viewportEl = ref(null)

function reloadPage() {
  window.location.reload()
}

function onKeydown(e) {
  const target = e.target
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target?.isContentEditable
  ) {
    if (e.key === 'Escape') target.blur()
    return
  }

  const mod = e.metaKey || e.ctrlKey
  const key = e.key.toLowerCase()

  if (mod && key === 'z') {
    e.preventDefault()
    e.shiftKey ? redo() : undo()
    return
  }
  if (mod && key === 'y') {
    e.preventDefault()
    redo()
    return
  }
  if (mod) return

  switch (key) {
    case 'f':
      focusSelected()
      break
    case 'b':
      toggleSkeleton()
      break
    case 'g':
      toggleGrid()
      break
    case 'escape':
      if (state.helpOpen) state.helpOpen = false
      else selectBone(null)
      break
    case '?':
      state.helpOpen = !state.helpOpen
      break
  }
}

onMounted(() => {
  initEditor(viewportEl.value)
  setTimeout(() => {
    const stand = MANNEQUIN_POSE_PRESETS.find((p) => p.id === 'stand')
    if (stand) applyPosePreset(stand)
  }, 200)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  disposeEditor()
})
</script>

<template>
  <div class="app">
    <TopBar />

    <main class="main">
      <BoneTree />

      <section class="viewport-wrap">
        <div ref="viewportEl" class="viewport"></div>

        <div class="hud hud-left">
          <div class="chip">
            <span class="chip-dot"></span>
            {{ t('app.hudHint') }}
          </div>
        </div>

        <div class="hud hud-right">
          <button class="hud-btn" :title="t('app.frameAll')" @click="frameAll">
            <Icon name="reset" :size="15" />
          </button>
        </div>

        <Transition name="fade">
          <div v-if="state.loading || (state.error && !state.ready)" class="loading">
            <div v-if="state.error" class="loading-box error">
              <div class="err-title">{{ t('app.loadFailed') }}</div>
              <p>{{ state.error }}</p>
              <p class="err-hint">{{ t('app.loadFailedHint') }}</p>
              <button class="btn ghost btn-sm retry" @click="reloadPage">{{ t('app.reload') }}</button>
            </div>
            <div v-else class="loading-box">
              <div class="spinner"></div>
              <div class="loading-text">{{ t('app.loading') }}</div>
              <div class="progress">
                <div
                  class="progress-bar"
                  :style="{ width: Math.max(8, Math.round(state.progress * 100)) + '%' }"
                ></div>
              </div>
            </div>
          </div>
        </Transition>

        <Transition name="fade">
          <div v-if="state.toast" :key="state.toast.id" class="toast" :class="state.toast.type">
            {{ state.toast.message }}
          </div>
        </Transition>
      </section>

      <Inspector />
    </main>

    <StatusBar />
    <HelpDialog />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  background: var(--bg);
}

.main {
  flex: 1;
  display: grid;
  grid-template-columns: 256px minmax(0, 1fr) 306px;
  min-height: 0;
}

.viewport-wrap {
  position: relative;
  min-width: 0;
  overflow: hidden;
  background:
    radial-gradient(ellipse 70% 55% at 50% 34%, #202a3b 0%, #151a25 46%, #0b0e14 100%);
}

.viewport {
  position: absolute;
  inset: 0;
}

.viewport :deep(canvas.viewport-canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
  outline: none;
  touch-action: none;
}

.hud {
  position: absolute;
  pointer-events: none;
  z-index: 3;
}
.hud-left {
  left: 14px;
  bottom: 12px;
}
.hud-right {
  right: 14px;
  top: 12px;
  pointer-events: auto;
}
.chip {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 11px;
  font-size: 11px;
  color: var(--text-mute);
  background: rgba(14, 18, 26, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 20px;
  backdrop-filter: blur(6px);
}
.chip-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #5b8dff;
  box-shadow: 0 0 8px rgba(91, 141, 255, 0.9);
}
.hud-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  color: var(--text-dim);
  background: rgba(14, 18, 26, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px;
  backdrop-filter: blur(6px);
  transition: color 0.14s ease, background 0.14s ease;
}
.hud-btn:hover {
  color: #fff;
  background: rgba(40, 52, 74, 0.8);
}

.loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(10, 13, 18, 0.72);
  backdrop-filter: blur(2px);
  z-index: 5;
}
.loading-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 22px 28px;
  border-radius: 14px;
  background: rgba(20, 26, 37, 0.85);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  min-width: 220px;
}
.loading-box.error {
  max-width: 420px;
  gap: 6px;
  text-align: center;
}
.err-title {
  color: #ff8f8f;
  font-weight: 650;
  font-size: 13px;
}
.loading-box p {
  margin: 0;
  font-size: 12px;
  color: var(--text-mute);
}
.spinner {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2.5px solid rgba(91, 141, 255, 0.22);
  border-top-color: #5b8dff;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.loading-text {
  font-size: 12px;
  color: var(--text-dim);
}
.progress {
  width: 170px;
  height: 3px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  border-radius: 3px;
  background: linear-gradient(90deg, #4f7dff, #7fb0ff);
  transition: width 0.2s ease;
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 52px;
  transform: translateX(-50%);
  padding: 7px 16px;
  font-size: 12px;
  color: #e8eeff;
  background: rgba(28, 38, 56, 0.94);
  border: 1px solid rgba(91, 141, 255, 0.32);
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
  z-index: 8;
  white-space: nowrap;
}
.toast.error {
  border-color: rgba(255, 107, 107, 0.42);
  color: #ffd7d7;
}

@media (max-width: 1120px) {
  .main {
    grid-template-columns: 220px minmax(0, 1fr) 286px;
  }
}
</style>
