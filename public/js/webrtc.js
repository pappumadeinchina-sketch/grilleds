// GrilledS WebRTC Calling Engine (Peer-to-Peer Voice & Video)

class WebRTCCallManager {
  constructor(socket, currentUser) {
    this.socket = socket;
    this.currentUser = currentUser;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentCall = null;
    this.callTimerInterval = null;
    this.callDurationSec = 0;

    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    };

    this.initSocketEvents();
  }

  initSocketEvents() {
    this.socket.on('incoming_call', (data) => {
      this.handleIncomingCall(data);
    });

    this.socket.on('call_accepted', async (data) => {
      this.stopRingtone();
      document.getElementById('incoming-call-view').classList.add('hidden');
      document.getElementById('active-call-view').classList.remove('hidden');
      this.startCallTimer();
      // Caller creates offer
      await this.createOffer(data.receiverId);
    });

    this.socket.on('call_rejected', () => {
      this.cleanupCall('Call was declined');
    });

    this.socket.on('call_ended', () => {
      this.cleanupCall('Call ended by other user');
    });

    this.socket.on('webrtc_offer', async ({ callerId, offer, callId }) => {
      await this.handleOffer(callerId, offer, callId);
    });

    this.socket.on('webrtc_answer', async ({ answer }) => {
      if (this.peerConnection) {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    this.socket.on('webrtc_ice_candidate', async ({ candidate }) => {
      if (this.peerConnection && candidate) {
        try {
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate', e);
        }
      }
    });
  }

  async startCall(targetUser, callType = 'audio') {
    this.currentCall = {
      targetUser,
      callType,
      isCaller: true,
      callId: 'call_' + Date.now()
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video'
      });

      const localVid = document.getElementById('local-video');
      if (localVid) localVid.srcObject = this.localStream;

      this.setupPeerConnection(targetUser.id);

      // Show call modal
      const modal = document.getElementById('call-modal-overlay');
      modal.classList.remove('hidden');
      document.getElementById('incoming-call-view').classList.add('hidden');
      document.getElementById('active-call-view').classList.remove('hidden');
      document.getElementById('active-call-peer-name').textContent = `Calling ${targetUser.display_name}...`;

      // Emit call event to peer
      this.socket.emit('call_user', {
        callId: this.currentCall.callId,
        caller: {
          id: this.currentUser.id,
          username: this.currentUser.username,
          displayName: this.currentUser.display_name,
          avatarUrl: this.currentUser.avatar_url
        },
        receiverId: targetUser.id,
        callType
      });

      this.playRingtone();
      if (typeof window.recordCallLog === 'function') {
        window.recordCallLog({ peer: targetUser, type: callType, direction: 'outgoing' });
      }
    } catch (err) {
      if (window.GrilledSModal) {
        GrilledSModal.alert('Could not access microphone/camera: ' + err.message, 'Media Permission Error', 'danger');
      } else {
        console.error('Could not access microphone/camera:', err);
      }
      this.cleanupCall();
    }
  }

  handleIncomingCall(data) {
    this.currentCall = {
      targetUser: data.caller,
      callType: data.callType,
      callId: data.callId,
      isCaller: false
    };

    const modal = document.getElementById('call-modal-overlay');
    modal.classList.remove('hidden');
    document.getElementById('incoming-call-view').classList.remove('hidden');
    document.getElementById('active-call-view').classList.add('hidden');

    document.getElementById('inc-caller-name').textContent = data.caller.displayName || data.caller.username;
    document.getElementById('inc-caller-avatar').src = data.caller.avatarUrl || 'https://api.dicebear.com/7.x/bottts/svg?seed=caller';
    document.getElementById('inc-call-type').innerHTML = `<i class="fa-solid fa-${data.callType === 'video' ? 'video' : 'phone'}"></i> Incoming ${data.callType.toUpperCase()} Call...`;

    this.playRingtone();
  }

  async acceptCall() {
    this.stopRingtone();
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: this.currentCall.callType === 'video'
      });

      const localVid = document.getElementById('local-video');
      if (localVid) localVid.srcObject = this.localStream;

      this.setupPeerConnection(this.currentCall.targetUser.id);

      document.getElementById('incoming-call-view').classList.add('hidden');
      document.getElementById('active-call-view').classList.remove('hidden');
      document.getElementById('active-call-peer-name').textContent = this.currentCall.targetUser.displayName;

      this.startCallTimer();

      this.socket.emit('call_accept', {
        callId: this.currentCall.callId,
        callerId: this.currentCall.targetUser.id,
        receiverId: this.currentUser.id
      });
    } catch (err) {
      if (window.GrilledSModal) {
        GrilledSModal.alert('Microphone/Camera permission error: ' + err.message, 'Media Permission Error', 'danger');
      } else {
        console.error('Microphone/Camera permission error:', err);
      }
      this.rejectCall();
    }
  }

  rejectCall() {
    this.stopRingtone();
    if (this.currentCall) {
      if (typeof window.recordCallLog === 'function') {
        window.recordCallLog({ peer: this.currentCall.targetUser, type: this.currentCall.callType, direction: 'missed' });
      }
      this.socket.emit('call_reject', {
        callId: this.currentCall.callId,
        callerId: this.currentCall.targetUser.id,
        reason: 'declined'
      });
    }
    this.cleanupCall();
  }

  hangupCall() {
    if (this.currentCall) {
      this.socket.emit('call_hangup', {
        callId: this.currentCall.callId,
        targetUserId: this.currentCall.targetUser.id
      });
    }
    this.cleanupCall();
  }

  setupPeerConnection(targetUserId) {
    this.peerConnection = new RTCPeerConnection(this.rtcConfig);

    // Add local tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Handle remote tracks
    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      const remoteVid = document.getElementById('remote-video');
      if (remoteVid) {
        remoteVid.srcObject = this.remoteStream;
      }
    };

    // Send ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.currentCall) {
        this.socket.emit('webrtc_ice_candidate', {
          targetUserId,
          candidate: event.candidate,
          callId: this.currentCall.callId
        });
      }
    };
  }

  async createOffer(targetUserId) {
    if (!this.peerConnection) return;
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    this.socket.emit('webrtc_offer', {
      targetUserId,
      offer,
      callId: this.currentCall.callId
    });
  }

  async handleOffer(callerId, offer, callId) {
    if (!this.peerConnection) {
      this.setupPeerConnection(callerId);
    }

    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    this.socket.emit('webrtc_answer', {
      targetUserId: callerId,
      answer,
      callId
    });
  }

  startCallTimer() {
    this.callDurationSec = 0;
    const timerElem = document.getElementById('call-timer');
    if (this.callTimerInterval) clearInterval(this.callTimerInterval);
    this.callTimerInterval = setInterval(() => {
      this.callDurationSec++;
      const mins = String(Math.floor(this.callDurationSec / 60)).padStart(2, '0');
      const secs = String(this.callDurationSec % 60).padStart(2, '0');
      if (timerElem) timerElem.textContent = `${mins}:${secs}`;
    }, 1000);
  }

  playRingtone() {
    const ringtone = document.getElementById('audio-ringtone');
    if (ringtone) ringtone.play().catch(() => {});
  }

  stopRingtone() {
    const ringtone = document.getElementById('audio-ringtone');
    if (ringtone) {
      ringtone.pause();
      ringtone.currentTime = 0;
    }
  }

  cleanupCall(message = null) {
    this.stopRingtone();
    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
      this.callTimerInterval = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.currentCall = null;
    const modal = document.getElementById('call-modal-overlay');
    if (modal) modal.classList.add('hidden');

    if (message) {
      console.log('Call state update:', message);
    }
  }

  toggleMicrophone() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }

  toggleCamera() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }
}
