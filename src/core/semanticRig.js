/**
 * 语义骨骼层：把骨骼的局部四元数翻译成「关节 + 动作」的编辑方式，
 * 例如 leftShoulder.spread、leftElbow.bend。
 *
 * 算法与 storyai-3d-director-desk-main 完全一致
 *（src/editor/runtime/ue4Mannequin/ue4MannequinPoseApplication.ts + ue4MannequinRig.ts）：
 *
 *   bone.quaternion = 静止姿势 · 中性偏置 · Euler(x, y, z)   // three.js 默认 XYZ 顺序
 *
 * 每个关节的 (x, y, z) 由语义控制项换算，逐字对应 UE4 rig 里的
 * ue4SpineRotation / ue4ShoulderRotation / ue4HipRotation / ...：
 *
 *   骨盆 / 脊柱 / 躯干  [yaw,   roll,   -pitch]
 *   颈 / 头            [yaw,   roll,    pitch]
 *   肩                 [twist, spread, -pitch]
 *   髋                 [twist, -spread, pitch]
 *   肘 / 膝 / 趾 / 指  [0,     0,      -bend]
 *   手 / 脚            [twist, roll,    pitch]
 *
 * 所有角度统一 clamp 到 ±180°（storyai 的默认档是 ±90°，这里放宽到半圈，
 * 方便摆大幅度动作）。
 * 语义控制项与轴、正负号因此不再需要逐关节手工标定：左右两侧写一样的轴，
 * 数值的正负直接写进预设（T 型：leftShoulder.spread −70 / rightShoulder.spread +70）。
 */

import * as THREE from 'three'

const D2R = Math.PI / 180
const R2D = 180 / Math.PI

/**
 * 关节限幅（滑杆范围与 clamp 共用）。
 * storyai 的默认档（getBodyTypePoseLimit 不传体型）是 ±90°，这里放宽到 ±180°。
 */
export const LIMIT = 180

const AXIS_ORDER = ['x', 'y', 'z']

/** 轴映射：control key + 符号 */
const ax = (key, sign = 1) => ({ key, sign })

const ROTATE = { min: -LIMIT, max: LIMIT }

/**
 * 中性偏置：storyai getUE4NeutralPoseBoneRotations()。
 * 在静止姿势之后、语义控制之前前乘一次，让 GLB 的 A-pose 变成自然下垂。
 */
export const NEUTRAL_ROTATIONS = {
  leftShoulder: [0, 25, 0],
  rightShoulder: [0, -25, 0],
  leftElbow: [0, 0, 25],
  rightElbow: [0, 0, 25],
}

