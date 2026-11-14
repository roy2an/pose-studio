<script setup>
import { computed } from 'vue'
import Icon from './Icon.vue'
import { state } from '../store.js'
import { t } from '../i18n.js'

const shortcuts = computed(() => [
  { keys: [t('help.keys.click')], desc: t('help.shortcuts.pick') },
  { keys: [t('help.keys.drag')], desc: t('help.shortcuts.orbit') },
  { keys: [t('help.keys.slider')], desc: t('help.shortcuts.slider') },
  { keys: ['F'], desc: t('help.shortcuts.focus') },
  { keys: ['B'], desc: t('help.shortcuts.skeleton') },
  { keys: ['G'], desc: t('help.shortcuts.grid') },
  { keys: ['Esc'], desc: t('help.shortcuts.escape') },
  { keys: ['⌘', 'Z'], desc: t('help.shortcuts.undo') },
  { keys: ['⇧', '⌘', 'Z'], desc: t('help.shortcuts.redo') },
])
</script>

<template>
  <Transition name="fade">
    <div v-if="state.helpOpen" class="overlay" @click.self="state.helpOpen = false">
      <div class="dialog">
        <header>
          <h2>{{ t('help.title') }}</h2>
          <button class="btn icon" :title="t('help.close')" @click="state.helpOpen = false">
            <Icon name="close" />
          </button>
        </header>

        <p class="lead">
          {{ t('help.lead') }}
        </p>

        <ul class="shortcuts">
          <li v-for="(s, i) in shortcuts" :key="i">
            <span class="keys">
              <kbd v-for="(k, j) in s.keys" :key="j" class="kbd">{{ k }}</kbd>
            </span>
            <span class="desc">{{ s.desc }}</span>
          </li>
        </ul>

        <div class="tips">
          <div class="tip">
            <strong>{{ t('help.tips.dataTitle') }}</strong>
            <span>{{ t('help.tips.dataDesc') }}</span>
          </div>
          <div class="tip">
            <strong>{{ t('help.tips.mirrorTitle') }}</strong>
            <span>{{ t('help.tips.mirrorDesc') }}</span>
          </div>
          <div class="tip">
            <strong>{{ t('help.tips.undoTitle') }}</strong>
            <span>{{ t('help.tips.undoDesc') }}</span>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  background: rgba(6, 8, 12, 0.62);
  backdrop-filter: blur(3px);
}
.dialog {
  width: min(520px, calc(100vw - 40px));
  max-height: calc(100vh - 80px);
  overflow-y: auto;
  padding: 18px 20px 20px;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 650;
}
.lead {
  margin: 10px 0 16px;
  font-size: 12.5px;
  line-height: 1.75;
  color: var(--text-dim);
}
.shortcuts {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.shortcuts li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 4px;
  border-radius: 6px;
}
.shortcuts li:nth-child(odd) {
  background: rgba(255, 255, 255, 0.02);
}
.keys {
  display: flex;
  gap: 4px;
  flex: none;
  min-width: 92px;
  justify-content: flex-end;
}
.desc {
  font-size: 12px;
  color: var(--text-dim);
}
.tips {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border-soft);
}
.tip {
  display: flex;
  gap: 10px;
  font-size: 11.5px;
  line-height: 1.65;
  color: var(--text-mute);
}
.tip strong {
  color: var(--text-dim);
  font-weight: 600;
  flex: none;
  min-width: 40px;
}
</style>
