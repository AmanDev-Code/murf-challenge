export interface AppConfig {
  pageTitle: string;
  pageDescription: string;
  companyName: string;

  supportsChatInput: boolean;
  supportsVideoInput: boolean;
  supportsScreenShare: boolean;
  isPreConnectBufferEnabled: boolean;

  logo: string;
  startButtonText: string;
  accent?: string;
  logoDark?: string;
  accentDark?: string;

  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  audioVisualizerColor?: `#${string}`;
  audioVisualizerColorDark?: `#${string}`;
  audioVisualizerColorShift?: number;
  audioVisualizerBarCount?: number;
  audioVisualizerGridRowCount?: number;
  audioVisualizerGridColumnCount?: number;
  audioVisualizerRadialBarCount?: number;
  audioVisualizerRadialRadius?: number;
  audioVisualizerWaveLineWidth?: number;

  // agent dispatch configuration
  agentName?: string;

  // LiveKit Cloud Sandbox configuration
  sandboxId?: string;
}

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'VoicePay',
  pageTitle: 'VoicePay — Voice Banking for Bharat',
  pageDescription: 'AI-powered voice banking assistant. Check balances, learn about UPI, get financial guidance — all through natural conversation in your language.',

  supportsChatInput: true,
  supportsVideoInput: false,
  supportsScreenShare: false,
  isPreConnectBufferEnabled: true,

  logo: '/murf-logo.svg',
  accent: '#1e3a5f',
  logoDark: '/murf-logo-dark.svg',
  accentDark: '#f5a623',
  startButtonText: 'Start Talking to VoicePay',

  // Audio visualizer — radial style for a modern banking feel
  audioVisualizerType: 'radial',
  audioVisualizerColor: '#1e3a5f',
  audioVisualizerColorDark: '#f5a623',
  audioVisualizerColorShift: 0.3,
  audioVisualizerRadialBarCount: 32,
  audioVisualizerRadialRadius: 120,

  // agent dispatch configuration
  agentName: process.env.AGENT_NAME ?? 'voicepay',

  // LiveKit Cloud Sandbox configuration
  sandboxId: undefined,
};