/** 关节定义。euler 是「语义控制项 → 欧拉分量」的映射，controls 是 UI 用的滑杆。 */
export const JOINTS = [
  {
    id: 'body',
    label: '骨盆',
    labelEn: 'Pelvis',
    hint: '整体前倾 / 转身 / 侧倾，以及上下蹲起',
    hintEn: 'Whole-body lean / turn / tilt, plus crouching up and down',
    match: /Pelvis/i,
    euler: { x: ax('yaw'), y: ax('roll'), z: ax('pitch', -1) },
    controls: [
      { key: 'pitch', label: '前倾 / 后仰', labelEn: 'Lean forward / back', ...ROTATE },
      { key: 'yaw', label: '转身', labelEn: 'Turn', ...ROTATE },
      { key: 'roll', label: '侧倾', labelEn: 'Tilt sideways', ...ROTATE },
      { key: 'offsetY', label: '整体升降', offset: 'y', min: -0.8, max: 0.5, step: 0.01, unit: 'm' },
    ],
  },
  {
    id: 'spine',
    label: '脊柱下段',
    labelEn: 'Lower spine',
    hint: '腰背的前俯 / 转身 / 侧倾',
    hintEn: 'Lower back bend / turn / tilt',
    match: /^Bip001_Spine_\d+$/i,
    euler: { x: ax('yaw'), y: ax('roll'), z: ax('pitch', -1) },
    controls: [
      { key: 'pitch', label: '前俯 / 后仰', labelEn: 'Bend forward / back', ...ROTATE },
      { key: 'yaw', label: '转身', labelEn: 'Turn', ...ROTATE },
      { key: 'roll', label: '侧倾', labelEn: 'Tilt sideways', ...ROTATE },
    ],
  },
  {
    id: 'torso',
    label: '脊柱上段',
    labelEn: 'Upper spine',
    hint: '胸腔的前俯 / 转身 / 侧倾',
    hintEn: 'Chest bend / turn / tilt',
    match: /Spine1/i,
    euler: { x: ax('yaw'), y: ax('roll'), z: ax('pitch', -1) },
    controls: [
      { key: 'pitch', label: '前俯 / 后仰', labelEn: 'Bend forward / back', ...ROTATE },
      { key: 'yaw', label: '转身', labelEn: 'Turn', ...ROTATE },
      { key: 'roll', label: '侧倾', labelEn: 'Tilt sideways', ...ROTATE },
    ],
  },
  {
    id: 'neck',
    label: '颈部',
    labelEn: 'Neck',
    hint: '脖子带动头部',
    hintEn: 'Neck carries the head',
    match: /Neck/i,
    euler: { x: ax('yaw'), y: ax('roll'), z: ax('pitch') },
    controls: [
      { key: 'pitch', label: '低头 / 抬头', labelEn: 'Nod down / up', ...ROTATE },
      { key: 'yaw', label: '转头', labelEn: 'Turn head', ...ROTATE },
      { key: 'roll', label: '歪头', labelEn: 'Tilt head', ...ROTATE },
    ],
  },
  {
    id: 'head',
    label: '头部',
    labelEn: 'Head',
    hint: '头部朝向',
    hintEn: 'Head direction',
    match: /^Bip001_Head_/i,
    euler: { x: ax('yaw'), y: ax('roll'), z: ax('pitch') },
    controls: [
      { key: 'pitch', label: '低头 / 抬头', labelEn: 'Nod down / up', ...ROTATE },
      { key: 'yaw', label: '转头', labelEn: 'Turn head', ...ROTATE },
      { key: 'roll', label: '歪头', labelEn: 'Tilt head', ...ROTATE },
    ],
  },
  {
    id: 'leftClavicle',
    label: '左锁骨',
    labelEn: 'Left clavicle',
    hint: '肩带：耸肩 / 沉肩、前送 / 后收',
    hintEn: 'Shoulder girdle: shrug / drop, protract / retract',
    match: /L[_\s]Clavicle/i,
    euler: { y: ax('spread'), z: ax('pitch', -1) },
    controls: [
      { key: 'spread', label: '耸肩 / 沉肩', labelEn: 'Shrug / drop', ...ROTATE },
      { key: 'pitch', label: '前送 / 后收', labelEn: 'Protract / retract', ...ROTATE },
    ],
  },
  {
    id: 'rightClavicle',
    label: '右锁骨',
    labelEn: 'Right clavicle',
    hint: '肩带：耸肩 / 沉肩、前送 / 后收',
    hintEn: 'Shoulder girdle: shrug / drop, protract / retract',
    match: /R[_\s]Clavicle/i,
    euler: { y: ax('spread'), z: ax('pitch', -1) },
    controls: [
      { key: 'spread', label: '耸肩 / 沉肩', labelEn: 'Shrug / drop', ...ROTATE },
      { key: 'pitch', label: '前送 / 后收', labelEn: 'Protract / retract', ...ROTATE },
    ],
  },
  {
    id: 'leftShoulder',
    label: '左肩',
    labelEn: 'Left shoulder',
    hint: '大臂：前后摆 / 外展内收 / 内外旋',
    hintEn: 'Upper arm: swing / abduct / twist',
    match: /L[_\s]UpperArm/i,
    euler: { x: ax('twist'), y: ax('spread'), z: ax('pitch', -1) },
    controls: [
      { key: 'pitch', label: '前摆 / 后摆', labelEn: 'Swing forward / back', ...ROTATE },
      { key: 'spread', label: '外展 / 内收', labelEn: 'Abduct / adduct', ...ROTATE },
      { key: 'twist', label: '内旋 / 外旋', labelEn: 'Twist in / out', ...ROTATE },
    ],
  },
  {
    id: 'rightShoulder',
    label: '右肩',
    labelEn: 'Right shoulder',
    hint: '大臂：前后摆 / 外展内收 / 内外旋',
    hintEn: 'Upper arm: swing / abduct / twist',
    match: /R[_\s]UpperArm/i,
    euler: { x: ax('twist'), y: ax('spread'), z: ax('pitch', -1) },
    controls: [
      { key: 'pitch', label: '前摆 / 后摆', labelEn: 'Swing forward / back', ...ROTATE },
      { key: 'spread', label: '外展 / 内收', labelEn: 'Abduct / adduct', ...ROTATE },
      { key: 'twist', label: '内旋 / 外旋', labelEn: 'Twist in / out', ...ROTATE },
    ],
  },
  {
    id: 'leftElbow',
    label: '左肘',
    labelEn: 'Left elbow',
    hint: '前臂屈伸',
    hintEn: 'Forearm bend',
    match: /L[_\s]Forearm/i,
    euler: { z: ax('bend', -1) },
    controls: [{ key: 'bend', label: '屈肘', labelEn: 'Bend elbow', ...ROTATE }],
  },
  {
    id: 'rightElbow',
    label: '右肘',
    labelEn: 'Right elbow',
    hint: '前臂屈伸',
    hintEn: 'Forearm bend',
    match: /R[_\s]Forearm/i,
    euler: { z: ax('bend', -1) },
    controls: [{ key: 'bend', label: '屈肘', labelEn: 'Bend elbow', ...ROTATE }],
  },
  {
    id: 'leftHand',
    label: '左手腕',
    labelEn: 'Left wrist',
    hint: '手掌朝向',
    hintEn: 'Palm direction',
    match: /L[_\s]Hand_/i,
    euler: { x: ax('twist'), y: ax('roll'), z: ax('pitch') },
    controls: [
      { key: 'pitch', label: '屈 / 伸', labelEn: 'Flex / extend', ...ROTATE },
      { key: 'roll', label: '翻转', labelEn: 'Roll', ...ROTATE },
      { key: 'twist', label: '内收 / 外展', labelEn: 'Adduct / abduct', ...ROTATE },
    ],
  },
  {
    id: 'rightHand',
    label: '右手腕',
    labelEn: 'Right wrist',
    hint: '手掌朝向',
    hintEn: 'Palm direction',
    match: /R[_\s]Hand_/i,
    euler: { x: ax('twist'), y: ax('roll'), z: ax('pitch') },
    controls: [
      { key: 'pitch', label: '屈 / 伸', labelEn: 'Flex / extend', ...ROTATE },
      { key: 'roll', label: '翻转', labelEn: 'Roll', ...ROTATE },
      { key: 'twist', label: '内收 / 外展', labelEn: 'Adduct / abduct', ...ROTATE },
    ],
  },
  {
    id: 'leftHip',
    label: '左髋',
    labelEn: 'Left hip',
    hint: '大腿：前抬后摆 / 外展内收 / 内外旋',
    hintEn: 'Thigh: raise / abduct / twist',
    match: /L[_\s]Thigh/i,
    euler: { x: ax('twist'), y: ax('spread', -1), z: ax('pitch') },
    controls: [
      { key: 'pitch', label: '前抬 / 后摆', labelEn: 'Raise / swing back', ...ROTATE },
      { key: 'spread', label: '外展 / 内收', labelEn: 'Abduct / adduct', ...ROTATE },
      { key: 'twist', label: '内旋 / 外旋', labelEn: 'Twist in / out', ...ROTATE },
    ],
  },
  {
    id: 'rightHip',
    label: '右髋',
    labelEn: 'Right hip',
    hint: '大腿：前抬后摆 / 外展内收 / 内外旋',
    hintEn: 'Thigh: raise / abduct / twist',
    match: /R[_\s]Thigh/i,
    euler: { x: ax('twist'), y: ax('spread', -1), z: ax('pitch') },
    controls: [
      { key: 'pitch', label: '前抬 / 后摆', labelEn: 'Raise / swing back', ...ROTATE },
      { key: 'spread', label: '外展 / 内收', labelEn: 'Abduct / adduct', ...ROTATE },
      { key: 'twist', label: '内旋 / 外旋', labelEn: 'Twist in / out', ...ROTATE },
    ],
  },
  {
    id: 'leftKnee',
    label: '左膝',
    labelEn: 'Left knee',
    hint: '小腿屈伸',
    hintEn: 'Shin bend',
    match: /L[_\s]Calf/i,
    euler: { z: ax('bend', -1) },
    controls: [{ key: 'bend', label: '屈膝', labelEn: 'Bend knee', ...ROTATE }],
  },
  {
    id: 'rightKnee',
    label: '右膝',
    labelEn: 'Right knee',
    hint: '小腿屈伸',
    hintEn: 'Shin bend',
    match: /R[_\s]Calf/i,
    euler: { z: ax('bend', -1) },
    controls: [{ key: 'bend', label: '屈膝', labelEn: 'Bend knee', ...ROTATE }],
  },
  {
    id: 'leftFoot',
    label: '左脚踝',
    labelEn: 'Left ankle',
    hint: '脚掌勾绷、内外翻、内外旋',
    hintEn: 'Foot flex / point, roll and twist',
    match: /L[_\s]Foot/i,
    euler: { x: ax('twist'), y: ax('roll'), z: ax('pitch') },
    controls: [
      { key: 'pitch', label: '绷脚 / 勾脚', labelEn: 'Point / flex foot', ...ROTATE },
      { key: 'roll', label: '内翻 / 外翻', labelEn: 'Roll in / out', ...ROTATE },
      { key: 'twist', label: '内旋 / 外旋', labelEn: 'Twist in / out', ...ROTATE },
    ],
  },
  {
    id: 'rightFoot',
    label: '右脚踝',
    labelEn: 'Right ankle',
    hint: '脚掌勾绷、内外翻、内外旋',
    hintEn: 'Foot flex / point, roll and twist',
    match: /R[_\s]Foot/i,
    euler: { x: ax('twist'), y: ax('roll'), z: ax('pitch') },
    controls: [
      { key: 'pitch', label: '绷脚 / 勾脚', labelEn: 'Point / flex foot', ...ROTATE },
      { key: 'roll', label: '内翻 / 外翻', labelEn: 'Roll in / out', ...ROTATE },
      { key: 'twist', label: '内旋 / 外旋', labelEn: 'Twist in / out', ...ROTATE },
    ],
  },
  {
    id: 'leftToe',
    label: '左脚趾',
    labelEn: 'Left toe',
    hint: '脚趾弯曲',
    hintEn: 'Toe bend',
    match: /L[_\s]Toe0_/i,
    euler: { z: ax('bend', -1) },
    controls: [{ key: 'bend', label: '弯曲', labelEn: 'Bend', ...ROTATE }],
  },
  {
    id: 'rightToe',
    label: '右脚趾',
    labelEn: 'Right toe',
    hint: '脚趾弯曲',
    hintEn: 'Toe bend',
    match: /R[_\s]Toe0_/i,
    euler: { z: ax('bend', -1) },
    controls: [{ key: 'bend', label: '弯曲', labelEn: 'Bend', ...ROTATE }],
  },
]

