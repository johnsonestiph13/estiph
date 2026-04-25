/**
 * ESTIF HOME ULTIMATE - WEBRTC MODULE
 * Real-time video/audio streaming and peer-to-peer communication for security cameras and intercom
 * Version: 2.0.0
 * Author: Estifanos Yohannis
 */

// ============================================
// WEBRTC CONFIGURATION
// ============================================

const WebRTCConfig = {
    // ICE Server Configuration
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        {
            urls: 'turn:turn.estif-home.com:3478',
            username: 'estif',
            credential: 'estif2024'
        }
    ],
    
    // Media Constraints
    mediaConstraints: {
        video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
        },
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    },
    
    // Data Channel Configuration
    dataChannel: {
        ordered: true,
        maxRetransmits: 3,
        protocol: 'estif-protocol'
    },
    
    // Signaling Server
    signalingServer: 'wss://signaling.estif-home.com',
    
    // Connection Settings
    connectionTimeout: 30000,
    iceConnectionTimeout: 15000,
    maxReconnectAttempts: 3,
    reconnectDelay: 2000,
    
    // Recording Settings
    recording: {
        enabled: true,
        maxDuration: 300000, // 5 minutes
        mimeType: 'video/webm'
    },
    
    // Debug
    debug: false
};

// ============================================
// WEBRTC PEER CONNECTION
// ============================================

class WebRTCPeer {
    constructor(peerId, options = {}) {
        this.peerId = peerId;
        this.connection = null;
        this.dataChannel = null;
        this.localStream = null;
        this.remoteStream = null;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.isInitiator = options.isInitiator || false;
        this.connectionState = 'new';
        this.iceCandidates = [];
        this.listeners = [];
        this.reconnectAttempts = 0;
        
        this.init();
    }

    init() {
        this.createPeerConnection();
        this.setupEventHandlers();
        WebRTCConfig.debug && console.log(`[WebRTC] Peer ${this.peerId} initialized`);
    }

    createPeerConnection() {
        this.connection = new RTCPeerConnection({
            iceServers: WebRTCConfig.iceServers
        });
        
        // Create data channel if initiator
        if (this.isInitiator) {
            this.dataChannel = this.connection.createDataChannel(
                'estif-data',
                WebRTCConfig.dataChannel
            );
            this.setupDataChannelHandlers();
        }
        
        // Handle incoming data channel
        this.connection.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannelHandlers();
            this.notifyListeners('datachannel_ready', { channel: this.dataChannel });
        };
        
        // Handle ICE candidates
        this.connection.onicecandidate = (event) => {
            if (event.candidate) {
                this.notifyListeners('ice_candidate', {
                    candidate: event.candidate,
                    peerId: this.peerId
                });
            }
        };
        
        // Handle connection state changes
        this.connection.onconnectionstatechange = () => {
            this.connectionState = this.connection.connectionState;
            this.notifyListeners('connection_state_change', {
                state: this.connectionState,
                peerId: this.peerId
            });
            
            if (this.connectionState === 'connected') {
                this.reconnectAttempts = 0;
                this.notifyListeners('connected', { peerId: this.peerId });
            } else if (this.connectionState === 'disconnected') {
                this.handleDisconnect();
            } else if (this.connectionState === 'failed') {
                this.handleFailure();
            }
        };
        
        // Handle ICE connection state
        this.connection.onicestatechange = () => {
            this.notifyListeners('ice_state_change', {
                state: this.connection.iceConnectionState,
                peerId: this.peerId
            });
        };
        
