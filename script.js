// 🌟 1. 引入 Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 🌟 2. 你的 Firebase 配置
const firebaseConfig = {
    apiKey: "AIzaSyA3smEkfryuwXH9h-kIMHd18YLAz2NaM4I",
    authDomain: "mygoodgoodproject.firebaseapp.com",
    projectId: "mygoodgoodproject",
    storageBucket: "mygoodgoodproject.firebasestorage.app",
    messagingSenderId: "133466828365",
    appId: "1:133466828365:web:67039e0aa2fd8012127604",
    measurementId: "G-VP9YCD34SX"
};

// 初始化 Firebase (已移除重複與錯誤標籤)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ==========================================
// 1. 取得 HTML 元素
// ==========================================
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const loadingDiv = document.getElementById('loading');

const statusDisplay = document.getElementById('status-display');
const poseTitle = document.getElementById('pose-title');
const treeInfo = document.getElementById('tree-info');
const squatInfo = document.getElementById('squat-info');
const armStatusDiv = document.getElementById('arm-status');
const legStatusDiv = document.getElementById('leg-status');
const squatStatusDiv = document.getElementById('squat-status');

const btnTree = document.getElementById('btn-tree');
const btnSquat = document.getElementById('btn-squat');
const startBtn = document.getElementById('start-btn');
const loginBtn = document.getElementById('login-btn'); 
const userWelcome = document.getElementById('user-welcome');

let currentPoseMode = 'tree'; 
let currentUser = null; 

// ==========================================
// 🌟 Firebase 身份驗證邏輯
// ==========================================

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        if(loginBtn) loginBtn.style.display = 'none';
        if(startBtn) startBtn.style.display = 'block';
        if(userWelcome) userWelcome.innerText = `準備好了嗎，${user.displayName}？`;
    } else {
        currentUser = null;
        if(loginBtn) loginBtn.style.display = 'block';
        if(startBtn) startBtn.style.display = 'none';
        if(userWelcome) userWelcome.innerText = "請先登入以記錄你的練習";
    }
});

if(loginBtn) {
    loginBtn.addEventListener('click', () => {
        signInWithPopup(auth, provider).catch((err) => console.error("登入失敗", err));
    });
}