const FINGER_NAMES = ['拇指', '食指', '中指', '无名指', '小指']
const PHALANX_NAMES = ['根节', '近节', '远节']
const FINGER_NAMES_EN = ['thumb', 'index', 'middle', 'ring', 'little']
const PHALANX_NAMES_EN = ['base', 'proximal', 'distal']

const NODE_LABELS = [
  [/^_rootJoint$/i, '骨骼根', 'Skeleton root'],
  [/^Bones_\d+$/i, '骨架根节点', 'Skeleton root node'],
  [/^Bip001_Footsteps/i, '脚步参考', 'Footstep reference'],
  [/^UE_Mannequin/i, '角色模型', 'Character model'],
  [/Nub/i, '末端', 'End'],
]

/** 非关节节点的显示名，避免出现原始骨骼名。lang: 'zh' | 'en' */
export function nodeLabel(name = '', lang = 'zh') {
  for (const [pattern, zh, en] of NODE_LABELS) {
    if (pattern.test(name)) return lang === 'en' ? en : zh
  }
  return ''
}

/** 指骨：Bip001_L_Finger0_011 / Bones_L_Finger11_016 */
function fingerInfo(name) {
  // Finger0 / Finger01 / Finger02：首个数字是指头序号，数字位数代表指节
  const m = name.match(/(L|R)[_\s]Finger(\d)(\d)?[_\s]/i)
  if (!m) return null
  const side = m[1].toUpperCase()
  const finger = Number(m[2])
  const phalanx = m[3] ? 1 + Number(m[3]) : 1
  const fingerZh = FINGER_NAMES[finger] || `指${finger}`
  const fingerEn = FINGER_NAMES_EN[finger] || 'finger'
  const phalanxZh = PHALANX_NAMES[phalanx - 1] || '末节'
  const phalanxEn = PHALANX_NAMES_EN[phalanx - 1] || 'distal'
  const sideZh = side === 'L' ? '左' : '右'
  const sideEn = side === 'L' ? 'Left' : 'Right'
  return {
    side,
    finger,
    phalanx,
    id: `${side === 'L' ? 'left' : 'right'}Finger${finger}_${phalanx}`,
    label: `${sideZh}手${fingerZh}·${phalanxZh}`,
    labelEn: `${sideEn} ${fingerEn} · ${phalanxEn}`,
  }
}

