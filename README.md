# Pose Studio · 角色姿势编辑器

中文 | [English](README.en.md)

基于 **Vue 3 + Three.js** 的实时角色姿势编辑器。骨骼不按 X/Y/Z 编辑，而是按「关节 + 动作」的语义方式编辑（`leftShoulder.spread`、`leftElbow.bend`……），并内置 23 个可直接套用的姿势预设。

姿势算法与 **storyai-3d-director-desk-main** 完全一致：同一份 `controls`、同一个模型，两个项目摆出来的骨骼姿态逐位相同（`npm run verify:rig` 实测最大偏差 0.0007°，即绑定快照的取整精度）。

内置示例模型：UE Mannequin（67 根骨骼），与参考工程用的是同一个 GLB。

界面支持中文 / English 双语：点顶栏右侧的 `中文 | EN` 切换，选择存在 `localStorage` 里，下次打开保持。

## 功能

- **语义化关节编辑**：左侧是「骨盆 / 脊柱 / 左肩 / 左肘 / 左髋 / 左膝……」的身体部位树，右侧是每个部位的动作滑杆（抬臂 / 收臂、前摆 / 后摆、内旋 / 外旋、屈肘、屈膝、勾脚、低头、转身……），不出现 X/Y/Z，也不出现原始骨骼名。
- **中英双语界面**：顶栏的 `中文 | EN` 一键切换，关节名、动作名、预设、手势、帮助、状态栏、提示消息全部跟随切换；历史记录里的操作说明也会跟着换语言。
- **姿势预设**：站立、T 型、行走、跑步、坐姿、蹲下、单膝跪、双膝跪、叉腰、倚靠、鞠躬、思考、格斗、踢球、投掷、推进、招手、伸手、抱臂、看手机、跳跃、飞跃、飞索。套用后自动把角色贴到地面。
- **单手手势**：选中 `leftHand` / `rightHand`（左手腕 / 右手腕）时，「关节调整」里会多出一组手势按钮——默认、持物、握拳、V字、掌、OK、竖拇指、竖中指、竖小指。手势只改该侧 15 根手指骨骼，手臂与身体姿势保持不变，作为一次操作进入历史记录。
- **视口内点选**：点击角色身体部位会选中距离最近的关节；也可以点击骨架关节球，或从左侧层级树里精确选择。视口只负责选择与观察，所有数值调整都在右侧面板完成。
- **修改数据面板**：右栏底部实时以 JSON 列出所有被改动过的关节数据（键名与预设一致），可一键复制、下载或重新导入。
- **镜像姿势**：一键左右翻转当前姿势（在模型空间做真正的反射，左右骨骼轴向不同也能正确镜像）。
- **撤销 / 重做**：滑杆确认、输入框回车、应用预设、导入、镜像、贴地等操作都会进入历史记录。
- **截图导出**：导出 PNG 时自动隐藏骨架叠加层，得到干净的角色截图。
- **载入自己的模型**：点击顶栏的模型名即可载入本地 `.glb`（需要带 `SkinnedMesh` 骨骼），模型会自动归一化到 1.8 米身高、脚底贴地。
- **快捷键**：`F` 聚焦选中关节、`B` 骨架、`G` 地面网格、`Esc` 取消选择、`⌘/Ctrl+Z` 撤销、`⇧⌘/Ctrl+Z` 重做、`?` 帮助。

## 快速开始

```bash
npm install
npm run dev        # http://localhost:5173
```

构建与预览：

```bash
npm run build
npm run preview
```

> 模型文件位于 `public/models/ue-mannequin-retopology.glb`（构建时原样拷贝）。如需换默认模型，替换该文件并修改 `src/core/PoseEditor.js` 顶部的 `MODEL_NAME`。

## 操作流程

