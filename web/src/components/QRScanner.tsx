"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  width?: number;
  height?: number;
}

export function QRScanner({
  onScan,
  onError,
  width = 300,
  height = 300,
}: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const startScanner = async () => {
    if (!containerRef.current) return;

    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // Success callback
          onScan(decodedText);
          stopScanner();
        },
        (errorMessage) => {
          // Error callback (ignore - this fires constantly while scanning)
        }
      );

      setIsScanning(true);
      setHasPermission(true);
      setError(null);
    } catch (err: any) {
      const errorMessage = err.message || "No se pudo acceder a la camara";
      setError(errorMessage);
      setHasPermission(false);
      onError?.(errorMessage);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (err) {
        // Ignore errors when stopping
      }
      setIsScanning(false);
    }
  };

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className="flex flex-col items-center space-y-4">
      <div
        id="qr-reader"
        ref={containerRef}
        style={{ width, height }}
        className="bg-gray-900 rounded-xl overflow-hidden"
      />

      {error && (
        <div className="text-red-500 text-sm text-center p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
          {error}
        </div>
      )}

      {!isScanning ? (
        <button
          onClick={startScanner}
          className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
        >
          Iniciar Camara
        </button>
      ) : (
        <div className="flex flex-col items-center space-y-2">
          <div className="flex items-center space-x-2 text-green-600 dark:text-green-400">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm">Escaneando...</span>
          </div>
          <button
            onClick={stopScanner}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Detener
          </button>
        </div>
      )}

      {hasPermission === false && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-xs">
          Necesitas permitir acceso a la camara para escanear el codigo QR
        </p>
      )}
    </div>
  );
}

export default QRScanner;