/** 给每根骨骼找到它对应的关节定义（没有则返回 null） */
export function resolveJoint(bone) {
  const name = bone.name || ''
  if (/Nub/i.test(name)) return null
  for (const joint of JOINTS) {
    if (joint.match.test(name)) return joint
  }
  const finger = fingerInfo(name)
  if (finger) {
    return {
      id: finger.id,
      label: finger.label,
      labelEn: finger.labelEn,
      hint: '手指弯曲',
      hintEn: 'Finger bend',
      euler: { z: ax('bend', -1) },
      controls: [{ key: 'bend', label: '弯曲', labelEn: 'Bend', ...ROTATE }],
    }
  }
  return null
}

/** 骨骼在树里显示的名字。lang: 'zh' | 'en' */
export function displayLabel(bone, lang = 'zh') {
  const joint = resolveJoint(bone)
  if (joint) return lang === 'en' ? joint.labelEn ?? joint.label : joint.label
  const fallback = nodeLabel(bone.name, lang)
  if (fallback) return fallback
  // 兜底：去掉常见前缀与数字后缀，绝不直接显示原始名字
  const cleaned = bone.name
    .replace(/^Bip001[_\s]+/i, '')
    .replace(/^Bones[_\s]+/i, '')
    .replace(/[_\s]+/g, ' ')
    .replace(/\s*\d+$/, '')
    .trim()
  return cleaned || (lang === 'en' ? 'Bone node' : '骨骼节点')
}

