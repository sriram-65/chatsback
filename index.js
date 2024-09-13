const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Initialize app and server
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files (for uploaded files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/peerjs', express.static(path.join(__dirname, 'node_modules/simple-peer')));

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

let users = {};

// Serve the chat page directly via Express route
app.get('/', (req, res) => {
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Chat and Video Call</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        background-color: #f4f4f4;
        margin: 0;
        padding: 0;
      }
      #chat-container, #video-container {
        width: 50%;
        margin: 20px auto;
        padding: 20px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      }
      #messages {
        border: 1px solid #ccc;
        padding: 10px;
        height: 300px;
        overflow-y: scroll;
        margin-bottom: 10px;
      }
      #message-input {
        width: 80%;
        padding: 10px;
      }
      #send-button, #call-button {
        padding: 10px;
        background-color: #007BFF;
        color: white;
        border: none;
        cursor: pointer;
      }
      #send-button:hover, #call-button:hover {
        background-color: #0056b3;
      }
      #online-users {
        padding: 10px;
        background-color: #e9ecef;
        margin-bottom: 10px;
        border-radius: 8px;
      }
      .message {
        margin-bottom: 10px;
        padding: 5px;
        border-radius: 5px;
      }
      .my-message {
        background-color: #007BFF;
        color: white;
      }
      .other-message {
        background-color: #ccc;
      }
      video {
        width: 100%;
        height: auto;
        margin-bottom: 10px;
      }
    </style>
  </head>
  <body>
    <div id="chat-container">
      <h2>Chat Room</h2>
      <div id="online-users"></div>
      <div id="messages"></div>
      <input id="name-input" type="text" placeholder="Enter your name..." autocomplete="off">
      <input id="message-input" type="text" placeholder="Type a message..." autocomplete="off" style="display:none;">
      <button id="send-button" style="display:none;">Send</button>
      <input type="file" id="file-input" style="display:none;">
      <button id="file-button" style="display:none;">Upload File</button>
      <button id="call-button" style="display:none;">Start Video Call</button>
    </div>
    
    <div id="video-container" style="display:none;">
      <h2>Video Call</h2>
      <video id="my-video" autoplay playsinline></video>
      <video id="user-video" autoplay playsinline></video>
      <button id="end-call-button">End Call</button>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script src="/peerjs/simplepeer.min.js"></script>
    <script>
  const socket = io();
  let userName = '';
  let userColor = '';
  let myPeer = null;
  let userStream = null;
  let peerStream = null;

  const onlineUsersDiv = document.getElementById('online-users');
  const videoContainer = document.getElementById('video-container');
  const myVideo = document.getElementById('my-video');
  const userVideo = document.getElementById('user-video');

  // Append messages to the chat box
  function appendMessage(message, isMyMessage = false) {
    const messagesDiv = document.getElementById('messages');
    const newMessageDiv = document.createElement('div');
    newMessageDiv.innerHTML = message;
    newMessageDiv.className = isMyMessage ? 'message my-message' : 'message other-message';
    messagesDiv.appendChild(newMessageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // Update online users list
  function updateOnlineUsers(users) {
    onlineUsersDiv.innerHTML = '<strong>Online Users:</strong> ' + Object.values(users).join(', ');
  }

  // Prompt the user to enter their name
  document.getElementById('name-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      userName = e.target.value;
      userColor = '#' + Math.floor(Math.random() * 16777215).toString(16); // Assign random color
      if (userName.trim()) {
        socket.emit('joinChat', { name: userName, color: userColor });
        e.target.style.display = 'none';
        document.getElementById('message-input').style.display = 'inline';
        document.getElementById('send-button').style.display = 'inline';
        document.getElementById('file-input').style.display = 'inline';
        document.getElementById('file-button').style.display = 'inline';
        document.getElementById('call-button').style.display = 'inline';
      }
    }
  });

  // Send message when 'Send' button is clicked
  document.getElementById('send-button').addEventListener('click', () => {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value;
    if (message.trim()) {
      socket.emit('chatMessage', { user: userName, message: message, color: userColor });
      messageInput.value = '';  // Clear input after sending
    }
  });

  // Start video call
  document.getElementById('call-button').addEventListener('click', async () => {
    userStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: true
    });
    myVideo.srcObject = userStream;

    myPeer = new SimplePeer({ initiator: true, trickle: false, stream: userStream });
    
    myPeer.on('signal', (signal) => {
      socket.emit('startCall', { signal, user: userName });
    });

    myPeer.on('stream', (stream) => {
      userVideo.srcObject = stream;
      videoContainer.style.display = 'block';
    });
  });

  // Handle incoming video call
  socket.on('incomingCall', async (data) => {
    userStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: true
    });
    myVideo.srcObject = userStream;

    myPeer = new SimplePeer({ initiator: false, trickle: false, stream: userStream });
    
    myPeer.signal(data.signal);
    
    myPeer.on('signal', (signal) => {
      socket.emit('acceptCall', { signal, user: userName });
    });

    myPeer.on('stream', (stream) => {
      userVideo.srcObject = stream;
      videoContainer.style.display = 'block';
    });
  });

  socket.on('callAccepted', (data) => {
    myPeer.signal(data.signal);
  });

  // End call
  document.getElementById('end-call-button').addEventListener('click', () => {
    myPeer.destroy();
    videoContainer.style.display = 'none';
  });

  // Listen for incoming messages
  socket.on('chatMessage', (data) => {
    const messageContent = \`\${data.user} (\${new Date().toLocaleTimeString()}): \${data.message}\`;
    appendMessage(messageContent, data.user === userName);
  });

  // Listen for file uploads
  socket.on('fileUpload', (data) => {
    const messageContent = \`\${data.user} uploaded a file: <a href="/uploads/\${data.fileName}" target="_blank">\${data.fileName}</a>\`;
    appendMessage(messageContent);
  });

  // Listen for join and leave notifications
  socket.on('joinChat', (user) => {
    appendMessage(\`\${user.name} has joined the chat\`);
    updateOnlineUsers(user.users);
  });

  socket.on('leaveChat', (user) => {
    appendMessage(\`\${user.name} has left the chat\`);
    updateOnlineUsers(user.users);
  });
</script>

  </body>
  </html>
  `;
  res.send(htmlContent);
});

// Handle file upload
app.post('/upload', upload.single('file'), (req, res) => {
  const fileName = req.file.filename;
  res.json({ fileName });
});

// Handle socket connection
io.on('connection', (socket) => {
  socket.on('joinChat', ({ name, color }) => {
    users[socket.id] = name;
    io.emit('joinChat', { name, users });
  });

  socket.on('chatMessage', (data) => {
    io.emit('chatMessage', data);
  });

  socket.on('disconnect', () => {
    const name = users[socket.id];
    delete users[socket.id];
    io.emit('leaveChat', { name, users });
  });

  // Handle video call initiation
  socket.on('startCall', (data) => {
    socket.broadcast.emit('incomingCall', data);
  });

  // Handle accepting the call
  socket.on('acceptCall', (data) => {
    socket.broadcast.emit('callAccepted', data);
  });
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