        // Handle track events (remote stream)
        this.connection.ontrack = (event) => {
            this.remoteStream = event.streams[0];
            this.notifyListeners('remote_stream', { stream: this.remoteStream, peerId: this.peerId });
        };
    }

    setupDataChannelHandlers() {
        if (!this.dataChannel) return;
        
        this.dataChannel.onopen = () => {
            WebRTCConfig.debug && console.log(`[WebRTC] Data channel open for peer ${this.peerId}`);
            this.notifyListeners('data_channel_open', { peerId: this.peerId });
        };
        
        this.dataChannel.onclose = () => {
            WebRTCConfig.debug && console.log(`[WebRTC] Data channel closed for peer ${this.peerId}`);
            this.notifyListeners('data_channel_close', { peerId: this.peerId });
        };
        
        this.dataChannel.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.notifyListeners('data_message', { data, peerId: this.peerId });
            } catch (e) {
                this.notifyListeners('data_message', { data: event.data, peerId: this.peerId });
            }
        };
        
        this.dataChannel.onerror = (error) => {
            console.error(`[WebRTC] Data channel error for peer ${this.peerId}:`, error);
            this.notifyListeners('data_channel_error', { error, peerId: this.peerId });
        };
    }

    setupEventHandlers() {
        // Handle connection timeout
        this.connectionTimeout = setTimeout(() => {
            if (this.connectionState !== 'connected') {
                this.notifyListeners('timeout', { peerId: this.peerId });
                this.close();
            }
        }, WebRTCConfig.connectionTimeout);
    }

    // ============================================
    // MEDIA METHODS
    // ============================================

    async addLocalStream(stream) {
        this.localStream = stream;
        const tracks = stream.getTracks();
        tracks.forEach(track => {
            this.connection.addTrack(track, stream);
        });
        this.notifyListeners('local_stream_added', { stream });
    }

    async removeLocalStream() {
        if (this.localStream) {
            const senders = this.connection.getSenders();
            senders.forEach(sender => {
                this.connection.removeTrack(sender);
            });
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
            this.notifyListeners('local_stream_removed');
        }
    }

    async getLocalStream(mediaType = 'video') {
        const constraints = {
            video: mediaType === 'video' || mediaType === 'both',
            audio: mediaType === 'audio' || mediaType === 'both'
        };
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            await this.addLocalStream(stream);
            return stream;
        } catch (error) {
            console.error('[WebRTC] Failed to get local stream:', error);
            throw error;
        }
    }

    // ============================================
    // SIGNALING METHODS
    // ============================================

    async createOffer() {
        try {
            const offer = await this.connection.createOffer();
            await this.connection.setLocalDescription(offer);
            WebRTCConfig.debug && console.log(`[WebRTC] Offer created for peer ${this.peerId}`);
            return offer;
        } catch (error) {
            console.error('[WebRTC] Failed to create offer:', error);
            throw error;
        }
    }

    async createAnswer() {
        try {
            const answer = await this.connection.createAnswer();
            await this.connection.setLocalDescription(answer);
            WebRTCConfig.debug && console.log(`[WebRTC] Answer created for peer ${this.peerId}`);
            return answer;
        } catch (error) {
            console.error('[WebRTC] Failed to create answer:', error);
            throw error;
        }
    }

    async setRemoteDescription(description) {
        try {
            await this.connection.setRemoteDescription(description);
            WebRTCConfig.debug && console.log(`[WebRTC] Remote description set for peer ${this.peerId}`);
        } catch (error) {
            console.error('[WebRTC] Failed to set remote description:', error);
            throw error;
        }
    }

    async addIceCandidate(candidate) {
        try {
            await this.connection.addIceCandidate(candidate);
            WebRTCConfig.debug && console.log(`[WebRTC] ICE candidate added for peer ${this.peerId}`);
        } catch (error) {
            console.error('[WebRTC] Failed to add ICE candidate:', error);
            throw error;
        }
    }

    // ============================================
    // DATA CHANNEL METHODS
    // ============================================

    sendData(data) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            const message = typeof data === 'string' ? data : JSON.stringify(data);
            this.dataChannel.send(message);
            return true;
        }
        return false;
    }

    sendCommand(command, params = {}) {
        return this.sendData({
            type: 'command',
            command,
            params,
            timestamp: Date.now()
        });
    }

    sendDeviceStatus(status) {
        return this.sendData({
            type: 'device_status',
            status,
            timestamp: Date.now()
        });
    }

    // ============================================
    // RECORDING METHODS
    // ============================================

    startRecording() {
        if (!WebRTCConfig.recording.enabled) return;
        
        if (this.remoteStream) {
            const options = {
                mimeType: WebRTCConfig.recording.mimeType
            };
            
            this.mediaRecorder = new MediaRecorder(this.remoteStream, options);
            this.recordedChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, {
                    type: WebRTCConfig.recording.mimeType
                });
                const url = URL.createObjectURL(blob);
                this.notifyListeners('recording_complete', { blob, url });
            };
            
            this.mediaRecorder.start(1000); // Capture every second
            this.notifyListeners('recording_started');
        }
    }

    stopRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
            this.notifyListeners('recording_stopped');
        }
    }

    // ============================================
    // CONNECTION MANAGEMENT
    // ============================================

    handleDisconnect() {
        clearTimeout(this.connectionTimeout);
        this.notifyListeners('disconnected', { peerId: this.peerId });
        
        if (this.reconnectAttempts < WebRTCConfig.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                WebRTCConfig.debug && console.log(`[WebRTC] Reconnecting to peer ${this.peerId} (attempt ${this.reconnectAttempts})`);
                this.notifyListeners('reconnecting', { attempts: this.reconnectAttempts });
            }, WebRTCConfig.reconnectDelay * this.reconnectAttempts);
        } else {
            this.notifyListeners('reconnect_failed', { peerId: this.peerId });
        }
    }

    handleFailure() {
        clearTimeout(this.connectionTimeout);
        this.notifyListeners('connection_failed', { peerId: this.peerId });
        this.close();
    }

    close() {
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        
        if (this.connection) {
            this.connection.close();
            this.connection = null;
        }
        
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
        
        clearTimeout(this.connectionTimeout);
        this.connectionState = 'closed';
        this.notifyListeners('closed', { peerId: this.peerId });
    }

    // ============================================
    // STATS & UTILITY
    // ============================================

    getStats() {
        if (this.connection) {
            return this.connection.getStats();
        }
        return null;
    }

    getConnectionState() {
        return this.connectionState;
    }

    isConnected() {
        return this.connectionState === 'connected';
    }

    // ============================================
    // EVENT SYSTEM
    // ============================================

    on(event, callback) {
        this.listeners.push({ event, callback });
        return () => {
            const index = this.listeners.findIndex(l => l.event === event && l.callback === callback);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            if (listener.event === event) {
                listener.callback(data);
            }
        });
    }
}

