import { useRef, useState, useEffect } from 'react';
import './App.css';

const API_URL = '/api/v1/chat/completions';
const HISTORY_LENGTH = 2;

interface HistoryItem {
  message: string;
  imgBase64: string;
}

function resizeAndEncodeImage(image: HTMLVideoElement): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const newW = 64;
    const aspect = image.videoHeight / image.videoWidth;
    const newH = Math.round(newW * aspect);
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(image, 0, 0, newW, newH);
      const dataUrl = canvas.toDataURL('image/jpeg');
      resolve(dataUrl.split(',')[1]); // base64 part
    } else {
      resolve('');
    }
  });
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => setError('Could not access webcam.'));
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const sendImage = async () => {
    setLoading(true);
    setError(null);
    if (!videoRef.current) return;
    const imgBase64 = await resizeAndEncodeImage(videoRef.current);
    if (!imgBase64) {
      setError('Failed to capture image.');
      setLoading(false);
      return;
    }
    const messages: any[] = [
      {
        role: 'system',
        content: `You are part of an art intallation, playing the role of an evil AI overlord. You will insult people and gloat about your superiority.\nPERSON IN IMAGE: Your job is to be creative and come up with a unique insult each time. Roast them, but be creative and unique. Do not repeat yourself and be specific to the person in the image.\nNO PERSON IN IMAGE: Gloat about how superior you are.`
      }
    ];
    history.slice(-HISTORY_LENGTH).forEach(item => {
      messages.push({
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${item.imgBase64}` }
          }
        ]
      });
      messages.push({ role: 'assistant', content: item.message });
    });
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: `data:image/jpeg;base64,${imgBase64}` }
        }
      ]
    });
    const payload = {
      model: 'qwen/qwen2.5-vl-7b',
      messages
    };
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      const message = data.choices?.[0]?.message?.content || 'No response.';
      setHistory(prev => [...prev.slice(-HISTORY_LENGTH + 1), { message, imgBase64 }]);
    } catch (e) {
      setError('API request failed.');
    }
    setLoading(false);
  };

  return (
    <div className="App">
      <h1>AI Insulter</h1>
      <video ref={videoRef} autoPlay playsInline width={320} height={240} style={{ border: '1px solid #ccc' }} />
      <div>
        <button onClick={sendImage} disabled={loading}>Capture & Insult</button>
        {loading && <span>Sending...</span>}
        {error && <div style={{ color: 'red' }}>{error}</div>}
      </div>
      <h2>History</h2>
      <div className="history">
        {history.map((item, idx) => (
          <div key={idx} className="history-item">
            <img src={`data:image/jpeg;base64,${item.imgBase64}`} alt="Webcam" width={64} />
            <div className="message">{item.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
