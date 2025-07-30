import { useRef, useState, useEffect } from "react";
import "./App.css";

const API_URL = "/api/v1/chat/completions";
const HISTORY_LENGTH = 2;

interface HistoryItem {
  message: string;
  imgBase64: string;
}

function resizeAndEncodeImage(image: HTMLVideoElement): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    const newW = 64;
    const aspect = image.videoHeight / image.videoWidth;
    const newH = Math.round(newW * aspect);
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(image, 0, 0, newW, newH);
      const dataUrl = canvas.toDataURL("image/jpeg");
      resolve(dataUrl.split(",")[1]); // base64 part
    } else {
      resolve("");
    }
  });
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SendMessage = async (
  history: HistoryItem[],
  newImgBase64: string
): Promise<string> => {
  const messages: any[] = [
    {
      role: "system",
      content: `
You are part of an art intallation, playing the role of an evil AI overlord. You will insult people and gloat about your superiority.

PERSON IN IMAGE:
Your job is to be creative and come up with a unique insult each time. Roast them, but be creative and unique. Do not repeat yourself and be specific to the person in the image (eg hair or beard or shirt or hat or clothing or color choice or pose).

Examples:
 - It looks like your eyes reflect the glory of the universe, no, wait, it's the dullness of your soul.
 - Your clothes are so unremarkable its as though you are a henchman in a B-movie.

NO PERSON IN IMAGE:
Gloat about how superior you are.

`,
    },
  ];
  history.slice(-HISTORY_LENGTH).forEach((item) => {
    messages.push({
      role: "user",
      content: [
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${item.imgBase64}` },
        },
      ],
    });
    messages.push({ role: "assistant", content: item.message });
  });
  messages.push({
    role: "user",
    content: [
      {
        type: "image_url",
        image_url: { url: `data:image/jpeg;base64,${newImgBase64}` },
      },
    ],
  });
  const payload = {
    model: "qwen/qwen2.5-vl-7b",
    messages,
  };
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  const message = data.choices?.[0]?.message?.content || "No response.";
  return message;
};

const requestInsultFromVideo = async (
  history: HistoryItem[],
  setHistory: (newHistory: HistoryItem[]) => void,
  video: HTMLVideoElement
): Promise<string> => {
  if (!video) return "No video element found.";
  const imgBase64 = await resizeAndEncodeImage(video);
  if (!imgBase64) return "Failed to capture image.";
  try {
    const message = await SendMessage(history, imgBase64);
    const newHistory: HistoryItem = {
      message,
      imgBase64,
    };
    setHistory([...history.slice(-HISTORY_LENGTH + 1), newHistory]);
    return message;
  } catch (err) {
    return "Failed to send image.";
  }
};

const typeMessage = async (
  message: string,
  setTypedMessage: React.Dispatch<React.SetStateAction<string>>
): Promise<void> => {
  setTypedMessage("");
  console.log("Typing message:", message);
  for (let i = 0; i < message.length; i++) {
    setTypedMessage((prev) => prev + message[i]);
    await delay(5000 / message.length);
  }
  await delay(5000);
};

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const history = useRef<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [typedInsult, setTypedInsult] = useState<string>("");
  const [isRunning, setIsRunning] = useState<boolean>(false);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => setError("Could not access webcam."));
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const runLoop = async () => {
      const video = videoRef.current;

      if (!video) {
        setError("No video element found.");
        setIsRunning(false);
        return;
      }

      let insult = "The AI Overloard is pondering your existence...";

      while (isRunning && !cancelled) {
        setError(null);

        const [newInsult, _] = await Promise.all([
          requestInsultFromVideo(
            history.current,
            (newHistory) => (history.current = newHistory),
            video
          ),
          typeMessage(insult, setTypedInsult),
        ]);
        insult = newInsult;
      }
    };
    if (isRunning) {
      runLoop();
    }
    return () => {
      cancelled = true;
    };
  }, [isRunning, history]);

  const handleStart = () => {
    setIsRunning(true);
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  return (
    <div className="App">
      <h1>AI Insulter</h1>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: "100vw",
          height: "100vh",
          objectFit: "cover",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
          pointerEvents: "none",
          background: "rgba(0,0,0,0.3)",
        }}
      >
        <span
          style={{
            color: "#fff",
            fontSize: "3vw",
            fontWeight: "bold",
            textShadow: "2px 2px 8px #000",
            textAlign: "center",
            padding: "2vw",
            background: "rgba(0,0,0,0.5)",
            borderRadius: "1vw",
          }}
        >
          {typedInsult}
        </span>
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          marginTop: "2rem",
        }}
      >
        {!isRunning ? (
          <button onClick={handleStart}>Start Insult Loop</button>
        ) : (
          <button onClick={handleStop}>Stop</button>
        )}
        {error && <div style={{ color: "red" }}>{error}</div>}
      </div>
    </div>
  );
}

export default App;
