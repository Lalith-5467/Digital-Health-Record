import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, 
  Volume2, 
  VolumeX,
  FileText,
  Heart,
  Pill,
  AlertTriangle,
  QrCode,
  Play,
  X
} from 'lucide-react';
import { SpotlightCard } from '../ui/SpotlightCard';
import { useSiteConfig } from '../../context/ConfigContext';

interface HeroProps {
  onStartJourney: () => void;
  onSeeHowItWorks: () => void;
}

const CARDS_DATA = [
  { 
    id: 'records', 
    title: 'Medical Records', 
    subtitle: '12 Records Verified', 
    icon: FileText, 
    color: 'text-[#00a896] bg-teal-50 dark:bg-teal-950/60 border-teal-100 dark:border-teal-800/40',
    spotlightColor: 'rgba(0, 168, 150, 0.3)'
  },
  { 
    id: 'reminder', 
    title: 'Medicine Reminder', 
    subtitle: 'Next dose 8:00 AM', 
    icon: Pill, 
    color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/60 border-purple-100 dark:border-purple-800/40',
    spotlightColor: 'rgba(168, 85, 247, 0.3)'
  },
  { 
    id: 'doctor', 
    title: 'Doctor Shared', 
    subtitle: 'Report Shared', 
    icon: QrCode, 
    color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/60 border-indigo-100 dark:border-indigo-800/40',
    spotlightColor: 'rgba(99, 102, 241, 0.3)'
  },
  { 
    id: 'health', 
    title: 'Health Status', 
    subtitle: '98% Vitals Normal', 
    icon: Heart, 
    color: 'text-rose-500 bg-rose-50 dark:bg-rose-950/60 border-rose-100 dark:border-rose-800/40',
    spotlightColor: 'rgba(244, 63, 94, 0.3)'
  },
  { 
    id: 'sos', 
    title: 'Emergency SOS', 
    subtitle: 'SOS Pass Ready', 
    icon: AlertTriangle, 
    color: 'text-red-500 bg-red-50 dark:bg-red-950/60 border-red-100 dark:border-red-800/40',
    spotlightColor: 'rgba(239, 68, 68, 0.3)'
  },
];

