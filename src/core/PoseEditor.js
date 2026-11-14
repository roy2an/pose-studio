import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import {
  isNub,
  snapshotPose,
  applySnapshot,
  snapshotsEqual,
  exportPose,
  importPose,
} from './poseUtils.js'
import {
  resolveJoint,
  displayLabel,
  displaySide,
  decomposeJoint,
  composeJoint,
  applyNeutralPose,
  offsetControl,
} from './semanticRig.js'
import { t } from '../i18n.js'

const MODEL_URL = `${import.meta.env.BASE_URL}models/ue-mannequin-retopology.glb`
const MODEL_NAME = 'ue-mannequin-retopology.glb'

const _v1 = new THREE.Vector3()
const _v2 = new THREE.Vector3()
const _m2 = new THREE.Matrix4()

/** 点到线段的最近点（写入 target，避免每次分配） */
function closestPointOnSegment(p, a, b, target) {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const abz = b.z - a.z
  const lenSq = abx * abx + aby * aby + abz * abz
  if (lenSq === 0) return target.copy(a)
  const t = THREE.MathUtils.clamp(
    ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / lenSq,
    0,
    1,
  )
  return target.set(a.x + abx * t, a.y + aby * t, a.z + abz * t)
}

function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

export class PoseEditor {
  constructor(container, callbacks = {}) {
    this.container = container
    this.cb = callbacks

    this.model = null
    this.pivot = null
    this.skinnedMesh = null
    this.bones = []
    this.boneSet = new Set()
    this.boneById = new Map()
    this.boneData = []
    this.boneChildren = new Map() // Bone -> Bone[]
    this.boneParent = new Map() // Bone -> Bone | null
    this.modelHeight = 1.8

    this.selected = null
    this.hovered = null

    this.bindSnapshot = null
    this.history = { stack: [], index: -1 }

    this._poseDirty = true
    this._raf = null
    this._clock = new THREE.Clock()
    this._tween = null
    this._pointer = { x: 0, y: 0, downX: 0, downY: 0, downTime: 0, moved: false }
    this._hoverTime = 0
    this._disposed = false

    this.options = { showSkeleton: true, showGrid: true, showGround: true }

    if (import.meta.env.DEV) window.__THREE = THREE
  }

  // ────────────────────────────────────────────────────────────── setup ──

  _setup() {
    const { clientWidth: w, clientHeight: h } = this.container

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(w || 1, h || 1)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.domElement.className = 'viewport-canvas'
    this.container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(34, (w || 1) / (h || 1), 0.01, 60)
    this.camera.position.set(2.2, 1.45, 2.8)

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement)
    this.orbit.enableDamping = true
    this.orbit.dampingFactor = 0.075
    this.orbit.minDistance = 0.45
    this.orbit.maxDistance = 8
    this.orbit.maxPolarAngle = Math.PI / 2 + 0.1
    this.orbit.target.set(0, 0.95, 0)
    this.orbit.update()