// ============================================
// WEBRTC MANAGER
// ============================================

class WebRTCManager {
    constructor() {
        this.peers = new Map();
        this.signalingSocket = null;
        this.localStream = null;
        this.isConnected = false;
        this.listeners = [];
        this.pendingCalls = new Map();
        
        this.init();
    }

    init() {
        this.connectSignaling();
        WebRTCConfig.debug && console.log('[WebRTC] Manager initialized');
    }

    connectSignaling() {
        this.signalingSocket = new WebSocket(WebRTCConfig.signalingServer);
        
        this.signalingSocket.onopen = () => {
            WebRTCConfig.debug && console.log('[WebRTC] Signaling connected');
            this.isConnected = true;
            this.notifyListeners('signaling_connected');
        };
        
        this.signalingSocket.onmessage = (event) => {
            this.handleSignalingMessage(JSON.parse(event.data));
        };
        
        this.signalingSocket.onerror = (error) => {
            console.error('[WebRTC] Signaling error:', error);
            this.notifyListeners('signaling_error', { error });
        };
        
        this.signalingSocket.onclose = () => {
            WebRTCConfig.debug && console.log('[WebRTC] Signaling disconnected');
            this.isConnected = false;
            this.notifyListeners('signaling_disconnected');
            
            // Reconnect after delay
            setTimeout(() => this.connectSignaling(), 3000);
        };
    }

    handleSignalingMessage(message) {
        const { type, peerId, data } = message;
        
        switch (type) {
            case 'offer':
                this.handleOffer(peerId, data);
                break;
            case 'answer':
                this.handleAnswer(peerId, data);
                break;
            case 'ice_candidate':
                this.handleICECandidate(peerId, data);
                break;
            case 'hangup':
                this.handleHangup(peerId);
                break;
            case 'call_request':
                this.handleCallRequest(peerId, data);
                break;
        }
    }

    // ============================================
    // PEER MANAGEMENT
    // ============================================

