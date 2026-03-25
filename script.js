const videoElement = document.getElementById('video');
const canvasElement = document.getElementById('canvas');
const canvasCtx = canvasElement.getContext('2d');
const statusDiv = document.getElementById('status');

// 📌 你的計算角度函式 (從 Python 翻譯過來)
function calculateAngle(a, b, c) {
    let radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) {
        angle = 360 - angle;
    }
    return angle;
}

// 🌟 核心：每當鏡頭抓到畫面，就會執行這裡
function onResults(results) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    // 把鏡頭畫面畫到網頁上
    canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

    if (results.poseLandmarks) {
        // 畫出骨架線條
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {color: '#00FF00', lineWidth: 4});
        drawLandmarks(canvasCtx, results.poseLandmarks, {color: '#FF0000', lineWidth: 2});

        // 抓取座標點 (編號參考 MediaPipe 官方圖表)
        const landmarks = results.poseLandmarks;
        const shoulder = landmarks[12]; // 右肩
        const elbow = landmarks[14];    // 右手肘
        const wrist = landmarks[16];    // 右手腕

        // 確保有點才計算，避免當機
        if (shoulder && elbow && wrist) {
            const elbowAngle = calculateAngle(shoulder, elbow, wrist);
            
            // 判斷邏輯
            if (elbowAngle < 160) {
                statusDiv.innerText = "錯誤：手肘彎曲了！請伸直。";
                statusDiv.style.color = "red";
            } else {
                statusDiv.innerText = "完美平舉！";
                statusDiv.style.color = "lime";
            }
        }
    }
    canvasCtx.restore();
}

// 🚀 初始化 MediaPipe 姿勢模型
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

// 🚀 啟動攝影機
const camera = new Camera(videoElement, {
    onFrame: async () => {
        await pose.send({image: videoElement});
    },
    width: 640,
    height: 480
});
camera.start().then(() => {
    statusDiv.innerText = "大樹式：請將手伸直平舉！";
});