/** 骨骼属于哪一侧（用于树里的小圆点） */
export function displaySide(bone) {
  const finger = fingerInfo(bone.name || '')
  if (finger) return finger.side === 'L' ? 'left' : 'right'
  if (/(^|[_\s])L([_\s]|$)/i.test(bone.name || '')) return 'left'
  if (/(^|[_\s])R([_\s]|$)/i.test(bone.name || '')) return 'right'
  return 'center'
}

const clampDeg = (v) => Math.min(LIMIT, Math.max(-LIMIT, v))

/** 控制项 -> 欧拉分量（度），顺序固定为 [x, y, z]，与 storyai 的 rotation 函数一致 */
export function jointEulerDegrees(joint, values, out = [0, 0, 0]) {
  for (let i = 0; i < 3; i++) {
    const map = joint?.euler?.[AXIS_ORDER[i]]
    if (!map) {
      out[i] = 0
      continue
    }
    const v = Number(values?.[map.key] ?? 0)
    out[i] = clampDeg((Number.isFinite(v) ? v : 0) * map.sign)
  }
  return out
}

/**
 * 由控制项角度生成局部四元数：bind · Euler(x, y, z)
 * （bind 已经包含静止姿势与中性偏置，等价于 storyai 的 rest · neutral · pose）
 */
export function composeJoint(joint, bindQuat, values) {
  const deg = jointEulerDegrees(joint, values, _deg)
  _euler.set(deg[0] * D2R, deg[1] * D2R, deg[2] * D2R, 'XYZ')
  _delta.setFromEuler(_euler)
  return bindQuat.clone().multiply(_delta)
}

/**
 * 把当前局部四元数分解成各控制项的角度（度），composeJoint 的严格逆运算。
 * `round` 只用于显示；重建四元数时必须用未取整的值。
 */
export function decomposeJoint(joint, bindQuat, curQuat, out = {}, round = true) {
  _delta.copy(bindQuat).invert().multiply(curQuat)
  _euler.setFromQuaternion(_delta, 'XYZ')
  _deg[0] = _euler.x * R2D
  _deg[1] = _euler.y * R2D
  _deg[2] = _euler.z * R2D
  for (let i = 0; i < 3; i++) {
    const map = joint?.euler?.[AXIS_ORDER[i]]
    if (!map) continue
    const value = clampDeg(_deg[i] * map.sign)
    out[map.key] = round ? Math.round(value * 10) / 10 : value
  }
  return out
}

/**
 * 模型载入后叠一次中性偏置（storyai 的 rest · neutral）。
 * `jointOf` 是 「骨骼 -> 关节」的查询函数，换成别的模型时按关节匹配而不是按骨骼名。
 */
export function applyNeutralPose(bones, jointOf) {
  for (const bone of bones) {
    const rotation = NEUTRAL_ROTATIONS[jointOf(bone)?.id]
    if (!rotation) continue
    _euler.set(rotation[0] * D2R, rotation[1] * D2R, rotation[2] * D2R, 'XYZ')
    bone.quaternion.multiply(_delta.setFromEuler(_euler))
  }
  for (const bone of bones) bone.updateMatrixWorld(true)
}

/** 该关节控制项里是否有世界位移（例如整体升降） */
export function offsetControl(joint) {
  return joint?.controls.find((c) => c.offset) || null
}

const _delta = new THREE.Quaternion()
const _euler = new THREE.Euler()
const _deg = [0, 0, 0]
