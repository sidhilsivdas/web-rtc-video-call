import React, { useEffect, useRef, useState } from 'react';

function App() {
  const socket = useRef(null);
  const pc = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  
  const [messageQueue, setMessageQueue] = useState([]);
  const [isSocketOpen, setSocketOpen] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const username = urlParams.get('user');

  useEffect(() => {
    // Initialize WebSocket
    socket.current = new WebSocket("wss://api-meetingroom.talksandtalks.ai/ws/meeting/9f423c1f-e631-45a2-b7ab-b717e9fa66f4/");
    //socket.current = new WebSocket('ws://localhost:8000');
    const currentSocket = socket.current;

    const handleOpen = () => {
      console.log("WebSocket connected");
      setSocketOpen(true);
      messageQueue.forEach(data => {
        sendData(data);
      });
      setMessageQueue([]);
      
    };

    const handleMessage = (event) => {
      
      let jsonData = JSON.parse(event.data);
      
      signalingDataHandler(jsonData);
    };

    const handleSocketError = (event) => {
      console.log("error", event)
      
    };


    currentSocket.addEventListener("open", handleOpen);
    currentSocket.addEventListener("message", handleMessage);
    currentSocket.addEventListener("error", handleSocketError);

    return () => {
      currentSocket.removeEventListener("open", handleOpen);
      currentSocket.removeEventListener("message", handleMessage);
      pc.current?.close();
      currentSocket.close();
      if (currentSocket.readyState === 1) { // <-- This is important
        currentSocket.close();
    }
    };
  }, [messageQueue]);

  const startConnection = () => {
    navigator.mediaDevices
      .getUserMedia({
        audio: true,
        video: { height: 350, width: 350 },
      })
      .then((stream) => {
        console.log("Local Stream found");
        localVideoRef.current.srcObject = stream;

        if (isSocketOpen) {
          console.log("Socket is already open");
          sendData({type: "join", username});
        } else {
          console.log("Socket is not open yet queueing messages");
          // Queue the message if socket is not open
          setMessageQueue(prevQueue => [...prevQueue, {type: "join", username}]);
        }

        // if (socket.current.readyState === WebSocket.OPEN) {
        //   console.log("Socket is already open");
        //   sendData({type:"join", username});
        // }else{
        //   console.log("socket is not open",socket.current.readyState, WebSocket.OPEN)
        // }
      })
      .catch((error) => {
        console.error("Stream not found: ", error);
      });
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
    console.log("Local description set");
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
    console.log("message recieved",data);
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
    console.log("sending message", data);
    socket.current.send(JSON.stringify(data));
  };

  useEffect(() => {
    startConnection();
  }, []);

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
