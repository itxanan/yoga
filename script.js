// ==========================================
// 1. 取得 HTML 畫面上的所有重要元素
// ==========================================
const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const loadingDiv = document.getElementById('loading');

// 狀態面板與文字元素
const statusDisplay = document.getElementById('status-display');
const poseTitle = document.getElementById('pose-title');
const treeInfo = document.getElementById('tree-info');
const squatInfo = document.getElementById('squat-info');
const armStatusDiv = document.getElementById('arm-status');
const legStatusDiv = document.getElementById('leg-status');
const squatStatusDiv = document.getElementById('squat-status');

// 選單按鈕元素
const btnTree = document.getElementById('btn-tree');
const btnSquat = document.getElementById('btn-squat');

// 🌟 核心狀態：設定目前的動作模式 (預設為大樹式)
let currentPoseMode = 'tree'; 

// ==========================================
// 2. 數學計算與介面控制函式
// ==========================================

// 📌 計算三個點夾角的函式
function calculateAngle(a, b, c) {
    let radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) {
        angle = 360 - angle;
    }
    return angle;
}

// 📌 切換動作模式的函式 (點擊選單按鈕時觸發)
function switchPose(poseName) {
    currentPoseMode = poseName;

    // 更新介面 UI (切換按鈕高亮、更改標題、顯示/隱藏對應的提示文字區塊)
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

// 🌟 啟動 App 的函式 (點擊首頁「開始體驗」時觸發)
function startApp() {
    const landingPage = document.getElementById('landing-page');
    const mainApp = document.getElementById('main-app');

    // 1. 讓首頁透明度漸漸變 0 (搭配 CSS 動畫)
    landingPage.style.opacity = '0';
    
    // 2. 等待 0.5 秒動畫播完後，切換畫面並啟動鏡頭
    setTimeout(() => {
        landingPage.style.display = 'none';  // 隱藏首頁
        mainApp.style.display = 'flex';      // 顯示系統主畫面
        
        // 3. 真正啟動攝影機，並要求瀏覽器權限
        camera.start();
    }, 500);
}

// ==========================================
// 3. AI 骨架偵測與邏輯判斷核心
// ==========================================

function onResults(results) {
    // 當 AI 模型順利產出第一張畫面時，隱藏「載入中」的黑色遮罩
    if (loadingDiv.style.display !== 'none') {
        loadingDiv.style.display = 'none';
    }

    // 準備畫布
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    
    // 把鏡頭畫面畫到網頁畫布上
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // 畫出骨架線條與點 (綠線紅點)
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});

        try {
            // 抓取座標點 (編號對應 MediaPipe Pose 關節圖)
            const landmarks = results.poseLandmarks;
            const shoulder = landmarks[12]; // 右肩
            const elbow = landmarks[14];    // 右手肘
            const wrist = landmarks[16];    // 右手腕
            const hip = landmarks[24];      // 右髖部
            const knee = landmarks[26];     // 右膝蓋
            const ankle = landmarks[28];    // 右腳踝

            // 確保關鍵點都有偵測到才計算，避免程式崩潰
            if (shoulder && elbow && wrist && hip && knee && ankle) {
                
                // 計算需要的角度
                const elbowAngle = calculateAngle(shoulder, elbow, wrist); // 手肘伸直度
                const shoulderAngle = calculateAngle(hip, shoulder, elbow); // 手臂抬高度
                const kneeAngle = calculateAngle(hip, knee, ankle);       // 膝蓋伸直度 (小腿)
                const legAngle = calculateAngle(shoulder, hip, knee);     // 腳抬高度 (大腿)

                // ----------------------------------------
                // 根據目前的模式 (currentPoseMode) 執行對應判斷
                // ----------------------------------------
                if (currentPoseMode === 'tree') {
                    // 🌟 模式 1：大樹式
                    let isArmError = false;
                    let isLegError = false;

                    // 【手部判斷】
                    if (elbowAngle < 160) {
                        armStatusDiv.innerText = "錯誤：手肘彎曲了！請伸直。";
                        armStatusDiv.style.color = "var(--error-color)";
                        isArmError = true;
                    } else if (shoulderAngle < 75) {
                        armStatusDiv.innerText = "錯誤：手臂掉下來了！請抬高。";
                        armStatusDiv.style.color = "var(--error-color)";
                        isArmError = true;
                    } else if (shoulderAngle > 105) {
                        armStatusDiv.innerText = "錯誤：手臂舉太高了！請放平。";
                        armStatusDiv.style.color = "var(--error-color)";
                        isArmError = true;
                    } else {
                        armStatusDiv.innerText = "手臂 PERFECT！";
                        armStatusDiv.style.color = "var(--success-color)";
                    }

                    // 【腿部判斷】
                    if (legAngle > 110) {
                        legStatusDiv.innerText = "錯誤：再抬高腿！";
                        legStatusDiv.style.color = "var(--error-color)";
                        isLegError = true;
                    } else if (legAngle < 75) {
                        legStatusDiv.innerText = "錯誤：腳低一點！";
                        legStatusDiv.style.color = "var(--error-color)";
                        isLegError = true;
                    } else if (kneeAngle < 160) {
                        legStatusDiv.innerText = "錯誤：請把腳伸直！";
                        legStatusDiv.style.color = "var(--error-color)";
                        isLegError = true;
                    } else {
                        legStatusDiv.innerText = "完美抬腿！";
                        legStatusDiv.style.color = "var(--success-color)";
                    }

                    // 依據是否出錯，改變左上角面板的發光顏色
                    if (isArmError || isLegError) {
                        statusDisplay.classList.add('error');
                        statusDisplay.classList.remove('perfect');
                    } else {
                        statusDisplay.classList.remove('error');
                        statusDisplay.classList.add('perfect');
                    }

                } else if (currentPoseMode === 'squat') {
                    // 🌟 模式 2：深蹲
                    const squatHipAngle = calculateAngle(shoulder, hip, knee);   // 髖關節彎曲角度
                    const squatKneeAngle = calculateAngle(hip, knee, ankle);    // 膝蓋彎曲角度
                    
                    let squatStatus = "請開始深蹲";
                    let squatColor = "white";

                    // 當膝蓋角度小於 140 度，判定為開始蹲下
                    if (squatKneeAngle < 140) {
                        if (squatKneeAngle > 110) {
                            squatStatus = "再蹲低一點！";
                            squatColor = "yellow"; // 警告色
                        } 
                        else if (squatHipAngle > 120) {
                            squatStatus = "錯誤：屁股要翹高，身體不要太直！";
                            squatColor = "var(--error-color)";
                        }
                        else {
                            squatStatus = "標準深蹲！繼續保持！";
                            squatColor = "var(--success-color)";
                        }
                    } else {
                        squatStatus = "請開始深蹲";
                        squatColor = "white";
                    }

                    squatStatusDiv.innerText = squatStatus;
                    squatStatusDiv.style.color = squatColor;

                    // 依據是否標準，改變左上角面板的發光顏色
                    if (squatColor === 'var(--error-color)') {
                        statusDisplay.classList.add('error');
                        statusDisplay.classList.remove('perfect');
                    } else if (squatColor === 'var(--success-color)') {
                        statusDisplay.classList.remove('error');
                        statusDisplay.classList.add('perfect');
                    } else {
                        statusDisplay.classList.remove('error', 'perfect');
                    }
                }
            }
        } catch (e) {
            // 抓不到完整骨架時，跳過這次計算
        }
    }
    canvasCtx.restore();
}

// ==========================================
// 4. 初始化設定 (MediaPipe & Camera)
// ==========================================

// 初始化 Pose 模型
const pose = new Pose({locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
}});
pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});
pose.onResults(onResults);

// 初始化攝影機 (注意：這裡只是設定好，真正的啟動 camera.start() 寫在 startApp() 裡面)
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await pose.send({image: videoElement});
    },
    width: 640,
    height: 480
});