    async createPeer(peerId, isInitiator = false) {
        if (this.peers.has(peerId)) {
            return this.peers.get(peerId);
        }
        
        const peer = new WebRTCPeer(peerId, { isInitiator });
        
        // Setup peer event handlers
        peer.on('ice_candidate', ({ candidate }) => {
            this.sendSignaling(peerId, 'ice_candidate', { candidate });
        });
        
        peer.on('connected', () => {
            this.notifyListeners('peer_connected', { peerId });
        });
        
        peer.on('disconnected', () => {
            this.notifyListeners('peer_disconnected', { peerId });
        });
        
        peer.on('remote_stream', ({ stream }) => {
            this.notifyListeners('remote_stream', { peerId, stream });
        });
        
        peer.on('data_message', ({ data }) => {
            this.notifyListeners('data_message', { peerId, data });
        });
        
        peer.on('closed', () => {
            this.peers.delete(peerId);
            this.notifyListeners('peer_closed', { peerId });
        });
        
        this.peers.set(peerId, peer);
        
        if (isInitiator && this.localStream) {
            await peer.addLocalStream(this.localStream);
        }
        
        return peer;
    }

    async connectToPeer(peerId) {
        const peer = await this.createPeer(peerId, true);
        
        // Create and send offer
        const offer = await peer.createOffer();
        this.sendSignaling(peerId, 'offer', { sdp: offer.sdp });
        
        return peer;
    }

    async handleOffer(peerId, data) {
        const peer = await this.createPeer(peerId, false);
        await peer.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        
        if (this.localStream) {
            await peer.addLocalStream(this.localStream);
        }
        
        const answer = await peer.createAnswer();
        this.sendSignaling(peerId, 'answer', { sdp: answer.sdp });
    }

    async handleAnswer(peerId, data) {
        const peer = this.peers.get(peerId);
        if (peer) {
            await peer.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        }
    }

    async handleICECandidate(peerId, data) {
        const peer = this.peers.get(peerId);
        if (peer) {
            await peer.addIceCandidate(data.candidate);
        }
    }

