// sfera.js - VERSIONE RESPONSIVE (Auto-Adjustment)

// --- CONFIGURAZIONE RESPONSIVE ---
// Definiamo le proporzioni ideali su cui il design è basato (es. 1920x1080)
const REFERENCE_ASPECT = 1920 / 1080; 
const BASE_CAMERA_X = -10.5; // La tua posizione X originale preferita

// Configurazione Iniziale
const CAMERA_OFFSET = {
    x: BASE_CAMERA_X, 
    y: 5.5,    
    z: 26      
};

// 2. Orientamento Sfera (Rotazione Fissa / Punto di Riposo)
const SPHERE_ROTATION_Y = -110; 
const SPHERE_ROTATION_X = 0;  
const SPHERE_ROTATION_Z = 0;   


// --- variabili globali ---
let scene, camera, renderer, sphere;
let videoSfondo, textureSfondo;
let mouse = new THREE.Vector2(); 
let clock = new THREE.Clock();

const APPEAR_HEIGHT = 1800;

let sphereVisible = false;
let appearProgress = 0;
let disappearProgress = 0;
let raycaster = new THREE.Raycaster();
let sphereStartY = -1;
let sphereFinalY = 0;
let sphereSize = 0.4;

let originalZ = 0;

// Animator state
let appearAnimator = null;
let clickAnimator = null;

window.isHoverSphere = false;

// --- FUNZIONE CORE PER IL FIX RESPONSIVE ---
function updateCameraPosition() {
    if (!camera) return;

    const currentAspect = window.innerWidth / window.innerHeight;

    // CALCOLO PROPORZIONALE PURO:
    // Adatta la posizione X in base a quanto l'aspect ratio attuale 
    // differisce da quello di riferimento.
    // Se lo schermo è più "stretto" (es. barra preferiti aperta), la camera si sposta per compensare.
    camera.position.x = BASE_CAMERA_X * (currentAspect / REFERENCE_ASPECT);

    // Aggiorna la matrice di proiezione interna
    camera.aspect = currentAspect;
    camera.updateProjectionMatrix();
}

// --- easing utility ---
function cubicBezierEasing(x1, y1, x2, y2) {
    function A(a1, a2) { return 1.0 - 3.0 * a2 + 3.0 * a1; }
    function B(a1, a2) { return 3.0 * a2 - 6.0 * a1; }
    function C(a1)     { return 3.0 * a1; }
    function calcBezier(t, a1, a2) { return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t; }
    function calcBezierDerivative(t, a1, a2) { return (3.0 * A(a1, a2) * t + 2.0 * B(a1, a2)) * t + C(a1); }
    function solveCurveX(x) {
        const EPSILON = 1e-6; let t = x; 
        for (let i = 0; i < 8; i++) {
            let xEst = calcBezier(t, x1, x2) - x;
            if (Math.abs(xEst) < EPSILON) return t;
            let d = calcBezierDerivative(t, x1, x2);
            if (Math.abs(d) < 1e-6) break;
            t -= xEst / d;
        }
        let t0 = 0, t1 = 1, t2 = x;
        while (t0 < t1) {
            let xEst = calcBezier(t2, x1, x2);
            if (Math.abs(xEst - x) < EPSILON) return t2;
            if (x > xEst) t0 = t2; else t1 = t2;
            t2 = (t1 - t0) * 0.5 + t0;
        }
        return t2;
    }
    return function(t) {
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        const solvedT = solveCurveX(t);
        return calcBezier(solvedT, y1, y2);
    };
}

const appearEasing = cubicBezierEasing(0.25, 0.1, 0.25, 1); 
const clickEasing  = cubicBezierEasing(0.5, 0, 0.3, 1);     

// --- inizializzazione ---
function init() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        27,
        window.innerWidth / window.innerHeight,
        0.1, 1000
    );
    
    // Impostiamo la posizione iniziale base
    camera.position.set(CAMERA_OFFSET.x, CAMERA_OFFSET.y, CAMERA_OFFSET.z);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // Forza la dimensione corretta ignorando scrollbar iniziali
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Ottimizzazione Retina
    
    document.getElementById('container').appendChild(renderer.domElement);

    // APPLICA IL FIX IMMEDIATAMENTE ALL'AVVIO
    updateCameraPosition();

    setupVideo();
    createSphere();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('click', onClickScene);
    document.addEventListener('mousemove', onDocumentMouseMove, false);
    window.addEventListener('scroll', onScrollShowSphere);

    // Render iniziale forzato
    renderer.render(scene, camera);

    animate();
}

