// WebRTC helper configuration and connection management for SilentMeet

export const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.services.mozilla.com' },
  ],
  iceCandidatePoolSize: 10,
};

export function createPeerConnection({ onTrack, onIceCandidate, onConnectionStateChange }) {
  const pc = new RTCPeerConnection(RTC_CONFIG);

  pc.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      onTrack(event.streams[0]);
    } else {
      const inboundStream = new MediaStream([event.track]);
      onTrack(inboundStream);
    }
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      onIceCandidate(event.candidate);
    }
  };

  pc.onconnectionstatechange = () => {
    if (onConnectionStateChange) {
      onConnectionStateChange(pc.connectionState);
    }
  };

  return pc;
}

export function addTracksToPeer(pc, stream) {
  if (!pc || !stream) return [];
  const senders = [];
  stream.getTracks().forEach((track) => {
    try {
      const sender = pc.addTrack(track, stream);
      senders.push(sender);
    } catch (e) {
      console.warn('Could not add track:', e);
    }
  });
  return senders;
}

export function closePeerConnection(pc) {
  if (!pc) return;
  try {
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.onconnectionstatechange = null;
    pc.close();
  } catch (e) {
    console.warn('Error closing peer connection:', e);
  }
}
