import { reactive, shallowRef, computed } from 'vue'
import { PoseEditor } from './core/PoseEditor.js'
import { t, pickLabel } from './i18n.js'

export const state = reactive({
  loading: true,
  ready: false,
  error: '',
  progress: 0,
  progressVisible: false,
  modelName: '',
  bones: [],
  boneCount: 0,
  totalBones: 0,

  selectedId: null,
  hoveredId: null,
  semantic: null,
  /** 全部被改动过的关节数据（语义键 -> 数值） */
  controls: {},

  showSkeleton: true,
  showGrid: true,
  showNubs: false,

  canUndo: false,
  canRedo: false,
  dirty: false,
  historyLabel: '',

  search: '',
  collapsed: {},

  toast: null,
  helpOpen: false,
  autoGround: true,
})

export const editorRef = shallowRef(null)

let toastTimer = null
export function toast(message, type = 'info') {
  state.toast = { message, type, id: Date.now() }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (state.toast = null), 2200)
}

export const selectedBoneData = computed(() => {
  if (!state.selectedId) return null
  return state.bones.find((b) => b.id === state.selectedId) || null
})

export function initEditor(container) {
  const editor = new PoseEditor(container, {
    onProgress: (p) => {
      state.progress = p
      state.progressVisible = p > 0 && p < 1
    },
    onLoad: ({ boneData, modelName, boneCount, totalBones }) => {
      state.bones = boneData
      state.modelName = modelName
      state.boneCount = boneCount
      state.totalBones = totalBones
      state.ready = true
      state.loading = false
      state.progressVisible = false
      // 默认展开骨架
      state.collapsed = {}
    },
    onError: (err) => {
      state.error = err?.message || String(err)
      state.loading = false
    },
    onSelect: (id) => {
      state.selectedId = id
    },
    onTransform: ({ semantic, controls }) => {
      state.semantic = semantic
      state.controls = controls || {}
    },
    onHover: (id) => {
      state.hoveredId = id
    },
    onHistory: ({ canUndo, canRedo, dirty, label }) => {
      state.canUndo = canUndo
      state.canRedo = canRedo
      state.dirty = dirty
      state.historyLabel = label
    },
  })
  editorRef.value = editor
  if (import.meta.env.DEV) window.__poseEditor = editor
  editor.load().catch(() => {})
  return editor
}

export function disposeEditor() {
  editorRef.value?.dispose()
  editorRef.value = null
}

// ── 选择 / 视图 ──────────────────────────────────────────────

export function selectBone(id, focus = false) {
  editorRef.value?.selectById(id, { focus })
  if (id) {
    // 展开该骨骼的所有祖先
    let cur = state.bones.find((b) => b.id === id)
    while (cur?.parentId) {
      state.collapsed[cur.parentId] = false
      cur = state.bones.find((b) => b.id === cur.parentId)
    }
  }
}

/** 载入本地 .glb 模型 */
export async function loadModelFile(file) {
  const ed = editorRef.value
  if (!ed || !file) return
  if (!/\.(glb|gltf)$/i.test(file.name)) {
    toast(t('toast.selectGlb'), 'error')
    return
  }
  const prevError = state.error
  state.loading = true
  state.error = ''
  state.progress = 0
  const url = URL.createObjectURL(file)
  try {
    await ed.loadModel(url, file.name)
    state.selectedId = null
    toast(t('toast.loaded', { name: file.name }))
  } catch (err) {
    state.error = prevError
    toast(err?.message || t('toast.loadFailed'), 'error')
  } finally {
    URL.revokeObjectURL(url)
    state.loading = false
    state.progressVisible = false
  }
}

export function hoverBone(id) {
  const ed = editorRef.value
  if (!ed) return
  ed.setHovered(id ? ed.getBone(id) : null)
}

export function toggleSkeleton() {
  state.showSkeleton = !state.showSkeleton
  editorRef.value?.setShowSkeleton(state.showSkeleton)
}

export function toggleGrid() {
  state.showGrid = !state.showGrid
  editorRef.value?.setShowGrid(state.showGrid)
}

export function toggleCollapse(id) {
  state.collapsed[id] = !state.collapsed[id]
}

export function expandAll() {
  state.collapsed = {}
}

export function collapseAll() {
  const map = {}
  for (const b of state.bones) {
    if (!b.parentId) continue
    if (state.bones.some((c) => c.parentId === b.id)) map[b.id] = true
  }
  state.collapsed = map
}

