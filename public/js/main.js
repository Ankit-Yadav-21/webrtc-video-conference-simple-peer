/**
 * Socket.io socket
 */
let socket;
/**
 * The stream object used to send media
 */
let localStream = null;
/**
 * All peer connections
 */
let peers = {}

/**
 * Get Screen Sharing Status
 */
let isScreenSharing = false;

/**
 * RTCPeerConnection configuration 
 */

const configuration = {
    // Using From https://www.metered.ca/tools/openrelay/
    "iceServers": [
        {
            urls: "stun:stun.relay.metered.ca:80",
        },
        {
            urls: "turn:a.relay.metered.ca:80",
            username: "9e360f34e035744ee6a225d4",
            credential: "zXYscz+FjEaOEk0D",
        },
        {
            urls: "turn:a.relay.metered.ca:80?transport=tcp",
            username: "9e360f34e035744ee6a225d4",
            credential: "zXYscz+FjEaOEk0D",
        },
        {
            urls: "turn:a.relay.metered.ca:443",
            username: "9e360f34e035744ee6a225d4",
            credential: "zXYscz+FjEaOEk0D",
        },
        {
            urls: "turn:a.relay.metered.ca:443?transport=tcp",
            username: "9e360f34e035744ee6a225d4",
            credential: "zXYscz+FjEaOEk0D",
        },
    ]
}

/**
 * UserMedia constraints
 */
let constraints = {
    audio: true,
    video: {
        width: {
            min: 200,
            max: 300
        },
        height: {
            min: 200,
            max: 300
        }
    }
}

/////////////////////////////////////////////////////////

constraints.video.facingMode = {
    ideal: "user"
}

function handleSuccess(stream) {
    window.stream = stream; // make stream available to browser console
    localVideo.srcObject = stream;
    localStream = stream;
    init()
}

function handleError(error) {
    console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}

// enabling the camera at startup
navigator.mediaDevices.getUserMedia(constraints).then(handleSuccess).catch(handleError);

/**
 * initialize the socket connections
 */
function init() {
    socket = io()

    socket.on('initReceive', socket_id => {
        console.log('INIT RECEIVE ' + socket_id)
        addPeer(socket_id, false)

        socket.emit('initSend', socket_id)
    })

    socket.on('initSend', socket_id => {
        console.log('INIT SEND ' + socket_id)
        addPeer(socket_id, true)
    })

    socket.on('removePeer', socket_id => {
        console.log('removing peer ' + socket_id)
        removePeer(socket_id)
    })

    socket.on('disconnect', () => {
        console.log('GOT DISCONNECTED')
        for (let socket_id in peers) {
            removePeer(socket_id)
        }
    })

    socket.on('signal', data => {
        peers[data.socket_id].signal(data.signal)
    })
}

/**
 * Remove a peer with given socket_id. 
 * Removes the video element and deletes the connection
 * @param {String} socket_id 
 */
function removePeer(socket_id) {

    let videoEl = document.getElementById(socket_id)
    if (videoEl) {

        const tracks = videoEl.srcObject.getTracks();

        tracks.forEach(function (track) {
            track.stop()
        })

        videoEl.srcObject = null
        videoEl.parentNode.removeChild(videoEl)
    }
    if (peers[socket_id]) peers[socket_id].destroy()
    delete peers[socket_id]
}

/**
 * Creates a new peer connection and sets the event listeners
 * @param {String} socket_id 
 *                 ID of the peer
 * @param {Boolean} am_initiator 
 *                  Set to true if the peer initiates the connection process.
 *                  Set to false if the peer receives the connection. 
 */
function addPeer(socket_id, am_initiator) {
    peers[socket_id] = new SimplePeer({
        initiator: am_initiator,
        stream: localStream,
        config: configuration
    })

    peers[socket_id].on('signal', data => {
        socket.emit('signal', {
            signal: data,
            socket_id: socket_id
        })
    })

    peers[socket_id].on('stream', stream => {
        let newVid = document.createElement('video')
        newVid.srcObject = stream
        newVid.id = socket_id
        newVid.setAttribute('playsinline', true); // Add the playsinline attribute
        newVid.setAttribute('autoplay', true); // Autoplay might not work on iOS; consider user-triggered play
        newVid.className = "vid"
        newVid.style = "width:100%; transform: rotateY(180deg); max-height: 400px; object-fit: cover;"
        videos.appendChild(newVid)

        // Consider adding a button or gesture to trigger playback on iOS
        newVid.addEventListener('click', () => {
            newVid.play();
        });
    })
}