1. 在视口里点击角色的左肩 / 任意部位，或从左侧「关节层级」中选择部位（空白处拖拽旋转视角、滚轮缩放）。
2. 在右侧「关节调整」里拖动「抬臂 / 收臂」这类语义滑杆，或在数字框中输入数值后回车；也可以点「姿势预设」里的动作一键套用。
3. 右栏底部的「修改数据」会实时列出所有改动，可复制或下载成姿势 JSON。
4. 「镜像」做左右对称；「⌘Z」撤销；相机按钮导出 PNG 截图。

## 语义控制与符号约定

每个部位有一个语义标识，动作名以 `部位.动作` 组合，例如：

| 部位 | 动作 | 说明 |
| --- | --- | --- |
| `body`（骨盆） | `pitch` / `yaw` / `roll` / `offsetY` | 前倾后仰、转身、侧倾、整体升降（米） |
| `spine` / `torso` / `neck` / `head` | `pitch` / `yaw` / `roll` | 脊柱上下段、颈、头的俯仰 / 转动 / 侧倾 |
| `leftShoulder` / `rightShoulder` | `spread` / `pitch` / `twist` | 抬臂收臂、前后摆、内外旋 |
| `leftElbow` / `rightElbow` | `bend` | 屈肘 |
| `leftHand` / `rightHand` | `roll` / `pitch` / `twist` | 手腕翻转 / 屈伸 / 内收外展 |
| `leftHip` / `rightHip` | `pitch` / `spread` / `twist` | 抬腿后摆、开胯并腿、内外旋 |
| `leftKnee` / `rightKnee` | `bend` | 屈膝 |
| `leftFoot` / `rightFoot` | `pitch` / `roll` / `twist` | 绷脚勾脚、内外翻、内外旋 |
| `leftClavicle` / `rightClavicle` | `spread` / `pitch` | 耸肩沉肩、前送后收 |
| 手指（每节一根） | `bend` | `leftFinger1_1.bend` 这类形式，1=根节 2=近节 3=远节 |

**数值含义与 storyai 一致**：控制项先换算成骨骼局部欧拉角，再像 storyai 的
`ue4ShoulderRotation` 等函数那样合成，左右两侧用同一套公式，靠数值的正负区分方向：

| 关节 | 欧拉角 (x, y, z) | storyai 对应函数 |
| --- | --- | --- |
| `body` / `spine` / `torso` | `[yaw, roll, -pitch]` | `ue4SpineRotation` |
| `neck` / `head` | `[yaw, roll, pitch]` | `ue4HeadRotation` |
| `leftShoulder` / `rightShoulder` | `[twist, spread, -pitch]` | `ue4ShoulderRotation` |
| `leftHip` / `rightHip` | `[twist, -spread, pitch]` | `ue4HipRotation` |
| `leftElbow` / `rightElbow`、膝、脚趾、手指 | `[0, 0, -bend]` | `ue4LimbBendRotation` |
| `leftHand` / `rightHand`、脚踝 | `[twist, roll, pitch]` | `ue4HandRotation` / `ue4FootRotation` |
| 锁骨（storyai 没有，按肩部风格扩展） | `[0, spread, -pitch]` | — |

所有角度应用前统一 clamp 到 **±180°**（`semanticRig.js` 的 `LIMIT`，滑杆范围与限幅共用）。
storyai 的默认档（`getBodyTypePoseLimit`）是 ±90°，会把 `pose.js` 里超过 90 的数值
（如跪姿的 126）截到 90；本项目放宽到 ±180°，这些数值按原值生效。

同一解剖动作在左右两侧书写相反数值：

```js
// T 型：左臂外展 -70、右臂 +70（与 storyai 的 t-pose 预设一致）
{ 'leftShoulder.spread': -70, 'rightShoulder.spread': 70,
  'leftShoulder.pitch': 15,  'rightShoulder.pitch': 15,
  'leftElbow.bend': 10,      'rightElbow.bend': 10 }
```

预设文件 `src/pose.js` 中的 `MANNEQUIN_POSE_PRESETS` 就是这套写法，数值逐字取自
storyai 的 `mannequinPosePresets.ts`，可原样喂给 `applySemanticMap()`。

