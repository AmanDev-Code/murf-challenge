import React, { useMemo } from 'react';
import { Track } from 'livekit-client';
import { AnimatePresence, type MotionProps, motion } from 'motion/react';
import {
  type TrackReference,
  VideoTrack,
  useLocalParticipant,
  useTracks,
  useVoiceAssistant,
} from '@livekit/components-react';
import { cn } from '@/lib/shadcn/utils';
import { AudioVisualizer } from './audio-visualizer';

const ANIMATION_TRANSITION: MotionProps['transition'] = {
  type: 'spring',
  stiffness: 675,
  damping: 75,
  mass: 1,
};

export function useLocalTrackRef(source: Track.Source) {
  const { localParticipant } = useLocalParticipant();
  const publication = localParticipant.getTrackPublication(source);
  const trackRef = useMemo<TrackReference | undefined>(
    () => (publication ? { source, participant: localParticipant, publication } : undefined),
    [source, publication, localParticipant]
  );
  return trackRef;
}

interface TileLayoutProps {
  chatOpen: boolean;
  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  audioVisualizerColor?: `#${string}`;
  audioVisualizerColorShift?: number;
  audioVisualizerWaveLineWidth?: number;
  audioVisualizerGridRowCount?: number;
  audioVisualizerGridColumnCount?: number;
  audioVisualizerRadialBarCount?: number;
  audioVisualizerRadialRadius?: number;
  audioVisualizerBarCount?: number;
}

export function TileLayout({
  chatOpen,
  audioVisualizerType,
  audioVisualizerColor,
  audioVisualizerColorShift,
  audioVisualizerBarCount,
  audioVisualizerRadialBarCount,
  audioVisualizerRadialRadius,
  audioVisualizerGridRowCount,
  audioVisualizerGridColumnCount,
  audioVisualizerWaveLineWidth,
}: TileLayoutProps) {
  const { videoTrack: agentVideoTrack } = useVoiceAssistant();
  const [screenShareTrack] = useTracks([Track.Source.ScreenShare]);
  const cameraTrack: TrackReference | undefined = useLocalTrackRef(Track.Source.Camera);

  const isCameraEnabled = cameraTrack && !cameraTrack.publication.isMuted;
  const isScreenShareEnabled = screenShareTrack && !screenShareTrack.publication.isMuted;
  const isAvatar = agentVideoTrack !== undefined;
  const videoWidth = agentVideoTrack?.publication.dimensions?.width ?? 0;
  const videoHeight = agentVideoTrack?.publication.dimensions?.height ?? 0;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      <AnimatePresence mode="popLayout">
        {!isAvatar && (
          <motion.div
            key="agent"
            layoutId="agent"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={ANIMATION_TRANSITION}
            className="relative flex items-center justify-center"
          >
            <AudioVisualizer
              key="audio-visualizer"
              initial={{ scale: 1 }}
              animate={{ scale: 1 }}
              transition={ANIMATION_TRANSITION}
              audioVisualizerType={audioVisualizerType}
              audioVisualizerColor={audioVisualizerColor}
              audioVisualizerColorShift={audioVisualizerColorShift}
              audioVisualizerBarCount={audioVisualizerBarCount}
              audioVisualizerRadialBarCount={audioVisualizerRadialBarCount}
              audioVisualizerRadialRadius={audioVisualizerRadialRadius}
              audioVisualizerGridRowCount={audioVisualizerGridRowCount}
              audioVisualizerGridColumnCount={audioVisualizerGridColumnCount}
              audioVisualizerWaveLineWidth={audioVisualizerWaveLineWidth}
              isChatOpen={chatOpen}
              className={cn(
                'bg-background rounded-[50px] border border-transparent transition-[border,drop-shadow]',
                chatOpen && 'border-input shadow-2xl/10 delay-200'
              )}
              style={{ color: audioVisualizerColor }}
            />
          </motion.div>
        )}

        {isAvatar && (
          <motion.div
            key="avatar"
            layoutId="avatar"
            initial={{
              scale: 1,
              opacity: 1,
              filter: 'blur(20px)',
            }}
            animate={{
              filter: 'blur(0px)',
              borderRadius: 12,
            }}
            transition={{
              ...ANIMATION_TRANSITION,
              filter: { duration: 1 },
            }}
            className="overflow-hidden bg-black drop-shadow-xl/80 h-auto w-full max-w-lg"
          >
            <VideoTrack
              width={videoWidth}
              height={videoHeight}
              trackRef={agentVideoTrack}
              className="w-full"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera / Screen Share — bottom right */}
      <AnimatePresence>
        {((cameraTrack && isCameraEnabled) || (screenShareTrack && isScreenShareEnabled)) && (
          <motion.div
            key="camera"
            layout="position"
            layoutId="camera"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={ANIMATION_TRANSITION}
            className="absolute bottom-4 right-4 aspect-square size-[90px] drop-shadow-lg/20 pointer-events-auto"
          >
            <VideoTrack
              trackRef={cameraTrack || screenShareTrack}
              width={(cameraTrack || screenShareTrack)?.publication.dimensions?.width ?? 0}
              height={(cameraTrack || screenShareTrack)?.publication.dimensions?.height ?? 0}
              className="bg-muted aspect-square size-[90px] rounded-md object-cover"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
