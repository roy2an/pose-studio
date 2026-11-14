/**
 * 与 UI 无关的姿势数据处理工具。
 * 这里的所有函数都在"普通数据"上工作（不是 three 对象），方便序列化与比较。
 */

const R = (n, p = 5) => {
  const f = 10 ** p
  return Math.round(n * f) / f
}

/** 末端 Nub 骨骼默认在树里隐藏 */
export function isNub(name = '') {
  return /Nub(_\d+)?$/i.test(name)
}

/** 采集当前骨骼的姿势快照（quaternion + position，按 uuid 索引） */
export function snapshotPose(bones) {
  const out = {}
  for (const bone of bones) {
    out[bone.uuid] = {
      r: [R(bone.quaternion.x), R(bone.quaternion.y), R(bone.quaternion.z), R(bone.quaternion.w)],
      t: [R(bone.position.x), R(bone.position.y), R(bone.position.z)],
    }
  }
  return out
}

/** 应用快照（按 uuid） */
export function applySnapshot(bones, snap) {
  if (!snap) return
  for (const bone of bones) {
    const s = snap[bone.uuid]
    if (!s) continue
    bone.quaternion.set(s.r[0], s.r[1], s.r[2], s.r[3])
    bone.position.set(s.t[0], s.t[1], s.t[2])
    bone.updateMatrixWorld(true)
  }
}

/** 是否有任何差别（用于 dirty 标记） */
export function snapshotsEqual(a, b) {
  if (!a || !b) return true
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  for (const k of ka) {
    const x = a[k]
    const y = b[k]
    if (!y) return false
    if (
      x.r[0] !== y.r[0] || x.r[1] !== y.r[1] ||
      x.r[2] !== y.r[2] || x.r[3] !== y.r[3] ||
      x.t[0] !== y.t[0] || x.t[1] !== y.t[1] || x.t[2] !== y.t[2]
    ) return false
  }
  return true
}

/** 快照 -> 可移植的 JSON（按骨骼名字索引） */
export function exportPose(bones, snap, meta = {}) {
  const byName = {}
  for (const bone of bones) {
    const s = snap[bone.uuid]
    if (!s) continue
    byName[bone.name] = { r: s.r, t: s.t }
  }
  return {
    format: 'pose-studio',
    version: 1,
    createdAt: new Date().toISOString(),
    ...meta,
    bones: byName,
  }
}

/** 可移植 JSON -> uuid 快照 */
export function importPose(bones, doc) {
  if (!doc || !doc.bones) throw new Error('文件格式不正确：缺少 bones 字段')
  const out = {}
  let matched = 0
  for (const bone of bones) {
    const s = doc.bones[bone.name]
    if (!s || !Array.isArray(s.r) || !Array.isArray(s.t)) continue
    out[bone.uuid] = {
      r: s.r.map((n) => R(n)),
      t: s.t.map((n) => R(n)),
    }
    matched++
  }
  if (!matched) throw new Error('文件中的骨骼名称与当前模型不匹配')
  return out
}

export function cloneSnapshot(snap) {
  return JSON.parse(JSON.stringify(snap))
}
