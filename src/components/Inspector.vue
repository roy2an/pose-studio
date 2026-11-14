<script setup>
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import PoseJson from './PoseJson.vue'
import { MANNEQUIN_POSE_PRESETS, HAND_GESTURES } from '../pose.js'
import {
  state,
  selectedBoneData,
  editSemantic,
  commitSemantic,
  resetBone,
  focusSelected,
  applyPosePreset,
  applyHandGesture,
  groundPose,
} from '../store.js'
import { pickLabel, t } from '../i18n.js'

const showPresets = ref(true)

const bone = selectedBoneData
const semantic = computed(() => state.semantic)

const pathText = computed(() => {
  if (!bone.value) return ''
  const names = []
  let cur = bone.value
  let guard = 0
  while (cur && guard++ < 20) {
    names.unshift(pickLabel(cur))
    cur = cur.parentId ? state.bones.find((b) => b.id === cur.parentId) : null
  }
  return names.join(' › ')
})

const semanticKey = computed(() => semantic.value?.id || '')

/** 选中的是手腕关节时才显示手势按钮 */
const isHandJoint = computed(
  () => semanticKey.value === 'leftHand' || semanticKey.value === 'rightHand'
)
const handSideLabel = computed(() =>
  semanticKey.value === 'leftHand' ? t('inspector.leftHand') : t('inspector.rightHand'),
)

function onRangeInput(control, value) {
  editSemantic(control.key, value)
}
function onRangeCommit(control, value) {
  commitSemantic(control.key, value, () => pickLabel(control))
}
function onNumberCommit(control, event) {
  const v = Number(event.target.value)
  if (Number.isFinite(v)) {
    commitSemantic(control.key, v, () => pickLabel(control))
  } else {
    event.target.value = control.value
  }
}
function zeroControl(control) {
  commitSemantic(control.key, 0, () => t('history.zeroControl', { name: pickLabel(control) }))
}

function fmt(value, control) {
  return control.offset ? value.toFixed(2) : Math.round(value)
}
</script>

<template>
  <aside class="panel inspector">
    <section class="card preset-card">
      <div class="card-head preset-head">
        <Icon name="spine" :size="14" />
        <button class="preset-toggle" @click="showPresets = !showPresets">
          <span class="card-title">{{ t('inspector.presets') }}</span>
          <span class="count">{{ MANNEQUIN_POSE_PRESETS.length }}</span>
          <Icon name="chevron" :size="12" :class="{ rotated: showPresets }" />
        </button>
        <div class="spacer"></div>
        <button class="ground-btn" :title="t('inspector.groundTitle')" @click="groundPose">
          {{ t('inspector.ground') }}
        </button>
      </div>
      <div v-show="showPresets" class="preset-grid">
        <button
          v-for="preset in MANNEQUIN_POSE_PRESETS"
          :key="preset.id"
          class="preset"
          :title="t('inspector.applyPreset', { name: pickLabel(preset) })"
          @click="applyPosePreset(preset)"
        >
          {{ pickLabel(preset) }}
        </button>
      </div>
    </section>

    <section class="card transform-card">
      <div class="card-head">
        <Icon name="bones" :size="14" />
        <span class="card-title">{{ t('inspector.jointAdjust') }}</span>
        <div class="spacer"></div>
        <button
          class="btn btn-sm icon"
          :title="t('inspector.focusTitle')"
          :disabled="!bone"
          @click="focusSelected"
        >
          <Icon name="target" :size="14" />
        </button>
        <button class="btn btn-sm icon" :title="t('inspector.resetTitle')" :disabled="!bone" @click="resetBone">
          <Icon name="reset" :size="14" />
        </button>
      </div>

      <div v-if="!bone" class="empty-state">
        <div class="empty-icon"><Icon name="bones" :size="22" /></div>
        <p>{{ t('inspector.emptyState') }}</p>
      </div>

      <div v-else class="bone-info">
        <div class="bone-name">
          <span class="side-dot" :class="bone.side"></span>
          <span class="label">{{ pickLabel(bone) }}</span>
          <code v-if="semanticKey" class="raw">{{ semanticKey }}</code>
        </div>
        <div class="path" :title="pathText">{{ pathText }}</div>

        <template v-if="semantic">
          <p class="joint-hint">{{ pickLabel(semantic, 'hint') }}</p>

          <div v-for="control in semantic.controls" :key="control.key" class="control-row">
            <div class="control-head">
              <span class="control-label">{{ pickLabel(control) }}</span>
              <span class="control-key">{{ semantic.id }}.{{ control.key }}</span>
            </div>
            <div class="control-body">
              <input
                class="slider"
                type="range"
                :min="control.min"
                :max="control.max"
                :step="control.step"
                :value="control.value"
                @input="onRangeInput(control, $event.target.value)"
                @change="onRangeCommit(control, $event.target.value)"
              />
              <input
                class="num"
                type="number"
                :step="control.offset ? 0.01 : 1"
                :value="control.offset ? control.value.toFixed(2) : control.value"
                @change="onNumberCommit(control, $event)"
                @keydown.enter="$event.target.blur()"
              />
              <span class="unit">{{ control.unit }}</span>
              <button class="zero" :title="t('inspector.zero')" @click="zeroControl(control)">0</button>
            </div>
          </div>

          <div v-if="isHandJoint" class="gesture-block">
            <div class="gesture-head">
              <span class="control-label">{{ t('inspector.gesture') }}</span>
              <span class="gesture-note">{{ t('inspector.gestureNote', { side: handSideLabel }) }}</span>
            </div>
            <div class="preset-grid">
              <button
                v-for="gesture in HAND_GESTURES"
                :key="gesture.id"
                class="preset"
                :title="t('inspector.applyGesture', { name: pickLabel(gesture) })"
                @click="applyHandGesture(gesture)"
              >
                {{ pickLabel(gesture) }}
              </button>
            </div>
          </div>

          <p class="hint">
            {{ t('inspector.sliderHint') }}
          </p>
        </template>

        <p v-else class="hint no-joint">
          {{ t('inspector.noJoint') }}
        </p>
      </div>
    </section>

    <PoseJson />
  </aside>
