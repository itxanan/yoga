const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const loadingDiv = document.getElementById('loading');

// 狀態文字元素
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

// 🌟 核心：設定目前的動作模式 (預設為大樹)
let currentPoseMode = 'tree'; 

// 📌 你的計算角度函式 (從 Python NumPy 翻譯過來)
function calculateAngle(a, b, c) {
    // MediaPipe 的點是物件格式 {x, y, z}
    let radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) {
        angle = 360 - angle;
    }
    return angle;
}

// 🌟 新增：切換動作模式的函式 (按鈕呼叫用)
function switchPose(poseName) {
    currentPoseMode = poseName;
    console.log(`已切換模式為: ${poseName}`);

    // 更新介面 UI (按鈕狀態和狀態面板顯示)
    if (poseName === 'tree') {
        btnTree.classList.add('active');
        btnSquat.classList.remove('active');
        poseTitle.innerText = "大樹式侦測";
        treeInfo.style.display = 'block';
        squatInfo.style.display = 'none';
        statusDisplay.classList.remove('error'); // 清除錯誤樣式
    } else if (poseName === 'squat') {
        btnTree.classList.remove('active');
        btnSquat.classList.add('active');
        poseTitle.innerText = "深蹲侦測";
        treeInfo.style.display = 'none';
        squatInfo.style.display = 'block';
        statusDisplay.classList.remove('error'); // 清除錯誤樣式
    }
}

// 🌟 核心：每當鏡頭抓到畫面，就會執行這裡
function onResults(results) {
    // 當 AI 模型載入完成，隱藏 loading 畫面
    if (loadingDiv.style.display !== 'none') {
        loadingDiv.style.display = 'none';
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    // 把鏡頭畫面畫到網頁畫布上
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // 畫出骨架線條與點 (綠線紅點)
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});

        // 🌟 開始進行角度判斷
        try {
            // 抓取座標點 (編號對應 MediaPipePose 關節圖)
            const landmarks = results.poseLandmarks;
            const shoulder = landmarks[12]; // 右肩
            const elbow = landmarks[14];    // 右手肘
            const wrist = landmarks[16];    // 右手腕
            const hip = landmarks[24];      // 右髖部
            const knee = landmarks[26];     // 右膝蓋
            const ankle = landmarks[28];    // 右腳踝

            // 確保關鍵點都有侦測到
            if (shoulder && elbow && wrist && hip && knee && ankle) {
                // 計算所有需要的角度
                const elbowAngle = calculateAngle(shoulder, elbow, wrist); // 手肘伸直
                const shoulderAngle = calculateAngle(hip, shoulder, elbow); // 手臂抬高
                const kneeAngle = calculateAngle(hip, knee, ankle);       // 膝蓋伸直 (腳)
                const legAngle = calculateAngle(shoulder, hip, knee);       // 腳抬高

                // 🌟 使用目前的動作模式 (currentPoseMode) 來決定執行哪個邏輯 (取代 Python 的 match current_mode)
                if (currentPoseMode === 'tree') {
                    // 1. 大樹式判斷邏輯
                    let isArmError = false;
                    let isLegError = false;

                    // 手部狀態
                    if (elbowAngle < 160) {
                        armStatusDiv.innerText = "錯誤：手肘彎曲了！請伸直。";
                        armStatusDiv.style.color = "red";
                        isArmError = true;
                    } else if (shoulderAngle < 75) {
                        armStatusDiv.innerText = "錯誤：手臂掉下來了！請抬高。";
                        armStatusDiv.style.color = "red";
                        isArmError = true;
                    } else if (shoulderAngle > 105) {
                        armStatusDiv.innerText = "錯誤：手臂舉太高了！請放平。";
                        armStatusDiv.style.color = "red";
                        isArmError = true;
                    } else {
                        armStatusDiv.innerText = "手臂 perfect";
                        armStatusDiv.style.color = "lime";
                    }

                    // 腿部狀態
                    if (legAngle > 110) {
                        legStatusDiv.innerText = "錯誤：再抬高腿！";
                        legStatusDiv.style.color = "red";
                        isLegError = true;
                    } else if (legAngle < 75) {
                        legStatusDiv.innerText = "錯誤：腳低一點！";
                        legStatusDiv.style.color = "red";
                        isLegError = true;
                    } else if (kneeAngle < 160) {
                        legStatusDiv.innerText = "錯誤：請把腳伸直！";
                        legStatusDiv.style.color = "red";
                        isLegError = true;
                    } else {
                        legStatusDiv.innerText = "完美抬腿";
                        legStatusDiv.style.color = "lime";
                    }

                    // 更新浮動面板的樣式
                    if (isArmError || isLegError) {
                        statusDisplay.classList.add('error');
                        statusDisplay.classList.remove('perfect');
                    } else {
                        statusDisplay.classList.remove('error');
                        statusDisplay.classList.add('perfect');
                    }

                } else if (currentPoseMode === 'squat') {
                    // 🌟 2. 深蹲判斷邏輯 (我在這裡翻譯並優化了你之前的判斷想法)
                    // 深蹲需要看髖部角度和膝蓋角度
                    const squatHipAngle = calculateAngle(shoulder, hip, knee);   // 髖關節彎曲角度
                    const squatKneeAngle = calculateAngle(hip, knee, ankle);    // 膝蓋彎曲角度
                    
                    // console.log("H:", squatHipAngle, "K:", squatKneeAngle);

                    let squatStatus = "請開始深蹲";
                    let squatColor = "white";

                    // 當膝蓋角度小於 140 度，我們判定為在深蹲狀態
                    if (squatKneeAngle < 140) {
                        // 檢查標準：膝蓋彎曲不夠 (需要低於 110度) 
                        if (squatKneeAngle > 110) {
                            squatStatus = "再蹲低一點！";
                            squatColor = "yellow";
                        } 
                        // 檢查標準：身體有沒有跟著髖部一起彎下去 (髖關節要小於 120度)
                        else if (squatHipAngle > 120) {
                            squatStatus = "錯誤：屁股要翹高，身體不要太直！";
                            squatColor = "red";
                        }
                        else {
                            squatStatus = "標準深蹲！";
                            squatColor = "lime";
                        }
                    } else {
                        squatStatus = "請開始深蹲";
                        squatColor = "white";
                    }

                    squatStatusDiv.innerText = squatStatus;
                    squatStatusDiv.style.color = squatColor;

                    // 更新樣式
                    if (squatColor === 'red') {
                        statusDisplay.classList.add('error');
                        statusDisplay.classList.remove('perfect');
                    } else if (squatColor === 'lime') {
                        statusDisplay.classList.remove('error');
                        statusDisplay.classList.add('perfect');
                    } else {
                        statusDisplay.classList.remove('error');
                        statusDisplay.classList.remove('perfect');
                    }
                }
            }
        } catch (e) {
            // 如果侦測不到完整的點，先跳過
        }
    }
    canvasCtx.restore();
}

// 🚀 初始化 MediaPipe 姿勢模型 (pose.js CDN 連結)
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

// 🚀 初始化並啟動攝影機 (camera_utils.js CDN 連結)
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await pose.send({image: videoElement});
    },
    width: 640,
    height: 480
});
camera.start();