import { useEffect, useRef, useState } from 'react';
import {
  HandLandmarker,
  FilesetResolver,
  DrawingUtils
} from '@mediapipe/tasks-vision';
import './App.css';

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [handLandmarker, setHandLandmarker] = useState<HandLandmarker | null>(null);
  const [isHandInFaceArea, setIsHandInFaceArea] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [icons, setIcons] = useState<{ id: number; top: string; left: string; delay: string; size: string }[]>([]);

  useEffect(() => {
    // Generate 12 random positions and sizes for icons
    const newIcons = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
      size: `${Math.random() * 300 + 300}px` // 300px to 600px
    }));
    setIcons(newIcons);
  }, []);

  useEffect(() => {
    const initHandLandmarker = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 2
      });
      setHandLandmarker(handLandmarker);
      setIsLoaded(true);
    };

    initHandLandmarker();
  }, []);

  useEffect(() => {
    if (!handLandmarker || !videoRef.current || !hasStarted) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const drawingUtils = new DrawingUtils(ctx);

    let lastVideoTime = -1;
    const predict = async () => {
      if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const results = handLandmarker.detectForVideo(video, performance.now());

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        let handDetectedNearFace = false;

        if (results.landmarks) {
          for (const landmarks of results.landmarks) {
            drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS, {
              color: "#00FF00",
              lineWidth: 5
            });
            drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 2 });

            // Check if any landmark is in the "face area" (center of the screen)
            // Normalised coordinates: match with CSS .face-area-box (left: 20%, top: 30%, width: 60%, height: 50%)
            const inFaceArea = landmarks.some(point => 
              point.x > 0.2 && point.x < 0.8 && point.y > 0.3 && point.y < 0.8
            );
            if (inFaceArea) handDetectedNearFace = true;
          }
        }

        setIsHandInFaceArea(handDetectedNearFace);
        
        // Control music
        if (handDetectedNearFace) {
          if (audioRef.current && audioRef.current.paused) {
            audioRef.current.play().catch(e => console.log("Audio play failed:", e));
          }
        } else {
          if (audioRef.current && !audioRef.current.paused) {
            audioRef.current.pause();
          }
        }
      }
      requestAnimationFrame(predict);
    };

    navigator.mediaDevices.getUserMedia({ video: true })
      .then((stream) => {
        video.srcObject = stream;
        video.addEventListener('loadeddata', predict);
      })
      .catch((err) => {
        console.error("Camera access error:", err);
        alert("Gagal mengakses kamera. Pastikan Anda telah memberikan izin kamera.");
      });

    return () => {
      if (video.srcObject) {
        (video.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [handLandmarker, hasStarted]);

  return (
    <div className="container">
      {!isLoaded && <div className="loading">Loading AI Models...</div>}
      
      {!hasStarted ? (
        <div className="start-screen">
          <h1>KICAW MANIA</h1>
          <p>Izinkan akses kamera untuk memulai pengalaman interaktif</p>
          <button className="start-button" onClick={() => setHasStarted(true)}>
            MULAI SEKARANG
          </button>
        </div>
      ) : (
        <>
          <div className="video-container">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="webcam-video"
            />
            <canvas 
              ref={canvasRef} 
              width={640} 
              height={480} 
              className="output-canvas"
            />
            
            <div className={`face-area-box ${isHandInFaceArea ? 'active' : ''}`}></div>

            {isHandInFaceArea && icons.map((icon) => (
              <div 
                key={icon.id}
                className="floating-icon"
                style={{ top: icon.top, left: icon.left, width: icon.size, height: icon.size }}
              >
                <video 
                  src="/hand_icon.webm" 
                  loop 
                  muted 
                  autoPlay
                  playsInline
                  className="icon-video"
                  style={{ animationDelay: icon.delay, width: '100%', height: '100%' }}
                />
              </div>
            ))}
          </div>

          <div className="controls">
            <h1>KICAW MANIA</h1>
            <p>Arahkan tangan ke area kotak di tengah untuk memutar musik dan menampilkan ikon!</p>
            <audio 
              ref={audioRef} 
              src="/music.mp3" 
              loop
            />
          </div>
        </>
      )}
    </div>
  );
}

export default App;
