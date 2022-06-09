/////////////////////////////////////////////////////////////////////////
///// IMPORT
import './main.css'
import * as THREE from 'three'
import { TWEEN } from 'three/examples/jsm/libs/tween.module.min.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { LensDistortionShader } from '../static/shaders/LensDistortionShader.js'

/////////////////////////////////////////////////////////////////////////
//// DRACO LOADER TO LOAD DRACO COMPRESSED MODELS FROM BLENDER
const dracoLoader = new DRACOLoader()
const loader = new GLTFLoader()
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/')
dracoLoader.setDecoderConfig({ type: 'js' })
loader.setDRACOLoader(dracoLoader)

/////////////////////////////////////////////////////////////////////////
///// DIV CONTAINER CREATION TO HOLD THREEJS EXPERIENCE
const container = document.createElement('div')
document.body.appendChild(container)

/////////////////////////////////////////////////////////////////////////
///// SCENE CREATION
const scene = new THREE.Scene()
scene.background = new THREE.Color(0xc0c0c)

/////////////////////////////////////////////////////////////////////////
///// RENDERER CONFIG
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" }) // turn on antialias
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)) //set pixel ratio
renderer.setSize(window.innerWidth, window.innerHeight) // make it full screen
renderer.outputEncoding = THREE.sRGBEncoding // set color encoding
container.appendChild(renderer.domElement) // add the renderer to html div

/////////////////////////////////////////////////////////////////////////
///// CAMERAS CONFIG
const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 100)
camera.position.set(34,16,-20)
scene.add(camera)

/////////////////////////////////////////////////////////////////////////
///// MAKE EXPERIENCE FULL SCREEN
window.addEventListener('resize', () => {
    const width = window.innerWidth
    const height = window.innerHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()

    renderer.setSize(width, height)
    composer.setSize(width, height)
    renderer.setPixelRatio(2)
    m.uniforms.iResolution.value.set(width, height)
})

/////////////////////////////////////////////////////////////////////////
///// CREATE ORBIT CONTROLS
const controls = new OrbitControls(camera, renderer.domElement)

/////////////////////////////////////////////////////////////////////////
///// LOADING GLB/GLTF MODEL FROM BLENDER
loader.load('models/gltf/Skull.glb', function (gltf) {
    
    gltf.scene.traverse((obj) => {
        if (obj.isMesh) {
            sampler = new MeshSurfaceSampler(obj).build()
        }
    })

    transformMesh()
})

/////////////////////////////////////////////////////////////////////////
///// TRANSFORM MESH INTO POINTS
let sampler
let uniforms = { mousePos: {value: new THREE.Vector3()}}
let pointsGeometry = new THREE.BufferGeometry()
const cursor = {x:0, y:0}
const vertices = []
const tempPosition = new THREE.Vector3()

function transformMesh(){
    // Loop to sample a coordinate for each points
    for (let i = 0; i < 99000; i ++) {
        // Sample a random position in the model
        sampler.sample(tempPosition)
        // Push the coordinates of the sampled coordinates into the array
        vertices.push(tempPosition.x, tempPosition.y, tempPosition.z)
    }
    
    // Define all points positions from the previously created array
    pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))

    // Define the matrial of the points
    const pointsMaterial = new THREE.PointsMaterial({
        color: 0x5c0b17,
        size: 0.1,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        sizeAttenuation: true,
        alphaMap: new THREE.TextureLoader().load('particle-texture.jpg')
    })

    // Create the custom vertex shader injection
    pointsMaterial.onBeforeCompile = function(shader) {
        shader.uniforms.mousePos = uniforms.mousePos
        
        shader.vertexShader = `
          uniform vec3 mousePos;
          varying float vNormal;
          
          ${shader.vertexShader}`.replace(
          `#include <begin_vertex>`,
          `#include <begin_vertex>   
            vec3 seg = position - mousePos;
            vec3 dir = normalize(seg);
            float dist = length(seg);
            if (dist < 1.5){
              float force = clamp(1.0 / (dist * dist), -0., .5);
              transformed += dir * force;
              vNormal = force /0.5;
            }
          `
        )
    }

    // Create an instance of points based on the geometry & material
    const points = new THREE.Points(pointsGeometry, pointsMaterial)

    // Add them into the main group
    scene.add(points)

}

/////////////////////////////////////////////////////////////////////////
//// INTRO CAMERA ANIMATION USING TWEEN
function introAnimation() {
    controls.enabled = false //disable orbit controls to animate the camera
    
    new TWEEN.Tween(camera.position.set(0,-1,0 )).to({ // from camera position
        x: 2, //desired x position to go
        y: -0.4, //desired y position to go
        z: 6.1 //desired z position to go
    }, 6500) // time take to animate
    .easing(TWEEN.Easing.Quadratic.InOut).start() // define delay, easing
    .onComplete(function () { //on finish animation
        controls.enabled = true //enable orbit controls
        document.querySelector('.main--title').classList.add('ended')
        setOrbitControlsLimits() //enable controls limits
        TWEEN.remove(this) // remove the animation from memory
    })
}

