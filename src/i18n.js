/**
 * 极简 i18n：中文 / English 双语界面。
 *
 * - 静态文案：t('inspector.presets', { name, n })（读 locale，模板 / computed 里自动响应）
 * - 数据自带的中英标签（关节、动作、预设、手势）：数据里同时写 label 与 labelEn，
 *   渲染时用 pickLabel(item) 取当前语言
 * - 选择存在 localStorage，切换时同步 <html lang> 与页面标题
 */
import { ref } from 'vue'

const STORAGE_KEY = 'pose-studio.locale'

export const LOCALES = ['zh', 'en']

const DOC_TITLE = {
  zh: 'Pose Studio — 角色姿势编辑器',
  en: 'Pose Studio — Character Pose Editor',
}

function readStored() {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (LOCALES.includes(saved)) return saved
  } catch {
    /* 隐私模式等场景忽略 */
  }
  return 'zh'
}

export const locale = ref(readStored())

function applyDocument(lang) {
  if (typeof document === 'undefined') return
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN'
  document.title = DOC_TITLE[lang]
}

applyDocument(locale.value)

export function setLocale(next) {
  if (!LOCALES.includes(next)) return
  locale.value = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* 忽略存储失败 */
  }
  applyDocument(next)
}

export function toggleLocale() {
  setLocale(locale.value === 'zh' ? 'en' : 'zh')
}

