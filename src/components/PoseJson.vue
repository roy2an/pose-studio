<script setup>
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import {
  state,
  copyPose,
  copyCommands,
  downloadPose,
  importPoseFile,
} from '../store.js'
import { t } from '../i18n.js'

const fileInput = ref(null)
const copied = ref(false)

/** state.controls 是扁平的 语义键 -> 数值，这里按 JSON 的书写形式展开 */
const rows = computed(() =>
  Object.entries(state.controls || {}).map(([key, value]) => ({ key, value })),
)

const count = computed(() => rows.value.length)

async function onCopy() {
  await copyPose()
  copied.value = true
  setTimeout(() => (copied.value = false), 1400)
}

function pickFile() {
  fileInput.value?.click()
}

async function onFile(e) {
  const file = e.target.files?.[0]
  e.target.value = ''
  if (file) await importPoseFile(file)
}

function fmt(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}
</script>

<template>
  <section class="card json-card">
    <div class="card-head">
      <Icon name="copy" :size="14" />
      <span class="card-title">{{ t('json.title') }}</span>
      <span class="count">{{ t('json.count', { n: count }) }}</span>
      <div class="spacer"></div>
      <button class="btn icon btn-sm" :title="t('json.copy')" @click="onCopy">
        <Icon :name="copied ? 'check' : 'copy'" :size="14" />
      </button>
      <button
        class="btn icon btn-sm"
        :title="t('json.commands')"
        :disabled="!count"
        @click="copyCommands"
      >
        <Icon name="code" :size="14" />
      </button>
      <button class="btn icon btn-sm" :title="t('json.download')" @click="downloadPose">
        <Icon name="download" :size="14" />
      </button>
      <button class="btn icon btn-sm" :title="t('json.import')" @click="pickFile">
        <Icon name="upload" :size="14" />
      </button>
      <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onFile" />
    </div>

    <div class="json">
      <div v-if="count" class="code">
        <div class="line">{{ '{' }}</div>
        <div v-for="(row, i) in rows" :key="row.key" class="line indent">
          <span class="k">"{{ row.key }}"</span><span class="p">: </span><span class="n">{{ fmt(row.value) }}</span><span
            v-if="i < rows.length - 1"
            class="p"
          >,</span>
        </div>
        <div class="line">{{ '}' }}</div>
      </div>
      <div v-else class="json-empty">
        <div class="code line">{{ '{}' }}</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.json-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 10px 12px 12px;
}
.card-head {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 26px;
  color: var(--text-mute);
}
.card-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.4px;
  color: var(--text-dim);
}
.count {
  font-size: 10.5px;
  color: var(--text-mute);
  background: var(--panel-2);
  border-radius: 20px;
  padding: 1px 7px;
}
.spacer {
  flex: 1;
}

.json {
  margin-top: 8px;
  max-height: 320px;
  overflow: auto;
  padding: 8px 10px;
  background: #0d1119;
  border: 1px solid var(--border-soft);
  border-radius: 8px;
}
.code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11.5px;
  line-height: 1.75;
  color: var(--text-dim);
}
.line {
  white-space: pre;
}
.indent {
  padding-left: 2ch;
}
.k {
  color: #9ec0ff;
}
.p {
  color: #7b8799;
}
.n {
  color: #ffc46b;
}

.json-empty p {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 1.7;
  color: var(--text-mute);
  white-space: normal;
  font-family: inherit;
}

.hint {
  margin: 8px 0 0;
  font-size: 10.5px;
  line-height: 1.7;
  color: var(--text-mute);
}
.hint code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--text-dim);
}
</style>