    // 环境光照（room environment 提供柔和的 PBR 反射）
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.045)
    this.scene.environment = this.envRT.texture
    this.scene.environmentIntensity = 0.75
    pmrem.dispose()

    const hemi = new THREE.HemisphereLight(0xbcd2ff, 0x1a1d24, 0.9)
    this.scene.add(hemi)

    const key = new THREE.DirectionalLight(0xffffff, 2.6)
    key.position.set(2.6, 4.2, 3.4)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.near = 0.5
    key.shadow.camera.far = 14
    key.shadow.camera.left = -2.2
    key.shadow.camera.right = 2.2
    key.shadow.camera.top = 2.6
    key.shadow.camera.bottom = -1.2
    key.shadow.bias = -0.0008
    key.shadow.normalBias = 0.02
    key.shadow.radius = 2
    this.scene.add(key)
    this.keyLight = key

    const rim = new THREE.DirectionalLight(0x6f9bff, 1.6)
    rim.position.set(-2.8, 2.6, -3.2)
    this.scene.add(rim)

    const fill = new THREE.DirectionalLight(0xffd9c0, 0.5)
    fill.position.set(-3, 1.2, 2.5)
    this.scene.add(fill)

    this._buildGround()

    // 骨架叠加层
    this.jointGroup = new THREE.Group()
    this.jointGroup.renderOrder = 5
    this.scene.add(this.jointGroup)

    this.jointGeo = new THREE.SphereGeometry(0.0135, 12, 10)
    this.matIdle = new THREE.MeshBasicMaterial({
      color: 0x7fa6ff,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
    })
    this.matHover = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
    })
    this.matSelected = new THREE.MeshBasicMaterial({
      color: 0xffb454,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
    })

    this.lineMat = new THREE.LineBasicMaterial({
      color: 0x5b8dff,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false,
    })

    this.raycaster = new THREE.Raycaster()

    this._bindPointerEvents()

    this._ro = new ResizeObserver(() => this.resize())
    this._ro.observe(this.container)

    this._tick = this._tick.bind(this)
    this._raf = requestAnimationFrame(this._tick)
  }

  _buildGround() {
    this.groundGroup = new THREE.Group()
    this.scene.add(this.groundGroup)

    // 径向渐变"光池"，让角色与背景衔接
    const size = 256
    const cv = document.createElement('canvas')
    cv.width = cv.height = size
    const ctx = cv.getContext('2d')
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size / 2)
    g.addColorStop(0, 'rgba(30,38,54,0.95)')
    g.addColorStop(0.55, 'rgba(22,27,38,0.55)')
    g.addColorStop(1, 'rgba(16,20,28,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, size, size)

    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(2.5, 64),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
    )
    disc.rotation.x = -Math.PI / 2
    disc.position.y = 0.002
    disc.renderOrder = -2
    this.groundGroup.add(disc)

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(2.5, 64),
      new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.4, depthWrite: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.001
    shadow.receiveShadow = true
    shadow.renderOrder = -1
    this.groundGroup.add(shadow)

    this.grid = new THREE.GridHelper(6, 24, 0x3b4a66, 0x232a38)
    this.grid.position.y = 0.004
    this.grid.material.transparent = true
    this.grid.material.opacity = 0.55
    this.grid.material.depthWrite = false
    this.groundGroup.add(this.grid)
  }

  _bindPointerEvents() {
    const dom = this.renderer.domElement

    this._onPointerDown = (e) => {
      if (e.button !== 0) return
      this._pointer.downX = e.clientX
      this._pointer.downY = e.clientY
      this._pointer.downTime = performance.now()
      this._pointer.moved = false
    }

    this._onPointerMove = (e) => {
      this._pointer.x = e.clientX
      this._pointer.y = e.clientY
      if (this._pointer.downTime) {
        const dx = e.clientX - this._pointer.downX
        const dy = e.clientY - this._pointer.downY
        if (dx * dx + dy * dy > 25) this._pointer.moved = true
      }
      // 悬停检测由 tick 节流处理
      this._hoverPending = true
    }

    this._onPointerUp = (e) => {
      const p = this._pointer
      const quick = performance.now() - p.downTime < 600
      const still = !p.moved
      p.downTime = 0
      if (!quick || !still || e.button !== 0) return
      const bone = this.pick(e.clientX, e.clientY)
      this.select(bone)
    }

    this._onPointerLeave = () => {
      this._hoverPending = false
      this._setHovered(null)
    }

    dom.addEventListener('pointerdown', this._onPointerDown)
    dom.addEventListener('pointermove', this._onPointerMove)
    dom.addEventListener('pointerup', this._onPointerUp)
    dom.addEventListener('pointerleave', this._onPointerLeave)
  }

  // ──────────────────────────────────────────────────────────── loading ──

  async load() {
    this._setup()
    return this.loadModel(MODEL_URL, MODEL_NAME)
  }

  /** 载入（或替换）一个带骨骼的角色模型 */
  async loadModel(url, name = '') {
    const loader = new GLTFLoader()
    let gltf
    try {
      gltf = await loader.loadAsync(url, (evt) => {
        if (evt.lengthComputable && this.cb.onProgress) {
          this.cb.onProgress(evt.loaded / evt.total)
        }
      })
    } catch (err) {
      this.cb.onError?.(err)
      throw err
    }

    const model = gltf.scene
    model.updateMatrixWorld(true)

    let skinned = null
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        o.frustumCulled = false
        if (o.isSkinnedMesh) skinned = o
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) {
          if (!m) continue
          m.envMapIntensity = 0.85
          m.side = THREE.FrontSide
          if (m.metalness !== undefined) m.metalness = Math.min(m.metalness, 0.1)
          m.needsUpdate = true
        }
      }
    })

    if (!skinned) {
      const err = new Error(t('error.noSkinnedMesh'))
      this.cb.onError?.(err)
      throw err
    }

    this._teardownModel()

    // 归一化：身高 -> 1.8 单位，脚底踩在 y=0，水平居中
    this.pivot = new THREE.Group()
    this.pivot.add(model)
    this.scene.add(this.pivot)

    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const scale = 1.8 / (size.y || 1)
    this.pivot.scale.setScalar(scale)
    this.pivot.updateMatrixWorld(true)

    const box2 = new THREE.Box3().setFromObject(this.pivot)
    const center = box2.getCenter(new THREE.Vector3())
    this.pivot.position.set(-center.x, -box2.min.y, -center.z)
    this.pivot.updateMatrixWorld(true)

    this.model = model
    this.modelName = name || MODEL_NAME
    this.skinnedMesh = skinned
    this.modelHeight = 1.8

    this._collectBones(skinned)
    this._buildSkeletonOverlay()

    // 绑定姿势 = 静止姿势 · 中性偏置（storyai 的 rest · neutral），
    // 之后所有语义控制都叠在它上面，预设里的空 controls 就等于这套中性姿势
    applyNeutralPose(this.bones, (bone) => this.jointOf(bone))
    this.bindSnapshot = snapshotPose(this.bones)
    // 历史标签用函数保存，切换语言后状态栏里的说明也会跟着切换
    this.history.stack = [{ label: () => t('history.initial'), snap: this.bindSnapshot }]
    this.history.index = 0

    this._orientCamera()
    this.resize()

    // 默认选中左大臂，方便立即开始调整
    const upperArm = this.bones.find((b) => /L[_\s]UpperArm/i.test(b.name))
    if (upperArm) this.select(upperArm)
    this._emitHistory()
    this._emitTransform()

    this.cb.onLoad?.({
      boneData: this.boneData,
      modelName: this.modelName,
      boneCount: this.boneData.filter((b) => !b.nub).length,
      totalBones: this.boneData.length,
    })

    return this
  }

  /** 清除当前模型与骨架叠加层（保留渲染器/相机/灯光） */
  _teardownModel() {
    this.select(null)
    this.hovered = null

    if (this.pivot) {
      this.scene.remove(this.pivot)
      this.pivot.traverse((o) => {
        if (o.geometry) o.geometry.dispose()
        const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []
        for (const m of mats) {
          for (const v of Object.values(m)) if (v && v.isTexture) v.dispose()
          m.dispose()
        }
      })
      this.pivot = null
    }

    if (this.jointGroup) {
      for (const m of this.jointMeshes || []) this.jointGroup.remove(m)
    }
    this.jointMeshes = []

    if (this.lines) {
      this.scene.remove(this.lines)
      this.lines.geometry.dispose()
      this.lines = null
    }
    this.segments = []

    this.model = null
    this.skinnedMesh = null
    this.bones = []
    this.boneSet = new Set()
    this.orderedBones = []
    this.boneById.clear()
    this.boneParent.clear()
    this.boneChildren.clear()
    this.boneData = []
    this.bindSnapshot = null
  }

  _collectBones(skinned) {
    const all = skinned.skeleton.bones.slice()
    this.bones = all
    this.boneSet = new Set(all)
    this.boneById.clear()
    this.boneParent.clear()
    this.boneChildren.clear()
    for (const b of all) {
      this.boneById.set(b.uuid, b)
      this.boneChildren.set(b, [])
    }

    const parentOf = (bone) => {
      let p = bone.parent
      while (p) {
        if (this.boneSet.has(p)) return p
        p = p.parent
      }
      return null
    }

    for (const b of all) {
      const p = parentOf(b)
      this.boneParent.set(b, p)
      if (p) this.boneChildren.get(p).push(b)
    }

    // 深度优先排序，保证父骨骼先于子骨骼
    const ordered = []
    const walk = (bone, depth) => {
      ordered.push({ bone, depth })
      const kids = this.boneChildren.get(bone) || []
      for (const k of kids) walk(k, depth + 1)
    }
    for (const b of all) {
      if (!this.boneParent.get(b)) walk(b, 0)
    }
    // 保险：未被访问的骨骼也纳入
    for (const b of all) {
      if (!ordered.some((o) => o.bone === b)) walk(b, 0)
    }

    this.orderedBones = ordered.map((o) => o.bone)
    this.jointByBone = new Map()
    this.boneData = ordered.map(({ bone, depth }) => {
      const joint = resolveJoint(bone)
      this.jointByBone.set(bone, joint)
      return {
        id: bone.uuid,
        name: bone.name,
        label: displayLabel(bone, 'zh'),
        labelEn: displayLabel(bone, 'en'),
        side: displaySide(bone),
        jointId: joint?.id ?? null,
        parentId: this.boneParent.get(bone)?.uuid ?? null,
        depth,
        nub: isNub(bone.name),
        finger: /Finger/i.test(bone.name),
      }
    })
  }

  // ─────────────────────────────────────────────────────── semantic rig ──

  jointOf(bone) {
    return bone ? this.jointByBone?.get(bone) || null : null
  }

  /** 当前选中骨骼的语义控制状态（供 UI 渲染） */
  semanticState(bone = this.selected) {
    const joint = this.jointOf(bone)
    if (!bone || !joint || !this.bindSnapshot) return null
    const bind = this.bindSnapshot[bone.uuid]
    if (!bind) return null
    const bindQuat = new THREE.Quaternion(bind.r[0], bind.r[1], bind.r[2], bind.r[3])
    const angles = decomposeJoint(joint, bindQuat, bone.quaternion, {})

    const offset = offsetControl(joint)
    let offsetValue = 0
    if (offset) offsetValue = this._currentOffset(bone, offset)

    return {
      id: joint.id,
      label: joint.label,
      labelEn: joint.labelEn ?? joint.label,
      hint: joint.hint || '',
      hintEn: joint.hintEn ?? joint.hint ?? '',
      controls: joint.controls.map((c) => ({
        key: c.key,
        label: c.label,
        labelEn: c.labelEn ?? c.label,
        value: c.offset ? Math.round(offsetValue * 1000) / 1000 : angles[c.key] ?? 0,
        min: c.min,
        max: c.max,
        step: c.step ?? (c.offset ? 0.01 : 1),
        unit: c.unit || '°',
        offset: !!c.offset,
      })),
    }
  }

  /** 设置语义控制项的数值 */
  setSemanticValue(key, value, bone = this.selected) {
    const joint = this.jointOf(bone)
    if (!bone || !joint || !this.bindSnapshot) return
    const bind = this.bindSnapshot[bone.uuid]
    if (!bind) return
    const control = joint.controls.find((c) => c.key === key)
    if (!control) return

    if (control.offset) {
      this._applyOffset(bone, control, value)
      this._poseDirty = true
      this._emitTransform()
      return
    }

    const bindQuat = new THREE.Quaternion(bind.r[0], bind.r[1], bind.r[2], bind.r[3])
    // 重建时保留未取整的其它轴数值，避免反复编辑时累积舍入误差
    const values = decomposeJoint(joint, bindQuat, bone.quaternion, {}, false)
    values[key] = value
    bone.quaternion.copy(composeJoint(joint, bindQuat, values))
    bone.updateMatrixWorld(true)
    this._poseDirty = true
    this._emitTransform()
  }

  /**
   * 把一组手势套用到某一侧手掌：只改该侧 15 根手指骨骼，
   * 手腕 / 手臂 / 身体其它关节保持当前姿势不变。
   * @param {'left'|'right'} side
   * @param {number[][]} fingers 5 根手指（拇指→小指），每根 [根节, 近节, 远节] 的 bend 值
   */
  setHandGesture(side, fingers) {
    if (!this.bindSnapshot || !Array.isArray(fingers)) return
    const wanted = new Map()
    for (let f = 0; f < 5; f++) {
      const bends = fingers[f] || []
      for (let p = 0; p < 3; p++) {
        wanted.set(`${side}Finger${f}_${p + 1}`, Number(bends[p]) || 0)
      }
    }
    for (const bone of this.bones) {
      const joint = this.jointOf(bone)
      if (!joint || !wanted.has(joint.id)) continue
      const bind = this.bindSnapshot[bone.uuid]
      if (!bind) continue
      const bindQuat = new THREE.Quaternion(bind.r[0], bind.r[1], bind.r[2], bind.r[3])
      bone.quaternion.copy(composeJoint(joint, bindQuat, { bend: wanted.get(joint.id) }))
      bone.updateMatrixWorld(true)
    }
    this._poseDirty = true
    this._emitTransform()
  }

  /** 一次性套用一组语义数值（预设姿势），会先把角色恢复到绑定姿势 */
  applySemanticMap(map) {
    if (!this.bindSnapshot) return
    applySnapshot(this.bones, this.bindSnapshot)

    const byBone = new Map()
    for (const [fullKey, value] of Object.entries(map || {})) {
      const dot = fullKey.lastIndexOf('.')
      if (dot < 0) continue
      const jointId = fullKey.slice(0, dot)
      const controlKey = fullKey.slice(dot + 1)
      const bone = this.bones.find((b) => this.jointOf(b)?.id === jointId)
      const joint = bone && this.jointOf(bone)
      const control = joint?.controls.find((c) => c.key === controlKey)
      if (!bone || !control) continue
      if (!byBone.has(bone)) byBone.set(bone, { joint, values: {}, offsets: [] })
      const entry = byBone.get(bone)
      if (control.offset) entry.offsets.push([control, Number(value)])
      else entry.values[controlKey] = Number(value)
    }

    for (const [bone, entry] of byBone) {
      const bind = this.bindSnapshot[bone.uuid]
      if (!bind) continue
      const bindQuat = new THREE.Quaternion(bind.r[0], bind.r[1], bind.r[2], bind.r[3])
      if (Object.keys(entry.values).length) {
        bone.quaternion.copy(composeJoint(entry.joint, bindQuat, entry.values))
      }
      bone.updateMatrixWorld(true)
    }
    for (const [bone, entry] of byBone) {
      for (const [control, value] of entry.offsets) this._applyOffset(bone, control, value)
    }
    for (const b of this.bones) b.updateMatrixWorld(true)
    this._poseDirty = true
    this._emitTransform()
  }

  /** 当前姿势下模型最低点的世界 Y（按顶点抽样，考虑蒙皮变形） */
  posedMinY(sampleStride = 9) {
    const mesh = this.skinnedMesh
    if (!mesh) return 0
    this.scene.updateMatrixWorld(true)
    const position = mesh.geometry.getAttribute('position')
    if (!position) return 0
    const v = new THREE.Vector3()
    let minY = Infinity
    for (let i = 0; i < position.count; i += sampleStride) {
      mesh.getVertexPosition(i, v)
      v.applyMatrix4(mesh.matrixWorld)
      if (v.y < minY) minY = v.y
    }
    return Number.isFinite(minY) ? minY : 0
  }

  /** 把悬空或陷地的姿势修正到地面 */
  groundPose({ snapFloating = true } = {}) {
    const minY = this.posedMinY()
    const needSnap = minY < -0.002 || (snapFloating && minY > 0.02)
    if (!needSnap) return

    const pelvis = this.bones.find((b) => this.jointOf(b)?.id === 'body')
    const joint = this.jointOf(pelvis)
    const offset = offsetControl(joint)
    if (!pelvis || !offset) return
    const current = this._currentOffset(pelvis, offset)
    this._applyOffset(pelvis, offset, current - minY)
    for (const b of this.bones) b.updateMatrixWorld(true)
    this._poseDirty = true
  }

  /** 读取当前骨骼的语义数值（导出用） */
  semanticValues(bone = this.selected) {
    const state = this.semanticState(bone)
    if (!state) return {}
    const out = {}
    for (const c of state.controls) out[`${state.id}.${c.key}`] = c.value
    return out
  }

  _currentOffset(bone, control) {
    const bind = this.bindSnapshot?.[bone.uuid]
    if (!bind || !bone.parent) return 0
    this.scene.updateMatrixWorld(true)
    const baseWorld = new THREE.Vector3(bind.t[0], bind.t[1], bind.t[2]).applyMatrix4(
      bone.parent.matrixWorld,
    )
    const cur = bone.getWorldPosition(new THREE.Vector3())
    return cur[control.offset] - baseWorld[control.offset]
  }

  _applyOffset(bone, control, value) {
    const bind = this.bindSnapshot?.[bone.uuid]
    if (!bind || !bone.parent) return
    this.scene.updateMatrixWorld(true)
    const baseWorld = new THREE.Vector3(bind.t[0], bind.t[1], bind.t[2]).applyMatrix4(
      bone.parent.matrixWorld,
    )
    // 只改这一个世界轴，保留其它方向的位移
    const target = bone.getWorldPosition(new THREE.Vector3())
    target[control.offset] = baseWorld[control.offset] + value
    const invParent = new THREE.Matrix4().copy(bone.parent.matrixWorld).invert()
    bone.position.copy(target.applyMatrix4(invParent))
    bone.updateMatrixWorld(true)
  }

  _buildSkeletonOverlay() {
    // 关节球
    this.jointMeshes = []
    for (const bone of this.orderedBones) {
      if (isNub(bone.name)) continue
      const m = new THREE.Mesh(this.jointGeo, this.matIdle)
      m.renderOrder = 6
      m.userData.bone = bone
      m.frustumCulled = false
      this.jointGroup.add(m)
      this.jointMeshes.push(m)
    }

    // 连线
    const segs = []
    for (const bone of this.orderedBones) {
      const p = this.boneParent.get(bone)
      if (p) segs.push([p, bone])
    }
    this.segments = segs
    const positions = new Float32Array(segs.length * 6)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    this.lines = new THREE.LineSegments(geo, this.lineMat)
    this.lines.frustumCulled = false
    this.lines.renderOrder = 5
    this.scene.add(this.lines)

    this._updateSkeleton()
    this.setShowSkeleton(this.options.showSkeleton)
  }

  _orientCamera() {
    // 以脚趾与骨盆的相对位置推断角色朝向
    const pelvis = this.bones.find((b) => /Pelvis/i.test(b.name))
    const toe = this.bones.find((b) => /L Toe0_/i.test(b.name)) || this.bones.find((b) => /Toe0/i.test(b.name))
    let forward = new THREE.Vector3(0, 0, 1)
    if (pelvis && toe) {
      pelvis.getWorldPosition(_v1)
      toe.getWorldPosition(_v2)
      _v2.y = 0
      _v1.y = 0
      forward = _v2.sub(_v1)
      if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1)
      forward.normalize()
    }
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize()
    const target = new THREE.Vector3(0, this.modelHeight * 0.52, 0)
    this.orbit.target.copy(target)
    const dir = forward
      .clone()
      .multiplyScalar(1.0)
      .addScaledVector(right, -0.62)
      .add(new THREE.Vector3(0, 0.2, 0))
      .normalize()
    this.camera.position.copy(target).addScaledVector(dir, 4.35)
    this.camera.lookAt(target)
    this.orbit.update()
  }

  // ────────────────────────────────────────────────────────── selection ──

  getBone(id) {
    return this.boneById.get(id) || null
  }

  pick(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(ndc, this.camera)

    if (this.options.showSkeleton && this.jointMeshes) {
      const hits = this.raycaster.intersectObjects(this.jointMeshes, false)
      if (hits.length) return hits[0].object.userData.bone
    }

    if (this.skinnedMesh) {
      const hits = this.raycaster.intersectObject(this.skinnedMesh, false)
      if (hits.length) return this._nearestBone(hits[0].point)
    }
    return null
  }

  _nearestBone(point) {
    const candidates = this.orderedBones.filter((b) => !isNub(b.name))
    let best = null
    let bestDist = Infinity
    const a = new THREE.Vector3()
    const b = new THREE.Vector3()
    const closest = new THREE.Vector3()

    // 先按"骨段"距离找，命中手臂/腿的中段时更准确
    for (const bone of candidates) {
      const kids = (this.boneChildren.get(bone) || []).filter((k) => this.boneSet.has(k))
      if (!kids.length) continue
      bone.getWorldPosition(a)
      for (const k of kids) {
        k.getWorldPosition(b)
        closestPointOnSegment(point, a, b, closest)
        const d = closest.distanceToSquared(point)
        if (d < bestDist) {
          bestDist = d
          best = bone
        }
      }
    }

    if (!best) {
      for (const bone of candidates) {
        bone.getWorldPosition(a)
        const d = a.distanceToSquared(point)
        if (d < bestDist) {
          bestDist = d
          best = bone
        }
      }
    }
    return best
  }

  select(bone, { focus = false } = {}) {
    if (this.selected === bone) {
      if (focus && bone) this.focusBone(bone)
      return
    }
    this.selected = bone
    this._refreshJointMaterials()

    this.cb.onSelect?.(bone ? bone.uuid : null)
    this._emitTransform()
    if (focus && bone) this.focusBone(bone)
  }

  selectById(id, opts) {
    this.select(id ? this.getBone(id) : null, opts)
  }

  setHovered(bone) {
    this._setHovered(bone)
  }

  _setHovered(bone) {
    if (this.hovered === bone) return
    this.hovered = bone
    this._refreshJointMaterials()
    this.renderer.domElement.style.cursor = bone ? 'pointer' : ''
    this.cb.onHover?.(bone ? bone.uuid : null)
  }

  _refreshJointMaterials() {
    if (!this.jointMeshes) return
    for (const m of this.jointMeshes) {
      const bone = m.userData.bone
      const isSel = bone === this.selected
      const isHov = bone === this.hovered
      m.material = isSel ? this.matSelected : isHov ? this.matHover : this.matIdle
      const s = isSel ? 1.75 : isHov ? 1.35 : 1
      m.scale.setScalar(s)
    }
  }

  focusBone(bone) {
    if (!bone) return
    const target = bone.getWorldPosition(new THREE.Vector3())
    const offset = this.camera.position.clone().sub(this.orbit.target)
    const dist = THREE.MathUtils.clamp(offset.length() * 0.65, 0.8, 2.6)
    const dir = offset.normalize()
    this._startTween(target, target.clone().addScaledVector(dir, dist))
  }

  frameAll() {
    const target = new THREE.Vector3(0, this.modelHeight * 0.52, 0)
    const dir = this.camera.position.clone().sub(this.orbit.target).normalize()
    this._startTween(target, target.clone().addScaledVector(dir, 4.35))
  }

  _startTween(target, cameraPos) {
    this._tween = {
      t: 0,
      dur: 0.42,
      fromTarget: this.orbit.target.clone(),
      toTarget: target.clone(),
      fromCam: this.camera.position.clone(),
      toCam: cameraPos.clone(),
    }
  }

  // ─────────────────────────────────────────────────────────── transform ──

  setShowSkeleton(v) {
    this.options.showSkeleton = v
    if (this.jointGroup) this.jointGroup.visible = v
    if (this.lines) this.lines.visible = v
  }

  setShowGrid(v) {
    this.options.showGrid = v
    if (this.grid) this.grid.visible = v
  }

  resetBone(bone = this.selected) {
    if (!bone || !this.bindSnapshot) return
    const s = this.bindSnapshot[bone.uuid]
    if (!s) return
    bone.quaternion.set(s.r[0], s.r[1], s.r[2], s.r[3])
    bone.position.set(s.t[0], s.t[1], s.t[2])
    bone.updateMatrixWorld(true)
    this._poseDirty = true
    this._emitTransform()
    this._emitHistory()
  }

  resetAll() {
    if (!this.bindSnapshot) return
    applySnapshot(this.bones, this.bindSnapshot)
    this._poseDirty = true
    this.commit(() => t('history.resetPose'))
    this._emitTransform()
  }

  // ─────────────────────────────────────────────────────────── pose ops ──

  getPoseSnapshot() {
    return snapshotPose(this.bones)
  }

  isDirty() {
    if (!this.bindSnapshot) return false
    return !snapshotsEqual(this.bindSnapshot, snapshotPose(this.bones))
  }

  /**
   * 镜像：在 pivot 空间中对整流姿势做关于 YZ 平面的反射，
   * 再换算回每根骨骼的本地变换，这样左右骨骼坐标轴不一致也能正确镜像。
   */
  mirrorPose() {
    if (!this.pivot) return
    this.pivot.updateMatrixWorld(true)
    const invPivot = _m2.copy(this.pivot.matrixWorld).invert()
    const reflect = new THREE.Matrix4().makeScale(-1, 1, 1)
    const worldMirrored = new Map()
    const tmp = new THREE.Matrix4()
    const rot = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scl = new THREE.Vector3()

    for (const bone of this.orderedBones) {
      tmp.multiplyMatrices(invPivot, bone.matrixWorld)
      tmp.decompose(pos, quat, scl)

      rot.makeRotationFromQuaternion(quat)
      // M' = R · M · R：绕镜像平面反射旋转
      rot.premultiply(reflect).multiply(reflect)
      const mirrorQ = new THREE.Quaternion().setFromRotationMatrix(rot)

      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(-pos.x, pos.y, pos.z),
        mirrorQ,
        scl,
      )
      worldMirrored.set(bone, m)

      const parent = this.boneParent.get(bone)
      const parentM = parent ? worldMirrored.get(parent) : new THREE.Matrix4()
      const local = new THREE.Matrix4().copy(parentM).invert().multiply(m)
      local.decompose(pos, quat, scl)
      bone.position.copy(pos)
      bone.quaternion.copy(quat)
    }

    for (const b of this.bones) b.updateMatrixWorld(true)
    this._poseDirty = true
    this.commit(() => t('history.mirror'))
    this._emitTransform()
  }

  // ─────────────────────────────────────────────────────────── history ──

  /** label 可以是字符串，也可以是函数（函数形式的标签会跟随界面语言切换） */
  commit(label = null) {
    if (!this.bindSnapshot) return
    const snap = snapshotPose(this.bones)
    const cur = this.history.stack[this.history.index]
    if (cur && snapshotsEqual(cur.snap, snap)) {
      this._emitHistory()
      return
    }
    this.history.stack.length = this.history.index + 1
    this.history.stack.push({ label: label ?? (() => t('history.adjust')), snap })
    if (this.history.stack.length > 100) this.history.stack.shift()
    this.history.index = this.history.stack.length - 1
    this._emitHistory()
  }

  undo() {
    if (this.history.index <= 0) return
    this.history.index--
    this._applyHistory()
  }

  redo() {
    if (this.history.index >= this.history.stack.length - 1) return
    this.history.index++
    this._applyHistory()
  }

  _applyHistory() {
    const item = this.history.stack[this.history.index]
    if (!item) return
    applySnapshot(this.bones, item.snap)
    this._poseDirty = true
    this._emitTransform()
    this._emitHistory()
  }

  // ───────────────────────────────────────────────────────── pose file ──

  getPoseDoc() {
    // 关节角度一并导出，方便人工核对 / 外部消费；导入时仍以骨骼快照为准
    const controls = {}
    for (const bone of this.bones) {
      const joint = this.jointOf(bone)
      if (!joint) continue
      const bind = this.bindSnapshot[bone.uuid]
      const bindQuat = new THREE.Quaternion(bind.r[0], bind.r[1], bind.r[2], bind.r[3])
      const values = decomposeJoint(joint, bindQuat, bone.quaternion, {})
      for (const [key, value] of Object.entries(values)) controls[`${joint.id}.${key}`] = value
      const offset = offsetControl(joint)
      if (offset) controls[`${joint.id}.${offset.key}`] = Math.round(this._currentOffset(bone, offset) * 1000) / 1000
    }
    return {
      ...exportPose(this.bones, snapshotPose(this.bones), {
        model: this.modelName || MODEL_NAME,
        label: 'pose',
      }),
      controls,
      // 指令流：{ bone, axis, deg } / { bone, move }，父先子后依次重放即可还原同一个姿势
      commands: this.exportCommands(),
    }
  }

  applyPoseDoc(doc) {
    const snap = importPose(this.bones, doc)
    applySnapshot(this.bones, snap)
    this._poseDirty = true
    this._emitTransform()
    this.commit(() => t('history.import'))
  }

  captureImage({
    maxWidth = 0,
    mime = 'image/png',
    quality = 0.95,
    background = null,
    hideHelpers = true,
  } = {}) {
    // 截图 / 缩略图里不要出现骨架叠加层
    const jointsWas = this.jointGroup?.visible
    const linesWas = this.lines?.visible
    if (hideHelpers) {
      if (this.jointGroup) this.jointGroup.visible = false
      if (this.lines) this.lines.visible = false
    }

    this.renderer.render(this.scene, this.camera)
    const src = this.renderer.domElement

    if (hideHelpers) {
      if (this.jointGroup) this.jointGroup.visible = jointsWas
      if (this.lines) this.lines.visible = linesWas
    }
    const scale = maxWidth && src.width > maxWidth ? maxWidth / src.width : 1
    const w = Math.max(1, Math.round(src.width * scale))
    const h = Math.max(1, Math.round(src.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (background) {
      ctx.fillStyle = background
      ctx.fillRect(0, 0, w, h)
    }
    if (scale === 1) {
      ctx.drawImage(src, 0, 0)
    } else {
      ctx.drawImage(src, 0, 0, w, h)
    }
    return canvas.toDataURL(mime, quality)
  }

  // ───────────────────────────────────────────────────────────── events ──

  /**
   * 全部"被改动过"的关节数据：只包含偏离绑定姿势的控制项，
   * 键名与姿势预设一致（leftShoulder.spread 等），可直接当预设复用。
   */
  modifiedControls() {
    const out = {}
    if (!this.bindSnapshot) return out
    for (const bone of this.orderedBones) {
      const joint = this.jointOf(bone)
      if (!joint) continue
      const bind = this.bindSnapshot[bone.uuid]
      if (!bind) continue
      const bindQuat = new THREE.Quaternion(bind.r[0], bind.r[1], bind.r[2], bind.r[3])
      const angles = decomposeJoint(joint, bindQuat, bone.quaternion, {})
      for (const control of joint.controls) {
        if (control.offset) continue
        const value = angles[control.key]
        if (value === undefined || Math.abs(value) < 0.05) continue
        out[`${joint.id}.${control.key}`] = value
      }
      const offset = offsetControl(joint)
      if (offset) {
        const value = this._currentOffset(bone, offset)
        if (Math.abs(value) >= 0.0005) {
          out[`${joint.id}.${offset.key}`] = Math.round(value * 1000) / 1000
        }
      }
    }
    return out
  }

  /**
   * 导出「世界轴 + 角度」的骨骼指令流，方便交给别的引擎 / 脚本重放。
   *
   * 重放约定：把世界轴用父级世界四元数的逆转到父坐标系，再前乘到骨骼当前的
   * 局部四元数上，父先子后依次处理。反解：当前局部朝向与绑定朝向的差量 q 满足
   * q · L_bind = L_now，即 q = L_now · L_bind⁻¹；把 q 的轴转回世界坐标系
   * （用当前姿势下父级的世界四元数），重放时会被原样转回父坐标系。
   *
   * 因此按本函数的顺序重放这些指令，摆出来的姿势与编辑器里完全一致。
   */
  exportCommands() {
    const out = []
    if (!this.bindSnapshot) return out
    this.scene.updateMatrixWorld(true)

    const bindQuat = new THREE.Quaternion()
    const parentWorld = new THREE.Quaternion()
    const delta = new THREE.Quaternion()
    const axis = new THREE.Vector3()
    const pos = new THREE.Vector3()

    for (const bone of this.orderedBones) {
      const bind = this.bindSnapshot[bone.uuid]
      if (!bind || !bone.parent) continue
      bone.parent.getWorldQuaternion(parentWorld)
      bindQuat.set(bind.r[0], bind.r[1], bind.r[2], bind.r[3])

      // 旋转：差量四元数的轴角（w 取正，保证角度落在 [0, π]）
      delta.copy(bone.quaternion).multiply(bindQuat.clone().invert())
      if (delta.w < 0) delta.set(-delta.x, -delta.y, -delta.z, -delta.w)
      const sin = Math.hypot(delta.x, delta.y, delta.z)
      const deg = (2 * Math.atan2(sin, delta.w) * 180) / Math.PI
      if (deg > 1e-3 && sin > 1e-9) {
        axis.set(delta.x / sin, delta.y / sin, delta.z / sin).applyQuaternion(parentWorld)
        out.push({
          bone: bone.name,
          kind: 'rotate',
          axis: [+axis.x.toFixed(6), +axis.y.toFixed(6), +axis.z.toFixed(6)],
          deg: +deg.toFixed(4),
        })
      }

      // 位移：重放约定是「move / 父级世界缩放 → 用父级世界四元数的逆转回父坐标系 →
      // 叠加到 child.position」，反过来解就是 move = 父坐标系位移 × 父级世界缩放
      pos.set(
        bone.position.x - bind.t[0],
        bone.position.y - bind.t[1],
        bone.position.z - bind.t[2],
      )
      if (pos.lengthSq() > 1e-10) {
        pos.applyQuaternion(parentWorld)
        bone.parent.getWorldScale(_v2)
        pos.multiply(_v2)
        out.push({
          bone: bone.name,
          kind: 'move',
          move: [+pos.x.toFixed(6), +pos.y.toFixed(6), +pos.z.toFixed(6)],
        })
      }
    }
    return out
  }

  /** 外部改了姿态数据后，把最新状态推给 UI */
  syncUi() {
    this._emitTransform()
    this._emitHistory()
  }

  _emitTransform() {
    const bone = this.selected
    const semantic = this.semanticState(bone)
    this.cb.onTransform?.({
      semantic,
      controls: this.modifiedControls(),
      valid: !!semantic,
    })
  }

  _emitHistory() {
    this.cb.onHistory?.({
      canUndo: this.history.index > 0,
      canRedo: this.history.index < this.history.stack.length - 1,
      dirty: this.isDirty(),
      label: this.history.stack[this.history.index]?.label ?? '',
      count: this.history.stack.length,
      index: this.history.index,
    })
  }

  // ────────────────────────────────────────────────────────────── frame ──

  resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  _updateSkeleton() {
    if (!this.lines || !this.segments) return
    const posAttr = this.lines.geometry.getAttribute('position')
    const arr = posAttr.array
    let i = 0
    for (const [parent, child] of this.segments) {
      parent.getWorldPosition(_v1)
      child.getWorldPosition(_v2)
      arr[i++] = _v1.x
      arr[i++] = _v1.y
      arr[i++] = _v1.z
      arr[i++] = _v2.x
      arr[i++] = _v2.y
      arr[i++] = _v2.z
    }
    posAttr.needsUpdate = true
    this.lines.geometry.computeBoundingSphere()

    for (const m of this.jointMeshes || []) {
      m.userData.bone.getWorldPosition(m.position)
    }
  }

  _tick() {
    if (this._disposed) return
    this._raf = requestAnimationFrame(this._tick)
    const dt = Math.min(this._clock.getDelta(), 0.1)

    if (this._tween) {
      const tw = this._tween
      tw.t = Math.min(1, tw.t + dt / tw.dur)
      const k = smoothstep(tw.t)
      this.orbit.target.lerpVectors(tw.fromTarget, tw.toTarget, k)
      this.camera.position.lerpVectors(tw.fromCam, tw.toCam, k)
      if (tw.t >= 1) this._tween = null
    }

    // 悬停拾取（节流；按住鼠标调整视角时不更新）
    if (this._pointer.downTime) {
      this._hoverPending = false
    } else if (this._hoverPending) {
      const now = performance.now()
      if (now - this._hoverTime > 60) {
        this._hoverTime = now
        this._hoverPending = false
        this._setHovered(this.pick(this._pointer.x, this._pointer.y))
      }
    }

    this.orbit.update()
    if (this._poseDirty) {
      this._updateSkeleton()
      this._poseDirty = false
    }
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this._disposed = true
    if (this._raf) cancelAnimationFrame(this._raf)
    this._ro?.disconnect()
    const dom = this.renderer?.domElement
    if (dom) {
      dom.removeEventListener('pointerdown', this._onPointerDown)
      dom.removeEventListener('pointermove', this._onPointerMove)
      dom.removeEventListener('pointerup', this._onPointerUp)
      dom.removeEventListener('pointerleave', this._onPointerLeave)
    }
    this.orbit?.dispose()
    this.scene?.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        for (const m of mats) {
          for (const v of Object.values(m)) if (v && v.isTexture) v.dispose()
          m.dispose()
        }
      }
    })
    this.envRT?.dispose()
    this.renderer?.dispose()
    if (dom && dom.parentNode) dom.parentNode.removeChild(dom)
  }
}