## 姿势文件格式

```json
{
  "format": "pose-studio",
  "version": 1,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "model": "ue-mannequin-retopology.glb",
  "bones": {
    "Bip001_L_UpperArm_08": {
      "r": [-0.00229, -0.40192, -0.29116, 0.86815],
      "t": [-5.93089, 0, 0]
    }
  }
}
```

- `bones` 以骨骼名称为键，便于跨引擎使用；
- `r` 是局部四元数 `[x, y, z, w]`，`t` 是局部位置 `[x, y, z]`（父骨骼空间）；
- 导入时按名称匹配，匹配不到任何骨骼会给出提示。

导出的文件里还会带上两份可读数据（导入时仍以 `bones` 快照为准，这两项可忽略）：

- `controls`：语义键值，例如 `{"leftShoulder.spread": -70}`，格式与 storyai 的 presets 相同，可直接互用；
- `commands`：骨骼指令流 `[{ bone, kind: "rotate", axis: [x,y,z], deg }, { bone, kind: "move", move: [...] }]`，
  父先子后依次重放即可还原同一个姿势，方便喂给别的引擎。

## 项目结构

```
src/
├─ App.vue                 # 布局、加载遮罩、提示、快捷键
├─ store.js                # 响应式状态 + 所有 UI 动作（选择、历史、导入导出）
├─ i18n.js                 # 中文 / English 文案与标签取值
├─ style.css               # 设计变量与通用控件
├─ pose.js                  # 23 个姿势预设 + 9 个单手手势（语义控制表）
├─ core/
│  ├─ PoseEditor.js        # Three.js 引擎：渲染、拾取、骨架层、镜像、历史、贴地、截图
│  ├─ semanticRig.js       # 骨骼 → 关节 / 动作的映射，以及四元数 ↔ 语义角度换算
│  └─ poseUtils.js         # 姿势快照 / 序列化等纯函数
└─ components/
   ├─ TopBar.vue           # 工具栏、载入本地模型、语言切换
   ├─ BoneTree.vue         # 关节层级树（搜索 / 展开 / 末端节点）
   ├─ Inspector.vue        # 关节滑杆 + 姿势预设
   ├─ PoseJson.vue         # 修改数据 JSON 面板（含指令流复制）
   ├─ StatusBar.vue        # 状态栏
   ├─ HelpDialog.vue       # 快捷键说明
   └─ Icon.vue             # 内联 SVG 图标
```

## 技术要点

- **拾取**：优先射线检测关节球；否则对蒙皮网格做射线检测（Three.js 会应用骨骼变形），再用「点到骨段距离」找最近的骨骼，因此点手臂中段会选中整根骨骼。
- **语义换算**：`bone.quaternion = 绑定姿势 · Euler(x, y, z)`（three.js 默认 `XYZ` 顺序），与 storyai 的 `applyUE4RestPoseAndRig` 逐字对应；滑杆的当前值由 `Euler.setFromQuaternion(delta, 'XYZ')` 反解，写入时保留其余动作的当前值，因而滑杆之间不会互相覆盖。绑定姿势 = 静止姿势 · 中性偏置（大臂 ±25°、前臂 +25°），见 `semanticRig.js` 顶部注释。
- **贴地**：按 1/9 抽样对蒙皮顶点做 CPU 蒙皮，取最低点后修正骨盆升降，预设姿势因此不会陷地或悬空。
- **镜像**：在模型空间对每根骨骼的世界变换做关于 YZ 平面的反射 `M' = R·M·R`，再换算回父骨骼局部变换，逐根按层级顺序应用。
- **渲染**：ACES 色调映射 + RoomEnvironment 环境光 + 软阴影；网格地面与阴影接收面；归一化模型到世界 1.8 单位。
- **数据流**：Three.js 对象不进入 Vue 响应式系统；引擎通过回调把选择 / 变换 / 历史状态推送给 `store`，UI 只读取普通数据。