introAnimation() // call intro animation on start

/////////////////////////////////////////////////////////////////////////
//// DEFINE ORBIT CONTROLS LIMITS
function setOrbitControlsLimits(){
    controls.enableDamping = true
    controls.dampingFactor = 0.04
    controls.minDistance = 0.5
    controls.maxDistance = 9
    controls.enableRotate = true
    controls.enableZoom = true
    controls.zoomSpeed = 0.5
    controls.autoRotate = true
}

/////////////////////////////////////////////////////////////////////////
///// POST PROCESSING EFFECTS
let width = window.innerWidth
let height = window.innerHeight
const renderPass = new RenderPass( scene, camera )
const renderTarget = new THREE.WebGLRenderTarget( width, height,
    {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat
    }
)

const composer = new EffectComposer(renderer, renderTarget)
composer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

/////DISTORT PASS //////////////////////////////////////////////////////////////
const distortPass = new ShaderPass( LensDistortionShader )
distortPass.material.defines.CHROMA_SAMPLES = 4
distortPass.enabled = true
distortPass.material.uniforms.baseIor.value = 0.910
distortPass.material.uniforms.bandOffset.value = 0.0019
distortPass.material.uniforms.jitterIntensity.value = 20.7
distortPass.material.defines.BAND_MODE = 2

composer.addPass( renderPass )
composer.addPass( distortPass )

/////////////////////////////////////////////////////////////////////////
//// CUSTOM SHADER ANIMATED BACKGROUND
let g = new THREE.PlaneBufferGeometry(2, 2)
let m = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    depthTest: false,
    uniforms: {
      iTime: { value: 0 },
      iResolution:  { value: new THREE.Vector2() },
      mousePos: {value: new THREE.Vector2()}
    },
    vertexShader: `
        varying vec2 vUv;
        void main(){
            vUv = uv;
            gl_Position = vec4( position, 1.0 );
        }`,
    fragmentShader: `
        varying vec2 vUv;
        uniform float iTime;
        uniform vec2 iResolution;
        uniform vec2 mousePos;

        #define N 16
        #define PI 3.14159265
        #define depth 1.0
        #define rate 0.3
        #define huecenter 0.5

        vec3 hsv2rgb( in vec3 c )
        {
            vec3 rgb = clamp( abs(mod(c.y*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, .3 );
            return c.x * mix( vec3(.1), rgb, 1.0);
        }

        void main(){
            vec2 v = gl_FragCoord.xy/iResolution.xy;
            float t = iTime * 0.08;
            float r = 1.8;
            float d = 0.0;
            for (int i = 1; i < N; i++) {
                d = (PI / float(N)) * (float(i) * 14.0);
                r += length(vec2(rate*v.y, rate*v.x)) + 1.21;
                v = vec2(v.x+cos(v.y+cos(r)+d)+cos(t),v.y-sin(v.x+cos(r)+d)+sin(t));
            }
            r = (sin(r*0.09)*0.5)+0.5;            
            vec3 hsv = vec3(
                mod(mousePos.x + huecenter, 1.0), 1.0-0.5*pow(max(r,0.0)*1.2,0.5), 1.0-0.2*pow(max(r,0.4)*2.2,6.0)
            );
            gl_FragColor = vec4(hsv2rgb(hsv), 1.0);
        }`
    })

const p = new THREE.Mesh(g, m)
scene.add(p)

m.uniforms.iResolution.value.set(width, height)

/////////////////////////////////////////////////////////////////////////
//// RENDER LOOP FUNCTION
const clock = new THREE.Clock()
function rendeLoop() {

    TWEEN.update() // update animations

    controls.update() // update orbit controls

    composer.render() //render the scene with the composer
    distortPass.material.uniforms.jitterOffset.value += 0.01
    const time = clock.getElapsedTime() 
    m.uniforms.iTime.value = time

    requestAnimationFrame(rendeLoop) //loop the render function    
}

rendeLoop() //start rendering

//////////////////////////////////////////////////
//// ON MOUSE MOVE TO GET CAMERA POSITION
document.addEventListener('mousemove', (event) => {
    event.preventDefault()
    cursor.x = event.clientX / window.innerWidth -0.5
    cursor.y = event.clientY / window.innerHeight -0.5
    uniforms.mousePos.value.set(cursor.x, cursor.y, 0)
    m.uniforms.mousePos.value.set(cursor.x, cursor.y)

}, false)