    handleHangup(peerId) {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.close();
        }
    }

    handleCallRequest(peerId, data) {
        this.pendingCalls.set(peerId, data);
        this.notifyListeners('incoming_call', { peerId, caller: data.caller });
    }

    // ============================================
    // CALL MANAGEMENT
    // ============================================

    async acceptCall(peerId) {
        const callData = this.pendingCalls.get(peerId);
        if (callData) {
            this.pendingCalls.delete(peerId);
            await this.connectToPeer(peerId);
            this.notifyListeners('call_accepted', { peerId });
        }
    }

    rejectCall(peerId) {
        this.pendingCalls.delete(peerId);
        this.sendSignaling(peerId, 'reject_call', {});
        this.notifyListeners('call_rejected', { peerId });
    }

    async makeCall(peerId) {
        this.sendSignaling(peerId, 'call_request', {
            caller: this.getLocalPeerId(),
            timestamp: Date.now()
        });
        await this.connectToPeer(peerId);
    }

    async endCall(peerId) {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.close();
        }
        this.sendSignaling(peerId, 'hangup', {});
        this.notifyListeners('call_ended', { peerId });
    }

    // ============================================
    // MEDIA CONTROL
    // ============================================

    async getLocalUserMedia(mediaType = 'both') {
        this.localStream = await navigator.mediaDevices.getUserMedia({
            video: mediaType === 'video' || mediaType === 'both',
            audio: mediaType === 'audio' || mediaType === 'both'
        });
        
        // Add stream to all connected peers
        for (const [peerId, peer] of this.peers) {
            if (peer.isConnected()) {
                await peer.addLocalStream(this.localStream);
            }
        }
        
        this.notifyListeners('local_stream_ready', { stream: this.localStream });
        return this.localStream;
    }

    stopLocalStream() {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
            
            for (const [, peer] of this.peers) {
                peer.removeLocalStream();
            }
            
            this.notifyListeners('local_stream_stopped');
        }
    }

    async switchCamera() {
        if (!this.localStream) return;
        
        const videoTrack = this.localStream.getVideoTracks()[0];
        const currentSettings = videoTrack.getSettings();
        const newFacingMode = currentSettings.facingMode === 'user' ? 'environment' : 'user';
        
        const newStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: newFacingMode } },
            audio: true
        });
        
        // Replace track
        const newVideoTrack = newStream.getVideoTracks()[0];
        const senders = this.peers.values().next().value?.connection.getSenders();
        
        if (senders) {
            const videoSender = senders.find(sender => sender.track?.kind === 'video');
            if (videoSender) {
                await videoSender.replaceTrack(newVideoTrack);
            }
        }
        
        // Update local stream
        const oldVideoTrack = this.localStream.getVideoTracks()[0];
        this.localStream.removeTrack(oldVideoTrack);
        this.localStream.addTrack(newVideoTrack);
        oldVideoTrack.stop();
        
        this.notifyListeners('camera_switched', { facingMode: newFacingMode });
    }

    // ============================================
    // SCREEN SHARING
    // ============================================

    async startScreenShare() {
        try {
            const screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            
            // Replace video track with screen share track
            const screenTrack = screenStream.getVideoTracks()[0];
            
            for (const [, peer] of this.peers) {
                const senders = peer.connection.getSenders();
                const videoSender = senders.find(sender => sender.track?.kind === 'video');
                if (videoSender) {
                    await videoSender.replaceTrack(screenTrack);
                }
            }
            
            screenTrack.onended = () => {
                this.stopScreenShare();
            };
            
            this.notifyListeners('screen_share_started');
            return screenStream;
        } catch (error) {
            console.error('[WebRTC] Screen share failed:', error);
            throw error;
        }
    }

    async stopScreenShare() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            
            for (const [, peer] of this.peers) {
                const senders = peer.connection.getSenders();
                const videoSender = senders.find(sender => sender.track?.kind === 'video');
                if (videoSender) {
                    await videoSender.replaceTrack(videoTrack);
                }
            }
        }
        
        this.notifyListeners('screen_share_stopped');
    }

    // ============================================
    // UTILITY METHODS
    // ============================================

    sendSignaling(peerId, type, data) {
        if (this.signalingSocket && this.signalingSocket.readyState === WebSocket.OPEN) {
            this.signalingSocket.send(JSON.stringify({
                type,
                peerId,
                data
            }));
        }
    }

    getLocalPeerId() {
        let peerId = localStorage.getItem('webrtc_peer_id');
        if (!peerId) {
            peerId = 'peer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
            localStorage.setItem('webrtc_peer_id', peerId);
        }
        return peerId;
    }

    getPeers() {
        return Array.from(this.peers.keys());
    }

    getPeer(peerId) {
        return this.peers.get(peerId);
    }

    sendToPeer(peerId, data) {
        const peer = this.peers.get(peerId);
        if (peer) {
            return peer.sendData(data);
        }
        return false;
    }

    broadcastToAll(data) {
        for (const [, peer] of this.peers) {
            peer.sendData(data);
        }
    }

    // ============================================
    // EVENT SYSTEM
    // ============================================

    addEventListener(event, callback) {
        this.listeners.push({ event, callback });
        return () => {
            const index = this.listeners.findIndex(l => l.event === event && l.callback === callback);
            if (index !== -1) this.listeners.splice(index, 1);
        };
    }

    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            if (listener.event === event) {
                listener.callback(data);
            }
        });
    }
}

// ============================================
// WEBRTC UI COMPONENT
// ============================================

class WebRTCUI {
    constructor(manager) {
        this.manager = manager;
        this.localVideo = null;
        this.remoteVideo = null;
        this.currentPeerId = null;
        this.isScreenSharing = false;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        WebRTCConfig.debug && console.log('[WebRTCUI] Initialized');
    }

    createUI() {
        const container = document.getElementById('webrtc-container');
        if (!container) return;

        container.innerHTML = `
            <div class="webrtc-panel">
                <div class="webrtc-header">
                    <i class="fas fa-video"></i>
                    <h3>Video Call</h3>
                    <span class="webrtc-status" id="webrtc-status">Disconnected</span>
                </div>
                
                <div class="webrtc-videos">
                    <div class="local-video-container">
                        <video id="local-video" autoplay muted playsinline></video>
                        <div class="video-label">You</div>
                    </div>
                    <div class="remote-video-container">
                        <video id="remote-video" autoplay playsinline></video>
                        <div class="video-label">Remote</div>
                    </div>
                </div>
                
                <div class="webrtc-controls">
                    <button id="start-camera" class="control-btn">
                        <i class="fas fa-camera"></i>
                    </button>
                    <button id="toggle-mic" class="control-btn">
                        <i class="fas fa-microphone"></i>
                    </button>
                    <button id="switch-camera" class="control-btn">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <button id="share-screen" class="control-btn">
                        <i class="fas fa-desktop"></i>
                    </button>
                    <button id="end-call" class="control-btn danger" disabled>
                        <i class="fas fa-phone-slash"></i>
                    </button>
                </div>
                
                <div class="webrtc-peers">
                    <h4>Available Peers</h4>
                    <div class="peers-list" id="peers-list"></div>
                </div>
            </div>
        `;

        this.cacheElements();
    }

