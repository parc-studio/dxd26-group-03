import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

// HDRI de studio (Poly Haven, CC0) : reflets nets comme en bijouterie
const ENVIRONMENT_URL = `${import.meta.env.BASE_URL}hdri/studio_small_09_1k.hdr`

// largeur visible, en multiples de la largeur du pendentif
const FRAME_WIDTH = 3
// sol invisible sous les gemmes, en hauteurs de pendentif
const FLOOR_GAP = 0.35
// orbite : légèrement au-dessus au départ, jamais sous l'horizon
const START_POLAR = THREE.MathUtils.degToRad(75)
const MIN_POLAR = THREE.MathUtils.degToRad(10)
const MAX_POLAR = THREE.MathUtils.degToRad(88)
// va-et-vient avant le premier contact : amplitude et vitesse (2 = 30 s par tour)
const IDLE_SWEEP = THREE.MathUtils.degToRad(30)
const IDLE_SPEED = 0.5

// Retouche les matériaux PBR exportés par Blender pour un rendu « bijou ».
function tuneMaterial(material: THREE.Material): THREE.Material {
  if (!(material instanceof THREE.MeshStandardMaterial)) return material

  // or poli : le clearcoat ajoute un second reflet très net par-dessus
  if (material.name === 'Gold') {
    material.dispose()
    return new THREE.MeshPhysicalMaterial({
      name: 'Gold',
      color: new THREE.Color().setRGB(1.0, 0.71, 0.29, THREE.LinearSRGBColorSpace),
      metalness: 1,
      roughness: 0.18,
      clearcoat: 0.3,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.0,
    })
  }

  // gemmes : le glb n'a pas de volume (KHR_materials_volume), on en ajoute un
  // pour que la couleur se fonce dans l'épaisseur au lieu d'un simple verre fin
  if (material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0) {
    material.thickness = 1.5
    material.attenuationColor.copy(material.color)
    material.attenuationDistance = 1
    material.envMapIntensity = 1.2
  }
  return material
}

interface HeroModelProps {
  src: string
  className?: string
}

export default function HeroModel({ src, className }: HeroModelProps) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.8
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFShadowMap
    renderer.domElement.style.display = 'block'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    // fond opaque : les gemmes transmissives réfractent ce qui est derrière
    const background = getComputedStyle(host).getPropertyValue('--color-brand').trim()
    scene.background = new THREE.Color(background || '#472b2b')
    // les métaux et les gemmes ont besoin d'un environnement à refléter
    let envMap: THREE.Texture | null = null
    scene.environmentIntensity = 0.9

    // lumière de face, en hauteur : étincelles sur les arêtes et ombre au sol
    const key = new THREE.DirectionalLight(0xffffff, 1.2)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.radius = 6
    key.shadow.bias = -0.0005
    scene.add(key, key.target)

    // sol invisible qui ne reçoit que l'ombre, juste sous les gemmes
    const floorMaterial = new THREE.ShadowMaterial({ opacity: 0.3 })
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    floor.visible = false
    scene.add(floor)

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000)

    // bloom discret : seuls les reflets les plus forts brillent
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.12, 0.3, 0.95)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())

    // la caméra fait le tour complet des gemmes et passe au-dessus,
    // jamais sous le sol
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.enablePan = false
    controls.zoomSpeed = 0.8
    controls.minPolarAngle = MIN_POLAR
    controls.maxPolarAngle = MAX_POLAR

    // avant le premier contact : lent va-et-vient gauche / droite
    controls.autoRotate = true
    controls.autoRotateSpeed = IDLE_SPEED
    const stopIdle = () => {
      controls.autoRotate = false
    }
    controls.addEventListener('start', stopIdle)

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host
      if (!w || !h) return
      renderer.setSize(w, h, false)
      composer.setPixelRatio(renderer.getPixelRatio())
      composer.setSize(w, h)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    let disposed = false
    let model: THREE.Object3D | null = null
    const load = async () => {
      const [hdr, gltf] = await Promise.all([
        new HDRLoader().loadAsync(ENVIRONMENT_URL),
        new GLTFLoader().loadAsync(src),
      ])
      if (disposed) {
        hdr.dispose()
        return
      }
      hdr.mapping = THREE.EquirectangularReflectionMapping
      envMap = hdr
      scene.environment = hdr
      model = gltf.scene
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        child.castShadow = true
        child.material = Array.isArray(child.material)
          ? child.material.map(tuneMaterial)
          : tuneMaterial(child.material)
      })
      // cube par défaut de Blender resté dans l'export
      const cube = model.getObjectByName('Cube')
      if (cube) cube.visible = false
      // le collier est modélisé à plat (le fermoir vers -Z) : on le redresse
      // pour que les gemmes pendent et que la chaîne remonte à gauche et à droite
      model.rotation.x = Math.PI / 2
      model.updateMatrixWorld(true)

      // les gemmes à l'origine
      const pendant = model.getObjectByName('Setting') ?? model
      const box = new THREE.Box3().setFromObject(pendant)
      model.position.sub(box.getCenter(new THREE.Vector3()))
      scene.add(model)
      const size = box.getSize(new THREE.Vector3())

      floor.position.y = -size.y * (0.5 + FLOOR_GAP)
      floor.scale.setScalar(size.x * 40)
      floor.visible = true

      // cadrage : assez large pour voir la chaîne monter vers les coins
      const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2
      const dist = (size.x * FRAME_WIDTH) / 2 / Math.tan(halfFov) / Math.min(camera.aspect, 1.6)
      camera.near = dist / 100
      camera.far = dist * 100
      camera.updateProjectionMatrix()
      camera.position.setFromSphericalCoords(dist, START_POLAR, 0)
      controls.target.set(0, 0, 0)
      controls.minDistance = dist * 0.4
      controls.maxDistance = dist * 2.5
      controls.update()

      // ombre portée : caméra d'ombre serrée autour du pendentif
      key.position.set(size.x * 2, size.x * 8, size.x * 4)
      const s = size.x * 3
      Object.assign(key.shadow.camera, { left: -s, right: s, top: s, bottom: -s })
      key.shadow.camera.near = 0.1
      key.shadow.camera.far = size.x * 20
      key.shadow.camera.updateProjectionMatrix()
    }
    load().catch((err) => console.error('HeroModel: failed to load', src, err))

    renderer.setAnimationLoop(() => {
      if (controls.autoRotate) {
        // repart dans l'autre sens aux bords du balayage
        const azimuth = controls.getAzimuthalAngle()
        if (azimuth > IDLE_SWEEP) controls.autoRotateSpeed = IDLE_SPEED
        else if (azimuth < -IDLE_SWEEP) controls.autoRotateSpeed = -IDLE_SPEED
      }
      controls.update()
      composer.render()
    })

    return () => {
      disposed = true
      renderer.setAnimationLoop(null)
      observer.disconnect()
      controls.removeEventListener('start', stopIdle)
      controls.dispose()
      model?.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return
        obj.geometry.dispose()
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
        for (const m of materials) {
          for (const value of Object.values(m)) {
            if (value instanceof THREE.Texture) value.dispose()
          }
          m.dispose()
        }
      })
      envMap?.dispose()
      floor.geometry.dispose()
      floorMaterial.dispose()
      bloom.dispose()
      composer.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [src])

  return <div ref={hostRef} className={className} />
}
