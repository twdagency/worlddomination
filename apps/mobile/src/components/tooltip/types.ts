export interface TooltipDefinition {
  id: string;
  title?: string;
  body: string;
  dismissable: boolean;
  showOncePerSession?: boolean;
  persistDismissal?: boolean;
}

export interface AnchorLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}
