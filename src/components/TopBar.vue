<script setup>
import { ref } from 'vue'
import Icon from './Icon.vue'
import {
  state,
  toggleSkeleton,
  toggleGrid,
  undo,
  redo,
  resetAll,
  mirrorPose,
  downloadScreenshot,
  focusSelected,
  loadModelFile,
} from '../store.js'
import { locale, setLocale, t } from '../i18n.js'

const modelInput = ref(null)

function pickModel() {
  modelInput.value?.click()
}

async function onModelFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (file) await loadModelFile(file)
}
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <div class="logo">
        <Icon name="spine" :size="17" />
      </div>
      <div class="brand-text">
        <span class="title">Pose Studio</span>
        <span class="sub">{{ t('app.subtitle') }}</span>
      </div>
    </div>

    <button
      v-if="state.modelName"
      class="model-chip"
      :title="t('topbar.loadModel')"
      @click="pickModel"
    >
      <span class="dot"></span>
      <span class="chip-name">{{ state.modelName }}</span>
      <Icon name="upload" :size="12" />
    </button>
    <input
      ref="modelInput"
      type="file"
      accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
      hidden
      @change="onModelFile"
    />

    <div class="spacer"></div>

    <div class="tools">
      <button class="btn icon" :title="t('topbar.undo')" :disabled="!state.canUndo" @click="undo">
        <Icon name="undo" />
      </button>
      <button class="btn icon" :title="t('topbar.redo')" :disabled="!state.canRedo" @click="redo">
        <Icon name="redo" />
      </button>

      <div class="divider"></div>

      <div class="divider"></div>

      <button
        class="btn icon"
        :class="{ 'is-active': state.showSkeleton }"
        :title="t('topbar.skeleton')"
        @click="toggleSkeleton"
      >
        <Icon name="bones" />
      </button>
      <button
        class="btn icon"
        :class="{ 'is-active': state.showGrid }"
        :title="t('topbar.grid')"
        @click="toggleGrid"
      >
        <Icon name="grid" />
      </button>
      <button class="btn icon" :title="t('topbar.focus')" @click="focusSelected">
        <Icon name="target" />
      </button>

      <div class="divider"></div>

      <button class="btn icon" :title="t('topbar.resetAll')" @click="resetAll">
        <Icon name="reset" />
      </button>

      <div class="divider"></div>

      <button class="btn icon" :title="t('topbar.screenshot')" @click="downloadScreenshot">
        <Icon name="camera" />
      </button>
      <button class="btn icon" :title="t('topbar.help')" @click="state.helpOpen = true">
        <Icon name="help" />
      </button>

      <div class="divider"></div>

      <div class="segmented lang-switch" role="group" :title="t('topbar.language')">
        <button class="btn" :class="{ 'is-active': locale === 'zh' }" @click="setLocale('zh')">
          中文
        </button>
        <button class="btn" :class="{ 'is-active': locale === 'en' }" @click="setLocale('en')">
          EN
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 54px;
  padding: 0 14px;
  background: linear-gradient(180deg, #131926, #0f141d);
  border-bottom: 1px solid var(--border);
  position: relative;
  z-index: 10;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}
.logo {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  color: #a9c6ff;
  background: linear-gradient(150deg, rgba(91, 141, 255, 0.35), rgba(91, 141, 255, 0.08));
  border: 1px solid rgba(91, 141, 255, 0.28);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}
.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}
.title {
  font-size: 13.5px;
  font-weight: 650;
  letter-spacing: 0.3px;
}
.sub {
  font-size: 10.5px;
  color: var(--text-mute);
  letter-spacing: 0.4px;
}

.model-chip {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 9px;
  font-size: 11.5px;
  color: var(--text-dim);
  background: var(--panel-2);
  border: 1px solid var(--border-soft);
  border-radius: 20px;
  max-width: 260px;
  overflow: hidden;
  white-space: nowrap;
  transition: background 0.14s ease, border-color 0.14s ease, color 0.14s ease;
}
.model-chip:hover {
  background: var(--panel-3);
  border-color: var(--border);
  color: var(--text);
}
.chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.model-chip .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 8px rgba(74, 222, 128, 0.7);
  flex: none;
}

.spacer {
  flex: 1;
}

.tools {
  display: flex;
  align-items: center;
  gap: 2px;
}
@media (max-width: 1180px) {
  .model-chip {
    display: none;
  }
}
@media (max-width: 900px) {
  .brand-text .sub {
    display: none;
  }
}
</style>