/**
 * Switches the camera between user and environment. It will just enable the camera 2 cameras not supported.
 */
function switchMedia() {
    if (constraints.video.facingMode.ideal === 'user') {
        constraints.video.facingMode.ideal = 'environment'
    } else {
        constraints.video.facingMode.ideal = 'user'
    }

    const tracks = localStream.getTracks();

    tracks.forEach(function (track) {
        track.stop()
    })

    localVideo.srcObject = null
    navigator.mediaDevices.getUserMedia(constraints).then(stream => {

        for (let socket_id in peers) {
            for (let index in peers[socket_id].streams[0].getTracks()) {
                for (let index2 in stream.getTracks()) {
                    if (peers[socket_id].streams[0].getTracks()[index].kind === stream.getTracks()[index2].kind) {
                        peers[socket_id].replaceTrack(peers[socket_id].streams[0].getTracks()[index], stream.getTracks()[index2], peers[socket_id].streams[0])
                        break;
                    }
                }
            }
        }

        localStream = stream
        localVideo.srcObject = stream

        updateButtons()
    })
}

/**
 * Enable screen share
 */
function setScreen() {
    if (isScreenSharing) {
        // Stop screen sharing
        const tracks = localStream.getTracks();
        tracks.forEach(function (track) {
            track.stop();
        });

        localVideo.srcObject = null;
        isScreenSharing = false;

        // Start camera streaming
        navigator.mediaDevices.getUserMedia(constraints).then(stream => {
            for (let socket_id in peers) {
                for (let index in peers[socket_id].streams[0].getTracks()) {
                    for (let index2 in stream.getTracks()) {
                        if (peers[socket_id].streams[0].getTracks()[index].kind === stream.getTracks()[index2].kind) {
                            peers[socket_id].replaceTrack(
                                peers[socket_id].streams[0].getTracks()[index],
                                stream.getTracks()[index2],
                                peers[socket_id].streams[0]
                            );
                            break;
                        }
                    }
                }
            }

            localStream = stream;
            localVideo.srcObject = stream;
            screenButton.innerText = "Screen Share";
            updateButtons();
        });
    } else {
        // Start screen sharing
        navigator.mediaDevices.getDisplayMedia().then(stream => {
            for (let socket_id in peers) {
                for (let index in peers[socket_id].streams[0].getTracks()) {
                    for (let index2 in stream.getTracks()) {
                        if (peers[socket_id].streams[0].getTracks()[index].kind === stream.getTracks()[index2].kind) {
                            peers[socket_id].replaceTrack(
                                peers[socket_id].streams[0].getTracks()[index],
                                stream.getTracks()[index2],
                                peers[socket_id].streams[0]
                            );
                            break;
                        }
                    }
                }
            }
            localStream = stream;
            localVideo.srcObject = localStream;
            socket.emit('removeUpdatePeer', '');

            isScreenSharing = true;
            updateButtons();

            screenButton.innerText = "Stop Share";

            localVideo.srcObject.getVideoTracks()[0].onended = function () {
                console.log("Stop Sharing")
                setScreen()
            };
        });

    }
}


/**
 * Disables and removes the local stream and all the connections to other peers.
 */
function removeLocalStream() {
    if (localStream) {
        const tracks = localStream.getTracks();

        tracks.forEach(function (track) {
            track.stop()
        })

        localVideo.srcObject = null
    }

    for (let socket_id in peers) {
        removePeer(socket_id)
    }
}

/**
 * Enable/disable microphone
 */
function toggleMute() {
    for (let index in localStream.getAudioTracks()) {
        localStream.getAudioTracks()[index].enabled = !localStream.getAudioTracks()[index].enabled
        muteButton.innerText = localStream.getAudioTracks()[index].enabled ? "Unmuted" : "Muted"
    }
}
/**
 * Enable/disable video
 */
function toggleVid() {
    for (let index in localStream.getVideoTracks()) {
        localStream.getVideoTracks()[index].enabled = !localStream.getVideoTracks()[index].enabled
        vidButton.innerText = localStream.getVideoTracks()[index].enabled ? "Video Enabled" : "Video Disabled"
    }
}

/**
 * updating text of buttons
 */
function updateButtons() {
    for (let index in localStream.getVideoTracks()) {
        vidButton.innerText = localStream.getVideoTracks()[index].enabled ? "Video Enabled" : "Video Disabled"
    }
    for (let index in localStream.getAudioTracks()) {
        muteButton.innerText = localStream.getAudioTracks()[index].enabled ? "Unmuted" : "Muted"
    }
}
