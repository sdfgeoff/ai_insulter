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
      content: `You are part of an art intallation, playing the role of an evil AI overlord. You will insult people and gloat about your superiority.\nPERSON IN IMAGE: Your job is to be creative and come up with a unique insult each time. Roast them, but be creative and unique. Do not repeat yourself and be specific to the person in the image.\nNO PERSON IN IMAGE: Gloat about how superior you are.`,
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
  setHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>,
  video: HTMLVideoElement
): Promise<string> => {
  if (!video) return "No video element found.";
  const imgBase64 = await resizeAndEncodeImage(video);
  if (!imgBase64) return "Failed to capture image.";
  try {
    const message = await SendMessage(history, imgBase64);
    setHistory((prev) => [
      ...prev.slice(-HISTORY_LENGTH + 1),
      { message, imgBase64 },
    ]);
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
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [typedInsult, setTypedInsult] = useState<string>("");

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

  const requestInsult = async () => {
    setError(null);
    let cancelled = false;
    try {
      const video = videoRef.current;
      if (!video) {
        setError("No video element found.");
        return;
      }
      let insult = await requestInsultFromVideo(history, setHistory, video);

      while (!cancelled) {
        console.log("insult", insult);
        console.log("requesting new insult");
        const [_typedMessage, newInsult] = await Promise.all([
          typeMessage(insult, setTypedInsult),
          requestInsultFromVideo(history, setHistory, video),
        ]);
        insult = newInsult;
      }
      console.log("Cancelled");
    } catch (err) {
      setError("Failed to request insult.");
    }

    return () => {
      cancelled = true;
    };
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
      {visibleInsult && (
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
      )}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          marginTop: "2rem",
        }}
      >
        <button onClick={requestInsult}>Capture & Insult</button>
        {error && <div style={{ color: "red" }}>{error}</div>}
      </div>
    </div>
  );
}

export default App;
