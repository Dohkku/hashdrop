"use client";

import { QRCodeSVG } from "qrcode.react";
import { secretToQRData } from "@/lib/zk";
import { useState } from "react";

interface QRGeneratorProps {
  secret: bigint;
  orderId: string;
  receiverAddress: string;
  size?: number;
  showSecret?: boolean;
}

export function QRGenerator({
  secret,
  orderId,
  receiverAddress,
  size = 200,
  showSecret = false,
}: QRGeneratorProps) {
  const [copied, setCopied] = useState(false);

  const qrData = secretToQRData(secret, orderId, receiverAddress);

  const handleCopySecret = async () => {
    await navigator.clipboard.writeText(secret.toString());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyQRData = async () => {
    await navigator.clipboard.writeText(qrData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="p-4 bg-white rounded-xl shadow-lg">
        <QRCodeSVG
          value={qrData}
          size={size}
          level="M"
          includeMargin={true}
        />
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
        Muestra este QR al mensajero para confirmar la entrega
      </p>

      {showSecret && (
        <div className="w-full max-w-sm">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Codigo secreto (backup):
          </label>
          <div className="flex gap-2">
            <code className="flex-1 text-xs break-all p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
              {secret.toString().slice(0, 30)}...
            </code>
            <button
              onClick={handleCopySecret}
              className="px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default QRGenerator;