    cacheElements() {
        this.localVideo = document.getElementById('local-video');
        this.remoteVideo = document.getElementById('remote-video');
        this.startCameraBtn = document.getElementById('start-camera');
        this.toggleMicBtn = document.getElementById('toggle-mic');
        this.switchCameraBtn = document.getElementById('switch-camera');
        this.shareScreenBtn = document.getElementById('share-screen');
        this.endCallBtn = document.getElementById('end-call');
        this.peersList = document.getElementById('peers-list');
        this.statusSpan = document.getElementById('webrtc-status');
    }

    bindEvents() {
        if (this.startCameraBtn) {
            this.startCameraBtn.addEventListener('click', () => this.startCamera());
        }
        
        if (this.toggleMicBtn) {
            this.toggleMicBtn.addEventListener('click', () => this.toggleMicrophone());
        }
        
        if (this.switchCameraBtn) {
            this.switchCameraBtn.addEventListener('click', () => this.switchCamera());
        }
        
        if (this.shareScreenBtn) {
            this.shareScreenBtn.addEventListener('click', () => this.toggleScreenShare());
        }
        
        if (this.endCallBtn) {
            this.endCallBtn.addEventListener('click', () => this.endCall());
        }
        
        this.manager.addEventListener('local_stream_ready', ({ stream }) => {
            if (this.localVideo) {
                this.localVideo.srcObject = stream;
            }
        });
        
        this.manager.addEventListener('remote_stream', ({ peerId, stream }) => {
            if (this.remoteVideo && peerId === this.currentPeerId) {
                this.remoteVideo.srcObject = stream;
            }
        });
        
        this.manager.addEventListener('peer_connected', ({ peerId }) => {
            this.updatePeersList();
        });
        
        this.manager.addEventListener('peer_disconnected', ({ peerId }) => {
            this.updatePeersList();
        });
        
        this.manager.addEventListener('incoming_call', ({ peerId, caller }) => {
            this.showIncomingCallDialog(peerId, caller);
        });
        
        this.manager.addEventListener('call_ended', () => {
            this.resetCall();
        });
    }

    async startCamera() {
        await this.manager.getLocalUserMedia('both');
        this.updateStatus('Camera Ready');
    }

    async toggleMicrophone() {
        if (this.manager.localStream) {
            const audioTrack = this.manager.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.toggleMicBtn.innerHTML = audioTrack.enabled ? 
                    '<i class="fas fa-microphone"></i>' : 
                    '<i class="fas fa-microphone-slash"></i>';
            }
        }
    }

    async switchCamera() {
        await this.manager.switchCamera();
    }

    async toggleScreenShare() {
        if (!this.isScreenSharing) {
            await this.manager.startScreenShare();
            this.isScreenSharing = true;
            this.shareScreenBtn.innerHTML = '<i class="fas fa-stop"></i>';
        } else {
            await this.manager.stopScreenShare();
            this.isScreenSharing = false;
            this.shareScreenBtn.innerHTML = '<i class="fas fa-desktop"></i>';
        }
    }

    async makeCall(peerId) {
        this.currentPeerId = peerId;
        await this.manager.makeCall(peerId);
        this.endCallBtn.disabled = false;
        this.updateStatus('Calling...');
    }

    async endCall() {
        if (this.currentPeerId) {
            await this.manager.endCall(this.currentPeerId);
            this.currentPeerId = null;
            this.endCallBtn.disabled = true;
            this.remoteVideo.srcObject = null;
            this.updateStatus('Disconnected');
        }
    }

    async acceptCall(peerId) {
        this.currentPeerId = peerId;
        await this.manager.acceptCall(peerId);
        this.endCallBtn.disabled = false;
        this.updateStatus('Connected');
    }

    rejectCall(peerId) {
        this.manager.rejectCall(peerId);
    }

    resetCall() {
        this.currentPeerId = null;
        this.endCallBtn.disabled = true;
        if (this.remoteVideo) {
            this.remoteVideo.srcObject = null;
        }
        this.updateStatus('Disconnected');
    }

    updatePeersList() {
        if (!this.peersList) return;
        
        const peers = this.manager.getPeers();
        
        if (peers.length === 0) {
            this.peersList.innerHTML = '<p class="no-peers">No peers available</p>';
            return;
        }
        
        this.peersList.innerHTML = peers.map(peerId => `
            <div class="peer-item" data-peer-id="${peerId}">
                <span class="peer-name">${peerId.substring(0, 12)}...</span>
                <button class="call-peer" data-peer="${peerId}">
                    <i class="fas fa-phone"></i> Call
                </button>
            </div>
        `).join('');
        
        // Bind call buttons
        document.querySelectorAll('.call-peer').forEach(btn => {
            btn.addEventListener('click', () => {
                const peerId = btn.dataset.peer;
                this.makeCall(peerId);
            });
        });
    }

    showIncomingCallDialog(peerId, caller) {
        const confirmed = confirm(`Incoming call from ${caller}. Accept?`);
        if (confirmed) {
            this.acceptCall(peerId);
        } else {
            this.rejectCall(peerId);
        }
    }

    updateStatus(status) {
        if (this.statusSpan) {
            this.statusSpan.textContent = status;
            this.statusSpan.className = `webrtc-status ${status.toLowerCase()}`;
        }
    }
}