const messages = {
  zh: {
    app: {
      subtitle: '角色姿势编辑器',
      hudHint: '点选部位 · 右侧滑杆调关节 · 空白处旋转视角',
      frameAll: '视角归位',
      loadFailed: '模型加载失败',
      loadFailedHint: '请确认 models/ue-mannequin-retopology.glb 存在，或重新加载页面。',
      reload: '重新加载',
      loading: '正在加载角色模型…',
    },
    topbar: {
      loadModel: '点击载入本地 .glb 模型',
      undo: '撤销 (⌘Z)',
      redo: '重做 (⇧⌘Z)',
      skeleton: '显示骨架 (B)',
      grid: '显示网格地面 (G)',
      focus: '聚焦选中关节 (F)',
      resetAll: '恢复初始姿势',
      screenshot: '保存 PNG 截图',
      help: '快捷键与说明',
      language: '切换语言',
    },
    tree: {
      title: '关节层级',
      expandAll: '全部展开',
      collapseAll: '全部收起',
      search: '搜索关节…',
      clearSearch: '清除搜索',
      empty: '没有匹配的关节',
      showNubs: '显示末端节点',
      count: '{n} 根',
    },
    inspector: {
      presets: '姿势预设',
      ground: '贴地',
      groundTitle: '把角色对齐到地面',
      jointAdjust: '关节调整',
      focusTitle: '聚焦该关节 (F)',
      resetTitle: '重置该关节',
      emptyState: '在视图中点击角色，或从左侧关节列表里选一个部位开始摆姿势。',
      gesture: '手势',
      gestureNote: '{side} · 只改手指，不影响手臂姿势',
      leftHand: '左手',
      rightHand: '右手',
      sliderHint: '滑杆实时生效，松开后记入历史；右侧数字框可直接输入后回车。',
      noJoint: '这个节点没有可动控制项，只用来定位骨架（例如整体根节点或末端骨骼）。',
      zero: '归零',
      applyPreset: '套用预设：{name}',
      applyGesture: '套用手势：{name}',
    },
    status: {
      noSelection: '未选中关节',
      model: '模型',
      joints: '关节',
      current: '当前',
      hint: '点选部位 · 右侧滑杆调整关节',
      dirty: '已修改',
      clean: '初始姿势',
    },
    json: {
      title: '修改数据',
      count: '{n} 项',
      copy: '复制为姿势 JSON',
      commands: '复制为骨骼指令流（世界轴 + 角度，父先子后重放即可还原）',
      download: '下载姿势 JSON',
      import: '导入姿势 JSON',
    },
    help: {
      title: '使用说明',
      close: '关闭',
      lead: '在视图中点击角色的任意部位即可选中关节；所有编辑都在右侧面板完成——「抬臂 / 屈肘 / 屈膝」这类语义滑杆，或用姿势预设一键套用。',
      keys: { click: '左键', drag: '拖拽', slider: '滑杆' },
      shortcuts: {
        pick: '点击角色或骨架关节，选中对应部位',
        orbit: '空白处拖拽旋转视角，滚轮缩放',
        slider: '在右侧面板拖动语义滑杆调整关节，数字框可输入后回车',
        focus: '聚焦选中的关节',
        skeleton: '显示 / 隐藏骨架',
        grid: '显示 / 隐藏地面网格',
        escape: '取消选中',
        undo: '撤销上一步',
        redo: '重做',
      },
      tips: {
        dataTitle: '修改数据',
        dataDesc: '右栏底部实时以 JSON 列出所有被改动过的关节，可复制或下载成姿势文件。',
        mirrorTitle: '镜像',
        mirrorDesc: '一键把当前姿势左右翻转，适合快速做出对称动作。',
        undoTitle: '撤销',
        undoDesc: '每次拖拽结束、滑杆确认、应用姿势都会记录一步历史。',
      },
    },
    toast: {
      selectGlb: '请选择 .glb 模型文件',
      loaded: '已载入 {name}',
      loadFailed: '模型载入失败',
      appliedPreset: '已应用预设「{name}」',
      appliedGesture: '已应用手势「{name}」',
      grounded: '已对齐地面',
      boneReset: '已重置当前骨骼',
      poseReset: '已恢复初始姿势',
      mirrored: '已镜像左右姿势',
      noCommands: '当前没有改动，指令流为空',
      commandsCopied: '已复制 {n} 条骨骼指令',
      copyFailed: '复制失败，请改用下载',
      poseCopied: '姿势 JSON 已复制到剪贴板',
      poseDownloaded: '已下载姿势 JSON',
      poseImported: '姿势已导入',
      importFailed: '导入失败',
      shotSaved: '已保存截图',
      shotFailed: '截图失败',
    },
    history: {
      adjust: '调整姿势',
      preset: '预设：{name}',
      gesture: '手势：{name}',
      ground: '贴地修正',
      resetBone: '重置当前骨骼',
      resetPose: '重置姿势',
      mirror: '镜像姿势',
      import: '导入姿势',
      initial: '初始姿势',
      zeroControl: '{name}归零',
    },
    error: {
      noSkinnedMesh: '模型中没有找到蒙皮网格 (SkinnedMesh)',
    },
  },

  en: {
    app: {
      subtitle: 'Character Pose Editor',
      hudHint: 'Click a body part · adjust joints with the sliders on the right · drag empty space to orbit',
      frameAll: 'Frame the character',
      loadFailed: 'Failed to load the model',
      loadFailedHint: 'Make sure models/ue-mannequin-retopology.glb exists, then reload the page.',
      reload: 'Reload',
      loading: 'Loading character model…',
    },
    topbar: {
      loadModel: 'Load a local .glb model',
      undo: 'Undo (⌘Z)',
      redo: 'Redo (⇧⌘Z)',
      skeleton: 'Toggle skeleton (B)',
      grid: 'Toggle ground grid (G)',
      focus: 'Focus selected joint (F)',
      resetAll: 'Reset to the initial pose',
      screenshot: 'Save PNG screenshot',
      help: 'Shortcuts & help',
      language: 'Switch language',
    },
    tree: {
      title: 'Joint hierarchy',
      expandAll: 'Expand all',
      collapseAll: 'Collapse all',
      search: 'Search joints…',
      clearSearch: 'Clear search',
      empty: 'No matching joints',
      showNubs: 'Show end nodes',
      count: '{n} bones',
    },
    inspector: {
      presets: 'Pose presets',
      ground: 'Ground',
      groundTitle: 'Snap the character to the ground',
      jointAdjust: 'Joint controls',
      focusTitle: 'Focus this joint (F)',
      resetTitle: 'Reset this joint',
      emptyState: 'Click the character in the viewport, or pick a body part in the joint tree to start posing.',
      gesture: 'Gesture',
      gestureNote: '{side} · fingers only, arm pose unchanged',
      leftHand: 'Left hand',
      rightHand: 'Right hand',
      sliderHint: 'Sliders apply live and are recorded in history on release; type a value in the number box and press Enter.',
      noJoint: 'This node has no editable controls — it only anchors the skeleton (e.g. the root or an end bone).',
      zero: 'Zero',
      applyPreset: 'Apply preset: {name}',
      applyGesture: 'Apply gesture: {name}',
    },
    status: {
      noSelection: 'No joint selected',
      model: 'Model',
      joints: 'Joints',
      current: 'Current',
      hint: 'Click a body part · adjust joints on the right',
      dirty: 'Modified',
      clean: 'Initial pose',
    },
    json: {
      title: 'Changed data',
      count: '{n} entries',
      copy: 'Copy as pose JSON',
      commands: 'Copy as bone command stream (world axis + degrees, parent-first replay)',
      download: 'Download pose JSON',
      import: 'Import pose JSON',
    },
    help: {
      title: 'How to use',
      close: 'Close',
      lead: 'Click any part of the character in the viewport to select a joint. All editing happens in the right panel — semantic sliders such as “raise arm / bend elbow / bend knee”, or one-click pose presets.',
      keys: { click: 'Click', drag: 'Drag', slider: 'Slider' },
      shortcuts: {
        pick: 'Click the character or a skeleton joint to select that part',
        orbit: 'Drag empty space to orbit, scroll to zoom',
        slider: 'Drag a semantic slider on the right, or type a number and press Enter',
        focus: 'Focus the selected joint',
        skeleton: 'Show / hide the skeleton overlay',
        grid: 'Show / hide the ground grid',
        escape: 'Clear the selection',
        undo: 'Undo the last step',
        redo: 'Redo',
      },
      tips: {
        dataTitle: 'Changed data',
        dataDesc: 'The bottom of the right panel lists every edited joint as live JSON — copy or download it as a pose file.',
        mirrorTitle: 'Mirror',
        mirrorDesc: 'Flip the current pose left/right in one click — handy for symmetrical poses.',
        undoTitle: 'Undo',
        undoDesc: 'Every slider release, confirmed value and applied pose records a history step.',
      },
    },
    toast: {
      selectGlb: 'Please choose a .glb model file',
      loaded: 'Loaded {name}',
      loadFailed: 'Failed to load the model',
      appliedPreset: 'Applied preset “{name}”',
      appliedGesture: 'Applied gesture “{name}”',
      grounded: 'Aligned to the ground',
      boneReset: 'Joint reset',
      poseReset: 'Restored the initial pose',
      mirrored: 'Mirrored the pose left/right',
      noCommands: 'No changes yet — the command stream is empty',
      commandsCopied: 'Copied {n} bone commands',
      copyFailed: 'Copy failed — use Download instead',
      poseCopied: 'Pose JSON copied to the clipboard',
      poseDownloaded: 'Pose JSON downloaded',
      poseImported: 'Pose imported',
      importFailed: 'Import failed',
      shotSaved: 'Screenshot saved',
      shotFailed: 'Screenshot failed',
    },
    history: {
      adjust: 'Adjust pose',
      preset: 'Preset: {name}',
      gesture: 'Gesture: {name}',
      ground: 'Ground fix',
      resetBone: 'Reset joint',
      resetPose: 'Reset pose',
      mirror: 'Mirror pose',
      import: 'Import pose',
      initial: 'Initial pose',
      zeroControl: 'Zero {name}',
    },
    error: {
      noSkinnedMesh: 'No SkinnedMesh found in the model',
    },
  },
}

function lookup(dict, key) {
  let cur = dict
  for (const part of key.split('.')) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = cur[part]
  }
  return typeof cur === 'string' ? cur : undefined
}

/** 取当前语言的文案；缺 key 时回退中文，再回退 key 本身 */
export function t(key, params) {
  const raw = lookup(messages[locale.value], key) ?? lookup(messages.zh, key) ?? key
  if (!params) return raw
  return raw.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] === undefined ? match : String(params[name]),
  )
}

/**
 * 数据自带的中英文标签：中文放在 `label` / `hint`，英文放在 `labelEn` / `hintEn`。
 * 英文缺失时回退中文，保证任何时候都不会渲染出空白。
 */
export function pickLabel(item, field = 'label') {
  if (!item) return ''
  const zh = item[field]
  const en = item[`${field}En`]
  return locale.value === 'en' ? en ?? zh ?? '' : zh ?? en ?? ''
}