export function focusSelected() {
  const ed = editorRef.value
  if (!ed) return
  if (ed.selected) ed.focusBone(ed.selected)
  else ed.frameAll()
}

export function frameAll() {
  editorRef.value?.frameAll()
}

// ── 编辑操作 ─────────────────────────────────────────────────

/** 拖动滑杆时实时应用（不写历史） */
export function editSemantic(key, value) {
  editorRef.value?.setSemanticValue(key, Number(value))
}

/**
 * 滑杆确认 / 输入框回车后写入历史。
 * label 可以是函数：历史标签会跟着界面语言切换。
 */
export function commitSemantic(key, value, label = () => t('history.adjust')) {
  const ed = editorRef.value
  if (!ed) return
  ed.setSemanticValue(key, Number(value))
  ed.commit(label)
}

/** 套用预设姿势 */
export function applyPosePreset(preset) {
  const ed = editorRef.value
  if (!ed || !preset) return
  ed.applySemanticMap(preset.controls)
  if (state.autoGround) ed.groundPose()
  ed.commit(() => t('history.preset', { name: pickLabel(preset) }))
  ed.syncUi()
  toast(t('toast.appliedPreset', { name: pickLabel(preset) }))
}

/** 套用手势（仅在选中手腕关节时可用），只改该侧手指 */
export function applyHandGesture(gesture) {
  const ed = editorRef.value
  const id = state.semantic?.id
  const side = id === 'leftHand' ? 'left' : id === 'rightHand' ? 'right' : null
  if (!ed || !gesture || !side) return
  ed.setHandGesture(side, gesture.fingers)
  ed.commit(() => t('history.gesture', { name: pickLabel(gesture) }))
  ed.syncUi()
  toast(t('toast.appliedGesture', { name: pickLabel(gesture) }))
}

/** 手动贴地 */
export function groundPose() {
  const ed = editorRef.value
  if (!ed) return
  ed.groundPose()
  ed.commit(() => t('history.ground'))
  toast(t('toast.grounded'))
}

export function resetBone() {
  const ed = editorRef.value
  if (!ed) return
  ed.resetBone()
  ed.commit(() => t('history.resetBone'))
  toast(t('toast.boneReset'))
}

export function resetAll() {
  const ed = editorRef.value
  if (!ed) return
  ed.resetAll()
  toast(t('toast.poseReset'))
}

export function mirrorPose() {
  const ed = editorRef.value
  if (!ed) return
  ed.mirrorPose()
  toast(t('toast.mirrored'))
}

export function undo() {
  editorRef.value?.undo()
}

export function redo() {
  editorRef.value?.redo()
}

// ── 导入 / 导出 ──────────────────────────────────────────────

export function exportPoseJson() {
  const ed = editorRef.value
  if (!ed) return null
  return JSON.stringify(ed.getPoseDoc(), null, 2)
}

/** 复制成骨骼指令流（世界轴 + 角度 / move 位移，父先子后重放即可还原） */
export async function copyCommands() {
  const ed = editorRef.value
  if (!ed) return
  const commands = ed.exportCommands()
  if (!commands.length) {
    toast(t('toast.noCommands'))
    return
  }
  try {
    await navigator.clipboard.writeText(JSON.stringify(commands, null, 2))
    toast(t('toast.commandsCopied', { n: commands.length }))
  } catch {
    toast(t('toast.copyFailed'), 'error')
  }
}

export async function copyPose() {
  const text = exportPoseJson()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    toast(t('toast.poseCopied'))
  } catch {
    toast(t('toast.copyFailed'), 'error')
  }
}

export function downloadPose() {
  const text = exportPoseJson()
  if (!text) return
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  a.href = url
  a.download = `pose-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast(t('toast.poseDownloaded'))
}

export async function importPoseFile(file) {
  const ed = editorRef.value
  if (!ed || !file) return
  try {
    const text = await file.text()
    const doc = JSON.parse(text)
    ed.applyPoseDoc(doc)
    toast(t('toast.poseImported'))
  } catch (err) {
    toast(err.message || t('toast.importFailed'), 'error')
  }
}

export function downloadScreenshot() {
  const ed = editorRef.value
  if (!ed) return
  try {
    const data = ed.captureImage({ mime: 'image/png' })
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    a.href = data
    a.download = `pose-${stamp}.png`
    a.click()
    toast(t('toast.shotSaved'))
  } catch {
    toast(t('toast.shotFailed'), 'error')
  }
}