// ============================================
// CSS STYLES (Auto-injected)
// ============================================

const webrtcStyles = `
    .webrtc-panel {
        background: var(--bg-card);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid var(--border-color);
    }
    
    .webrtc-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);
    }
    
    .webrtc-header i {
        font-size: 20px;
        color: var(--primary);
    }
    
    .webrtc-header h3 {
        flex: 1;
        margin: 0;
    }
    
    .webrtc-status {
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
    }
    
    .webrtc-status.connected { background: var(--success-soft); color: var(--success); }
    .webrtc-status.disconnected { background: var(--danger-soft); color: var(--danger); }
    .webrtc-status.calling { background: var(--warning-soft); color: var(--warning); }
    
    .webrtc-videos {
        display: flex;
        gap: 20px;
        margin-bottom: 20px;
    }
    
    .local-video-container,
    .remote-video-container {
        flex: 1;
        position: relative;
        background: #1a1a2e;
        border-radius: 8px;
        overflow: hidden;
        aspect-ratio: 16/9;
    }
    
    .local-video-container video,
    .remote-video-container video {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .video-label {
        position: absolute;
        bottom: 8px;
        left: 8px;
        background: rgba(0,0,0,0.6);
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        color: white;
    }
    
    .webrtc-controls {
        display: flex;
        justify-content: center;
        gap: 12px;
        margin-bottom: 20px;
    }
    
    .control-btn {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--bg-tertiary);
        border: none;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .control-btn:hover {
        background: var(--primary);
        color: white;
    }
    
    .control-btn.danger:hover {
        background: var(--danger);
    }
    
    .webrtc-peers h4 {
        margin-bottom: 12px;
    }
    
    .peers-list {
        max-height: 150px;
        overflow-y: auto;
    }
    
    .peer-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        background: var(--bg-secondary);
        border-radius: 6px;
        margin-bottom: 8px;
    }
    
    .call-peer {
        background: var(--success);
        border: none;
        border-radius: 6px;
        padding: 4px 12px;
        color: white;
        cursor: pointer;
    }
    
    .no-peers {
        text-align: center;
        color: var(--text-muted);
        padding: 20px;
    }
`;

// Inject styles
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = webrtcStyles;
    document.head.appendChild(styleSheet);
}

// ============================================
// CREATE SINGLETON INSTANCES
// ============================================

const webrtcManager = new WebRTCManager();
const webrtcUI = new WebRTCUI(webrtcManager);

// ============================================
// EXPORTS
// ============================================

// Expose to window
window.webrtcManager = webrtcManager;
window.webrtcUI = webrtcUI;
window.WebRTCManager = WebRTCManager;
window.WebRTCConfig = WebRTCConfig;

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        webrtcManager,
        webrtcUI,
        WebRTCManager,
        WebRTCConfig
    };
}

// ES modules export
export {
    webrtcManager,
    webrtcUI,
    WebRTCManager,
    WebRTCConfig
};