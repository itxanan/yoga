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

let currentPoseMode = 'tree'; 

// ==========================================
// 2. 綁定按鈕事件 (取代原本 HTML 裡的 onclick)
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
        camera.start(); // 真正啟動相機
    }, 500);
}

// ==========================================
// 4. AI 骨架偵測邏輯
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