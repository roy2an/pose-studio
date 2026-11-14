<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import Icon from './Icon.vue'
import {
  state,
  selectBone,
  hoverBone,
  toggleCollapse,
  expandAll,
  collapseAll,
} from '../store.js'
import { pickLabel, t } from '../i18n.js'

const listEl = ref(null)

const isExpand = ref(true)

const childrenMap = computed(() => {
  const map = new Map()
  map.set(null, [])
  for (const b of state.bones) {
    if (b.nub && !state.showNubs) continue
    const key = b.parentId
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(b)
  }
  return map
})

const rows = computed(() => {
  const q = state.search.trim().toLowerCase()
  if (q) {
    return state.bones
      .filter(
        (b) =>
          (!b.nub || state.showNubs) &&
          ((b.label || '').toLowerCase().includes(q) ||
            (b.labelEn || '').toLowerCase().includes(q) ||
            (b.jointId || '').toLowerCase().includes(q)),
      )
      .map((b) => ({ ...b, depth: 0, hasChildren: false }))
  }
  const out = []
  const walk = (parentId, depth) => {
    const kids = childrenMap.value.get(parentId) || []
    for (const b of kids) {
      const grand = childrenMap.value.get(b.id) || []
      out.push({ ...b, depth, hasChildren: grand.length > 0 })
      if (!state.collapsed[b.id]) walk(b.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
})

watch(
  () => state.selectedId,
  async () => {
    await nextTick()
    const el = listEl.value?.querySelector('.row.is-selected')
    el?.scrollIntoView({ block: 'nearest' })
  },
)

function onSelect(row) {
  selectBone(row.id)
}

function toggleExpand() {
  isExpand.value = !isExpand.value
  if (isExpand.value) {
    expandAll()
  } else {
    collapseAll()
  }
}
</script>

<template>
  <aside class="panel bone-panel">
    <div class="panel-head">
      <span class="panel-title">{{ t('tree.title') }}</span>
      <span class="count">{{ rows.length }}</span>
      <div class="spacer"></div>
      <button
        class="btn icon btn-sm"
        :title="isExpand ? t('tree.collapseAll') : t('tree.expandAll')"
        @click="toggleExpand"
      >
        <Icon v-if="!isExpand" name="expand" :size="14" />
        <Icon v-else name="collapse" :size="14" />
      </button>
    </div>

    <div class="search-wrap">
      <Icon name="search" :size="14" class="search-icon" />
      <input
        v-model="state.search"
        class="field search"
        type="text"
        :placeholder="t('tree.search')"
        spellcheck="false"
      />
      <button
        v-if="state.search"
        class="clear"
        :title="t('tree.clearSearch')"
        @click="state.search = ''"
      >
        <Icon name="close" :size="12" />
      </button>
    </div>

    <div ref="listEl" class="tree" @mouseleave="hoverBone(null)">
      <div
        v-for="row in rows"
        :key="row.id"
        class="row"
        :class="{
          'is-selected': row.id === state.selectedId,
          'is-hovered': row.id === state.hoveredId && row.id !== state.selectedId,
          'is-nub': row.nub,
        }"
        :style="{ paddingLeft: 6 + row.depth * 13 + 'px' }"
        :title="row.name"
        @click="onSelect(row)"
        @dblclick="selectBone(row.id, true)"
        @mouseenter="hoverBone(row.id)"
      >
        <button
          v-if="row.hasChildren"
          class="caret"
          @click.stop="toggleCollapse(row.id)"
        >
          <Icon v-if="state.collapsed[row.id]" name="arr-right" :size="12" />
          <Icon v-else name="arr-down" :size="12" />
        </button>
        <span v-else class="caret-space"></span>
        <span class="side-dot" :class="row.side"></span>
        <span class="label">{{ pickLabel(row) }}</span>
      </div>

      <div v-if="!rows.length" class="empty">{{ t('tree.empty') }}</div>
    </div>

    <div class="panel-foot">
      <label class="toggle">
        <input v-model="state.showNubs" type="checkbox" />
        <span>{{ t('tree.showNubs') }}</span>
      </label>
      <span class="stat">{{ t('tree.count', { n: state.boneCount }) }}</span>
    </div>
  </aside>
</template>

<style scoped>
.bone-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--panel);
  border-right: 1px solid var(--border);
}

.panel-head {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 8px 0 12px;
  border-bottom: 1px solid var(--border-soft);
  flex: none;
}
.panel-title {
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

.search-wrap {
  position: relative;
  padding: 8px 10px;
  flex: none;
  border-bottom: 1px solid var(--border-soft);
}
.search {
  padding-left: 28px;
  padding-right: 26px;
}
.search-icon {
  position: absolute;
  left: 19px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-mute);
  pointer-events: none;
}
.clear {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  color: var(--text-mute);
}
.clear:hover {
  background: var(--panel-3);
  color: var(--text);
}

.tree {
  flex: 1;
  overflow-y: auto;
  padding: 6px 6px 12px;
  min-height: 0;
}

.row {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding-right: 6px;
  border-radius: 5px;
  color: var(--text-dim);
  cursor: pointer;
  user-select: none;
  font-size: 12.5px;
  white-space: nowrap;
}
.row:hover {
  background: var(--panel-2);
  color: var(--text);
}
.row.is-hovered {
  background: rgba(91, 141, 255, 0.1);
  color: var(--text);
}
.row.is-selected {
  background: linear-gradient(90deg, rgba(91, 141, 255, 0.26), rgba(91, 141, 255, 0.12));
  color: #eaf0ff;
  box-shadow: inset 0 0 0 1px rgba(91, 141, 255, 0.3);
}
.row.is-nub .label {
  color: var(--text-mute);
  font-size: 11.5px;
}
.row.is-nub.is-selected .label {
  color: #eaf0ff;
}

.caret {
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  color: var(--text-mute);
  transition: transform 0.12s ease;
  flex: none;
  padding: 0;
}
.caret:hover {
  color: var(--text);
}
.caret.collapsed {
  transform: rotate(0deg);
}
.caret-space {
  width: 14px;
  flex: none;
}

.label {
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty {
  padding: 24px 12px;
  text-align: center;
  color: var(--text-mute);
  font-size: 12px;
}

.panel-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 34px;
  padding: 0 12px;
  border-top: 1px solid var(--border-soft);
  flex: none;
  font-size: 11.5px;
  color: var(--text-mute);
}
.toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}
.toggle input {
  accent-color: var(--accent);
  width: 12px;
  height: 12px;
}
</style>