function setupVideo() {
    videoSfondo = document.getElementById('videoSfondo');
    textureSfondo = new THREE.VideoTexture(videoSfondo);
    textureSfondo.minFilter = THREE.LinearFilter;
    textureSfondo.magFilter = THREE.LinearFilter;
    playVideo();
}
function playVideo() {
    if (!videoSfondo) return;
    videoSfondo.play().catch(() => {});
}

function createSphere() {
    const geometry = new THREE.SphereGeometry(sphereSize, 64, 64);
    const material = new THREE.MeshBasicMaterial({
        map: textureSfondo,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0
    });
    sphere = new THREE.Mesh(geometry, material);
    
    sphere.rotation.x = THREE.MathUtils.degToRad(SPHERE_ROTATION_X);
    sphere.rotation.y = THREE.MathUtils.degToRad(SPHERE_ROTATION_Y);
    sphere.rotation.z = THREE.MathUtils.degToRad(SPHERE_ROTATION_Z);

    originalZ = sphere.rotation.z;

    sphere.position.y = sphereStartY;
    sphere.visible = false;

    scene.add(sphere);
}

function checkSphereHover() {
    if (!sphere || !sphere.visible) {
        window.isHoverSphere = false;
        return;
    }
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(sphere);
    window.isHoverSphere = intersects.length > 0;
}

function onDocumentMouseMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    mouse.x = (canvasX / rect.width) * 2 - 1;
    mouse.y = -(canvasY / rect.height) * 2 + 1;

    checkSphereHover();
}

function onScrollShowSphere() {
    if (window.scrollY > APPEAR_HEIGHT && !sphereVisible) {
        sphereVisible = true;
        appearProgress = 0;
        disappearProgress = 0;
        appearAnimatorStart();   
        sphere.visible = true;
    } else if (window.scrollY < APPEAR_HEIGHT && sphereVisible) {
        sphereVisible = false;
        disappearProgress = 0;
        appearAnimatorCancel();
        clickAnimatorCancel();
        resetAfterDisappear();
    }
}

function onClickScene(event) {
    if (!sphere || !sphere.visible) return;

    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    mouse.set(x, y);
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(sphere);

    if (intersects.length > 0) {
        clickAnimatorStart({
            fromZ: sphere.rotation.z, 
            revolutions: 3,
            duration: 1500
        });

        window.scrollTo({ top: 0, behavior: "smooth" });
    }
}

// --- ANIMATORI ---
function appearAnimatorStart() {
    appearAnimatorCancel(); 
    if (!sphere) return;
    if (appearAnimator && appearAnimator.completed) return;
    const revolutions = 1;         
    const duration = 1800;
    const startZ = originalZ; 
    const targetZ = originalZ + revolutions * Math.PI * 2;
    let startTime = null;

    appearAnimator = {
        requestId: null,
        completed: false,
        cancel() { if (this.requestId) cancelAnimationFrame(this.requestId); this.requestId = null; }
    };

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const t = Math.min(1, elapsed / duration);
        const easeT = appearEasing(t);
        sphere.rotation.z = startZ + (targetZ - startZ) * easeT;
        if (t < 1) {
            appearAnimator.requestId = requestAnimationFrame(step);
        } else {
            const settleDuration = 400;
            const settleStartZ = sphere.rotation.z;
            const settleStart = performance.now();
            function settleStep(now) {
                const el = now - settleStart;
                const tt = Math.min(1, el / settleDuration);
                const easeOut = 1 - (1 - tt) * (1 - tt);
                sphere.rotation.z = settleStartZ + (originalZ - settleStartZ) * easeOut;
                if (tt < 1) {
                    appearAnimator.requestId = requestAnimationFrame(settleStep);
                } else {
                    sphere.rotation.z = originalZ;
                    appearAnimator.completed = true;
                    appearAnimator.requestId = null;
                }
            }
            appearAnimator.requestId = requestAnimationFrame(settleStep);
        }
    }
    appearAnimator.requestId = requestAnimationFrame(step);
}

function appearAnimatorCancel() {
    if (appearAnimator && appearAnimator.requestId) {
        cancelAnimationFrame(appearAnimator.requestId);
    }
    appearAnimator = null;
}

