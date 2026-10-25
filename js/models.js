/* ============================================================
 * js/models.js · CC0 GLB 模型预加载（用户指令：别手搓，去下现成模型）
 * 来源（全部 CC0 / 免费商用）：
 *  - Poly Haven  https://polyhaven.com/models  （桌/灯/门/油灯）
 *  - 3dassets.dev（帝企鹅，CC0 1.0）
 *  - Three.js 官方 addons：GLTFLoader（本地 vendor）
 * 每个模型：底心归零 + castShadow/receiveShadow 全开。
 * 加载失败自动降级（各场景保留程序化 fallback，不崩页面）。
 * ============================================================ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

const SPECS = {
  table:   { url: 'assets/models/wood_table_worn/wood_table_worn.gltf' },
  lamp:    { url: 'assets/models/desk_lamp_arm_01/desk_lamp_arm_01.gltf' },
  door:    { url: 'assets/models/rough_pine_door/rough_pine_door.gltf' },
  penguin: { url: 'assets/models/emperor_penguin.glb' },
  oil:     { url: 'assets/models/vintage_oil_lamp/vintage_oil_lamp.gltf' },
};

export const models = {};
export const readyCount = { done: 0, total: Object.keys(SPECS).length, failed: 0 };
window.__glbModels = models;   // 供 room3d / scenes 读取（加载完成后替换程序化 fallback）

function normalize(scene) {
  // 包围盒：底心归零（y 对齐地面，x/z 居中），阴影全开
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const cx = (box.min.x + box.max.x) / 2;
  const cz = (box.min.z + box.max.z) / 2;
  scene.position.x -= cx;
  scene.position.z -= cz;
  scene.position.y -= box.min.y;
  scene.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
  });
  return size;
}

/** 等比缩放到目标尺寸（宽/高/深任一为空则不受限），返回实际比例 */
export function fitModel(scene, targetW = null, targetH = null, targetD = null) {
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  let s = 1;
  if (targetW != null) s = Math.min(s, targetW / size.x);
  if (targetH != null) s = Math.min(s, targetH / size.y);
  if (targetD != null) s = Math.min(s, targetD / size.z);
  scene.scale.multiplyScalar(s);
  return s;
}

export function loadAll(onModel) {
  for (const key in SPECS) {
    loader.load(SPECS[key].url, gltf => {
      const size = normalize(gltf.scene);
      models[key] = { scene: gltf.scene, size };
      readyCount.done++;
      if (onModel) onModel(key, true);
    }, undefined, () => {
      readyCount.failed++;
      if (onModel) onModel(key, false);
    });
  }
}
