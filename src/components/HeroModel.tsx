import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

// HDRI de studio (Poly Haven, CC0) : reflets nets comme en bijouterie
const ENVIRONMENT_URL = `${import.meta.env.BASE_URL}hdri/studio_small_09_1k.hdr`;

// objets de l'export Blender à ne pas afficher
const HIDDEN = ["Cube", "Linen", "Fond"];
// marge autour du collier entier au cadrage de départ (1 = bord à bord)
const FIT_MARGIN = 1.05;
// sol invisible sous les gemmes, en hauteurs de la zone des gemmes
const FLOOR_GAP = 0.2;
// orbite : légèrement au-dessus au départ, jamais sous l'horizon
const START_POLAR = THREE.MathUtils.degToRad(75);
const MIN_POLAR = THREE.MathUtils.degToRad(10);
const MAX_POLAR = THREE.MathUtils.degToRad(88);
// va-et-vient avant le premier contact : amplitude et vitesse (2 = 30 s par tour)
const IDLE_SWEEP = THREE.MathUtils.degToRad(30);
const IDLE_SPEED = 0.8;
// gemmes : plus la valeur est haute, plus la couleur est claire (en tailles de gemme)
const GEM_CLARITY = 2;
// lueur propre des gemmes (0 = aucune)
const GEM_GLOW = 0.15;

export type Metal = "gold" | "silver";

const METALS: Record<Metal, () => THREE.MeshPhysicalMaterial> = {
  // or 18 carats poli : réflectance mesurée de l'or, un peu éclaircie, sans
  // clearcoat (un vernis donne un reflet blanc « plastique » que l'or n'a pas)
  gold: () =>
    new THREE.MeshPhysicalMaterial({
      name: "Gold",
      color: new THREE.Color().setRGB(
        1.0,
        0.8,
        0.42,
        THREE.LinearSRGBColorSpace,
      ),
      metalness: 1,
      roughness: 0.12,
      envMapIntensity: 1.2,
    }),
  // argent poli : presque blanc et très lisse, pour que chaque maillon
  // accroche un petit reflet net comme sur une photo de chaîne fine
  silver: () =>
    new THREE.MeshPhysicalMaterial({
      name: "Silver",
      color: new THREE.Color().setRGB(
        0.97,
        0.96,
        0.93,
        THREE.LinearSRGBColorSpace,
      ),
      metalness: 1,
      roughness: 0.08,
      envMapIntensity: 1.3,
    }),
};

// le métal de l'export Blender, remplacé par l'or ou l'argent choisi
function isMetal(material: THREE.Material): boolean {
  return /gold|silver|steel/i.test(material.name);
}

function isGem(
  material: THREE.Material | THREE.Material[],
): material is THREE.MeshPhysicalMaterial {
  return (
    material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0
  );
}

// Le glb n'a pas de volume (KHR_materials_volume) : on en ajoute un, à
// l'échelle de la gemme, pour que la couleur se fonce dans l'épaisseur au
// lieu d'un simple verre fin.
function addGemVolume(
  gem: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>,
) {
  gem.geometry.computeBoundingBox();
  const local = gem.geometry.boundingBox!.getSize(new THREE.Vector3());
  const world = new THREE.Box3()
    .setFromObject(gem)
    .getSize(new THREE.Vector3());
  // thickness est exprimé en unités locales, attenuationDistance en unités monde
  gem.material.thickness = Math.max(local.x, local.y, local.z) * 0.35;
  gem.material.attenuationColor.copy(gem.material.color);
  gem.material.attenuationDistance =
    Math.max(world.x, world.y, world.z) * GEM_CLARITY;
}

// Gemmes plus lumineuses : reflets du studio renforcés, légère dispersion
// (« feu » coloré sur les facettes) et une lueur de leur propre couleur pour
// qu'elles ne s'assombrissent pas devant le fond marron.
function brightenGem(material: THREE.MeshPhysicalMaterial) {
  material.envMapIntensity = 2;
  material.specularIntensity = 1;
  material.dispersion = 0.3;
  material.emissive.copy(material.color);
  material.emissiveIntensity = GEM_GLOW;
}

// L'OutputPass applique l'exposition et le tone mapping Neutral au fond aussi :
// on part de la couleur voulue à l'écran et on remonte la courbe (inverse
// exacte tant que la couleur reste sous la zone de compression, cas des bruns)
// pour que le fond ressorte exactement en --color-hero-bg.
function backgroundBeforeToneMapping(target: THREE.Color, exposure: number) {
  const { r, g, b } = target;
  const low = Math.min(r, g, b);
  // Neutral retire à chaque canal un décalage fixé par le canal le plus bas
  const offset = low < 0.04 ? Math.sqrt(low / 6.25) - low : 0.04;
  return new THREE.Color(
    (r + offset) / exposure,
    (g + offset) / exposure,
    (b + offset) / exposure,
  );
}