## 与 storyai-3d-director-desk-main 的一致性

参考工程的姿势应用只有三级，依次**后乘**到每根骨骼的局部四元数上
（`ue4MannequinPoseApplication.applyUE4RestPoseAndRig`）：

```
静止姿势 → 中性偏置（大臂 ±25°、前臂 +25°） → 语义控制换算出的 Euler(x, y, z)
```

本项目把前两级烘焙进「绑定姿势」（载入模型后叠一次并重新快照），所以滑杆阶段只剩
`bone.quaternion = 绑定姿势 · Euler(x, y, z)`；`decomposeJoint` 是它严格的逆运算
（`Euler.setFromQuaternion(bind⁻¹ · cur, 'XYZ')`）。

`npm run verify:rig` 不做复述式比对，而是把 storyai 的两个源文件**原样**通过 Vite
载入页面（`/@fs/<storyai>/src/editor/runtime/ue4Mannequin/ue4MannequinPoseApplication.ts`），
用同一个 GLB、同一份 `controls` 跑一遍再逐根骨骼比对四元数。实测：

```
A. 20 个预设 vs applyUE4RestPoseAndRig     最大偏差 0.0007°（= 快照 5 位小数的取整精度）
B. 200 组随机 controls（±90° 内）            最大偏差 0.0007°
C. 限幅 ±180°                               200 → 180，-200 → -180
D. 滑杆往返 compose → decompose              0.0000°
```

与参考工程仅存的两处差异（都不是姿势算法本身）：

| 对照项 | storyai | 本项目 | 说明 |
| --- | --- | --- | --- |
| `body.offsetY` 的单位 | 米 × 39.37，塞进骨盆父空间的 z 轴 | 世界 Y 上的米 | 本项目会把模型归一到 1.8 m 身高，按世界 Y 平移才不随模型缩放漂移；换算到同一尺度差 < 5 mm |
| 体型（bodyType） | 有 mannequin / slim / child 等档位，附带骨骼缩放 | 无 | 只影响骨盆 / 脊柱 1.02 倍的粗细，不影响姿势 |

## 开发自检脚本

需要本机安装 Google Chrome：

```bash
npm run dev              # 另开一个终端
npm run verify           # 功能自检：点选、语义往返、镜像、撤销、预设贴地、修改数据面板
npm run verify:ui        # UI 自检：确认界面里不出现 X/Y/Z 与原始骨骼名，滑杆/预设可用
npm run verify:shell     # 外壳自检：无变换模式/坐标系切换、视口无手柄、无姿势库、JSON 面板实时更新
npm run verify:rig       # 把 storyai 的源文件原样载入页面，逐根骨骼比对四元数（需要仓库里有 storyai-3d-director-desk-main）
npm run audit:presets    # 逐个预设打印手部位置、最低点等数值
npm run smoke            # 生产构建冒烟测试（需先 npm run build && npm run preview）
npm run shots            # 生成截图到 /tmp/pose-shots
```

## 已知限制

- 只支持带骨骼（`SkinnedMesh`）的 `.glb` / `.gltf`；`.gltf` 若引用外部贴图/二进制文件，需先打包成 `.glb`。
- 欧拉角按 `XYZ` 顺序分解（与 storyai 相同），肩 / 髋的 `spread` 接近 ±90° 时会出现万向锁，另外两个动作的数值会变得敏感。storyai 有同样的限制。
- 语义控制项与局部轴、正负号是针对内置 UE 男模标定的；换成骨骼朝向差异很大的模型时，方向和幅度可能需要重新标定（改 `semanticRig.js` 即可）。
- `verify:rig` 依赖仓库里的 `storyai-3d-director-desk-main/` 目录；删掉它会跳过这项比对。
- 手指只提供每节的「弯曲」单轴控制。
- 姿势文件与模型绑定的是骨骼名称，换模型后旧姿势可能因为名称不同而无法应用。
