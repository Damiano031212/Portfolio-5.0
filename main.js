// sfera_alt.js
// Sfera alternativa per altre pagine
// - Comportamento "Sleep/Wake": Parte in basso, sale col mouse, scende dopo 1 min
// - Saltelli di invito quando è in basso
// - Salto di arrivo specifico quando raggiunge il centro
// - Fluttuazione continua
// - Rotazione controllata dal mouse
// - Spin al click sull’asse Z
// - Responsive Pixel-Perfect (Width scala, Height fissa il FOV)

// ------------------------------
// Variabili globali Three.js
// ------------------------------
let scene_alt, camera_alt, renderer_alt, sphere_alt;
let videoSfondo, textureSfondo_alt;
let clock_alt = new THREE.Clock();
let raycaster_alt = new THREE.Raycaster();

// ------------------------------
// Variabili di Stato e Logica
// ------------------------------
let mouse_alt = new THREE.Vector2();
let targetRotation_alt = new THREE.Vector2(0, 0);

// Configurazioni Posizione
let sphereSize_alt = 0.7;
let centerY = 0;        // Posizione attiva
let hiddenY = -7;     // Posizione "in basso" (dormiente)
let currentBaseY = hiddenY; // La Y base attuale (senza fluttuazione)

// Stati
let isSleeping = true;        // Parte "addormentata" in basso
let isTransitioning = false;  // Se si sta muovendo tra su e giù
let lastInteractionTime = 0;  // Timestamp ultima interazione
const INACTIVITY_LIMIT = 60000; // 60 secondi (1 min)
const WAITING_JUMP_INTERVAL = 4000; // Salta ogni 4 secondi quando dorme
let lastWaitingJumpTime = 0;

// Animazioni
let spinAnimator = null;      // Per lo spin al click
let moveAnimator = null;      // Per salire/scendere
let jumpAnimator = null;      // Per i saltelli (attesa o arrivo)
let jumpOffset = 0;           // Offset verticale aggiunto dai salti
let originalZ_alt = 0;        // Rotazione Z originale

// FOV Responsive
let initialHorizontalFOV = 0;

// Supporto hover → cursor.js
window.isHoverSphere = false;

// ------------------------------
// Setup Video
// ------------------------------
function setupVideo() {
    videoSfondo = document.getElementById("videoSfondo");
    videoSfondo.muted = true;
    videoSfondo.loop = true;
    videoSfondo.play().catch(() => {
        console.log("Autoplay bloccato dal browser");
    });

    textureSfondo_alt = new THREE.VideoTexture(videoSfondo);
    textureSfondo_alt.minFilter = THREE.LinearFilter;
    textureSfondo_alt.magFilter = THREE.LinearFilter;
}

// ------------------------------
// Init
// ------------------------------
function initAltSphere() {
    scene_alt = new THREE.Scene();

    camera_alt = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera_alt.position.z = 9;

    // Calcolo FOV Orizzontale per responsive corretto
    const vFOV = THREE.MathUtils.degToRad(camera_alt.fov);
    const aspect = window.innerWidth / window.innerHeight;
    initialHorizontalFOV = 2 * Math.atan(Math.tan(vFOV / 2) * aspect);

    renderer_alt = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer_alt.setSize(window.innerWidth, window.innerHeight);
    renderer_alt.setPixelRatio(window.devicePixelRatio);

    document.getElementById("container").appendChild(renderer_alt.domElement);

    setupVideo();
    createAltSphere();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene_alt.add(ambientLight);

    // Inizializza il tempo
    lastInteractionTime = performance.now();
    lastWaitingJumpTime = performance.now();

    // Eventi
    window.addEventListener("resize", onAltResize);
    document.addEventListener("mousemove", onAltMouseMove);
    window.addEventListener("click", onAltClick);

    animateAltSphere();
}

// ------------------------------
// Creazione Sfera
// ------------------------------
function createAltSphere() {
    const geometry = new THREE.SphereGeometry(sphereSize_alt, 64, 64);
    const material = new THREE.MeshBasicMaterial({ map: textureSfondo_alt, side: THREE.DoubleSide });

    sphere_alt = new THREE.Mesh(geometry, material);
    sphere_alt.rotation.y = -Math.PI / 2;
    originalZ_alt = sphere_alt.rotation.z;
    
    // Posizione iniziale: IN BASSO
    sphere_alt.position.y = hiddenY;
    
    // Scala iniziale
    adjustSphereScale();

    scene_alt.add(sphere_alt);
}

