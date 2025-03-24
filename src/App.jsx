import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import "./App.css"; // We'll create this file next

function App() {
  const [alphabet, setAlphabet] = useState("");
  const [sentence, setSentence] = useState("");
  const [isDetecting, setIsDetecting] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastDetectedTime, setLastDetectedTime] = useState(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  
  // New state variables for webcam
  const [webcamActive, setWebcamActive] = useState(false);
  const [captureInterval, setCaptureInterval] = useState(null);
  const [processingImage, setProcessingImage] = useState(false);
  
  // New responsive state
  const [isMobile, setIsMobile] = useState(false);
  const [orientation, setOrientation] = useState(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
  
  // Refs
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Check for mobile device on component mount
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobile(isMobileDevice);
    };
    
    const handleResize = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };
    
    checkMobile();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.addEventListener('resize', handleResize);
    };
  }, []);

  // Initialize webcam when component mounts
  useEffect(() => {
    if (!showUpload && !webcamActive) {
      initializeWebcam();
    }
    
    return () => {
      // Clean up webcam resources
      if (webcamActive) {
        const stream = videoRef.current?.srcObject;
        if (stream) {
          const tracks = stream.getTracks();
          tracks.forEach(track => track.stop());
        }
      }
    };
  }, [showUpload]);

  // Memoize the webcam initialization to prevent unnecessary re-renders
  const initializeWebcam = useCallback(async () => {
    try {
      // Set video constraints based on device
      const constraints = { 
        video: {
          facingMode: isMobile ? 'environment' : 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setWebcamActive(true);
      }
    } catch (err) {
      console.error("Error accessing webcam:", err);
      alert("Unable to access camera. Please allow camera access or use the image upload feature.");
      // Automatically switch to upload mode if camera fails
      setShowUpload(true);
    }
  }, [isMobile]);

  // Start/stop detecting from webcam
  useEffect(() => {
    if (isDetecting && webcamActive && !showUpload) {
      // Adjust interval based on device (slower for mobile)
      const intervalTime = isMobile ? 1500 : 1000;
      
      // Set up interval to send frames for detection
      const interval = setInterval(() => {
        if (!processingImage) {
          captureAndSendFrame();
        }
      }, intervalTime);
      
      setCaptureInterval(interval);
    } else {
      // Clear interval if detecting is turned off
      if (captureInterval) {
        clearInterval(captureInterval);
        setCaptureInterval(null);
      }
    }
    
    return () => {
      if (captureInterval) {
        clearInterval(captureInterval);
      }
    };
  }, [isDetecting, webcamActive, showUpload, processingImage, isMobile]);

  // Capture frame with optimized quality based on device
  const captureAndSendFrame = async () => {
    if (!videoRef.current || !canvasRef.current || processingImage) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to blob with quality based on device
    try {
      setProcessingImage(true);
      
      // Lower quality on mobile to reduce payload size
      const imageQuality = isMobile ? 0.6 : 0.8;
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        const formData = new FormData();
        formData.append('file', blob, 'webcam-frame.jpg');
        
        try {
          const response = await axios.post(
            "https://hand-sign-detection-backend.onrender.com/detect_from_image",
            formData,
            {
              headers: {
                'Content-Type': 'multipart/form-data'
              }
            }
          );
          
          if (response.data.alphabet) {
            setAlphabet(response.data.alphabet);
            setSentence((prev) => prev + response.data.alphabet);
            setLastDetectedTime(Date.now());
          }
        } catch (err) {
          console.error("Error sending frame to backend:", err);
        } finally {
          setProcessingImage(false);
        }
      }, 'image/jpeg', imageQuality);
    } catch (err) {
      console.error("Error capturing frame:", err);
      setProcessingImage(false);
    }
  };

  // Original detection logic (legacy - kept for reference)
  useEffect(() => {
    let interval;
    
    if (isDetecting && !webcamActive && !showUpload) {
      interval = setInterval(() => {
        axios
          .get("https://hand-sign-detection-backend.onrender.com/detect")
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
  }, [isDetecting, webcamActive, showUpload]);

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

  const toggleUpload = () => {
    setShowUpload(!showUpload);
    
    // If switching away from upload, initialize webcam
    if (showUpload) {
      initializeWebcam();
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      // Create a preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage({
          preview: e.target.result,
          result: null
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please select an image first");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(
        "https://hand-sign-detection-backend.onrender.com/detect_from_image",
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.alphabet) {
        setAlphabet(response.data.alphabet);
        setSentence((prev) => prev + response.data.alphabet);
        setLastDetectedTime(Date.now());
        
        // Update the image to show the annotated version
        if (response.data.image) {
          setUploadedImage({
            ...uploadedImage,
            result: response.data.image
          });
        }
      } else if (response.data.message) {
        alert(response.data.message);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Failed to process image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Render buttons based on screen size
  const renderHeaderButtons = () => {
    return (
      <div className="header-buttons">
        <button 
          className={`toggle-button ${isDetecting ? 'active' : ''}`}
          onClick={toggleDetection}
        >
          {isDetecting ? (isMobile ? 'Pause' : 'Pause Detection') : (isMobile ? 'Start' : 'Resume Detection')}
        </button>
        <button 
          className={`toggle-button ${showUpload ? 'active' : ''}`}
          onClick={toggleUpload}
        >
          {showUpload ? (isMobile ? 'Camera' : 'Show Camera') : (isMobile ? 'Upload' : 'Upload Image')}
        </button>
        <button 
          className={`toggle-button ${showGuide ? 'active' : ''}`}
          onClick={toggleGuide}
        >
          {showGuide ? (isMobile ? 'Hide' : 'Hide Guide') : (isMobile ? 'Guide' : 'Show Guide')}
        </button>
      </div>
    );
  };

  return (
    <div className={`app-container ${isMobile ? 'mobile' : ''} ${orientation}`}>
      <header className="app-header">
        <h1>Hand Sign Detector</h1>
        <p className="subtitle">Translate hand gestures to text in real-time</p>
      </header>
      
      <main className="app-main">
        <section className="camera-section">
          <div className="video-card">
            <div className="video-header">
              <h2>{isMobile ? 'Camera' : 'Camera Feed'}</h2>
              {renderHeaderButtons()}
            </div>
            
            {!showUpload ? (
              <div className="video-wrapper">
                {/* Live webcam video */}
                <video 
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="video-feed"
                />
                {/* Hidden canvas for processing frames */}
                <canvas 
                  ref={canvasRef} 
                  style={{ display: 'none' }}
                />
                {isDetecting && (
                  <div className="detection-indicator">
                    <div className="pulse-ring"></div>
                  </div>
                )}
                {processingImage && (
                  <div className="processing-indicator">
                    {isMobile ? 'Processing...' : 'Processing frame...'}
                  </div>
                )}
              </div>
            ) : (
              <div className="upload-section">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  capture={isMobile ? 'environment' : undefined}
                />
                
                <div className="upload-area" onClick={triggerFileInput}>
                  {!uploadedImage ? (
                    <>
                      <div className="upload-icon">📷</div>
                      <p>{isMobile ? 'Tap to select image' : 'Click to select an image with hand signs'}</p>
                    </>
                  ) : (
                    <div className="image-preview-container">
                      <img 
                        src={uploadedImage.result || uploadedImage.preview} 
                        alt="Uploaded hand sign" 
                        className="uploaded-image-preview" 
                      />
                    </div>
                  )}
                </div>
                
                <div className="upload-actions">
                  <button 
                    className="upload-button" 
                    onClick={triggerFileInput}
                  >
                    {isMobile ? 'New Image' : 'Select Image'}
                  </button>
                  
                  <button 
                    className={`detect-button ${isUploading ? 'uploading' : ''}`}
                    onClick={handleUpload}
                    disabled={!selectedFile || isUploading}
                  >
                    {isUploading ? 'Processing...' : (isMobile ? 'Detect' : 'Detect Sign')}
                  </button>
                </div>
              </div>
            )}
            
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
              placeholder={isMobile ? "Signs appear here..." : "Detected signs will appear here..."}
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
                <span className="button-text">{isSpeaking ? 'Speaking' : 'Speak'}</span>
              </button>
            </div>
          </div>
        </section>
      </main>
      
      <footer className="app-footer">
        <p>{isMobile ? 
          "Position hand clearly for best results" : 
          "Position your hand clearly in the camera feed or upload a clear image for best detection results"}
        </p>
      </footer>
    </div>
  );
}

export default App;