export const Hero: React.FC<HeroProps> = ({ onStartJourney, onSeeHowItWorks }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tryPlay = async () => {
      try {
        if (video.paused) {
          await video.play();
        }
      } catch (err: any) {
        // Ignore standard browser power-saving or tab-visibility AbortError (https://goo.gl/LdLk22)
        if (err?.name !== 'AbortError' && err?.name !== 'NotAllowedError') {
          console.debug('Hero video autoplay note:', err?.message || err);
        }
      }
    };

    tryPlay();
  }, []);

  // Close video modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsVideoModalOpen(false);
      }
    };
    if (isVideoModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVideoModalOpen]);

  // 3-SECOND AUTOMATIC DOWNWARD-SLIDING CARD SWAP
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveCardIndex((prevIndex) => (prevIndex + 1) % CARDS_DATA.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const toggleSound = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  let heroConfig: any = null;
  let brandingConfig: any = null;
  try {
    const siteConfig = useSiteConfig();
    heroConfig = siteConfig.landing?.hero;
    brandingConfig = siteConfig.branding;
  } catch {}

  if (heroConfig?.enabled === false) {
    return null;
  }

  const title = heroConfig?.title || 'Your Health,';
  const highlightTitle = heroConfig?.highlightTitle || 'Always With You.';
  const subtitle = heroConfig?.subtitle || 'Secure your medical records, manage your medicines, share health information with doctors, and stay prepared for emergencies — all in one place.';
  const primaryCta = heroConfig?.primaryCtaText || 'Get Started';
  const secondaryCta = heroConfig?.secondaryCtaText || 'Connect ABHA';
  const videoSrc = heroConfig?.backgroundVideoUrl || '/Digital_Health_Record_For_Project.mp4';
  const imageSrc = heroConfig?.backgroundImageUrl || '';
  const mediaType = heroConfig?.mediaType || (imageSrc && !videoSrc ? 'image' : 'video');
  const isImage = mediaType === 'image' && Boolean(imageSrc);
  const overlayStyle = heroConfig?.overlayStyle || 'gradient';
  const showSoundControl = heroConfig?.showSoundControl !== false;
  const showIndicators = heroConfig?.showIndicators !== false;
  const showSosCard = heroConfig?.showSosCard !== false;
  const sosCardTitle = heroConfig?.sosCardTitle || 'Emergency SOS';
  const sosCardSubtitle = heroConfig?.sosCardSubtitle || 'SOS Pass Ready';
  const accentColor = brandingConfig?.accentColor || '#00d2be';
  const primaryColor = brandingConfig?.primaryColor || '#00a896';

  const activeCards = CARDS_DATA
    .map((card) => {
      if (card.id === 'sos') {
        return {
          ...card,
          title: sosCardTitle,
          subtitle: sosCardSubtitle,
        };
      }
      return card;
    })
    .filter((card) => {
      if (card.id === 'sos' && !showSosCard) return false;
      return true;
    });

  const displayCards = activeCards.length > 0 ? activeCards : CARDS_DATA;
  const activeCard = displayCards[activeCardIndex % displayCards.length];
  const IconComponent = activeCard.icon;

  return (
    <section id="home" className="relative w-full min-h-[560px] sm:min-h-[640px] lg:min-h-[calc(100vh-5rem)] py-8 sm:py-12 lg:py-16 flex items-center overflow-hidden bg-slate-900">

      {/* 1. RESPONSIVE BACKGROUND MEDIA LAYER (MOBILE, TABLET, LAPTOP) */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        {isImage ? (
          <img
            src={imageSrc}
            alt="Hero Background"
            className="w-full h-full object-cover object-center sm:object-[center_35%] lg:object-top transition-all duration-700"
          />
        ) : (
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            muted={isMuted}
            loop
            playsInline
            className="w-full h-full object-cover object-center sm:object-[center_35%] lg:object-top transition-all duration-700 pointer-events-none"
          />
        )}

        {/* 2. RESPONSIVE OVERLAY LAYER (ADAPTIVE CONTRAST FOR MOBILE & DESKTOP) */}
        <div 
          className={`absolute inset-0 ${
            overlayStyle === 'dark'
              ? 'bg-slate-950/80 sm:bg-slate-950/75'
              : overlayStyle === 'light'
              ? 'bg-slate-950/35 sm:bg-slate-950/25'
              : overlayStyle === 'medium'
              ? 'bg-slate-950/55 sm:bg-slate-950/45'
              : 'bg-gradient-to-b from-slate-950/85 via-slate-950/50 to-slate-950/80 sm:bg-gradient-to-r sm:from-slate-950/75 sm:via-slate-950/35 sm:to-transparent'
          }`} 
        />

        {/* AMBIENT GLOW DECORATIONS */}
        <div className="absolute top-1/4 left-10 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-1/3 w-[500px] h-[500px] bg-cyan-500/10 dark:bg-cyan-600/15 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* SOUND TOGGLE BUTTON */}
      {!isImage && showSoundControl && (
        <button
          type="button"
          onClick={toggleSound}
          className="absolute bottom-4 sm:bottom-6 right-4 sm:right-6 z-20 flex items-center justify-center p-2.5 sm:p-3 rounded-full bg-slate-900/85 backdrop-blur-md border border-slate-700 text-white shadow-xl hover:bg-slate-900 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title={isMuted ? "Unmute Video Audio" : "Mute Video Audio"}
          aria-label={isMuted ? "Unmute Audio" : "Mute Audio"}
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-rose-400" />
          ) : (
            <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" />
          )}
        </button>
      )}

      {/* 3. HERO CONTENT & DOWNWARD-POSITIONED RIGHT CARDS */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* LEFT COLUMN: HERO TEXT & CTAS */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="lg:col-span-7 space-y-5 sm:space-y-6 text-left"
          >
            {/* MAIN HEADLINE */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15] drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
              {title} <br />
              <span style={{ color: accentColor }} className="drop-shadow-[0_2px_12px_rgba(0,210,190,0.3)]">{highlightTitle}</span>
            </h1>

            {/* SUBTITLE */}
            <p className="text-sm sm:text-base lg:text-lg text-slate-100 max-w-xl font-medium leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              {subtitle}
            </p>

            {/* ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-start gap-3 sm:gap-4 pt-2">
              <button
                type="button"
                onClick={onStartJourney}
                style={{ backgroundColor: primaryColor }}
                className="w-full sm:w-auto inline-flex items-center justify-center px-7 sm:px-8 py-3.5 text-sm sm:text-base font-bold text-white rounded-xl shadow-xl shadow-teal-950/50 hover:shadow-2xl transition-all active:scale-98 gap-2.5 cursor-pointer border border-teal-500/30"
              >
                <span>{primaryCta}</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={onSeeHowItWorks}
                className="group w-full sm:w-auto inline-flex items-center justify-center px-6 sm:px-7 py-3.5 text-sm sm:text-base font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-teal-500/15 backdrop-blur-md rounded-xl transition-all duration-200 gap-2 cursor-pointer active:scale-95 active:translate-y-0"
              >
                <FileText className="w-4 h-4 text-[#00a896] transition-transform duration-200 group-hover:scale-110 group-hover:text-teal-300" />
                <span>{secondaryCta}</span>
              </button>

              {!isImage && (
                <button
                  type="button"
                  onClick={() => setIsVideoModalOpen(true)}
                  className="group w-full sm:w-auto inline-flex items-center justify-center px-5 sm:px-6 py-3.5 text-sm sm:text-base font-semibold text-white bg-slate-900/60 hover:bg-slate-900/90 border border-teal-500/30 hover:border-teal-400 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-teal-500/20 backdrop-blur-md rounded-xl transition-all duration-200 gap-2 cursor-pointer active:scale-95 active:translate-y-0"
                >
                  <div className="w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Play className="w-3 h-3 fill-current ml-0.5 text-teal-400" />
                  </div>
                  <span>Watch Video</span>
                </button>
              )}
            </div>
          </motion.div>

          {/* RIGHT COLUMN: DOWNWARD-ALIGNED ROTATING SPOTLIGHT CARD */}
          <div className="lg:col-span-5 flex flex-col items-center lg:items-end justify-end py-2 sm:py-4 w-full">
            
            <div className="w-full max-w-[295px] flex flex-col items-center gap-3.5 relative mt-6 sm:mt-20 lg:mt-52">
              
              {/* DOWNWARD SLIDING CARD CONTAINER */}
              <div className="w-full overflow-hidden py-1">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeCard.id}
                    initial={{ opacity: 0, y: -25 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 25 }}
                    transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <SpotlightCard
                      spotlightColor={activeCard.spotlightColor}
                      className="w-full p-4 sm:p-4.5 rounded-2xl bg-white/70 dark:bg-slate-900/75 backdrop-blur-[20px] border border-white/60 dark:border-slate-700/70 shadow-2xl shadow-teal-950/20 dark:shadow-slate-950/70 flex items-center gap-3.5 transition-all select-none"
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${activeCard.color} shadow-sm`}>
                        <IconComponent className="w-5 h-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block font-mono">
                          Health Feature
                        </span>
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white leading-tight mt-0.5 truncate">
                          {activeCard.title}
                        </h4>
                        <p className="text-xs font-extrabold text-[#00a896] dark:text-teal-300 mt-0.5 truncate">
                          {activeCard.subtitle}
                        </p>
                      </div>
                    </SpotlightCard>
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* CAROUSEL PROGRESS INDICATOR DOTS */}
              {showIndicators && (
                <div className="flex items-center gap-2 pt-1">
                  {displayCards.map((card, idx) => (
                    <button
                      key={card.id}
                      onClick={() => setActiveCardIndex(idx)}
                      className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                        (activeCardIndex % displayCards.length) === idx 
                          ? 'w-7 bg-[#00a896]' 
                          : 'w-2 bg-white/40 dark:bg-slate-700 hover:bg-white/70'
                      }`}
                      title={`View ${card.title}`}
                      aria-label={`View ${card.title}`}
                    />
                  ))}
                </div>
              )}

            </div>

          </div>

        </div>
      </div>

      {/* 4. RESPONSIVE VIDEO SHOWCASE MODAL (PERFECT 16:9 PROPORTION ACROSS MOBILE, TAB, AND LAPTOP) */}
      <AnimatePresence>
        {isVideoModalOpen && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
            onClick={() => setIsVideoModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.3 }}
              className="relative w-full max-w-4xl bg-slate-950 rounded-2xl sm:rounded-3xl border border-teal-500/40 shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* MODAL HEADER BAR */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-800 bg-slate-900/90">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
                  <span className="text-xs sm:text-sm font-bold text-white tracking-wide">
                    MediCare Digital Health Record Overview
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsVideoModalOpen(false)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Close Video (Esc)"
                  aria-label="Close Video"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 16:9 RESPONSIVE CINEMATIC VIDEO PLAYER */}
              <div className="relative w-full aspect-video bg-black flex items-center justify-center">
                <video
                  src={videoSrc}
                  autoPlay
                  controls
                  playsInline
                  className="w-full h-full object-contain"
                >
                  Your browser does not support the video tag.
                </video>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};