// ------------------------------
// Logica Interazione & "Wake Up"
// ------------------------------
function onAltMouseMove(event) {
    const rect = renderer_alt.domElement.getBoundingClientRect();
    mouse_alt.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse_alt.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Aggiorna rotazione target
    targetRotation_alt.x = -mouse_alt.y * 0.5;
    targetRotation_alt.y = mouse_alt.x * 0.5;

    checkAltHover();

    // Aggiorna timestamp ultima attività
    lastInteractionTime = performance.now();

    // SE È DORMIENTE O STA SCENDENDO -> SVEGLIALO
    if (isSleeping) {
        wakeUpSphere();
    }
}

// Funzione: Porta la sfera al centro
function wakeUpSphere() {
    if (!isSleeping && !isTransitioning) return; // Già sveglia

    isSleeping = false;
    isTransitioning = true;
    
    // Cancella eventuali salti di attesa in corso
    if (jumpAnimator) cancelAnimationFrame(jumpAnimator);
    jumpOffset = 0; 

    // Anima da posizione attuale a centerY (0)
    const startY = currentBaseY;
    const endY = centerY;
    const startTime = performance.now();
    const duration = 1200; // Tempo per salire (ms)

    if (moveAnimator) cancelAnimationFrame(moveAnimator);

    function moveUpStep(now) {
        const t = Math.min(1, (now - startTime) / duration);
        // Easing: easeOutCubic
        const ease = 1 - Math.pow(1 - t, 3);

        currentBaseY = startY + (endY - startY) * ease;

        if (t < 1) {
            moveAnimator = requestAnimationFrame(moveUpStep);
        } else {
            currentBaseY = endY;
            isTransitioning = false;
            // Arrivata al centro: fai il salto di benvenuto
            performArrivalJump();
        }
    }
    moveAnimator = requestAnimationFrame(moveUpStep);
}

// Funzione: Manda la sfera in basso
function goToSleep() {
    if (isSleeping) return;

    isSleeping = true;
    isTransitioning = true;

    const startY = currentBaseY;
    const endY = hiddenY;
    const startTime = performance.now();
    const duration = 1500; // Tempo per scendere (più lento)

    if (moveAnimator) cancelAnimationFrame(moveAnimator);
    // Cancella eventuali salti di arrivo residui
    if (jumpAnimator) cancelAnimationFrame(jumpAnimator);
    jumpOffset = 0;

    function moveDownStep(now) {
        const t = Math.min(1, (now - startTime) / duration);
        // Easing: easeInOutQuad
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        currentBaseY = startY + (endY - startY) * ease;

        if (t < 1) {
            moveAnimator = requestAnimationFrame(moveDownStep);
        } else {
            currentBaseY = endY;
            isTransitioning = false;
            // Reset timer salti attesa
            lastWaitingJumpTime = performance.now();
        }
    }
    moveAnimator = requestAnimationFrame(moveDownStep);
}

// ------------------------------
// Gestione Salti (Arrivo & Attesa)
// ------------------------------

// 1. Salto di Arrivo (Benvenuto al centro)
function performArrivalJump() {
    if (jumpAnimator) cancelAnimationFrame(jumpAnimator);

    const startTime = performance.now();
    const duration = 600; 
    const height = 0.5; // Altezza del balzo

    function jumpStep(now) {
        const t = Math.min(1, (now - startTime) / duration);
        
        // Parabola semplice: sin(t * PI)
        if (t < 1) {
            // Easing personalizzato per renderlo "gommoso"
            jumpOffset = Math.sin(t * Math.PI) * height;
            jumpAnimator = requestAnimationFrame(jumpStep);
        } else {
            jumpOffset = 0;
        }
    }
    jumpAnimator = requestAnimationFrame(jumpStep);
}

// 2. Salto di Attesa (Quando è in basso)
function performWaitingJump() {
    if (jumpAnimator) cancelAnimationFrame(jumpAnimator);

    const startTime = performance.now();
    const duration = 500; // Salto rapido
    const height = 0.8;   // Salto visibile dal basso

    function waitJumpStep(now) {
        const t = Math.min(1, (now - startTime) / duration);
        
        if (t < 1) {
            // Salto secco
            jumpOffset = Math.sin(t * Math.PI) * height;
            jumpAnimator = requestAnimationFrame(waitJumpStep);
        } else {
            jumpOffset = 0;
        }
    }
    jumpAnimator = requestAnimationFrame(waitJumpStep);
}


// ------------------------------
// Logica Spin al Click (Esistente)
// ------------------------------
function onAltClick(event) {
    // Funziona solo se la sfera è "Sveglia" (al centro)
    if (isSleeping && !isTransitioning) return;

    raycaster_alt.setFromCamera(mouse_alt, camera_alt);
    const hits = raycaster_alt.intersectObject(sphere_alt);
    if (hits.length === 0) return;

    startSpinWithBounce();
}

