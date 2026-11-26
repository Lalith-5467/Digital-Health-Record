/**
 * WebRTC ICE and STUN/TURN Configuration Helper
 * Fetches short-lived, authenticated TURN/STUN credentials securely from the backend.
 * Never bundles permanent secrets into the client-side code.
 */

const DEFAULT_STUN_SERVERS: RTCIceServer[] = [
  {
    urls: [
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302',
      'stun:stun2.l.google.com:19302',
    ],
  },
];

export const getRtcConfiguration = async (): Promise<RTCConfiguration> => {
  try {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('token') || sessionStorage.getItem('token')
        : null;

    if (token) {
      const apiBase =
        (import.meta as any).env?.VITE_API_URL ||
        (typeof window !== 'undefined' && window.location.origin
          ? window.location.port === '3000' || window.location.port === '5173'
            ? 'http://localhost:5000/api'
            : `${window.location.origin}/api`
          : 'http://localhost:5000/api');

      const response = await fetch(`${apiBase}/video-consultations/ice-servers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          return {
            iceServers: data.iceServers,
            iceCandidatePoolSize: 10,
          };
        }
      }
    }
  } catch (err) {
    console.warn('Could not fetch dynamic ICE servers, falling back to STUN:', err);
  }

  return {
    iceServers: DEFAULT_STUN_SERVERS,
    iceCandidatePoolSize: 10,
  };
};
