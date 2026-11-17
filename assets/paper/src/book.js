// 书桌、房间和立体书的外壳。书页的大小正好等于场景的大小，所以场景全屏时书的边在画面外；
// 开头镜头从书桌推进书页，结尾拉远回到书桌、把书合上。
import * as THREE from "three";
import { makeCanvas, toTexture } from "./paper.js";
import { PAL, drawDesk, drawRoom, drawClockFace, drawCover } from "./art.js";
import { SCENE } from "./kit.js";

/** coverText = { title, subtitle }：印在封面上的书名（一般就是歌名） */
export function buildBookWorld(scene, coverText = {}) {
  const { W, H, D } = SCENE;
  const cover = new THREE.MeshStandardMaterial({ color: PAL.cover, roughness: 0.75 });
  const edge = new THREE.MeshStandardMaterial({ color: PAL.pageEdge, roughness: 0.95 });

  // 底：页块 + 封底板（场景的地面纸就放在页块上）
  const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, 0.14, D + 0.12), edge);
  baseBlock.position.set(0, -0.078, D / 2 + 0.02);
  const baseBoard = new THREE.Mesh(new THREE.BoxGeometry(W + 0.7, 0.14, D + 0.5), cover);
  baseBoard.position.set(0, -0.22, D / 2 + 0.12);
  // 背：页块 + 封面板，绕书脊翻开/合上
  const back = new THREE.Group();
  const backBlock = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, H + 0.12, 0.14), edge);
  backBlock.position.set(0, H / 2 + 0.02, -0.078);
  const coverC = makeCanvas(2048, 1024);
  drawCover(coverC.getContext("2d"), 2048, 1024, coverText);
  const coverTex = toTexture(coverC);
  coverTex.center.set(0.5, 0.5);
  coverTex.rotation = Math.PI; // 合上后平躺时从前上方看是正的
  const backBoard = new THREE.Mesh(new THREE.BoxGeometry(W + 0.7, H + 0.5, 0.14), [cover, cover, cover, cover, cover, new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.7 })]);
  backBoard.position.set(0, H / 2 + 0.12, -0.22);
  back.add(backBlock, backBoard);
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, W + 0.7, 32), cover);
  spine.rotation.z = Math.PI / 2;
  spine.position.set(0, -0.12, -0.16);
  for (const m of [baseBlock, baseBoard, backBlock, backBoard, spine]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  scene.add(baseBlock, baseBoard, back, spine);

  // 书桌
  const deskC = makeCanvas(2048, 2048);
  drawDesk(deskC.getContext("2d"), 2048, 2048, 7);
  const deskTex = toTexture(deskC);
  deskTex.wrapS = deskTex.wrapT = THREE.RepeatWrapping;
  deskTex.repeat.set(3.2, 2.2);
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(90, 62), new THREE.MeshStandardMaterial({ map: deskTex, roughness: 0.6 }));
  desk.rotation.x = -Math.PI / 2;
  desk.position.set(0, -0.292, 8);
  desk.receiveShadow = true;
  scene.add(desk);
  // 背景房间（预先虚化，当作景深）
  const room = new THREE.Mesh(new THREE.PlaneGeometry(130, 56), new THREE.MeshBasicMaterial({ map: toTexture(drawRoom(2600, 1120)), color: "#9a9a9a" }));
  room.position.set(0, 16, -23);
  scene.add(room);

  // 桌上的道具（放大到和书相称）：闹钟、铅笔。换成新片自己的道具也行
  const clock = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.58, 48), new THREE.MeshStandardMaterial({ color: "#7d2c29", roughness: 0.45, metalness: 0.2 }));
  body.rotation.x = Math.PI / 2;
  const faceC = makeCanvas(512, 512);
  drawClockFace(faceC.getContext("2d"), 512, 512);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.87, 48), new THREE.MeshStandardMaterial({ map: toTexture(faceC), roughness: 0.7 }));
  face.position.z = 0.3;
  const bellMat = new THREE.MeshStandardMaterial({ color: "#9a3a33", roughness: 0.4, metalness: 0.3 });
  for (const s of [-1, 1]) {
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), bellMat);
    bell.position.set(s * 0.58, 1.0, 0);
    bell.rotation.z = -s * 0.5;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5), bellMat);
    leg.position.set(s * 0.6, -1.06, 0);
    leg.rotation.z = s * 0.4;
    clock.add(bell, leg);
  }
  clock.add(body, face);
  clock.position.set(10.6, 1.08, -1.6);
  clock.rotation.y = -0.35;
  const pencil = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.5, 6), new THREE.MeshStandardMaterial({ color: "#d9a93a", roughness: 0.6 }));
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.45, 6), new THREE.MeshStandardMaterial({ color: "#e8cfa4", roughness: 0.8 }));
  tip.position.y = 1.97;
  pencil.add(shaft, tip);
  pencil.rotation.set(0, 0.5, Math.PI / 2);
  pencil.position.set(9.6, -0.18, 8.2);
  for (const g of [clock, pencil]) {
    g.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    scene.add(g);
  }
  return { back, desk, room };
}