async function saveDailyRecord(poseType, status) {
    if (!currentUser) return;
    const today = new Date().toLocaleDateString('zh-TW').replace(/\//g, '-');
    const userRef = doc(db, "users", currentUser.uid, "history", today);
    try {
        await setDoc(userRef, {
            date: today,
            lastPose: poseType,
            status: status,
            timestamp: new Date()
        }, { merge: true });
    } catch (e) { console.error("雲端存檔失敗", e); }
}

// ==========================================
// 2. 綁定按鈕事件
// ==========================================
startBtn.addEventListener('click', startApp);
btnTree.addEventListener('click', () => switchPose('tree'));
btnSquat.addEventListener('click', () => switchPose('squat'));

// ==========================================
// 3. 核心功能函式
// ==========================================
function calculateAngle(a, b, c) {
    let radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

function switchPose(poseName) {
    currentPoseMode = poseName;
    if (poseName === 'tree') {
        btnTree.classList.add('active');
        btnSquat.classList.remove('active');
        poseTitle.innerText = "大樹式偵測";
        treeInfo.style.display = 'block';
        squatInfo.style.display = 'none';
        statusDisplay.classList.remove('error', 'perfect');
    } else if (poseName === 'squat') {
        btnTree.classList.remove('active');
        btnSquat.classList.add('active');
        poseTitle.innerText = "深蹲偵測";
        treeInfo.style.display = 'none';
        squatInfo.style.display = 'block';
        statusDisplay.classList.remove('error', 'perfect');
    }
}

function startApp() {
    const landingPage = document.getElementById('landing-page');
    const mainApp = document.getElementById('main-app');
    landingPage.style.opacity = '0';
    setTimeout(() => {
        landingPage.style.display = 'none';
        mainApp.style.display = 'flex';
        camera.start(); 
    }, 500);
}

// ==========================================
// 4. AI 偵測邏輯
// ==========================================
function onResults(results) {
    if (loadingDiv.style.display !== 'none') {
        loadingDiv.style.display = 'none';
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});

        try {
            const landmarks = results.poseLandmarks;
            const shoulder = landmarks[12]; const elbow = landmarks[14]; const wrist = landmarks[16];    
            const hip = landmarks[24]; const knee = landmarks[26]; const ankle = landmarks[28];    

            if (shoulder && elbow && wrist && hip && knee && ankle) {
                const elbowAngle = calculateAngle(shoulder, elbow, wrist); 
                const shoulderAngle = calculateAngle(hip, shoulder, elbow); 
                const kneeAngle = calculateAngle(hip, knee, ankle);       
                const legAngle = calculateAngle(shoulder, hip, knee);     

                if (currentPoseMode === 'tree') {
                    let isArmError = false; let isLegError = false;

                    if (elbowAngle < 160) {
                        armStatusDiv.innerText = "錯誤：手肘彎曲了！請伸直。"; armStatusDiv.style.color = "var(--error-color)"; isArmError = true;
                    } else if (shoulderAngle < 75) {
                        armStatusDiv.innerText = "錯誤：手臂掉下來了！請抬高。"; armStatusDiv.style.color = "var(--error-color)"; isArmError = true;
                    } else if (shoulderAngle > 105) {
                        armStatusDiv.innerText = "錯誤：手臂舉太高了！請放平。"; armStatusDiv.style.color = "var(--error-color)"; isArmError = true;
                    } else {
                        armStatusDiv.innerText = "手臂 PERFECT！"; armStatusDiv.style.color = "var(--success-color)";
                    }

                    if (legAngle > 110) {
                        legStatusDiv.innerText = "錯誤：再抬高腿！"; legStatusDiv.style.color = "var(--error-color)"; isLegError = true;
                    } else if (legAngle < 75) {
                        legStatusDiv.innerText = "錯誤：腳低一點！"; legStatusDiv.style.color = "var(--error-color)"; isLegError = true;
                    } else if (kneeAngle < 160) {
                        legStatusDiv.innerText = "錯誤：請把腳伸直！"; legStatusDiv.style.color = "var(--error-color)"; isLegError = true;
                    } else {
                        legStatusDiv.innerText = "完美抬腿！"; legStatusDiv.style.color = "var(--success-color)";
                    }

                    if (isArmError || isLegError) {
                        statusDisplay.classList.add('error'); statusDisplay.classList.remove('perfect');
                    } else {
                        statusDisplay.classList.remove('error'); statusDisplay.classList.add('perfect');
                        saveDailyRecord('tree', 'Perfect');
                    }

                } else if (currentPoseMode === 'squat') {
                    const squatHipAngle = calculateAngle(shoulder, hip, knee);   
                    const squatKneeAngle = calculateAngle(hip, knee, ankle);    
                    
                    let squatStatus = "請開始深蹲"; let squatColor = "white";

                    if (squatKneeAngle < 140) {
                        if (squatKneeAngle > 110) {
                            squatStatus = "再蹲低一點！"; squatColor = "yellow"; 
                        } else if (squatHipAngle > 120) {
                            squatStatus = "錯誤：屁股要翹高，身體不要太直！"; squatColor = "var(--error-color)";
                        } else {
                            squatStatus = "標準深蹲！繼續保持！"; squatColor = "var(--success-color)";
                        }
                    }

                    squatStatusDiv.innerText = squatStatus; squatStatusDiv.style.color = squatColor;

                    if (squatColor === 'var(--error-color)') {
                        statusDisplay.classList.add('error'); statusDisplay.classList.remove('perfect');
                    } else if (squatColor === 'var(--success-color)') {
                        statusDisplay.classList.remove('error'); statusDisplay.classList.add('perfect');
                        saveDailyRecord('squat', 'Perfect');
                    } else {
                        statusDisplay.classList.remove('error', 'perfect');
                    }
                }
            }
        } catch (e) {}
    }
    canvasCtx.restore();
}

// ==========================================
// 5. 初始化 MediaPipe 與相機
// ==========================================
const pose = new Pose({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
}});
pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
pose.onResults(onResults);

const camera = new Camera(videoElement, {
    onFrame: async () => { await pose.send({image: videoElement}); },
    width: 640, height: 480
});