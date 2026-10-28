import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

// HDRI de studio (Poly Haven, CC0) : reflets nets comme en bijouterie
const ENVIRONMENT_URL = `${import.meta.env.BASE_URL}hdri/studio_small_09_1k.hdr`

// largeur visible, en multiples de la largeur du pendentif
const FRAME_WIDTH = 2.6
// inclinaison maximale (radians) quand le pointeur est au bord
const MAX_TILT = 0.18
// hauteur du point d'accroche au-dessus du pendentif, en largeurs de pendentif
const HANG = 1.5
// élan donné par un glissé sur les gemmes, et ressort qui le ramène
const PUSH = 6
const MAX_SPIN = 3
const STIFFNESS = 30
const DAMPING = 2.5

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
    renderer.domElement.style.display = 'block'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    // fond opaque : les gemmes transmissives réfractent ce qui est derrière
    const background = getComputedStyle(host).getPropertyValue('--color-brand').trim()
    scene.background = new THREE.Color(background || '#472b2b')
    // les métaux et les gemmes ont besoin d'un environnement à refléter
    let envMap: THREE.Texture | null = null
    scene.environmentIntensity = 0.9

    // une lumière forte crée des étincelles sur les arêtes
    const key = new THREE.DirectionalLight(0xffffff, 1.2)
    key.position.set(2, 3, 4)
    scene.add(key)

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 1000)

    // bloom discret : seuls les reflets les plus forts brillent
    const composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.12, 0.3, 0.95)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())

    // le pendentif est accroché à ce pivot, que l'interaction incline
    const pivot = new THREE.Group()
    scene.add(pivot)

    // largeur du pendentif, pour cadrer la caméra dessus
    let focusWidth = 0
    const frame = () => {
      if (!focusWidth) return
      const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2
      const visibleWidth = focusWidth * FRAME_WIDTH
      const dist = visibleWidth / 2 / Math.tan(halfFov) / camera.aspect
      camera.position.set(0, 0, dist)
      camera.near = dist / 100
      camera.far = dist * 100
      camera.lookAt(0, 0, 0)
      camera.updateProjectionMatrix()
    }

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host
      if (!w || !h) return
      renderer.setSize(w, h, false)
      composer.setPixelRatio(renderer.getPixelRatio())
      composer.setSize(w, h)
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      camera.aspect = w / h
      frame()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    // angles du pivot (x, y, z) et leur vitesse : un ressort amorti
    const angle = new THREE.Vector3()
    const spin = new THREE.Vector3()
    // position du pointeur relative au héros, dans [-1, 1]
    const target = new THREE.Vector2()
    const raycaster = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    let gems: THREE.Object3D[] = []
    let last: { id: number; x: number; y: number } | null = null

    const onPointerMove = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = ((e.clientY - rect.top) / rect.height) * 2 - 1
      target.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1))

      // glisser sur les gemmes pousse le pendentif dans le sens du geste
      const prev = last?.id === e.pointerId ? last : null
      last = { id: e.pointerId, x: e.clientX, y: e.clientY }
      if (!prev || !gems.length) return
      ndc.set(x, -y)
      raycaster.setFromCamera(ndc, camera)
      if (!raycaster.intersectObjects(gems, false).length) return
      const dx = (e.clientX - prev.x) / rect.width
      const dy = (e.clientY - prev.y) / rect.height
      spin.x += dy * PUSH * 0.6
      spin.y += dx * PUSH * 0.5
      spin.z += dx * PUSH
      spin.clampLength(0, MAX_SPIN)
    }
    const onPointerLeave = () => {
      target.set(0, 0)
      last = null
    }
    window.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerleave', onPointerLeave)

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
        child.material = Array.isArray(child.material)
          ? child.material.map(tuneMaterial)
          : tuneMaterial(child.material)
      })
      // cube par défaut de Blender resté dans l'export
      const cube = model.getObjectByName('Cube')
      if (cube) cube.visible = false
      // le collier est modélisé à plat (le fermoir vers -Z) : on le redresse
      // pour qu'il pende face à la caméra, pendentif en bas
      model.rotation.x = Math.PI / 2
      model.updateMatrixWorld(true)

      // centrer sur le pendentif ; le reste de la chaîne sort du cadre
      const pendant = model.getObjectByName('Setting') ?? model
      const box = new THREE.Box3().setFromObject(pendant)
      model.position.sub(box.getCenter(new THREE.Vector3()))
      focusWidth = box.getSize(new THREE.Vector3()).x

      // accroché au-dessus du cadre : il se balance au lieu de tourner sur place
      const hang = focusWidth * HANG
      pivot.position.y = hang
      model.position.y -= hang
      pivot.add(model)

      gems = ['Gem_Sapphire', 'Gem_BlueTopaz', 'Setting']
        .map((name) => model?.getObjectByName(name))
        .filter((o): o is THREE.Object3D => !!o)
      frame()
    }
    load().catch((err) => console.error('HeroModel: failed to load', src, err))

    const timer = new THREE.Timer()
    const rest = new THREE.Vector3()
    const accel = new THREE.Vector3()
    renderer.setAnimationLoop((time) => {
      timer.update(time)
      const t = timer.getElapsed()
      // évite une explosion du ressort après un onglet en arrière-plan
      const dt = Math.min(timer.getDelta(), 1 / 30)

      // position de repos : suit le pointeur, plus un léger balancement
      rest.set(
        target.y * MAX_TILT * 0.6 + Math.sin(t * 0.9) * 0.01,
        target.x * MAX_TILT + Math.sin(t * 0.7) * 0.02,
        Math.sin(t * 0.5) * 0.015,
      )
      accel
        .subVectors(rest, angle)
        .multiplyScalar(STIFFNESS)
        .addScaledVector(spin, -DAMPING)
      spin.addScaledVector(accel, dt)
      angle.addScaledVector(spin, dt)
      pivot.rotation.set(angle.x, angle.y, angle.z)

      composer.render()
    })

    return () => {
      disposed = true
      renderer.setAnimationLoop(null)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerleave', onPointerLeave)
      timer.dispose()
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
      bloom.dispose()
      composer.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [src])

  return <div ref={hostRef} className={className} />
}
