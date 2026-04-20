import * as THREE from 'three';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import { getDatabase, ref, onValue, set, update, remove } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAT1D7QFpNpTgsIW-n8qyi8TwzI252rCJ8",
  authDomain: "catsblock-game.firebaseapp.com",
  projectId: "catsblock-game",
  databaseURL: "https://catsblock-game-default-rtdb.firebaseio.com",
  storageBucket: "catsblock-game.firebasestorage.app",
  messagingSenderId: "912361601789",
  appId: "1:912361601789:web:84264c7e4a4e86e93f9c94"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rdb = getDatabase(app);

let currentServerId = "server_abc_123";
let gameOwnerId = null;

// --- AUTH & AUDIT ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('home-screen').classList.remove('hidden');
        await saveAudit(user);
        startKickListener(user.uid);
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
    }
});

async function saveAudit(user) {
    const res = await fetch('https://api.ipify.org?format=json');
    const { ip } = await res.json();
    await setDoc(doc(db, "audit", user.uid), {
        name: user.displayName,
        ip: ip,
        device: navigator.userAgent,
        timestamp: Date.now()
    });
}

// --- KICK LOGIC ---
function startKickListener(uid) {
    onValue(ref(rdb, `servers/${currentServerId}/players/${uid}/kickStatus`), (snap) => {
        if (snap.exists()) {
            const data = snap.val();
            document.body.innerHTML = `<div class="flex-center" style="background:#000;color:white;height:100vh;">
                <h1 style="color:red">Kicked</h1><p>${data.reason}</p><p>Code: ${data.code}</p>
                <button onclick="location.reload()" class="btn-purple">Leave</button></div>`;
        }
    });
}

// --- GAME LOGIC ---
async function joinServer(serverId) {
    currentServerId = serverId;
    
    // Pegar quem é o dono do jogo no Firestore
    const gameSnap = await getDoc(doc(db, "games", "game_id_here"));
    gameOwnerId = gameSnap.data().ownerId;

    if (auth.currentUser.uid === gameOwnerId) {
        document.getElementById('btn-mod').classList.remove('hidden');
    }

    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    
    // Entrar no RTDB
    set(ref(rdb, `servers/${serverId}/players/${auth.currentUser.uid}`), {
        name: auth.currentUser.displayName,
        photo: auth.currentUser.photoURL
    });

    initThreeJS();
}

function initThreeJS() {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas') });
    renderer.setSize(window.innerWidth, window.innerHeight);
    
    const floor = new THREE.Mesh(new THREE.BoxGeometry(50, 1, 50), new THREE.MeshStandardMaterial({ color: 0x228b22 }));
    scene.add(floor);
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    camera.position.set(0, 5, 10);
    camera.lookAt(0,0,0);

    function animate() { requestAnimationFrame(animate); renderer.render(scene, camera); }
    animate();
}

// Eventos de botão
document.getElementById('btn-login').onclick = () => signInWithPopup(auth, new GoogleAuthProvider());
document.getElementById('btn-create-game').onclick = () => joinServer("server_001");
document.getElementById('btn-mod').onclick = () => {
    document.getElementById('mod-menu').classList.remove('hidden');
    // Listar jogadores para o dono chutar
    onValue(ref(rdb, `servers/${currentServerId}/players`), (snap) => {
        const list = document.getElementById('player-list');
        list.innerHTML = "";
        snap.forEach(p => {
            if (p.key !== auth.currentUser.uid) {
                const div = document.createElement('div');
                div.className = "player-row";
                div.innerHTML = `<span>${p.val().name}</span><button onclick="kickPlayer('${p.key}')">Kick</button>`;
                list.appendChild(div);
            }
        });
    });
};

window.kickPlayer = (targetUid) => {
    update(ref(rdb, `servers/${currentServerId}/players/${targetUid}/kickStatus`), {
        code: 999,
        reason: "You were kicked out by the game's owner."
    });
};