interface HeroModelProps {
  src: string;
  metal: Metal;
  className?: string;
  /** Clear WebGL clear-color so the craft/veil shows through (reveal overlay). */
  transparentBackground?: boolean;
  /** false: only turn left/right and zoom; no tilt up/down, no pan. */
  freeOrbit?: boolean;
}

export default function HeroModel({
  src,
  metal,
  className,
  transparentBackground = false,
  freeOrbit = true,
}: HeroModelProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const metalRef = useRef(metal);
  const applyMetalRef = useRef<((metal: Metal) => void) | null>(null);

  // changer de métal ne recharge pas le modèle : on échange le matériau
  useEffect(() => {
    metalRef.current = metal;
    applyMetalRef.current?.(metal);
  }, [metal]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Khronos PBR Neutral : conçu pour le rendu produit, il garde la teinte des
    // métaux là où ACES tire l'or vers l'orange et délave les reflets
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 0.85;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setClearColor(0x000000, transparentBackground ? 0 : 1);
    renderer.domElement.style.display = "block";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    if (transparentBackground) {
      scene.background = null;
    } else {
      // fond opaque : les gemmes transmissives réfractent ce qui est derrière
      const background = getComputedStyle(host)
        .getPropertyValue("--color-hero-bg")
        .trim();
      scene.background = backgroundBeforeToneMapping(
        new THREE.Color(background || "#241818"),
        renderer.toneMappingExposure,
      );
    }
    // les métaux et les gemmes ont besoin d'un environnement à refléter
    let envMap: THREE.Texture | null = null;
    scene.environmentIntensity = 0.9;

    // lumière de face, en hauteur : étincelles sur les arêtes et ombre au sol
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 6;
    key.shadow.bias = -0.0005;
    scene.add(key, key.target);

    // lumière rasante de côté, comme un soleil bas : fait scintiller les maillons
    const glint = new THREE.DirectionalLight(0xfff4e6, 2);
    scene.add(glint);

    // sol invisible qui ne reçoit que l'ombre, juste sous les gemmes
    const floorMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.visible = false;
    scene.add(floor);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000);

    // bloom discret : seuls les reflets les plus forts brillent
    // (le bloom garde l'alpha : le fond transparent du reveal reste transparent)
    const composer = new EffectComposer(renderer);
    // sur le voile clair du reveal le halo se voit beaucoup plus : bloom réduit
    const bloom = transparentBackground
      ? new UnrealBloomPass(new THREE.Vector2(1, 1), 0.08, 0.1, 0.98)
      : new UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.15, 0.95);
    composer.addPass(new RenderPass(scene, camera));
    // rayon serré : les reflets des maillons deviennent de petites étincelles
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // la caméra fait le tour complet des gemmes et passe au-dessus,
    // jamais sous le sol
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    // deux doigts : pincer pour zoomer et glisser pour déplacer la scène
    // (souris : clic droit ou Maj + glisser)
    controls.enablePan = freeOrbit;
    controls.screenSpacePanning = true;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    controls.zoomSpeed = 0.8;
    // sans orbite libre, la hauteur de vue reste celle du départ
    controls.minPolarAngle = freeOrbit ? MIN_POLAR : START_POLAR;
    controls.maxPolarAngle = freeOrbit ? MAX_POLAR : START_POLAR;
    // glisser vers le haut / bas fait défiler la page au lieu du modèle
    if (!freeOrbit) renderer.domElement.style.touchAction = "pan-y";

    // avant le premier contact : lent va-et-vient gauche / droite
    controls.autoRotate = true;
    controls.autoRotateSpeed = IDLE_SPEED;
    // le déplacement reste autour du collier et au-dessus du sol invisible
    const panBounds = new THREE.Box3();
    const keepTargetInBounds = () => {
      if (panBounds.isEmpty()) return;
      const before = controls.target.clone();
      panBounds.clampPoint(controls.target, controls.target);
      // décaler la caméra d'autant, pour ne pas la faire pivoter
      camera.position.add(controls.target.clone().sub(before));
    };
    controls.addEventListener("change", keepTargetInBounds);

    const stopIdle = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener("start", stopIdle);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    const metalMaterials = { gold: METALS.gold(), silver: METALS.silver() };

    let disposed = false;
    let model: THREE.Object3D | null = null;
    const load = async () => {
      const [hdr, gltf] = await Promise.all([
        new HDRLoader().loadAsync(ENVIRONMENT_URL),
        new GLTFLoader().loadAsync(src),
      ]);
      if (disposed) {
        hdr.dispose();
        return;
      }
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      envMap = hdr;
      scene.environment = hdr;
      model = gltf.scene;
      const metalMeshes: THREE.Mesh[] = [];
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        if (isGem(child.material)) brightenGem(child.material);
        else if (!Array.isArray(child.material) && isMetal(child.material)) {
          child.material.dispose();
          metalMeshes.push(child);
        }
      });
      applyMetalRef.current = (next) => {
        for (const mesh of metalMeshes) mesh.material = metalMaterials[next];
      };
      applyMetalRef.current(metalRef.current);
      // cube par défaut de Blender, tissu et fond de présentation : on a déjà
      // un fond et un sol d'ombre
      for (const name of HIDDEN) {
        const object = model.getObjectByName(name);
        if (object) object.visible = false;
      }
      // un collier modélisé à plat (le fermoir vers -Z) est redressé pour que
      // les gemmes pendent et que la chaîne remonte à gauche et à droite ;
      // un collier déjà vertical (fermoir vers +Y) est laissé tel quel
      const upright = new THREE.Box3();
      model.updateMatrixWorld(true);
      model.traverseVisible((child) => {
        if (child instanceof THREE.Mesh) upright.expandByObject(child);
      });
      const extent = upright.getSize(new THREE.Vector3());
      if (extent.y < extent.z) model.rotation.x = Math.PI / 2;
      model.updateMatrixWorld(true);

      // les gemmes (matériaux transmissifs) à l'origine
      const box = new THREE.Box3();
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh) || !isGem(child.material)) return;
        addGemVolume(child);
        box.expandByObject(child);
      });
      if (box.isEmpty()) box.setFromObject(model);
      model.position.sub(box.getCenter(new THREE.Vector3()));
      scene.add(model);
      const size = box.getSize(new THREE.Vector3());

      floor.position.y = -size.y * (0.5 + FLOOR_GAP);
      floor.scale.setScalar(size.x * 40);
      // shadow plane only when the canvas has an opaque backdrop
      floor.visible = !transparentBackground;

      // cadrage : le collier entier (sans les objets masqués), sous tous les
      // angles de l'orbite, grâce à sa sphère englobante
      const necklace = new THREE.Box3();
      model.updateMatrixWorld(true);
      model.traverseVisible((child) => {
        if (child instanceof THREE.Mesh) necklace.expandByObject(child);
      });
      const sphere = necklace.getBoundingSphere(new THREE.Sphere());
      const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2;
      const halfFovH = Math.atan(Math.tan(halfFov) * camera.aspect);
      const dist =
        (sphere.radius / Math.sin(Math.min(halfFov, halfFovH))) * FIT_MARGIN;
      camera.near = dist / 100;
      camera.far = dist * 100;
      camera.updateProjectionMatrix();
      controls.target.copy(sphere.center);
      panBounds.setFromCenterAndSize(
        sphere.center,
        new THREE.Vector3().setScalar(sphere.radius * 2),
      );
      panBounds.min.y = Math.max(
        panBounds.min.y,
        floor.position.y + sphere.radius * 0.05,
      );
      camera.position
        .setFromSphericalCoords(dist, START_POLAR, 0)
        .add(sphere.center);
      controls.minDistance = dist * 0.2;
      controls.maxDistance = dist * 1.5;
      controls.update();

      // ombre portée : caméra d'ombre autour du collier entier
      key.position.set(size.x * 2, size.x * 8, size.x * 4);
      glint.position.set(-size.x * 6, size.x * 1.5, size.x * 1);
      const s = Math.max(size.x * 3, sphere.radius * 1.5);
      Object.assign(key.shadow.camera, {
        left: -s,
        right: s,
        top: s,
        bottom: -s,
      });
      key.shadow.camera.near = size.x * 0.1;
      key.shadow.camera.far = size.x * 20;
      key.shadow.camera.updateProjectionMatrix();
    };
    load().catch((err) => console.error("HeroModel: failed to load", src, err));

    renderer.setAnimationLoop(() => {
      if (controls.autoRotate) {
        // repart dans l'autre sens aux bords du balayage
        const azimuth = controls.getAzimuthalAngle();
        if (azimuth > IDLE_SWEEP) controls.autoRotateSpeed = IDLE_SPEED;
        else if (azimuth < -IDLE_SWEEP) controls.autoRotateSpeed = -IDLE_SPEED;
      }
      controls.update();
      composer.render();
    });

    return () => {
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      controls.removeEventListener("start", stopIdle);
      controls.removeEventListener("change", keepTargetInBounds);
      controls.dispose();
      model?.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        obj.geometry.dispose();
        const materials = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        for (const m of materials) {
          for (const value of Object.values(m)) {
            if (value instanceof THREE.Texture) value.dispose();
          }
          m.dispose();
        }
      });
      applyMetalRef.current = null;
      metalMaterials.gold.dispose();
      metalMaterials.silver.dispose();
      envMap?.dispose();
      floor.geometry.dispose();
      floorMaterial.dispose();
      bloom.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [src, transparentBackground, freeOrbit]);

  return <div ref={hostRef} className={className} />;
}
