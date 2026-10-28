import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import { MTLLoader, type MaterialInfo } from 'three/addons/loaders/MTLLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// < 1 recadre plus serré que l'empreinte du modèle
const ZOOM = 0.8

// Le .mtl ne décrit que du Phong : on en reprend les valeurs Blender
// (Kd, Ns, Ni) pour construire des matériaux PBR plus réalistes.
function toPhysical(
  material: THREE.Material,
  // `ni` est conservé par MTLLoader mais absent de ses types
  infos: Record<string, MaterialInfo & { ni?: number | string }>,
): THREE.Material {
  const info = infos[material.name.toLowerCase()] ?? infos[material.name] ?? {}
  material.dispose()

  // Blender exporte Kd en linéaire et Ns = (1 - roughness)² × 1000
  const [r, g, b] = info.kd ?? [1, 0.66, 0.36]
  const color = new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace)
  const ns = Number(info.ns ?? 360)
  const roughness = 1 - Math.sqrt(THREE.MathUtils.clamp(ns / 1000, 0, 1))
  const ior = Number(info.ni ?? 1)

  // Ni = 1 : métal (l'or) ; Ni > 1 : gemme transparente
  if (ior <= 1) {
    return new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness })
  }
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness,
    transmission: 1,
    thickness: 1.5,
    ior,
    attenuationColor: color,
    attenuationDistance: 1,
    specularIntensity: 1,
    envMapIntensity: 1.5,
  })
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
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.domElement.style.display = 'block'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    // fond opaque : les gemmes transmissives réfractent ce qui est derrière
    const background = getComputedStyle(host).getPropertyValue('--color-brand').trim()
    scene.background = new THREE.Color(background || '#472b2b')
    // les métaux et les gemmes ont besoin d'un environnement à refléter
    const pmrem = new THREE.PMREMGenerator(renderer)
    const envMap = pmrem.fromScene(new RoomEnvironment()).texture
    scene.environment = envMap

    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100)
    camera.position.set(0, 0, 3)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.zoomSpeed = 0.8

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host
      if (!w || !h) return
      renderer.setSize(w, h, false)
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
      const mtl = await new MTLLoader().loadAsync(src.replace(/\.obj$/i, '.mtl'))
      const obj = await new OBJLoader().loadAsync(src)
      if (disposed) return
      const infos = mtl.materialsInfo
      model = obj
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        child.material = Array.isArray(child.material)
          ? child.material.map((m) => toPhysical(m, infos))
          : toPhysical(child.material, infos)
      })
      // mettre à l'échelle puis recentrer
      model.scale.setScalar(0.01)
      const box = new THREE.Box3().setFromObject(model)
      model.position.sub(box.getCenter(new THREE.Vector3()))
      scene.add(model)

      // vue de dessus, cadrée serrée sur l'empreinte du modèle
      const size = box.getSize(new THREE.Vector3())
      const halfFov = THREE.MathUtils.degToRad(camera.fov) / 2
      const fit = Math.max(size.x / camera.aspect, size.z) / 2 / Math.tan(halfFov)
      const dist = fit * ZOOM + size.y / 2
      camera.near = dist / 100
      camera.far = dist * 100
      // léger décalage pour éviter la singularité d'OrbitControls à la verticale
      camera.position.set(0, dist, dist * 1e-4)
      camera.updateProjectionMatrix()
      // zoom libre, borné pour ne pas traverser ni perdre le modèle
      controls.minDistance = dist * 0.1
      controls.maxDistance = dist * 4
      controls.update()
    }
    load().catch((err) => console.error('HeroModel: failed to load', src, err))

    renderer.setAnimationLoop(() => {
      controls.update()
      renderer.render(scene, camera)
    })

    return () => {
      disposed = true
      renderer.setAnimationLoop(null)
      observer.disconnect()
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
      envMap.dispose()
      pmrem.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [src])

  return <div ref={hostRef} className={className} />
}
