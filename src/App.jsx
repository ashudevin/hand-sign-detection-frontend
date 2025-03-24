import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./App.css"; // We'll create this file next

function App() {
  const [alphabet, setAlphabet] = useState("");
  const [sentence, setSentence] = useState("");
  const [isDetecting, setIsDetecting] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastDetectedTime, setLastDetectedTime] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const textareaRef = useRef(null);

  // Fetch detected alphabet from backend
  useEffect(() => {
    let interval;
    
    if (isDetecting) {
      interval = setInterval(() => {
        axios
          .get("http://localhost:8000/detect")
          .then((response) => {
            if (response.data.alphabet) {
              setAlphabet(response.data.alphabet);
              setSentence((prev) => prev + response.data.alphabet);
              setLastDetectedTime(Date.now());
            }
          })
          .catch((err) => console.error("Error fetching alphabet:", err));
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [isDetecting]);

  // Effect for fading out the detected letter animation
  useEffect(() => {
    if (lastDetectedTime) {
      const timer = setTimeout(() => {
        setLastDetectedTime(null);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [lastDetectedTime]);

  const handleClear = () => {
    setSentence("");
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleDelete = () => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    const { selectionStart, selectionEnd } = textarea;
  
    if (selectionStart === selectionEnd) {
      // No selection, delete the character before the cursor
      if (selectionStart > 0) {
        const updatedSentence =
          sentence.slice(0, selectionStart - 1) + sentence.slice(selectionEnd);
        setSentence(updatedSentence);
    
        // Move the cursor back one position
        setTimeout(() => {
          textarea.setSelectionRange(selectionStart - 1, selectionStart - 1);
        }, 0);
      }
    } else {
      // Delete the selected text
      const updatedSentence =
        sentence.slice(0, selectionStart) + sentence.slice(selectionEnd);
      setSentence(updatedSentence);
    
      // Set the cursor at the end of the deleted selection
      setTimeout(() => {
        textarea.setSelectionRange(selectionStart, selectionStart);
      }, 0);
    }
    
    textarea.focus();
  };
  
  const handleSpace = () => {
    setSentence((prev) => prev + " ");
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const newPosition = sentence.length + 1;
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newPosition, newPosition);
      }, 0);
    }
  };
  
  const handleSpeak = () => {
    if (!sentence.trim() || isSpeaking) return;
  
    const utterance = new SpeechSynthesisUtterance(sentence);
    const voices = speechSynthesis.getVoices();
  
    // Select a more natural voice if available
    const humanLikeVoice = voices.find((voice) =>
      ["Google US English", "Microsoft David Desktop - English (United States)"].includes(voice.name)
    );
  
    if (humanLikeVoice) {
      utterance.voice = humanLikeVoice;
    }
  
    utterance.lang = "en-US";
    
    // Add event listeners
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    speechSynthesis.speak(utterance);
  };

  const toggleDetection = () => {
    setIsDetecting(!isDetecting);
  };

  const toggleGuide = () => {
    setShowGuide(!showGuide);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Hand Sign Detector</h1>
        <p className="subtitle">Translate hand gestures to text in real-time</p>
      </header>
      
      <main className="app-main">
        <section className="camera-section">
          <div className="video-card">
            <div className="video-header">
              <h2>Camera Feed</h2>
              <div className="header-buttons">
                <button 
                  className={`toggle-button ${isDetecting ? 'active' : ''}`}
                  onClick={toggleDetection}
                >
                  {isDetecting ? 'Pause Detection' : 'Resume Detection'}
                </button>
                <button 
                  className={`toggle-button ${showGuide ? 'active' : ''}`}
                  onClick={toggleGuide}
                >
                  {showGuide ? 'Hide Guide' : 'Show Guide'}
                </button>
              </div>
            </div>
            
            <div className="video-wrapper">
              <img
                src="http://localhost:8000/video_feed"
                alt="Webcam Feed"
                className="video-feed"
              />
              {isDetecting && (
                <div className="detection-indicator">
                  <div className="pulse-ring"></div>
                </div>
              )}
            </div>
            
            <div className={`detected-letter ${lastDetectedTime ? 'pop-in' : ''}`}>
              {alphabet && (
                <>
                  <span className="letter-label">Detected:</span>
                  <span className="letter-value">{alphabet}</span>
                </>
              )}
            </div>
          </div>
          
          {showGuide && (
            <div className="guide-overlay" onClick={toggleGuide}>
              <div className="guide-container" onClick={(e) => e.stopPropagation()}>
                <div className="guide-header">
                  <h3>Hand Sign Guide</h3>
                  <button className="close-button" onClick={toggleGuide}>×</button>
                </div>
                <img 
                  src="/Signsign chart.png" 
                  alt="Hand sign guide" 
                  className="guide-image"
                />
              </div>
            </div>
          )}
        </section>
        
        <section className="text-section">
          <div className="text-card">
            <h2>Your Message</h2>
            <textarea
              ref={textareaRef}
              value={sentence}
              onChange={(e) => setSentence(e.target.value)}
              className="text-input"
              placeholder="Detected signs will appear here..."
            ></textarea>
            
            <div className="button-container">
              <button 
                onClick={handleClear} 
                className="action-button clear"
                title="Clear all text"
              >
                <span className="button-icon">🗑️</span>
                <span className="button-text">Clear</span>
              </button>
              
              <button 
                onClick={handleDelete} 
                className="action-button delete"
                title="Delete character"
              >
                <span className="button-icon">⌫</span>
                <span className="button-text">Delete</span>
              </button>
              
              <button 
                onClick={handleSpace} 
                className="action-button space"
                title="Add space"
              >
                <span className="button-icon">␣</span>
                <span className="button-text">Space</span>
              </button>
              
              <button 
                onClick={handleSpeak} 
                className={`action-button speak ${isSpeaking ? 'speaking' : ''}`}
                disabled={isSpeaking || !sentence.trim()}
                title="Speak text"
              >
                <span className="button-icon">{isSpeaking ? '🔊' : '🔈'}</span>
                <span className="button-text">{isSpeaking ? 'Speaking...' : 'Speak'}</span>
              </button>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="app-footer">
        <p>Position your hand clearly in the camera feed for best detection results</p>
      </footer>
    </div>
  );
}

export default App;
