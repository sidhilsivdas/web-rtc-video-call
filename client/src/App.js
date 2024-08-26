import React, { useEffect, useRef, useState } from 'react';

function App() {
  const socket = useRef(null);
  const pc = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [messageQueue, setMessageQueue] = useState([]);
  const isSocketOpenRef = useRef(false); // Use ref to track WebSocket state
  const reconnectInterval = useRef(null);

  const urlParams = new URLSearchParams(window.location.search);
  const username = urlParams.get('user');

  const connectWebSocket = () => {
    const wsUrl = "wss://api-meetingroom.talksandtalks.ai/ws/meeting/9f423c1f-e631-45a2-b7ab-b717e9fa66f4/";
    //const wsUrl = "ws://localhost:8000";
    if (socket.current) {
      console.log("web socket current exits , removing liseners");
      socket.current.removeEventListener("open", handleOpen);;
      socket.current.removeEventListener("message", handleMessage);
      socket.current.removeEventListener("error", handleSocketError);
      socket.current.removeEventListener("close", handleClose);
      socket.current.close();
    }

    console.log("web socket current not exits , creating liseners")
    socket.current = new WebSocket(wsUrl);

    socket.current.addEventListener("open", handleOpen);
    socket.current.addEventListener("message", handleMessage);
    socket.current.addEventListener("error", handleSocketError);
    socket.current.addEventListener("close", handleClose);
  };

  const stopLocalMedia = () => {
    const stream = localVideoRef.current.srcObject;
    if (stream) {
      stream.getTracks().forEach(track => track.stop()); // Stop all tracks
      localVideoRef.current.srcObject = null; // Clear the video element source
      console.log("Local media stopped");
    }
  };

  

  const handleOpen = () => {
    console.log("WebSocket connected");
    isSocketOpenRef.current = true;
    startConnection()
    //processMessageQueue();
    if (reconnectInterval.current) {
      clearInterval(reconnectInterval.current);
    }
  };

  const handleMessage = (event) => {
    let jsonData = JSON.parse(event.data);
    signalingDataHandler(jsonData);
  };

  const handleSocketError = (event) => {
    console.error("WebSocket error: ", event);
  };

  const handleClose = (event) => {
    console.log("WebSocket closed: ", event);
    isSocketOpenRef.current = false;
    stopLocalMedia(); // Stop local video stream
    // Attempt to reconnect with exponential backoff
    let delay = 1000; // Start with a 1-second delay
    reconnectInterval.current = setInterval(() => {
      console.log("Attempting to reconnect...");
      connectWebSocket();
      delay = Math.min(delay * 2, 30000); // Exponential backoff, max 30 seconds
    }, delay);
  };

  const startConnection = () => {
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: { height: 350, width: 350 },
      })
      .then((stream) => {
        console.log("Local Stream found");
        localVideoRef.current.srcObject = stream;

        if (isSocketOpenRef.current) {
          console.log("Socket is already open");
          sendData({ type: "join", username });
        } else {
          console.log("Socket is not open yet");
          //setMessageQueue(prevQueue => [...prevQueue, { type: "join", username }]);
        }
      })
      .catch((error) => {
        console.error("Stream not found: ", error);
      });
  };

  const processMessageQueue = () => {
    console.log("process queue called")
    if (isSocketOpenRef.current) {
      setMessageQueue(prevQueue => {
        prevQueue.forEach(data => {
          console.log("Sending queued message", data);
          socket.current.send(JSON.stringify(data));
        });
        return []; // Clear the queue after sending messages
      });
    }
  };

  const onIceCandidate = (event) => {
    if (event.candidate) {
      console.log("Sending ICE candidate");
      sendData({
        type: "candidate",
        candidate: event.candidate,
      });
    }
  };

  const onTrack = (event) => {
    console.log("Adding remote track");
    remoteVideoRef.current.srcObject = event.streams[0];
  };

  const createPeerConnection = () => {
    try {
      pc.current = new RTCPeerConnection({
        iceServers: [
          {
            urls: "stun:openrelay.metered.ca:80",
          },
          {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
          {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject",
          },
        ],
      });
      pc.current.onicecandidate = onIceCandidate;
      pc.current.ontrack = onTrack;

      const localStream = localVideoRef.current.srcObject;
      for (const track of localStream.getTracks()) {
        pc.current.addTrack(track, localStream);
      }
      console.log("PeerConnection created");
    } catch (error) {
      console.error("PeerConnection failed: ", error);
    }
  };

  const setAndSendLocalDescription = (sessionDescription) => {
    pc.current.setLocalDescription(sessionDescription);
    console.log("Local description set", sessionDescription);
    sendData(sessionDescription);
  };

  const sendOffer = () => {
    console.log("Sending offer");
    pc.current.createOffer().then(setAndSendLocalDescription, (error) => {
      console.error("Send offer failed: ", error);
    });
  };

  const sendAnswer = () => {
    console.log("Sending answer");
    pc.current.createAnswer().then(setAndSendLocalDescription, (error) => {
      console.error("Send answer failed: ", error);
    });
  };

  const signalingDataHandler = (data) => {
    console.log("Message received", data);
    if (data.type === "join") {
      console.log("Ready to Connect!");
      createPeerConnection();
      sendOffer();
    } else if (data.type === "offer") {
      createPeerConnection();
      pc.current.setRemoteDescription(new RTCSessionDescription(data));
      sendAnswer();
    } else if (data.type === "answer") {
      pc.current.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.type === "candidate") {
      pc.current.addIceCandidate(new RTCIceCandidate(data.candidate));
    } else {
      console.log("Unknown Data");
    }
  };

  const sendData = (data) => {
    if (isSocketOpenRef.current) {
      console.log("Sending message", data);
      socket.current.send(JSON.stringify(data));
    } else {
      console.log("Socket is not open. Queuing message.");
      setMessageQueue(prevQueue => [...prevQueue, data]);
    }
  };

  useEffect(() => {
    console.log("first use effect");
    connectWebSocket();
    return () => {
      if (socket.current) {
        socket.current.removeEventListener("open", handleOpen);
        socket.current.removeEventListener("message", handleMessage);
        socket.current.removeEventListener("error", handleSocketError);
        socket.current.removeEventListener("close", handleClose);
        pc.current?.close();
        socket.current.close();
      }
    };
  }, []);

  // useEffect(() => {
  //   console.log("second use effect, calling process queue");
  //   processMessageQueue(); // Process the queue when WebSocket is open
  // }, [isSocketOpenRef.current]); // Trigger queue processing when WebSocket state changes

  // useEffect(() => {
  //   console.log("third use effect, adding remte stream");
  //   startConnection();
  // }, []);

  return (
    <div>
      <label>{"Username: " + username}</label>
      <label>{"Room Id: "}</label>
      <video autoPlay playsInline ref={localVideoRef} />
      <video autoPlay playsInline ref={remoteVideoRef} />
    </div>
  );
}

export default App;
