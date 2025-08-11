declare module 'react-signature-canvas' {
  import React from 'react';

  interface SignatureCanvasProps {
    canvasProps?: React.CanvasHTMLAttributes<HTMLCanvasElement>;
    backgroundColor?: string;
    penColor?: string;
    minWidth?: number;
    maxWidth?: number;
    velocityFilterWeight?: number;
    onBegin?: () => void;
    onEnd?: () => void;
  }

  export default class SignatureCanvas extends React.Component<SignatureCanvasProps> {
    clear(): void;
    isEmpty(): boolean;
    toDataURL(type?: string, encoderOptions?: number): string;
    toData(): Array<{ x: number; y: number; time: number }[]>;
    fromData(pointGroups: Array<{ x: number; y: number; time: number }[]>): void;
  }
}