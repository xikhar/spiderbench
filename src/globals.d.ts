interface BootProgress {
  stage(name: string): Promise<void>;
  sub(progress: number): void;
  done(): void;
}

interface Window {
  __boot?: BootProgress;
  __ctx?: any;
  __shotInfo?: string;
  __shotReady?: boolean;
}