function startSpinWithBounce() {
    if (spinAnimator) cancelAnimationFrame(spinAnimator);

    const startZ = sphere_alt.rotation.z;
    const targetZ = startZ + (Math.PI * 4); // 2 giri
    const durationSpin = 1000;
    const startTime = performance.now();

    function spinPhase(now) {
        const t = Math.min(1, (now - startTime) / durationSpin);
        const ease = t < 1 ? (1 - Math.pow(1 - t, 3)) : 1;
        sphere_alt.rotation.z = startZ + (targetZ - startZ) * ease;

        if (t < 1) {
            spinAnimator = requestAnimationFrame(spinPhase);
        } else {
            decelerateSpin();
        }
    }
    spinAnimator = requestAnimationFrame(spinPhase);
}

function decelerateSpin() {
    let speed = 0.1;
    const decay = 0.93;

    function decayStep() {
        sphere_alt.rotation.z += speed;
        speed *= decay;
        if (speed > 0.003) {
            spinAnimator = requestAnimationFrame(decayStep);
        } else {
            startBounceReturn();
        }
    }
    spinAnimator = requestAnimationFrame(decayStep);
}

function startBounceReturn() {
    const startZ = sphere_alt.rotation.z;
    const overshoot = originalZ_alt + 0.25;
    const duration = 500;
    const start = performance.now();

    function bounceStep(now) {
        const t = Math.min(1, (now - start) / duration);
        if (t < 0.7) {
            const tt = t / 0.7;
            sphere_alt.rotation.z = startZ + (overshoot - startZ) * (1 - Math.pow(1 - tt, 3));
        } else {
            const tt = (t - 0.7) / 0.3;
            sphere_alt.rotation.z = overshoot + (originalZ_alt - overshoot) * tt;
        }
        if (t < 1) {
            spinAnimator = requestAnimationFrame(bounceStep);
        } else {
            sphere_alt.rotation.z = originalZ_alt;
        }
    }
    spinAnimator = requestAnimationFrame(bounceStep);
}

// ------------------------------
// Animation Loop Principale
// ------------------------------
function animateAltSphere() {
    requestAnimationFrame(animateAltSphere);

    const time = clock_alt.getElapsedTime();
    const now = performance.now();

    // 1. Controllo Inattività
    if (!isSleeping && !isTransitioning) {
        if (now - lastInteractionTime > INACTIVITY_LIMIT) {
            goToSleep();
        }
    }

    // 2. Controllo Salti di Attesa (Solo se dorme e non è in transizione)
    if (isSleeping && !isTransitioning) {
        if (now - lastWaitingJumpTime > WAITING_JUMP_INTERVAL) {
            performWaitingJump();
            lastWaitingJumpTime = now;
        }
    }

    if (sphere_alt) {
        // Rotazione Mouse
        sphere_alt.rotation.x += (targetRotation_alt.x - sphere_alt.rotation.x) * 0.1;
        let targetY_Rot = targetRotation_alt.y - Math.PI / 2;
        sphere_alt.rotation.y += (targetY_Rot - sphere_alt.rotation.y) * 0.1;

        // Fluttuazione (Always active)
        const floatSpeed = 2;
        const floatAmp = 0.1;
        const floatingY = Math.sin(time * floatSpeed) * floatAmp;

        // POSIZIONE FINALE Y = Base (Animata su/giù) + Fluttuazione + Salto (offset)
        sphere_alt.position.y = currentBaseY + floatingY + jumpOffset;
    }

    renderer_alt.render(scene_alt, camera_alt);
}

// ------------------------------
// Responsive & Utility
// ------------------------------
function adjustSphereScale() {
    if (!sphere_alt) return;
    // Formula fluida basata solo sulla larghezza
    const scaleFactor = (window.innerWidth / 1600) + 0.25;
    sphere_alt.scale.set(scaleFactor, scaleFactor, scaleFactor);
}

function onAltResize() {
    const newAspect = window.innerWidth / window.innerHeight;
    // Blocca FOV orizzontale
    const newVFOV = 2 * Math.atan(Math.tan(initialHorizontalFOV / 2) / newAspect);
    
    camera_alt.fov = THREE.MathUtils.radToDeg(newVFOV);
    camera_alt.aspect = newAspect;
    camera_alt.updateProjectionMatrix();
    
    renderer_alt.setSize(window.innerWidth, window.innerHeight);
    adjustSphereScale();
}

function checkAltHover() {
    raycaster_alt.setFromCamera(mouse_alt, camera_alt);
    const hits = raycaster_alt.intersectObject(sphere_alt);
    window.isHoverSphere = hits.length > 0;
}

// Start

window.addEventListener("DOMContentLoaded", initAltSphere);