</template>

<style scoped>
.inspector {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--panel);
  border-left: 1px solid var(--border);
  overflow-y: auto;
}

.card {
  border-bottom: 1px solid var(--border-soft);
  padding: 10px 12px 14px;
  flex: none;
}
.card-head {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 26px;
  margin-bottom: 6px;
  color: var(--text-mute);
}
.card-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.4px;
  color: var(--text-dim);
}
.spacer {
  flex: 1;
}
.count {
  font-size: 10.5px;
  color: var(--text-mute);
  background: var(--panel-2);
  border-radius: 20px;
  padding: 1px 7px;
}

.empty-state {
  padding: 20px 6px 22px;
  text-align: center;
  color: var(--text-mute);
  font-size: 12px;
  line-height: 1.7;
}
.empty-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  margin: 0 auto 10px;
  border-radius: 50%;
  background: var(--panel-2);
  border: 1px solid var(--border-soft);
  color: var(--text-mute);
}

.bone-info {
  margin-top: 2px;
}
.bone-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 600;
}
.bone-name .label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.raw {
  margin-left: auto;
  font-size: 10px;
  font-weight: 400;
  color: var(--text-mute);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: nowrap;
  background: var(--panel-2);
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  padding: 0 5px;
}
.path {
  margin-top: 2px;
  font-size: 10.5px;
  color: var(--text-mute);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.joint-hint {
  margin: 8px 0 2px;
  font-size: 11px;
  color: var(--text-mute);
}

.control-row {
  margin-top: 10px;
}
.control-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
}
.control-label {
  font-size: 11.5px;
  color: var(--text-dim);
}
.control-key {
  font-size: 9.5px;
  color: var(--text-mute);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.control-body {
  display: grid;
  grid-template-columns: 1fr 52px 12px 18px;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  height: 24px;
}

.num {
  height: 22px;
  width: 100%;
  padding: 0 4px;
  text-align: right;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 5px;
  outline: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  appearance: textfield;
}
.num::-webkit-outer-spin-button,
.num::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
.num:focus {
  border-color: rgba(91, 141, 255, 0.65);
}
.unit {
  font-size: 10px;
  color: var(--text-mute);
  text-align: center;
}

.zero {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  font-size: 10px;
  color: var(--text-mute);
  border: 1px solid var(--border-soft);
  line-height: 1;
}
.zero:hover {
  color: var(--text);
  background: var(--panel-3);
}

.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 4px;
  background: linear-gradient(90deg, #2a3346, #35415a);
  outline: none;
  cursor: pointer;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #dfe7f7;
  border: 2px solid #1a2130;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.18);
  transition: transform 0.1s ease;
}
.slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}
.slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #1a2130;
  background: #dfe7f7;
}

.gesture-block {
  margin-top: 14px;
  padding-top: 10px;
  border-top: 1px dashed var(--border-soft);
}
.gesture-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 6px;
}
.gesture-note {
  margin-left: auto;
  font-size: 9.5px;
  color: var(--text-mute);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hint {
  margin: 10px 0 0;
  font-size: 10.5px;
  line-height: 1.6;
  color: var(--text-mute);
}
.no-joint {
  margin-top: 12px;
}

.preset-card {
  padding-bottom: 12px;
}
.preset-head {
  width: 100%;
  margin-bottom: 4px;
}
.preset-toggle {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 22px;
  color: inherit;
}
.preset-toggle svg {
  transition: transform 0.14s ease;
}
.preset-toggle svg.rotated {
  transform: rotate(90deg);
}
.preset-grid {
  display: grid;
  /* 英文预设名比中文长，按可用宽度自动排 3～4 列 */
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 4px;
}
.ground-btn {
  font-size: 10.5px;
  color: var(--text-mute);
  padding: 1px 6px;
  border-radius: 5px;
  border: 1px solid var(--border-soft);
}
.ground-btn:hover {
  color: var(--text);
  background: var(--panel-3);
}

.preset {
  height: 26px;
  padding: 0 4px;
  font-size: 11.5px;
  color: var(--text-dim);
  background: var(--panel-2);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: background 0.14s ease, color 0.14s ease, border-color 0.14s ease;
}
.preset:hover {
  background: var(--panel-3);
  color: var(--text);
  border-color: var(--border);
}
.preset:active {
  transform: translateY(0.5px);
}
</style>
