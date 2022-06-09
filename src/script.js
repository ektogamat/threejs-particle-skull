/////////////////////////////////////////////////////////////////////////
///// IMPORT
import './main.css'
import * as THREE from 'three'
import { TWEEN } from 'three/examples/jsm/libs/tween.module.min.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js'

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
const renderer = new THREE.WebGLRenderer({ antialias: true}) // turn on antialias
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
    renderer.setPixelRatio(2)
})

/////////////////////////////////////////////////////////////////////////
///// CREATE ORBIT CONTROLS
const controls = new OrbitControls(camera, renderer.domElement)

/////////////////////////////////////////////////////////////////////////
///// LOADING GLB/GLTF MODEL FROM BLENDER
loader.load('models/gltf/Skull.glb', function (gltf) {
    
    gltf.scene.traverse((obj) => {
        if (obj.isMesh) {
            sampler = new MeshSurfaceSampler(obj).build();
        }
    })

    transformMesh();

})

/////////////////////////////////////////////////////////////////////////
///// TRANSFORM MESH INTO POINTS
let sampler
const cursor = {x:0, y:0}
let uniforms = { mousePos: {value: new THREE.Vector3()}}

const vertices = []
const tempPosition = new THREE.Vector3()

let pointsGeometry = new THREE.BufferGeometry()

function transformMesh(){

    // Loop to sample a coordinate for each points
    for (let i = 0; i < 9000; i ++) {
        // Sample a random position in the model
        sampler.sample(tempPosition);
        // Push the coordinates of the sampled coordinates into the array
        vertices.push(tempPosition.x, tempPosition.y, tempPosition.z);
    }
    
    // Define all points positions from the previously created array
    pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

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
    });

    pointsMaterial.onBeforeCompile = function(shader) {
        shader.uniforms.mousePos = uniforms.mousePos;
        
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
        );
    }

    // Create an instance of points based on the geometry & material
    const points = new THREE.Points(pointsGeometry, pointsMaterial);

    // Add them into the main group
    scene.add(points);

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
    .delay(1000).easing(TWEEN.Easing.Quartic.InOut).start() // define delay, easing
    .onComplete(function () { //on finish animation
        controls.enabled = true //enable orbit controls
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
    controls.minDistance = 2
    controls.maxDistance = 25
    controls.enableRotate = true
    controls.enableZoom = true
    controls.autoRotate = true
}

/////////////////////////////////////////////////////////////////////////
//// RENDER LOOP FUNCTION
function rendeLoop() {

    TWEEN.update() // update animations

    controls.update() // update orbit controls

    renderer.render(scene, camera) // render the scene using the camera

    requestAnimationFrame(rendeLoop) //loop the render function
    
}

rendeLoop() //start rendering

//////////////////////////////////////////////////
//// ON MOUSE MOVE TO GET CAMERA POSITION
document.addEventListener('mousemove', (event) => {
    event.preventDefault()

    cursor.x = event.clientX / window.innerWidth -0.5
    cursor.y = event.clientY / window.innerHeight -0.5
    uniforms.mousePos.value.set(cursor.x, cursor.y, 0);

}, false)