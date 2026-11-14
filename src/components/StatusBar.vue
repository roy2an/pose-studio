<script setup>
import { computed } from 'vue'
import { state, selectedBoneData } from '../store.js'
import { pickLabel, t } from '../i18n.js'

const pathText = computed(() => {
  if (!selectedBoneData.value) return t('status.noSelection')
  const names = []
  let cur = selectedBoneData.value
  let guard = 0
  while (cur && guard++ < 20) {
    names.unshift(pickLabel(cur))
    cur = cur.parentId ? state.bones.find((b) => b.id === cur.parentId) : null
  }
  return names.join(' › ')
})

/** 历史标签可能是字符串，也可能是跟随语言的函数 */
const historyText = computed(() => {
  const label = state.historyLabel
  return typeof label === 'function' ? label() : label || ''
})
</script>

<template>
  <footer class="statusbar">
    <div class="group">
      <span class="item"><span class="k">{{ t('status.model') }}</span>{{ state.modelName || '—' }}</span>
      <span class="sep"></span>
      <span class="item"><span class="k">{{ t('status.joints') }}</span>{{ state.boneCount }}</span>
      <span class="sep"></span>
      <span class="item"><span class="k">{{ t('status.current') }}</span><span class="path">{{ pathText }}</span></span>
    </div>

    <div class="group right">
      <span class="hint-text">{{ t('status.hint') }}</span>
      <span class="sep"></span>
      <span class="badge" :class="state.dirty ? 'dirty' : 'clean'">
        <span class="pulse"></span>
        {{ state.dirty ? t('status.dirty') : t('status.clean') }}
      </span>
      <span v-if="state.dirty && historyText" class="history">{{ historyText }}</span>
    </div>
  </footer>
</template>

<style scoped>
.statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 28px;
  padding: 0 12px;
  background: var(--panel);
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-mute);
  overflow: hidden;
  white-space: nowrap;
}
.group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.group.right {
  flex: none;
}
.item {
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.k {
  color: var(--text-mute);
}
.path {
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 320px;
}
.sep {
  width: 1px;
  height: 11px;
  background: var(--border);
  flex: none;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
}
.pulse {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--text-mute);
}
.badge.dirty {
  color: #ffc46b;
}
.badge.dirty .pulse {
  background: #ffb454;
  box-shadow: 0 0 7px rgba(255, 180, 84, 0.8);
}
.badge.clean .pulse {
  background: #4ade80;
  box-shadow: 0 0 7px rgba(74, 222, 128, 0.55);
}

.history {
  color: var(--text-mute);
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 1100px) {
  .hint-text {
    display: none;
  }
}
</style>