function clickAnimatorStart({ fromZ = originalZ, revolutions = 3, duration = 1500 } = {}) {
    clickAnimatorCancel();
    if (!sphere) return;
    sphere.rotation.z = fromZ;
    const startZ = sphere.rotation.z;
    const targetZ = startZ + revolutions * 2 * Math.PI;
    const startTime = performance.now();
    let rafId = null;

    clickAnimator = {
        requestId: null,
        cancel() { if (rafId) cancelAnimationFrame(rafId); rafId = null; }
    };

    function step(now) {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const easeT = clickEasing(t);
        sphere.rotation.z = startZ + (targetZ - startZ) * easeT;
        if (t < 1) {
            rafId = requestAnimationFrame(step);
            clickAnimator.requestId = rafId;
        } else {
            const settleDuration = 350;
            const settleStartZ = sphere.rotation.z;
            const settleStart = performance.now();
            function settleStep(now2) {
                const el = now2 - settleStart;
                const tt = Math.min(1, el / settleDuration);
                const easeOut = 1 - Math.pow(1 - tt, 3);
                sphere.rotation.z = settleStartZ + (originalZ - settleStartZ) * easeOut;
                if (tt < 1) {
                    rafId = requestAnimationFrame(settleStep);
                    clickAnimator.requestId = rafId;
                } else {
                    sphere.rotation.z = originalZ;
                    clickAnimator.requestId = null;
                }
            }
            rafId = requestAnimationFrame(settleStep);
            clickAnimator.requestId = rafId;
        }
    }
    rafId = requestAnimationFrame(step);
    clickAnimator.requestId = rafId;
}

function clickAnimatorCancel() {
    if (clickAnimator && clickAnimator.requestId) {
        cancelAnimationFrame(clickAnimator.requestId);
    }
    clickAnimator = null;
}

function resetAfterDisappear() {
    if (!sphere) return;
    sphere.material.opacity = 0;
    sphere.position.y = sphereStartY;
    sphere.rotation.z = originalZ;
    sphere.visible = false;
    appearAnimator = null;
    clickAnimator = null;
}

// --- ANIMAZIONE PRINCIPALE ---
function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    if (sphere) {
        // 1. Calcolo Footer (Invariato)
        let footerPush = 0;
        const footer = document.querySelector('footer');
        if (footer) {
            const footerRect = footer.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            if (footerRect.top < viewportHeight) {
                const overlapPixels = viewportHeight - footerRect.top;
                const dist = camera.position.z - 0;
                const visibleHeight3D = 2 * Math.tan((camera.fov * Math.PI / 180) / 2) * dist;
                const pixelTo3DRatio = visibleHeight3D / viewportHeight;
                footerPush = (overlapPixels) * pixelTo3DRatio;
            }
        }

        // 2. Gestione Apparizione
        if (sphereVisible) {
            if (appearProgress < 1) appearProgress += 0.05;
            const t = appearProgress * appearProgress;
            sphere.material.opacity = t;
            sphere.position.y = (sphereStartY + (sphereFinalY - sphereStartY) * t) + footerPush;
        } else {
            if (disappearProgress < 1) disappearProgress += 0.05;
            const t = 1 - disappearProgress;
            sphere.material.opacity = t;
            sphere.position.y = (sphereStartY + (sphereFinalY - sphereStartY) * t) + footerPush;
            if (t <= 0) sphere.visible = false;
        }

        // 3. LOGICA ORIENTAMENTO (CON FIX DI SICUREZZA)
        
        sphere.updateMatrixWorld(); 
        camera.updateMatrixWorld();

        const baseRotX = THREE.MathUtils.degToRad(SPHERE_ROTATION_X);
        const baseRotY = THREE.MathUtils.degToRad(SPHERE_ROTATION_Y);

        const sphereScreenPos = sphere.position.clone();
        sphereScreenPos.project(camera);

        if (!isNaN(sphereScreenPos.x) && !isNaN(sphereScreenPos.y)) {
            
            const deltaX = mouse.x - sphereScreenPos.x;
            const deltaY = mouse.y - sphereScreenPos.y;
            const sensitivity = 0.5; 

            const targetX = baseRotX - (deltaY * sensitivity);
            const targetY = baseRotY + (deltaX * sensitivity);

            if (!isNaN(targetX) && !isNaN(targetY)) {
                sphere.rotation.x += (targetX - sphere.rotation.x) * 0.1;
                sphere.rotation.y += (targetY - sphere.rotation.y) * 0.1;
            }
        }

        // 4. LEVITAZIONE
        const speed = 2;
        const amplitude = 0.1;
        sphere.position.y += Math.sin(elapsedTime * speed) * amplitude * 0.01;
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    // Aggiornamento dimensioni canvas
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Richiamiamo la funzione di adattamento camera
    updateCameraPosition();
}

window.addEventListener('DOMContentLoaded', init);